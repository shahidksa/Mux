import { db } from '../../db';

const USD_FALLBACK: Record<string, number> = {
  USD: 1.0,
  PKR: 278,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149,
  CNY: 7.24,
  INR: 83,
  AUD: 1.53,
  CAD: 1.36,
  SAR: 3.75,
  AED: 3.67,
  QAR: 3.64,
  KWD: 0.31,
};

function fallbackRatesForBase(base: string): Record<string, number> {
  if (base === 'USD') return { ...USD_FALLBACK };
  const baseInUsd = USD_FALLBACK[base];
  if (!baseInUsd) return { ...USD_FALLBACK };
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(USD_FALLBACK)) {
    rates[code] = code === base ? 1 : rate / baseInUsd;
  }
  return rates;
}

export async function fetchLiveExchangeRates() {
  try {
    const settingsRow = await db.settings.get(1);
    const activeBaseCurrencyPreference = settingsRow?.base_currency || 'USD';

    console.log(`[FX Engine] Fetching rates anchored to base: ${activeBaseCurrencyPreference}`);

    const response = await fetch(`https://open.er-api.com/v6/latest/${activeBaseCurrencyPreference}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API returned bad response state code: ${response.status}`);
    }

    const data = await response.json();

    if (data?.result === 'success' && data.rates) {
      const usdRate = (data.rates as Record<string, number>)['USD'] || 1;
      const normalizedRates: Record<string, number> = {};
      for (const [currency, rate] of Object.entries(data.rates as Record<string, number>)) {
        normalizedRates[currency] = Math.round((rate / usdRate) * 1_000_000) / 1_000_000;
      }
      normalizedRates['USD'] = 1;

      await db.settings.put({
        id: 1,
        base_currency: activeBaseCurrencyPreference,
        exchange_rates: JSON.stringify(normalizedRates)
      });

      return { success: true as const, rates: normalizedRates };
    } else {
      throw new Error('API structure verification failed.');
    }
  } catch (error) {
    console.warn('[FX Engine Warning] Fallback deployed:', error);

    const settingsRow = await db.settings.get(1);
    const base = settingsRow?.base_currency || 'USD';
    const fallback = fallbackRatesForBase(base);

    return { success: false as const, rates: fallback };
  }
}
