# Supabase Setup SQL

Run these in your Supabase SQL Editor:

```sql cc
-- Add currency column to wallets if not exists
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add wallet_id column to expenses if not exists
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id);
```

Then refresh your app.