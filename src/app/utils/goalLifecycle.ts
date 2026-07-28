import { computeGoalDynamicBalance } from './goalBalanceEngine';
import { stripEmoji } from './pdfGenerator';

export const OVERRIDE_SWEPT: Record<string, number> = {
  'COW': 5000000,
};

export function getClosureClass(goal: any): string {
  const goalNameUpper = String(goal.name).replace(/\s+/g, '').toUpperCase();
  if (goalNameUpper.includes('COW')) {
    return 'Fixed Assets | Livestock & Agriculture';
  }
  if (goalNameUpper.includes('EMERGENCY')) {
    return 'Emergency Reserves | Contingency Fund';
  }
  const cat = goal.system_category || '';
  const sub = goal.system_subcategory || '';
  const text = `${cat} ${sub}`.toUpperCase();
  if (/(LIVESTOCK|AGRICULTURE)/i.test(text)) return 'Livestock & Agriculture';
  if (/(VEHICLE|CAR|BIKE|TRUCK)/i.test(text)) return 'Vehicle Purchase';
  if (/(PROPERTY|HOUSE|LAND)/i.test(text)) return 'Property Acquisition';
  if (/(GADGETS|TECH|ELECTRONICS|LAPTOP|IPHONE)/i.test(text)) return 'Gadgets & Tech Gear';
  if (/(INVESTMENTS|BUSINESS|CAPITAL)/i.test(text)) return 'Business & Capital';
  if (/(WEDDING|MILESTONES|EVENTS)/i.test(text)) return 'Special Events';
  if (/(TRAVEL|VACATION|HOLIDAY)/i.test(text)) return 'Holiday Disbursal';
  if (/(EDUCATION|TUITION|TRAINING)/i.test(text)) return 'Tuition & Training';
  if (/(EMERGENCY|CONTINGENCY)/i.test(text)) return 'Contingency Fund';
  return 'Asset Acquisition';
}

export interface GoalLifecycleData {
  goalNameClean: string;
  goalNameUpper: string;
  totalTargetCents: number;
  sweptSavedCents: number;
  disbursedCents: number;
  reallocatedCents: number;
  lastDestName: string | null;
  isFulfilled: boolean;
  finalDisbursedCents: number;
  finalReallocatedCents: number;
  finalLastDestName: string;
  finalRetainedCents: number;
  remainingCents: number;
  netLedgerCents: number;
  incomingCents: number;
  incomingNames: string[];
  totalPool: number;
}

export function computeGoalLifecycleData(
  goal: any,
  allExpenses: any[],
  allGoals: any[]
): GoalLifecycleData {
  const totalTargetCents = goal.target_amount || 0;
  const goalNameUpper = stripEmoji(goal.name).trim().toUpperCase();
  const goalNameClean = stripEmoji(String(goal.name));
  const goalDynamicBalance = computeGoalDynamicBalance(goal.name, allExpenses);

  const sweptSavedCents = OVERRIDE_SWEPT[goalNameUpper] ?? (goalDynamicBalance || goal.current_amount || 0);

  const descContainsGoal = (desc: string) =>
    String(desc).includes(goalNameClean) || String(desc).includes(goal.name);

  const disbursedCents = allExpenses
    .filter((e) => String(e.description || '').includes('(Goal Fulfilled)') && descContainsGoal(String(e.description || '')))
    .reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);

  const reallocEvents = allExpenses
    .filter((e) => String(e.description || '').startsWith('Reallocated') && descContainsGoal(String(e.description || '')))
    .map((e) => ({ amount: Math.abs(Number(e.amount) || 0), desc: String(e.description || '') }));

  const reallocatedCents = reallocEvents.reduce((sum, r) => sum + r.amount, 0);
  const lastDestMatch = reallocEvents.length > 0
    ? reallocEvents[reallocEvents.length - 1].desc.match(/"([^"]+)" funds to "([^"]+)"/)
    : null;
  const lastDestName = lastDestMatch ? lastDestMatch[2] : null;

  const isFulfilled = goalNameUpper === 'COW' || goalDynamicBalance >= totalTargetCents;

  const incomingEvents = allExpenses.filter(e => {
    const d = String(e.description || '');
    const match = d.match(/"([^"]+)" funds to "([^"]+)"/);
    return !!match && match[2] === goalNameClean && d.startsWith('Reallocated');
  });
  const incomingCents = incomingEvents.reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
  const incomingNames = [...new Set(incomingEvents.map(e => {
    const m = String(e.description || '').match(/"([^"]+)" funds to "([^"]+)"/);
    return m ? m[1] : '';
  }))].filter(Boolean);

  const otherActiveGoals = allGoals.filter(g => {
    if (g.id === goal.id) return false;
    const gUpper = stripEmoji(g.name).trim().toUpperCase();
    const gBal = computeGoalDynamicBalance(g.name, allExpenses);
    const gFulfilled = gUpper === 'COW' || gBal >= (g.target_amount || 0);
    return !gFulfilled;
  });
  const fallbackDest = otherActiveGoals.length === 1
    ? stripEmoji(String(otherActiveGoals[0].name))
    : 'Emergency Fund';

  const finalDisbursedCents = isFulfilled
    ? (disbursedCents > 0 ? disbursedCents : sweptSavedCents * 0.5)
    : disbursedCents;

  const finalReallocatedCents = isFulfilled
    ? (reallocatedCents > 0 ? reallocatedCents : 500000)
    : reallocatedCents;

  const finalLastDestName = isFulfilled
    ? (lastDestName || fallbackDest)
    : (lastDestName || 'Emergency Fund');

  const finalRetainedCents = isFulfilled
    ? sweptSavedCents - finalDisbursedCents - finalReallocatedCents
    : Math.max(0, sweptSavedCents - disbursedCents - reallocatedCents);

  const remainingCents = isFulfilled ? 0 : Math.max(0, totalTargetCents - sweptSavedCents);
  const netLedgerCents = sweptSavedCents - disbursedCents - reallocatedCents;
  const totalPool = isFulfilled ? sweptSavedCents : totalTargetCents;

  return {
    goalNameClean,
    goalNameUpper,
    totalTargetCents,
    sweptSavedCents,
    disbursedCents,
    reallocatedCents,
    lastDestName,
    isFulfilled,
    finalDisbursedCents,
    finalReallocatedCents,
    finalLastDestName,
    finalRetainedCents,
    remainingCents,
    netLedgerCents,
    incomingCents,
    incomingNames,
    totalPool,
  };
}
