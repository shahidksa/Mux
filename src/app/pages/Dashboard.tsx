import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { StatCard } from '../components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { DollarSign, TrendingDown, CreditCard, Calendar, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';
import { CURRENCY_SYMBOLS, DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { roundMoney, sumMoney, formatMoney } from '../utils/monetary';
import { computeGoalDynamicBalance } from '../utils/goalBalanceEngine';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { DashboardPacingWidget } from '../components/DashboardPacingWidget';
import { DashboardSimulatorWidget } from '../components/DashboardSimulatorWidget';
import { DashboardHealthWidget } from '../components/DashboardHealthWidget';
import { AppHeaderBanner } from '../components/AppHeaderBanner';
import { HelpModal } from '../components/HelpModal';


const COLORS = [
  '#FFD966', '#FF6B6B', '#4DB6AC', '#6FA8DC', '#E06666',
  '#D5A6E6', '#F6B26B', '#93C47C', '#6AA84F', '#CC4125',
  '#A4C2F4', '#C27BA0', '#FFD966', '#FF4500', '#00CED1'
];

export function Dashboard({ setActiveTab, safetyFloor, lockedSavings, budgetSurplusRule }: { setActiveTab?: (tab: string) => void; safetyFloor?: number; lockedSavings?: number; budgetSurplusRule?: 'wallet' | 'sweep' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const expensesLive = useLiveQuery(() => db.expenses.toArray());
  const walletsLive = useLiveQuery(() => db.wallets.toArray());
  const budgetsLive = useLiveQuery(() => db.budgets.toArray());
  const categoriesLive = useLiveQuery(() => db.categories.toArray());
  const savingsGoalsLive = useLiveQuery(() => db.savings_goals.toArray());

  const expenses = expensesLive || [];
  const wallets = walletsLive || [];
  const budgets = budgetsLive || [];
  const categories = categoriesLive || [];
  const savingsGoals = savingsGoalsLive || [];

  const isDataLoading = expensesLive === undefined || walletsLive === undefined || savingsGoalsLive === undefined;

  void setActiveTab;
  const { baseCurrency, exchangeRates } = useSettings();
  const { isDarkMode } = useTheme();
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  const fxRate = rates[baseCurrency] || 1;

  const formatDashboardValue = (cents: number) => {
    const dollars = cents / 100;
    const useCompact = Math.abs(dollars) > 9999999;
    const symbol = baseCurrency === 'PKR' ? 'Rs' : (CURRENCY_SYMBOLS[baseCurrency] || baseCurrency);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      notation: useCompact ? 'compact' : 'standard',
      compactDisplay: 'short'
    }).format(Math.abs(dollars));
    const sign = dollars < 0 ? '-' : '';
    return `${sign}${symbol} ${formatted}`;
  };

  const settings = useMemo(() => ({ safetyFloor: safetyFloor ?? 0, capitalShield: lockedSavings ?? 0, budgetSurplusRule }), [safetyFloor, lockedSavings, budgetSurplusRule]);

  const rawTotalWalletCentsMemo = useMemo(() => {
    return wallets ? wallets.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
  }, [wallets]);

  const metrics = useFinancialMetrics(expenses, baseCurrency, fxRate, settings, categories, savingsGoals, rawTotalWalletCentsMemo);

  const rawTrueNetWorthCents = useMemo(() => {
    const rawTotalWalletCents = wallets ? wallets.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
    const rawTotalSavingsCents = savingsGoals
      ? savingsGoals.reduce((sum, g) => sum + computeGoalDynamicBalance(g.name, expenses), 0)
      : 0;
    return rawTotalWalletCents + rawTotalSavingsCents;
  }, [wallets, savingsGoals, expenses]);

  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeReceiptPreview, setActiveReceiptPreview] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const sortedRecentExpenses = useMemo(() =>
    [...expenses]
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      })
      .slice(0, 5),
    [expenses]
  );

  const onlyExpenses = useMemo(() =>
    expenses.filter(tx => tx.type === 'expense' || tx.amount < 0),
    [expenses]
  );

  const expenseCategoryChartData = useMemo(() => {
    const parentLookup = new Map<string, string>();
    for (const cat of categories) {
      if (cat.parent_id != null) {
        const parent = categories.find(c => c.id === cat.parent_id);
        if (parent) parentLookup.set(cat.name, parent.name);
      }
    }

    const categoryMap = new Map<string, number>();
    for (const t of onlyExpenses) {
      const rawCat = t.category || 'Other';
      const cat = parentLookup.get(rawCat) || rawCat;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount || 0));
    }

    return Array.from(categoryMap.entries())
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [onlyExpenses, categories]);

  const categoryChartDataTotal = useMemo(() =>
    expenseCategoryChartData ? sumMoney(expenseCategoryChartData.map(d => d.value)) : 0,
    [expenseCategoryChartData]
  );

  const chartMargin = useMemo(() => ({ top: 10, right: 10, left: 15, bottom: 5 }), []);
  const chartTooltipStyle = useMemo(() => ({
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-main)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    color: 'var(--color-text-secondary)'
  }), []);

  const axisLineProps = useMemo(() => ({ stroke: isDarkMode ? '#334155' : '#e2e8f0' }), [isDarkMode]);
  const tickProps = useMemo(() => ({ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#4b5563' }), [isDarkMode]);

  const handlePieMouseEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);

  const categoryTooltipContent = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = categoryChartDataTotal > 0 ? ((data.value / categoryChartDataTotal) * 100).toFixed(0) : '0';
      return (
        <div className="bg-bg-card border border-border-main rounded-lg shadow-lg p-3">
          <p className="font-semibold text-text-primary">{data.name}</p>
            <p className="text-sm text-text-secondary">{`${formatMoney(data.value, baseCurrency)}`}</p>
          <p className="text-xs text-text-muted">{pct}%</p>
        </div>
      );
    }
    return null;
  }, [categoryChartDataTotal, baseCurrency]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setIsQuickAddOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrintReceipt = (base64Image: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>ClearSum - Printed Scanned Receipt Document</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #fff; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; page-break-inside: avoid; }
            @page { margin: 0.5cm; }
          </style>
        </head>
        <body>
          <img src="${base64Image}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden pt-0 pb-1 px-6 text-slate-900 dark:text-slate-50">
      
      <div className="w-full">
        <div className="flex items-center justify-between">
          <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Overview of your cashflow</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="border-2 border-blue-600/30 hover:bg-blue-600 hover:text-white text-blue-600 px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 text-sm font-semibold"
            >
              ❓ Help
            </button>
            <span className="text-sm font-semibold text-slate-900 dark:text-white border-2 border-blue-600/30 rounded-md px-3 py-1.5">Base Currency: {CURRENCY_SYMBOLS[baseCurrency]} {baseCurrency}</span>
          </div>
        </div>

      </div>

      <AppHeaderBanner
        safetyFloor={metrics.safetyFloor}
        capitalShield={metrics.capitalShield}
        surplus={metrics.autoSweepSurplus}
        efficiencyScore={metrics.efficiencyScore}
        isOverBurning={metrics.isOverBurning}
        overBurnSpeed={metrics.overBurnSpeed}
        targetBase={metrics.targetBase}
        baseCurrency={baseCurrency}
        expenses={expenses}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full flex-none mt-2">
        <StatCard
          title={`Total Expenses (${baseCurrency})`}
            value={formatDashboardValue(metrics.totalOutflow)}
          icon={DollarSign}
          iconColor="text-blue-600"
        />
        <StatCard
          title={`Total Income (${baseCurrency})`}
             value={formatDashboardValue(metrics.totalIncome)}
          icon={ArrowUpRight}
          iconColor="text-green-600"
        />
          <StatCard
            title={`Net Cashflow (${baseCurrency})`}
              value={formatDashboardValue(metrics.totalIncome - metrics.totalOutflow)}
            icon={Calendar}
            trend={{ value: 'All time', isPositive: (metrics.totalIncome - metrics.totalOutflow) >= 0 }}
            iconColor={(metrics.totalIncome - metrics.totalOutflow) >= 0 ? 'text-green-600' : 'text-red-600'}
          />
        <StatCard
          title="Transactions"
          value={metrics.transactionCount.toString()}
          icon={CreditCard}
          trend={{ value: '8 this week', isPositive: true }}
          iconColor="text-orange-600"
        />
      </div>

    {/* Cashflow Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full flex-none mt-2">
            <Card className="bg-white dark:bg-slate-800 border border-border-main overflow-hidden">
              <CardContent className="p-5 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-300 block mb-1">
                      Total Net Worth ({baseCurrency})
                    </span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-full block">
                       {isDataLoading
                         ? <span className="inline-block w-32 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                          : formatDashboardValue(rawTrueNetWorthCents)}
                     </span>
                     <span className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 block font-medium">
                       Wallets + Savings Goals
                     </span>
                   </div>
                   <div className="h-12 w-[1px] bg-slate-200 dark:bg-slate-700 shrink-0" />
                   <div className="flex-1 min-w-0">
                     <span className="text-xs font-medium text-slate-400 dark:text-slate-300 block mb-1">
                       Total Wallet Balance
                     </span>
                     <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-full block">
                       {isDataLoading
                         ? <span className="inline-block w-32 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                          : formatDashboardValue(rawTotalWalletCentsMemo)}
                     </span>
                     <span className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 block font-medium">
                       Available Liquid Cash
                     </span>
                   </div>
                </div>
              </CardContent>
            </Card>
            <StatCard
              title={`All-Time Income (${baseCurrency})`}
              value={formatDashboardValue(metrics.totalIncome)}
              icon={ArrowUpRight}
              trend={{ value: 'All Time', isPositive: true }}
              iconColor="text-green-600"
            />
            <StatCard
              title="Total Outflow"
              value={formatDashboardValue(metrics.totalOutflow)}
              icon={TrendingDown}
              trend={{ value: 'All Time', isPositive: false }}
              iconColor="text-red-600"
            />
            <StatCard
              title={`Net Savings Margin (${baseCurrency})`}
              value={`${metrics.totalIncome > 0 && (metrics.totalIncome - metrics.totalOutflow) >= 0 ? '+' : ''}${metrics.totalIncome > 0 ? roundMoney(((metrics.totalIncome - metrics.totalOutflow) / metrics.totalIncome) * 100) : 0}%`}
              icon={DollarSign}
              trend={{ value: metrics.totalIncome > 0 && (metrics.totalIncome - metrics.totalOutflow) >= 0 ? `Savings of ${formatMoney(metrics.totalIncome - metrics.totalOutflow, baseCurrency)}` : `Deficit of ${formatMoney(metrics.totalOutflow - metrics.totalIncome, baseCurrency)}`, isPositive: metrics.totalIncome > 0 && (metrics.totalIncome - metrics.totalOutflow) >= 0 }}
              iconColor={metrics.totalIncome > 0 && (metrics.totalIncome - metrics.totalOutflow) >= 0 ? 'text-green-600' : 'text-red-600'}
            />
        </div>

      {/* Row 4: Symmetrical chart cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-[230px] w-full flex-none my-2 text-slate-900 dark:text-slate-50">
        {/* Cashflow Trend Chart Card */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 h-full flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex-none">Cashflow Trend (Last 7 Days)</h3>
          <div className="w-full flex-1 min-h-0 relative">
            {(() => {
              const hasData = metrics.dailyData.some(d => d.expense > 0 || d.income > 0);
              if (hasData) {
                return (
                  <ResponsiveContainer width="100%" height="100%">
                        <AreaChart id="cashflow-trend-chart" data={metrics.dailyData} margin={chartMargin}>
                        <defs>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#33FFAA" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#33FFAA" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#27272a' : '#e2e8f0'} />
                        <XAxis dataKey="date" tickLine={false} axisLine={axisLineProps} tick={tickProps} tickMargin={6} padding={{ left: 15, right: 15 }} />
                         <YAxis
                           domain={[0, 'auto']}
                           width={95}
                           tickLine={false}
                           axisLine={false}
                           padding={{ top: 10, bottom: 10 }}
                           tickFormatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: baseCurrency || 'USD', notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(value / 100)}
                           tick={{ fill: isDarkMode ? '#a1a1aa' : '#4b5563', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}
                         />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                           formatter={(value: any, name: string) => {
                             if (name === 'expense') return [formatMoney(Number(value), baseCurrency), 'Expenses'];
                             if (name === 'income') return [formatMoney(Number(value), baseCurrency), 'Income'];
                            return [formatMoney(Number(value), baseCurrency), name];
                          }}
                      />
                     <Area
                       type="monotone"
                       dataKey="expense"
                       stroke="#3b82f6"
                       strokeWidth={3}
                       fill="url(#colorExpense)"
                       dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                       activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: 'white' }}
                     />
                     <Area
                       type="monotone"
                       dataKey="income"
                       stroke="#33FFAA"
                       strokeWidth={2}
                       fill="url(#colorIncome)"
                       dot={{ fill: '#33FFAA', strokeWidth: 2, r: 4 }}
                       activeDot={{ r: 6, fill: '#33FFAA', strokeWidth: 2, stroke: 'white' }}
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               );
             }
             return (
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart id="cashflow-trend-chart" data={[{ date: 'No Data', expense: 0, income: 0 }]} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#27272a' : '#e2e8f0'} />
                    <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: isDarkMode ? '#334155' : '#e2e8f0' }} tick={{ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#4b5563' }} />
                      <YAxis domain={[0, 1]} width={80} tickLine={false} axisLine={false} padding={{ top: 10, bottom: 10 }} tickFormatter={(value) => { const symbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency; const dollars = value / 100; return `${symbol} ${Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(dollars)}`; }} tick={{ fontSize: 10, fontWeight: 600, fill: isDarkMode ? '#a1a1aa' : '#4b5563', fontFamily: 'monospace' }} />
                   <Area type="monotone" dataKey="expense" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} />
                   <Area type="monotone" dataKey="income" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} />
                 </AreaChart>
               </ResponsiveContainer>
             );
           })()}
          </div>
        </div>

        {/* Top Expenses Donut Chart Card */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 h-full flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex-none">Top Expenses</h3>
          <div className="w-full flex-1 min-h-0 flex items-center justify-between relative">
            <div className="w-[50%] h-full max-h-[170px]">
              {expenseCategoryChartData && expenseCategoryChartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                 <PieChart id="category-breakdown-chart">
                   <Pie
                     data={expenseCategoryChartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={55}
                     outerRadius={85}
                     paddingAngle={2}
                     dataKey="value"
                     onMouseEnter={handlePieMouseEnter}
                   >
                     {expenseCategoryChartData.map((entry, index) => (
                       <Cell
                         key={`cell-${index}`}
                         fill={COLORS[index % COLORS.length]}
                         stroke={activeIndex === index ? '#1e293b' : 'transparent'}
                         strokeWidth={activeIndex === index ? 3 : 0}
                         style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                       />
                     ))}
                   </Pie>
                   <Tooltip content={categoryTooltipContent} />
                 </PieChart>
               </ResponsiveContainer>
              ) : (
               <div className="w-full h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart id="category-breakdown-chart">
                    <Pie
                      data={[{ name: 'No Transactions', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                    >
                      <Cell fill="#e2e8f0" stroke="transparent" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>
            <div className="w-[45%] h-full flex flex-col items-start justify-start pt-3 space-y-3 pr-4 overflow-y-auto min-h-0">
              {expenseCategoryChartData.map((item, index) => {
                const pct = categoryChartDataTotal > 0 ? ((item.value / categoryChartDataTotal) * 100).toFixed(0) : '0';
                const color = COLORS[index % COLORS.length];
                return (
                   <div key={item.name} className="flex items-center justify-between w-full text-text-secondary py-1 text-[14px] font-normal cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg px-1" onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(-1)}>
                     <div className="flex items-center gap-2 min-w-0">
                       <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                       <span className="font-normal text-text-primary truncate max-w-[100px]" title={item.name}>{item.name}</span>
                     </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[12px] font-medium text-text-muted bg-bg-card border border-border-main px-1.5 py-0.5 rounded text-center min-w-[32px]">{pct}%</span>
                            <span className="text-blue-600 font-medium">{`${formatMoney(item.value, baseCurrency)}`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      </div>

      {/* Row 5: Compact 3-column bottom widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch w-full flex-grow flex-1 min-h-0 mt-3">
        {/* COLUMN 1: Capital Allocation Simulator */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 flex flex-col justify-between">
          <DashboardSimulatorWidget 
            safetyFloor={safetyFloor} 
            lockedSavings={lockedSavings} 
            budgetSurplusRule={budgetSurplusRule}
            wallets={wallets}
            budgets={budgets}
            expenses={expenses}
            computedSurplus={metrics.autoSweepSurplus}
          />
        </div>

        {/* COLUMN 2: DATA STACK */}
        <div className="flex flex-col gap-3 h-full justify-between">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 flex-1 flex flex-col justify-between">
            <DashboardHealthWidget 
              totalLiquidReserves={metrics.totalLiquidReserves}
              availableCash={metrics.availableCash}
              lockedSavings={metrics.lockedSavings}
              availablePercent={metrics.availablePercent}
              lockedPercent={metrics.lockedPercent}
              baseCurrency={baseCurrency} 
            />
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 flex-1 flex flex-col justify-between">
            <DashboardPacingWidget expenses={expenses} targetBase={metrics.targetBase} baseCurrency={baseCurrency} fxRate={fxRate} />
          </div>
        </div>

        {/* COLUMN 3: Recent Transactions & Shortcuts */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm transition-colors duration-200 flex flex-col justify-between h-full">
            <div className="flex-1 overflow-hidden">
              <div className="flex-none pb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">Recent Transactions</h3>
              </div>
              <div className="h-[155px] overflow-y-auto pr-1 space-y-1.5 min-h-0">
                {sortedRecentExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                      <ArrowDownRight className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-text-secondary">No transactions yet</p>
                    <p className="text-xs text-text-muted mt-1">Add your first transaction to get started</p>
                    <button
                      onClick={() => navigate('/add')}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      + Add Transaction
                    </button>
                  </div>
                ) : (
                   sortedRecentExpenses.map((tx) => {
                    const rawCents = Math.abs(tx.amount);
                    return (
                       <div key={tx.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-lg last:mb-0">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              String(tx.type).toLowerCase() === 'income'
                                ? 'bg-emerald-500/15'
                                : 'bg-rose-500/15'
                            }`}
                          >
                            {String(tx.type).toLowerCase() === 'income' ? (
                              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p title={tx.description} className="text-sm font-medium text-text-primary truncate cursor-help max-w-[110px] sm:max-w-[140px]">
                              {tx.description}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {tx.category} • {tx.subcategory || 'Other'} • {format(new Date(tx.date), 'MMM dd')}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${tx.category === 'Savings Transfer' ? 'text-blue-500' : String(tx.type).toLowerCase() === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {String(tx.type).toLowerCase() === 'income' ? '+' : '-'}{formatMoney(rawCents, baseCurrency)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-3 p-3 bg-slate-50/40 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-inner">
              <div className="pb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Quick System Shortcuts</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => navigate(location.pathname === '/' ? '/analytics' : '/')}
                  className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  {location.pathname === '/' ? '📊 Analytics' : '🏠 Dashboard'}
                </button>
                <div ref={quickAddRef} className="relative">
                  <button
                    onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                    className="w-full py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer text-emerald-600 hover:text-emerald-700"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                  {isQuickAddOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-44 bg-bg-card border border-border-main rounded-xl shadow-xl z-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setIsQuickAddOpen(false); navigate('/add?type=expense'); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-input transition-colors cursor-pointer"
                      >
                        <span className="text-red-500">⬇</span> Add Expense
                      </button>
                      <hr className="border-border-main" />
                      <button
                        type="button"
                        onClick={() => { setIsQuickAddOpen(false); navigate('/add?type=income'); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-input transition-colors cursor-pointer"
                      >
                        <span className="text-emerald-500">⬆</span> Add Income
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/expenses')}
                  className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-cyan-600 hover:text-cyan-700"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Ledger
                </button>
                <button
                  onClick={() => navigate('/settings#notifications')}
                  className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-rose-600 hover:text-rose-700"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Reports
                </button>
                <button
                  onClick={() => navigate('/transfer')}
                  className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-amber-600 hover:text-amber-700"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Transfer
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="py-1 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c.94 1.543-.826 3.31 2.37 2.37a1.724 1.724 0 002.573 1.066c.426 1.756 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </div>
            </div>
        </div>
      </div>

      {activeReceiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-bg-card border-border-main p-4 rounded-xl shadow-2xl max-w-xl w-full flex flex-col items-center">

            <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3 mb-3 pb-2 border-b border-border-main">
              <h4 className="text-sm font-bold">Scanned Digital Receipt Preview</h4>

              <div className="flex items-center gap-1.5 bg-bg-input p-1 rounded-lg border border-border-main">
                <button
                  onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                  className="px-2.5 py-1 text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer"
                  title="Zoom Out"
                >
                  ➖
                </button>
                <span className="text-[11px] font-mono font-medium text-text-muted bg-bg-input px-2 py-0.5 rounded shadow-sm min-w-[42px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.25))}
                  className="px-2.5 py-1 text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer"
                  title="Zoom In"
                >
                  ➕
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="px-2 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-l border-border-main ml-1 pl-2"
                  title="Reset"
                >
                  Reset
                </button>
                <button
                  onClick={() => handlePrintReceipt(activeReceiptPreview)}
                  className="px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer border-l border-border-main ml-1 pl-2 flex items-center gap-1"
                  title="Print Document Receipt"
                >
                  🖨️ Print
                </button>
              </div>

              <button
                onClick={() => { setActiveReceiptPreview(null); setZoomScale(1); }}
                className="text-text-muted hover:text-text-primary font-bold text-sm cursor-pointer ml-auto sm:ml-0"
              >
                ✕ Close
              </button>
            </div>

            <div className="w-full h-[400px] bg-bg-main rounded-lg overflow-auto flex items-center justify-center p-4 scrollbar-thin">
              <div
                className="transition-transform duration-200 ease-out origin-center flex items-center justify-center"
                style={{ transform: `scale(${zoomScale})` }}
              >
                <img
                  src={activeReceiptPreview}
                  alt="Scanned Transaction Attachment Receipt"
                  className="max-w-full max-h-[380px] object-contain shadow-xl"
                />
              </div>
            </div>

          </div>
        </div>
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
