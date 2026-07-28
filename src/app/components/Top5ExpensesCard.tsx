import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { formatMoney } from '../utils/monetary';

export function Top5ExpensesCard() {
  const { baseCurrency, exchangeRates } = useSettings();
  const transactions = useLiveQuery(() => db.expenses.toArray()) || [];

  const topExpenses = useMemo(() => [...transactions.filter(e => String(e.type).toLowerCase() === 'expense')]
    .sort((a, b) => {
      const amountA = Math.abs(Number(a.amount || 0));
      const amountB = Math.abs(Number(b.amount || 0));
      return amountB - amountA;
    })
    .slice(0, 5), [transactions]);

  return (
    <div className="flex flex-col justify-between h-full">
      <h2 className="font-semibold text-slate-900 dark:text-white mb-2">Top 5 Expenses</h2>
      <div className="w-full flex-grow overflow-y-auto max-h-[220px] pr-2 scrollbar-thin">
        <div className="space-y-3">
          {topExpenses.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              No expenses recorded yet
            </p>
          ) : (
            topExpenses.map((expense, index) => (
              <div key={expense.id} className="flex items-center justify-between p-3 border border-border-main rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-100/30 dark:bg-zinc-800/20 border border-zinc-300/30 dark:border-zinc-600/30 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-mono text-[11px] font-black transition-colors">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{expense.description}</p>
                    <p className="text-xs text-text-muted">{expense.category} &bull; {expense.subcategory || 'Other'} &bull; {format(new Date(expense.date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={"text-sm font-semibold " + (expense.category === 'Savings Transfer' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400')}>
                    -{formatMoney(Math.abs(expense.amount), baseCurrency)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
