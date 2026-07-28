import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { db } from '../../db';

export const ALLOCATION_KEYS = ['spending', 'savings', 'investments', 'debt', 'charity', 'autoSweepBuffer'] as const;
export type AllocationKey = typeof ALLOCATION_KEYS[number];

const DEFAULT_ALLOCATION: Record<AllocationKey, number> = {
  spending: 50,
  savings: 20,
  investments: 15,
  debt: 10,
  charity: 5,
  autoSweepBuffer: 0,
};

const SAVE_KEY = 'alloc_saved';

interface AllocationContextType {
  allocations: Record<AllocationKey, number>;
  handleSliderAdjustment: (targetKey: AllocationKey, newValue: number) => void;
  totalAllocated: number;
  unallocatedPercent: number;
}

const AllocationContext = createContext<AllocationContextType | undefined>(undefined);

export function AllocationProvider({ children }: { children: ReactNode }) {
  const [allocations, setAllocations] = useState<Record<AllocationKey, number>>(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try { return { ...DEFAULT_ALLOCATION, ...JSON.parse(raw) }; } catch { /* ignore */ }
    }
    return DEFAULT_ALLOCATION;
  });

  const savingRef = useRef(false);

  useEffect(() => {
    db.settings.get(1).then(row => {
      if (row?.allocation_config) {
        try {
          const saved = JSON.parse(row.allocation_config);
          const merged = { ...DEFAULT_ALLOCATION, ...saved };
          setAllocations(merged);
          localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
        } catch { /* ignore */ }
      }
    });
  }, []);

  useEffect(() => {
    if (savingRef.current) return;
    savingRef.current = true;
    const timer = setTimeout(() => {
      const vals = Object.values(allocations) as number[];
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum !== 100) { savingRef.current = false; return; }
      db.settings.get(1).then(existing => {
        if (existing) {
          return db.settings.update(1, { allocation_config: JSON.stringify(allocations) });
        } else {
          return db.settings.put({ id: 1, allocation_config: JSON.stringify(allocations) });
        }
      }).then(() => {
        localStorage.setItem(SAVE_KEY, JSON.stringify(allocations));
        savingRef.current = false;
      }).catch(() => { savingRef.current = false; });
    }, 400);
    return () => { clearTimeout(timer); savingRef.current = false; };
  }, [allocations]);

  const handleSliderAdjustment = (targetKey: AllocationKey, newValue: number) => {
    setAllocations(prev => {
      const activeKeys = Object.keys(prev).filter(k => k !== 'autoSweepBuffer');
      const currentTotalExceptTarget = activeKeys
        .filter(k => k !== targetKey)
        .reduce((sum, key) => sum + (prev[key as AllocationKey] || 0), 0);
      const targetCeiling = 100;
      const remainingSpaceForOthers = targetCeiling - newValue;

      if (currentTotalExceptTarget === 0 && newValue > targetCeiling) return prev;

      const updated = { ...prev, [targetKey]: newValue };

      activeKeys.forEach((key) => {
        if (key !== targetKey) {
          const currentShare = prev[key as AllocationKey] || 0;
          const rebalancedValue = currentTotalExceptTarget > 0
            ? (currentShare / currentTotalExceptTarget) * remainingSpaceForOthers
            : remainingSpaceForOthers / (activeKeys.length - 1);
          updated[key as AllocationKey] = Math.max(0, Math.round(rebalancedValue * 100) / 100);
        }
      });

      const sumActive = activeKeys.reduce((sum, key) => sum + (updated[key as AllocationKey] || 0), 0);
      updated.autoSweepBuffer = Math.max(0, Math.round((100 - sumActive) * 100) / 100);

      return updated;
    });
  };

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);
  const unallocatedPercent = Number(allocations.autoSweepBuffer) || 0;

  return (
    <AllocationContext.Provider value={{ allocations, handleSliderAdjustment, totalAllocated, unallocatedPercent }}>
      {children}
    </AllocationContext.Provider>
  );
}

export function useAllocation() {
  const ctx = useContext(AllocationContext);
  if (!ctx) throw new Error('useAllocation must be used within AllocationProvider');
  return ctx;
}
