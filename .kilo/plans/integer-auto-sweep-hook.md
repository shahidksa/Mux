# Plan: Integer-Based Auto Sweep Hook & Transaction Race Condition Hardening

## Problem Summary

1. Floating-point evaluation bugs: All monetary values are stored and computed as JavaScript number (float64). Operations like 0.1 + 0.2, Math.round(x * 100) / 100, and cumulative reduce() on dollar amounts produce subtle rounding errors. The monetary.ts utility uses Number.EPSILON hacks and 6-decimal MONEY_PRECISION which do not eliminate the core issue.

2. Asynchronous race conditions: The auto-sweep engine (ExpenseContext.tsx:91-135) runs on a 60-second interval. The engineProcessingRef boolean guard is the only protection, but transferFunds, addExpense, updateExpense, deleteExpense, and allocateManualFunds all perform multi-step read-then-write operations on wallet balances without atomic locking. Concurrent user actions + background sweep can corrupt balances.

## Architecture

Core idea: Convert the entire monetary system from dollars-as-number to cents-as-number (integer math). Extract auto-sweep into a dedicated hook with proper async mutex.

## Step 1: Rewrite monetary.ts for integer cents

- toCents(dollars): Math.round(dollars * 100)
- fromCents(cents): cents / 100
- sumCents(values): integer addition only
- formatMoney(cents, currency): divide by 100 at display time only
- roundMoney becomes identity (integers are exact)
- isNearZero uses epsilon of 1 cent
- convertAndRoundCurrency returns cents
- formatUniversalCurrency takes cents

All DB fields (wallet.balance, expense.amount, budget.limit_amount, savings_goal amounts, transfer.amount) now represent cents.

## Step 2: Create asyncMutex.ts

Promise-based mutex class to serialize all wallet-mutating operations. Not a replacement for Dexie transactions — prevents JS-level read-modify-write interleaving.

## Step 3: Create useAutoSweep.ts hook

Extract the auto-sweep heartbeat from ExpenseContext into a dedicated hook. Uses AsyncMutex to wrap the entire sweep operation. Accepts cents-based parameters.

## Step 4: Harden ExpenseContext.tsx with mutex

Wrap addExpense, updateExpense, deleteExpense, transferFunds, allocateManualFunds, and executeSafeGoalDeletion in AsyncMutex.run(). Each already uses db.transaction for Dexie atomicity; the mutex adds JS-level serialization.

## Step 5: Update savingsEngine.ts to cents

calculateTrueSurplus, executeAutoSweepEngine, allocateManualFunds, executeSafeGoalDeletion — all internal math in cents.

## Step 6: Update constants.ts to cents

DEFAULT_SAFETY_FLOOR: 3600 (was 36), DEFAULT_LOCKED_SAVINGS: 540 (was 5.40), SIMULATED_LEFTOVER_BUDGET: 360 (was 3.60).

## Step 7: Update SettingsContext.tsx

safetyFloor and capitalShield stored as cents. UI inputs show dollars, convert to cents on save.

## Step 8: Update all display components for cents

~25 components/pages updated to accept cents and divide by 100 only at final display boundary via formatMoney.

## Step 9: Update useFinancialMetrics.ts

All calculations in cents. FX conversion: Math.round(cents * rateTo / rateFrom).

## Step 10: Add convertCurrencyCents to currency.ts

## Step 11: Update excelEngine.ts

Read cents from DB, convert to dollars for Excel display.

## Step 12: Data migration

One-time migration on app load: multiply all existing dollar values by 100, set migration flag in settings table.

## Verification

1. .10 + .20 = .30 exactly
2. Auto-sweep + concurrent expense: no balance corruption
3. Transfer during sweep: atomicity preserved
4. Excel export: correct dollar amounts
5. Page refresh: no re-migration
