// src/tests/financeEngine.test.ts
import { db } from '../db';
import { formatMoney } from '../app/utils/monetary';
import { executeSafeTransactionEdit } from '../utils/financeEngine';

async function runAutoSweepEditTest() {
  console.log('🚀 Initializing Finance Engine Test Scenario...');

  // 1. Reset and seed clean mock database state.
  await db.expenses.clear();
  await db.savings_goals.clear();
  await db.wallets.clear();

  // Create the CAR goal vault (amounts stored in base-currency cents).
  const goalId = await db.savings_goals.add({
    name: '🚗 CAR',
    target_amount: 2500000,   // ₨ 25,000.00
    current_amount: 2500000,  // Goal completely fulfilled
    sweep_ratio: 5,
    created_at: new Date().toISOString(),
  });

  // Wallet required to satisfy ExpenseDb.wallet_id.
  const walletId = await db.wallets.add({
    name: 'CITI',
    type: 'bank',
    balance: 100000000, // ₨ 100,000.00
    currency: 'PKR',
  });

  // Original car expense linked to that goal. Goals are linked by the
  // goal name appearing in the description with category 'Goal Fulfillment'
  // (see savingsEngine.markGoalAsSpent).
  const expenseId = await db.expenses.add({
    amount: 3000000,          // ₨ 30,000.00
    type: 'expense',
    category: 'Goal Fulfillment',
    date: new Date().toISOString().split('T')[0],
    wallet_id: walletId,
    description: 'Purchased 🚗 CAR 🚀 (Goal Fulfilled) ✨',
    created_at: new Date().toISOString(),
  });

  console.log(
    `✅ Mock data seeded. Goal Balance: ${formatMoney(2500000, 'PKR')}. ` +
    `Car Expense: ${formatMoney(3000000, 'PKR')}.`
  );

  // 2. RUN TEST CASE: user increases the car price from ₨ 30,000 to ₨ 35,000.
  const NEW_PRICE_CENTS = 3500000; // ₨ 35,000.00
  console.log(
    `\n🔄 Simulating user update: changing car price to ${formatMoney(NEW_PRICE_CENTS, 'PKR')}...`
  );

  try {
    await executeSafeTransactionEdit(expenseId, NEW_PRICE_CENTS);
    console.log('➡️ Update handler executed successfully.');

    // 3. FETCH AND AUDIT POST-MUTATION BALANCES.
    const updatedExpense = await db.expenses.get(expenseId);
    const updatedGoal = await db.savings_goals.get(goalId);

    console.log('\n📊 --- AUDIT VERIFICATION RESULTS ---');
    console.log(`• Updated Ledger Expense: ${formatMoney(updatedExpense?.amount || 0, 'PKR')}`);
    console.log(`• Updated Goal Vault Balance: ${formatMoney(updatedGoal?.current_amount || 0, 'PKR')}`);

    // Assert absolute ledger integrity.
    const expenseOk = updatedExpense?.amount === NEW_PRICE_CENTS;
    const goalOk = updatedGoal?.current_amount === 3000000; // 2,500,000 + 500,000

    if (expenseOk && goalOk) {
      console.log(
        '\n🎉 TEST PASSED: Database ledger balances match perfectly! ' +
        'The extra ₨ 5,000.00 was successfully added to your goal history.'
      );
    } else {
      console.log('\n❌ TEST FAILED: Discrepancy found. The goal balance did not adapt to the price change.');
    }
  } catch (error: any) {
    console.error('❌ TEST FAILED with error:', error.message);
  }
}

// Execute the test environment loop.
runAutoSweepEditTest();
