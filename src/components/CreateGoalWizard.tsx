import { useState, useMemo } from 'react';
import { db } from '../db';

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  'Fixed Assets': ['Vehicle Purchase', 'Real Estate Acquisition', 'Machinery/Equipment'],
  'Travel & Vacation': ['Flights & Lodging', 'Holiday Disbursal'],
  'Personal Electronics': ['Gadgets & Gear', 'Workstation Upgrades'],
  'Education': ['Tuition & Fees'],
  'Other Assets': ['Asset Acquisition', 'General Purchase'],
};

const MAIN_CATEGORY_OPTIONS = Object.keys(SUBCATEGORY_OPTIONS);

export function CreateGoalWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [mainCategory, setMainCategory] = useState(MAIN_CATEGORY_OPTIONS[0]);
  const [subcategory, setSubcategory] = useState(SUBCATEGORY_OPTIONS[MAIN_CATEGORY_OPTIONS[0]][0]);

  const subOptions = useMemo(() => SUBCATEGORY_OPTIONS[mainCategory] || [], [mainCategory]);

  const handleMainCategoryChange = (cat: string) => {
    setMainCategory(cat);
    setSubcategory(SUBCATEGORY_OPTIONS[cat]?.[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName || !targetAmount || !targetDate) return;

    const scanText = `${goalName || ''} ${mainCategory || ''} ${subcategory || ''}`.toUpperCase();

    let systemCategory = 'Fixed Assets';
    let systemSubcategory = 'Asset Acquisition';

    // Rule 1: Strict Livestock Check (Priority 1 — isolated short-circuit with \b boundaries)
    if (/\b(COW|GOAT|FARM)\b/.test(scanText) || scanText.includes('🐄') || scanText.includes('🐐')) {
      systemCategory = 'Fixed Assets';
      systemSubcategory = 'Livestock & Agriculture';
    }
    // Rule 2: Strict Vehicle Check (explicit \b boundaries prevent "PURCHASED" → "CAR" bleeding)
    else if (/\b(CAR|BIKE|TRUCK)\b/.test(scanText) || scanText.includes('🚗') || scanText.includes('🚲')) {
      systemCategory = 'Fixed Assets';
      systemSubcategory = 'Vehicle Purchase';
    }
    // Rule 3: Property / Real Estate
    else if (/\b(HOME|HOUSE|LAND|PLOT)\b/.test(scanText) || scanText.includes('🏠')) {
      systemCategory = 'Fixed Assets';
      systemSubcategory = 'Property Acquisition';
    }
    // Rule 4: Gadgets & Tech
    else if (/\b(LAPTOP|IPHONE|PC|TECH)\b/.test(scanText) || scanText.includes('💻')) {
      systemCategory = 'Personal Electronics';
      systemSubcategory = 'Gadgets & Tech Gear';
    }
    // Rule 5: Business & Capital
    else if (/\b(BIZ|STOCKS|INVEST|GOLD)\b/.test(scanText) || scanText.includes('🚀') || scanText.includes('📈')) {
      systemCategory = 'Investments';
      systemSubcategory = 'Business & Capital';
    }
    // Rule 6: Special Events
    else if (/\b(WEDDING|SHAADI|EVENT|GIFT)\b/.test(scanText) || scanText.includes('💍')) {
      systemCategory = 'Life Milestones';
      systemSubcategory = 'Special Events';
    }
    // Rule 7: Holiday / Travel
    else if (/\b(TRIP|VACATION|SWAT|TOUR)\b/.test(scanText) || scanText.includes('✈️') || scanText.includes('🌴')) {
      systemCategory = 'Travel & Vacation';
      systemSubcategory = 'Holiday Disbursal';
    }
    // Rule 8: Education
    else if (/\b(FEES|COLLEGE|BOOK|STUDY)\b/.test(scanText) || scanText.includes('🎓')) {
      systemCategory = 'Education';
      systemSubcategory = 'Tuition & Training';
    }
    // Rule 9: Emergency / Contingency
    else if (/\b(EMERGENCY|SHIELD|MEDICAL)\b/.test(scanText) || scanText.includes('🚨') || scanText.includes('🛡️')) {
      systemCategory = 'Emergency Reserves';
      systemSubcategory = 'Contingency Fund';
    }

    try {
      await db.savings_goals.add({
        name: goalName.toUpperCase().trim(),
        target_amount: Number(targetAmount),
        current_amount: 0,
        target_date: targetDate,
        created_at: new Date().toISOString(),
        system_category: systemCategory,
        system_subcategory: systemSubcategory,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to create goal:', err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-card p-5 rounded-2xl max-w-md w-full border border-border-main shadow-xl space-y-4">
      <div className="flex justify-between items-center border-b border-border-main pb-2">
        <h3 className="font-bold text-text-primary text-base">Create New Savings Goal</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-text-secondary block mb-1">Goal Name</label>
          <input
            type="text"
            placeholder="e.g., MY NEW CAR"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value.toUpperCase())}
            className="w-full bg-bg-input border border-border-main rounded-xl p-2 text-sm font-semibold text-text-primary focus:outline-purple-500 uppercase"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-text-secondary block mb-1">Target Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full bg-bg-input border border-border-main rounded-xl p-2 text-sm font-mono font-bold text-blue-900 dark:text-blue-300 focus:outline-purple-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-text-secondary block mb-1">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-bg-input border border-border-main rounded-xl p-2 text-sm font-semibold text-text-primary focus:outline-purple-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-text-secondary block mb-1">Main Category</label>
          <select
            value={mainCategory}
            onChange={(e) => handleMainCategoryChange(e.target.value)}
            className="w-full bg-bg-input border border-border-main rounded-xl p-2 text-sm font-semibold text-text-primary focus:outline-purple-500"
          >
            {MAIN_CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-text-secondary block mb-1">Subcategory</label>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className="w-full bg-bg-input border border-border-main rounded-xl p-2 text-sm font-semibold text-text-primary focus:outline-purple-500"
          >
            {subOptions.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        <div className="p-3 bg-bg-input rounded-xl border border-border-main text-xs text-text-muted">
          <span className="font-bold text-text-primary block">Automated Ledger Rules:</span>
          Acquisitions will automatically lock to <span className="font-semibold text-purple-700 dark:text-purple-400">{mainCategory} &rarr; {subcategory}</span>.
        </div>

        <div className="flex gap-2 pt-2 border-t border-border-main">
          <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-sm transition-all shadow-sm">
            Create Goal
          </button>
          <button type="button" onClick={onClose} className="border border-border-main text-text-secondary hover:bg-bg-input font-medium py-2 px-4 rounded-xl text-sm bg-transparent">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
