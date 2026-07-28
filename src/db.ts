import Dexie, { type Table } from 'dexie';

export interface WalletDb {
  id?: number;
  name: string;
  type: 'bank' | 'cash' | 'card';
  balance: number;
  currency: string;
  created_at?: string;
}

export interface CategoryDb {
  id?: number;
  name: string;
  icon: string;
  type?: 'expense' | 'income' | 'both';
  parent_id?: number | null;
  created_at?: string;
}

export interface ExpenseDb {
  id?: number;
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  wallet_id: number;
  receiptImage?: string;
  type: 'expense' | 'income' | 'transfer';
  created_at?: string;
}

export interface AuditLogDb {
  id?: number;
  transaction_id: number;
  date: string;
  original_description: string;
  original_amount: number;
  original_category: string;
  original_subcategory?: string;
  original_type: string;
  reason: string;
  wallet_id?: number;
}

export interface BudgetDb {
  id?: number;
  category_name: string;
  limit_amount: number;
  month_year?: string;
  rollover_amount?: number;
  created_at?: string;
}

export interface TransferDb {
  id?: number;
  source_wallet_id: number;
  destination_wallet_id: number;
  amount: number;
  created_at: string;
}

export interface SettingsDb {
  id: number;
  base_currency?: string;
  rate_mode?: string;
  exchange_rates?: string;
  last_processed_sweep?: string;
  last_sweep_frequency?: 'daily' | 'weekly' | 'monthly';
  custom_currencies?: string;
  allocation_config?: string;
  sweep_frequency?: string;
}

export interface CurrencyDb {
  id?: number;
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
  is_custom?: boolean;
}

export interface SavingsGoalDb {
  id?: number;
  goal_id?: string;
  user_id?: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  category_icon?: string;
  auto_deposit?: boolean;
  auto_deposit_surplus?: boolean;
  allocation_ratio?: number;
  sweep_ratio?: number;
  linked_wallet_id?: number;
  created_at?: string;
  system_category?: string;
  system_subcategory?: string;
}

export const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", icon: "Utensils", type: "expense", parent_id: null },
  { name: "Transportation", icon: "Car", type: "expense", parent_id: null },
  { name: "Shopping", icon: "ShoppingBag", type: "expense", parent_id: null },
  { name: "Entertainment", icon: "Film", type: "expense", parent_id: null },
  { name: "Healthcare", icon: "HeartPulse", type: "expense", parent_id: null },
  { name: "Bills & Utilities", icon: "Zap", type: "expense", parent_id: null },
  { name: "Housing & Utilities", icon: "Home", type: "expense", parent_id: null },
  { name: "Financial Expenses", icon: "Landmark", type: "expense", parent_id: null },
  { name: "Fixed Assets", icon: "ArrowLeftRight", type: "expense", parent_id: null },
  { name: "Savings Transfer", icon: "💰", type: "expense", parent_id: null },
  { name: "Travel & Vacation", icon: "Plane", type: "expense", parent_id: null },
  { name: "Personal Electronics", icon: "Laptop", type: "expense", parent_id: null },
  { name: "Education", icon: "GraduationCap", type: "expense", parent_id: null },
  { name: "Other Assets", icon: "Package", type: "expense", parent_id: null },
  { name: "Salary", icon: "Briefcase", type: "income", parent_id: null },
  { name: "Freelance", icon: "Laptop", type: "income", parent_id: null },
  { name: "Business", icon: "Building2", type: "income", parent_id: null },
  { name: "Investment", icon: "TrendingUp", type: "income", parent_id: null },
  { name: "Gift", icon: "Gift", type: "income", parent_id: null },
  { name: "Refund", icon: "RotateCcw", type: "income", parent_id: null },
  { name: "Other", icon: "HelpCircle", type: "both", parent_id: null }
];

export const CATEGORY_SUBCATEGORIES: Record<string, { name: string; icon: string; type: string }[]> = {
  "Food & Dining": [
    { name: "Supermarket", icon: "Store", type: "expense" },
    { name: "Restaurants & Cafés", icon: "Coffee", type: "expense" },
    { name: "Fast Food & Delivery", icon: "Pizza", type: "expense" },
    { name: "Bakeries & Desserts", icon: "Cake", type: "expense" },
    { name: "Meal Prep & Groceries", icon: "Apple", type: "expense" },
    { name: "Bars & Nightlife", icon: "Wine", type: "expense" },
    { name: "Food Subscription Boxes", icon: "Package", type: "expense" },
    { name: "Workplace Cafeteria", icon: "Building2", type: "expense" },
    { name: "Meal Kits", icon: "UtensilsCrossed", type: "expense" },
    { name: "Specialty Foods", icon: "ChefHat", type: "expense" },
    { name: "Food Delivery Platforms", icon: "Truck", type: "expense" },
    { name: "Vending & Snacks", icon: "Candy", type: "expense" },
  ],
  "Transportation": [
    { name: "Fuel & Petrol", icon: "GasPump", type: "expense" },
    { name: "Public Transport", icon: "Train", type: "expense" },
    { name: "Taxi & Rideshare", icon: "Car", type: "expense" },
    { name: "Parking & Tolls", icon: "ParkingCircle", type: "expense" },
    { name: "Vehicle Maintenance", icon: "Wrench", type: "expense" },
    { name: "Car Insurance", icon: "Shield", type: "expense" },
    { name: "Car Loan / Lease", icon: "Banknote", type: "expense" },
    { name: "Flights & Air Travel", icon: "Plane", type: "expense" },
    { name: "Bicycle & Scooter", icon: "Bike", type: "expense" },
    { name: "Vehicle Registration & Fees", icon: "FileText", type: "expense" },
    { name: "Car Wash & Detailing", icon: "SprayCan", type: "expense" },
    { name: "Tire & Battery Replacements", icon: "CircleDot", type: "expense" },
  ],
  "Shopping": [
    { name: "Clothing & Footwear", icon: "Shirt", type: "expense" },
    { name: "Electronics & Accessories", icon: "Laptop", type: "expense" },
    { name: "Home Decor & Furniture", icon: "Sofa", type: "expense" },
    { name: "Online Marketplaces", icon: "ShoppingCart", type: "expense" },
    { name: "Pet Supplies", icon: "Dog", type: "expense" },
    { name: "Digital Subscriptions", icon: "CreditCard", type: "expense" },
    { name: "Books & Stationery", icon: "BookOpen", type: "expense" },
    { name: "Beauty & Cosmetics", icon: "Sparkles", type: "expense" },
    { name: "Sports & Outdoor Gear", icon: "Tent", type: "expense" },
    { name: "Baby & Kids", icon: "Baby", type: "expense" },
    { name: "Tools & Hardware", icon: "Hammer", type: "expense" },
    { name: "Gifts & Occasions", icon: "Gift", type: "expense" },
  ],
  "Entertainment": [
    { name: "Streaming Services", icon: "Film", type: "expense" },
    { name: "Concerts & Live Events", icon: "Ticket", type: "expense" },
    { name: "Gaming & Hobbies", icon: "Gamepad2", type: "expense" },
    { name: "Movie Theaters", icon: "Clapperboard", type: "expense" },
    { name: "Books & Audiobooks", icon: "BookHeadphones", type: "expense" },
    { name: "Sports & Recreation", icon: "Trophy", type: "expense" },
    { name: "Museums & Attractions", icon: "Landmark", type: "expense" },
    { name: "Music & Podcasts", icon: "Music", type: "expense" },
    { name: "Arcades & Bowling", icon: "Dices", type: "expense" },
    { name: "Theme Parks & Zoos", icon: "FerrisWheel", type: "expense" },
    { name: "Photography & Videography", icon: "Camera", type: "expense" },
    { name: "Nightlife & Clubbing", icon: "GlassWater", type: "expense" },
  ],
  "Healthcare": [
    { name: "Doctor Visits", icon: "Stethoscope", type: "expense" },
    { name: "Dental Care", icon: "Tooth", type: "expense" },
    { name: "Pharmacy & Medicine", icon: "Pill", type: "expense" },
    { name: "Health Insurance", icon: "ShieldPlus", type: "expense" },
    { name: "Vision & Eyecare", icon: "Eye", type: "expense" },
    { name: "Mental Health & Therapy", icon: "Heart", type: "expense" },
    { name: "Fitness & Gym", icon: "Dumbbell", type: "expense" },
    { name: "Vitamins & Supplements", icon: "Apple", type: "expense" },
    { name: "Urgent Care & ER", icon: "Ambulance", type: "expense" },
    { name: "Medical Tests & Labs", icon: "FlaskConical", type: "expense" },
    { name: "Personal Care & Spa", icon: "Sparkles", type: "expense" },
    { name: "Specialist Consultations", icon: "UserRound", type: "expense" },
  ],
  "Housing & Utilities": [
    { name: "Rent / Mortgage", icon: "Building", type: "expense" },
    { name: "Electricity", icon: "Zap", type: "expense" },
    { name: "Water & Sewer", icon: "Droplet", type: "expense" },
    { name: "Natural Gas", icon: "Flame", type: "expense" },
    { name: "Internet & Wi-Fi", icon: "Wifi", type: "expense" },
    { name: "Mobile Phone Plan", icon: "Smartphone", type: "expense" },
    { name: "Cable & TV", icon: "Tv", type: "expense" },
    { name: "Home Maintenance & Repairs", icon: "Hammer", type: "expense" },
    { name: "Property Taxes", icon: "FileText", type: "expense" },
    { name: "Home Insurance", icon: "Shield", type: "expense" },
    { name: "Cleaning & Supplies", icon: "SprayCan", type: "expense" },
    { name: "Furniture & Appliances", icon: "Sofa", type: "expense" },
  ],
  "Bills & Utilities": [
    { name: "Electricity", icon: "Zap", type: "expense" },
    { name: "Water Supply", icon: "Droplet", type: "expense" },
    { name: "Internet & Wi-Fi", icon: "Wifi", type: "expense" },
    { name: "Mobile Plan", icon: "Smartphone", type: "expense" },
    { name: "Natural Gas", icon: "Flame", type: "expense" },
    { name: "TV & Streaming", icon: "Tv", type: "expense" },
    { name: "Trash & Recycling", icon: "Trash2", type: "expense" },
    { name: "HOA Fees", icon: "Building2", type: "expense" },
    { name: "Home Security", icon: "Shield", type: "expense" },
    { name: "Cloud Storage & Software", icon: "Cloud", type: "expense" },
  ],
  "Financial Expenses": [
    { name: "Loan Repayment", icon: "Banknote", type: "expense" },
    { name: "Credit Card Interest", icon: "CreditCard", type: "expense" },
    { name: "Insurance Premiums", icon: "Shield", type: "expense" },
    { name: "Investment Fees", icon: "TrendingUp", type: "expense" },
    { name: "Bank Fees & Charges", icon: "Landmark", type: "expense" },
    { name: "Tax Payments", icon: "FileText", type: "expense" },
    { name: "Retirement Contributions", icon: "PiggyBank", type: "expense" },
    { name: "Stock & ETF Purchases", icon: "ChartLine", type: "expense" },
    { name: "Crypto Purchases", icon: "Bitcoin", type: "expense" },
    { name: "Financial Advisory", icon: "UserRound", type: "expense" },
    { name: "Debt Collection Fees", icon: "AlertTriangle", type: "expense" },
    { name: "Legal Fees", icon: "Scale", type: "expense" },
  ],
  "Fixed Assets": [
    { name: "Vault Allocation", icon: "ArrowLeftRight", type: "expense" },
    { name: "Property Purchase", icon: "Building2", type: "expense" },
    { name: "Property Acquisition", icon: "Building", type: "expense" },
    { name: "Equipment Purchase", icon: "Monitor", type: "expense" },
    { name: "Machinery/Equipment", icon: "Cog", type: "expense" },
    { name: "Vehicle Purchase", icon: "Car", type: "expense" },
    { name: "Real Estate Acquisition", icon: "Mountain", type: "expense" },
    { name: "Land/Property", icon: "Mountain", type: "expense" },
    { name: "Asset Appreciation", icon: "TrendingUp", type: "expense" },
    { name: "Asset Depreciation", icon: "TrendingDown", type: "expense" },
    { name: "Capital Investment", icon: "Briefcase", type: "expense" },
  ],
  "Travel & Vacation": [
    { name: "Flights & Lodging", icon: "Plane", type: "expense" },
    { name: "Holiday Disbursal", icon: "Umbrella", type: "expense" },
  ],
  "Personal Electronics": [
    { name: "Gadgets & Gear", icon: "Smartphone", type: "expense" },
    { name: "Computer & Accessories", icon: "Monitor", type: "expense" },
    { name: "Workstation Upgrades", icon: "MonitorUp", type: "expense" },
  ],
  "Education": [
    { name: "Tuition & Fees", icon: "GraduationCap", type: "expense" },
    { name: "Books & Supplies", icon: "BookOpen", type: "expense" },
    { name: "Courses & Certifications", icon: "FileBadge", type: "expense" },
  ],
  "Other Assets": [
    { name: "Asset Acquisition", icon: "Package", type: "expense" },
    { name: "General Purchase", icon: "ShoppingBag", type: "expense" },
  ],
  "Salary": [
    { name: "Monthly Payroll", icon: "Briefcase", type: "income" },
    { name: "Overtime Pay", icon: "Clock", type: "income" },
    { name: "Bonuses & Commission", icon: "Gift", type: "income" },
    { name: "Annual Bonus", icon: "Award", type: "income" },
    { name: "Stock Options", icon: "ChartLine", type: "income" },
    { name: "Severance Pay", icon: "FileText", type: "income" },
    { name: "Paid Time Off Payout", icon: "Calendar", type: "income" },
    { name: "Tips & Gratuities", icon: "Hand", type: "income" },
    { name: "Profit Sharing", icon: "PieChart", type: "income" },
    { name: "Retirement Pension", icon: "PiggyBank", type: "income" },
  ],
  "Freelance": [
    { name: "Client Projects", icon: "Laptop", type: "income" },
    { name: "Consulting Fees", icon: "UserRound", type: "income" },
    { name: "Design & Creative", icon: "Palette", type: "income" },
    { name: "Writing & Content", icon: "Pen", type: "income" },
    { name: "Development & Coding", icon: "Code", type: "income" },
    { name: "Photography Gigs", icon: "Camera", type: "income" },
    { name: "Tutoring & Teaching", icon: "GraduationCap", type: "income" },
    { name: "Affiliate Income", icon: "Link", type: "income" },
    { name: "Online Courses", icon: "Video", type: "income" },
    { name: "Social Media Management", icon: "Megaphone", type: "income" },
  ],
  "Business": [
    { name: "Sales Revenue", icon: "TrendingUp", type: "income" },
    { name: "Product Sales", icon: "Package", type: "income" },
    { name: "Service Revenue", icon: "ConciergeBell", type: "income" },
    { name: "Subscription Revenue", icon: "Repeat", type: "income" },
    { name: "Partnership Income", icon: "Handshake", type: "income" },
    { name: "E-commerce Sales", icon: "ShoppingCart", type: "income" },
    { name: "Advertising Revenue", icon: "Megaphone", type: "income" },
    { name: "Licensing & Royalties", icon: "FileBadge", type: "income" },
    { name: "Franchise Income", icon: "Building2", type: "income" },
    { name: "Dividend Distributions", icon: "Banknote", type: "income" },
  ],
  "Investment": [
    { name: "Stock Dividends", icon: "TrendingUp", type: "income" },
    { name: "Capital Gains", icon: "ChartLine", type: "income" },
    { name: "Bond Interest", icon: "Banknote", type: "income" },
    { name: "REIT Distributions", icon: "Building", type: "income" },
    { name: "Crypto Gains", icon: "Bitcoin", type: "income" },
    { name: "Mutual Fund Payouts", icon: "PieChart", type: "income" },
    { name: "ETF Dividends", icon: "BarChart", type: "income" },
    { name: "Peer-to-Peer Lending", icon: "Handshake", type: "income" },
    { name: "Options & Futures", icon: "Activity", type: "income" },
    { name: "Royalties", icon: "FileBadge", type: "income" },
  ],
  "Gift": [
    { name: "Cash Gift", icon: "Banknote", type: "income" },
    { name: "Birthday Gift", icon: "Cake", type: "income" },
    { name: "Holiday Gift", icon: "Gift", type: "income" },
    { name: "Wedding Gift", icon: "Heart", type: "income" },
    { name: "Family Support", icon: "Users", type: "income" },
    { name: "Award & Prize", icon: "Award", type: "income" },
    { name: "Inheritance", icon: "ScrollText", type: "income" },
    { name: "Scholarship", icon: "GraduationCap", type: "income" },
    { name: "Crowdfunding", icon: "Users", type: "income" },
    { name: "Charity Received", icon: "HandHeart", type: "income" },
  ],
  "Refund": [
    { name: "Tax Refund", icon: "FileText", type: "income" },
    { name: "Product Return", icon: "RotateCcw", type: "income" },
    { name: "Insurance Claim", icon: "ShieldCheck", type: "income" },
    { name: "Deposit Refund", icon: "Banknote", type: "income" },
    { name: "Warranty Claim", icon: "Shield", type: "income" },
    { name: "Cancellation Refund", icon: "XCircle", type: "income" },
    { name: "Cashback Rewards", icon: "CreditCard", type: "income" },
    { name: "Overpayment Refund", icon: "Undo2", type: "income" },
    { name: "Security Deposit Return", icon: "Landmark", type: "income" },
    { name: "Fee Reversal", icon: "ArrowLeftCircle", type: "income" },
  ],
};

export const DEFAULT_WALLETS = [
  { name: 'CITI', type: 'bank' as const, balance: 0, currency: 'USD' },
  { name: 'UBL', type: 'bank' as const, balance: 0, currency: 'USD' },
  { name: 'Cash', type: 'cash' as const, balance: 0, currency: 'USD' },
];

export class ExpenseDatabase extends Dexie {
  wallets!: Table<WalletDb>;
  categories!: Table<CategoryDb>;
  expenses!: Table<ExpenseDb>;
  budgets!: Table<BudgetDb>;
  transfers!: Table<TransferDb>;
  settings!: Table<SettingsDb>;
  savings_goals!: Table<SavingsGoalDb>;
  currencies!: Table<CurrencyDb>;
  auditLogs!: Table<AuditLogDb>;

  constructor() {
    super('expenseManagementDB');
    this.version(6).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id'
    }).upgrade(tx => {
      return tx.table('expenses').toCollection().modify(expense => {
        expense.type = 'expense';
      });
    });
    this.version(8).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id'
    }).upgrade(async (tx) => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const budgets = await tx.table('budgets').toArray();
      for (const budget of budgets) {
        if (!budget.month_year) {
          await tx.table('budgets').update(budget.id!, { month_year: currentMonth });
        }
        if (budget.rollover_amount === undefined) {
          await tx.table('budgets').update(budget.id!, { rollover_amount: 0 });
        }
      }
    });
    this.version(9).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id'
    }).upgrade(async (tx) => {
      const budgets = await tx.table('budgets').toArray();
      for (const budget of budgets) {
        if (!budget.month_year) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await tx.table('budgets').update(budget.id!, { month_year: currentMonth });
        }
        if (budget.rollover_amount === undefined) {
          await tx.table('budgets').update(budget.id!, { rollover_amount: 0 });
        }
      }

      const existingNames = new Set(
        (await tx.table('categories').toArray()).map(c => c.name.trim().toLowerCase())
      );
      const missingDefaults = DEFAULT_CATEGORIES.filter(
        c => !existingNames.has(c.name.trim().toLowerCase())
      );
      if (missingDefaults.length > 0) {
        await tx.table('categories').bulkAdd(missingDefaults);
      }
      await tx.table('categories').toCollection().modify(cat => {
        if (!cat.type) cat.type = 'expense';
      });
    });
    this.version(10).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    });
    this.version(11).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    }).upgrade(async (tx) => {
      const allCats = await tx.table('categories').toArray();
      const existingNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));
      const updates: { key: number; changes: Partial<CategoryDb> }[] = [];
      for (const cat of allCats) {
        if (cat.parent_id === undefined && cat.id != null) {
          updates.push({ key: cat.id, changes: { parent_id: null } });
        }
      }
      if (updates.length > 0) {
        await tx.table('categories').bulkUpdate(updates);
      }
      const subsToAdd: any[] = [];
      for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
        const parentId = existingNames.get(parentName);
        if (parentId !== undefined) {
          for (const sub of subs) {
            subsToAdd.push({ ...sub, parent_id: parentId });
          }
        }
      }
      if (subsToAdd.length > 0) {
        await tx.table('categories').bulkAdd(subsToAdd);
      }
    });
    this.version(12).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    });
    this.version(14).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    }).upgrade(async (tx) => {
      const allCats = await tx.table('categories').toArray();
      const existingCatNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));

      const missingDefaults = DEFAULT_CATEGORIES.filter(
        c => !existingCatNames.has(c.name.trim().toLowerCase())
      );
      const defaultKeys = await tx.table('categories').bulkAdd(missingDefaults, { allKeys: true });
      for (let i = 0; i < missingDefaults.length; i++) {
        if (defaultKeys[i] !== undefined) {
          allCats.push({ ...missingDefaults[i], id: defaultKeys[i] as number });
        }
      }

      const nameToId = new Map<string, number>();
      for (const cat of allCats) {
        if (cat.id !== undefined && cat.id !== null) {
          nameToId.set(cat.name.trim().toLowerCase(), cat.id);
        }
      }

      const existingSubNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));
      const subsToAdd: { name: string; icon: string; type: string; parent_id: number }[] = [];
      for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
        const parentId = nameToId.get(parentName.trim().toLowerCase());
        if (parentId !== undefined) {
          for (const sub of subs) {
            if (!existingSubNames.has(sub.name.trim().toLowerCase())) {
              subsToAdd.push({ ...sub, parent_id: parentId });
            }
          }
        }
      }
      if (subsToAdd.length > 0) {
        await tx.table('categories').bulkAdd(subsToAdd);
      }
    });
    this.version(15).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault',
      auditLogs: '++id, date'
    });
    this.version(7).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id'
    }).upgrade(async (tx) => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const budgets = await tx.table('budgets').toArray();
      for (const budget of budgets) {
        if (!budget.month_year) {
          await tx.table('budgets').update(budget.id!, { month_year: currentMonth });
        }
        if (budget.rollover_amount === undefined) {
          await tx.table('budgets').update(budget.id!, { rollover_amount: 0 });
        }
      }
    });

    this.version(9).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id'
    }).upgrade(async (tx) => {
      const budgets = await tx.table('budgets').toArray();
      for (const budget of budgets) {
        if (!budget.month_year) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await tx.table('budgets').update(budget.id!, { month_year: currentMonth });
        }
        if (budget.rollover_amount === undefined) {
          await tx.table('budgets').update(budget.id!, { rollover_amount: 0 });
        }
      }

      const existingNames = new Set(
        (await tx.table('categories').toArray()).map(c => c.name.trim().toLowerCase())
      );
      const missingDefaults = DEFAULT_CATEGORIES.filter(
        c => !existingNames.has(c.name.trim().toLowerCase())
      );
      if (missingDefaults.length > 0) {
        await tx.table('categories').bulkAdd(missingDefaults);
      }
      await tx.table('categories').toCollection().modify(cat => {
        if (!cat.type) cat.type = 'expense';
      });
    });

    this.version(10).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    });

this.version(11).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    }).upgrade(async (tx) => {
      const allCats = await tx.table('categories').toArray();
      const existingNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));
      const updates: { key: number; changes: Partial<CategoryDb> }[] = [];
      for (const cat of allCats) {
        if (cat.parent_id === undefined && cat.id != null) {
          updates.push({ key: cat.id, changes: { parent_id: null } });
        }
      }
      if (updates.length > 0) {
        await tx.table('categories').bulkUpdate(updates);
      }
      const subsToAdd: any[] = [];
      for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
        const parentId = existingNames.get(parentName);
        if (parentId !== undefined) {
          for (const sub of subs) {
            subsToAdd.push({ ...sub, parent_id: parentId });
          }
        }
      }
      if (subsToAdd.length > 0) {
        await tx.table('categories').bulkAdd(subsToAdd);
      }
    });

    this.version(12).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    });

    this.version(14).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault'
    }).upgrade(async (tx) => {
      const allCats = await tx.table('categories').toArray();
      const existingCatNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));

      const missingDefaults = DEFAULT_CATEGORIES.filter(
        c => !existingCatNames.has(c.name.trim().toLowerCase())
      );
      const defaultKeys = await tx.table('categories').bulkAdd(missingDefaults, { allKeys: true });
      for (let i = 0; i < missingDefaults.length; i++) {
        if (defaultKeys[i] !== undefined) {
          allCats.push({ ...missingDefaults[i], id: defaultKeys[i] as number });
        }
      }

      const nameToId = new Map<string, number>();
      for (const cat of allCats) {
        if (cat.id !== undefined && cat.id !== null) {
          nameToId.set(cat.name.trim().toLowerCase(), cat.id);
        }
      }

      const existingSubNames = new Set(allCats.map(c => c.name.trim().toLowerCase()));
      const subsToAdd: { name: string; icon: string; type: string; parent_id: number }[] = [];
      for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
        const parentId = nameToId.get(parentName.trim().toLowerCase());
        if (parentId !== undefined) {
          for (const sub of subs) {
            if (!existingSubNames.has(sub.name.trim().toLowerCase())) {
              subsToAdd.push({ ...sub, parent_id: parentId });
            }
          }
        }
      }
      if (subsToAdd.length > 0) {
        await tx.table('categories').bulkAdd(subsToAdd);
      }
    });

    this.version(18).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault',
      auditLogs: '++id, date'
    });

    this.version(17).stores({
      wallets: '++id, name, type, currency',
      categories: '++id, name, type, parent_id',
      expenses: '++id, wallet_id, date, category, type',
      budgets: '++id, category_name, month_year',
      transfers: '++id, source_wallet_id, destination_wallet_id, transfer_type, created_at',
      settings: 'id',
      savings_goals: '++id, name, target_date, linked_wallet_id',
      currencies: '++id, code, isDefault',
      auditLogs: '++id, date'
    });

    this.on('populate', async (tx: Dexie.Transaction) => {
      console.log('[DB Lifecycle] Initializing default seed data...');
      const walletCount = await tx.table('wallets').count();
      if (walletCount > 0) {
        console.log(`[DB Lifecycle] Aborting seed. Found ${walletCount} existing wallets.`);
        return;
      }

      const parentIds = await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES, { allKeys: true });
      const parentIdByName = new Map<string, number>();
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const id = parentIds[i];
        if (id !== undefined) parentIdByName.set(DEFAULT_CATEGORIES[i].name, id);
      }
      const allSubs: { name: string; icon: string; type: string; parent_id: number }[] = [];
      for (const [parentName, subs] of Object.entries(CATEGORY_SUBCATEGORIES)) {
        const parentId = parentIdByName.get(parentName);
        if (parentId !== undefined) {
          for (const sub of subs) {
            allSubs.push({ ...sub, parent_id: parentId });
          }
        }
      }
      if (allSubs.length > 0) {
        await tx.table('categories').bulkAdd(allSubs);
      }

      console.log('[DB Lifecycle] Seed complete: categories seeded.');
    });

    // Set up deletion observer for expenses to reverse reallocation transactions
    this.expenses.hook('deleting', function(primaryKey, obj, transaction) {
      const expense = obj;
      
      // Check if this is a savings transfer transaction that should be reversed
      if (expense.category === 'Fixed Assets' && 
          expense.description && 
          expense.description.includes('Reallocated') && 
          String(expense.type).toLowerCase() === 'transfer') {
        
        console.log('[DB Observer] Reversing reallocation transaction:', expense);
        
        // Parse source and destination goal names from description
        // Format: "Reallocated "SOURCE NAME" funds to "DEST NAME" 🔄"
        const descriptionMatch = expense.description.match(/Reallocated "([^"]+)" funds to "([^"]+)" 🔄/);
        if (descriptionMatch && descriptionMatch.length >= 3) {
          const sourceGoalName = descriptionMatch[1];
          const destGoalName = descriptionMatch[2];
          
          console.log(`[DB Observer] Reversing: ${sourceGoalName} -> ${destGoalName} (Amount: ${expense.amount})`);
          
          // Use setTimeout to handle the async reversal without blocking the deletion
          setTimeout(async () => {
            try {
              // Find the goals in the database
              const allGoals = await db.savings_goals.toArray();
              const sourceGoal = allGoals.find(g => g.name === sourceGoalName);
              const destGoal = allGoals.find(g => g.name === destGoalName);
              
              if (sourceGoal && destGoal) {
                // Reverse the math: add back to source, subtract from destination
                const sourceNewAmount = (sourceGoal.current_amount || 0) + expense.amount;
                const destNewAmount = (destGoal.current_amount || 0) - expense.amount;
                
                console.log(`[DB Observer] Reversing amounts:`);
                console.log(`  ${sourceGoalName}: ${sourceGoal.current_amount || 0} -> ${sourceNewAmount}`);
                console.log(`  ${destGoalName}: ${destGoal.current_amount || 0} -> ${destNewAmount}`);
                
                // Update both goals atomically
                await db.transaction('rw', [db.savings_goals], async () => {
                  await db.savings_goals.update(sourceGoal.id!, { current_amount: sourceNewAmount });
                  await db.savings_goals.update(destGoal.id!, { current_amount: destNewAmount });
                });
                
                console.log('[DB Observer] Reallocation reversal completed successfully');
              } else {
                console.error('[DB Observer] Could not find goals for reversal:', {
                  sourceGoalName,
                  destGoalName,
                  sourceGoal,
                  destGoal
                });
              }
            } catch (err) {
              console.error('[DB Observer] Error during reallocation reversal:', err);
            }
          }, 0);
        } else {
          console.error('[DB Observer] Could not parse reallocation description:', expense.description);
        }
      }
      
      // Return true to allow the deletion to proceed
      return true;
    });

    // Note: Savings transfer mutation handling moved to ExpenseContext for better compatibility
  }
}

export const createWallet = async (walletData: any) => {
  try {
    console.log('[DB Operation] Attempting to save wallet:', walletData);

    const cleanWallet = {
      name: String(walletData.name),
      type: String(walletData.type),
      currency: String(walletData.currency || (JSON.parse(localStorage.getItem('expense_app_settings') || '{}').baseCurrency || 'USD')),
      balance: Number(walletData.balance || 0)
    };

    const generatedId = await db.wallets.add(cleanWallet);
    console.log(`[DB Operation] Success! Wallet saved with ID: ${generatedId}`);
    return generatedId;
  } catch (error) {
    console.error('[DB Operation CRITICAL ERROR] Failed to save wallet to IndexedDB:', error);
  }
};

export const CHECKING_WALLET_ID = 1; // Main checking account wallet ID

export const db = new ExpenseDatabase();

async function ensureDataIsSafe(): Promise<void> {
  try {
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('⚠️ Storage Persistence API not supported in this browser.');
      return;
    }

    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      if (granted) {
        console.log('🔒 Storage upgraded to PERSISTENT');
      } else {
        console.warn('⚠️ Storage persistence request was denied by the user/agent.');
      }
    } else {
      console.log('🔒 Storage is already PERSISTENT');
    }
  } catch (err) {
    console.warn('⚠️ Could not verify storage persistence:', err);
  }
}

ensureDataIsSafe();

/**
 * Retroactively reclassify a cow goal-fulfillment transaction that was
 * incorrectly stored under Vehicle Purchase instead of Livestock & Agriculture.
 *
 * Call from browser dev console (Vite dev mode):
 *   const { fixCowTransaction } = await import('/src/db.ts');
 *   await fixCowTransaction();
 */
export async function fixCowTransaction(): Promise<number> {
  const ublWallet = await db.wallets.where('name').equals('UBL').first();
  if (!ublWallet || !ublWallet.id) throw new Error('UBL wallet not found');

  const records = await db.expenses
    .where('wallet_id').equals(ublWallet.id)
    .and(e => e.date === '07/10/2026' && e.amount === 25000)
    .toArray();

  if (records.length === 0) {
    console.warn('[Migrate] No matching cow transaction found (07/10/2026, 25000, UBL).');
    return 0;
  }

  for (const record of records) {
    await db.expenses.update(record.id!, {
      category: 'Fixed Assets',
      subcategory: 'Livestock & Agriculture',
    });
    console.log('[Migrate] Reclassified expense', record.id, '→ Fixed Assets / Livestock & Agriculture');
  }
  return records.length;
}

// Set up deletion hook for expenses to reverse reallocation transactions
// This must be done after the database is initialized
db.expenses.hook('deleting', function(primaryKey, obj, transaction) {
  const expense = obj;
  
  // Check if this is a savings transfer transaction that should be reversed
  if (expense.category === 'Fixed Assets' && 
      expense.description && 
      expense.description.includes('Reallocated') && 
      String(expense.type).toLowerCase() === 'transfer') {
    
    console.log('[DB Hook] Reversing reallocation transaction:', expense);
    
    // Parse source and destination goal names from description
    // Format: "Reallocated "SOURCE NAME" funds to "DEST NAME" 🔄"
    const descriptionMatch = expense.description.match(/Reallocated "([^"]+)" funds to "([^"]+)" 🔄/);
    if (descriptionMatch && descriptionMatch.length >= 3) {
      const sourceGoalName = descriptionMatch[1];
      const destGoalName = descriptionMatch[2];
      
      console.log(`[DB Hook] Reversing: ${sourceGoalName} -> ${destGoalName} (Amount: ${expense.amount})`);
      
      // Return a Promise so Dexie waits for the reversal before completing deletion
      return (async () => {
        try {
          // Access savings_goals through the transaction's native table access
          const savingsGoalsTable = transaction.table('savings_goals');
          const allGoals = await savingsGoalsTable.toArray();
          const sourceGoal = allGoals.find(g => g.name === sourceGoalName);
          const destGoal = allGoals.find(g => g.name === destGoalName);
          
          if (sourceGoal && destGoal) {
            // Reverse the math: add full amount back to source, subtract from destination
            // e.g., source goes from 10,000 → 15,000, dest goes from ? → ? - amount
            const sourceNewAmount = (sourceGoal.current_amount || 0) + expense.amount;
            const destNewAmount = (destGoal.current_amount || 0) - expense.amount;
            
            console.log(`[DB Hook] Reversing amounts:`);
            console.log(`  ${sourceGoalName}: ${sourceGoal.current_amount || 0} -> ${sourceNewAmount}`);
            console.log(`  ${destGoalName}: ${destGoal.current_amount || 0} -> ${destNewAmount}`);
            
            // Update both goals using the transaction's scope
            await savingsGoalsTable.update(sourceGoal.id!, { current_amount: sourceNewAmount });
            await savingsGoalsTable.update(destGoal.id!, { current_amount: destNewAmount });
            
            console.log('[DB Hook] Reallocation reversal completed successfully');
          } else {
            console.error('[DB Hook] Could not find goals for reversal:', {
              sourceGoalName,
              destGoalName,
              sourceGoal,
              destGoal
            });
          }
        } catch (err) {
          console.error('[DB Hook] Error during reallocation reversal:', err);
        }
      })();
    } else {
      console.error('[DB Hook] Could not parse reallocation description:', expense.description);
    }
  }
  
  // Check if this is an Asset Disbursal (Goal Fulfilled) transaction that should be reversed
  // Pattern: "Purchased GOALNAME (Goal Fulfilled)"
  if (expense.description?.includes('(Goal Fulfilled)')) {
    const GOAL_FULFILLED_SUFFIX = ' (Goal Fulfilled)';
    const PURCHASED_PREFIX = 'Purchased ';
    let goalName = '';
    if (String(expense.description).startsWith(PURCHASED_PREFIX) && String(expense.description).endsWith(GOAL_FULFILLED_SUFFIX)) {
      goalName = String(expense.description).slice(
        PURCHASED_PREFIX.length,
        String(expense.description).length - GOAL_FULFILLED_SUFFIX.length
      );
    }
    
    if (goalName) {
      console.log('[DB Hook] Reversing asset disbursal:', expense, 'linked goal:', goalName);
      
      return (async () => {
        try {
          const walletsTable = transaction.table('wallets');
          const savingsGoalsTable = transaction.table('savings_goals');
          
          const checkingWallet = await walletsTable.get(CHECKING_WALLET_ID);
          const allGoals = await savingsGoalsTable.toArray();
          const goalNameUpper = goalName.toUpperCase();
          const linkedGoal = allGoals.find(g => g.name.toUpperCase() === goalNameUpper);
          
          if (checkingWallet && linkedGoal) {
            const newBalance = (checkingWallet.balance || 0) + expense.amount;
            const newGoalAmount = (linkedGoal.current_amount || 0) + expense.amount;
            
            console.log(`[DB Hook] Asset disbursal reversal: adding ${expense.amount} back to wallet ${checkingWallet.id} and goal "${goalName}"`);
            
            await walletsTable.update(checkingWallet.id!, { balance: newBalance });
            await savingsGoalsTable.update(linkedGoal.id!, { current_amount: newGoalAmount });
            
            console.log('[DB Hook] Asset disbursal reversal completed successfully');
          } else {
            console.error('[DB Hook] Could not find wallet or goal for asset disbursal reversal:', {
              checkingWallet,
              linkedGoal,
              goalName
            });
          }
        } catch (err) {
          console.error('[DB Hook] Error during asset disbursal reversal:', err);
        }
      })();
    }
  }
  
  // Return true to allow the deletion to proceed if no reallocation detected
  return true;
});

export interface AnnualLedgerSnapshot {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  txCount: number;
  computedAt: string;
}

const annualLedgerCache = new Map<number, AnnualLedgerSnapshot>();

export function getAnnualLedgerSnapshot(txs: ExpenseDb[], year: number): AnnualLedgerSnapshot {
  const cached = annualLedgerCache.get(year);
  if (cached) return cached;

  const yearTxs = txs.filter(tx => {
    if (!tx.date) return false;
    return new Date(tx.date).getFullYear() === year;
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;

  for (const tx of yearTxs) {
    const amt = Math.abs(Number(tx.amount) || 0);
    const t = String(tx.type).toLowerCase();
    if (t === 'income') totalIncome += amt;
    else if (t === 'transfer') totalTransfers += amt;
    else totalExpenses += amt;
  }

  const snapshot: AnnualLedgerSnapshot = {
    year,
    totalIncome,
    totalExpenses,
    totalTransfers,
    txCount: yearTxs.length,
    computedAt: new Date().toISOString(),
  };

  annualLedgerCache.set(year, snapshot);
  return snapshot;
}

export function invalidateAnnualLedger(year?: number): void {
  if (year !== undefined) {
    annualLedgerCache.delete(year);
  } else {
    annualLedgerCache.clear();
  }
}
