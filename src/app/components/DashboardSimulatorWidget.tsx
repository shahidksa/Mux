import { useMemo } from 'react';
import { WalletDb, BudgetDb, ExpenseDb } from '../../db';
import { useSettings } from '../context/SettingsContext';
import { formatMoney } from '../utils/monetary';
import { useAllocation, ALLOCATION_KEYS } from '../context/AllocationContext';
import { APP_CONSTANTS } from '../config/constants';

const SLIDER_ACCENTS: Record<string, string> = {
  spending: 'accent-rose-500',
  savings: 'accent-emerald-500',
  investments: 'accent-blue-500',
  debt: 'accent-amber-500',
  charity: 'accent-violet-500',
  autoSweepBuffer: 'accent-cyan-500',
};

interface DashboardSimulatorWidgetProps {
  safetyFloor?: number;
  lockedSavings?: number;
  budgetSurplusRule?: 'wallet' | 'sweep';
  wallets?: WalletDb[];
  budgets?: BudgetDb[];
  expenses?: ExpenseDb[];
  computedSurplus?: number;
}

export function DashboardSimulatorWidget({
  safetyFloor = APP_CONSTANTS.DEFAULT_SAFETY_FLOOR,
  lockedSavings = APP_CONSTANTS.DEFAULT_LOCKED_SAVINGS,
  budgetSurplusRule,
  wallets: passedWallets,
  budgets: passedBudgets,
  expenses: passedExpenses,
  computedSurplus
}: DashboardSimulatorWidgetProps) {
  const { baseCurrency } = useSettings();

  const { allocations, handleSliderAdjustment } = useAllocation();

  const projectedAnnual = APP_CONSTANTS.PROJECTED_ANNUAL_USD;

  const projections = useMemo(() => {
    const savingsRaw = projectedAnnual * (allocations.savings / 100) * 0.04;
    const investRaw = projectedAnnual * (allocations.investments / 100) * 0.12;
    const debtRaw = projectedAnnual * (allocations.debt / 100) * 0.18;

    const savingsDisplay = Math.round(savingsRaw);
    const investDisplay = Math.round(investRaw);
    const debtDisplay = Math.round(debtRaw);

    return {
      savingsDisplay,
      investDisplay,
      debtDisplay,
      total: savingsDisplay + investDisplay + debtDisplay,
    };
  }, [allocations, projectedAnnual]);

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3 w-full">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Capital Allocation Simulator
        </h3>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded border text-indigo-600 border-indigo-200 bg-indigo-100">
          ✦ Interactive
        </span>
      </div>

      <div className="max-h-[220px] overflow-y-auto pr-1 custom-scrollbar space-y-4">
        <div className="space-y-4">
          {ALLOCATION_KEYS.filter(k => k !== 'autoSweepBuffer').map(key => (
            <div key={key}>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{key}</span>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 pr-4">
                  <span>{allocations[key]}%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={allocations[key]}
                onChange={e => handleSliderAdjustment(key, Number(e.target.value))}
                className={`w-full h-1.5 rounded-full appearance-none bg-black/20 cursor-pointer ${SLIDER_ACCENTS[key]}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 p-3 bg-slate-50/40 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-inner">
        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Projected Annual Return</h4>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(projections.total * 100, baseCurrency)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-left pt-0.5">
            <div className="bg-bg-input/50 rounded p-1.5">
              <p className="text-[9px] text-text-muted">Savings</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatMoney(projections.savingsDisplay * 100, baseCurrency)}
              </p>
            </div>
            <div className="bg-bg-input/50 rounded p-1.5">
              <p className="text-[9px] text-text-muted">Invest</p>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                {formatMoney(projections.investDisplay * 100, baseCurrency)}
              </p>
            </div>
            <div className="bg-bg-input/50 rounded p-1.5">
              <p className="text-[9px] text-text-muted">Debt Saved</p>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {formatMoney(projections.debtDisplay * 100, baseCurrency)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
