# Plan: Seed Value x100 Scaling Bug — Structural Analysis

## Status: READ-ONLY AUDIT (Plan Mode)

---

## 1. Exact Location: Hardcoded Mock Seed Data

**File:** src/seed.ts
**Function:** seedDefaultExpenses() (lines 96–148)
**Trigger:** Called from seedDefaultData() (line 23), which is invoked on DB reset at src/app/context/ExpenseContext.tsx:655 inside esetAllAppData().

The seed injects 3 baseline expense rows at src/seed.ts:107-135:

`	s
// src/seed.ts:110
{ description: 'Monthly Payroll',  amount: toCents(12000),  ... }
// src/seed.ts:119
{ description: 'Car detailing',    amount: toCents(250),    ... }
// src/seed.ts:128
{ description: 'Gifts',            amount: toCents(100),    ... }
`

The 	oCents function at src/app/utils/monetary.ts:13-15:
`	s
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
`

**The math:**
- 	oCents(12000) ? 1,200,000 cents ? displays as ,000.00 (correct)
- 	oCents(250) ? 25,000 cents ? displays as .00 (correct)
- 	oCents(100) ? 10,000 cents ? displays as .00 (correct)

---

## 2. Math Truncation: Why Values Appear 100x Smaller

**Root cause: The seed values ARE correct in the current source code.** The bug is NOT in seed.ts itself.

The observed display values (+.00, -.50, -.00) correspond to **cents values of 12000, 250, and 100** — i.e., the raw dollar amounts stored as if they were already cents.

This means the stored values are exactly 12000, 250, and 100 cents, which render as .00, .50, .00.

**Two possibilities:**

### Possibility A: Stale DB data from before toCents() was added
The user's existing IndexedDB was seeded from an older version of the code where amounts were written as raw dollar values (12000, 250, 100) without 	oCents().

### Possibility B: The version(16) upgrade in db.ts causes double-multiplication
At src/db.ts:684-702, the version 16 upgrade does:
`	s
await tx.table('expenses').toCollection().modify((e: any) => {
  if (e.amount !== undefined) e.amount = Math.round(e.amount * 100);
});
`
This is a legacy migration meant to convert dollar amounts to cents. If seed data was written WITH toCents() (e.g., 1,200,000) and then this upgrade runs again, it would produce 120,000,000 cents (.2M) — not the observed .00.

**The observed values (12000, 250, 100) are consistent with Possibility A only.**

---

## 3. Sweep Cascade: How .00 Baseline Yields -.98

The auto-sweep calculation chain:

### Step 1: Wallet balance after seed (bug case)
- Starting balance: 0
- Income: 12,000 cents (.00)
- Expenses: 250 + 100 = 350 cents (.50)
- Wallet balance: 12,000 - 350 = 11,650 cents (.50)

### Step 2: Safety floor and capital shield
From src/app/context/SettingsContext.tsx:142,155:
- safetyFloor = 3600 cents (.00)
- capitalShield = 540 cents (.40)

### Step 3: Surplus calculation
In savingsEngine.ts:142-152:
`	s
const trueAvailableCash = Math.max(0, totalWealthPoolCents - lockedSavingsCents);
const baselineSurplus = Math.max(0, trueAvailableCash - safetyFloorCents);
`

With bug values:
- livePoolCents = 11,650
- trueAvailableCash = max(0, 11650 - 540) = 11,110
- baselineSurplus = max(0, 11110 - 3600) = 7,510

### Step 4: Sweep percentage
From src/app/context/SettingsContext.tsx:168: sweepPercentage = 5

In useAutoSweep.ts:130-133:
`	s
const cappedSweepCents = Math.min(
  rawSurplusCents,                                    // 7,510
  Math.floor((rawSurplusCents * sweepPercentage) / 100)  // floor(7510 * 5 / 100) = 375
);
`

**Result: 375 cents = .75** — not -.98.

### The -.98 is NEGATIVE — this is NOT from the auto-sweep

The auto-sweep only produces POSITIVE allocations (it moves surplus TO savings). A negative value means the user is OVER-budget or the wallet is below the safety floor.

**The -.98 likely comes from a budget pacing or daily allowance calculation**, not the auto-sweep. Possible sources:
- DashboardPacingWidget
- DashboardHealthWidget
- SpendingVelocityWidget

Without access to those specific widget files, the exact -.98 cannot be traced. However, the key insight is:

**If the wallet balance is .00 (bug) and the safety floor is .00, the surplus is .00 — which is POSITIVE. The -.98 must come from a different calculation that factors in additional expenses or a different time-based decomposition.**

---

## 4. Summary: Lines That Need Fix

### Primary Issue: Stale DB data
The user's existing IndexedDB has seed values that are 100x too small because they were written before 	oCents() was added to the seed function.

### Fix 1: Add a DB migration to re-scale existing seed data
Add a new DB version (18) in src/db.ts that detects and corrects under-scaled seed expenses.

**File:** src/db.ts (after line 662, before the version(17) block)

`	s
this.version(18).stores({
  wallets: '++id, name, type, currency',
  categories: '++id, name, type, parent_id',
  expenses: '++id, wallet_id, date, category, type',
  budgets: '++id, category_name, month_year',
  transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
  settings: 'id',
  savings_goals: '++id, name, target_date, linked_wallet_id',
  currencies: '++id, code, isDefault',
  auditLogs: '++id, date'
}).upgrade(async (tx) => {
  // Re-scale seed expenses that were written without toCents()
  const seedDescriptions = ['Monthly Payroll', 'Car detailing', 'Gifts'];
  const expectedMinAmounts = [1000000, 25000, 10000]; // correct cents values
  const expenses = await tx.table('expenses').toArray();
  for (const e of expenses) {
    const idx = seedDescriptions.indexOf(e.description);
    if (idx !== -1 && e.amount < expectedMinAmounts[idx]) {
      await tx.table('expenses').update(e.id!, { amount: e.amount * 100 });
    }
  }
  // Also fix wallet balance
  const wallets = await tx.table('wallets').toArray();
  for (const w of wallets) {
    if (w.balance < 100000 && w.balance > 0) {
      await tx.table('wallets').update(w.id!, { balance: w.balance * 100 });
    }
  }
});
`

### Fix 2: Move expense seeding into on('populate')
The on('populate') handler at src/db.ts:704 should also seed expenses to ensure fresh DBs always get correct data.

**File:** src/db.ts, lines 704-732

Add after line 729:
`	s
// Also seed default expenses for fresh DBs
const walletCount2 = await tx.table('wallets').count();
if (walletCount2 === 0) {
  await tx.table('wallets').bulkAdd(DEFAULT_WALLETS);
}
const expenseCount = await tx.table('expenses').count();
if (expenseCount === 0) {
  const wallets = await tx.table('wallets').toArray();
  const defaultWallet = wallets[0];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  await tx.table('expenses').bulkAdd([
    { description: 'Monthly Payroll', amount: 1200000, category: 'Salary', date: today, wallet_id: defaultWallet.id!, type: 'income', created_at: now },
    { description: 'Car detailing', amount: 25000, category: 'Transportation', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now },
    { description: 'Gifts', amount: 10000, category: 'Gift', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now }
  ]);
}
`

### Fix 3: Ensure resetAllAppData() fully re-seeds
**File:** src/app/context/ExpenseContext.tsx, lines 639-668

The current implementation clears tables then calls seedDefaultData(). This is correct, but the seedDefaultExpenses() guard at src/seed.ts:100-101 may prevent re-seeding if any expenses exist. After a full clear, this should work. Verify the guard logic.

---

## 5. Files Requiring Changes

| File | Line(s) | Change |
|------|---------|--------|
| src/db.ts | after 662 | Add version 18 upgrade to re-scale existing buggy seed data |
| src/db.ts | 704-732 | Extend on('populate') to also seed expenses with correct cents values |
| src/seed.ts | 110, 119, 128 | Verify 	oCents() is present (it is — confirmed) |
| src/app/context/ExpenseContext.tsx | 639-668 | Verify reset logic fully clears and re-seeds |

---

## 6. Verification Steps

1. Open browser devtools ? Application ? IndexedDB
2. Note the current version of the DB
3. Trigger a DB reset via the app's settings
4. Verify dashboard shows:
   - Monthly Payroll: +,000.00
   - Car detailing: -.00
   - Gifts: -.00
5. Verify auto-sweep calculates positive surplus
6. For users with existing buggy DBs: the version 18 upgrade should auto-correct on first open
