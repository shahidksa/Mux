import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expense } from '../types/expense';
import { Wallet, Category } from '../types/wallet';
import { Budget } from '../types/budget';
import { Transfer } from '../types/transfer';
import { db, WalletDb, CategoryDb, ExpenseDb, BudgetDb, TransferDb, SavingsGoalDb, createWallet } from '../../db';
import { toLocalDateString } from '../../utils/dates';

// Constants for automated calculations
const CHECKING_WALLET_ID = 1; // Assuming wallet ID 1 is the main checking account
import { seedDefaultData, seedCategoriesOnly } from '../../seed';
import { DEFAULT_EXCHANGE_RATES, convertCurrency } from '../utils/currency';
import { executeAutoSweepEngine, calculateTrueSurplus } from '../services/savingsEngine';
import { roundMoney, toCents } from '../utils/monetary';
import { APP_CONSTANTS } from '../config/constants';
import { AsyncMutex } from '../utils/asyncMutex';
import { useAutoSweep } from '../hooks/useAutoSweep';

interface ExpenseContextType {
  expenses: Expense[];
  wallets: Wallet[];
  categories: Category[];
  budgets: Budget[];
  transfers: Transfer[];
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id'>, walletId: number) => Promise<void>;
  updateExpense: (id: number, expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: number, reason?: string) => Promise<void>;
  addWallet: (wallet: Omit<Wallet, 'id'>) => Promise<void>;
  updateWallet: (id: number, wallet: Partial<Wallet>) => Promise<void>;
  deleteWallet: (id: number, onDeleted?: (wallet: Wallet, undo: () => void) => void) => Promise<void>;
  undoDeleteWallet: () => void;
  addCategory: (name: string, type?: 'expense' | 'income' | 'both') => Promise<void>;
  updateCategory: (id: number, name: string, type?: 'expense' | 'income' | 'both') => Promise<void>;
  deleteCategory: (id: number, onDeleted?: (category: Category, undo: () => void) => void) => Promise<void>;
  undoDeleteCategory: () => void;
  addBudget: (categoryName: string, limitAmount: number) => Promise<void>;
  updateBudget: (id: number, limitAmount: number) => Promise<void>;
  deleteBudget: (id: number) => Promise<void>;
  transferFunds: (fromWalletId: number, toWalletId: number, amount: number) => Promise<void>;
  addTransfer: (transfer: any) => void;
  refreshWallets: () => Promise<void>;
  resetAllAppData: () => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export function ExpenseProvider({
  children,
  safetyFloor,
  lockedSavings,
  budgetSurplusRule = 'wallet',
  exchangeRates,
  baseCurrency,
  sweepPercentage = 100,
  sweepFrequency = 'daily',
}: {
  children: React.ReactNode;
  safetyFloor: number;
  lockedSavings: number;
  budgetSurplusRule?: 'wallet' | 'sweep';
  exchangeRates?: Record<string, number>;
  baseCurrency?: string;
  sweepPercentage?: number;
  sweepFrequency?: 'daily' | 'weekly' | 'monthly';
}) {
  const [loading, setLoading] = useState(true);
  const [transferState, setTransferState] = useState<Transfer[]>([]);

  const [deletedWallet, setDeletedWallet] = useState<WalletDb | null>(null);

  const exchangeRatesRef = useRef(exchangeRates || DEFAULT_EXCHANGE_RATES);
  const baseCurrencyRef = useRef(baseCurrency || 'USD');
  const mutexRef = useRef(new AsyncMutex());

  useEffect(() => {
    exchangeRatesRef.current = exchangeRates || DEFAULT_EXCHANGE_RATES;
  }, [exchangeRates]);

  useEffect(() => {
    baseCurrencyRef.current = baseCurrency || 'USD';
  }, [baseCurrency]);

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);
  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const expenses = useLiveQuery(() => db.expenses.toArray(), [], []);
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), [], []);
  const goals = useLiveQuery(() => db.savings_goals.toArray(), [], []);

  const categoryUndoCacheRef = useRef<{ id: number; name: string; icon: string; type?: string; created_at?: string } | null>(null);
  const categoryUndoWalletSnapshotsRef = useRef<{ id: number; balance: number }[]>([]);
  const categoryUndoLinkedExpensesRef = useRef<any[]>([]);
  const categoryUndoLinkedBudgetsRef = useRef<any[]>([]);
  const categoryUndoSubcategoriesRef = useRef<{ id: number; name: string; icon: string; type?: string; parent_id?: number | null; created_at?: string }[]>([]);

  useAutoSweep({
    safetyFloorCents: safetyFloor,
    lockedSavingsCents: lockedSavings,
    budgetSurplusRule,
    exchangeRates,
    baseCurrency,
    sweepPercentage,
  });

  useEffect(() => {
    async function init() {
      try {
         await db.open();

         const allGoals = await db.savings_goals.toArray();
         for (const goal of allGoals) {
           const target = goal.target_amount || 0;
           if ((goal.current_amount || 0) > target) {
              await db.auditLogs.add({
                transaction_id: Math.floor(Date.now() / 1000),
                date: toLocalDateString(),
               original_description: `Goal "${goal.name}" capped from ${goal.current_amount || 0} to ${target}`,
               original_amount: goal.current_amount || 0,
               original_category: 'Savings Goal',
               original_type: 'SYSTEM',
               reason: 'Goal cap repair on init',
               wallet_id: goal.linked_wallet_id
             });
           }
         }

         setLoading(false);
       } catch (error) {
         console.error('[DB Init] Failed to initialize database:', error);
         setLoading(false);
       }

       try {
         const existingSettings = await db.settings.get(1);
         if (!existingSettings) {
           await db.settings.put({
             id: 1,
             safety_floor: 0,
             capital_shield: 0,
             sweep_allocation_ratio: 100,
              sweep_frequency: '',
             guardrails_initialized: true,
           });
         }
       } catch (error) {
         console.error('[DB Init] Failed to initialize settings:', error);
       }
     }
     init();
   }, []);

  const getFxRate = useCallback((currency: string): number => {
    return (exchangeRatesRef.current || DEFAULT_EXCHANGE_RATES)[currency] || 1;
  }, []);

   const addExpense = async (expense: Omit<Expense, 'id'>, walletId: number) => {
    await mutexRef.current.run(async () => {
      try {
        const wallet = await db.wallets.get(walletId);
        if (!wallet) throw new Error('Wallet not found');

        const amountCents = expense.amount;

        if (expense.type !== 'income' && wallet.balance < amountCents) {
          throw new Error('Insufficient balance');
        }

        await db.transaction('rw', db.expenses, db.wallets, async () => {
          const { id, ...cleanExpense } = {
            description: expense.description,
            amount: amountCents,
            category: expense.category,
            subcategory: expense.subcategory || null,
            date: expense.date,
            receiptImage: expense.receiptImage || null,
            wallet_id: walletId,
            type: expense.type || 'expense',
            created_at: new Date().toISOString()
          };

          // Update wallet balance — all values in base currency, no conversion
          // Income adds to balance, expense subtracts from balance
          // TRANSFER type (internal vault movements) skips wallet balance updates
          await db.expenses.add(cleanExpense);
          if (String(expense.type).toLowerCase() === 'income') {
            await db.wallets.update(walletId, { balance: wallet.balance + amountCents });
          } else if (String(expense.type).toLowerCase() !== 'transfer') {
            await db.wallets.update(walletId, { balance: wallet.balance - amountCents });
          }
        });
        console.log('Transaction added successfully for wallet:', walletId);
      } catch (error) {
        console.error('Dexie Write Failure in addExpense:', error);
        if (error instanceof Error) {
          if (error.name === 'ConstraintError') {
            throw new Error('Database constraint violation');
          }
          if (error.name === 'TransactionInactiveError') {
            throw new Error('Database transaction failed');
          }
        }
        throw error;
      }
    });
  };

  // Specialized function to update goal-generated transactions without foreign key constraints
  const updateGoalGeneratedTransaction = async (id: number, expense: Omit<Expense, 'id'>) => {
    await db.transaction('rw', [db.expenses], async () => {
      try {
        // Use direct table access to bypass validation
        const expenseTable = db.expenses;
        const expenseCollection = expenseTable.where('id').equals(id);
        
        // Get the current record
        const current = await expenseCollection.first();
        if (!current) {
          throw new Error('Expense not found');
        }
        
        // Create a minimal update object that only includes the fields we want to modify
        const updateData: Partial<Expense> = {};
        
        // Only update the fields that are safe to modify for goal transactions
        if (expense.description !== undefined) updateData.description = expense.description;
        if (expense.category !== undefined) updateData.category = expense.category;
        if (expense.subcategory !== undefined) updateData.subcategory = expense.subcategory || null;
        if (expense.date !== undefined) updateData.date = expense.date;
        if (expense.receiptImage !== undefined) updateData.receiptImage = expense.receiptImage;
        if (expense.wallet_id !== undefined) updateData.wallet_id = expense.wallet_id;
        if (expense.type !== undefined) updateData.type = expense.type;
        
        // Use the raw update method to bypass foreign key validation
        await expenseTable.update(id, updateData);
        
        console.log('Goal-generated transaction updated successfully:', id);
      } catch (error) {
        console.error('Goal transaction update failed:', error);
        throw error;
      }
    });
  };

  const updateExpense = async (id: number, expense: Omit<Expense, 'id'>) => {
    await mutexRef.current.run(async () => {
      try {
        const oldExpense = await db.expenses.get(id);
        if (!oldExpense) return;

        // Check if this is a savings transfer transaction that needs special handling
        const isSavingsTransfer = oldExpense.category === 'Fixed Assets' && 
                                 oldExpense.description && 
                                 oldExpense.description.includes('Reallocated') && 
                                 String(oldExpense.type).toLowerCase() === 'transfer';
        
        // Check if this is a goal-generated transaction (has "Goal Fulfillment" category)
        const isGoalGenerated = oldExpense.category === 'Goal Fulfillment';
        
        // Check if this is a Goal Fulfilled Asset Disbursal transaction
        const isAssetDisbursal = oldExpense.category === 'Fixed Assets' && 
                                oldExpense.description && 
                                oldExpense.description.includes('(Goal Fulfilled)');
        
        const oldWallet = await db.wallets.get(oldExpense.wallet_id);
        const newWallet = expense.wallet_id ? await db.wallets.get(expense.wallet_id) : oldWallet;
        
        // Prepare the update payload - for goal-generated transactions, bypass category validation
        const { id: _, ...cleanExpense } = {
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          subcategory: expense.subcategory || null,
          date: expense.date,
          receiptImage: expense.receiptImage || null,
          wallet_id: expense.wallet_id,
          type: expense.type || 'expense',
          created_at: oldExpense.created_at
        };

        // For Goal Fulfilled Asset Disbursal transactions, handle the mutation manually
        if (isAssetDisbursal) {
          console.log('[ExpenseContext] Processing Asset Disbursal update:', oldExpense);
          
          // Calculate the delta
          const oldAmount = oldExpense.amount;
          const newAmount = expense.amount;
          const delta = newAmount - oldAmount;
          
          console.log(`[ExpenseContext] Asset Disbursal delta: ${delta} (old: ${oldAmount}, new: ${newAmount})`);
          
          // Parse goal name from description to find the linked goal
          const descriptionMatch = cleanExpense.description.match(/\(([^)]+)\)/);
          if (descriptionMatch && descriptionMatch.length >= 2) {
            const goalName = descriptionMatch[1]; // Extract goal name from "(Goal Fulfilled)"
            
            // Find the goals in the database
            const allGoals = await db.savings_goals.toArray();
            const linkedGoal = allGoals.find(g => g.name === goalName);
            
            if (linkedGoal) {
              // Execute atomic transaction — include wallet, goals, and expenses in scope
              await db.transaction('rw', [db.wallets, db.savings_goals, db.expenses], async () => {
                // Find the active checking wallet
                const checkingWallet = await db.wallets.get(CHECKING_WALLET_ID);
                if (!checkingWallet) {
                  throw new Error('Active checking wallet not found');
                }
                
                // Update the expense amount
                await db.expenses.update(id, cleanExpense);
                
                // Handle wallet balance adjustment
                if (delta > 0) {
                  // If increasing the asset purchase, deduct extra from checking wallet
                  await db.wallets.update(checkingWallet.id, {
                    balance: checkingWallet.balance - delta
                  });
                } else if (delta < 0) {
                  // If decreasing the asset purchase, add back to checking wallet
                  await db.wallets.update(checkingWallet.id, {
                    balance: checkingWallet.balance + Math.abs(delta)
                  });
                }
                
                // Handle goal current_amount adjustment
                if (delta > 0) {
                  // If increasing the asset purchase, deduct extra from goal
                  await db.savings_goals.update(linkedGoal.id, {
                    current_amount: (linkedGoal.current_amount || 0) - delta
                  });
                } else if (delta < 0) {
                  // If decreasing the asset purchase, add back to goal
                  await db.savings_goals.update(linkedGoal.id, {
                    current_amount: (linkedGoal.current_amount || 0) + Math.abs(delta)
                  });
                }
                
                console.log(`[ExpenseContext] Asset Disbursal updated successfully:`);
                console.log(`  Checking wallet balance adjusted by: ${delta > 0 ? '-' : '+'}${Math.abs(delta)}`);
                console.log(`  Goal "${goalName}" current_amount adjusted by: ${delta > 0 ? '-' : '+'}${Math.abs(delta)}`);
              });
            } else {
              throw new Error(`Linked goal "${goalName}" not found for asset disbursal update`);
            }
          } else {
            throw new Error('Could not parse goal name from asset disbursal description');
          }
        } 
        // For savings transfer transactions, handle the mutation manually
        else if (isSavingsTransfer) {
          console.log('[ExpenseContext] Processing savings transfer update:', oldExpense);
          
          // Calculate the delta
          const oldAmount = oldExpense.amount;
          const newAmount = expense.amount;
          const delta = newAmount - oldAmount;
          
          console.log(`[ExpenseContext] Savings transfer delta: ${delta} (old: ${oldAmount}, new: ${newAmount})`);
          
          // Parse source and destination goal names from description
          const descriptionMatch = cleanExpense.description.match(/Reallocated "([^"]+)" funds to "([^"]+)" 🔄/);
          if (descriptionMatch && descriptionMatch.length >= 3) {
            const sourceGoalName = descriptionMatch[1];
            const destGoalName = descriptionMatch[2];
            
            // Find the goals in the database
            const allGoals = await db.savings_goals.toArray();
            const sourceGoal = allGoals.find(g => g.name === sourceGoalName);
            const destGoal = allGoals.find(g => g.name === destGoalName);
            
            if (sourceGoal && destGoal) {
              // Check if source goal has sufficient funds for the delta
              if (delta > 0 && sourceGoal.current_amount < delta) {
                throw new Error('Insufficient funds in the source vault to expand this reallocation.');
              }
              
              // Execute atomic transaction — include BOTH tables in scope
              await db.transaction('rw', [db.savings_goals, db.expenses], async () => {
                // Update the expense amount
                await db.expenses.update(id, cleanExpense);
                
                // Update goal balances
                const sourceNewAmount = (sourceGoal.current_amount || 0) - delta;
                const destNewAmount = (destGoal.current_amount || 0) + delta;
                
                await db.savings_goals.update(sourceGoal.id!, { current_amount: sourceNewAmount });
                await db.savings_goals.update(destGoal.id!, { current_amount: destNewAmount });
                
                console.log(`[ExpenseContext] Savings transfer updated successfully:`);
                console.log(`  ${sourceGoalName}: ${sourceGoal.current_amount || 0} -> ${sourceNewAmount}`);
                console.log(`  ${destGoalName}: ${destGoal.current_amount || 0} -> ${destNewAmount}`);
              });
            } else {
              throw new Error('Could not find goals for savings transfer update');
            }
          } else {
            throw new Error('Could not parse savings transfer description');
          }
        } 
        // For goal-generated transactions, use specialized update function
        else if (isGoalGenerated) {
          await updateGoalGeneratedTransaction(id, cleanExpense);
        } else {
          // Normal update for non-goal transactions
          await db.expenses.update(id, cleanExpense);
        }

        // Handle wallet balance updates only for non-goal, non-savings-transfer transactions
        if (!isGoalGenerated && !isSavingsTransfer) {
          const oldEffect = (String(oldExpense.type).toLowerCase() === 'income' ? 1 : -1) * oldExpense.amount;
          const newEffect = (String(expense.type).toLowerCase() === 'income' ? 1 : -1) * expense.amount;

          if (oldExpense.wallet_id !== expense.wallet_id) {
            if (oldWallet && newWallet) {
              await db.wallets.update(oldExpense.wallet_id, { balance: oldWallet.balance - oldEffect });
              await db.wallets.update(expense.wallet_id, { balance: newWallet.balance + newEffect });
            }
          } else {
            if (oldWallet) {
              const diff = newEffect - oldEffect;
              await db.wallets.update(oldExpense.wallet_id, { balance: oldWallet.balance + diff });
            }
          }
        }
        
        console.log('Transaction updated successfully:', id);
      } catch (error) {
        console.error('Dexie Update Failure in updateExpense:', error);
        if (error instanceof Error) {
          if (error.name === 'ConstraintError') {
            throw new Error('Database constraint violation - unable to update goal-generated transaction. Category changes are restricted for automatic savings goal payouts.');
          }
          if (error.name === 'NotFoundError') {
            throw new Error('Expense not found');
          }
          throw new Error(`Failed to update transaction: ${error.message}`);
        }
        throw error;
      }
    });
  };

  const deleteExpense = async (id: number, reason?: string) => {
    await mutexRef.current.run(async () => {
      try {
        const expense = await db.expenses.get(id);
        if (!expense) return;

        // Check if this is a savings transfer transaction
        const isSavingsTransfer = expense.category === 'Fixed Assets' && 
                                 expense.description && 
                                 expense.description.includes('Reallocated') && 
                                 String(expense.type).toLowerCase() === 'transfer';

        // Check if this is a Goal Fulfilled Asset Disbursal transaction
        const isAssetDisbursal = expense.category === 'Fixed Assets' && 
                                expense.description && 
                                expense.description.includes('(Goal Fulfilled)');

        // Handle Goal Fulfilled Asset Disbursal deletion — the database hook will reverse wallet/goal
        if (isAssetDisbursal) {
          console.log('[ExpenseContext] Processing Asset Disbursal deletion:', expense);
          await db.expenses.delete(id);
        }
        // Handle savings transfers normally (database hook reverses the reallocation)
        else if (isSavingsTransfer) {
          await db.expenses.delete(id);
        }
        // Handle other transactions normally
        else if (expense.wallet_id) {
          const wallet = await db.wallets.get(expense.wallet_id);
          if (wallet) {
            const balanceDelta = String(expense.type).toLowerCase() === 'income' ? -expense.amount : expense.amount;
            await db.wallets.update(expense.wallet_id, { balance: wallet.balance + balanceDelta });
          }
          await db.expenses.delete(id);
        } else {
          await db.expenses.delete(id);
        }

        await db.auditLogs.add({
          transaction_id: id,
          date: toLocalDateString(),
          original_description: expense.description,
          original_amount: expense.amount,
          original_category: expense.category,
          original_subcategory: expense.subcategory,
          original_type: expense.type,
          reason: reason || '',
          wallet_id: expense.wallet_id
        });

        console.log('Transaction deleted successfully:', id);
      } catch (error) {
        console.error('Dexie Delete Failure in deleteExpense:', error);
        if (error instanceof Error) {
          if (error.name === 'NotFoundError') {
            throw new Error('Expense not found');
          }
        }
        throw error;
      }
    });
  };

  const addWallet = async (wallet: Omit<Wallet, 'id'>) => {
    try {
      const balanceCents = toCents(wallet.balance);
      const walletWithCents = { ...wallet, balance: balanceCents };
      const generatedId = await createWallet(walletWithCents);
      if (!generatedId) throw new Error('Wallet creation returned no ID');

      if (balanceCents > 0) {
        await db.expenses.add({
          amount: balanceCents,
          description: 'Wallet Initialization Setup',
          category: 'Starting Balance',
          date: toLocalDateString(),
          wallet_id: generatedId,
          type: 'income',
          receiptImage: null,
        });
        console.log('Initial balance transaction created for wallet ID:', generatedId);
      }
    } catch (error) {
      console.error('Dexie Write Failure in addWallet:', error);
      if (error instanceof Error) {
        if (error.name === 'ConstraintError') {
          throw new Error('Wallet name must be unique');
        }
      }
      throw error;
    }
  };

  const updateWallet = async (id: number, wallet: Partial<Wallet>) => {
    try {
      const { id: _, ...cleanWallet } = wallet;
      await db.wallets.update(id, cleanWallet);
      console.log('Wallet updated successfully:', id);
    } catch (error) {
      console.error('Dexie Update Failure in updateWallet:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error('Wallet not found');
        }
      }
      throw error;
    }
  };

  const deleteWallet = async (id: number, onDeleted?: (wallet: Wallet, undo: () => void) => void) => {
    try {
      const walletToDelete = await db.wallets.get(id);
      if (!walletToDelete) return;

      if (Math.abs(walletToDelete.balance) >= 1) {
        throw new Error('Cannot delete wallet with active balance');
      }

      // Store the snapshot in state for UI access (e.g. toast display)
      setDeletedWallet(walletToDelete);

      await db.expenses.where('wallet_id').equals(id).delete();
      await db.wallets.delete(id);

      // FIX: Use `walletToDelete` (local variable) instead of `deletedWallet` (state).
      // React state updates are async — the closure would capture the stale pre-update
      // value of `deletedWallet` if read from state here.
      const undo = async () => {
        const { id: _, ...cleanWallet } = walletToDelete;
        await db.wallets.put({ ...cleanWallet, id });
        setDeletedWallet(null);
      };

      if (onDeleted) {
        onDeleted({ ...walletToDelete, id: walletToDelete.id! } as Wallet, undo);
      }
    } catch (error) {
      console.error('Dexie Delete Failure in deleteWallet:', error);
      if (error instanceof Error) {
        if (error.name === 'ConstraintError') {
          throw new Error('Cannot delete wallet due to foreign key constraint');
        }
        if (error.name === 'NotFoundError') {
          throw new Error('Wallet not found');
        }
      }
      throw error;
    }
  };

  const undoDeleteWallet = () => {
    setDeletedWallet(null);
  };

  const addCategory = useCallback(async (name: string, type: 'expense' | 'income' | 'both' = 'expense', icon: string = 'HelpCircle', parentId?: number | null) => {
    try {
      let finalIcon = icon;
      
      // If creating a subcategory and no icon is provided, fallback to parent category's icon
      if (parentId !== undefined && parentId !== null && (!icon || icon === 'HelpCircle' || icon === '')) {
        const parentCategory = await db.categories.get(parentId);
        if (parentCategory && parentCategory.icon) {
          finalIcon = parentCategory.icon;
        }
      }
      
      const newCategory = {
        name: name.trim(),
        icon: finalIcon,
        type: type,
        parent_id: parentId ?? null,
        created_at: new Date().toISOString()
      };

      const generatedId = await db.categories.add(newCategory);
      console.log('Successfully saved category to database with ID:', generatedId);
    } catch (error) {
      console.error('Dexie Write Failure in addCategory:', error);
      if (error instanceof Error) {
        if (error.name === 'ConstraintError') {
          throw new Error('Category name must be unique');
        }
      }
    }
  }, []);

  const updateCategory = useCallback(async (id: number, name: string, type?: 'expense' | 'income' | 'both') => {
    try {
      const updates: Partial<CategoryDb> = { name };
      if (type) updates.type = type;
      await db.categories.update(id, updates);
      console.log('Category updated successfully:', id);
    } catch (error) {
      console.error('Dexie Update Failure in updateCategory:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error('Category not found');
        }
      }
      throw error;
    }
  }, []);

  const getOrCreateGlobalUncategorized = useCallback(async (): Promise<CategoryDb> => {
    let existing = await db.categories.where('name').equals('Uncategorized').toArray();
    let uncat = existing.find(c => c.parent_id == null);
    if (!uncat) {
      const newId = await db.categories.add({
        name: 'Uncategorized',
        icon: 'HelpCircle',
        type: 'both',
        parent_id: null,
        created_at: new Date().toISOString()
      });
      uncat = { id: newId, name: 'Uncategorized', icon: 'HelpCircle', type: 'both', parent_id: null };
    }
    return uncat;
  }, []);

  const deleteCategory = useCallback(async (id: number, onDeleted?: (category: Category, undo: () => void) => void) => {
    try {
      const categoryToDelete = await db.categories.get(id);

      if (!categoryToDelete) {
        console.error("Category target not found for deletion");
        return;
      }

      const isSubcategory = categoryToDelete.parent_id != null;
      let categoriesToDelete: CategoryDb[] = [categoryToDelete];
      let allAffectedNames: string[] = [categoryToDelete.name];

      if (!isSubcategory) {
        const subCats = await db.categories.where('parent_id').equals(id).toArray();
        categoriesToDelete.push(...subCats);
        for (const sub of subCats) {
          allAffectedNames.push(sub.name);
        }
      }

      const linkedExpenses = await db.expenses
        .where('category')
        .anyOf(allAffectedNames)
        .toArray();

      const linkedBudgets = await db.budgets
        .where('category_name')
        .anyOf(allAffectedNames)
        .toArray();

      categoryUndoCacheRef.current = { ...categoryToDelete };
      categoryUndoLinkedExpensesRef.current = [...linkedExpenses];
      categoryUndoWalletSnapshotsRef.current = [];
      categoryUndoLinkedBudgetsRef.current = [...linkedBudgets];

      const subcategorySnapshots = !isSubcategory
        ? categoriesToDelete.slice(1).map(c => ({ id: c.id!, name: c.name, icon: c.icon, type: c.type, parent_id: c.parent_id, created_at: c.created_at }))
        : [];
      categoryUndoSubcategoriesRef.current = subcategorySnapshots;

      await db.transaction('rw', db.expenses, db.categories, db.budgets, async () => {
        const uncat = await getOrCreateGlobalUncategorized();

        for (const expense of linkedExpenses) {
          await db.expenses.update(expense.id!, { category: uncat.name, subcategory: null });
        }

        for (const name of allAffectedNames) {
          await db.budgets.where('category_name').equals(name).delete();
        }

        for (const cat of categoriesToDelete) {
          await db.categories.delete(cat.id!);
        }
      });

      console.log("Successfully removed category,", linkedExpenses.length, "linked expenses reassigned to Uncategorized,", linkedBudgets.length, "budgets deleted.");

      const undo = async () => {
        try {
          if (!categoryUndoCacheRef.current || !categoryUndoCacheRef.current.id) {
            console.warn("Undo triggered but no valid cached category snapshot found.");
            return;
          }

          await db.transaction('rw', db.expenses, db.wallets, db.categories, db.budgets, async () => {
            await db.categories.put(categoryUndoCacheRef.current!);

            for (const sub of categoryUndoSubcategoriesRef.current) {
              await db.categories.put(sub);
            }

            if (categoryUndoLinkedExpensesRef.current.length > 0) {
              for (const expense of categoryUndoLinkedExpensesRef.current) {
                await db.expenses.update(expense.id!, { category: expense.category, subcategory: expense.subcategory || null });
              }
            }

            if (categoryUndoLinkedBudgetsRef.current.length > 0) {
              await db.budgets.bulkAdd(categoryUndoLinkedBudgetsRef.current);
            }
          });

          categoryUndoCacheRef.current = null;
          categoryUndoLinkedExpensesRef.current = [];
          categoryUndoWalletSnapshotsRef.current = [];
          categoryUndoLinkedBudgetsRef.current = [];
          categoryUndoSubcategoriesRef.current = [];
          console.log("Category restoration complete!");
        } catch (error) {
          console.error("Critical failure inside undoDeleteCategory execution:", error);
        }
      };

      if (onDeleted) {
        onDeleted({ ...categoryToDelete, id: categoryToDelete.id! } as Category, undo);
      }
    } catch (error) {
      console.error("Critical failure during category deletion:", error);
      if (error instanceof Error) {
        if (error.name === 'ConstraintError') {
          throw new Error('Cannot delete category due to foreign key constraint');
        }
        if (error.name === 'NotFoundError') {
          throw new Error('Category not found');
        }
      }
    }
  }, [getOrCreateGlobalUncategorized]);

  const undoDeleteCategory = () => {
    categoryUndoCacheRef.current = null;
    categoryUndoSubcategoriesRef.current = [];
  };

  const addBudget = async (categoryName: string, limitAmount: number) => {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { id, ...cleanBudget } = {
        category_name: categoryName,
        limit_amount: toCents(limitAmount),
        month_year: currentMonth,
        rollover_amount: 0,
        created_at: new Date().toISOString()
      };

      await db.budgets.add(cleanBudget);
      console.log('Budget added successfully for category:', categoryName);
    } catch (error) {
      console.error('Dexie Write Failure in addBudget:', error);
      if (error instanceof Error) {
        if (error.name === 'ConstraintError') {
          throw new Error('Budget for this category already exists');
        }
      }
      throw error;
    }
  };

  const updateBudget = async (id: number, limitAmount: number) => {
    try {
      await db.budgets.update(id, { limit_amount: toCents(limitAmount) });
      console.log('Budget updated successfully:', id);
    } catch (error) {
      console.error('Dexie Update Failure in updateBudget:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error('Budget not found');
        }
      }
      throw error;
    }
  };

  const deleteBudget = async (id: number) => {
    try {
      await db.budgets.delete(id);
      console.log('Budget deleted successfully:', id);
    } catch (error) {
      console.error('Dexie Delete Failure in deleteBudget:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error('Budget not found');
        }
      }
      throw error;
    }
  };

  const transferFunds = async (fromWalletId: number, toWalletId: number, amountCents: number) => {
    await mutexRef.current.run(async () => {
      try {
        const fromWallet = await db.wallets.get(fromWalletId);
        const toWallet = await db.wallets.get(toWalletId);
        if (!fromWallet || fromWallet.balance < amountCents) {
          throw new Error('Insufficient balance');
        }

        const fromCurrency = fromWallet.currency || 'USD';
        const toCurrency = toWallet?.currency || 'USD';
        const rates = (await db.settings.get(1))?.exchange_rates || DEFAULT_EXCHANGE_RATES;
        const convertedCents = fromCurrency === toCurrency
          ? amountCents
          : Math.round(convertCurrency(amountCents, fromCurrency, toCurrency, rates));

        await db.transaction('rw', db.wallets, async () => {
          await db.wallets.update(fromWalletId, { balance: fromWallet.balance - amountCents });
          await db.wallets.update(toWalletId, { balance: (toWallet?.balance || 0) + convertedCents });
        });
        console.log('Transfer successful:', fromWalletId, '->', toWalletId, amountCents);
      } catch (error) {
        console.error('Dexie Transaction Failure in transferFunds:', error);
        if (error instanceof Error) {
          if (error.name === 'ConstraintError') {
            throw new Error('Transfer failed due to database constraint');
          }
        }
        throw error;
      }
    });
  };

  const addTransfer = (transfer: Transfer) => {
    setTransferState(prev => [transfer, ...prev]);
  };

  // FIX: refreshWallets was a no-op — it queried the DB but discarded the result.
  // Live reactivity is handled automatically by useLiveQuery above.
  // This function is kept for API compatibility but no manual refresh is needed.
  const refreshWallets = async () => {
    // useLiveQuery handles wallet reactivity automatically — no manual refresh needed.
  };

  const resetAllAppData = async () => {
    try {
      console.log('[Reset] Initiating full database purge...');

      localStorage.removeItem('expense_app_settings');

      const allTables = [db.transfers, db.expenses, db.budgets, db.wallets, db.categories, db.savings_goals, db.settings, db.currencies, db.auditLogs];

      await db.transaction('rw', allTables, async () => {
        for (const table of allTables) {
          await table.clear();
        }
      });

      const auditCount = await db.auditLogs.count();
      console.log(`[Reset] Audit logs after clear: ${auditCount}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('[Reset] All tables cleared. Re-seeding categories...');

      await seedCategoriesOnly();

      await db.settings.put({ id: 1 });

      const catCount = await db.categories.count();
      console.log(`[Reset] Reset complete. Categories: ${catCount}`);

      window.location.reload();
    } catch (error) {
      console.error('[Reset Fault]', error);
      alert('Reset error: ' + error.message);
    }
  };

  return (
    <ExpenseContext.Provider value={{
      expenses: expenses as Expense[],
      wallets: wallets as Wallet[],
      categories: categories as Category[],
      budgets: budgets as Budget[],
      transfers: transfers as (TransferDb & { id: number })[],
      loading,
      addExpense, updateExpense, deleteExpense,
      addWallet, updateWallet, deleteWallet, undoDeleteWallet,
      addCategory, updateCategory, deleteCategory, undoDeleteCategory,
      addBudget, updateBudget, deleteBudget, transferFunds, addTransfer, refreshWallets, resetAllAppData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within ExpenseProvider');
  }
  return context;
}
