import { db } from '../../db';

export interface CurrencySeed {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
  is_custom: boolean;
}

const ALLOWED_CODES = new Set(['USD','CAD','SAR','AED','AUD','PKR','INR','CNY','JPY','EUR','GBP','NZD','HKD','CHF','NOK','TRY','SDG']);

const CURRENCIES: CurrencySeed[] = [
  { code: 'USD', name: 'United States Dollar', symbol: '$', isDefault: true, is_custom: false },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', isDefault: true, is_custom: false },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', isDefault: true, is_custom: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', isDefault: true, is_custom: false },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', isDefault: true, is_custom: false },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', isDefault: true, is_custom: false },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', isDefault: true, is_custom: false },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', isDefault: true, is_custom: false },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', isDefault: true, is_custom: false },
  { code: 'EUR', name: 'Euro', symbol: '€', isDefault: true, is_custom: false },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', isDefault: true, is_custom: false },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', isDefault: true, is_custom: false },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', isDefault: true, is_custom: false },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', isDefault: true, is_custom: false },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', isDefault: true, is_custom: false },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', isDefault: true, is_custom: false },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س', isDefault: true, is_custom: false },
];

export async function seedCurrencies() {
  // Remove old default currencies no longer in the allowed list (preserves user-added ones)
  const all = await db.currencies.toArray();
  const toDelete = all.filter(c => c.isDefault && !ALLOWED_CODES.has(c.code)).map(c => c.id!);
  if (toDelete.length > 0) {
    await db.currencies.bulkDelete(toDelete);
  }

  // Add missing defaults
  const existing = await db.currencies.toArray();
  const existingCodes = new Set(existing.map(c => c.code));
  const toAdd = CURRENCIES.filter(c => !existingCodes.has(c.code));
  if (toAdd.length > 0) {
    await db.currencies.bulkAdd(toAdd);
  }

  // Deduplicate: keep one entry per code
  const remaining = await db.currencies.toArray();
  const best = new Map<string, typeof remaining[0]>();
  for (const c of remaining) {
    const prev = best.get(c.code);
    if (!prev || (c.isDefault && !prev.isDefault)) {
      best.set(c.code, c);
    }
  }
  if (best.size < remaining.length) {
    const dupIds = remaining.filter(c => !best.has(c.code) || c.id !== best.get(c.code)!.id).map(c => c.id!);
    await db.currencies.bulkDelete(dupIds);
  }
}
