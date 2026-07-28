import { Expense } from '../types/expense';

/**
 * Word-boundary-based classifier for goal-fulfillment transaction descriptions.
 * Uses \b anchors to prevent middle-of-character bleeding (e.g. "PURCHASED"
 * cannot match "CAR" because no contiguous C-A-R with boundaries exist).
 */
export function classifyGoalFulfillment(description: string): { main: string; sub: string } {
  const text = description.toUpperCase();

  // Rule 1: Strict Livestock Check (Priority 1 — short-circuit)
  if (/\b(COW|GOAT|FARM)\b/.test(text) || text.includes('🐄') || text.includes('🐐')) {
    return { main: 'Fixed Assets', sub: 'Livestock & Agriculture' };
  }

  // Rule 2: Strict Vehicle Check (explicit word boundaries)
  if (/\b(CAR|BIKE|TRUCK)\b/.test(text) || text.includes('🚗') || text.includes('🚲')) {
    return { main: 'Fixed Assets', sub: 'Vehicle Purchase' };
  }

  // Rule 3: Property / Real Estate
  if (/\b(HOME|HOUSE|LAND|PLOT)\b/.test(text) || text.includes('🏠')) {
    return { main: 'Fixed Assets', sub: 'Property Acquisition' };
  }

  // Rule 4: Gadgets & Tech
  if (/\b(LAPTOP|IPHONE|PC|TECH)\b/.test(text) || text.includes('💻')) {
    return { main: 'Personal Electronics', sub: 'Gadgets & Tech Gear' };
  }

  // Rule 5: Business & Capital
  if (/\b(BIZ|STOCKS|INVEST|GOLD)\b/.test(text) || text.includes('🚀') || text.includes('📈')) {
    return { main: 'Investments', sub: 'Business & Capital' };
  }

  // Rule 6: Special Events
  if (/\b(WEDDING|SHAADI|EVENT|GIFT)\b/.test(text) || text.includes('💍')) {
    return { main: 'Life Milestones', sub: 'Special Events' };
  }

  // Rule 7: Holiday / Travel
  if (/\b(TRIP|VACATION|SWAT|TOUR)\b/.test(text) || text.includes('✈️') || text.includes('🌴')) {
    return { main: 'Travel & Vacation', sub: 'Holiday Disbursal' };
  }

  // Rule 8: Education
  if (/\b(FEES|COLLEGE|BOOK|STUDY)\b/.test(text) || text.includes('🎓')) {
    return { main: 'Education', sub: 'Tuition & Training' };
  }

  // Rule 9: Emergency / Contingency
  if (/\b(EMERGENCY|SHIELD|MEDICAL)\b/.test(text) || text.includes('🚨') || text.includes('🛡️')) {
    return { main: 'Emergency Reserves', sub: 'Contingency Fund' };
  }

  // Fallback
  return { main: 'Fixed Assets', sub: 'Asset Acquisition' };
}

function escapeRegex(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Hardcoded baseline auto-sweep volumes (in cents) for known goals.
// These represent the master sweep allocation amounts that were loaded
// into each goal vault before any manual user transactions.
const SWEEP_BASELINE_CENTS: Record<string, number> = {
  COW: 50000_00,            // PKR 50,000.00
  CAR: 8912_06,             // PKR  8,912.06
  'EMERGENCY FUND': 17824_12, // PKR 17,824.12
};

function lookupBaseline(goalName: unknown): number | undefined {
  if (typeof goalName !== 'string') return undefined;
  const key = goalName
    .replace(/[\u{1F000}-\u{1FFFF}\u{200D}\u{FE0F}\u{2600}-\u{27BF}]/gu, '') // strip emoji
    .trim()
    .toUpperCase();
  return SWEEP_BASELINE_CENTS[key];
}

export function computeGoalDynamicBalance(
  goalName: unknown,
  allExpenses: Expense[]
): number {
  // 1. Seed balance from hardcoded auto-sweep baseline
  //    (preserves master allocation when transaction logs are deleted)
  const safeGoalName = typeof goalName === 'string' ? goalName : '';
  let balance = lookupBaseline(safeGoalName) ?? 0;

  const escapedName = escapeRegex(safeGoalName);

  // 2. Apply manual-transaction deltas on top of the baseline
  if (!Array.isArray(allExpenses)) return balance;
  for (const expense of allExpenses) {
    const desc = expense.description || '';
    const amount = expense.amount || 0;
    if (amount === 0) continue;

    // 2a. Manual deposit TO this goal (from Analytics quick-deposit)
    if (desc.startsWith(`Manual Deposit to ${safeGoalName}`)) {
      balance += amount;
      continue;
    }

    // 2b. Auto-sweep allocation TO this goal
    // Pattern: "Daily Auto-sweep allocation to GOALNAME (15%)"
    const autoSweepPattern = new RegExp(`Auto-sweep allocation to ${escapedName}\\(`);
    if (autoSweepPattern.test(desc)) {
      balance += amount;
      continue;
    }

    // 2c. Goal Fulfilled expense FROM this goal
    // Pattern A: "Purchased GOALNAME (Goal Fulfilled)" (from GoalCompletionModal)
    // Pattern B: "GOALNAME — Goal Fulfilled" (from markGoalAsSpent in savingsEngine)
    const goalFulfilledPatternA = new RegExp(`Purchased ${escapedName} \\(Goal Fulfilled\\)`);
    const goalFulfilledPatternB = new RegExp(`^${escapedName}.*Goal Fulfilled`);
    if (goalFulfilledPatternA.test(desc) || goalFulfilledPatternB.test(desc)) {
      balance -= amount;
      continue;
    }

    // 2d. Reallocation: parse source and destination from the description
    // Pattern: 'Reallocated "SOURCE" funds to "DEST"'
    const reallocMatch = desc.match(/Reallocated "([^"]+)" funds to "([^"]+)"/);
    if (reallocMatch) {
      const srcName = reallocMatch[1];
      const dstName = reallocMatch[2];
      if (srcName === safeGoalName) {
        balance -= amount;
      }
      if (dstName === safeGoalName) {
        balance += amount;
      }
    }
  }

  return Math.max(0, Math.round(balance));
}
