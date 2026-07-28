import { db, DEFAULT_CATEGORIES, DEFAULT_WALLETS, CATEGORY_SUBCATEGORIES } from './db';

export async function seedDefaultData() {
  try {
    await db.transaction('rw', [db.categories, db.wallets, db.expenses], async () => {
      const existingCategories = await db.categories.toArray();
      const existingNames = new Set(existingCategories.map(c => c.name.trim().toLowerCase()));
      const toAdd = DEFAULT_CATEGORIES.filter(
        c => !existingNames.has(c.name.trim().toLowerCase())
      );
      if (toAdd.length > 0) {
        await db.categories.bulkAdd(toAdd);
      }

      const existingWallets = await db.wallets.toArray();
      if (existingWallets.length === 0) {
        await db.wallets.bulkAdd(
          DEFAULT_WALLETS.map(w => ({ ...w, created_at: new Date().toISOString() }))
        );
      }

      await seedDefaultExpenses();
    });
  } catch (error) {
    console.error('[seedDefaultData] Failed:', error);
    throw error;
  }
}

export async function seedCategoriesOnly() {
  console.log('[seedCategoriesOnly] Starting...');
  let allCats = await db.categories.toArray();
  console.log('[seedCategoriesOnly] Existing categories:', allCats.length, allCats.map(c => c.name));

  const existingNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));

  const toAdd = DEFAULT_CATEGORIES.filter(
    c => !existingNames.has(c.name.trim().toLowerCase())
  );
  console.log('[seedCategoriesOnly] Main categories to add:', toAdd.length, toAdd.map(c => c.name));
  if (toAdd.length > 0) {
    const keys = await db.categories.bulkAdd(toAdd, { allKeys: true });
    for (let i = 0; i < toAdd.length; i++) {
      if (keys[i] !== undefined) {
        allCats.push({ ...toAdd[i], id: keys[i] as number });
      }
    }
    console.log('[seedCategoriesOnly] Main categories added successfully');
  }

  const nameToId = new Map<string, number>();
  const validParentIds = new Set<number>();
  const existingParentSub = new Set<string>();
  for (const cat of allCats) {
    if (cat.id !== undefined && cat.id !== null) {
      nameToId.set(cat.name.trim().toLowerCase(), cat.id);
      if (cat.parent_id == null) validParentIds.add(cat.id);
      if (cat.parent_id != null) existingParentSub.add(`${cat.parent_id}:${cat.name.trim().toLowerCase()}`);
    }
  }

  const orphanedIds = allCats.filter(c => c.parent_id != null && c.id != null && !validParentIds.has(c.parent_id)).map(c => c.id!);
  if (orphanedIds.length > 0) {
    await db.categories.bulkDelete(orphanedIds);
    console.log('[seedCategoriesOnly] Cleaned up orphaned subcategories:', orphanedIds.length);
    allCats = allCats.filter(c => c.id == null || !orphanedIds.includes(c.id));
    existingParentSub.clear();
    for (const cat of allCats) {
      if (cat.parent_id != null && cat.id != null) existingParentSub.add(`${cat.parent_id}:${cat.name.trim().toLowerCase()}`);
    }
  }

  const subsToAdd: { name: string; icon: string; type: string; parent_id: number }[] = [];
  for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
    const parentId = nameToId.get(parentName.trim().toLowerCase());
    if (parentId !== undefined) {
      for (const sub of subs) {
        if (!existingParentSub.has(`${parentId}:${sub.name.trim().toLowerCase()}`)) {
          subsToAdd.push({ ...sub, parent_id: parentId });
        }
      }
    }
  }
  if (subsToAdd.length > 0) {
    await db.categories.bulkAdd(subsToAdd);
    console.log('[seedCategoriesOnly] Subcategories added:', subsToAdd.length);
  } else {
    console.log('[seedCategoriesOnly] No subcategories to add');
  }

  const verify = await db.categories.toArray();
  console.log('[seedCategoriesOnly] Final category count:', verify.length);
}

async function seedDefaultExpenses() {
  console.log('[seedDefaultExpenses] Adding sample transactions for testing...');
  
  // Get the first wallet for testing
  const wallets = await db.wallets.toArray();
  if (wallets.length === 0) {
    console.log('[seedDefaultExpenses] No wallets found, skipping expense seeding');
    return;
  }
  
  const walletId = wallets[0].id;
  if (!walletId) {
    console.log('[seedDefaultExpenses] No valid wallet ID found, skipping expense seeding');
    return;
  }
  
  // Sample transactions for the last 7 days
  const sampleTransactions = [
    // Recent expenses (last 2 days)
    {
      description: 'Grocery shopping',
      amount: 3500,
      category: 'Food & Dining',
      date: '07/23/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Gas station',
      amount: 2000,
      category: 'Transportation',
      date: '07/23/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Restaurant dinner',
      amount: 5000,
      category: 'Food & Dining',
      date: '07/22/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Coffee shop',
      amount: 300,
      category: 'Food & Dining',
      date: '07/22/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Uber ride',
      amount: 800,
      category: 'Transportation',
      date: '07/21/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Movie tickets',
      amount: 1200,
      category: 'Entertainment',
      date: '07/20/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Pharmacy',
      amount: 1500,
      category: 'Healthcare',
      date: '07/19/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    
    // Recent income
    {
      description: 'Salary payment',
      amount: 500000,
      category: 'Salary',
      date: '07/20/2026',
      type: 'income',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    
    // Earlier expenses (within 7 days)
    {
      description: 'Electricity bill',
      amount: 8000,
      category: 'Bills & Utilities',
      date: '07/18/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    },
    {
      description: 'Internet bill',
      amount: 3000,
      category: 'Bills & Utilities',
      date: '07/17/2026',
      type: 'expense',
      wallet_id: walletId,
      created_at: new Date().toISOString()
    }
  ];
  
  try {
    const addedTransactions = await db.expenses.bulkAdd(sampleTransactions);
    console.log(`[seedDefaultExpenses] Added ${addedTransactions.length} sample transactions`);
    
    // Verify the data
    const allTransactions = await db.expenses.toArray();
    console.log(`[seedDefaultExpenses] Total transactions in database: ${allTransactions.length}`);
    
    // Show recent transactions
    const recentTransactions = allTransactions
      .filter(tx => tx.date >= '07/17/2026')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`[seedDefaultExpenses] Recent transactions (last 7 days): ${recentTransactions.length}`);
    recentTransactions.forEach(tx => {
      console.log(`  - ${tx.date}: ${tx.description} (${tx.type}) - ${tx.amount / 100}`);
    });
    
    console.log('[seedDefaultExpenses] Sample data created successfully!');
    console.log('[seedDefaultExpenses] The Cashflow Trend chart should now display data.');
    
  } catch (error) {
    console.error('[seedDefaultExpenses] Error adding sample transactions:', error);
  }
}