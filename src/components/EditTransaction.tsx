import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useExpenses } from '../app/context/ExpenseContext';
import { useSettings } from '../app/context/SettingsContext';
import { Button } from '../app/components/ui/button';
import { Label } from '../app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../app/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { formatMoney, toCents, fromCents, parseDollarsToCents } from '../app/utils/monetary';
import { CategoryIcon } from '../app/components/CategoryIcon';
import { classifyGoalFulfillment } from '../app/utils/goalBalanceEngine';
import { getCategoryColor } from '../app/utils/categoryColors';
import { toLocalDateString } from '../app/utils/dates';

export function EditTransaction({ expenseId }: { expenseId: number }) {
  const navigate = useNavigate();
  const { expenses, wallets, categories, updateExpense } = useExpenses();
  const { baseCurrency } = useSettings();

  const existingExpense = expenses.find(e => e.id === expenseId);

  const isAssetPurchase = existingExpense?.description && /\(Goal Fulfilled\)/i.test(existingExpense.description);

  const [formData, setFormData] = useState(() => {
    let initSub = existingExpense?.subcategory || '';
    if (isAssetPurchase && existingExpense?.description) {
      initSub = classifyGoalFulfillment(existingExpense.description).sub;
    }
    return {
      description: existingExpense?.description || '',
      amount: existingExpense ? fromCents(existingExpense.amount).toString() : '',
      category: isAssetPurchase ? 'Fixed Assets' : (existingExpense?.category || ''),
      subcategory: initSub,
      date: existingExpense?.date || toLocalDateString(),
      walletId: existingExpense?.wallet_id?.toString() || '',
      type: (isAssetPurchase ? 'expense' : existingExpense?.type || 'expense') as 'expense' | 'income',
    };
  });

  const [selectedMainCategory, setSelectedMainCategory] = useState(
    isAssetPurchase ? 'Fixed Assets' : ''
  );

  useEffect(() => {
    if (isAssetPurchase && existingExpense?.description) {
      const { sub } = classifyGoalFulfillment(existingExpense.description);
      setSelectedMainCategory('Fixed Assets');
      setFormData(prev => ({
        ...prev,
        category: 'Fixed Assets',
        subcategory: sub,
        type: 'expense'
      }));
    }
  }, [isAssetPurchase]);

  const mainCategories = useMemo(() => {
    if (isAssetPurchase) {
      return categories.filter(cat =>
        cat.name === 'Fixed Assets' &&
        cat.parent_id === null
      );
    }
    return categories.filter(cat =>
      cat.name !== 'Savings Transfer' &&
      cat.name !== 'Fixed Assets' &&
      cat.parent_id === null &&
      (cat.type === 'both' || cat.type === formData.type)
    );
  }, [categories, formData.type, isAssetPurchase]);

  const selectedMainCategoryObj = useMemo(() =>
    mainCategories.find(c => c.name === selectedMainCategory), [mainCategories, selectedMainCategory]);

  const subCategories = useMemo(() =>
    selectedMainCategoryObj
      ? categories
          .filter(cat => cat.parent_id === selectedMainCategoryObj.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      : []
  , [categories, selectedMainCategoryObj]);

  const isIncome = String(formData.type).toLowerCase() === 'income';
  const selectedWallet = wallets.find(w => w.id === Number(formData.walletId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseDollarsToCents(formData.amount);
    if (!formData.amount || isNaN(amountCents) || amountCents <= 0) {
      toast.error('Please enter a valid amount greater than zero.');
      return;
    }
    if (!formData.description || !formData.category || !formData.walletId) {
      toast.error('Please fill in all fields');
      return;
    }
    if (String(formData.type).toLowerCase() !== 'income' && selectedWallet) {
      if (amountCents > selectedWallet.balance) {
        toast.error(`Insufficient funds. Available: ${formatMoney(selectedWallet.balance, baseCurrency)}`);
        return;
      }
    }
    const categoryName = selectedMainCategory || formData.category;
    const expenseData = {
      description: formData.description,
      amount: amountCents,
      category: categoryName,
      subcategory: formData.subcategory || undefined,
      date: formData.date,
      type: formData.type,
    };
    try {
      await updateExpense(expenseId, { ...expenseData, wallet_id: Number(formData.walletId) });
      toast.success('Transaction updated successfully');
      navigate('/expenses');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update transaction');
    }
  };

  if (!existingExpense) {
    return (
      <div className="p-4 sm:p-5 max-w-xl mx-auto">
        <p className="text-red-500 font-semibold">Transaction not found.</p>
        <Button onClick={() => navigate('/expenses')} className="mt-3">Back to Expenses</Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 max-w-xl mx-auto flex flex-col justify-start min-h-0">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-text-secondary self-start">
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      <h1 className="text-2xl font-bold mb-1">Edit Transaction</h1>
      <p className="text-text-secondary text-sm mb-4">Update transaction details</p>

      <div className="bg-white dark:bg-card border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-md p-4 sm:p-5 w-full">
        <div className="space-y-3 flex-grow pb-2">
          {isAssetPurchase ? (
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-200/20 rounded-full w-fit mb-2">
              <div className="rounded-full px-5 py-1.5 text-sm font-medium bg-purple-600 text-white shadow-sm flex items-center gap-1">
                <span>🔒</span> Asset Disbursal
              </div>
            </div>
          ) : (
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-200/20 rounded-full w-fit mb-2">
              <div className="rounded-full px-5 py-1.5 text-sm font-medium bg-red-600 text-white shadow-sm flex items-center gap-1">
                <span>🚨</span> Expense
              </div>
            </div>
          )}

          {isAssetPurchase && (
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-[11px] text-purple-800 dark:text-purple-200 font-medium leading-tight">
                <span className="font-bold text-purple-950 dark:text-purple-100">⚠️ ASSET ACQUISITION LOCK:</span> This transaction represents a physical asset purchase from a completed goal. Category fields are locked to preserve reporting data integrity.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</Label>
            <input type="text" value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-slate-400"
              placeholder="e.g., Purchased item"
            />
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount</Label>
            <input type="number" step="0.01" placeholder="0.00" value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-slate-400"
            />
          </div>

          {isAssetPurchase ? (
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Main Category</Label>
              <div className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold text-sm p-3 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                <span>📁 Fixed Assets</span>
                <span className="ml-auto text-[10px] bg-purple-100 dark:bg-purple-800/40 px-2 py-0.5 rounded text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">System Locked</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Main Category</Label>
              <Select value={selectedMainCategory} onValueChange={(value) => {
                setSelectedMainCategory(value);
                setFormData(prev => ({ ...prev, category: value, subcategory: '' }));
              }}>
                <SelectTrigger className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm">
                  <SelectValue placeholder="Select main category" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>
                      <span className="flex items-center gap-2">
                        <span className={`p-1 rounded-md flex items-center justify-center ${getCategoryColor(cat.name).bg}`}>
                          <CategoryIcon name={cat.icon || 'Circle'} className={`w-4 h-4 ${getCategoryColor(cat.name).text}`} />
                        </span>
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAssetPurchase ? (
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategory</Label>
              <div className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold text-sm p-3 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                <span>⚙️ Asset Acquisition</span>
                <span className="ml-auto text-[10px] bg-purple-100 dark:bg-purple-800/40 px-2 py-0.5 rounded text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">System Locked</span>
              </div>
            </div>
          ) : selectedMainCategory && subCategories.length > 0 ? (
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategory</Label>
              <Select value={formData.subcategory} onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory: value }))}>
                <SelectTrigger className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm">
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subCategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 w-full">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Wallet</Label>
            <Select value={formData.walletId} onValueChange={(value) => setFormData(prev => ({ ...prev, walletId: value }))}>
              <SelectTrigger className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm">
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(wallet => (
                  <SelectItem key={wallet.id} value={String(wallet.id)}>
                    {wallet.name} - {formatMoney(wallet.balance, baseCurrency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWallet && !isIncome && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Available balance: {formatMoney(selectedWallet.balance, baseCurrency)}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</Label>
            <input type="date" value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 mt-4 bg-white dark:bg-card">
          <button type="button" onClick={handleSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
          >
            Update
          </button>
          <button type="button" onClick={() => navigate('/expenses')}
            className="border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium py-2 px-4 rounded-xl text-sm transition-colors bg-white dark:bg-card cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
