import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { startOfMonth } from 'date-fns';
import { roundMoney, sumMoney } from '../utils/monetary';
import { useSettings } from '../context/SettingsContext';

export function WealthEfficiencyWidget() {
  const { baseCurrency } = useSettings();
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const monthStart = startOfMonth(new Date());

  // All values in base currency — direct comparison, no conversion
  const totalBudgetCaps = sumMoney(budgets.map(b => b.limit_amount || 0));
  const currentMonthExpenses = sumMoney(
    expenses.filter(e => String(e.type).toLowerCase() === 'expense' && e.category !== 'Savings Transfer' && new Date(e.date) >= monthStart).map(e => e.amount)
  );

  const score = totalBudgetCaps > 0 ? Math.round(((totalBudgetCaps - currentMonthExpenses) / totalBudgetCaps) * 100) : 100;
  const clampedScore = Math.max(0, Math.min(100, score));

  let statusText: string;
  let statusColor: string;
  let description: string;

  if (clampedScore >= 75) {
    statusText = '✦ Optimized Status';
    statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    description = 'Your spending-to-budget savings margin velocity is high.';
  } else if (clampedScore >= 40) {
    statusText = '✦ Moderate Position';
    statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    description = 'Moderate cash outflows detected. Review secondary categories.';
  } else {
    statusText = '✦ Overextended Outflows';
    statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    description = 'Critical budget spending exposure. Auto-sweep systems are frozen.';
  }

  return (
    <div className="rounded-xl border border-border-main bg-bg-card p-5 shadow-sm select-none text-text-primary backdrop-blur-md">
      <div>
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase block">Wealth Efficiency Score</span>
        <span className="text-xl font-semibold text-text-primary mt-1 block tracking-tight">{clampedScore}%</span>
        <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded uppercase tracking-wider mt-2 border ${statusColor}`}>
          {statusText}
        </span>
      </div>
      <p className="text-[11px] font-medium text-text-secondary mt-2 leading-tight">{description}</p>
    </div>
  );
}
