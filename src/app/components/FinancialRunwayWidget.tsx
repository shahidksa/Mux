import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { roundMoney, sumMoney } from '../utils/monetary';

export function FinancialRunwayWidget() {
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const runwayBufferStr = useMemo(() => {
    const totalWealth = sumMoney(wallets.map(w => w.balance || 0));
    const monthlyExpenses = sumMoney(
      expenses.filter(e => {
        if (e.type !== 'expense' || e.category === 'Savings Transfer' || !e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }).map(e => e.amount)
    );

    if (monthlyExpenses === 0) return '0.0 mo';
    return `${roundMoney(totalWealth / monthlyExpenses).toFixed(1)} mo`;
  }, [wallets, expenses, currentYear, currentMonth]);

  const daysBufferStr = useMemo(() => {
    const totalWealth = sumMoney(wallets.map(w => w.balance || 0));
    const monthlyExpenses = sumMoney(
      expenses.filter(e => {
        if (e.type !== 'expense' || e.category === 'Savings Transfer' || !e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }).map(e => e.amount)
    );

    if (monthlyExpenses === 0) return 'Infinite';
    
    const currentDayNumber = new Date().getDate();
    const averageDailyBurn = monthlyExpenses / currentDayNumber;
    return `${Math.round(totalWealth / averageDailyBurn)} Days`;
  }, [wallets, expenses, currentYear, currentMonth]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm select-none text-text-primary">
      <div>
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase block">
          Financial Runway Buffers
        </span>
        
        <div className="flex items-center gap-5 mt-2">
          <span className="text-sm font-medium text-text-primary">Monthly <span className="font-bold text-blue-600">{runwayBufferStr}</span></span>
          <span className="text-sm font-medium text-emerald-600">Daily <span className="font-bold text-emerald-600">{daysBufferStr}</span></span>
        </div>
        
        <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider mt-3 border border-emerald-600/30 bg-emerald-500/10 text-emerald-600">
          ✦ Live FI/RE Velocity Track
        </span>
      </div>

      <p className="text-[11px] font-medium text-text-secondary mt-3 leading-tight">
        Your cash reserves mapped against active daily and monthly burn rates.
      </p>
    </div>
  );
}
