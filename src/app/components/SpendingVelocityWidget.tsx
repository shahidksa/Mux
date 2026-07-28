import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { sumMoney } from '../utils/monetary';

export function SpendingVelocityWidget() {
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDayNum = now.getDate();
    
    const currentMonthSpend = sumMoney(
      expenses.filter(e => {
        if (e.type !== 'expense' || e.category === 'Savings Transfer' || !e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }).map(e => e.amount)
    );

    const prevMonthSpendToDate = sumMoney(
      expenses.filter(e => {
        if (e.type !== 'expense' || e.category === 'Savings Transfer' || !e.date) return false;
        const d = new Date(e.date);
        const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth && d.getDate() <= currentDayNum;
      }).map(e => e.amount)
    );

    if (prevMonthSpendToDate === 0) {
      return { change: 0, isFaster: false, label: 'Stable Pacing', textClass: 'text-text-secondary border-border-main bg-bg-input' };
    }

    const ratioChange = ((currentMonthSpend - prevMonthSpendToDate) / prevMonthSpendToDate) * 100;
    const change = Math.abs(Math.round(ratioChange));
    const isFaster = ratioChange > 0;

    return {
      change,
      isFaster,
      label: isFaster ? 'Accelerated Velocity' : 'Reduced Outflows',
      textClass: isFaster ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
    };
  }, [expenses]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm select-none text-text-primary">
      <div>
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase block">
          Spending Velocity MoM
        </span>
        <span className="text-xl font-semibold text-text-primary mt-1.5 block tracking-tight font-sans">
          {metrics.change}% {metrics.isFaster ? 'Faster' : 'Slower'}
        </span>
        <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded uppercase tracking-wider mt-2 border ${metrics.textClass}`}>
          ✦ {metrics.label}
        </span>
      </div>
      <p className="text-[11px] font-medium text-text-secondary mt-2 leading-tight">
        {metrics.isFaster 
          ? "Your cash burn velocity is outpacing last month's run-rate metrics." 
          : "Excellent capital conservation. Outflows are lower than last month."}
      </p>
    </div>
  );
}
