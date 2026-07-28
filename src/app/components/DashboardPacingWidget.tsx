import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatMoney } from '../utils/monetary';

export function DashboardPacingWidget({ expenses, targetBase, baseCurrency, fxRate }: { expenses: any[]; targetBase: number; baseCurrency: string; fxRate: number }) {
  const { isDarkMode } = useTheme();

  const currentMonthNetSpent = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      })
      .filter(tx => tx.type === 'expense' && tx.category !== 'Savings Transfer')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [expenses]);

  const currentDay = new Date().getDate();
  const realDailyBurn = currentDay > 0 ? currentMonthNetSpent / currentDay : 0;
  const isOverBurning = targetBase > 0 && realDailyBurn > targetBase;
  const pacingPercentage = targetBase > 0 ? Math.min(Math.round((realDailyBurn / targetBase) * 100), 200) : 0;

  const statusLabel = isOverBurning ? '✦ Over Pacing Target' : '✦ Optimal Spending Pace';
  const statusClass = isOverBurning
    ? 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 bg-amber-100 dark:bg-amber-500/10'
    : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10';

  return (
    <div className="select-none flex flex-col flex-1 pt-2 pb-2 px-3">
      <div className="flex justify-between items-center shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Month Spending Pacing
        </h3>
        <span className={`text-[9px] font-black px-1 py-0.5 rounded ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-1 shrink-0">
        <span style={{ color: isDarkMode ? '#ffffff' : '#020617', fontSize: '1.5rem' }}>
          {`${formatMoney(realDailyBurn, baseCurrency)}`}
        </span>
        <span style={{ color: isDarkMode ? '#94a3b8' : '#475569' }} className="text-xs font-bold">/ day avg</span>
      </div>

      <div className="w-full mt-0.5 shrink-0">
        <div className="flex justify-between text-xs font-semibold" style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}>
          <span>Burn Velocity Rate</span>
          <span>Target Base: {`${formatMoney(targetBase, baseCurrency)}`}<span style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}>/day</span></span>
        </div>
        <div className="relative w-full h-[5px] rounded-full bg-black/30 overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${isOverBurning ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
            style={{ width: `${Math.min(pacingPercentage, 100)}%` }}
          />
        </div>
      </div>

      <p style={{ color: isOverBurning ? (isDarkMode ? '#f97316' : '#ea580c') : (isDarkMode ? '#34d399' : '#059669'), fontWeight: '600', marginTop: '4px' }} className="text-xs leading-tight">
        {isOverBurning
          ? 'Warning: Your active burn rate is running higher than your monthly budget pacing baseline allows.'
          : 'Excellent capital pacing! Your current velocity keeps your wallet balances fully protected.'}
      </p>
    </div>
  );
}
