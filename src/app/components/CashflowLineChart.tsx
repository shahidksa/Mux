import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';

import { formatMoney } from '../utils/monetary';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function CashflowLineChart() {
  const { baseCurrency } = useSettings();
  const { isDarkMode } = useTheme();
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const [chartColors, setChartColors] = useState({
    accent: '#3b82f6',
    cardBg: '#FFFFFF',
    border: '#e4e4e7',
    text: '#64748B',
  });

  useEffect(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    setChartColors({
      accent: cs.getPropertyValue('--color-accent').trim() || '#3b82f6',
      cardBg: cs.getPropertyValue('--color-bg-card').trim() || '#FFFFFF',
      border: cs.getPropertyValue('--color-border-main').trim() || '#e4e4e7',
      text: cs.getPropertyValue('--color-text-muted').trim() || '#64748B',
    });
  }, [isDarkMode]);

  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });

    const currentWalletTotal = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    const monthlyNetCashflows = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const txInMonth = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= monthStart && d <= monthEnd;
      });
      const income = txInMonth
        .filter(e => String(e.type).toLowerCase() === 'income')
        .reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const outflow = txInMonth
        .filter(e => String(e.type).toLowerCase() !== 'income')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      return { month, net: income - outflow };
    });

    const totalNet = monthlyNetCashflows.reduce((s, m) => s + m.net, 0);
    let running = currentWalletTotal - totalNet;

    return monthlyNetCashflows.map(m => {
      running += m.net;
      return {
        month: format(m.month, 'MMM yyyy'),
        balance: Math.round(running),
      };
    });
  }, [expenses, wallets, baseCurrency]);

  const chartMargin = useMemo(() => ({ top: 10, right: 10, left: 15, bottom: 5 }), []);
  const chartPadding = useMemo(() => ({ left: 15, right: 15 }), []);
  const tooltipStyle = useMemo(() => ({
    backgroundColor: chartColors.cardBg,
    border: `1px solid ${chartColors.border}`,
    borderRadius: '8px',
    color: chartColors.text
  }), [chartColors]);

  const tickFormatter = useMemo(() => (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency || 'USD',
      maximumFractionDigits: 1,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(value / 100);
  }, [baseCurrency]);

  return (
    <>
      {monthlyData && monthlyData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart id="cashflow-line-chart" data={monthlyData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: chartColors.text }} tickMargin={6} padding={chartPadding} />
            <YAxis domain={['auto', 'auto']} width={95} tickLine={false} axisLine={false} padding={{ top: 10, bottom: 10 }} tickFormatter={tickFormatter} tick={{ fontSize: 11, fontWeight: 600, fill: chartColors.text }}/>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(Number(value), baseCurrency), 'Cumulative Balance']} />
            <Line type="monotone" dataKey="balance" stroke={chartColors.accent} strokeWidth={3} dot={{ fill: chartColors.accent, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: chartColors.accent, strokeWidth: 2, stroke: chartColors.cardBg }} name="balance" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center w-full h-full text-xs text-slate-400">Loading Chart Data...</div>
      )}
    </>
  );
}
