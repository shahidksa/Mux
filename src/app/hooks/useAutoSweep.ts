import { useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { calculateTrueSurplus, executeAutoSweepEngine } from '../services/savingsEngine';
import { APP_CONSTANTS } from '../config/constants';
import { AsyncMutex } from '../utils/asyncMutex';
import { toLocalDateString } from '../../utils/dates';

let globalForceSweepRef: (() => Promise<void>) | null = null;

export function getGlobalForceSweepRef() {
  return globalForceSweepRef;
}

export function useAutoSweep({
  safetyFloorCents,
  lockedSavingsCents,
  budgetSurplusRule = 'wallet',
  exchangeRates,
  baseCurrency,
  sweepPercentage = 100,
}: {
  safetyFloorCents: number;
  lockedSavingsCents: number;
  budgetSurplusRule?: 'wallet' | 'sweep';
  exchangeRates?: Record<string, number>;
  baseCurrency?: string;
  sweepPercentage?: number;
}) {
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);
  const goals = useLiveQuery(() => db.savings_goals.toArray(), [], []);

  const exchangeRatesRef = useRef(exchangeRates);
  const baseCurrencyRef = useRef(baseCurrency || 'USD');
  const mutexRef = useRef(new AsyncMutex());

  useEffect(() => {
    exchangeRatesRef.current = exchangeRates;
  }, [exchangeRates]);

  useEffect(() => {
    baseCurrencyRef.current = baseCurrency || 'USD';
  }, [baseCurrency]);

  const runSweep = useCallback(async (forceManualRun: boolean) => {
    await mutexRef.current.run(async () => {
      const now = new Date();
      const todayStr = toLocalDateString();

      const freshGoals = await db.savings_goals.toArray();
      const settings = await db.settings.get(1);
      if (!settings) { console.warn('[AutoSweep] No settings found in DB. Skipping sweep until settings are saved.'); return; }

      const activeFreq = settings.sweep_frequency || settings.last_sweep_frequency;
      if (!activeFreq) { console.warn('[AutoSweep] No sweep frequency configured. Skipping sweep.'); return; }

      const freq: 'daily' | 'weekly' | 'monthly' = activeFreq as 'daily' | 'weekly' | 'monthly';
      if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly') return;

      let ledger: Record<string, string> = {};
      try {
        if (settings.last_processed_sweep?.startsWith('{')) {
          ledger = JSON.parse(settings.last_processed_sweep);
        } else if (settings.last_processed_sweep) {
          ledger = { [settings.last_sweep_frequency || 'daily']: settings.last_processed_sweep };
        }
      } catch {
        ledger = {};
      }

      if (!forceManualRun) {
        const lastRunStr = ledger[freq];
        if (lastRunStr) {
          const lastRunDate = new Date(lastRunStr);

          if (freq === 'daily' && lastRunStr === todayStr) {
            console.log("[Guard] Daily sweep already executed today. Halted.");
            return;
          }
          if (freq === 'weekly') {
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            if (now.getTime() - lastRunDate.getTime() < sevenDaysMs) {
              console.log("[Guard] Weekly sweep cooling down. Halted.");
              return;
            }
          }
          if (freq === 'monthly') {
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            if (now.getTime() - lastRunDate.getTime() < thirtyDaysMs) {
              console.log("[Guard] Monthly sweep cooling down (30 days). Halted.");
              return;
            }
          }
        }
      }

      const rates = exchangeRatesRef.current;
      const base = baseCurrencyRef.current;

      const livePoolCents = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

      const trueLiveSurplusCents = await calculateTrueSurplus(
        livePoolCents,
        safetyFloorCents,
        lockedSavingsCents,
        budgetSurplusRule
      );

      const hasAutoDepositGoals = freshGoals.some(
        (g) => g.auto_deposit_surplus === true
      );

      let rawSurplusCents = 0;
      if (trueLiveSurplusCents > 0) {
        rawSurplusCents = trueLiveSurplusCents;
      } else if (hasAutoDepositGoals) {
        rawSurplusCents = Math.max(
          0,
          livePoolCents - lockedSavingsCents - safetyFloorCents
        );
      }

      if (rawSurplusCents <= 0) return;

      if (rawSurplusCents > 0) {
        await executeAutoSweepEngine(rawSurplusCents, base, rates, rawSurplusCents, freq);
      }
    });
  }, [wallets, safetyFloorCents, lockedSavingsCents, budgetSurplusRule, sweepPercentage]);

  const runSweepRef = useRef<(forceManualRun: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    runSweepRef.current = runSweep;
  });

  useEffect(() => {
    globalForceSweepRef = () => runSweepRef.current(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      await runSweepRef.current(false);
    }, APP_CONSTANTS.AUTO_SWEEP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return {};
}