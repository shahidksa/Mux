import { useState, useMemo } from "react";
import { formatMoney } from "../utils/monetary";
import { computeGoalDynamicBalance } from "../utils/goalBalanceEngine";
import { toast } from "sonner";
import { db } from "../../db";
import { toLocalDateString } from "../../utils/dates";



export function GoalCompletionModal({ goal, allGoals, wallets, baseCurrency, onClose, onSaved, onActionComplete, allExpenses }: {
  goal: any;
  allGoals: any[];
  wallets: any[];
  baseCurrency: string;
  onClose: () => void;
  onSaved: () => void;
  onActionComplete?: () => void;
  allExpenses?: any[];
}) {
  const [mode, setMode] = useState<"choose" | "spent" | "reallocate">("choose");
  const goalDynamicBalance = useMemo(() => {
    if (!allExpenses) return goal.current_amount;
    return computeGoalDynamicBalance(goal.name, allExpenses);
  }, [goal.name, allExpenses]);
  const [spentAmountDollars, setSpentAmountDollars] = useState((goalDynamicBalance || 0) / 100);
  const [spentWalletId, setSpentWalletId] = useState<number | null>(wallets[0]?.id ?? null);
  const [spentDesc, setSpentDesc] = useState(`Purchased ${goal.name}`);
  const [destGoalId, setDestGoalId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpendSuccess, setIsSpendSuccess] = useState(false);
  const [transferAmount, setTransferAmount] = useState<string>(((goalDynamicBalance || 0) / 100).toString());
  const [selectedPct, setSelectedPct] = useState<number | null>(100);

  const linkedWallet = wallets.find(w => w.id === goal.linked_wallet_id) || wallets[0];
  const linkedWalletBalance = linkedWallet?.balance ?? 0;
  const goalAmountCents = goalDynamicBalance;

  const selectedWallet = wallets.find(w => w.id === spentWalletId);
  const liveAdjustedBalance = (selectedWallet?.balance ?? 0) - (Number(spentAmountDollars) * 100 || 0);

  const destGoalDynamicBalance = useMemo(() => {
    const map = new Map<number, number>();
    if (allExpenses) {
      for (const g of allGoals) {
        map.set(g.id!, computeGoalDynamicBalance(g.name, allExpenses));
      }
    }
    return map;
  }, [allGoals, allExpenses]);

  const eligibleDestGoals = allGoals.filter(
    (g: any) => g.id !== goal.id && (destGoalDynamicBalance.get(g.id!) ?? g.current_amount) < g.target_amount
  );

  const selectedDestGoal = eligibleDestGoals.find((g: any) => g.id === destGoalId) || null;

  const destBalance = selectedDestGoal ? (destGoalDynamicBalance.get(selectedDestGoal.id!) ?? selectedDestGoal.current_amount) : 0;
  const availableRoomCeiling = selectedDestGoal
    ? Math.max(0, (selectedDestGoal.target_amount || 0) - destBalance) / 100
    : 0;
  const ceilingExceeded = selectedDestGoal !== null && Number(transferAmount) > availableRoomCeiling;

  const handleSpentConfirm = async () => {
    setError(null);
    const enteredDollars = Number(spentAmountDollars);
    if (!Number.isFinite(enteredDollars) || enteredDollars <= 0) { setError("Enter a valid amount greater than 0"); return; }
    const cents = Math.floor(enteredDollars * 100);
    const goalBalanceDollars = goalAmountCents / 100;
    if (enteredDollars > goalBalanceDollars) {
      setError(`Amount cannot exceed goal balance (${formatMoney(goalAmountCents, baseCurrency)})`);
      return;
    }
    const wallet = wallets.find(w => w.id === spentWalletId);
    if (wallet && wallet.balance < cents) {
      setError(`Insufficient balance: wallet ${formatMoney(wallet.balance, baseCurrency)} < requested ${formatMoney(cents, baseCurrency)}. Reduce amount or pick another wallet.`);
      return;
    }
    setBusy(true);
    try {
      const freshGoal = await db.savings_goals.get(goal.id!);
      if (!freshGoal) throw new Error('Goal not found in database');

      const isFullSpend = enteredDollars >= goalBalanceDollars;

      // Write expense ledger row — convention: positive amount, type signals direction
      await db.expenses.add({
        wallet_id: spentWalletId,
        amount: cents,
        category: freshGoal.system_category || 'Fixed Assets',
        subcategory: freshGoal.system_subcategory || 'Asset Acquisition',
        type: 'expense',
        date: toLocalDateString(),
        description: `Purchased ${freshGoal.name} (Goal Fulfilled)`,
        created_at: new Date().toISOString(),
      });

      // Deduct from wallet
      await db.wallets.update(spentWalletId!, { balance: (wallet?.balance || 0) - cents });

      if (isFullSpend) {
        // CASE A — Full spend: goal is done, show success branching
        await db.savings_goals.update(goal.id!, { current_amount: 0 });
        onActionComplete?.();
        setBusy(false);
        setIsSpendSuccess(true);
      } else {
        // CASE B — Partial spend: update goal with remainder, close modal
        const remainderCents = goalAmountCents - cents;
        await db.savings_goals.update(goal.id!, { current_amount: remainderCents });
        onActionComplete?.();
        toast.success(`Partial expense recorded. Remaining goal balance: ${formatMoney(remainderCents, baseCurrency)}`);
        setBusy(false);
        onSaved();
      }
    } catch (err: any) {
      setError(err.message || "Failed to record expense");
      setBusy(false);
    }
  };

  const handleReallocateConfirm = async () => {
    setError(null);
    if (!destGoalId) { setError("Select a destination goal"); return; }
    if (goalAmountCents <= 0) { setError("Source goal has no balance to reallocate"); return; }
    const enteredDollars = parseFloat(transferAmount);
    if (!Number.isFinite(enteredDollars) || enteredDollars <= 0 || isNaN(enteredDollars)) {
      setError("Enter a valid transfer amount greater than 0");
      return;
    }
    const cents = Math.floor(enteredDollars * 100);
    if (cents > goalAmountCents) {
      setError(`Amount cannot exceed source balance (${formatMoney(goalAmountCents, baseCurrency)})`);
      return;
    }

    const ublWallet = wallets.find(w => w.name === 'UBL');
    if (!ublWallet) {
      setError('UBL wallet not found. Please create a UBL wallet first.');
      return;
    }

    setBusy(true);
    try {
      await db.transaction('rw', ['expenses', 'savings_goals'], async () => {
        const sourceGoal = await db.savings_goals.get(goal.id!);
        const targetGoal = await db.savings_goals.get(destGoalId!);

        if (!sourceGoal || !targetGoal) {
          throw new Error("Target vaults could not be resolved safely.");
        }

        const sourceNewAmount = (sourceGoal.current_amount || 0) - cents;
        const targetNewAmount = (targetGoal.current_amount || 0) + cents;

        await db.expenses.add({
          wallet_id: ublWallet.id,
          amount: cents,
          category: 'Fixed Assets',
          subcategory: 'Internal Vault Transfer',
          type: 'transfer',
          date: toLocalDateString(),
          description: `Reallocated "${sourceGoal.name}" funds to "${targetGoal.name}"`,
          created_at: new Date().toISOString()
        });

        await db.savings_goals.update(sourceGoal.id!, {
          current_amount: sourceNewAmount
        });

        await db.savings_goals.update(targetGoal.id!, {
          current_amount: targetNewAmount
        });
      });

      console.log("[GoalCompletionModal] Cross-vault transaction committed successfully!");
      onActionComplete?.();
      onSaved();
    } catch (err: any) {
      console.error("[GoalCompletionModal] Database halt error intercepted:", err.message);
      setError(err.message || "Failed to reallocate");
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-4 bg-zinc-900/10 dark:bg-black/30 backdrop-blur-[6px] select-none overflow-hidden animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl text-zinc-900 dark:text-white animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-white">{goal.name} - Goal Complete!</h2>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
              {formatMoney(goalDynamicBalance, baseCurrency)} / {formatMoney(goal.target_amount, baseCurrency)}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">&times;</button>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Wallet Balance</span>
            <span className={`text-sm font-black ${linkedWalletBalance >= goalAmountCents ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{formatMoney(linkedWalletBalance, baseCurrency)}</span>
          </div>
          {mode === "spent" && Number(spentAmountDollars) > 0 && (
            <div className="text-xs text-gray-500 font-semibold mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
              Adjusted Wallet Preview: <span className={liveAdjustedBalance < 0 ? "text-red-600 font-bold" : "text-indigo-600 font-bold"}>
                {formatMoney(liveAdjustedBalance, baseCurrency)}
              </span>
            </div>
          )}
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center mb-2">
              <p className="text-2xl mb-1">🎉</p>
              <p className="text-xs font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">Goal Complete — Congratulations!</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">What would you like to do with the funds?</p>
            </div>
            <button type="button" onClick={() => {
              if (linkedWalletBalance <= 0) { setError("Wallet has zero balance - Mark as Spent is disabled. Try Reallocate instead."); return; }
              setMode("spent");
            }} className="w-full text-left p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={linkedWalletBalance <= 0}>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 block">💰 Mark as Spent</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">Record as an expense from your wallet — full or partial amount</span>
              {linkedWalletBalance <= 0 && (
                <span className="text-[10px] text-red-500 mt-0.5 block">Wallet balance is zero - not available</span>
              )}
              {linkedWalletBalance > 0 && linkedWalletBalance < goalAmountCents && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
                  Wallet too low for full amount - partial expense only ({formatMoney(linkedWalletBalance, baseCurrency)} available)
                </span>
              )}
            </button>
            <button type="button" onClick={() => {
              if (eligibleDestGoals.length === 0) { setError("No eligible destination goals found - all other goals are complete."); return; }
              setDestGoalId(eligibleDestGoals[0]?.id ?? null);
              setTransferAmount((goalDynamicBalance || 0) / 100);
              setSelectedPct(100);
              setMode("reallocate");
            }} className="w-full text-left p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={eligibleDestGoals.length === 0}>
              <span className="text-xs font-black text-blue-700 dark:text-blue-300 block">🔄 Reallocate to Another Goal</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block">Move funds to a different active goal — no wallet impact</span>
              {eligibleDestGoals.length === 0 && (
                <span className="text-[10px] text-red-500 mt-0.5 block">No other active goals with room available</span>
              )}
            </button>
            <button type="button" onClick={onClose} className="w-full text-center p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-xs font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer border border-zinc-200 dark:border-zinc-600">
              Leave for Now - Decide Later
            </button>
          </div>
        )}        {mode === "spent" && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setMode("choose"); setError(null); }} className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">&larr; Back</button>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Amount to Record</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.01" value={spentAmountDollars} onChange={(e) => { const v = parseFloat(e.target.value); setSpentAmountDollars(Number.isFinite(v) ? Math.min(v, goalAmountCents / 100) : e.target.value); }} className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500" />
                <span className="text-[10px] font-black text-zinc-400">/ {formatMoney(goalAmountCents, baseCurrency)}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Wallet</label>
              <select value={spentWalletId ?? ""} onChange={(e) => setSpentWalletId(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer">
                {wallets.map((w: any) => (<option key={w.id} value={w.id}>{w.name} ({formatMoney(w.balance, baseCurrency)})</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1.5">Category</label>
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider shrink-0">📁 Main</span>
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-100">{goal.system_category || 'Fixed Assets'}</span>
                  <span className="text-[9px] font-medium text-purple-500 dark:text-purple-400 ml-auto">[System Locked]</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider shrink-0">📍 Sub</span>
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-100">{goal.system_subcategory || 'Asset Acquisition'}</span>
                  <span className="text-[9px] font-medium text-purple-500 dark:text-purple-400 ml-auto">[System Locked]</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Description</label>
              <input type="text" value={spentDesc} onChange={(e) => setSpentDesc(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500" />
            </div>
            {error && <div className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-2">{error}</div>}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setMode("choose"); setError(null); }} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-xs font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer border border-zinc-200 dark:border-zinc-600">Cancel</button>
              <button type="button" onClick={handleSpentConfirm} disabled={busy} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black text-white transition shadow-sm uppercase cursor-pointer">
                {busy ? "Recording..." : "Confirm & Record Expense"}
              </button>
            </div>
          </div>
        )}        {mode === "reallocate" && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setMode("choose"); setError(null); }} className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">&larr; Back</button>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Amount to Transfer</label>
              <div className="flex items-center gap-2">
                 <input type="number" min="0" step="0.01" value={transferAmount} onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  const maxDollars = goalAmountCents / 100;
                  setTransferAmount(Number.isFinite(v) ? Math.min(v, maxDollars) : e.target.value);
                  setSelectedPct(null);
                }} className={`flex-1 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500 ${ceilingExceeded ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800'}`} />
                <span className="text-[10px] font-black text-zinc-400 shrink-0">/ {formatMoney(goalAmountCents, baseCurrency)}</span>
              </div>
              <div className="flex gap-1.5 mt-2">
                                  {[10, 25, 50, 100].map((pct) => (
                  <button key={pct} type="button" onClick={() => {
                    const totalGoalBalance = goalAmountCents / 100;
                    const targetValue = totalGoalBalance * (pct / 100);
                    setTransferAmount(targetValue.toFixed(2));
                    setSelectedPct(pct);
                  }} className={`flex-1 py-1.5 rounded-full border text-[10px] font-black transition-all cursor-pointer ${selectedPct === pct ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-500" : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600"}`}>
                    {pct}%
                  </button>
                ))}
              </div>
              {ceilingExceeded && (
                <p className="text-[10px] text-red-600 font-semibold mt-1.5">Transfer amount exceeds destination room ceiling capacity.</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Destination Goal</label>
              <select value={destGoalId ?? ""} onChange={(e) => setDestGoalId(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer">
                {eligibleDestGoals.length === 0 && <option value="">No eligible goals</option>}
                {eligibleDestGoals.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {selectedDestGoal && (
                <div className="mt-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider shrink-0">Name</span>
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 text-right">{selectedDestGoal.name}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider shrink-0">Current Progress</span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 text-right">{formatMoney(selectedDestGoal.current_amount, baseCurrency)} / {formatMoney(selectedDestGoal.target_amount, baseCurrency)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider shrink-0">Available Room Ceiling</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 text-right">{formatMoney(Math.max(0, selectedDestGoal.target_amount - selectedDestGoal.current_amount), baseCurrency)}</span>
                  </div>
                </div>
              )}
            </div>
            {error && <div className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-2">{error}</div>}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setMode("choose"); setError(null); }} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-xs font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer border border-zinc-200 dark:border-zinc-600">Cancel</button>
              <button type="button" onClick={handleReallocateConfirm} disabled={busy || !destGoalId || ceilingExceeded} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black text-white transition shadow-sm uppercase cursor-pointer">
                {busy ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        )}
        {isSpendSuccess && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <p className="text-lg mb-1">✅</p>
              <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">Expense Recorded Successfully</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">{formatMoney(Math.floor(Number(spentAmountDollars) * 100), baseCurrency)} recorded from wallet</p>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed text-center">
              What would you like to do with this goal card?
            </p>
            <button
              type="button"
              onClick={async () => {
                await db.savings_goals.update(goal.id!, { current_amount: 0 });
                onActionComplete?.();
                onSaved();
              }}
              className="w-full text-left p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 block">📁 Keep Card & Reset to ₨0.00</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 block">Goal stays in your list reset to zero — reuse for the same target</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await db.savings_goals.delete(goal.id!);
                onActionComplete?.();
                onSaved();
              }}
              className="w-full text-left p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
            >
              <span className="text-xs font-black text-red-700 dark:text-red-300 block">🗑️ Delete Goal Card Permanently</span>
              <span className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 block">Completely removes the goal from your database</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}