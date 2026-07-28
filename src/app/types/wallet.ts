export type WalletType = 'bank' | 'cash' | 'card';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'PKR' | 'AUD' | 'CAD' | 'SAR' | 'AED';

export interface Wallet {
  id: number;
  name: string;
  balance: number;
  currency: Currency;
  type: WalletType;
}

export interface Category {
  id: number;
  name: string;
  icon?: string;
  type?: 'expense' | 'income' | 'both';
  parent_id?: number | null;
}
