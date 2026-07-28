import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Expense } from '../types/expense';
import { useExpenses } from '../context/ExpenseContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Edit, Trash2, Filter, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../db';
import { useSettings } from '../context/SettingsContext';
import { CURRENCY_SYMBOLS, DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { formatMoney } from '../utils/monetary';
import { exportTransactionsLedgerExcel } from '../utils/excelEngine';

export function Expenses() {
  const PAGE_SIZE = 50;
  const { expenses, wallets, transfers, categories, deleteExpense } = useExpenses();
  const navigate = useNavigate();
  const { baseCurrency, exchangeRates } = useSettings();
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  const fxRate = rates[baseCurrency] || 1;
  const [activeTab, setActiveTab] = useState<'expenses' | 'transfers'>('expenses');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [hiddenExpenseIds, setHiddenExpenseIds] = useState<Set<number>>(new Set());
  const deletionTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeReceiptPreview, setActiveReceiptPreview] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const savingsAllocations = useLiveQuery(() => db.transfers.where('transfer_type').equals('TRANSFER').toArray(), []) || [];

  const unifiedTransfers = useMemo(() => {
    const normalizedSavings = savingsAllocations.map(tx => {
      const sourceWallet = wallets.find(w => w.id === tx.source_wallet_id);
      return {
        id: `savings-${tx.id}`,
        date: tx.date || tx.created_at || '',
        sourceLabel: sourceWallet?.name || 'UBL Bank',
        destinationLabel: '🎯 Savings Vault',
        amount: tx.amount,
        currency: sourceWallet?.currency || baseCurrency,
        description: tx.description || '',
        _type: 'savings' as const
      };
    });

    const mappedTransfers = transfers.map(t => {
      const fromWallet = wallets.find(w => w.id === t.source_wallet_id);
      const toWallet = wallets.find(w => w.id === t.destination_wallet_id);
      return {
        id: `transfer-${t.id}`,
        date: t.created_at || '',
        sourceLabel: fromWallet?.name || 'Primary Account (Archived)',
        destinationLabel: toWallet?.name || 'Primary Account (Archived)',
        amount: t.amount,
        currency: fromWallet?.currency || baseCurrency,
        _type: 'transfer' as const
      };
    });

    return [...mappedTransfers, ...normalizedSavings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transfers, savingsAllocations, wallets]);

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

  const walletMap = useMemo(() => {
    const map: Record<number, typeof wallets[0]> = {};
    wallets.forEach(w => { map[w.id] = w; });
    return map;
  }, [wallets]);

  const filteredExpenses = useMemo(() => expenses
    .filter(e => !hiddenExpenseIds.has(e.id))
    .filter(e => {
      const expenseDate = e.date ? new Date(e.date) : new Date(0);
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesStartDate = !startDate || expenseDate >= new Date(startDate);
      const matchesEndDate = !endDate || expenseDate <= new Date(endDate);
      return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        return idB - idA;
      }
      return b.amount - a.amount;
    }), [expenses, hiddenExpenseIds, searchTerm, categoryFilter, startDate, endDate, sortBy]);

  const visibleExpenses = useMemo(() => filteredExpenses.slice(0, visibleCount), [filteredExpenses, visibleCount]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, categoryFilter, startDate, endDate, sortBy]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => {
            const next = prev + PAGE_SIZE;
            return next >= filteredExpenses.length ? filteredExpenses.length : next;
          });
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredExpenses.length]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget.id, deleteReason.trim() || undefined);
      setDeleteTarget(null);
      setDeleteReason('');
      toast.success('Transaction deleted');
    } catch {
      toast.error('Failed to delete transaction');
      setDeleteTarget(null);
      setDeleteReason('');
    }
  }, [deleteTarget, deleteReason, deleteExpense]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setDeleteReason('');
  }, []);

  const handleExportExcel = async () => {
    try {
      await exportTransactionsLedgerExcel(expenses);
      toast.success('Exported ledger to Excel');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  const handleExportTransfers = async () => {
    try {
      const rawTransfers = await db.transfers.toArray();
      const wallets = await db.wallets.toArray();
      const savingsAllocs = await db.transfers.where('transfer_type').equals('TRANSFER').toArray();

      const walletMap = new Map(wallets.map(w => [w.id, w.name]));

      let csvContent = 'Date,From Wallet,To Wallet,Amount,Type\n';

      rawTransfers.forEach(t => {
        const dateStr = new Date(t.created_at).toLocaleString();
        const fromName = walletMap.get(Number(t.source_wallet_id)) || 'Unknown';
        const toName = walletMap.get(Number(t.destination_wallet_id)) || 'Unknown';
         const amountStr = (t.amount / 100).toFixed(2);

         csvContent += `"${dateStr}","${fromName}","${toName}",${amountStr},"Wallet Transfer"\n`;
       });

        savingsAllocs.forEach(tx => {
          const dateStr = new Date(tx.date || tx.created_at || new Date()).toLocaleString();
          const sourceWallet = wallets.find(w => w.id === tx.source_wallet_id);
          const fromName = sourceWallet?.name || 'Unknown';
          const amountStr = (tx.amount / 100).toFixed(2);

         csvContent += `"${dateStr}","${fromName}","🎯 Savings Vault",${amountStr},"Savings Allocation"\n`;
       });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.setAttribute('href', url);
      link.setAttribute('download', `Transfer_Logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const totalCount = rawTransfers.length + savingsAllocs.length;
      toast.success(`Exported ${totalCount} transfers to CSV`);
    } catch (error) {
      console.error("Critical failure during transfer spreadsheet export:", error);
      toast.error('Failed to export transfers');
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col p-4 bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">All Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and track your cashflow</p>
        </div>
        <button 
          onClick={() => navigate('/add')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200 shrink-0"
        >
          Add Expense
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 shrink-0 mt-4">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'expenses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
            All Transactions
          </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transfers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Transfer Logs
        </button>
      </div>

      {/* Expenses Filters */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm shrink-0 mt-4">
          <div className="flex gap-4 items-center flex-wrap">
            <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-48 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'date' | 'amount')}>
              <SelectTrigger className="w-48 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="amount">Sort by Amount</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 ml-auto">
              <span className="text-xs font-semibold text-blue-600 border-2 border-blue-600/30 rounded-lg px-3 py-1.5">{CURRENCY_SYMBOLS[baseCurrency]} {baseCurrency}</span>
              <button 
                type="button"
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                📊 Export Ledger Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0 mt-4">
        {activeTab === 'expenses' && (
          <div className="w-full bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="overflow-x-auto min-w-0 rounded-lg pr-1 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                  {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <p className="font-medium">No transactions recorded yet.</p>
                <p className="mt-1">Add your first transaction to start tracking your finances.</p>
              </div>
              ) : (
                <table className="w-full min-w-[950px] border-collapse text-left table-auto">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-card shadow-[0_1px_0_0_rgba(228,228,231,1)] dark:shadow-[0_1px_0_0_rgba(39,39,42,1)]">
                    <tr className="bg-blue-50 dark:bg-blue-950/40 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Wallet</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {visibleExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">{format(new Date(expense.date), 'MMM dd, yyyy')}</td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white truncate max-w-[200px]" title={expense.description}>{expense.description}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-semibold text-blue-600 truncate inline-block max-w-full">{expense.category}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={walletMap[expense.wallet_id ?? -1]?.name}>{walletMap[expense.wallet_id ?? -1]?.name || 'Unknown'}</td>
                        <td className="py-3 px-4 font-semibold">
                          <span className={
                            expense.category === 'Savings Transfer' || expense.category === 'System Transfer' || expense.description?.includes('Reallocated') || expense.description?.includes('Auto-sweep') || String(expense.type).toLowerCase() === 'transfer'
                              ? 'text-slate-500 dark:text-slate-500'
                              : String(expense.type).toLowerCase() === 'income'
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                          }>
                            {expense.category === 'Savings Transfer' || expense.category === 'System Transfer' || expense.description?.includes('Reallocated') || expense.description?.includes('Auto-sweep') || String(expense.type).toLowerCase() === 'transfer'
                              ? `🔄 ${formatMoney(Math.abs(expense.amount), baseCurrency)}`
                              : String(expense.type).toLowerCase() === 'income'
                                ? `+${formatMoney(Math.abs(expense.amount), baseCurrency)}`
                                : `-${formatMoney(Math.abs(expense.amount), baseCurrency)}`}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {expense.receiptImage ? (
                            <button onClick={() => setActiveReceiptPreview(expense.receiptImage)} className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-all duration-200 cursor-pointer">📄 View Receipt</button>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/${expense.id}`)} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Edit className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense)} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {visibleCount < filteredExpenses.length && (
                <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  Showing {visibleCount} of {filteredExpenses.length} transactions — scroll for more
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <Card className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-blue-600 flex items-center gap-2">Transfer History ({unifiedTransfers.length} items)</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportTransfers} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                <Download className="w-4 h-4 mr-1" /> Export Logs
              </Button>
            </CardHeader>
            <CardContent className="w-full overflow-x-auto scrollbar-thin min-w-0">
              {unifiedTransfers.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No transfers yet</p>
              ) : (
                <Table className="min-w-[1100px] table-auto">
                   <TableHeader className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white sticky top-0 z-10 rounded-lg">
                     <TableRow>
                       <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left first:rounded-l-lg last:rounded-r-lg">Date</TableHead>
                       <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left first:rounded-l-lg last:rounded-r-lg">From</TableHead>
                       <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left first:rounded-l-lg last:rounded-r-lg">To</TableHead>
                       <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-right first:rounded-l-lg last:rounded-r-lg">Amount</TableHead>
                     </TableRow>
                   </TableHeader>
                  <TableBody>
                    {unifiedTransfers.map((transfer) => {
                      return (
                        <TableRow key={transfer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="text-slate-900 dark:text-white whitespace-nowrap">{format(new Date(transfer.date || new Date()), 'MMM dd, yyyy HH:mm')}</TableCell>
                          <TableCell className="truncate max-w-[200px] text-slate-600 dark:text-slate-400" title={transfer.sourceLabel}>
                            {transfer.sourceLabel}
                          </TableCell>
                          <TableCell className="truncate max-w-[200px] text-slate-600 dark:text-slate-400" title={transfer.destinationLabel}>
                            {transfer.destinationLabel}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 dark:text-white">
                            {formatMoney(Math.abs(transfer.amount), baseCurrency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {activeReceiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-bg-card border border-border-main p-4 rounded-xl shadow-2xl max-w-xl w-full flex flex-col items-center">

            <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3 mb-3 pb-2 border-b border-border-main">
              <h4 className="text-sm font-bold text-text-primary">Scanned Digital Receipt Preview</h4>

              <div className="flex items-center gap-1.5 bg-bg-main p-1 rounded-lg border border-border-main">
                <button
                  onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                  className="px-2.5 py-1 text-xs font-bold text-text-muted hover:text-text-primary cursor-pointer"
                  title="Zoom Out"
                >
                  ➖
                </button>
                <span className="text-[11px] font-mono font-medium text-text-muted bg-bg-card px-2 py-0.5 rounded shadow-sm min-w-[42px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.25))}
                  className="px-2.5 py-1 text-xs font-bold text-text-muted hover:text-text-primary cursor-pointer"
                  title="Zoom In"
                >
                  ➕
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="px-2 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-l border-border-main ml-1 pl-2"
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCancelDelete} />
          <div className="relative flex items-center justify-center h-full p-4">
            <div className="w-full max-w-sm bg-bg-card border border-border-main rounded-2xl p-6 shadow-2xl">
              <h4 className="text-sm font-bold text-text-primary mb-1.5">Confirm Deletion</h4>
              <p className="text-[11px] text-text-muted leading-relaxed mb-4">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
              <div className="space-y-2 mb-5">
                <label className="block text-[11px] font-medium text-text-secondary">Reason for Deletion (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. Vendor Refund, Typo..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 bg-bg-input hover:bg-zinc-200 dark:hover:bg-zinc-700 text-text-secondary font-semibold text-xs py-2.5 rounded-xl transition border border-border-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-lg shadow-rose-600/10 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-8 block clear-both" />
    </div>
  );
}
