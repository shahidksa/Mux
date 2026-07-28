import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { sumMoney, roundMoney, formatMoney } from '../utils/monetary';
import { useSettings } from '../context/SettingsContext';
import { CURRENCY_SYMBOLS } from '../utils/currency';
import { APP_CONSTANTS } from '../config/constants';

export function AutoSweepWidget({ safetyFloor = APP_CONSTANTS.DEFAULT_SAFETY_FLOOR, lockedSavings = APP_CONSTANTS.DEFAULT_LOCKED_SAVINGS, budgetSurplusRule, surplus, poolTotal }: { safetyFloor?: number; lockedSavings?: number; budgetSurplusRule?: 'wallet' | 'sweep'; surplus?: number; poolTotal?: number }) {
  const { baseCurrency } = useSettings();
  const symbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;

  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const totalWealthPool = poolTotal ?? wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  let correctAutoSweepSurplus: number;
  if (surplus !== undefined) {
    correctAutoSweepSurplus = surplus;
  } else {
    const trueAvailableCash = Math.max(0, totalWealthPool - lockedSavings);
    const baselineSurplus = Math.max(0, trueAvailableCash - safetyFloor);
    const budgetBonus = budgetSurplusRule === 'sweep' ? APP_CONSTANTS.SIMULATED_LEFTOVER_BUDGET : 0;
    correctAutoSweepSurplus = baselineSurplus + budgetBonus;
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm select-none text-text-primary">
      <div>
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase block">
          Projected Auto-Sweep Surplus
        </span>
        <span className="text-xl font-semibold text-text-primary mt-1.5 block tracking-tight">
          {formatMoney(correctAutoSweepSurplus, baseCurrency)}
        </span>

        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider mt-2 border border-blue-600/30 bg-blue-500/10 text-blue-600">
          ✓ {totalWealthPool > 0 ? ((correctAutoSweepSurplus / totalWealthPool) * 100).toFixed(2) : '0.00'}% OF POOL
        </span>
      </div>
      <p className="text-[11px] font-medium text-text-secondary mt-2 leading-tight">
        {correctAutoSweepSurplus > 0
          ? "Surplus room available. Automatic sweep queued for midnight."
          : "No surplus cash room available."}
      </p>
    </div>
  );
}
