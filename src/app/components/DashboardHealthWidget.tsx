import { useMemo } from 'react';
import { formatMoney } from '../utils/monetary';

export function DashboardHealthWidget({ totalLiquidReserves, availableCash, lockedSavings, availablePercent, lockedPercent, baseCurrency }: { totalLiquidReserves: number; availableCash: number; lockedSavings: number; availablePercent: number; lockedPercent: number; baseCurrency: string }) {
  return (
      <div className="select-none text-slate-900 dark:text-slate-50 flex flex-col flex-1 py-3 px-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
        Live Cash Liquidity
      </h3>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center w-full py-1.5 text-[11px] font-bold border-b border-slate-100 dark:border-slate-700/50 shrink-0">
          <span className="text-text-secondary font-bold tracking-wide">Total Liquid Reserves</span>
          <span className="text-text-primary font-bold text-sm">
            {formatMoney(totalLiquidReserves, baseCurrency)}
          </span>
        </div>

        <div className="flex justify-between items-center w-full py-1.5 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
          <span className="text-cyan-700 dark:text-cyan-300 font-bold tracking-wide text-[11px]">Available Cash</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-cyan-800 dark:text-cyan-400">
              {formatMoney(availableCash, baseCurrency)}
            </span>
            <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-400">{availablePercent.toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex justify-between items-center w-full py-1.5 shrink-0">
          <span className="text-emerald-700 dark:text-emerald-300 font-bold tracking-wide text-[11px]">Locked Savings</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
              {formatMoney(lockedSavings, baseCurrency)}
            </span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">{lockedPercent.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}