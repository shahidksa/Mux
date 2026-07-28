import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Expense } from '../types/expense';
import { Budget } from '../types/budget';
import { useSettings } from '../context/SettingsContext';
import { roundMoney, sumMoney, formatMoney } from '../utils/monetary';

export function BudgetPerformanceReportTable({ variant = 'analytics', expenses: propExpenses, budgets: propBudgets, hideHeading = false }: Props) {
  const { baseCurrency } = useSettings();

  const queriedBudgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const queriedExpenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const budgets = propBudgets ?? queriedBudgets;
  const expenses = propExpenses ?? queriedExpenses;

  const currentMonthFilterString = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const titleDisplayDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, []);

  const isDashboard = variant === 'dashboard';

  return (
    <div className="w-full flex flex-col justify-start text-text-primary font-sans select-none">
      {!hideHeading && (isDashboard ? (
        <h3 className="font-semibold text-text-primary mb-4">Budget Progress</h3>
      ) : (
        <h3 className="text-xs font-bold tracking-wide text-text-primary uppercase mb-4">
          Budget Performance Report - {titleDisplayDate}
        </h3>
      ))}

      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center bg-bg-main px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-text-secondary mb-4 border border-border-main shadow-inner">
        <span className="text-left">Category</span>
        <span className="text-right pr-4">Budget Limit</span>
        <span className="text-right pr-4">Spent This Month</span>
        <span className="text-right pr-4">Remaining</span>
      </div>

      <div className="space-y-4 px-1">
        {budgets.map((budget) => {
          // Expenses and budgets both in base currency — direct comparison
          const categoryExpenses = roundMoney(
            expenses
              .filter(e => {
                if (e.type !== 'expense' || !e.category || !e.date) return false;
                const matchesCategory = e.category.trim().toLowerCase() === (budget.category_name ?? '').trim().toLowerCase();
                const expenseMonthStr = String(e.date).slice(0, 7);
                return matchesCategory && expenseMonthStr === currentMonthFilterString;
              }).map(e => e.amount)
          );

          const limit = (budget.limit_amount || 0);
          const remainingAmount = roundMoney(limit - categoryExpenses);
          const isOverBudget = remainingAmount < 0;
          const percentageUsed = limit > 0 ? Math.round((categoryExpenses / limit) * 100) : 0;

          return (
            <div key={budget.id} className="w-full space-y-2 pb-2 border-b border-border-main last:border-0">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center text-xs px-4">
                <span className="text-left text-text-primary font-extrabold truncate">{budget.category_name}</span>
                <span className="text-right pr-4 font-semibold text-blue-600">{formatMoney(limit, baseCurrency)}</span>
                <span className="text-right pr-4 font-semibold text-blue-600">{formatMoney(categoryExpenses, baseCurrency)}</span>
                <span className={`text-right pr-4 font-bold ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {isOverBudget ? `-${formatMoney(Math.abs(remainingAmount), baseCurrency)}` : formatMoney(remainingAmount, baseCurrency)}
                </span>
              </div>

              <div className="relative w-full h-[6px] rounded-full bg-black/10 dark:bg-zinc-800/60 overflow-hidden border border-black/5 dark:border-zinc-700/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between w-full mt-1.5 text-[10px] font-medium tracking-wide px-4">
                <span className={isOverBudget ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400'}>
                  {percentageUsed}% used
                </span>
                {isOverBudget && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 animate-pulse">
                    over budget
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6 border border-dashed border-border-main rounded-xl">
            No active category budget items configured.
          </p>
        )}
      </div>
    </div>
  );
}
