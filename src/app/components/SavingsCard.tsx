import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { useExpenses } from "../context/ExpenseContext";
import { useSettings } from "../context/SettingsContext";
import { CURRENCY_SYMBOLS } from "../utils/currency";
import { roundMoney, sumMoney, formatMoney, parseDollarsToCents } from "../utils/monetary";
import { allocateManualFunds } from "../services/savingsEngine";
import { startOfMonth } from "date-fns";
import { GoalCompletionModal } from "./GoalCompletionModal";
import { computeGoalDynamicBalance } from "../utils/goalBalanceEngine";

interface SavingsGoalRowProps {
  goal: any;
  allGoals: any[];
  wallets: any[];
  baseCurrency: string;
  onCompleteBadgeClick: (goal: any) => void;
  dynamicBalance: number;
}
function SavingsGoalRow({ goal, allGoals, wallets, baseCurrency, onCompleteBadgeClick, dynamicBalance }: SavingsGoalRowProps) {
  const [isAddingCash, setIsAddingCash] = useState(false);
  const [addCashAmount, setAddCashAmount] = useState("");
  const [addCashWalletId, setAddCashWalletId] = useState<number | null>(null);

  const percentage = goal.target_amount > 0
    ? Math.min(Math.round((dynamicBalance / goal.target_amount) * 100), 100)
    : 0;

  const leftAmount = Math.max(goal.target_amount - dynamicBalance, 0);
  const isComplete = dynamicBalance >= goal.target_amount;

  const goalNameStr = String(goal.name);
  const percentageStr = percentage + "%";
  const savedStr = formatMoney(dynamicBalance, baseCurrency) + " saved";
  const leftStr = formatMoney(leftAmount, baseCurrency) + " left";

  const handleOpenAddCash = () => {
    if (dynamicBalance >= goal.target_amount) return;
    setIsAddingCash(true);
    if (wallets && wallets.length > 0 && wallets[0]) {
      setAddCashWalletId(wallets[0].id);
    }
  };

  const handleCancel = () => {
    setIsAddingCash(false);
    setAddCashAmount("");
  };

  const handleConfirm = async () => {
    if (!addCashAmount || addCashWalletId === null) return;
    try {
      const baseDollars = Math.abs(parseFloat(addCashAmount) || 0);
      const baseCents = Math.round(baseDollars * 100);
      await allocateManualFunds(goal.id, addCashWalletId, baseCents);
      setIsAddingCash(false);
      setAddCashAmount("");
    } catch (err) {
      console.error("Failed to allocate funds:", err);
    }
  };
  return (
    <div className="w-full bg-gray-50 dark:bg-[#111827]/30 border border-slate-200 dark:border-slate-900/60 p-4 rounded-xl flex flex-col gap-2 shadow-inner mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-text-primary uppercase tracking-wide">{goalNameStr}</span>
        {!isAddingCash && (
          <button
            type="button"
            disabled={isComplete}
            onClick={handleOpenAddCash}
            className={`text-[10px] font-bold px-2 py-1 rounded transition border ${
              isComplete
                ? "opacity-50 cursor-not-allowed bg-bg-input text-text-muted border-border-main"
                : "bg-bg-input hover:opacity-80 text-text-primary border-border-main"
            }`}
          >
            {isComplete ? "Complete" : "+ Add Funds"}
          </button>
        )}
      </div>

      <div className="relative h-6 w-full overflow-hidden rounded-full bg-black/20 border border-border-main shadow-inner mb-2.5">
        {percentage > 0 && (
          <div
            className={`flex items-center justify-end h-full rounded-full pr-3 transition-all duration-500 ease-out will-change-[width] ${isComplete ? "bg-emerald-600" : "bg-blue-600"}`}
            style={{ width: percentageStr }}
          >
            {percentage >= 12 && (
              <span className={`text-[10px] font-black tracking-wider tabular-nums opacity-95 ${isComplete ? "text-white" : "text-text-primary"}`}>
                {percentageStr}
              </span>
            )}
          </div>
        )}
        {percentage < 12 && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted tabular-nums">
            {percentageStr}
          </span>
        )}
      </div>
      {isAddingCash && (
        <div className="p-2.5 bg-bg-input/60 rounded-lg border border-border-main mb-2.5 space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={"Amount (" + CURRENCY_SYMBOLS[baseCurrency] + ")"}
              value={addCashAmount}
              onChange={(e) => setAddCashAmount(e.target.value)}
              className="flex-1 min-w-0 bg-bg-input border border-border-main rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-blue-500 font-semibold"
            />
            <select
              value={addCashWalletId || ""}
              onChange={(e) => setAddCashWalletId(Number(e.target.value))}
              className="flex-1 min-w-0 bg-bg-input border border-border-main rounded px-1.5 py-1 text-xs text-text-secondary focus:outline-none focus:border-blue-500"
            >
              {wallets.map((w) => {
                const optLabel = w.name + " (" + formatMoney(w.balance, baseCurrency) + ")";
                return (<option key={w.id} value={w.id}>{optLabel}</option>);
              })}
            </select>
          </div>
          <div className="flex justify-end gap-1.5 text-[10px]">
            <button type="button" onClick={handleCancel} className="px-2 py-1 text-text-muted hover:text-text-primary font-medium">Cancel</button>
            <button type="button" onClick={handleConfirm} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition shadow-sm">Confirm Allocation</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-emerald-600 font-semibold">{savedStr}</span>
        {isComplete ? (
          <button
            type="button"
            onClick={() => onCompleteBadgeClick(goal)}
            className="text-emerald-600 font-bold underline decoration-dotted underline-offset-2 cursor-pointer hover:text-emerald-700 transition"
            title="Goal complete - click to spend or reallocate"
          >
            ? Completed
          </button>
        ) : (
          <span className="text-amber-400 font-bold">{leftStr}</span>
        )}
      </div>
    </div>
  );
}
export function SavingsCard({ totalWealthPool: propTotalWealthPool }: { totalWealthPool?: number } = {}) {
  const { wallets } = useExpenses();
  const { baseCurrency } = useSettings();
  const navigate = useNavigate();
  const [activeCompletionGoal, setActiveCompletionGoal] = useState<any | null>(null);

  const goals = useLiveQuery(() => db.savings_goals.toArray()) || [];
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const goalBalanceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const goal of goals) {
      map.set(goal.id!, computeGoalDynamicBalance(goal.name, allExpenses));
    }
    return map;
  }, [goals, allExpenses]);

  const totalWealthPool = propTotalWealthPool ?? useMemo(() => {
    return roundMoney(sumMoney(wallets.map(w => w.balance || 0)));
  }, [wallets]);

  const monthStart = useMemo(() => startOfMonth(new Date()), []);

  const monthlyExpensesTotal = useMemo(() => {
    return roundMoney(sumMoney(
      allExpenses.filter(e => String(e.type).toLowerCase() === "expense" && e.category !== "Savings Transfer" && new Date(e.date) >= monthStart).map(e => e.amount)
    ));
  }, [allExpenses, monthStart]);

  const totalActiveBudgets = useMemo(() => {
    return roundMoney(sumMoney(budgets.map(b => (b.limit_amount || 0))));
  }, [budgets]);

  const rightNow = new Date();
  const dateTodayString = rightNow.toLocaleDateString("en-CA");
  const sweepAlreadyProcessedToday = goals.some(g => (g as any).last_processed_sweep === dateTodayString);

  const rawSurplus = totalActiveBudgets - monthlyExpensesTotal;
  const surplus = sweepAlreadyProcessedToday ? 0 : Math.max(0, rawSurplus);
  const isDeficit = rawSurplus < 0;

  const hoursToMidnight = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffMs = midnight.getTime() - now.getTime();
    return Math.max(0, +(diffMs / (1000 * 60 * 60)).toFixed(1));
  }, []);

  const totalWealthPoolStr = formatMoney(totalWealthPool, baseCurrency);
  const surplusStr = formatMoney(surplus, baseCurrency);
  const hoursStr = "~" + hoursToMidnight + "h";        

  return (
    <>
      <div className="rounded-xl border border-border-main bg-bg-card p-5 flex flex-col justify-start items-stretch flex-1 w-full shadow-sm">
        <div className="flex items-start justify-between w-full">
          <h2 className="text-[15px] font-bold tracking-wide text-text-primary">Financial Health & Savings</h2>
          <div className="text-right flex flex-col items-end space-y-0 pr-4">
            <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase">Total Wealth Pool</span>
            <span className="text-lg text-text-primary tracking-tight mt-0 block">{totalWealthPoolStr}</span>
          </div>
        </div>
        <div className="flex-1 my-[11px] overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
          {goals.length === 0 && (
            <div className="flex flex-col items-center justify-center p-6 bg-bg-input/30 border border-dashed border-border-main rounded-xl text-center my-3 w-full">
              <span className="text-xl mb-1.5">🎯</span>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-0.5">No Active Savings Goals</h4>
              <p className="text-[11px] text-text-muted max-w-[200px] leading-tight mb-3">Configure long-term asset targets inside your account settings.</p>
              <button type="button" onClick={() => { (window as any).autoScrollToSavings = true; navigate("/settings"); }} className="text-[11px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-sm shadow-[#2563EB]/10">Go to Settings</button>
            </div>
          )}
          {goals.map((goal) => (
            <SavingsGoalRow
              key={goal.id}
              goal={goal}
              allGoals={goals}
              wallets={wallets}
              baseCurrency={baseCurrency}
              onCompleteBadgeClick={setActiveCompletionGoal}
              dynamicBalance={goalBalanceMap.get(goal.id!) ?? goal.current_amount}
            />
          ))}
        </div>
      </div>
      {activeCompletionGoal && (
        <GoalCompletionModal
          goal={activeCompletionGoal}
          allGoals={goals}
          wallets={wallets}
          baseCurrency={baseCurrency}
          onClose={() => setActiveCompletionGoal(null)}
          onSaved={() => setActiveCompletionGoal(null)}
          allExpenses={allExpenses}
        />
      )}
    </>
  );
}
