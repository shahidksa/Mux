import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { roundMoney, sumMoney } from '../utils/monetary';
import { startOfMonth } from 'date-fns';

export function FireIndependenceWidget() {
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const daysBufferStr = useMemo(() => {
    const totalWealth = sumMoney(wallets.map(w => w.balance || 0));
    const monthStart = startOfMonth(new Date());
    const monthlyExpenses = sumMoney(
      expenses.filter(e => String(e.type).toLowerCase() === 'expense' && e.category !== 'Savings Transfer' && new Date(e.date) >= monthStart).map(e => e.amount)
    );

    if (monthlyExpenses === 0) return 'Infinite Days';
    
    const currentDayNumber = new Date().getDate();
    const averageDailyBurn = monthlyExpenses / currentDayNumber;
    const survivalDays = Math.round(totalWealth / averageDailyBurn);
    
    if (survivalDays > 365) {
      return `${(survivalDays / 365).toFixed(1)} Years`;
    }
    return `${survivalDays} Days Safe`;
  }, [wallets, expenses]);

  return (
    <div className="rounded-xl border border-border-main bg-bg-card p-4 shadow-sm select-none text-text-primary backdrop-blur-md">
      <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase block">
        Emergency Liquidity Runway
      </span>
      <span className="text-lg font-black mt-1 block tracking-tight text-emerald-400">
        {daysBufferStr}
      </span>
      <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider mt-1.5 border border-emerald-500/10 bg-emerald-500/5 text-emerald-400/90">
        ✦ FI/RE Index Track
      </span>
      <p className="text-[10px] text-text-muted mt-2 leading-tight">
        The absolute survival timeline of your liquid core balances at current daily burn velocity rates.
      </p>
    </div>
  );
}
