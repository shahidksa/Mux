import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { CURRENCY_SYMBOLS } from '../utils/currency';
import { formatMoney } from '../utils/monetary';

interface AppHeaderBannerProps {
  safetyFloor: number;
  capitalShield: number;
  surplus: number;
  efficiencyScore: number;
  isOverBurning: boolean;
  overBurnSpeed: number;
  targetBase: number;
  baseCurrency: string;
  expenses?: any[];
}

export function AppHeaderBanner({
  safetyFloor,
  capitalShield,
  surplus,
  efficiencyScore,
  isOverBurning,
  overBurnSpeed,
  targetBase,
  baseCurrency,
  expenses = [],
}: AppHeaderBannerProps) {
  const symbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;

  const sweepPercent = Number(localStorage.getItem('globalMasterValue') || 15);
  const globalSweepTargetValue = Math.round((surplus * sweepPercent) / 100);

  // Local pacing computation — matches DashboardPacingWidget exactly
  const now = new Date();
  const currentMonthExpenses = expenses
    .filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .filter(tx => tx.type === 'expense' && tx.category !== 'Savings Transfer')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const currentDay = now.getDate();
  const realDailyBurn = currentDay > 0 ? currentMonthExpenses / currentDay : 0;
  const isOverPacing = targetBase > 0 && realDailyBurn > targetBase;

  const effScore = efficiencyScore;
  let statusText = 'Inactive';
  let textAndBgStyles = 'text-slate-400 bg-slate-100/80 dark:text-slate-300 dark:bg-slate-800/50';
  if (effScore > 60) {
    statusText = 'Optimal';
    textAndBgStyles = 'text-emerald-700 bg-emerald-100/80 dark:text-emerald-200 dark:bg-emerald-950/50';
  } else if (effScore > 30) {
    statusText = 'Conservative';
    textAndBgStyles = 'text-amber-700 bg-amber-100/80 dark:text-amber-200 dark:bg-amber-950/50';
  }

  let pacingText = 'Spending Rate: 🟢 Normal';
  let pacingStyles = 'text-emerald-700 bg-emerald-100/80 dark:text-emerald-200 dark:bg-emerald-950/50 font-medium';
  if (isOverPacing) {
    pacingText = `Spending Rate: ⚠️ Over Pacing (+${formatMoney(Math.round(realDailyBurn - targetBase), baseCurrency)}/day)`;
    pacingStyles = 'text-amber-700 bg-amber-100/80 dark:text-amber-200 dark:bg-amber-950/50 font-black animate-pulse';
  }

  return (
    <div className="bg-transparent border-0 p-3 rounded-xl flex flex-wrap items-center justify-start gap-5 text-xs w-full shadow-none">
      {/* 1. SAFETY FLOOR */}
      <div className="relative group flex items-center gap-1.5 cursor-help">
        <span className="text-blue-500 filter drop-shadow">🛡️</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2">
          Safety Floor: <span className="font-mono font-black text-slate-900 dark:text-white text-[13px]">{formatMoney(safetyFloor, baseCurrency)}</span>
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          Your emergency cushion. This money stays safe in your bank account and is never moved by automated savings rules.
        </div>
      </div>

      <span className="text-slate-300 dark:text-slate-600 font-light">|</span>

      {/* 2. CAPITAL SHIELD */}
      <div className="relative group flex items-center gap-1.5 cursor-help">
        <span className="text-emerald-500 filter drop-shadow">🔒</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2">
          Shield: <span className="font-mono font-black text-slate-900 dark:text-white text-[13px]">{formatMoney(capitalShield, baseCurrency)}</span>
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          A safety wall that locks your finished goals (like College). This keeps your old savings safe from being double-spent.
        </div>
      </div>

      <span className="text-slate-300 dark:text-slate-600 font-light">|</span>

      {/* 3. AUTO-SWEEP SURPLUS */}
      <div className="relative group flex items-center gap-1.5 cursor-help">
        <span className="text-amber-600 filter drop-shadow">💵</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2">
          Surplus: <span className="font-mono font-black text-amber-600 dark:text-amber-300 text-[13px]">{formatMoney(surplus, baseCurrency)}</span>
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          Extra leftover cash that is currently lazy and unassigned. The app queues this money to automatically fund your CAR goal at midnight.
        </div>
      </div>

      {/* 4. SWEEP TARGET */}
      <div className="relative group flex items-center gap-1.5 cursor-help">
        <span className="text-indigo-500 filter drop-shadow">🎯</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2">
          <span className="font-mono font-black text-indigo-600 dark:text-indigo-200 text-[13px]">
            ✦ {sweepPercent}% sweep target: {formatMoney(globalSweepTargetValue, baseCurrency)}
          </span>
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          Fixed {sweepPercent}% master sweep target. Independent of individual goal slider settings.
        </div>
      </div>

      <span className="text-slate-300 dark:text-slate-600 font-light">|</span>

      {/* 5. WEALTH EFFICIENCY */}
      <div className="relative group flex items-center gap-1.5 ml-1 cursor-help shrink-0">
        <span className="text-slate-400 dark:text-slate-600 mr-1.5 font-light">•</span>
        <span className="text-emerald-500 filter drop-shadow">📈</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2">
          Wealth Efficiency:
        </span>
        <span className={`font-mono font-extrabold px-2 py-0.5 rounded text-[11px] shadow-sm tracking-wide ${textAndBgStyles}`}>
          {effScore}% ({statusText})
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          Your financial health score. Higher grades mean less lazy cash sitting around and faster progress toward your goals.
        </div>
      </div>

      {/* 6. SPENDING RATE */}
      <div className="relative group flex items-center gap-1.5 ml-1 cursor-help shrink-0">
        <span className="text-slate-400 dark:text-slate-600 mr-1.5 font-light">•</span>
        <span className={`font-mono px-2 py-0.5 rounded text-[11px] shadow-sm tracking-wide ${pacingStyles}`}>
          {pacingText}
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal leading-normal">
          Real-time spending velocity tracker. If your rolling daily average expense exceeds your safe target of {formatMoney(targetBase, baseCurrency)}/day, this badge automatically flags an Over Burn state.
        </div>
      </div>
    </div>
  );
}
