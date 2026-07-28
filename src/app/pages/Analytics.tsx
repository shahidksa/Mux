import { useState, useMemo, useRef, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { BudgetPerformanceReportTable } from '../components/BudgetPerformanceReportTable';
import { CashflowLineChart } from '../components/CashflowLineChart';
import { ExpensesByCategoryDonut } from '../components/ExpensesByCategoryDonut';
import { ExpensesByWalletDonut } from '../components/ExpensesByWalletDonut';
import { HelpModal } from '../components/HelpModal';
import { useSettings } from '../context/SettingsContext';
import { CURRENCY_SYMBOLS, DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { exportBudgetPerformanceExcel } from '../utils/excelEngine';
import { AppHeaderBanner } from '../components/AppHeaderBanner';
import { GoalCompletionModal } from '../components/GoalCompletionModal';
import { toLocalDateString } from '../../utils/dates';
import { formatMoney, parseDollarsToCents } from '../utils/monetary';
import { computeGoalDynamicBalance } from '../utils/goalBalanceEngine';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { toast } from 'sonner';

export function Analytics({ safetyFloor, lockedSavings, budgetSurplusRule }: { safetyFloor?: number; lockedSavings?: number; budgetSurplusRule?: 'wallet' | 'sweep' } = {}) {
  const navigate = useNavigate();
  const { baseCurrency, exchangeRates } = useSettings();
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  const fxRate = rates[baseCurrency] || 1;
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const savingsGoals = useLiveQuery(() => db.savings_goals.toArray()) || [];

  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [completionGoal, setCompletionGoal] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const dateObj = new Date();
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const curMonthName = monthsList[dateObj.getMonth()];
  const prevMonthName = monthsList[dateObj.getMonth() === 0 ? 11 : dateObj.getMonth() - 1];
  const curYear = dateObj.getFullYear();
  const quickAddRef = useRef<HTMLDivElement>(null);

  const sf = safetyFloor ?? 0;
  const ls = lockedSavings ?? 0;
  const settings = useMemo(() => ({ safetyFloor: sf, capitalShield: ls, budgetSurplusRule }), [sf, ls, budgetSurplusRule]);

  const activeWalletRaw = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  const metrics = useFinancialMetrics(expenses, baseCurrency, fxRate, settings, categories, savingsGoals, activeWalletRaw);

  const goalBalanceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of (savingsGoals || [])) {
      map.set(g.id!, computeGoalDynamicBalance(g.name, expenses));
    }
    return map;
  }, [savingsGoals, expenses]);

  const activeGoalPercentSum = useMemo(() => savingsGoals
    ? savingsGoals
        .filter(g => g.auto_deposit_surplus && (goalBalanceMap.get(g.id!) ?? g.current_amount) < g.target_amount)
        .reduce((sum, g) => sum + (g.sweep_ratio ?? g.allocation_ratio ?? 0), 0)
    : 0, [savingsGoals, goalBalanceMap]);
  const availableSurplus = metrics?.autoSweepSurplus ?? 0;
  const masterVal = Number(localStorage.getItem('globalMasterValue') || 15);
  const totalSavingsBudget = availableSurplus * (masterVal / 100);
  const explicitSweepTarget = totalSavingsBudget * (activeGoalPercentSum / 100);
  const retainedLiquidBuffer = activeWalletRaw - explicitSweepTarget;
  const topExpensesList = useMemo(() => {
    return [...expenses]
      .filter(e => String(e.type).toLowerCase() === 'expense')
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5);
  }, [expenses]);

  const activeSavingsGoals = useLiveQuery(() => db.savings_goals.toArray()) || [];
  const hasGoals = activeSavingsGoals.length > 0;

  // Check if a goal was previously fulfilled by searching for "(Goal Fulfilled)" in transactions
  const wasGoalPreviouslyFulfilled = useCallback(async (goalName: string) => {
    try {
      const expenses = await db.expenses.toArray();
      return expenses.some(expense => 
        expense.description && expense.description.includes('(Goal Fulfilled)')
      );
    } catch {
      return false;
    }
  }, []);

  const [depositGoalId, setDepositGoalId] = useState<number | null>(null);
  const [depositGoalName, setDepositGoalName] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositWalletId, setDepositWalletId] = useState<number | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const handleOpenManualDepositModal = (goalId: number | undefined, goalName: string) => {
    if (goalId == null) return;
    setDepositGoalId(goalId);
    setDepositGoalName(goalName);
    setDepositAmount('');
    setDepositWalletId(null);
    setShowDepositModal(true);
  };

  const handleConfirmDeposit = async () => {
    if (!depositGoalId || !depositWalletId || !depositAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    const amountCents = parseDollarsToCents(depositAmount);
    if (!amountCents || isNaN(amountCents)) {
      toast.error('Enter a valid deposit amount');
      return;
    }
    // All values in base currency — direct transfer, no conversion
    const wallet = wallets.find(w => w.id === depositWalletId);
    if (!wallet || wallet.balance < amountCents) {
      toast.error('Insufficient wallet balance');
      return;
    }
    try {
      const goal = await db.savings_goals.get(depositGoalId!);
      if (!goal) { toast.error('Goal not found'); return; }

      const headroomCents = goal.target_amount - goal.current_amount;
      const clampedCents = Math.min(amountCents, headroomCents);

      if (clampedCents <= 0) {
        toast.info('Goal is already fully funded');
        setShowDepositModal(false);
        setRefreshKey(k => k + 1);
        return;
      }

      if (clampedCents < amountCents) {
        toast.info(`Goal only needs ${formatMoney(headroomCents, baseCurrency)} — depositing that amount instead`);
      }

      await db.transaction('rw', [db.wallets, db.savings_goals, db.expenses], async () => {
        await db.wallets.update(depositWalletId!, { balance: wallet.balance - clampedCents });
        await db.savings_goals.update(depositGoalId!, { current_amount: (goal.current_amount || 0) + clampedCents });
        await db.expenses.add({
          wallet_id: depositWalletId,
          amount: clampedCents,
          category: 'Savings Transfer',
          type: 'transfer',
          date: toLocalDateString(),
          description: `Manual Deposit to ${depositGoalName}`,
          created_at: new Date().toISOString(),
        });
      });
      toast.success(`Deposited ${formatMoney(clampedCents, baseCurrency)} → ${depositGoalName}`);
      setRefreshKey(k => k + 1);
      setShowDepositModal(false);
    } catch {
      toast.error('Deposit failed');
    }
  };

  return (
    <div className="w-full h-full bg-slate-50/50 dark:bg-slate-900/20 px-6 pt-2 flex flex-col justify-start gap-y-4 text-slate-800 dark:text-slate-100 select-none">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
          <div>
            <h1 className="text-3xl font-black text-slate-950 dark:text-white mt-2 leading-none">Analytics</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Detailed insights of your cashflow</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="border-2 border-blue-600/30 hover:bg-blue-600 hover:text-white text-blue-600 px-3 py-1.5 rounded-lg transition cursor-pointer text-xs font-semibold"
            >
              ❓ Help
            </button>
            <button
              type="button"
              onClick={exportBudgetPerformanceExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
            >
              📈 Export Performance Excel
            </button>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-bg-card border border-border-main rounded-lg px-2.5 py-1.5 text-text-secondary focus:outline-none focus:border-blue-500"
            >
              <option value="This Month">This Month ({curMonthName} {curYear})</option>
              <option value="Last Month">Last Month ({prevMonthName} {curYear})</option>
              <option value="This Year">This Year ({curYear})</option>
              <option value="All Time">All Transactions</option>
            </select>

            <span className="text-xs font-semibold text-blue-600 border-2 border-blue-600/30 rounded-lg px-3 py-1.5">{CURRENCY_SYMBOLS[baseCurrency]} {baseCurrency}</span>
          </div>
        </div>

        <AppHeaderBanner
          safetyFloor={metrics.safetyFloor}
          capitalShield={metrics.capitalShield}
          surplus={metrics.autoSweepSurplus}
          efficiencyScore={metrics.efficiencyScore}
          isOverBurning={metrics.isOverBurning}
          overBurnSpeed={metrics.overBurnSpeed}
          targetBase={metrics.targetBase}
          baseCurrency={baseCurrency}
          expenses={expenses}
        />

        {/* SECTION 1: TOP CHARTS ROW - CASHFLOW TREND + BUDGET REPORT */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-auto w-full items-stretch mb-1 min-h-[255px] grow basis-0">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col justify-between overflow-hidden min-h-[253px]">
            <div className="flex-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Cashflow Trend</h3>
            </div>
            <div className="flex-1 min-h-0 w-full relative"><CashflowLineChart /></div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col justify-between overflow-hidden min-h-[253px]">
            <div className="flex-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Budget Performance Report — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin pr-1 mt-1">
              <BudgetPerformanceReportTable variant="analytics" hideHeading={true} expenses={expenses} budgets={budgets} />
            </div>
          </div>
        </div>

        {/* SECTION 2: MIDDLE CHARTS ROW - DONUT CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full grow basis-0">
          <div className="w-full h-full bg-white dark:bg-slate-800 border border-border-main rounded-xl p-4 flex flex-col min-h-[253px]">
            <h2 className="text-sm font-bold text-text-primary mb-4 shrink-0">Expenses by Category</h2>
            <div className="flex-1 min-h-0"><ExpensesByCategoryDonut period={selectedPeriod} lockedSavings={lockedSavings ?? 5.40} expenses={expenses} categoryChartData={metrics.categoryChartData} /></div>
          </div>
          <div className="w-full h-full bg-white dark:bg-slate-800 border border-border-main rounded-xl p-4 flex flex-col min-h-[253px]">
            <h2 className="text-sm font-bold text-text-primary mb-4 shrink-0">Expenses by Wallet</h2>
            <div className="flex-1 min-h-0"><ExpensesByWalletDonut lockedSavings={lockedSavings ?? 5.40} expenses={expenses} wallets={wallets} /></div>
          </div>
        </div>
{/*
  ======================================================================
  ✅ THE OFFICIAL ANALYTICS LOWER TIER BREAKPOINT BLUEPRINT (ROW 4)
  - 'grid-cols-1 lg:grid-cols-3 gap-4 items-stretch' unifies all 3 card row heights perfectly!
  ======================================================================
*/}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch w-full h-auto grow basis-0 mt-1 pb-1 text-slate-900 dark:text-slate-50">

          {/* 📦 CARD 1: FINANCIAL HEALTH & SAVINGS (THE EMPTY STATE DESIGNS) */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between h-full min-h-[280px] relative">
            {/* Upper Title Grouping */}
            <div className="flex justify-between items-start w-full">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Financial Health & Savings
              </h3>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Total Wealth Pool</span>
                 <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {formatMoney(metrics?.totalWealthPool || 0, baseCurrency)}
                 </span>
              </div>
            </div>

            {/* Center Content: Goal Progress Rows or Empty State */}
            {hasGoals ? (
              <div className="space-y-3 mt-4 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                {activeSavingsGoals.map((goal) => {
                  const db = goalBalanceMap.get(goal.id!) ?? goal.current_amount;
                  const progressPercent = goal.target_amount > 0 ? (db / goal.target_amount) * 100 : 0;
                  const isGoalFull = db >= goal.target_amount;
                  const wasGoalFull = db > 0 && goal.target_amount > 0 && db >= goal.target_amount * 0.99;
                  
                  const hasGoalFulfilledTransaction = expenses.some(expense => 
                    expense.description && expense.description.includes(goal.name) && expense.description.includes('(Goal Fulfilled)')
                  );
                  return (
                    <div key={goal.id} className="w-full bg-neutral-50 dark:bg-slate-900/40 rounded-lg p-3 border border-neutral-100 dark:border-slate-700/40">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-bold text-neutral-800 dark:text-slate-100 flex items-center gap-1.5">{goal.name}</span>
                        <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                          {`${formatMoney(db, baseCurrency)}`} / {`${formatMoney(goal.target_amount, baseCurrency)}`}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
<div className="flex items-center justify-between mt-1">
                        {(db >= goal.target_amount || (hasGoalFulfilledTransaction && db > 0)) ? (
                          <button 
                            onClick={() => setCompletionGoal(goal)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1 rounded transition-all ml-auto goal-complete-btn"
                          >
                            COMPLETE →
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600">
                            +{((db / goal.target_amount) * 100).toFixed(2)}% Completed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => !isGoalFull && handleOpenManualDepositModal(goal.id, goal.name)}
                        disabled={isGoalFull}
                        className={`mt-3 w-full py-1.5 border border-dashed rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${isGoalFull ? 'bg-gray-100 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-700 shadow-none' : 'border-neutral-300 dark:border-slate-600 text-neutral-600 dark:text-slate-400 bg-neutral-50 dark:bg-slate-800/60 hover:bg-neutral-100 dark:hover:bg-slate-700/60 hover:text-neutral-900 dark:hover:text-slate-200 hover:border-neutral-400 dark:hover:border-slate-500'}`}
                      >
                        <span>{isGoalFull ? '✓ Goal Fully Funded' : (wasGoalFull && db > 0 ? '🔄 Reallocate Remaining Funds' : '➕ Quick Deposit From Wallet')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-2">
              <div className="w-9 h-9 bg-pink-50 dark:bg-pink-950/40 rounded-full flex items-center justify-center border border-pink-100">
                <span className="text-pink-500 text-sm">🎯</span>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  No Active Savings Goals
                </h4>
                <p className="text-[9px] text-slate-400 max-w-[180px] mx-auto mt-0.5">
                  Configure long-term asset targets inside your account settings.
                </p>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors mt-1"
              >
                Go to Settings
              </button>
            </div>
            )}
          </div>

          {/* 📦 CARD 2: THE 3-CARD SPLIT ASYMMETRICAL STACK PANEL */}
          <div className="flex flex-col gap-3 justify-between h-full">

            {/* Upper Section: Full-Width Auto Sweep */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/60 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Auto-Sweep Surplus</h4>
                <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {formatMoney(explicitSweepTarget, baseCurrency)}
                </p>
                <span className="inline-block mt-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded text-[9px]">
                  ✔ {activeGoalPercentSum.toFixed(2)}% of Surplus
                </span>
              </div>
              <p className="text-[8px] text-slate-400 border-t border-slate-100 dark:border-slate-700/40 pt-1 mt-1 leading-normal">
                Remaining cash reserves ({formatMoney(retainedLiquidBuffer, baseCurrency)}) retained in Main Wallet as primary fluid operational buffer.
              </p>
            </div>



            {/* Lower Section: Side-by-Side Symmetrical Sub-Column Cards Split */}
            <div className="grid grid-cols-2 gap-3 flex-1 items-stretch w-full">

              {/* Spending Velocity Card */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Spending Velocity MoM</h4>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">0% Slower</div>
                  <div className="text-[8px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-1 mt-1 inline-block rounded font-bold border">
                    ✦ STABLE PACING
                  </div>
                </div>
                <p className="text-[8px] text-slate-400 mt-1.5 leading-tight">
                  Outflows are lower than last month.
                </p>
              </div>

              {/* Runway Buffers Card */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Financial Runway Buffers</h4>
                  <div className="text-[10px] font-medium mt-0.5">
                    Monthly <span className="text-blue-500 font-bold">6.9 mo</span>
                  </div>
                  <div className="text-[10px] font-medium">
                    Daily <span className="text-green-500 font-bold">118 Days</span>
                  </div>
                  <div className="text-[8px] bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 px-1 mt-1 inline-block rounded font-bold border border-green-100/50">
                    ✦ LIVE FLUID VELOCITY TRACK
                  </div>
                </div>
                <p className="text-[8px] text-slate-400 mt-1.5 leading-tight">
                  Your cash reserves mapped against active daily outflows.
                </p>
              </div>

            </div>
          </div>

          {/* 📦 CARD 3: TOP 5 EXPENSES WITH INTEGRATED SHORTCUT BUTTON TRACKS */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/60 h-full flex flex-col justify-between overflow-hidden">
            <div className="w-full flex-1 flex flex-col justify-start">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
                Top 5 Expenses
              </h3>

              {/* Mapped Scrollable List Pane */}
              <div className="space-y-1.5 overflow-y-auto pr-0.5 max-h-[155px] min-h-0 flex-1">
                {topExpensesList.map((exp) => {
                  return (
                  <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-lg last:mb-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          String(exp.type).toLowerCase() === 'income'
                            ? 'bg-emerald-500/15'
                            : 'bg-rose-500/15'
                        }`}
                      >
                        {String(exp.type).toLowerCase() === 'income' ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate max-w-[110px] sm:max-w-[140px]">
                          {exp.description || exp.payee || exp.title || 'Expense Item'}
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5 truncate">
                          {exp.category || 'General'} • {exp.subcategory || 'Other'} • {exp.date ? new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${
                      String(exp.type).toLowerCase() === 'income'
                        ? 'text-emerald-600'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {String(exp.type).toLowerCase() === 'income' ? '+' : '-'}{formatMoney(Math.abs(exp.amount), baseCurrency)}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Integrated Action Shortcuts Button Row Grids Panel (Anchored cleanly at the bottom) */}
            <div className="flex-none pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 text-[10px] font-semibold text-center">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => navigate('/')} className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-blue-600 hover:text-blue-700">📊 Dashboard</button>
                <div ref={quickAddRef} className="relative">
                  <button onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} className="w-full py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-emerald-600 hover:text-emerald-700">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                  {isQuickAddOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      <button type="button" onClick={() => { setIsQuickAddOpen(false); navigate('/add?type=expense'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-input transition-colors cursor-pointer">
                        <span className="text-red-500">⬇</span> Add Expense
                      </button>
                      <hr className="border-border-main" />
                      <button type="button" onClick={() => { setIsQuickAddOpen(false); navigate('/add?type=income'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-input transition-colors cursor-pointer">
                        <span className="text-emerald-500">⬆</span> Add Income
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => navigate('/expenses')} className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-cyan-600 hover:text-cyan-700">📋 Ledger</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => navigate('/analytics')} className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-rose-600 hover:text-rose-700">📈 Reports</button>
                <button onClick={() => navigate('/transfer')} className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-amber-600 hover:text-amber-700">⇄ Transfer</button>
                <button onClick={() => navigate('/settings')} className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">⚙ Settings</button>
              </div>
            </div>
          </div>
      </div>

      {showDepositModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border-main rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold tracking-tight text-text-primary mb-4">Deposit to {depositGoalName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="w-full bg-bg-input border border-border-main rounded-lg text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">From Wallet</label>
                <select
                  value={depositWalletId ?? ''}
                  onChange={e => setDepositWalletId(Number(e.target.value))}
                  className="w-full bg-bg-input border border-border-main rounded-lg text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select wallet</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id!}>{w.name} ({formatMoney(w.balance, baseCurrency)})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowDepositModal(false)} className="px-4 py-2 text-xs font-medium bg-bg-input text-text-secondary border border-border-main rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleConfirmDeposit} className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Confirm Deposit</button>
            </div>
          </div>
        </div>
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      {completionGoal && (
        <GoalCompletionModal
          goal={completionGoal}
          allGoals={savingsGoals}
          wallets={wallets}
          baseCurrency={baseCurrency}
          onClose={() => setCompletionGoal(null)}
          onSaved={() => setCompletionGoal(null)}
          onActionComplete={() => setRefreshKey(k => k + 1)}
          allExpenses={expenses}
        />
      )}
    </div>
  );
}