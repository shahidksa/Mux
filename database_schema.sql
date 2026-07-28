-- =====================================================
-- EXPENSE MANAGEMENT DASHBOARD - DATABASE SCHEMA
-- =====================================================
-- Copy and paste this entire script into your 
-- Supabase SQL Editor to set up the database.
-- Run it once to create all tables and policies.
-- =====================================================

-- Enable UUID extension (required for UUID primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- DROP EXISTING TABLES (Optional - uncomment if needed)
-- =====================================================
-- DROP TABLE IF EXISTS expenses CASCADE;
-- DROP TABLE IF EXISTS budgets CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS wallets CASCADE;

-- =====================================================
-- CREATE WALLETS TABLE
-- =====================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'card')),
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE wallets IS 'Stores user payment wallets (bank accounts, cash, cards)';
COMMENT ON COLUMN wallets.id IS 'Unique wallet identifier';
COMMENT ON COLUMN wallets.name IS 'Display name for the wallet';
COMMENT ON COLUMN wallets.type IS 'Wallet type: bank, cash, or card';
COMMENT ON COLUMN wallets.balance IS 'Current wallet balance';
COMMENT ON COLUMN wallets.currency IS 'Currency code: USD, EUR, GBP, etc.';

-- =====================================================
-- CREATE CATEGORIES TABLE
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE categories IS 'Expense categories (Food, Transport, etc.)';
COMMENT ON COLUMN categories.name IS 'Category name - must be unique';

-- =====================================================
-- CREATE EXPENSES TABLE
-- =====================================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Individual expense transactions';
COMMENT ON COLUMN expenses.id IS 'Unique expense identifier';
COMMENT ON COLUMN expenses.description IS 'What the expense was for';
COMMENT ON COLUMN expenses.amount IS 'Expense amount in wallet currency';
COMMENT ON COLUMN expenses.category IS 'Category name (references categories.name)';
COMMENT ON COLUMN expenses.date IS 'Date of the expense';
COMMENT ON COLUMN expenses.wallet_id IS 'FK to wallets table - CASCADE delete';

-- =====================================================
-- CREATE BUDGETS TABLE
-- =====================================================
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL,
    limit_amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE budgets IS 'Spending limits per category';
COMMENT ON COLUMN budgets.id IS 'Unique budget identifier';
COMMENT ON COLUMN budgets.category_name IS 'Category this budget applies to';
COMMENT ON COLUMN budgets.limit_amount IS 'Maximum spending limit';

-- =====================================================
-- INSERT DEFAULT CATEGORIES
-- =====================================================
INSERT INTO categories (name) VALUES 
    ('Food & Dining'),
    ('Transportation'),
    ('Shopping'),
    ('Entertainment'),
    ('Healthcare'),
    ('Bills & Utilities'),
    ('Other')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================
-- Wallets: Allow all operations for all users
CREATE POLICY "wallets_all_access" ON wallets
    FOR ALL USING (true) WITH CHECK (true);

-- Categories: Allow all operations for all users
CREATE POLICY "categories_all_access" ON categories
    FOR ALL USING (true) WITH CHECK (true);

-- Expenses: Allow all operations for all users
CREATE POLICY "expenses_all_access" ON expenses
    FOR ALL USING (true) WITH CHECK (true);

-- Budgets: Allow all operations for all users
CREATE POLICY "budgets_all_access" ON budgets
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- CREATE INDEXES FOR BETTER PERFORMANCE
-- =====================================================
CREATE INDEX idx_expenses_wallet_id ON expenses(wallet_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_budgets_category ON budgets(category_name);
CREATE INDEX idx_wallets_currency ON wallets(currency);

-- =====================================================
-- VERIFICATION QUERIES (Run these to check setup)
-- =====================================================
-- SELECT 'Tables created successfully!' as status;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- =====================================================
-- SEED DATA - SAMPLE WALLETS, BUDGETS, AND EXPENSES
-- =====================================================

-- Insert starter wallets (all in USD)
WITH inserted_wallets AS (
    INSERT INTO wallets (name, type, balance, currency)
    VALUES 
        ('Cash Account', 'cash', 500, 'USD'),
        ('Main Bank Account', 'bank', 4500, 'USD'),
        ('Credit Card', 'card', 0, 'USD')
    RETURNING id, name
),
cash_wallet AS (SELECT id FROM inserted_wallets WHERE name = 'Cash Account'),
bank_wallet AS (SELECT id FROM inserted_wallets WHERE name = 'Main Bank Account'),
card_wallet AS (SELECT id FROM inserted_wallets WHERE name = 'Credit Card')

-- Insert sample budgets (limits in USD)
INSERT INTO budgets (category_name, limit_amount)
SELECT 'Food & Dining', 500
WHERE EXISTS (SELECT 1 FROM inserted_wallets);

INSERT INTO budgets (category_name, limit_amount)
SELECT 'Transportation', 300
WHERE EXISTS (SELECT 1 FROM inserted_wallets);

INSERT INTO budgets (category_name, limit_amount)
SELECT 'Shopping', 400
WHERE EXISTS (SELECT 1 FROM inserted_wallets);

INSERT INTO budgets (category_name, limit_amount)
SELECT 'Entertainment', 200
WHERE EXISTS (SELECT 1 FROM inserted_wallets);

INSERT INTO budgets (category_name, limit_amount)
SELECT 'Bills & Utilities', 350
WHERE EXISTS (SELECT 1 FROM inserted_wallets);

-- Insert sample expenses with proper wallet_id references
DO $$
DECLARE
    v_bank_id UUID;
    v_cash_id UUID;
    v_card_id UUID;
BEGIN
    -- Get wallet IDs
    SELECT id INTO v_bank_id FROM wallets WHERE name = 'Main Bank Account';
    SELECT id INTO v_cash_id FROM wallets WHERE name = 'Cash Account';
    SELECT id INTO v_card_id FROM wallets WHERE name = 'Credit Card';
    
    -- Insert expenses using relative dates (amounts in USD)
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Weekly groceries from supermarket', 120.00, 'Food & Dining', CURRENT_DATE - INTERVAL '6 days', v_bank_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Uber ride to office', 15.00, 'Transportation', CURRENT_DATE - INTERVAL '5 days', v_cash_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Electricity bill payment', 180.00, 'Bills & Utilities', CURRENT_DATE - INTERVAL '4 days', v_bank_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('New shoes from mall', 150.00, 'Shopping', CURRENT_DATE - INTERVAL '3 days', v_card_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Movie tickets with friends', 25.00, 'Entertainment', CURRENT_DATE - INTERVAL '2 days', v_cash_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Restaurant dinner', 75.00, 'Food & Dining', CURRENT_DATE - INTERVAL '1 day', v_bank_id);
    
    INSERT INTO expenses (description, amount, category, date, wallet_id) VALUES
        ('Online shopping order', 120.00, 'Shopping', CURRENT_DATE, v_card_id);
    
    RAISE NOTICE 'Seed data inserted: 3 wallets, 5 budgets, 7 expenses (all in USD)';
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Tables: wallets, categories, expenses, budgets';
    RAISE NOTICE 'RLS enabled with public access policies';
END $$;