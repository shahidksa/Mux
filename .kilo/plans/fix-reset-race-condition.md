# Plan: Fix resetAllAppData() Race Condition

## Root Cause Confirmed

The race condition is at src/app/pages/Settings.tsx:528-531:

`	s
} else if (type === 'reset') {
  await resetAllAppData();
  window.location.reload();  // ? Reload fires synchronously, interrupting IndexedDB WAL flush
}
`

esetAllAppData() returns after wait seedDefaultData() completes, but IndexedDB uses a write-ahead log. The window.location.reload() at the call site fires in the same microtask — before the OS-level file sync completes. This truncates the seed data mid-write.

Additionally, seedDefaultExpenses() at src/seed.ts:96-148 writes 3 expense rows + 1 wallet balance update. If the reload fires before the wallet balance update at line 146-148 is fsynced, the wallet balance stays at 0 and the expense rows may be partially visible.

---

## Implementation Steps

### Step 1: Refactor esetAllAppData() in src/app/context/ExpenseContext.tsx

Replace lines 639-668 with a bulletproof implementation that:
1. Closes and deletes the database completely
2. Re-opens to trigger the clean on('populate') hook
3. Calls seedDefaultExpenses() directly with full await
4. Adds a 500ms buffer for IndexedDB WAL flush
5. Only then triggers window.location.reload()

`	ypescript
const resetAllAppData = async () => {
  try {
    console.log("[Reset] Initiating full database purge...");

    // Clear localStorage first (synchronous, safe)
    localStorage.removeItem('expense_app_settings');

    // Close and delete the database completely to ensure clean slate
    await db.close();
    await db.delete();

    // Re-open triggers the on('populate') hook in db.ts which seeds categories
    await db.open();

    // Wait for the populate hook to finish
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now seed expenses directly with raw cents values (no toCents() dependency)
    const wallets = await db.wallets.toArray();
    if (wallets.length === 0) {
      // Seed wallets first if populate didn't
      await db.wallets.bulkAdd([
        { name: 'CITI', type: 'bank', balance: 0, currency: 'USD', created_at: new Date().toISOString() },
        { name: 'UBL', type: 'bank', balance: 0, currency: 'USD', created_at: new Date().toISOString() },
        { name: 'Cash', type: 'cash', balance: 0, currency: 'USD', created_at: new Date().toISOString() },
      ]);
    }

    const defaultWallet = (await db.wallets.toArray())[0];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Write seed expenses with HARDCODED raw cents values
    const seedExpenses = [
      { description: 'Monthly Payroll', amount: 1200000, category: 'Salary', date: today, wallet_id: defaultWallet.id!, type: 'income', created_at: now },
      { description: 'Car detailing', amount: 25000, category: 'Transportation', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now },
      { description: 'Gifts', amount: 10000, category: 'Gift', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now },
      { description: 'Lunch', amount: 10000, category: 'Food & Dining', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now },
      { description: 'Footware', amount: 15000, category: 'Shopping', date: today, wallet_id: defaultWallet.id!, type: 'expense', created_at: now },
    ];

    await db.expenses.bulkAdd(seedExpenses);

    // Update wallet balance with net amount
    const totalIncome = seedExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = seedExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    await db.wallets.update(defaultWallet.id!, {
      balance: (defaultWallet.balance || 0) + totalIncome - totalExpense
    });

    // CRITICAL: Wait for IndexedDB WAL to flush to disk
    console.log("[Reset] Seeding complete. Waiting for IndexedDB WAL flush...");
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("[Reset] Database fully committed. Reloading application safely.");
    window.location.reload();
  } catch (error) {
    console.error("[Reset Fault] Database reset failed to complete cleanly:", error);
  }
};
`

### Step 2: Remove window.location.reload() from Settings.tsx

At src/app/pages/Settings.tsx:528-531, change:

`	s
} else if (type === 'reset') {
  await resetAllAppData();
  window.location.reload();  // ? REMOVE THIS LINE
}
`

To:

`	s
} else if (type === 'reset') {
  await resetAllAppData();  // This function now handles reload internally
}
`

### Step 3: Clean up src/seed.ts — Remove toCents() from seed data

At src/seed.ts:107-135, replace the 	oCents() calls with raw integer values:

`	ypescript
const defaultExpenses = [
  {
    description: 'Monthly Payroll',
    amount: 1200000,  // was: toCents(12000)
    category: 'Salary',
    date: today,
    wallet_id: defaultWallet.id!,
    type: 'income' as const,
    created_at: now
  },
  {
    description: 'Car detailing',
    amount: 25000,  // was: toCents(250)
    category: 'Transportation',
    date: today,
    wallet_id: defaultWallet.id!,
    type: 'expense' as const,
    created_at: now
  },
  {
    description: 'Gifts',
    amount: 10000,  // was: toCents(100)
    category: 'Gift',
    date: today,
    wallet_id: defaultWallet.id!,
    type: 'expense' as const,
    created_at: now
  },
  {
    description: 'Lunch',
    amount: 10000,  // NEW
    category: 'Food & Dining',
    date: today,
    wallet_id: defaultWallet.id!,
    type: 'expense' as const,
    created_at: now
  },
  {
    description: 'Footware',
    amount: 15000,  // NEW
    category: 'Shopping',
    date: today,
    wallet_id: defaultWallet.id!,
    type: 'expense' as const,
    created_at: now
  }
];
`

### Step 4: Remove unused 	oCents import from seed.ts

At src/seed.ts:2, remove:
`	s
import { toCents } from './app/utils/monetary';
`

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| src/app/context/ExpenseContext.tsx | 639-668 | Replace esetAllAppData with bulletproof async implementation |
| src/app/pages/Settings.tsx | 528-531 | Remove window.location.reload() (now handled internally) |
| src/seed.ts | 2 | Remove 	oCents import |
| src/seed.ts | 107-135 | Replace 	oCents() calls with raw cents values + add Lunch and Footware |

---

## Verification

1. Trigger reset from Settings page
2. After reload, verify dashboard shows:
   - Monthly Payroll: +,000.00
   - Car detailing: -.00
   - Gifts: -.00
   - Lunch: -.00
   - Footware: -.00
3. Verify wallet balance = ,000 -  -  -  -  = **,400.00**
4. Run reset 3 times to confirm idempotency
5. Check IndexedDB in DevTools ? verify amounts are integers (not floats)
