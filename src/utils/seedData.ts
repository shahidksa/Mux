import { db, DEFAULT_CATEGORIES, CATEGORY_SUBCATEGORIES } from '../db';

const STRESS_TEST_MARKER = 'Automated Load Test Log #';
const OPENING_BALANCE_MARKER = 'Opening Balance Setup';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysBack: number): string {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  const ts = past + Math.random() * (now - past);
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export async function runAutomatedStressTest(): Promise<void> {
  try {
    console.log('[StressTest] Starting — generating 3,000 records...');

    const wallets = await db.wallets.toArray();
    if (wallets.length === 0) {
      console.log('[StressTest] No wallets found — seeding fallback wallet...');
      await db.wallets.add({
        name: 'Stress Test Wallet',
        type: 'cash',
        balance: 0,
        currency: 'USD',
        created_at: new Date().toISOString(),
      });
    }
    const allWallets = await db.wallets.toArray();
    const walletIds = allWallets.map(w => w.id!);

    const categories = await db.categories.toArray();
    const parentCats = categories.filter(c => c.parent_id == null);
    const categoryNames = parentCats.length > 0
      ? parentCats.map(c => c.name)
      : DEFAULT_CATEGORIES.filter(c => c.type === 'expense' || c.type === 'both').map(c => c.name);

    const subcategoryNames: string[] = [];
    for (const subs of Object.values(CATEGORY_SUBCATEGORIES)) {
      for (const sub of subs) {
        subcategoryNames.push(sub.name);
      }
    }

    const records: {
      description: string;
      amount: number;
      category: string;
      subcategory: string;
      date: string;
      wallet_id: number;
      type: 'expense' | 'income';
      created_at: string;
    }[] = [];

    const totalOpening = 50000000;
    const perWallet = Math.floor(totalOpening / walletIds.length);
    const remainder = totalOpening - perWallet * walletIds.length;
    walletIds.forEach((wid, idx) => {
      records.push({
        description: OPENING_BALANCE_MARKER,
        amount: idx === 0 ? perWallet + remainder : perWallet,
        category: 'Income',
        subcategory: 'Salary',
        date: '01/05/2026',
        wallet_id: wid,
        type: 'income',
        created_at: new Date('2026-01-05').toISOString(),
      });
    });

    for (let i = 0; i < 3000; i++) {
      const isExpense = Math.random() < 0.75;
      const type = isExpense ? 'expense' : 'income';
      const amount = isExpense
        ? Math.round(randomFloat(2, 150) * 100) / 100
        : Math.round(randomFloat(100, 2500) * 100) / 100;
      const category = categoryNames[randomInt(0, categoryNames.length - 1)];
      const subcategory = subcategoryNames[randomInt(0, subcategoryNames.length - 1)];
      const walletId = walletIds[randomInt(0, walletIds.length - 1)];

      records.push({
        description: `${STRESS_TEST_MARKER}${i + 1}`,
        amount,
        category,
        subcategory,
        date: randomDate(365),
        wallet_id: walletId,
        type,
        created_at: new Date().toISOString(),
      });
    }

    const start = performance.now();

    await db.transaction('rw', [db.expenses], async () => {
      await db.expenses.bulkPut(records);
    });

    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`[StressTest] Done — inserted 3,000 records in ${elapsed}ms`);
    console.log('[StressTest] Run window.clearStressTest() to remove them later.');
  } catch (err) {
    console.error('[StressTest] Failed:', err);
  }
}

export async function clearAutomatedTestData(): Promise<void> {
  try {
    console.log('[StressTest] Scanning for test records...');
    const all = await db.expenses.toArray();
    const testIds = all
      .filter(e => e.description && (e.description.startsWith(STRESS_TEST_MARKER) || e.description === OPENING_BALANCE_MARKER))
      .map(e => e.id!)
      .filter(Boolean);

    if (testIds.length === 0) {
      console.log('[StressTest] No test records found — nothing to clear.');
      return;
    }

    await db.transaction('rw', [db.expenses], async () => {
      await db.expenses.bulkDelete(testIds);
    });

    console.log(`[StressTest] Cleared ${testIds.length} test records.`);
  } catch (err) {
    console.error('[StressTest] Clear failed:', err);
  }
}

if (import.meta.env.DEV) {
  (window as any).runStressTest = runAutomatedStressTest;
  (window as any).clearStressTest = clearAutomatedTestData;
}
