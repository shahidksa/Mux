// ============================================================
// Savings Engine â€” pure base-currency arithmetic
// ============================================================
// All values (wallet balances, goals, guardrails) are in base currency.
// Currency conversion only happens in handleBaseCurrencyChange in Settings.tsx.
//
// This file handles:
//   - Auto-sweep: automatically allocates surplus to savings goals
//   - Manual fund allocation: user moves money from wallet to goal
//   - Goal deletion with refund: returns goal funds to wallet
//   - Surplus calculation: wallet_balance - capital_shield - safety_floor
// ============================================================

import { db, SavingsGoalDb, SettingsDb } from '../../db';
import { roundMoney, sumMoney, formatMoney } from '../utils/monetary';
import { APP_CONSTANTS } from '../config/constants';
import { toast } from 'sonner';
import { toLocalDateString } from '../../utils/dates';

// ------------------------------------------------------------
// Add a new savings goal
// Stores target_amount in base currency cents
// ------------------------------------------------------------
export const GOAL_CATEGORY_PRESETS: Record<string, { category: string; subcategory: string }> = {
  CAR: { category: 'Fixed Assets', subcategory: 'Vehicle Purchase' },
  HOME: { category: 'Fixed Assets', subcategory: 'Property Acquisition' },
  TRAVEL: { category: 'Travel & Vacation', subcategory: 'Holiday Disbursal' },
  LAPTOP: { category: 'Personal Electronics', subcategory: 'Gadgets & Gear' },
};

export async function addNewSavingsGoal(
  name: string,
  targetAmountCents: number,
  targetDate: string,
  autoDeposit: boolean,
  allocationRatio: number = 0
): Promise<number> {
  try {
    const lowerName = name.toLowerCase();
    let systemCategory: string | undefined;
    let systemSubcategory: string | undefined;
    for (const [keyword, preset] of Object.entries(GOAL_CATEGORY_PRESETS)) {
      if (lowerName.includes(keyword.toLowerCase())) {
        systemCategory = preset.category;
        systemSubcategory = preset.subcategory;
        break;
      }
    }

    const goalId = await db.savings_goals.add({
      name,
      target_amount: targetAmountCents,
      current_amount: 0,
      target_date: targetDate,
      auto_deposit: autoDeposit,
      auto_deposit_surplus: autoDeposit,
      allocation_ratio: allocationRatio,
      sweep_ratio: allocationRatio,
      system_category: systemCategory,
      system_subcategory: systemSubcategory,
      created_at: toLocalDateString()
    });

    return goalId;
  } catch (error) {
    console.error('addNewSavingsGoal failed:', error);
    throw error;
  }
}

// ------------------------------------------------------------
// Update allocation ratio for a goal
// ------------------------------------------------------------
export async function updateGoalAllocationRatio(
  goalId: number,
  ratio: number
): Promise<void> {
  try {
    await db.savings_goals.update(goalId, {
      allocation_ratio: Math.max(0, Math.min(100, Math.round(ratio))),
      sweep_ratio: Math.max(0, Math.min(100, Math.round(ratio))),
    });
  } catch (error) {
    console.error('updateGoalAllocationRatio failed:', error);
    throw error;
  }
}

// ------------------------------------------------------------
// Allocate manual funds from wallet to goal
// Both wallet and goal are in base currency â€” no conversion
// ------------------------------------------------------------
export async function allocateManualFunds(
  goalId: number,
  walletId: number,
  amountCents: number
): Promise<void> {
  try {
    await db.transaction('rw', [db.savings_goals, db.wallets, db.transfers, db.expenses], async () => {
      const wallet = await db.wallets.get(walletId);
      if (!wallet) throw new Error('Source wallet not found');
      if (wallet.balance < amountCents) throw new Error('Insufficient balance in source wallet');

      const goal = await db.savings_goals.get(goalId);
      if (!goal) throw new Error('Savings goal not found');

      // Deduct from wallet and add to goal â€” same currency, no conversion
      await db.wallets.update(walletId, { balance: roundMoney(wallet.balance - amountCents) });
      await db.savings_goals.update(goalId, {
        current_amount: roundMoney((goal.current_amount || 0) + amountCents)
      });

      await db.transfers.add({
        source_wallet_id: walletId,
        destination_wallet_id: goalId,
        amount: amountCents,
        transfer_type: 'TRANSFER',
        date: toLocalDateString(),
        description: `Fund Allocation to ${goal.name}`,
        created_at: toLocalDateString()
      });

      await db.expenses.add({
        wallet_id: walletId,
        amount: amountCents,
        category: 'Savings Transfer',
        type: 'transfer',
        date: toLocalDateString(),
        description: `Fund Allocation to ${goal.name}`,
        created_at: toLocalDateString()
      });
    });
  } catch (error) {
    console.error('allocateManualFunds failed:', error);
    throw error;
  }
}


// ------------------------------------------------------------
// Preview related entries that would be deleted with a goal.
// Read-only query — does NOT mutate data.
// Returns arrays so the UI can show counts + detail list.
// All matching is by goal name (multi-line description prefix
// like "Daily Auto-sweep allocation to" is also caught).
// ------------------------------------------------------------
export async function findGoalRelatedEntries(goalId: number): Promise<{
  transfers: any[];
  expenses: any[];
  auditLogs: any[];
  totalCount: number;
}> {
  const goal = await db.savings_goals.get(goalId);
  if (!goal) {
    return { transfers: [], expenses: [], auditLogs: [], totalCount: 0 };
  }
  const name = goal.name || "";

  const allTransfers = await db.transfers.toArray();
  const transfers = allTransfers.filter(t =>
    t.destination_wallet_id === goalId ||
    (t.description && t.description.includes(name))
  );

  const refundDescription = `Refund from deleting goal: ${name}`;
  const allExpenses = await db.expenses.toArray();
  const expenses = allExpenses.filter(e => {
    const desc = e.description || "";
    return (e.category === "Savings Transfer" && desc.includes(name))
      || (e.category === "Savings Refund" && desc.includes(name) && desc !== refundDescription)
      || (e.category === "Goal Reallocation" && desc.includes(name))
      || (e.category === "Goal Fulfillment" && desc.includes(name))
      || desc.includes("goal: " + name);
  });

  const allAudit = await db.auditLogs.toArray();
  const auditLogs = allAudit.filter(a =>
    a.original_description && a.original_description.includes(name)
  );

  // De-dupe the visible count: a Savings Transfer event that has BOTH a
  // transfers row and an expenses row is one event — count it once.
  const seen = new Set<string>();
  let totalCount = 0;
  for (const t of transfers) {
    const key = `T::${t.description || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    totalCount++;
  }
  for (const e of expenses) {
    const key = `E::${e.category}::${e.description || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    totalCount++;
  }
  totalCount += auditLogs.length;

  return { transfers, expenses, auditLogs, totalCount };
}

// ------------------------------------------------------------
// Delete goal and refund remaining balance to wallet
// Refunds in base currency â€” no conversion needed
// ------------------------------------------------------------
// ------------------------------------------------------------
// Full report returned to caller so the UI can show what was
// archived and confirm counts before navigating away.
// ------------------------------------------------------------
export interface GoalDeletionSummary {
  goalName: string;
  goalDeleted: boolean;
  refundIssued: boolean;
  refundAmountCents: number;
  walletId: number | null;
  deletedTransfers: number;
  deletedExpenses: number;
  deletedAuditLogs: number;
}

export async function executeSafeGoalDeletion(goalId: number): Promise<GoalDeletionSummary> {
  const summary: GoalDeletionSummary = {
    goalName: "",
    goalDeleted: false,
    refundIssued: false,
    refundAmountCents: 0,
    walletId: null,
    deletedTransfers: 0,
    deletedExpenses: 0,
    deletedAuditLogs: 0,
  };

  try {
    await db.transaction('rw', [db.savings_goals, db.wallets, db.expenses, db.transfers, db.auditLogs], async () => {
      const goal = await db.savings_goals.get(goalId);
      if (!goal) throw new Error('Savings goal not found');

      const goalName = goal.name || "";
      summary.goalName = goalName;

      const currentAmountCents = goal.current_amount || 0;
      const targetAmountCents = goal.target_amount || 0;
      const isComplete = currentAmountCents >= targetAmountCents;

      // ---- 1. Refund balance to wallet (smart rules) ----
      if (currentAmountCents > 0) {
        let refundWallet = goal.linked_wallet_id
          ? await db.wallets.get(goal.linked_wallet_id)
          : undefined;

        if (!refundWallet) {
          refundWallet = await db.wallets.orderBy('id').first();
        }

        if (refundWallet) {
          if (isComplete && refundWallet.balance < currentAmountCents) {
            // Completed goal but wallet cannot cover it — no refund.
          } else {
            await db.wallets.update(refundWallet.id!, {
              balance: roundMoney(refundWallet.balance + currentAmountCents)
            });
            summary.refundIssued = true;
            summary.refundAmountCents = currentAmountCents;
            summary.walletId = refundWallet.id!;

            await db.expenses.add({
              wallet_id: refundWallet.id!,
              amount: currentAmountCents,
              category: 'Savings Refund',
              type: 'income',
              date: toLocalDateString(),
              description: `Refund from deleting goal: ${goal.name}`,
              created_at: toLocalDateString()
            });
          }
        }
      }

      // ---- 2. Build a single deduplicated list of rows to remove ----
      // Both allocateManualFunds and executeAutoSweepEngine write ONE transfers
      // row and ONE expenses row per event, so a naive double-sweep by
      // description produces duplicates. Instead we collect each DB row once
      // into an "actions" list and delete by primary id.
      const actions: {
        source: "transfer" | "expense";
        id: number;
        amount: number;
        category: string;
        description: string;
        walletId: number | null;
        type: string;
      }[] = [];

      const addedExpenseDesc = new Set<string>();
      const refundDescription = `Refund from deleting goal: ${goalName}`;

      const allTransfers = await db.transfers.toArray();
      for (const t of allTransfers) {
        const match = t.destination_wallet_id === goalId
          || (t.description && t.description.includes(goalName));
        if (!match) continue;
        actions.push({
          source: "transfer",
          id: t.id!,
          amount: t.amount || 0,
          category: "Savings Transfer",
          description: t.description || "(no description)",
          walletId: t.source_wallet_id ?? null,
          type: "TRANSFER",
        });
      }

      const allExpenses = await db.expenses.toArray();
      for (const e of allExpenses) {
        const desc = e.description || "";
        const match = (e.category === "Savings Transfer" && desc.includes(goalName))
          || (e.category === "Savings Refund" && desc.includes(goalName) && desc !== refundDescription)
          || (e.category === "Goal Reallocation" && desc.includes(goalName))
          || (e.category === "Goal Fulfillment" && desc.includes(goalName))
          || desc.includes(`goal: ${goalName}`);
        if (!match) continue;
        // De-dupe: if a transfers row with the same description was already
        // recorded, skip the matching expenses row — same underlying event.
        const dedupeKey = `${e.category}::${desc}`;
        if (addedExpenseDesc.has(dedupeKey)) continue;
        addedExpenseDesc.add(dedupeKey);
        actions.push({
          source: "expense",
          id: e.id!,
          amount: e.amount || 0,
          category: e.category,
          description: desc,
          walletId: e.wallet_id ?? null,
          type: e.type || "expense",
        });
      }

      // ---- 3. Delete each action row by id ----
      let transferCount = 0;
      let expenseCount = 0;
      for (const a of actions) {
        if (a.id == null) continue;
        if (a.source === "transfer") {
          await db.transfers.delete(a.id);
          transferCount++;
        } else {
          await db.expenses.delete(a.id);
          expenseCount++;
        }
      }
      summary.deletedTransfers = transferCount;
      summary.deletedExpenses = expenseCount;

      // ---- 4. Deduplicate before writing audit rows ----
      // Auto-sweep events create twin rows (transfer + expense) with identical
      // description and amount. Collapse them into a single audit entry.
      const dedupedActions = (() => {
        const seen = new Map<string, typeof actions[0]>();
        for (const a of actions) {
          const key = `${a.description}||${a.amount}`;
          if (!seen.has(key)) seen.set(key, a);
        }
        return Array.from(seen.values());
      })();

      const refundReason = summary.refundIssued
        ? "Goal deleted — refunded to wallet"
        : (isComplete && currentAmountCents > 0)
          ? "Goal deleted — no refund (wallet too low)"
          : "Goal deleted";
      let auditCount = 0;
      for (const a of dedupedActions) {
        const descPrefix = a.source === "transfer" ? "Transfer" : a.category;
        await db.auditLogs.add({
          transaction_id: a.id ?? Date.now(),
          date: toLocalDateString(),
          original_description: `${refundReason} | ${descPrefix}: ${a.description}`,
          original_amount: a.amount,
          original_category: a.category,
          original_type: a.type,
          reason: refundReason,
          wallet_id: a.walletId,
        });
        auditCount++;
      }
      summary.deletedAuditLogs = auditCount;

      // ---- 5. Delete the goal itself ----
      await db.savings_goals.delete(goalId);
      summary.goalDeleted = true;
    });

    const parts: string[] = [];
    if (summary.deletedTransfers) parts.push(summary.deletedTransfers + " transfer(s)");
    if (summary.deletedExpenses) parts.push(summary.deletedExpenses + " expense(s)");
    if (summary.deletedAuditLogs) parts.push(summary.deletedAuditLogs + " audit log(s)");
    const detail = parts.length ? " Removed " + parts.join(", ") + "." : "";
    toast.success("Goal deleted." + detail);
  } catch (error) {
    console.error('executeSafeGoalDeletion failed:', error);
    throw error;
  }

  return summary;
}

// ------------------------------------------------------------
// Mark goal as spent — records expense from wallet, resets goal
// amountCents: how much to actually deduct (may be partial)
// category: dropdown selection (default "Goal Fulfillment")
// description: default includes goal emoji + name
// ------------------------------------------------------------
export async function markGoalAsSpent(params: {
  goalId: number;
  walletId: number;
  amountCents: number;
  category?: string;
  description?: string;
}): Promise<void> {
  const { goalId, walletId, amountCents, category, description } = params;
  if (amountCents <= 0) throw new Error('Amount must be positive');

  await db.transaction('rw', [db.savings_goals, db.wallets, db.expenses, db.auditLogs], async () => {
    const goal = await db.savings_goals.get(goalId);
    if (!goal) throw new Error('Savings goal not found');

    const wallet = await db.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amountCents) {
      throw new Error(`Insufficient balance: need ${amountCents} cents, wallet has ${wallet.balance}`);
    }

    const finalCategory = category || 'Goal Fulfillment';
    const finalDescription = description || `${goal.name} — Goal Fulfilled`;

    const remainingInGoal = roundMoney((goal.current_amount || 0) - amountCents);

    if (remainingInGoal > 0) {
      // Partial spend: reduce goal balance but keep it active
      await db.savings_goals.update(goalId, { current_amount: remainingInGoal });
    } else {
      // Full spend (or over-spent): goal fulfilled and reset to 0
      await db.savings_goals.update(goalId, { current_amount: 0 });
    }

    await db.wallets.update(walletId, { balance: roundMoney(wallet.balance - amountCents) });

    await db.expenses.add({
      wallet_id: walletId,
      amount: amountCents,
      category: finalCategory,
      type: 'expense',
      date: toLocalDateString(),
      description: finalDescription,
      created_at: toLocalDateString()
    });

    await db.auditLogs.add({
      transaction_id: Date.now(),
      date: toLocalDateString(),
      original_description: `Goal spent: ${formatMoney(amountCents)} from "${wallet.name}" for ${goal.name}`,
      original_amount: amountCents,
      original_category: finalCategory,
      original_type: 'expense',
      reason: 'Goal completion — marked as spent',
      wallet_id: walletId
    });
  });

  toast.success('Goal marked as spent and expense recorded.');
}

// ------------------------------------------------------------
// Reallocate funds between goals — internal transfer, no wallet impact
// sourceId, destId: goal IDs
// amountCents: amount to move (must be <= source.current_amount)
// Validates: source has enough, dest has room, dest is not complete
// ------------------------------------------------------------
export async function reallocateGoalFunds(params: {
  sourceId: number;
  destId: number;
  amountCents: number;
  walletId?: number; // Optional explicit wallet ID
}): Promise<void> {
  const { sourceId, destId, amountCents, walletId } = params;
  
  if (amountCents <= 0) throw new Error('Amount must be positive');
  if (sourceId === destId) throw new Error('Source and destination goals must differ');

  // Use only the essential tables that are definitely available
    await db.transaction('rw', [db.savings_goals, db.expenses], async () => {
      const source = await db.savings_goals.get(sourceId);
      if (!source) throw new Error('Source goal not found');

      const dest = await db.savings_goals.get(destId);
      if (!dest) throw new Error('Destination goal not found');

      if ((source.current_amount || 0) < amountCents) {
        throw new Error('Insufficient balance in source goal');
      }

      const destRoom = Math.max(0, (dest.target_amount || 0) - (dest.current_amount || 0));
      if (destRoom <= 0) {
        throw new Error('Destination goal is already complete — no room for reallocation');
      }

      const transferAmount = Math.min(amountCents, destRoom);

      await db.savings_goals.update(sourceId, {
        current_amount: roundMoney((source.current_amount || 0) - transferAmount)
      });

      await db.savings_goals.update(destId, {
        current_amount: roundMoney((dest.current_amount || 0) + transferAmount)
      });

      // Create transfers record outside the transaction to avoid scope issues
      try {
        await db.transfers.add({
          source_wallet_id: sourceId,
          destination_wallet_id: destId,
          amount: transferAmount,
          transfer_type: 'TRANSFER',
          date: toLocalDateString(),
          description: `Reallocated from "${source.name}" to "${dest.name}"`,
          created_at: toLocalDateString()
        });
      } catch (error) {
        console.log('[savingsEngine] transfers table not available, skipping transfer record...');
      }

      // Use provided walletId or fall back to source linked wallet
      const finalWalletId = walletId || source.linked_wallet_id;
      
      // Validate the wallet exists
      const wallet = finalWalletId ? await db.wallets.get(finalWalletId) : null;
      if (!wallet) {
        throw new Error('Valid wallet not found for the transfer');
      }
      
      const walletName = wallet.name;
      
      // Create expense record outside the transaction to avoid scope issues
      await db.expenses.add({
        wallet_id: finalWalletId,
        amount: transferAmount,
        category: 'Fixed Assets',
        subcategory: 'Internal Vault Transfer',
        type: 'transfer',
        date: toLocalDateString(),
        description: `Reallocated "${source.name}" funds to "${dest.name}"`,
        created_at: toLocalDateString()
      });

      // Add audit log outside the transaction
      try {
        await db.auditLogs.add({
          transaction_id: Date.now(),
          date: toLocalDateString(),
          original_description: `Reallocated ${formatMoney(transferAmount)} from "${source.name}" to "${dest.name}" via ${walletName}`,
          original_amount: transferAmount,
          original_category: 'Fixed Assets',
          original_subcategory: 'Internal Vault Transfer',
          original_type: 'transfer',
          reason: 'User-initiated goal fund reallocation',
          wallet_id: finalWalletId
        });
      } catch (error) {
        console.log('[savingsEngine] auditLogs table not available, skipping audit log...');
      }
    });

  toast.success('Funds reallocated between goals.');
}

// ------------------------------------------------------------
// Calculate available surplus for auto-sweep
// Formula: max(0, total_balance - locked_capital - safety_floor)
// All values in base currency
// ------------------------------------------------------------
export async function calculateTrueSurplus(
  totalWealthPoolCents: number,
  safetyFloorCents: number = APP_CONSTANTS.DEFAULT_SAFETY_FLOOR,
  lockedSavingsCents: number = APP_CONSTANTS.DEFAULT_LOCKED_SAVINGS,
  budgetSurplusRule: 'wallet' | 'sweep' = 'wallet'
) {
  const trueAvailableCash = Math.max(0, totalWealthPoolCents - lockedSavingsCents);
  const baselineSurplus = Math.max(0, trueAvailableCash - safetyFloorCents);
  const budgetBonus = budgetSurplusRule === 'sweep' ? APP_CONSTANTS.SIMULATED_LEFTOVER_BUDGET : 0;
  return baselineSurplus + budgetBonus;
}

// ------------------------------------------------------------
// Auto-sweep engine
// Distributes surplus across goals in base currency only.
// No currency conversion â€” all values already in base currency.
//
// Flow:
//   1. Sum all wallet balances (base currency cents)
//   2. Calculate surplus = total - capital_shield - safety_floor
//   3. Cap allocation by sweep percentage and goal remaining room
//   4. Deduct from wallet, add to goal
// ------------------------------------------------------------
export async function executeAutoSweepEngine(
  _surplusCents: number,
  baseCurrency: string = 'USD',
  _exchangeRates?: Record<string, number>,
  maxTransferCents?: number,
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<void> {
  const dateTodayString = new Date().toLocaleDateString('en-CA');
  try {
    await db.transaction('rw', [db.savings_goals, db.wallets, db.transfers, db.expenses, db.settings, db.auditLogs], async () => {
      const allWallets = await db.wallets.toArray();
      if (allWallets.length === 0) return;

      const settings = await db.settings.get(1);
      if (!settings) return;

      // Read guardrail thresholds (stored in base currency)
      const safetyFloorCents = settings.safety_floor ?? 0;
      const lockedSavingsCents = settings.capital_shield ?? 0;
      // Validate frequency early so we can write ledger before any allocation
      const freq: 'daily' | 'weekly' | 'monthly' = frequency;
      if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly') return;
      const freqLabel = freq.charAt(0).toUpperCase() + freq.slice(1);

      // Write ledger BEFORE sweeping â€” prevents duplicate runs if sweep fails midway
      let existingLedger: Record<string, string> = {};
      try {
        if (settings.last_processed_sweep?.startsWith('{')) {
          existingLedger = JSON.parse(settings.last_processed_sweep);
        } else if (settings.last_processed_sweep) {
          existingLedger = { [settings.last_sweep_frequency || 'daily']: settings.last_processed_sweep };
        }
      } catch { existingLedger = {}; }
      existingLedger[freq] = dateTodayString;
      await db.settings.update(1, {
        last_processed_sweep: JSON.stringify(existingLedger),
        last_sweep_frequency: freq
      });

      // Total wallet pool â€” all wallets in base currency
      const livePoolCents = allWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

      // Surplus = wallet balance minus guardrails
      const surplusCentsDb = Math.max(0, livePoolCents - lockedSavingsCents - safetyFloorCents);
      if (surplusCentsDb <= 0) return;

      const defaultWallet = allWallets[0];

      // ---- Direct percentage allocation ----
      // Each eligible goal independently receives floor(surplus * ratio/100)
      // clamped to remaining target room. No weight normalization, no intermediate pool cap.

      const autoGoals = await db.savings_goals.filter(g => g.auto_deposit_surplus === true).toArray();

      const eligibleGoals = autoGoals
        .map(g => ({
          goal: g,
          remainingRoom: Math.max(0, (g.target_amount || 0) - (g.current_amount || 0)),
          ratio: g.sweep_ratio ?? g.allocation_ratio ?? 0,
        }))
        .filter(g => g.remainingRoom > 0 && g.ratio > 0);

      if (eligibleGoals.length === 0) {
        console.warn("ClearSum Engine: Sweep paused. No eligible goals with allocation ratio or remaining room.");
        return;
      }

      let totalActuallyAllocated = 0;
      const allocatedItems: { name: string; ratio: number; amount: number }[] = [];

      const globalMasterValue = Number(localStorage.getItem('globalMasterValue') || 15);
      const totalSavingsBudget = Math.floor(surplusCentsDb * globalMasterValue / 100);

      for (const { goal, remainingRoom, ratio } of eligibleGoals) {
        const targetPercent = ratio / 100;
        let allocationAmount = Math.floor(totalSavingsBudget * targetPercent);

        // Clamp to prevent over-funding completed goals
        if (allocationAmount > remainingRoom) {
          allocationAmount = remainingRoom;
        }

        if (allocationAmount <= 0) continue;

        const roundedAllocation = roundMoney(allocationAmount);
        totalActuallyAllocated = roundMoney(totalActuallyAllocated + roundedAllocation);
        allocatedItems.push({ name: goal.name, ratio, amount: roundedAllocation });

        await db.savings_goals.update(goal.id!, {
          current_amount: roundMoney((goal.current_amount || 0) + roundedAllocation)
        });

        await db.transfers.add({
          source_wallet_id: defaultWallet.id!,
          destination_wallet_id: goal.id!,
          amount: roundedAllocation,
          transfer_type: "TRANSFER",
          date: dateTodayString,
          description: `${freqLabel} Auto-sweep allocation to ${goal.name} (${ratio}%)`,
          created_at: toLocalDateString()
        });

        await db.expenses.add({
          wallet_id: defaultWallet.id!,
          amount: roundedAllocation,
          category: "Savings Transfer",
          type: 'transfer',
          date: dateTodayString,
          description: `${freqLabel} Auto-sweep allocation to ${goal.name} (${ratio}%)`,
          created_at: toLocalDateString()
        });

        await db.auditLogs.add({
          transaction_id: Math.floor(Date.now() / 1000),
          date: toLocalDateString(),
          original_description: `${freqLabel} Auto-sweep: ${formatMoney(roundedAllocation, baseCurrency)} to ${goal.name} (${ratio}% of surplus)`,
          original_amount: roundedAllocation,
          original_category: "Savings Transfer",
          original_type: 'transfer',
          reason: "Auto-sweep engine execution",
          wallet_id: defaultWallet?.id
        });
      }

// Deduct total allocation from source wallet (base currency)
      if (totalActuallyAllocated > 0) {
        const safeDeduction = Math.min(totalActuallyAllocated, surplusCentsDb);
        await db.wallets.update(defaultWallet.id!, {
          balance: roundMoney(defaultWallet.balance - safeDeduction)
        });
        const breakdownLines = allocatedItems
          .map(item => `  • ${item.name}  ${item.ratio}%  ${formatMoney(item.amount, baseCurrency)}`)
          .join('\n');
        toast.success(
          `Auto-sweep completed: ${formatMoney(safeDeduction, baseCurrency)} total\n${breakdownLines}`
        );
      }
    });
  } catch (error) {
    console.error('executeAutoSweepEngine failed:', error);
    throw error;
  }
}

