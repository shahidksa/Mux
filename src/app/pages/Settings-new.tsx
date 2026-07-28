import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { useExpenses } from '../context/ExpenseContext';
import { useSettings } from '../context/SettingsContext';
import { Plus, Trash2, Wallet, Tag, Pencil, RefreshCw, Download, Upload, AlertTriangle } from 'lucide-react';
import { convertToBase, CURRENCY_SYMBOLS, ALL_CURRENCIES, DEFAULT_EXCHANGE_RATES, getAllCurrencies, getCurrencySymbol } from '../utils/currency';
import type { CustomCurrency } from '../utils/currency';
import { roundMoney, sumMoney, formatMoney } from '../utils/monetary';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { exportDB, importDB } from 'dexie-export-import';
import { db, SavingsGoalDb } from '../../db';
import { executeSafeGoalDeletion } from '../services/savingsEngine';
import { GLOBAL_EMOJI_KEYWORDS } from '../utils/emojiDictionary';
import { CurrencySelector } from '../components/CurrencySelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogOverlay } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface SettingsProps {
  safetyFloor: number;
  setSafetyFloor: (value: number) => void;
  lockedSavings: number;
  setLockedSavings: (value: number) => void;
  budgetSurplusRule: 'wallet' | 'sweep';
  setBudgetSurplusRule: (value: 'wallet' | 'sweep') => void;
}

export function Settings({ safetyFloor, setSafetyFloor, lockedSavings, setLockedSavings, budgetSurplusRule, setBudgetSurplusRule }: SettingsProps) {
  const { wallets, categories, budgets, expenses, addWallet, updateWallet, deleteWallet, undoDeleteWallet, addCategory, updateCategory, deleteCategory, undoDeleteCategory, addBudget, updateBudget, deleteBudget, resetAllAppData } = useExpenses();
  const { baseCurrency, setBaseCurrency, rateMode, setRateMode, exchangeRates, setExchangeRates, allowBudgetAlerts, setAllowBudgetAlerts, customCurrencies, addCustomCurrency, removeCustomCurrency, sweepFrequency, setSweepFrequency, sweepPercentage, setSweepPercentage } = useSettings();
  const metrics = useFinancialMetrics(expenses, baseCurrency, { safetyFloor, capitalShield: lockedSavings }, wallets, categories);
  const totalWealthPool = 100000.00;

  const [localSafetyFloor, setLocalSafetyFloor] = useState(safetyFloor);
  const [localCapitalShield, setLocalCapitalShield] = useState(lockedSavings);
  const [localSweepRatio, setLocalSweepRatio] = useState(sweepPercentage);

  const maxSafetyFloorAllowed = totalWealthPool - localCapitalShield;
  const maxCapitalShieldAllowed = totalWealthPool - localSafetyFloor;

  useEffect(() => {
    setLocalSafetyFloor(safetyFloor);
    setLocalCapitalShield(lockedSavings);
    setLocalSweepRatio(sweepPercentage);
  }, [safetyFloor, lockedSavings, sweepPercentage]);

  const handleCustomPercentageChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = Math.max(0, Math.min(100, parseInt(cleaned, 10) || 0));
    setLocalSweepRatio(num);
    setIsDirty(true);
  };

  useEffect(() => {
    if (window.location.hash === '#notifications') {
      const el = document.getElementById('notifications-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  const fxRate = baseCurrency === 'USD' ? 1 : rates[baseCurrency] && rates['USD'] ? rates[baseCurrency] / rates['USD'] : 1;
  const currencySymbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;

  const dbCurrencies = useLiveQuery(() => db.currencies.toArray()) || [];
  const allCurrencyCodes = useMemo(() => Array.from(new Set([
    ...getAllCurrencies(customCurrencies),
    ...dbCurrencies.map(c => c.code)
  ])), [customCurrencies, dbCurrencies]);

  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  const [fetchingRates, setFetchingRates] = useState(false);
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');
  const [baseCurrencyPreferenceState, setBaseCurrencyPreferenceState] = useState(baseCurrency);
  const [selectedExtensionCode, setSelectedExtensionCode] = useState('');

  const handleDeleteCurrency = async (code: string) => {
    const currency = dbCurrencies.find(c => c.code === code);
    if (currency) {
      if (currency.isDefault || currency.is_custom === false) {
        toast.error(`${code} is a system currency and cannot be deleted.`);
        return;
      }
      await db.currencies.delete(currency.id!);
    } else if (!customCurrencies.some(c => c.code === code)) {
      toast.error(`${code} not found.`);
      return;
    }
    removeCustomCurrency(code);
    const newR = { ...rates };
    delete newR[code];
    setExchangeRates(newR);
    toast.success(`${code} deleted successfully.`);
  };

  const handleBaseCurrencyChange = (value: string) => {
    const oldBase = baseCurrency;
    setBaseCurrency(value);
    setBaseCurrencyPreferenceState(value);
    if (rateMode === 'api') {
      fetchLiveRates();
    }
    const resolvedRates = exchangeRates || DEFAULT_EXCHANGE_RATES;
    const newRate = resolvedRates[value] || 1;
    const oldRate = resolvedRates[oldBase] || 1;
    for (const w of wallets) {
      if (w.currency === oldBase) {
        await updateWallet(w.id!, { currency: value });
      }
    }
  };

  const getDisplayedRate = (targetCurrency: string) => {
    const targetRate = rates[targetCurrency] || 1;
    const baseRate = rates[baseCurrency] || 1;
    return targetRate / baseRate;
  };

  useEffect(() => {
    const newManualRates: Record<string, string> = {};
    for (const curr of allCurrencyCodes) {
      if (curr === baseCurrency) {
        newManualRates[curr] = '1';
        continue;
      }
      const display = getDisplayedRate(curr);
      if (isFinite(display) && display >= 0) {
        newManualRates[curr] = display < 0.1 ? display.toFixed(5) : display.toFixed(2);
      } else {
        newManualRates[curr] = '0.00';
      }
    }
    setManualRates(newManualRates);
  }, [exchangeRates, baseCurrency, allCurrencyCodes]);

  useEffect(() => {
    if (rateMode === 'api') {
      fetchLiveRates();
    }
  }, [rateMode, baseCurrency]);

  useEffect(() => {
    if ((window as any).autoScrollToSavings) {
      (window as any).autoScrollToSavings = false;
      setTimeout(() => {
        const targetCardElement = document.getElementById('manage-savings-goals-section');
        if (targetCardElement) {
          targetCardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, []);

  const fetchLiveRates = async () => {
    setFetchingRates(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/USD`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.rates) {
        const apiRates = data.rates as Record<string, number>;
        const numericRates: Record<string, number> = {};
        for (const code of allCurrencyCodes) {
          const liveRate = apiRates[code];
          if (liveRate !== undefined) {
            numericRates[code] = Math.round(parseFloat(String(liveRate)) * 1_000_000) / 1_000_000;
          } else {
            numericRates[code] = rates[code] || DEFAULT_EXCHANGE_RATES[code] || 1;
          }
        }
        numericRates['USD'] = 1;
        setExchangeRates(numericRates);
        toast.success('Exchange rates updated from live API');
      }
    } catch (err) {
      toast.error('Failed to fetch live rates, using offline defaults');
      toast.warning('Custom currency rates may not be accurate with fallback defaults');
      const fallbackRates = { 'USD': 1.0, 'PKR': 278, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149, 'CNY': 7.24, 'INR': 83, 'AUD': 1.53, 'CAD': 1.36, 'SAR': 3.75, 'AED': 3.64, 'QAR': 3.64, 'KWD': 0.31 };
      setExchangeRates(fallbackRates);
    } finally {
      setFetchingRates(false);
    }
  };

  const handleManualRateChange = (currency: string, value: string) => {
    const updated = { ...manualRates, [currency]: value };
    setManualRates(updated);
    const baseRate = rates[baseCurrency] || 1;
    const numValue = parseFloat(value);
    if (baseRate && !isNaN(numValue) && numValue > 0) {
      const newRates = { ...rates, [currency]: numValue * baseRate };
      setExchangeRates(newRates);
    }
  };
  
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<'bank' | 'cash' | 'card'>('bank');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [newWalletCurrency, setNewWalletCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'PKR' | 'AUD' | 'CAD' | 'SAR' | 'AED'>('USD');
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  const [editingWallet, setEditingWallet] = useState<{id: number, name: string, type: string, balance: number, currency: string} | null>(null);
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editingCategory, setEditingCategory] = useState<{id: number, name: string, type?: string} | null>(null);

  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{id: number, category_name: string, limit_amount: number} | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState<Record<string, string>>({});

  const [weeklyReports, setWeeklyReports] = useState(() => {
    return localStorage.getItem('clearsum_weekly_reports_enabled') === 'true';
  });
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [reportText, setReportText] = useState("");

  const [isDirty, setIsDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'wallet' | 'category' | 'budget' | 'reset'; id: number | null; hasExpenses?: boolean } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isAutoDepositToggledOn, setIsAutoDepositToggledOn] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetGoalId, setTargetGoalId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleEditClick = (goal: SavingsGoalDb) => {
    const knownIcons = ['🎯', '🚗', '🎓', '🏠', '✈️', '🐄'];
    let icon = '🎯';
    let name = goal.name;
    for (const emoji of knownIcons) {
      if (name.startsWith(emoji)) {
        icon = emoji;
        name = name.slice(emoji.length).replace(/^\s+/, '');
        break;
      }
    }
    setSelectedIcon(icon);
    setGoalName(name);
    setTargetAmount(String((goal.target_amount || 0) / 100));
    setTargetDate(goal.target_date ?? '');
    setIsAutoDepositToggledOn(goal.auto_deposit_surplus ?? false);
    setEditingGoalId(goal.id ?? null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletType) {
      toast.error('Please fill in wallet name and type');
      return;
    }
    try {
      const balance = newWalletBalance ? parseFloat(newWalletBalance) : 0;
      await addWallet({ name: newWalletName, type: newWalletType, balance, currency: newWalletCurrency });
      setNewWalletName('');
      setNewWalletType('bank');
      setNewWalletBalance('');
      setNewWalletCurrency('USD');
      setWalletDialogOpen(false);
      toast.success('Wallet added successfully');
    } catch {
      toast.error('Failed to add wallet');
    }
  };

  const handleDeleteWallet = async (id: number) => {
    const wallet = wallets.find(w => w.id === id);
    if (!wallet) return;
    
    if (wallet.balance > 0) {
      toast.error('Cannot delete a wallet with an active balance. Please transfer your remaining funds to another account before removing this wallet.');
      return;
    }
    
    setConfirmDelete({ type: 'wallet', id });
  };

  const handleDeleteCategory = async (id: number) => {
    const hasExpenses = expenses.some(e => e.category === categories.find(c => c.id === id)?.name);
    setConfirmDelete({ type: 'category', id, hasExpenses });
  };

  const handleDeleteBudget = async (id: number) => {
    setConfirmDelete({ type: 'budget', id });
  };

  const handleResetData = () => {
    setConfirmDelete({ type: 'reset', id: null });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;

    const { type, id } = confirmDelete;

    if (type === 'wallet' && id !== null) {
      try {
        await deleteWallet(id, (deletedWallet, undo) => {
          toast.success(
            <div className="flex items-center gap-2">
              <span>Wallet removed.</span>
              <button 
                className="text-blue-600 underline font-medium"
                onClick={() => {
                  undo();
                  toast.dismiss();
                }}
              >
                Undo
              </button>
            </div>,
            { duration: 5000 }
          );
        });
      } catch {
        toast.error('Failed to delete wallet');
      }
    } else if (type === 'category' && id !== null) {
      try {
        await deleteCategory(id, (deletedCategory, undo) => {
          toast.success(
            <div className="flex items-center gap-2">
              <span>Category removed.</span>
              <button 
                className="text-blue-600 underline font-medium"
                onClick={() => {
                  undo();
                  toast.dismiss();
                }}
              >
                Undo
              </button>
            </div>,
            { duration: 5000 }
          );
        });
      } catch {
        toast.error('Failed to delete category');
      }
    } else if (type === 'budget' && id !== null) {
      try {
        await deleteBudget(id);
        toast.success('Budget deleted');
      } catch {
        toast.error('Failed to delete budget');
      }
    } else if (type === 'reset') {
      await resetAllAppData();
      window.location.reload();
    }

    setConfirmDelete(null);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) {
      toast.error('Please enter category name');
      return;
    }
    try {
      await addCategory(newCategoryName, newCategoryType);
      setNewCategoryName('');
      setNewCategoryType('expense');
      setCategoryDialogOpen(false);
      toast.success('Category added successfully');
    } catch {
      toast.error('Failed to add category');
    }
  };

  const handleEditWalletClick = (wallet: any) => {
    setEditingWallet({ id: wallet.id, name: wallet.name, type: wallet.type, balance: wallet.balance, currency: wallet.currency || 'USD' });
    setEditBalance(Number(wallet.balance || 0));
  };

  const handleUpdateWallet = async () => {
    if (!editingWallet) return;
    try {
      await updateWallet(editingWallet.id, { 
        name: editingWallet.name, 
        type: editingWallet.type as any,
        currency: editingWallet.currency as any,
        balance: Number(editBalance) || 0
      });
      setEditBalance(0);
      setEditingWallet(null);
      toast.success('Wallet updated');
    } catch {
      toast.error('Failed to update wallet');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    try {
      await updateCategory(editingCategory.id, editingCategory.name, editingCategory.type as any);
      setEditingCategory(null);
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    }
  };

  const handleAddBudget = async () => {
    if (!newBudgetCategory || !newBudgetAmount) {
      toast.error('Please fill in category and amount');
      return;
    }
    try {
      await addBudget(newBudgetCategory, Math.max(0, parseFloat(newBudgetAmount)));
      setNewBudgetCategory('');
      setNewBudgetAmount('');
      setBudgetDialogOpen(false);
      toast.success('Budget added successfully');
    } catch {
      toast.error('Failed to add budget');
    }
  };

  const handleUpdateBudget = async () => {
    if (!editingBudget) return;
    try {
      await updateBudget(editingBudget.id, Math.max(0, editingBudget.limit_amount));
      setEditingBudget(null);
      toast.success('Budget updated');
    } catch {
      toast.error('Failed to update budget');
    }
  };

  const handleSaveBudgetInline = async (categoryName: string, amount: string) => {
    const cat = categories.find(c => c.name === categoryName);
    if (String(cat?.type).toLowerCase() === 'income') {
      toast.error('Budgets cannot be set on income categories');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      try {
        await db.budgets.where('category_name').equals(categoryName).delete();
        toast.success('Budget limit removed');
      } catch {
        toast.error('Failed to remove budget');
      }
      setBudgetInput({ ...budgetInput, [categoryName]: '' });
      setEditingCategoryId(null);
      return;
    }
    try {
      const clampedAmount = Math.max(0, numAmount);
      const existing = budgets.find(b => b.category_name === categoryName);
      if (existing) {
        await updateBudget(existing.id, clampedAmount);
        toast.success('Budget updated');
      } else {
        await addBudget(categoryName, clampedAmount);
        toast.success('Budget set');
      }
      setBudgetInput({ ...budgetInput, [categoryName]: '' });
      setEditingCategoryId(null);
    } catch {
      toast.error('Failed to save budget');
    }
  };

  const handleManualSweepButtonClick = async () => {
    const sweepPercentage = localSweepRatio / 100;
    const totalAvailable = wallets.reduce((sum, w) => sum + w.balance, 0);
    const sweepAmount = totalAvailable * sweepPercentage;

    const activeGoals = await db.savings_goals.toArray();

    if (activeGoals.length === 0) {
      toast.error('No active savings goals found. Create a goal first.');
      return;
    }

    const primaryGoal = activeGoals[0];
    const sourceWalletId = wallets[0]?.id;

    if (sourceWalletId) {
      await db.wallets.update(sourceWalletId, {
        balance: Math.max(0, (wallets[0].balance || 0) - sweepAmount)
      });
    }

    await db.savings_goals.update(primaryGoal.id, {
      current_amount: (primaryGoal.current_amount || 0) + sweepAmount
    });

    await db.expenses.add({
      id: Date.now(),
      description: `Manual sweep allocation (${localSweepRatio}%)`,
      amount: sweepAmount,
      category: primaryGoal.name,
      date: new Date().toISOString().split('T')[0],
      wallet_id: sourceWalletId || 0,
      type: 'income'
    });

    toast.success(`Sweep completed: ${formatMoney(sweepAmount, baseCurrency)} allocated to "${primaryGoal.name}"`);
  };

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  const handleBackupDatabase = async () => {
    try {
      console.log("Compiling full database storage snapshot...");
      const blob = await exportDB(db, { pretty: true, format: 'json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ExpenseApp_Master_Backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Database backup downloaded successfully');
    } catch (error) {
      console.error("Critical failure during full DB backup write:", error);
      toast.error('Failed to create backup');
    }
  };

  const handleWeeklyToggleChange = (checked: boolean) => {
    setWeeklyReports(checked);
    localStorage.setItem('clearsum_weekly_reports_enabled', checked ? 'true' : 'false');
    console.log(`Weekly Reports preference updated and saved on disk: ${checked}`);
  };

  const handleGenerateWeeklySnapshot = async () => {
    if (!weeklyReports) {
      toast.error('Please enable the Weekly Reports toggle first.');
      return;
    }

    try {
      // 1. Fetch real-time data logs from local Dexie database
      const wallets = await db.wallets.toArray();
      const expenses = await db.expenses.toArray();
      const categories = await db.categories.toArray();
      const budgets = await db.budgets.toArray(); // fetch budgets too

// Calculate current localized financial metrics
       const totalNetWorth = sumMoney(wallets.map(w => convertToBase(Number(w.balance) || 0, w.currency || baseCurrency)));
       const currencySymbol = CURRENCY_SYMBOLS[baseCurrency] || "₨";

      // 2. Draft a beautiful text report layout structure
      let reportContent = `==================================================\n`;
      reportContent += `       CLEARSUM: PERSONAL FINANCE TRACKER DESKTOP APP FOR WINDOWS       \n`;
      reportContent += `       Generated: ${new Date().toLocaleDateString()} \n`;
      reportContent += `==================================================\n\n`;

      reportContent += `💰 NET WORTH SUMMARY:\n`;
      reportContent += `--------------------------------------------------\n`;
      reportContent += `Total Current Wealth: ${currencySymbol}${totalNetWorth.toFixed(2)}\n\n`;

      reportContent += `🏦 ACCOUNTS & WALLETS REGISTRY:\n`;
      reportContent += `--------------------------------------------------\n`;
      wallets.forEach(w => {
        const walletCurrency = w.currency || baseCurrency; 
        const walletBalance = Number(w.balance) || 0;
        
        reportContent += `- ${w.name} (${w.type}): ${walletCurrency}${walletBalance.toFixed(2)}\n`;
      });
      reportContent += `\n`;

      reportContent += `📊 TRANSACTIONAL PERFORMANCE LOGS\n`;
      reportContent += `------------------------------------------------------------------------\n`;
      reportContent += `Total Records Tracked: ${expenses.length} items\n\n`;
      reportContent += `Latest Expenses Logged (Past 7 Days):\n`;

      const latestExpenses = [...expenses]
        .sort((a, b) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          if (timeB !== timeA) return timeB - timeA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        })
        .slice(0, 7); // EXPANDED: Pull the top 7 absolute newest items for a full week log

      latestExpenses.forEach(e => {
        // 1. Correctly resolve the exact wallet details to determine the true currency
        const matchingWallet = wallets.find(w => w.name === e.wallet || w.id === e.wallet_id);
        const rawCurrency = e.currency || (matchingWallet ? matchingWallet.currency : baseCurrency);
        const txDisplaySymbol = CURRENCY_SYMBOLS[rawCurrency] || rawCurrency;
        const txCurrLabel = rawCurrency;
        
        // 3. Format the raw number with clean thousands separator commas
        const txAmountFormatted = Number(e.amount || 0).toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
        
        // 4. Construct the clean text label (Ensure NO hardcoded '₨' sits in this template)
        const txLabel = `${txDisplaySymbol}${txAmountFormatted}`.padEnd(14);
        const txCat = e.category.padEnd(18);
        
        // Build the final synchronized text summary line
        reportContent += `  * ${e.date} | ${txCat} | ${txLabel} (${txCurrLabel})\n`;
      });
      reportContent += `\n`;

      // NEW: Category Budget & Performance Breakdown
      reportContent += `\n📊 CATEGORY BUDGET & PERFORMANCE BREAKDOWN:\n`;
      reportContent += `--------------------------------------------------\n`;

      for (const cat of categories) {
        const catExpenses = expenses.filter(e => e.category === cat.name);
        const totalSpent = sumMoney(catExpenses.map(e => Number(e.amount) || 0));
        const budgetObj = budgets.find(b => b.category_name === cat.name);
        const budgetLimit = budgetObj ? Number(budgetObj.limit_amount) : 0;  // correct field name

        reportContent += `* ${cat.name}:\n`;
        reportContent += `  Spent: ${currencySymbol}${totalSpent.toFixed(2)}\n`;
        if (budgetLimit > 0) {
          const status = totalSpent > budgetLimit ? "⚠️ OVER BUDGET" : "✅ WITHIN BUDGET";
          reportContent += `  Limit: ${currencySymbol}${budgetLimit.toFixed(2)} (${status})\n`;
        } else {
          reportContent += `  Limit: No Budget Target Configured\n`;
        }
      }

      reportContent += `\n==================================================\n`;
      reportContent += `🔒 Privacy Note: Securely compiled 100% locally on device.\n`;
      reportContent += `==================================================\n`;

      // 3. Store report and open preview modal instead of direct download
      setReportText(reportContent);
      setShowSummaryModal(true);

      console.log("Weekly financial summary preview opened.");
    } catch (error) {
      console.error("Critical failure during weekly report compile:", error);
      toast.error("Failed to generate weekly summary.");
    }
  };

  const handleExportTimelinePDF = async (timeline: 'weekly' | 'monthly') => {
    try {
      const isAppDarkMode = document.documentElement.classList.contains('dark');
      const wallets = await db.wallets.toArray();
      const expenses = await db.expenses.toArray();
      const budgets = await db.budgets.toArray();
      const baseCurrencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '₨';

      const dayRange = timeline === 'weekly' ? 7 : 30;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const past7DaysDate = new Date();
      past7DaysDate.setDate(today.getDate() - 7);
      past7DaysDate.setHours(0, 0, 0, 0);

      const relevantExpenses = timeline === 'weekly'
        ? expenses.filter(e => {
            if (!e.date) return false;
            const txDate = new Date(e.date);
            txDate.setHours(0, 0, 0, 0);
            return txDate >= past7DaysDate && txDate <= today;
          })
        : expenses.filter(e => {
            if (!e.date) return false;
            const threshold = today.getTime() - (dayRange * 24 * 60 * 60 * 1000);
            return new Date(e.date).getTime() >= threshold;
          });
const totalSpent = sumMoney(relevantExpenses.filter(e => String(e.type).toLowerCase() !== 'income').map(e => Number(e.amount) || 0));
       const totalIncome = sumMoney(relevantExpenses.filter(e => String(e.type).toLowerCase() === 'income').map(e => Number(e.amount) || 0));

      const windowName = `clearsum-report-${new Date().getTime()}`;
      const printWindow = window.open('', windowName);
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>ClearSum Financial Statement - ${timeline.toUpperCase()} REPORT</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta http-equiv="Pragma" content="no-cache" />
            <meta http-equiv="Expires" content="0" />
            <style>
  /* BASE RESETS */
  body { 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    padding: 0; 
    margin: 0; 
    line-height: 1.5; 
    transition: background-color 0.2s, color 0.2s;
  }

  /* --- SCREEN STATE 1: APP IS IN DARK MODE --- */
  html.dark body { background-color: #09090b; color: #f4f4f5; }
  html.dark body .toolbar { background: #18181b; border-bottom: 1px solid #27272a; }
  html.dark body .toolbar-btn.secondary { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; }
  html.dark body .page-container { background: #18181b; border: 1px solid #27272a; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
  html.dark body .title, html.dark body .section-title { color: #60a5fa; }
  html.dark body .subtitle { color: #a1a1aa; }
  html.dark body .section-title { border-bottom: 2px solid #27272a; }
  html.dark body .kpi-card { background: rgba(39,39,42,0.4); border: 1px solid #27272a; }
  html.dark body .kpi-title { color: #a1a1aa; }
  html.dark body .kpi-val { color: #f4f4f5; }
  html.dark body th { background: rgba(39,39,42,0.6); color: #a1a1aa; border-bottom: 2px solid #27272a; }
  html.dark body td { border-bottom: 1px solid rgba(39,39,42,0.6); color: #e4e4e7; }
  html.dark body .badge-crit { background: #581c1c; color: #fca5a5; }
  html.dark body .badge-safe { background: #064e3b; color: #6ee7b7; }
  /* PREMIUM FIXED: Brightened dull currency text to high-contrast crisp blue */
  html.dark body .amount-val { color: #60a5fa !important; }

  /* --- SCREEN STATE 2: APP IS IN LIGHT MODE --- */
  body:not(.dark) { background-color: #f9fafb; color: #111827; }
  body:not(.dark) .toolbar { background: #ffffff; border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  body:not(.dark) .toolbar-btn.secondary { background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; }
  body:not(.dark) .page-container { background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
  body:not(.dark) .title, body:not(.dark) .section-title { color: #1e3a8a; }
  body:not(.dark) .subtitle { color: #4b5563; }
  body:not(.dark) .section-title { border-bottom: 2px solid #e5e7eb; }
  body:not(.dark) .kpi-card { background: #f9fafb; border: 1px solid #e5e7eb; }
  body:not(.dark) .kpi-title { color: #4b5563; }
  body:not(.dark) .kpi-val { color: #111827; }
  body:not(.dark) th { background: #f3f4f6; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
  body:not(.dark) td { border-bottom: 1px solid #edf2f7; color: #374151; }
  body:not(.dark) .badge-crit { background: #fee2e2; color: #991b1b; }
  body:not(.dark) .badge-safe { background: #d1fae5; color: #065f46; }
  body:not(.dark) .amount-val { color: #1e40af !important; }

  /* GLOBAL LAYOUT STYLES */
  .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: rgba(250,250,250,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(228,228,231,0.8); padding: 12px 16px; display: flex; align-items: center; justify-content: center; gap: 15px; }
  .toolbar-btn { background: #2563eb; color: white; border: 0; font-size: 12px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
  .toolbar-btn:hover { background: #1d4ed8; }
  html.dark body .toolbar { background: rgba(24,24,27,0.9); border-bottom: 1px solid rgba(39,39,42,0.8); }
  .page-container { width: 100%; max-width: 1280px; margin: 0 auto; background: #ffffff; border: 1px solid rgba(228,228,231,0.6); border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); box-sizing: border-box; }
  html.dark body .page-container { background: #18181b; border: 1px solid rgba(39,39,42,0.6); }
  .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; }
  .title { font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .subtitle { font-size: 12px; margin-top: 6px; font-weight: 500; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; padding-bottom: 6px; margin: 30px 0 15px 0; letter-spacing: 0.5px; }
  .kpi-grid { display: flex; gap: 20px; margin-bottom: 25px; }
  .kpi-card { flex: 1; padding: 16px; border-radius: 8px; }
  .kpi-title { font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; table-layout: auto; }
  th { font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 10px 12px; }
  td { padding: 12px 12px; white-space: normal; word-break: break-word; line-height: 1.4; }
  .badge { padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 4px; }

  /* AUTOMATIC SMART PRINT INVERSION (Always White on Paper for Ink Saving) */
  @media print {
    @page { size: portrait; margin: 1.5cm 1.2cm 1.5cm 1.2cm; }
    body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; margin: 0 !important; font-size: 11px !important; }
    .toolbar { display: none !important; }
    .page-container { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; width: 100% !important; max-width: 100% !important; background: transparent !important; }
    .title, .section-title { color: #1e3a8a !important; }
    .subtitle { color: #4b5563 !important; }
    .kpi-card { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
    .kpi-val { color: #1e3a8a !important; }
    .kpi-title { color: #4b5563 !important; }
    th { background: #f3f4f6 !important; color: #4b5563 !important; border-bottom: 2px solid #e5e7eb !important; }
    td { border-bottom: 1px solid #e5e7eb !important; color: #111111 !important; padding: 8px 6px !important; font-size: 11px !important; }
    .badge-crit { background: #fee2e2 !important; color: #991b1b !important; }
    .badge-safe { background: #d1fae5 !important; color: #065f46 !important; }
    .amount-val { color: #1e3a8a !important; }
    .print-expand-container { max-height: none !important; overflow: visible !important; height: auto !important; }
  }
            </style>
          </head>
          <body class="${isAppDarkMode ? 'dark' : ''}">
            <div class="toolbar">
              <button class="toolbar-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
              <button class="toolbar-btn secondary" onclick="window.close()">✕ Close Preview</button>
            </div>

            <div style="width:100%;height:22px;margin-top:22px;clear:both;display:block;"></div>

            <div class="page-container">
              <div class="header">
                <h1 class="title">ClearSum Financial Statement</h1>
                <div class="subtitle">Private Offline Ledger Summary • Generated on ${new Date().toLocaleDateString()} • Timeline: Past ${dayRange} Days</div>
              </div>

              <div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-title">Consolidated Balance</div><div class="kpi-val">${baseCurrencySymbol}${sumMoney(wallets.map(w => convertToBase(Number(w.balance || 0), w.currency || baseCurrency))).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                <div class="kpi-card"><div class="kpi-title">Total Expenses</div><div class="kpi-val">${baseCurrencySymbol}${totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                <div class="kpi-card"><div class="kpi-title">Total Income</div><div class="kpi-val">${baseCurrencySymbol}${totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                <div class="kpi-card"><div class="kpi-title">Active Accounts</div><div class="kpi-val">${wallets.length} Wallets</div></div>
              </div>

              <div class="section-title">🛡️ Monthly Budget Breakdown Performance</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30%; text-align: left;">Category Name</th>
                    <th style="width: 25%; text-align: left;">Total Spent In Period</th>
                    <th style="width: 25%; text-align: left;">Configured Limit</th>
                    <th style="width: 20%; text-align: right;">Status Alert</th>
                  </tr>
                </thead>
                <tbody>
                  ${budgets.map(b => {
                    const bExpenses = relevantExpenses.filter(e => e.type !== 'income' && e.category === b.category_name);
                    const bSpent = sumMoney(bExpenses.map(e => convertToBase(Number(e.amount || 0), e.currency || baseCurrency)));
                    const limit = Number(b.limit_amount) || 0;
                    const isOver = bSpent > limit && limit > 0;
                    return `
                      <tr>
                        <td style="width: 30%; text-align: left; font-weight: 600;">${b.category_name}</td>
                        <td style="width: 25%; text-align: left;">${baseCurrencySymbol}${bSpent.toFixed(2)}</td>
                        <td style="width: 25%; text-align: left;">${limit > 0 ? `${baseCurrencySymbol}${limit.toFixed(2)}` : 'No Target Set'}</td>
                        <td style="width: 20%; text-align: right;">
                          ${limit > 0 ? (isOver ? '<span class="badge badge-crit">⚠️ OVER BUDGET</span>' : '<span class="badge badge-safe">✅ WITHIN BUDGET</span>') : '—'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              <div class="section-title">📊 Historical Recent Activity Log</div>
              <div class="print-expand-container" style="overflow-x: auto; max-height: 350px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin;">
                <table style="min-width: 700px;" class="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th style="width: 15%; text-align: left;">Date</th>
                      <th style="width: 35%; text-align: left;">Description Ledger String</th>
                      <th style="width: 20%; text-align: left;">Category</th>
                      <th style="width: 15%; text-align: left;">Account</th>
                      <th style="width: 15%; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...relevantExpenses]
                      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (Number(b.id) || 0) - (Number(a.id) || 0))
                      .slice(0, 100).map(e => {
                      const linkedWallet = wallets.find(w => w.id === e.wallet_id || w.name === e.wallet);
                      const displayWalletName = linkedWallet ? linkedWallet.name : 'Unknown';
                      const isIncome = String(e.type).toLowerCase() === 'income';
                      const sign = isIncome ? '+' : '-';
                      const color = isIncome ? '#22c55e' : '#ef4444';
                      return `
                        <tr>
                          <td style="width: 15%; text-align: left;">${e.date}</td>
                          <td style="width: 35%; text-align: left;" title="${e.description}">${e.description}</td>
                          <td style="width: 20%; text-align: left;">${e.category}</td>
                          <td style="width: 15%; text-align: left;">${displayWalletName}</td>
                          <td style="width: 15%; text-align: right; font-weight: 700; color: ${color};">${sign}${baseCurrencySymbol}${convertToBase(Number(e.amount || 0), linkedWallet?.currency || baseCurrency).toFixed(2)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("Critical failure compiling PDF layout stream:", err);
    }
  };

  const downloadReportAsTxt = (content: string) => {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ClearSum_Windows_Financial_Snapshot_${new Date().toISOString().split('T')[0]}.txt`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowSummaryModal(false);
      console.log("Weekly text snapshot successfully downloaded to machine.");
    } catch (error) {
      console.error("Failed to download report:", error);
    }
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreDialogOpen(true);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;

    try {
      console.log("Terminating active database connections to release locks...");

      await db.delete();
      console.log("Old database purged. Re-importing backup file onto disk...");

      await importDB(restoreFile, {
        overwriteValues: true
      });

      console.log("Database restoration complete! Reloading application workspace...");
      window.location.href = '/';
    } catch (error) {
      console.error("Critical failure during database restoration process:", error);
      toast.error("Failed to restore backup file. Please ensure it is a valid backup JSON.");
      try { await db.open(); } catch (_) {}
    } finally {
      setRestoreDialogOpen(false);
      setRestoreFile(null);
    }
  };

  const handleCancelRestore = () => {
    setRestoreDialogOpen(false);
    setRestoreFile(null);
  };


