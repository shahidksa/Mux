import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useExpenses } from '../context/ExpenseContext';
import { useSettings } from '../context/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Wallet, X, Calendar } from 'lucide-react';
import { db, createWallet } from '../../db';
import { toLocalDateString } from '../../utils/dates';

// Constants for automated calculations
const CHECKING_WALLET_ID = 1; // Assuming wallet ID 1 is the main checking account

import { roundMoney, formatMoney, toCents, parseDollarsToCents, fromCents } from '../utils/monetary';
import { DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { classifyGoalFulfillment } from '../utils/goalBalanceEngine';
import { CategoryIcon } from '../components/CategoryIcon';
import { IconPicker } from '../components/IconPicker';
import { getCategoryColor, getSubCategoryColor } from '../utils/categoryColors';

// Custom Date Picker Component
const DatePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  useEffect(() => {
    setTempDate(value);
    if (value) {
      const date = new Date(value);
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [value]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDateSelect = (dateString: string) => {
    onChange(dateString);
    setIsOpen(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push(dateString);
    }
    
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setTempDate(toLocalDateString(today));
  };

  const calendarDays = generateCalendar();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between"
      >
        <span>{formatDate(tempDate) || 'Select date'}</span>
        <Calendar className="w-4 h-4 text-slate-400" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-600">
            {dayNames.map(day => (
              <div key={day} className="p-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-600">
            {calendarDays.map((dateString, index) => {
              if (dateString === null) {
                return <div key={index} className="aspect-square bg-transparent" />;
              }
              
              const isSelected = tempDate === dateString;
              const today = toLocalDateString();
              const isToday = dateString === today;
              
              return (
                <button
                  type="button"
                  key={dateString}
                  onClick={() => handleDateSelect(dateString)}
                  className={`aspect-square p-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 
                    isToday ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' :
                    'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {new Date(dateString).getDate()}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="p-2 border-t border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => {
                const today = toLocalDateString();
                handleDateSelect(today);
              }}
              className="w-full py-1.5 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DESCRIPTION_CATEGORY_HINTS: Record<string, string[]> = {
  'Food & Dining': ['grocery', 'food', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack', 'pizza', 'burger', 'sushi', 'meal', 'eat', 'cook', 'bakery', 'dessert', 'takeout', 'delivery', 'doordash', 'ubereats', 'grubhub', 'catering', 'bar', 'drink', 'wine', 'beer', 'cocktail'],
  'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'petrol', 'bus', 'train', 'metro', 'subway', 'parking', 'toll', 'car', 'bike', 'ride', 'transport', 'flight', 'airline', 'plane', 'rental', 'maintenance', 'repair', 'tire', 'insurance', 'registration', 'toll'],
  'Shopping': ['amazon', 'ebay', 'clothes', 'shoe', 'electronics', 'gift', 'fashion', 'store', 'mall', 'shop', 'purchase', 'buy', 'decor', 'furniture', 'pet', 'book', 'beauty', 'cosmetic', 'sport', 'outdoor', 'hardware', 'tool', 'subscription'],
  'Entertainment': ['movie', 'netflix', 'spotify', 'game', 'concert', 'show', 'theater', 'sports', 'hobby', 'gaming', 'music', 'streaming', 'arcade', 'bowling', 'theme park', 'zoo', 'museum', 'club', 'nightlife', 'photography'],
  'Healthcare': ['doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'dental', 'health', 'medical', 'vitamin', 'therapy', 'gym', 'fitness', 'dentist', 'eye', 'vision', 'therapy', 'psychologist', 'urgent', 'lab', 'spa'],
  'Bills & Utilities': ['electric', 'water', 'internet', 'phone', 'bill', 'utility', 'cable', 'wifi', 'hoa', 'trash', 'security'],
  'Housing & Utilities': ['rent', 'mortgage', 'electric', 'water', 'gas', 'internet', 'phone', 'cable', 'maintenance', 'repair', 'cleaning', 'furniture'],
  'Financial Expenses': ['loan', 'credit card', 'interest', 'insurance', 'investment', 'bank fee', 'tax', 'retirement', 'stock', 'crypto', 'bitcoin', 'legal', 'advisory'],
  'Salary': ['payroll', 'salary', 'wage', 'overtime', 'bonus', 'commission', 'severance', 'pto', 'pension'],
  'Freelance': ['freelance', 'client', 'consulting', 'design', 'writing', 'coding', 'photography', 'tutor', 'affiliate', 'course'],
  'Business': ['business', 'revenue', 'product', 'service', 'subscription', 'partnership', 'ecommerce', 'advertising', 'royalty', 'franchise', 'dividend'],
  'Investment': ['dividend', 'capital gain', 'stock', 'bond', 'crypto', 'mutual fund', 'etf', 'interest', 'royalty'],
  'Gift': ['gift', 'birthday', 'holiday', 'wedding', 'cash', 'inheritance', 'scholarship', 'prize', 'award'],
  'Refund': ['refund', 'return', 'tax', 'reimbursement', 'cashback', 'deposit', 'warranty', 'claim'],
  'Other': []
};

export function getSuggestedCategory(description: string, categories: string[]): string | null {
  const lowerDesc = description.toLowerCase();
  for (const [category, keywords] of Object.entries(DESCRIPTION_CATEGORY_HINTS)) {
    if (categories.includes(category) && keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category;
    }
  }
  return null;
}

// Helper function to format cents for display in forms
export function formatCentsForForm(cents: number): string {
  return fromCents(cents).toString();
}

// Helper function to parse form input to cents
export function parseFormAmountToCents(amountString: string): number {
  return parseDollarsToCents(amountString);
}

export function AddExpense() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { expenses, wallets, categories, budgets, addExpense, updateExpense, addCategory, addWallet } = useExpenses();
  const { allowBudgetAlerts, baseCurrency, exchangeRates } = useSettings();

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlType = searchParams.get('type');

  const expenseId = id ? Number(id) : undefined;
  const existingExpense = expenseId ? expenses.find(e => e.id === expenseId) : null;
  const isEditing = !!existingExpense;
  const uniqueDescriptions = Array.from(new Set(expenses.map(e => e.description).filter(Boolean)));
  
  // State declarations
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [isGoalGeneratedTransaction, setIsGoalGeneratedTransaction] = useState(false);
  const [showQuickWalletModal, setShowQuickWalletModal] = useState(false);
  const [quickWalletName, setQuickWalletName] = useState('');
  const [quickWalletType, setQuickWalletType] = useState<'bank' | 'cash' | 'card'>('bank');
  const [quickWalletBalance, setQuickWalletBalance] = useState('');
  const [quickWalletCurrency, setQuickWalletCurrency] = useState(() => baseCurrency || 'USD');
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempSubs, setTempSubs] = useState<string[]>([]);
  const [tempSubInput, setTempSubInput] = useState('');
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
  const [newCategoryIcon, setNewCategoryIcon] = useState('HelpCircle');
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(existingExpense?.receiptImage || null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingBudgetWarning, setPendingBudgetWarning] = useState<{
    budget: number;
    spent: number;
    newTotal: number;
    amount: number;
    category: string;
  } | null>(null);

  // Smart Category Management
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [recentCategories, setRecentCategories] = useState<CategoryDb[]>([]);
  const [favoriteCategories, setFavoriteCategories] = useState<CategoryDb[]>([]);
  
  // Enhanced detection for savings goal payouts with multiple criteria
  const isSavingsGoalPayout = useMemo(() => {
    if (!existingExpense) return false;
    
    // Check multiple criteria for goal-generated transactions
    return (
      existingExpense.category === 'Goal Fulfillment' ||
      existingExpense.savings_goal_id !== undefined && existingExpense.savings_goal_id !== null ||
      existingExpense.is_auto_sweep_payout === true ||
      (existingExpense.description && 
       (existingExpense.description.includes('Goal Fulfilled') ||
        existingExpense.description.includes('Goal Fulfillment') ||
        existingExpense.description.includes('Savings Goal') ||
        existingExpense.description.includes('Goal Payout')))
    );
  }, [existingExpense]);

  // Detect internal transfers (auto-sweep allocations or vault reallocations)
  const isInternalTransfer = useMemo(() => {
    if (!existingExpense) return false;
    return (
      existingExpense.description?.includes('Auto-sweep') ||
      existingExpense.description?.includes('Reallocated')
    );
  }, [existingExpense]);

  // Reallocation-specific detection for submit validation only
  const isReallocationTransfer = useMemo(() => {
    if (!existingExpense) return false;
    return (
      existingExpense.category === 'Fixed Assets' &&
      existingExpense.description?.includes('Reallocated') &&
      String(existingExpense.type).toLowerCase() === 'transfer'
    );
  }, [existingExpense]);

  const cleanDescription = (rawDesc: string) => {
    if (rawDesc.includes('🚗 🚗')) {
      return rawDesc.replace('🚗 🚗', '🚗');
    }
    return rawDesc;
  };

  // Detect asset disbursal goal-fulfilled transactions (physical asset purchases)
  const isAssetDisbursal = useMemo(() => {
    if (!existingExpense) return false;
    return (
      existingExpense.description?.includes('(Goal Fulfilled)') &&
      existingExpense.category === 'Fixed Assets'
    );
  }, [existingExpense]);

  const [formData, setFormData] = useState(() => {
    let initSub = existingExpense?.subcategory || '';
    if (isAssetDisbursal && existingExpense?.description) {
      initSub = classifyGoalFulfillment(existingExpense.description).sub;
    }
    return {
      description: cleanDescription(existingExpense?.description || ''),
      amount: existingExpense ? fromCents(existingExpense.amount).toString() : '',
      category: isInternalTransfer ? 'System Transfer' : (isAssetDisbursal ? 'Fixed Assets' : (existingExpense?.category || '')),
      subcategory: isInternalTransfer ? '' : initSub,
      date: existingExpense?.date || toLocalDateString(),
      walletId: existingExpense?.wallet_id?.toString() || '',
      type: (isInternalTransfer ? 'transfer' : (isSavingsGoalPayout ? 'expense' : existingExpense?.type || urlType || 'expense')) as 'expense' | 'income' | 'transfer',
    };
  });

  // Live check on the form description for asset purchase detection (re-evaluates on every keystroke)
  const isAssetPurchase = formData.description && /\(Goal Fulfilled\)/i.test(formData.description);

  // Lock type/category for internal transfers (auto-sweep, reallocated)
  useEffect(() => {
    if (isInternalTransfer) {
      setSelectedMainCategory('System Transfer');
      setFormData(prev => ({
        ...prev,
        type: 'transfer',
        category: 'System Transfer',
        subcategory: ''
      }));
    }
  }, [isInternalTransfer]);

  // Lock category to Fixed Assets with word-boundary-classified subcategory
  useEffect(() => {
    if (isAssetDisbursal && existingExpense?.description) {
      const { sub } = classifyGoalFulfillment(existingExpense.description);
      setSelectedMainCategory('Fixed Assets');
      setFormData(prev => ({
        ...prev,
        category: 'Fixed Assets',
        subcategory: sub
      }));
    }
  }, [isAssetDisbursal]);

  // Detect if this is a goal-generated transaction (excludes internal transfers)
  useEffect(() => {
    setIsGoalGeneratedTransaction(isSavingsGoalPayout && !isInternalTransfer);
    
    // If it's a goal transaction, force type to expense during initialization
    if (isSavingsGoalPayout && !isInternalTransfer && existingExpense?.type !== 'expense') {
      setFormData(prev => ({ ...prev, type: 'expense' }));
    }
  }, [isSavingsGoalPayout, isInternalTransfer, existingExpense]);

  // Prevent type changes for goal transactions in form state - multiple layers of protection
  useEffect(() => {
    if (isGoalGeneratedTransaction && !isInternalTransfer && formData.type !== 'expense') {
      setFormData(prev => ({ ...prev, type: 'expense' }));
    }
  }, [isGoalGeneratedTransaction, isInternalTransfer, formData.type]);
  
  // Additional protection: continuously monitor and enforce goal transaction type
  useEffect(() => {
    if (isGoalGeneratedTransaction && !isInternalTransfer) {
      // Double-check that the form state is correct
      if (formData.type !== 'expense') {
        setFormData(prev => ({ ...prev, type: 'expense' }));
      }
    }
  }, [isGoalGeneratedTransaction, isInternalTransfer, formData.type]);
  
  // Final protection layer: ensure goal transactions always stay as expense
  useEffect(() => {
    if (isGoalGeneratedTransaction && !isInternalTransfer && formData.type !== 'expense') {
      console.warn('GOAL TRANSACTION SECURITY VIOLATION: Attempt to change type from expense');
      setFormData(prev => ({ ...prev, type: 'expense' }));
    }
  }, [formData.type, isGoalGeneratedTransaction, isInternalTransfer]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };



  const fxRate = (exchangeRates || DEFAULT_EXCHANGE_RATES)[baseCurrency] || 1;
  const selectedWallet = wallets.find(w => w.id === Number(formData.walletId));

  const mainCategories = useMemo(() => {
    // For asset disbursals, show Fixed Assets even though it's filtered elsewhere
    if (isAssetDisbursal) {
      return categories.filter(cat =>
        cat.name === 'Fixed Assets' &&
        cat.parent_id === null
      );
    }
    // For internal transfers, return no categories (we use locked "System Transfer" display)
    if (isInternalTransfer) {
      return [];
    }
    return categories.filter(cat =>
      cat.name !== 'Savings Transfer' &&
      cat.name !== 'Fixed Assets' &&
      cat.parent_id === null &&
      (cat.type === 'both' || cat.type === formData.type)
    );
  }, [categories, formData.type, isAssetDisbursal, isInternalTransfer]);

  const selectedMainCategoryObj = useMemo(() =>
    mainCategories.find(c => c.name === selectedMainCategory), [mainCategories, selectedMainCategory]);

  const subCategories = useMemo(() =>
    selectedMainCategoryObj
      ? categories
          .filter(cat => cat.parent_id === selectedMainCategoryObj.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      : []
  , [categories, selectedMainCategoryObj]);

  useEffect(() => {
    if (formData.category && !selectedMainCategory) {
      const catObj = categories.find(c => c.name === formData.category);
      if (catObj && catObj.parent_id != null) {
        const parentCat = categories.find(c => c.id === catObj.parent_id);
        if (parentCat) setSelectedMainCategory(parentCat.name);
      } else if (catObj && catObj.parent_id === null) {
        setSelectedMainCategory(catObj.name);
      }
    }
  }, [formData.category, categories, selectedMainCategory]);

  const accentRing = String(formData.type).toLowerCase() === 'income'
    ? 'focus:ring-emerald-400 dark:focus:ring-emerald-600'
    : 'focus:ring-zinc-400 dark:focus:ring-zinc-600';
  const isIncome = String(formData.type).toLowerCase() === 'income';

  const handleDescriptionChange = (value: string) => {
    // Don't auto-suggest categories for internal transfers or asset disbursals
    if (isInternalTransfer || isAssetDisbursal) {
      setFormData(prev => ({ ...prev, description: value }));
      return;
    }
    const categoryNames = categories
      .filter(c => c.name !== 'Savings Transfer' && c.name !== 'Fixed Assets' && (c.type === 'both' || String(c.type).toLowerCase() === String(formData.type).toLowerCase()))
      .map(c => c.name);
    const suggested = getSuggestedCategory(value, categoryNames);
    setFormData(prev => ({
      ...prev,
      description: value,
      category: suggested && !prev.category ? suggested : prev.category
    }));
  };

  // Smart Category Functions
  const getSuggestedCategory = (description: string, categoryNames: string[]): string | null => {
    if (!description) return null;
    
    const lowerDesc = description.toLowerCase();
    const keywords = {
      'Food & Dining': ['restaurant', 'food', 'dining', 'meal', 'breakfast', 'lunch', 'dinner', 'coffee', 'cafe', 'pizza', 'burger'],
      'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'parking', 'toll'],
      'Shopping': ['amazon', 'walmart', 'target', 'store', 'mall', 'shop', 'buy', 'purchase'],
      'Entertainment': ['movie', 'netflix', 'spotify', 'game', 'concert', 'event', 'streaming'],
      'Bills & Utilities': ['electric', 'water', 'gas', 'internet', 'phone', 'cable', 'bill'],
      'Healthcare': ['doctor', 'hospital', 'pharmacy', 'medicine', 'health', 'dental', 'vision'],
      'Education': ['school', 'tuition', 'book', 'course', 'university', 'college'],
      'Travel': ['hotel', 'flight', 'airbnb', 'vacation', 'trip', 'travel'],
      'Income': ['salary', 'wage', 'paycheck', 'freelance', 'contract', 'dividend'],
    };
    
    // Check for keyword matches
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerDesc.includes(word))) {
        return category;
      }
    }
    
    // Check for exact matches in category names
    for (const category of categoryNames) {
      if (lowerDesc.includes(category.toLowerCase())) {
        return category;
      }
    }
    
    return null;
  };

  const getUsageCount = (categoryName: string): number => {
    return expenses.filter(exp => exp.category === categoryName).length;
  };

  const getSmartSuggestions = (description: string): string[] => {
    if (!description) return [];
    
    const suggestions: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Common expense patterns
    const patterns = {
      'Food & Dining': ['restaurant', 'food', 'dining', 'coffee', 'meal'],
      'Transportation': ['gas', 'fuel', 'uber', 'taxi', 'parking'],
      'Shopping': ['store', 'buy', 'purchase', 'amazon'],
      'Bills & Utilities': ['bill', 'electric', 'water', 'internet'],
      'Healthcare': ['doctor', 'hospital', 'pharmacy', 'medicine'],
    };
    
    for (const [category, words] of Object.entries(patterns)) {
      if (words.some(word => lowerDesc.includes(word))) {
        suggestions.push(category);
      }
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  };

  // Initialize smart data
  useEffect(() => {
    // Get recent categories (last 10 used)
    const recent = expenses
      .slice(-20)
      .filter(exp => exp.category && exp.category !== 'Savings Transfer' && exp.category !== 'Fixed Assets')
      .map(exp => exp.category)
      .filter((category, index, arr) => arr.indexOf(category) === index) // Remove duplicates
      .slice(0, 5)
      .map(category => categories.find(c => c.name === category))
      .filter(Boolean) as CategoryDb[];
    
    setRecentCategories(recent);
    
    // Get favorite categories (most used)
    const categoryCounts = expenses
      .filter(exp => exp.category && exp.category !== 'Savings Transfer' && exp.category !== 'Fixed Assets')
      .reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const favorites = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => categories.find(c => c.name === category))
      .filter(Boolean) as CategoryDb[];
    
    setFavoriteCategories(favorites);
    
    // Generate smart suggestions based on description
    if (formData.description) {
      const suggestions = getSmartSuggestions(formData.description);
      setSmartSuggestions(suggestions);
    }
  }, [expenses, categories, formData.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    const amountCents = parseDollarsToCents(formData.amount);
    if (!formData.amount || isNaN(amountCents) || amountCents <= 0) {
      toast.error('Please enter a valid amount greater than zero.');
      setIsSubmitting(false);
      return;
    }

    if (!formData.description || !formData.category || !formData.walletId) {
      toast.error('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }
    if (String(formData.type).toLowerCase() !== 'income' && String(formData.type).toLowerCase() !== 'transfer' && selectedWallet) {
      if (amountCents > selectedWallet.balance) {
        toast.error(`Insufficient funds in this wallet. Available: ${formatMoney(selectedWallet.balance, baseCurrency)}`);
        setIsSubmitting(false);
        return;
      }
    }

    const categoryBudget = budgets.find(b => b.category_name === formData.category);
    if (String(formData.type).toLowerCase() !== 'income' && String(formData.type).toLowerCase() !== 'transfer' && categoryBudget && !isEditing) {
      const spentBaseCents = roundMoney(
        expenses.filter(e => e.category === formData.category && e.type !== 'income')
          .reduce((sum, e) => sum + (e.amount || 0), 0)
      );
      if (spentBaseCents + amountCents > categoryBudget.limit_amount) {
        if (allowBudgetAlerts) {
          setPendingBudgetWarning({
            budget: categoryBudget.limit_amount,
            spent: spentBaseCents,
            newTotal: spentBaseCents + amountCents,
            amount: amountCents,
            category: formData.category,
          });
          setShowWarningModal(true);
          return;
        }
      }
    }

    const categoryName = selectedMainCategory || formData.category;
    
    // For internal transfers, force type to 'transfer'
    // For goal-generated transactions, force type to 'expense' to prevent database imbalance
    // This hard-lock cannot be bypassed even via developer tools
    const finalType = isInternalTransfer ? 'transfer' : (isGoalGeneratedTransaction ? 'expense' : formData.type);
    
    // Final validation: ensure goal transactions are always expenses
    if (isGoalGeneratedTransaction && !isInternalTransfer && finalType !== 'expense') {
      console.error('CRITICAL SECURITY VIOLATION: Attempt to bypass goal transaction type lock');
      toast.error('System security prevented invalid transaction type change. Goal transactions must remain as expenses.');
      return;
    }
    
    const expenseData = {
      description: cleanDescription(formData.description),
      amount: amountCents,
      category: categoryName,
      subcategory: formData.subcategory || undefined,
      date: formData.date,
      receiptImage: receiptBase64,
      type: finalType,
    };

    try {
      if (isEditing && expenseId) {
        console.log('DEBUG: Starting update for expense ID:', expenseId);
        console.log('DEBUG: Existing expense:', expenses.find(e => e.id === expenseId));
        
        const existing = expenses.find(e => e.id === expenseId);
        
        if (!existing) {
          console.error('ERROR: Expense not found in context with ID:', expenseId);
          toast.error('Expense not found. Please refresh the page and try again.');
          return;
        }
        
        // Prevent type changes for goal-generated transactions
        if (isGoalGeneratedTransaction && !isInternalTransfer && formData.type !== 'expense') {
          toast.error('Cannot change type for goal-generated transactions. Type must remain as Expense.');
          return;
        }
        // Enhanced handling for System Transfer reallocations
        const isReallocation = existing?.category === 'System Transfer';
        
        if (isReallocation) {
          const delta = amountCents - Math.abs(existing?.amount || 0);
          
          await db.transaction('rw', ['expenses', 'savings_goals'], async () => {
            await db.expenses.update(expenseId, {
              ...expenseData,
              wallet_id: Number(formData.walletId)
            });
            
            const allGoals = await db.savings_goals.toArray();
            const carGoal = allGoals.find(g => g.name.toUpperCase() === 'CAR');
            
            if (carGoal) {
              if (delta > 0 && (carGoal.current_amount || 0) < delta) {
                throw new Error('Insufficient funds in source vault to increase this reallocation.');
              }
              await db.savings_goals.update(carGoal.id!, {
                current_amount: (carGoal.current_amount || 0) - delta
              });
            }
            
            const emergencyGoal = allGoals.find(g => g.name.toUpperCase().includes('EMERGENCY') || g.name === 'Emergency Fund');
            if (emergencyGoal) {
              await db.savings_goals.update(emergencyGoal.id!, {
                current_amount: (emergencyGoal.current_amount || 0) + delta
              });
            }
          });
          
          toast.success('Transaction updated successfully with vault adjustments.');
          navigate('/expenses');
          return;
        }
        
        // Enhanced handling for Asset Disbursal (Goal Fulfilled) transactions
        const isAssetDisbursal = (existing?.category === 'Transportation' && existing?.subcategory === 'Savings Goal Payout') || existing?.description?.includes('(Goal Fulfilled)');
        
        console.log('DEBUG [asset disbursal]: isAssetDisbursal =', isAssetDisbursal, '| category =', existing?.category, '| subcategory =', existing?.subcategory, '| description =', existing?.description);
        
        if (isAssetDisbursal) {
          const delta = amountCents - Number(existing?.amount);
          const { sub } = classifyGoalFulfillment(existing?.description || '');
          
          console.log('DEBUG [asset disbursal]: delta =', delta, '| amountCents =', amountCents, '| existing.amount =', existing?.amount);
          
          await db.transaction('rw', ['expenses', 'savings_goals'], async () => {
            console.log('DEBUG [asset disbursal]: Inside atomic transaction');
            
            await db.expenses.update(Number(existing?.id), {
              amount: Number(amountCents),
              category: 'Fixed Assets',
              subcategory: sub,
              wallet_id: Number(formData.walletId)
            });
            
            const allGoals = await db.savings_goals.toArray();
            console.log('DEBUG [asset disbursal]: allGoals =', allGoals.map(g => ({ id: g.id, name: g.name, current_amount: g.current_amount })));
            
            const linkedGoal = allGoals.find(g =>
              existing!.description!.toUpperCase().includes(g.name.toUpperCase())
            );
            
            console.log('DEBUG [asset disbursal]: linkedGoal =', linkedGoal, '| description =', existing?.description);
            
            if (linkedGoal) {
              const newAmount = Number(((linkedGoal.current_amount || 0) - delta).toFixed(2));
              console.log('DEBUG [asset disbursal]: Updating goal', linkedGoal.id, '| current_amount:', linkedGoal.current_amount, '->', newAmount);
              
              await db.savings_goals.update(linkedGoal.id!, {
                current_amount: newAmount
              });
            } else {
              console.log('DEBUG [asset disbursal]: No matching goal found - SKIPPING goal update');
            }
          });
          
          toast.success('Asset purchase updated with Fixed Assets categorization and goal chart sync.');
          navigate('/expenses');
          return;
        }
        
        // Standard update for non-system transfers
        console.log('DEBUG: Standard update for expense ID:', expenseId);
        await updateExpense(expenseId, { ...expenseData, wallet_id: Number(formData.walletId) });
        toast.success('Transaction updated successfully');
        navigate('/expenses');
      } else {
        await addExpense(expenseData, Number(formData.walletId));
        toast.success('Transaction added successfully');
        setFormData({
          description: '',
          amount: '',
          category: '',
          subcategory: '',
          date: toLocalDateString(),
          walletId: '',
          type: 'expense',
        });
        setReceiptBase64(null);
      }
    } catch (err: any) {
      console.error('Transaction update failed:', err);
      let errorMessage = 'Failed to save expense';
      
      if (err.message) {
        if (err.message.includes('Insufficient funds in source vault')) {
          errorMessage = 'Insufficient funds in source vault to increase this reallocation.';
        } else if (err.message.includes('Database constraint violation')) {
          errorMessage = 'Cannot update goal-generated transaction. Category changes are restricted for automatic savings goal payouts.';
        } else if (err.message.includes('Failed to update transaction')) {
          errorMessage = err.message;
        } else if (err.message.includes('Goal transaction update failed')) {
          errorMessage = 'Unable to update savings goal payout transaction. Please try updating only the description or other non-category fields.';
        } else if (err.message.includes('Source vault not found')) {
          errorMessage = 'Source vault not found for this reallocation. Please contact support.';
        } else {
          errorMessage = err.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
};

  const handleProceedAnyway = async () => {
    if (!pendingBudgetWarning) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    const amountCents = parseDollarsToCents(formData.amount);
    const categoryName = selectedMainCategory || formData.category;
    const expenseData = {
      description: formData.description,
      amount: amountCents,
      category: categoryName,
      subcategory: formData.subcategory || undefined,
      date: formData.date,
      receiptImage: receiptBase64,
      type: formData.type,
    };

    try {
      await addExpense(expenseData, Number(formData.walletId));
      toast.success('Transaction added successfully');
      setFormData({
        description: '',
        amount: '',
        category: '',
        subcategory: '',
        date: toLocalDateString(),
        walletId: '',
        type: 'expense',
      });
      setReceiptBase64(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
    setShowWarningModal(false);
    setPendingBudgetWarning(null);
  };

  const handleQuickAddCategory = async () => {
    // Enhanced validation
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    
    if (newCategoryName.trim().length < 3) {
      toast.error('Category name must be at least 3 characters long');
      return;
    }
    
    // Check for duplicate category names
    const existingCategory = categories.find(c => 
      c.name.trim().toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    if (existingCategory) {
      toast.error(`Category "${newCategoryName}" already exists`);
      return;
    }
    
    if (isSubcategory && !selectedParentId) {
      toast.error('Please select a parent category for your subcategory');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      if (isSubcategory) {
        // Add subcategory
        await addCategory(newCategoryName, newCategoryType, newCategoryIcon, selectedParentId);
        toast.success(`✅ Subcategory "${newCategoryName}" added successfully`);
      } else {
        // Add main category with optional subcategories
        const newParentId = await db.categories.add({
          name: newCategoryName.trim(),
          icon: newCategoryIcon,
          type: newCategoryType,
          parent_id: null,
          created_at: new Date().toISOString()
        });
        
        // Add subcategories if any
        if (tempSubs.length > 0) {
          for (const subName of tempSubs) {
            if (subName.trim()) {
              await db.categories.add({
                name: subName.trim(),
                icon: newCategoryIcon,
                type: newCategoryType,
                parent_id: newParentId,
                created_at: new Date().toISOString()
              });
            }
          }
          toast.success(`✅ Category "${newCategoryName}" and ${tempSubs.length} subcategories added successfully`);
        } else {
          toast.success(`✅ Category "${newCategoryName}" added successfully`);
        }
      }
      
      // Update form with new category
      const newCats = await db.categories.toArray();
      const created = newCats.find(c => c.name.trim().toLowerCase() === newCategoryName.trim().toLowerCase());
      if (created) {
        setFormData(prev => ({ ...prev, category: created.name }));
        setSelectedMainCategory(created.name);
      }
      
      // Reset form
      setNewCategoryName('');
      setNewCategoryType('expense');
      setNewCategoryIcon('HelpCircle');
      setIsSubcategory(false);
      setSelectedParentId(null);
      setTempSubs([]);
      setTempSubInput('');
      setShowQuickCategoryModal(false);
      
    } catch (error: any) {
      console.error('Category creation error:', error);
      toast.error(error.message || '❌ Failed to add category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTempSub = () => {
    const name = tempSubInput.trim();
    if (!name) return;
    if (tempSubs.some(s => s.toLowerCase() === name.toLowerCase())) {
      toast.error('Subcategory already added');
      return;
    }
    setTempSubs([...tempSubs, name]);
    setTempSubInput('');
  };

  const handleRemoveTempSub = (index: number) => {
    setTempSubs(tempSubs.filter((_, i) => i !== index));
  };

  const handleQuickAddWallet = async () => {
    if (!quickWalletName) {
      toast.error('Please enter a wallet name');
      return;
    }
    try {
      await addWallet({
        name: String(quickWalletName).trim(),
        type: String(quickWalletType),
        currency: String(baseCurrency),
        balance: quickWalletBalance === '' || isNaN(Number(quickWalletBalance)) 
          ? 0 
          : Number(quickWalletBalance) // Pass as dollars, addWallet will convert to cents
      });
      // Refresh wallets to get the new wallet with generated ID
      const updatedWallets = await db.wallets.toArray();
      const newWallet = updatedWallets.find(w => w.name === String(quickWalletName).trim());
      if (newWallet) {
        setFormData(prev => ({ ...prev, walletId: String(newWallet.id) }));
      }
      setQuickWalletName('');
      setQuickWalletBalance('');
      setShowQuickWalletModal(false);
      toast.success('Wallet added with initial balance transaction');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add wallet');
    }
  };

  // Reactive data-dirty evaluator — monitors every editable field against its initial baseline
  const originalWallet = existingExpense?.wallet_id?.toString() || '';
  const originalDescription = cleanDescription(existingExpense?.description || '');
  const originalAmount = existingExpense ? fromCents(existingExpense.amount).toString() : '';
  const originalDate = existingExpense?.date || '';
  const originalFile = existingExpense?.receiptImage || null;

  const isFormDirty = !isEditing || (
    formData.walletId !== originalWallet ||
    formData.description !== originalDescription ||
    Number(formData.amount) !== Number(originalAmount) ||
    formData.date !== originalDate ||
    receiptBase64 !== originalFile
  );

  if (wallets.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-text-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <Card className="bg-bg-card border border-border-main rounded-xl shadow-md">
          <CardContent className="pt-6 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-text-muted" />
            <h2 className="text-xl font-semibold mb-2 text-text-primary">No Wallets Found</h2>
            <p className="text-text-muted mb-4">Please create a wallet first before adding expenses.</p>
            <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-text-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

<div className="w-full h-auto flex flex-col justify-start items-start mt-3 ml-0 md:ml-4 lg:ml-6">
           <div>
             <h1 className="text-2xl font-bold">
               {isEditing ? 'Edit Transaction' : 'Add New Transaction'}
             </h1>
             <p className="text-text-secondary mt-0.5 text-sm">
               {isEditing ? 'Update transaction details' : 'Enter the details of your transaction'}
             </p>
           </div>

          <div className="bg-white dark:bg-card border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-md p-4 sm:p-5 max-w-xl w-full mt-4">
            {isInternalTransfer ? (
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-200/20 rounded-full w-fit mb-4">
                <div className="rounded-full px-5 py-1.5 text-sm font-medium bg-blue-600 text-white shadow-sm flex items-center gap-1">
                  <span>🔄</span> Internal Transfer
                </div>
              </div>
              ) : isAssetPurchase ? (
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-200/20 rounded-full w-fit mb-4">
                <div className="rounded-full px-5 py-1.5 text-sm font-medium bg-purple-600 text-white shadow-sm flex items-center gap-1">
                  <span>🔒</span> Asset Disbursal
                </div>
              </div>
            ) : (
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-200/20 rounded-full w-fit mb-4">
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: '' }))}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${String(formData.type).toLowerCase() === 'expense' ? 'bg-orange-400 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'} ${isGoalGeneratedTransaction ? 'ring-2 ring-orange-300' : ''}`}
              >
                {isGoalGeneratedTransaction && <span className="mr-1">🔒</span>}Expense
              </button>
              <button 
                type="button" 
                onClick={() => {
                  if (!isGoalGeneratedTransaction) {
                    setFormData(prev => ({ ...prev, type: 'income', category: '' }));
                  }
                }}
                disabled={isGoalGeneratedTransaction}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${String(formData.type).toLowerCase() === 'income' ? 'bg-teal-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'} ${isGoalGeneratedTransaction ? 'opacity-50 cursor-not-allowed select-none' : ''}`}
              >
                {isGoalGeneratedTransaction ? (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Income</span>
                    <span className="text-xs">🔒</span>
                  </span>
                ) : (
                  'Income'
                )}
              </button>
            </div>
            )}
            {isInternalTransfer && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-[11px] text-blue-800 dark:text-blue-200 font-medium leading-tight">
                  ℹ️ <strong>SYSTEM RUNTIME INFO:</strong> This transaction represents an internal capital move to a savings vault. Checking wallet cash balances adapt automatically, while overall spending analytics are safely bypassed.
                </p>
              </div>
            )}
            {isAssetPurchase && (
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-[11px] text-purple-800 dark:text-purple-200 font-medium leading-tight">
                  ⚠️ <strong>ASSET ACQUISITION LOCK:</strong> This transaction represents a physical asset purchase from a completed savings goal. Category tracking fields are locked to preserve reporting data integrity.
                </p>
              </div>
            )}
            {isGoalGeneratedTransaction && !isInternalTransfer && !isAssetPurchase && (
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-[11px] text-red-800 dark:text-red-200 font-medium leading-tight">
                  🔒 <strong>SECURITY LOCK:</strong> Linked to a savings goal payout. Type permanently locked to 'Expense'.
                </p>
              </div>
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">Transaction Details</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="wallet" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Wallet *</Label>
                <Select
                  value={formData.walletId}
                  onValueChange={(value) => {
                    if (value === '___ADD_NEW_WALLET___') {
                      setShowQuickWalletModal(true);
                    } else {
                      setFormData(prev => ({ ...prev, walletId: value }));
                    }
                  }}
                >
                  <SelectTrigger id="wallet" className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                      {wallets.map(wallet => (
                      <SelectItem key={wallet.id} value={String(wallet.id)}>
                         {wallet.name} - {formatMoney(wallet.balance, baseCurrency)}
                      </SelectItem>
                    ))}
                    <SelectItem value="___ADD_NEW_WALLET___" className="text-emerald-600 font-semibold">
                      + Add New Wallet
                    </SelectItem>
                  </SelectContent>
                </Select>
                    {selectedWallet && !isIncome && String(formData.type).toLowerCase() !== 'transfer' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Available balance: {formatMoney(selectedWallet.balance, baseCurrency)}</p>
                )}
              </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                list="description-history"
                className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
                placeholder={isIncome ? "e.g., Monthly Salary" : "e.g., Grocery Shopping"}
              />
              <datalist id="description-history">
                {uniqueDescriptions.map((desc, idx) => (
                  <option key={idx} value={desc} />
                ))}
              </datalist>
            </div>

              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount</Label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Main Category</Label>
                {isInternalTransfer ? (
                  <div className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold text-sm p-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                    <span className="p-1 rounded-md flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                      <CategoryIcon name="ArrowLeftRight" className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    </span>
                    System Transfer
                    <span className="ml-auto text-[10px] opacity-60">🔒 System locked</span>
                  </div>
            ) : isAssetPurchase ? (
                  <div className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold text-sm p-3 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                    <span className="p-1 rounded-md flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                      <CategoryIcon name="Package" className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                    </span>
                    Fixed Assets
                    <span className="ml-auto text-[10px] opacity-60">🔒 System locked</span>
                  </div>
                ) : (
                <div className="space-y-2">
                  {/* Smart Category Suggestions */}
                  {formData.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                      💡 Based on "{formData.description}", you might want:
                    </div>
                  )}
                  
                  <Select
                    value={selectedMainCategory}
                    onValueChange={(value) => {
                      if (value === '___ADD_NEW_CATEGORY___') {
                        setShowQuickCategoryModal(true);
                      } else {
                        setSelectedMainCategory(value);
                        setFormData(prev => ({ ...prev, category: value, subcategory: '' }));
                      }
                    }}
                  >
                    <SelectTrigger id="main-category" className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                      <SelectValue placeholder={isIncome ? "Select income type" : "Select main category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Recent/Favorite Categories */}
                      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">RECENT</div>
                        {recentCategories.slice(0, 3).map(cat => (
                          <SelectItem key={`recent-${cat.id}`} value={cat.name}>
                            <span className="flex items-center gap-2">
                              <span className={`p-1 rounded-md flex items-center justify-center ${getCategoryColor(cat.name).bg}`}>
                                <CategoryIcon name={cat.icon || 'Circle'} className={`w-4 h-4 ${getCategoryColor(cat.name).text}`} />
                              </span>
                              {cat.name}
                              <span className="text-xs text-slate-400 ml-auto">{getUsageCount(cat.name)} uses</span>
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                      
                        {/* Main Categories */}
                        <div className="p-2">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">CATEGORIES</div>
                          {mainCategories.filter(cat => !recentCategories.some(r => r.id === cat.id)).map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>
                              <span className="flex items-center gap-2">
                                <span className={`p-1 rounded-md flex items-center justify-center ${getCategoryColor(cat.name).bg}`}>
                                  <CategoryIcon name={cat.icon || 'Circle'} className={`w-4 h-4 ${getCategoryColor(cat.name).text}`} />
                                </span>
                                 <div>
                                   <span className="text-sm">{cat.name}</span>
                                   {cat.type === 'expense' && (
                                     <span className="text-xs text-red-500 ml-1">📉</span>
                                   )}
                                   {cat.type === 'income' && (
                                     <span className="text-xs text-green-500 ml-1">📈</span>
                                   )}
                                   {cat.type === 'both' && (
                                     <span className="text-xs text-blue-500 ml-1">🔄</span>
                                   )}
                                 </div>
                               </span>
                             </SelectItem>
                          ))}
                        </div>
                      
                      <SelectItem value="___ADD_NEW_CATEGORY___" className="text-emerald-600 font-semibold">
                        + Add New Category
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                )}
              </div>

              {isInternalTransfer ? (
              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategory</Label>
                <div className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold text-sm p-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                  <span className="p-1 rounded-md flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                    <CategoryIcon name="ArrowLeftRight" className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  </span>
                  Vault Allocation
                  <span className="ml-auto text-[10px] opacity-60">🔒 System locked</span>
                </div>
              </div>
                  ) : isAssetPurchase ? (
              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategory</Label>
                <div className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold text-sm p-3 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                  <span className="p-1 rounded-md flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                    <CategoryIcon name="Package" className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                  </span>
                  {classifyGoalFulfillment(formData.description).sub}
                  <span className="ml-auto text-[10px] opacity-60">🔒 System locked</span>
                </div>
              </div>
              ) : selectedMainCategory && subCategories.length > 0 ? (
              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategory</Label>
                <Select
                  value={formData.subcategory}
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, subcategory: value }));
                  }}
                >
                  <SelectTrigger id="subcategory" className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">SUBCATEGORIES</div>
                      {subCategories.map(sub => (
                        <SelectItem key={sub.id} value={sub.name}>
                          <span className="flex items-center gap-2">
                            <span className={`p-1 rounded-md flex items-center justify-center ${getSubCategoryColor(selectedMainCategory || '').bg}`}>
                              <CategoryIcon name={sub.icon || 'Circle'} className={`w-4 h-4 ${getSubCategoryColor(selectedMainCategory || '').text}`} />
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{sub.name}</span>
                              {sub.type === 'expense' && (
                                <span className="text-xs text-red-500">📉</span>
                              )}
                              {sub.type === 'income' && (
                                <span className="text-xs text-green-500">📈</span>
                              )}
                            </div>
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              ) : null}

              <div className="flex flex-col gap-2 w-full">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</Label>
                <DatePicker
                  value={formData.date}
                  onChange={(value) => setFormData(prev => ({ ...prev, date: value }))}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{isIncome ? 'Attach Invoice / Pay Stub' : 'Attach Scanned Receipt'}</label>
                <input 
                  type="file" accept="image/*" onChange={handleReceiptChange}
                  className="w-full text-xs bg-slate-50 dark:bg-card text-slate-500 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 file:hover:bg-slate-300 dark:file:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 cursor-pointer rounded-lg py-2 px-3 transition-colors"
                />
                {receiptBase64 && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Receipt attached</p>
                    <button type="button" onClick={() => setReceiptBase64(null)} className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer">Remove</button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={!isFormDirty} className={`flex-1 font-semibold text-sm py-2 px-3 rounded-xl transition-all duration-200 text-white ${isFormDirty ? (isIncome ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-md' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-md') : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'}`}>{isEditing ? 'Update' : isIncome ? 'Save Income Source' : 'Add'}</button>
                <button type="button" onClick={() => navigate('/expenses')} className="bg-transparent border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium text-sm px-4 py-2 rounded-xl transition-all duration-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

      {showWarningModal && pendingBudgetWarning && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-bg-card p-6 rounded-2xl max-w-md w-full shadow-xl transform transition-all border border-border-main">
            <h2 className="text-xl font-bold text-amber-600 dark:text-amber-400 mb-4">⚠️ Budget Limit Warning</h2>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-text-secondary">
                <span className="font-semibold">Budget:</span> {formatMoney(pendingBudgetWarning.budget, baseCurrency)}
              </p>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold">Current Spent:</span> {formatMoney(pendingBudgetWarning.spent, baseCurrency)}
              </p>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold">Projected New Total:</span> {formatMoney(pendingBudgetWarning.newTotal, baseCurrency)}
              </p>
              <p className="text-base font-medium text-text-primary mt-4">
                Do you want to proceed with this transaction anyway?
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowWarningModal(false);
                  setPendingBudgetWarning(null);
                }}
                className="bg-bg-input text-text-secondary border-border-main"
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleProceedAnyway}
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

{showQuickCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border-main rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Add Category</h3>
                <p className="text-xs text-text-muted mt-1">Create a {isSubcategory ? 'subcategory' : 'category'} for better expense tracking</p>
              </div>
              <button 
                onClick={() => { setShowQuickCategoryModal(false); setIsSubcategory(false); setSelectedParentId(null); setTempSubs([]); setTempSubInput(''); setNewCategoryIcon('HelpCircle'); }}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="block text-sm font-medium text-text-secondary">Category Level</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="categoryLevel" checked={!isSubcategory} onChange={() => { setIsSubcategory(false); setSelectedParentId(null); setTempSubs([]); setTempSubInput(''); }} className="accent-blue-600" />
                    <span className="text-sm text-text-primary">Main Category</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="categoryLevel" checked={isSubcategory} onChange={() => { setIsSubcategory(true); setTempSubs([]); setTempSubInput(''); }} className="accent-blue-600" />
                    <span className="text-sm text-text-primary">Subcategory</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="block text-sm font-medium text-text-secondary mb-1">Name</Label>
                <Input 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={isSubcategory ? "e.g., Organic Produce" : "e.g., Groceries"}
                  className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="block text-sm font-medium text-text-secondary mb-1">Icon Selection</Label>
                <IconPicker 
                  selectedIcon={newCategoryIcon} 
                  onIconSelect={setNewCategoryIcon}
                  className="w-full"
                />
              </div>
              {isSubcategory && (
                <>
                  <div className="space-y-2">
                    <Label className="block text-sm font-medium text-text-secondary mb-1">Parent Category</Label>
                    <Select value={selectedParentId?.toString() || ''} onValueChange={(v) => setSelectedParentId(parseInt(v))}>
                      <SelectTrigger className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Select a parent category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.parent_id == null && c.name !== 'Savings Transfer').map(cat => (
                          <SelectItem key={cat.id} value={cat.id!.toString()}>
                            <div className="flex items-center gap-2">
                              <CategoryIcon name={cat.icon || 'Circle'} className="w-4 h-4" />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="block text-sm font-medium text-text-secondary mb-1">Subcategory Icon (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <CategoryIcon name={newCategoryIcon} className="w-5 h-5" />
                        <span className="text-sm text-text-secondary">{newCategoryIcon}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowIconPicker(!showIconPicker)}
                        className="px-3 py-2"
                      >
                        Change Icon
                      </Button>
                    </div>
                    {showIconPicker && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 border border-border-main rounded-lg">
                        <IconPicker 
                          selectedIcon={newCategoryIcon} 
                          onIconSelect={setNewCategoryIcon}
                          className="w-full"
                        />
                      </div>
                    )}
                    <p className="text-xs text-text-muted">Leave empty to use parent category's icon</p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="block text-sm font-medium text-text-secondary mb-1">Type</Label>
                <Select value={newCategoryType} onValueChange={(v) => setNewCategoryType(v as any)}>
                  <SelectTrigger className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {!isSubcategory && (
              <div className="space-y-2 border-t border-border-main pt-3">
                <Label className="block text-sm font-medium text-text-secondary mb-1">Initial Subcategories <span className="text-text-muted text-xs">(Optional)</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={tempSubInput}
                    onChange={(e) => setTempSubInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTempSub(); } }}
                    placeholder="Subcategory name"
                    className="flex-1 px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTempSub}
                    disabled={!tempSubInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Sub
                  </Button>
                </div>
                {tempSubs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tempSubs.map((sub, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 rounded-full px-3 py-1 text-xs font-medium">
                        {sub}
                        <button type="button" onClick={() => handleRemoveTempSub(i)} className="hover:text-red-500 transition-colors cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
        </div>
       )}
          </div>
            )}
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border-main">
            <Button 
              variant="outline" 
              onClick={() => { setShowQuickCategoryModal(false); setIsSubcategory(false); setSelectedParentId(null); setTempSubs([]); setTempSubInput(''); setNewCategoryIcon('HelpCircle'); }} 
              className="bg-bg-input text-text-secondary border-border-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleQuickAddCategory}
              disabled={!newCategoryName.trim() || (isSubcategory && !selectedParentId)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create {isSubcategory ? 'Subcategory' : 'Category'}
            </Button>
          </div>
         </div>
        </div>
       </div>
      )}

      {showQuickWalletModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border-main rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-text-primary mb-4">Add New Wallet</h3>
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-text-secondary mb-1">Name</Label>
                <Input
                  value={quickWalletName}
                  onChange={(e) => setQuickWalletName(e.target.value)}
                  placeholder="e.g., My Card"
                  className="w-full bg-bg-input border border-slate-300 dark:border-slate-700 text-text-primary rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-text-secondary mb-1">Type</Label>
                <Select value={quickWalletType} onValueChange={(v: any) => setQuickWalletType(v)}>
                  <SelectTrigger className="w-full bg-bg-input border border-slate-300 dark:border-slate-700 text-text-primary rounded-lg p-2.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">🏦 Bank Account</SelectItem>
                    <SelectItem value="cash">💵 Cash / Physical Wallet</SelectItem>
                    <SelectItem value="card">💳 Credit / Debit Card</SelectItem>
                    <SelectItem value="investment">📈 Investment Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block text-sm font-medium text-text-secondary mb-1">Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickWalletBalance}
                  onChange={(e) => setQuickWalletBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-bg-input border border-border-main text-text-primary rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-text-secondary mb-1">Currency</Label>
                <Select value={baseCurrency} disabled>
                  <SelectTrigger className="w-full bg-bg-input border border-border-main text-text-primary rounded-lg p-2.5 text-sm opacity-75">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={baseCurrency}>{baseCurrency}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowQuickWalletModal(false)} className="bg-bg-input text-text-secondary border-border-main">Cancel</Button>
              <Button onClick={handleQuickAddWallet} className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
