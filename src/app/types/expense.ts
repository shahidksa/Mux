export type Category =
  | 'Food & Dining'
  | 'Transportation'
  | 'Shopping'
  | 'Entertainment'
  | 'Healthcare'
  | 'Bills & Utilities'
  | 'Housing & Utilities'
  | 'Financial Expenses'
  | 'Fixed Assets'
  | 'Savings Transfer'
  | 'Travel & Vacation'
  | 'Personal Electronics'
  | 'Education'
  | 'Other Assets'
  | 'Salary'
  | 'Freelance'
  | 'Business'
  | 'Investment'
  | 'Gift'
  | 'Refund'
  | 'Starting Balance'
  | 'Other';

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: Category;
  subcategory?: string;
  date: string;
  wallet_id?: number;
  receiptImage?: string;
  type: 'expense' | 'income' | 'transfer';
}
