// ============================================================
// Monetary utilities — all values in base currency
// ============================================================
// ARCHITECTURE: All balances, transactions, goals, and budgets are
// stored in the base currency (the user's selected display currency).
// Currency conversion only happens in handleBaseCurrencyChange in Settings.tsx.
//
// formatMoney: displays a base-currency value with proper symbol & decimals.
//   - cents: integer amount in base currency units (/100 for display)
//   - currency: ISO code used for symbol lookup and decimal precision
//
// No currency conversion occurs in this file.
// ============================================================

import { CURRENCY_SYMBOLS } from './currency';

export const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, JPY: 0, CNY: 2, INR: 2, PKR: 2,
  AUD: 2, CAD: 2, SAR: 2, AED: 2, CHF: 2, SGD: 2, HKD: 2,
  NZD: 2, SEK: 2, NOK: 2, DKK: 2, PLN: 2, CZK: 2, HUF: 0,
  BHD: 3, KWD: 3, OMR: 3, JOD: 3, TND: 3, LYD: 3,
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, KMF: 0, KRW: 0,
  MGA: 0, PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0,
  XAF: 0, XOF: 0, XPF: 0,
};

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function parseDollarsToCents(input: string): number {
  const sanitized = input.replace(/,/g, '').trim();
  const value = parseFloat(sanitized);
  if (isNaN(value)) return NaN;
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + (v || 0), 0);
}

export function isNearZero(cents: number): boolean {
  return Math.abs(cents) < 1;
}

export function formatMoney(cents: number, currency: string = 'USD'): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const dollars = fromCents(cents);
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const sign = dollars < 0 ? '-' : '';
  const absVal = Math.abs(dollars);
  const formatted = decimals > 0
    ? absVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : absVal.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${sign}${symbol}${formatted}`;
}


export const convertAndRoundCurrency = (baseAmountCents: number, rate: number): number => {
  return Math.round(baseAmountCents * rate);
};

export function roundMoney(cents: number): number {
  return Math.round(cents);
}

export function sumMoney(values: number[]): number {
  return sumCents(values);
}

export function computeSurplusCents(
  totalIncomeCents: number,
  totalExpenseCents: number,
  safetyFloorCents: number,
  capitalShieldCents: number,
  totalSavedInGoalsCents: number,
): number {
  return Math.max(0, totalIncomeCents - totalExpenseCents - safetyFloorCents - capitalShieldCents - totalSavedInGoalsCents);
}
