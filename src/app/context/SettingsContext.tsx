import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../db';
import type { CustomCurrency } from '../utils/currency';
import { toCents } from '../utils/monetary';

const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 149,
  CNY: 7.24,
  INR: 83,
  PKR: 278,
  AUD: 1.53,
  CAD: 1.36,
  SAR: 3.75,
  AED: 3.67,
  QAR: 3.64,
  KWD: 0.31
};

const STORAGE_KEY = 'expense_app_settings';

function sanitizeRates(rates: Record<string, number>): Record<string, number> {
  if (!rates || typeof rates !== 'object') return { ...DEFAULT_RATES };
  const keys = Object.keys(rates).filter(k => typeof rates[k] === 'number' && isFinite(rates[k]));
  if (keys.length < 3) return { ...DEFAULT_RATES };
  if (rates.PKR !== undefined && rates.USD !== undefined && rates.PKR === rates.USD) return { ...DEFAULT_RATES };
  if (rates.PKR === undefined && rates.USD === undefined) return { ...DEFAULT_RATES };
  let clean: Record<string, number>;
  if (rates['USD'] !== 1) {
    const usdRate = rates['USD'] || 1;
    clean = {};
    for (const key of keys) {
      clean[key] = Math.round((rates[key] / usdRate) * 1_000_000) / 1_000_000;
    }
    clean['USD'] = 1;
  } else {
    clean = { ...rates };
  }
  for (const [currency, rate] of Object.entries(DEFAULT_RATES)) {
    if (clean[currency] === undefined) {
      clean[currency] = rate;
    }
  }
  return clean;
}

interface AppSettings {
  baseCurrency: string;
  setBaseCurrency: (currency: string) => void;
  rateMode: 'api' | 'manual';
  setRateMode: (mode: 'api' | 'manual') => void;
  exchangeRates: Record<string, number>;
  setExchangeRates: (rates: Record<string, number>) => void;
  allowBudgetAlerts: boolean;
  setAllowBudgetAlerts: (allow: boolean) => void;
  customCurrencies: CustomCurrency[];
  addCustomCurrency: (cc: CustomCurrency) => void;
  removeCustomCurrency: (code: string) => void;
  safetyFloor: number;
  setSafetyFloor: (value: number) => void;
  capitalShield: number;
  setCapitalShield: (value: number) => void;
  sweepPercentage: number;
  setSweepPercentage: (value: number) => void;
  sweepFrequency: 'daily' | 'weekly' | 'monthly' | null;
  setSweepFrequency: (value: 'daily' | 'weekly' | 'monthly' | null) => void;
}

const SettingsContext = createContext<AppSettings | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBaseCurrencyState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.baseCurrency || 'USD';
      } catch {
        return 'USD';
      }
    }
    return 'USD';
  });

  const [rateMode, setRateModeState] = useState<'api' | 'manual'>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.rateMode || 'manual';
      } catch {
        return 'manual';
      }
    }
    return 'manual';
  });
  const [exchangeRates, setExchangeRatesState] = useState<Record<string, number>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return sanitizeRates(parsed.exchangeRates || DEFAULT_RATES);
      } catch {
        return { ...DEFAULT_RATES };
      }
    }
    return { ...DEFAULT_RATES };
  });
  const [allowBudgetAlerts, setAllowBudgetAlertsState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.allowBudgetAlerts !== undefined ? parsed.allowBudgetAlerts : true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const [customCurrencies, setCustomCurrencies] = useState<CustomCurrency[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed.customCurrencies) ? parsed.customCurrencies : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [safetyFloor, setSafetyFloorState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.safetyFloor ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  const [capitalShield, setCapitalShieldState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.capitalShield ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  const [sweepPercentage, setSweepPercentageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.sweepPercentage ?? 5;
      } catch {
        return 5;
      }
    }
    return 5;
  });

  const [sweepFrequency, setSweepFrequencyState] = useState<'daily' | 'weekly' | 'monthly' | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.sweepFrequency ?? null;
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.rateMode) setRateModeState(parsed.rateMode);
        if (parsed.exchangeRates) setExchangeRatesState(sanitizeRates(parsed.exchangeRates));
        if (parsed.safetyFloor !== undefined) setSafetyFloorState(parsed.safetyFloor);
        if (parsed.capitalShield !== undefined) setCapitalShieldState(parsed.capitalShield);
        if (parsed.sweepFrequency !== undefined) setSweepFrequencyState(parsed.sweepFrequency);
        if (parsed.sweepPercentage !== undefined) setSweepPercentageState(parsed.sweepPercentage);
      } catch {}
    }

      async function loadFromDexie() {
        const data = await db.settings.get(1);
        if (data) {
          if (data.base_currency) setBaseCurrencyState(data.base_currency);
          if (data.rate_mode) setRateModeState(data.rate_mode);
          if (data.exchange_rates) {
            try {
              setExchangeRatesState(sanitizeRates(JSON.parse(data.exchange_rates)));
            } catch {}
          }
          if (data.custom_currencies) {
            try {
              const parsed = JSON.parse(data.custom_currencies);
              if (Array.isArray(parsed)) setCustomCurrencies(parsed);
            } catch {}
          }
          if (data.safety_floor !== undefined) setSafetyFloorState(data.safety_floor);
          if (data.capital_shield !== undefined) setCapitalShieldState(data.capital_shield);
          if (data.sweep_allocation_ratio !== undefined) setSweepPercentageState(data.sweep_allocation_ratio);
          if (data.sweep_frequency !== undefined) setSweepFrequencyState(data.sweep_frequency);
        }
      }
      loadFromDexie();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseCurrency, rateMode, exchangeRates, allowBudgetAlerts, customCurrencies, safetyFloor, capitalShield, sweepPercentage, sweepFrequency }));
  }, [baseCurrency, rateMode, exchangeRates, allowBudgetAlerts, customCurrencies, safetyFloor, capitalShield, sweepPercentage, sweepFrequency]);

  useEffect(() => {
    async function saveToDexie() {
      const existing = await db.settings.get(1);
      await db.settings.put({
        ...existing,
        id: 1,
        base_currency: baseCurrency,
        rate_mode: rateMode,
        exchange_rates: JSON.stringify(exchangeRates),
        custom_currencies: JSON.stringify(customCurrencies),
        safety_floor: safetyFloor,
        capital_shield: capitalShield,
        sweep_allocation_ratio: sweepPercentage,
        sweep_frequency: sweepFrequency
      });
    }
    saveToDexie();
  }, [baseCurrency, rateMode, exchangeRates, customCurrencies, safetyFloor, capitalShield, sweepPercentage, sweepFrequency]);

  const setBaseCurrency = (currency: string) => {
    setBaseCurrencyState(currency);
  };

  const setRateMode = (mode: 'api' | 'manual') => {
    setRateModeState(mode);
  };

  const setExchangeRates = (rates: Record<string, number>) => {
    setExchangeRatesState(sanitizeRates(rates));
  };

  const setAllowBudgetAlerts = (allow: boolean) => {
    setAllowBudgetAlertsState(allow);
  };

  const setSafetyFloor = (value: number) => {
    setSafetyFloorState(toCents(value));
  };

  const setCapitalShield = (value: number) => {
    setCapitalShieldState(toCents(value));
  };

  const setSweepPercentage = (value: number) => {
    setSweepPercentageState(value);
  };

  const setSweepFrequency = (value: 'daily' | 'weekly' | 'monthly' | null) => {
    setSweepFrequencyState(value);
  };

  const addCustomCurrency = useCallback((cc: CustomCurrency) => {
    setCustomCurrencies(prev => {
      if (prev.some(c => c.code === cc.code)) return prev;
      return [...prev, cc];
    });
  }, []);

  const removeCustomCurrency = useCallback((code: string) => {
    setCustomCurrencies(prev => prev.filter(c => c.code !== code));
  }, []);

  return (
    <SettingsContext.Provider value={{
      baseCurrency, setBaseCurrency,
      rateMode, setRateMode,
      exchangeRates, setExchangeRates,
      allowBudgetAlerts, setAllowBudgetAlerts,
      customCurrencies, addCustomCurrency, removeCustomCurrency,
      safetyFloor, setSafetyFloor,
      capitalShield, setCapitalShield,
      sweepPercentage, setSweepPercentage,
      sweepFrequency, setSweepFrequency
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
