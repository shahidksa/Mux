import { useState, useMemo, useCallback } from 'react';
import { Expense } from '../types/expense';
import { useSettings } from '../context/SettingsContext';
import { formatMoney } from '../utils/monetary';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#3B82F6', '#06B6D4', '#F43F5E', '#14B8A6',
  '#6366F1', '#84CC16', '#A855F7', '#EAB308', '#FF7A00',
  '#00D1FF', '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
];

export function ExpensesByCategoryDonut({ expenses, period, lockedSavings, categoryChartData }: { period?: string; lockedSavings?: number; expenses: Expense[]; categoryChartData?: { name: string; value: number }[] }) {
  const { baseCurrency } = useSettings();
  const [activeIndex, setActiveIndex] = useState(-1);

  const categoryData = useMemo(() => {
    if (categoryChartData && categoryChartData.length > 0) {
      return [...categoryChartData].sort((a, b) => b.value - a.value);
    }
    const categoryMap: Record<string, number> = {};
    expenses.forEach((t) => {
      if (t.type === 'expense' && t.category !== 'Savings Transfer' && t.category !== 'Transfer') {
        const cat = t.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(Number(t.amount) || 0);
      }
    });
    return Object.keys(categoryMap).map(key => ({ name: key, value: categoryMap[key] })).sort((a, b) => b.value - a.value);
  }, [expenses, categoryChartData]);

  const total = useMemo(() => categoryData.reduce((sum, d) => sum + d.value, 0), [categoryData]);

  const handlePieMouseEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);

  const pieProps = useMemo(() => ({
    cx: '50%', cy: '50%', innerRadius: 55, outerRadius: 85, paddingAngle: 2, dataKey: 'value'
  }), []);

  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-main)',
    borderRadius: '8px',
    color: 'var(--color-text-secondary)'
  }), []);

  return (
    <div className="grid grid-cols-12 gap-4 items-center flex-1 h-full mt-2">
      <div className="col-span-5 w-full h-[180px] flex items-center justify-center">
        {categoryData && categoryData.length > 0 ? (
          <ResponsiveContainer key={categoryData.length} width="100%" height="100%">
            <PieChart id="expenses-by-category-donut">
              <Pie data={categoryData} {...pieProps} onMouseEnter={handlePieMouseEnter}>
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} stroke={activeIndex === index ? '#1e293b' : 'transparent'} strokeWidth={activeIndex === index ? 3 : 0} style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div className="bg-bg-card border border-border-main rounded-lg shadow-lg p-3">
                      <p className="font-semibold text-text-primary">{d.name}</p>
                      <p className="text-sm text-text-secondary">{formatMoney(d.value, baseCurrency)}</p>
                      <p className="text-xs text-text-muted">{pct}%</p>
                    </div>
                  );
                }
                return null;
              }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-xs text-slate-400">Loading Chart Data...</div>
        )}
      </div>
      <div className="col-span-7 flex flex-col justify-start space-y-1 h-[180px] pl-2 pr-4 pt-1 overflow-y-auto scrollbar-thin dark:scrollbar-thumb-slate-800">
        {categoryData.map((entry, index) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
          const color = COLORS[index % COLORS.length];
          return (
            <div key={entry.name} className={`grid grid-cols-12 items-center gap-2 w-full text-text-secondary py-1 text-[14px] font-normal whitespace-nowrap cursor-pointer transition-colors ${activeIndex === index ? '' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'} rounded-lg px-1`} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(-1)}>
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="font-normal text-text-primary truncate max-w-[85px] md:max-w-none" title={entry.name}>{entry.name}</span>
              </div>
              <div className="col-span-3 flex justify-center">
                <span className="text-[12px] font-medium text-text-muted bg-bg-card border border-border-main px-1.5 py-0.5 rounded text-center min-w-[36px]">{pct}%</span>
              </div>
              <div className="col-span-4 text-right text-blue-600 pr-2">{formatMoney(entry.value, baseCurrency)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
