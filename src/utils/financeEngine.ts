import { db } from '../db';
import { roundMoney } from '../app/utils/monetary';

// ------------------------------------------------------------
// executeSafeTransactionEdit
// Atomically updates a transaction's amount and propagates the
// delta to any savings goal linked to that transaction.
//
// Schema note: goals are not linked via a foreign key. A goal is
// linked to an expense by the goal's name appearing inside the
// expense description (category === 'Goal Fulfillment'). This
// mirrors how goal-fulfillment expenses are created in
// savingsEngine.markGoalAsSpent and matched in findGoalRelatedEntries.
//
// All amounts are in base-currency cents.
// ------------------------------------------------------------
export async function executeSafeTransactionEdit(
  transactionId: number,
  newAmount: number,
): Promise<void> {
  // 1. Fetch the existing transaction from Dexie.
  const existing = await db.expenses.get(transactionId);
  if (!existing) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  const oldAmount = Number(existing.amount) || 0;

  // 2. Calculate the difference to propagate.
  const diff = newAmount - oldAmount;

  // 3. Open an atomic read/write lock across both affected tables.
  await db.transaction('rw', [db.expenses, db.savings_goals], async () => {
    // 4. Update the transaction record with the new amount.
    await db.expenses.update(transactionId, { amount: newAmount });

    // Nothing to propagate if the amount didn't change.
    if (diff === 0) return;

    // 5. If this transaction is linked to a goal, locate it and
    //    increment its current_amount by the exact calculated diff.
    const goalId = await resolveLinkedGoalId(existing);
    if (goalId == null) return;

    const goal = await db.savings_goals.get(goalId);
    if (!goal) return;

    const updatedAmount = roundMoney((goal.current_amount || 0) + diff);
    await db.savings_goals.update(goalId, { current_amount: updatedAmount });
  });
}

// Resolve the savings goal linked to an expense by matching the
// goal's name against the expense description — the convention used
// when goal-fulfillment expenses are created (see markGoalAsSpent).
// Runs inside the caller's Dexie transaction scope when awaited there.
async function resolveLinkedGoalId(expense: {
  category?: string;
  description?: string;
}): Promise<number | undefined> {
  const description = expense.description || '';
  if (!description) return undefined;

  const goals = await db.savings_goals.toArray();
  const match = goals.find(g => !!g.name && description.includes(g.name));
  return match?.id;
}
