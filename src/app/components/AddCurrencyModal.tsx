import React, { useState, useMemo } from 'react';
import { db } from '../../db';

export function AddCurrencyModal({ isOpen, onClose, activeBaseCurrency, currentExchangeRates }) {
  if (!isOpen) return null;

  const [selectedIsoCode, setSelectedIsoCode] = useState('');

  const authenticDirectory = [
    { code: 'USD', name: 'United States Dollar', symbol: '$', usd_peg: 1 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', usd_peg: 1.3680 },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', usd_peg: 3.7510 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', usd_peg: 3.6725 },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', usd_peg: 1.5120 },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', usd_peg: 278.4000 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', usd_peg: 83.5000 },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', usd_peg: 7.2450 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', usd_peg: 156.4000 },
    { code: 'EUR', name: 'Euro', symbol: '€', usd_peg: 0.9250 },
    { code: 'GBP', name: 'British Pound', symbol: '£', usd_peg: 0.7850 },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', usd_peg: 1.6200 },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', usd_peg: 7.8200 },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', usd_peg: 0.8940 },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', usd_peg: 10.7500 },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', usd_peg: 32.5000 },
    { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س', usd_peg: 600 }
  ];

  const computedMetrics = useMemo(() => {
    if (!selectedIsoCode) return { symbol: '—', rate: '0.000000' };

    const targetProfile = authenticDirectory.find(c => c.code === selectedIsoCode);
    const baseProfile = authenticDirectory.find(c => c.code === activeBaseCurrency);

    if (!targetProfile || !baseProfile) return { symbol: '—', rate: '0.000000' };

    const calculatedRate = targetProfile.usd_peg / baseProfile.usd_peg;
    const preciseRateString = (Math.round(calculatedRate * 1000000) / 1000000).toFixed(6);

    return {
      symbol: targetProfile.symbol,
      rate: preciseRateString
    };
  }, [selectedIsoCode, activeBaseCurrency]);

  const handleRegisterProfile = async () => {
    if (!selectedIsoCode) return;
    const targetProfile = authenticDirectory.find(c => c.code === selectedIsoCode);
    if (!targetProfile) return;

    const config = await db.config.toCollection().first();
    const updatedRates = { ...config?.exchange_rates };
    updatedRates[selectedIsoCode] = parseFloat(computedMetrics.rate);

    await db.config.toCollection().modify({ exchange_rates: updatedRates });

    setSelectedIsoCode('');
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-4 bg-zinc-900/10 dark:bg-black/30 backdrop-blur-[6px] select-none overflow-hidden animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white dark:bg-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-96 shadow-2xl text-zinc-900 dark:text-white animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-sm font-black uppercase tracking-wider mb-1 text-zinc-800 dark:text-white">
          Unlock Global Currency Profile
        </h2>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold mb-4 leading-normal">
          Select an international ISO profile from our verified directory to calculate cross-rates automatically.
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Select Currency</label>
            <select
              value={selectedIsoCode}
              onChange={(e) => setSelectedIsoCode(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-black text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="">Choose standard ISO Profile...</option>
              {authenticDirectory
                .filter(c => c.code !== activeBaseCurrency)
                .map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))
              }
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Native Symbol</span>
              <span className="text-base font-black text-zinc-800 dark:text-white mt-1 block">{computedMetrics.symbol}</span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">
                Rate (1 {activeBaseCurrency})
              </span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight mt-1 block">
                {computedMetrics.rate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800/40 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black text-zinc-500 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRegisterProfile}
            disabled={!selectedIsoCode}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black text-white transition shadow-sm uppercase cursor-pointer"
          >
            Add Profile
          </button>
        </div>
      </div>
    </div>
  );
}
