import * as XLSX from 'xlsx';
import { db } from '../../db';

function sanitizeForExcel(s: string): string {
  return String(s).replace(/[\u{1F000}-\u{1FFFF}\u{200D}\u{FE0F}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function forceCleanText(val: any): string {
  return sanitizeForExcel(String(val ?? ''));
}

export async function exportBudgetPerformanceExcel() {
  const budgets = await db.budgets.toArray();
  const expenses = await db.expenses.toArray();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  const headers = ["Category", "Budget Limit", "Spent This Month", "Remaining", "Status"];

  const rows = budgets.map((budget) => {
    const categoryExpenses = expenses
      .filter(e => {
        if (e.type !== 'expense' || !e.category || !e.date) return false;
        const matchesCategory = e.category.trim().toLowerCase() === (budget.category_name ?? '').trim().toLowerCase();
        const expenseMonthStr = String(e.date).slice(0, 7);
        return matchesCategory && expenseMonthStr === currentMonthStr;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const limit = (budget.limit_amount || 0) / 100;
    const remaining = limit - (categoryExpenses / 100);
    const status = remaining < 0 ? "Over Budget" : "On Track";

    return [
      forceCleanText(budget.category_name),
      limit,
      categoryExpenses / 100,
      remaining,
      status
    ];
  });

  const aoaData = [
    [`Budget Performance Report - ${monthLabel}`],
    [],
    headers,
    [],
    ...rows
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

  worksheet['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Performance");
  XLSX.writeFile(workbook, `ClearSum_Budget_Performance_${now.toISOString().split('T')[0]}.xlsx`);
}

export const exportTransactionsLedgerExcel = async (transactions: any[]) => {
  const wallets = await db.wallets.toArray();
  const walletMap = new Map(wallets.map(w => [w.id, w.name]));
  const ledgerRows = transactions.map((t) => ({
    "Date": forceCleanText(t.date),
    "Description": forceCleanText(t.description),
    "Category": forceCleanText(t.category),
    "Wallet Account": forceCleanText(walletMap.get(Number(t.walletId || t.wallet_id)) || t.walletId || t.wallet_id),
    "Transaction Type": forceCleanText(t.type || 'expense'),
    "Amount": (t.amount || 0) / 100
  }));

  const worksheet = XLSX.utils.json_to_sheet(ledgerRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions Ledger");
  XLSX.writeFile(workbook, `ClearSum_Transactions_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
};
