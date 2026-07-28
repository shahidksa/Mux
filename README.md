# Wealth Flow Dashboard — Personal Finance Tracker

> **Private, Offline-First Expense Management & Financial Analytics Desktop App**

A comprehensive personal finance management application built with React, TypeScript, and Dexie.js (IndexedDB). Track expenses across multiple wallets and currencies, manage budgets, set savings goals with auto-sweep, and visualize your financial health through interactive dashboards and analytics.

---

## ✨ Features

### Core Financial Tracking
- **Multi-Wallet Ledger**: Create and manage unlimited bank, cash, or credit card accounts with distinct currency assignments.
- **Expense & Income Recording**: Log transactions with descriptions, categories, receipt image attachments, and wallet links.
- **Category Management**: Pre-seeded categories (Food, Transport, Shopping, Entertainment, Healthcare, Bills, Savings, Other) with custom additions and subcategories.
- **Fund Transfers**: Move money between wallets with automatic balance reconciliation.
- **Multi-Currency Support**: 13+ currencies (USD, EUR, GBP, JPY, CNY, INR, PKR, AUD, CAD, SAR, AED, QAR, KWD) with configurable exchange rates.

### Budgeting & Alerts
- **Per-Category Budget Caps**: Set monthly spending limits per category.
- **Visual Overspend Warnings**: Responsive indicators when approaching or exceeding budget thresholds.
- **Budget Rollover**: Unused budget amounts roll over to the next month.

### Savings & Automation
- **Savings Goals**: Set targets with progress tracking, target dates, and auto-deposit flags. All amounts stored in base currency.
- **Auto-Sweep Engine**: Surplus (wallet balance − safety floor − capital shield) is automatically distributed to eligible goals. Pure base-currency arithmetic — no conversion.
- **Manual Goal Funding**: Allocate specific amounts from any wallet to any savings goal.

### Dashboards & Analytics

| Page | Widgets |
|------|---------|
| **Dashboard** | Stat cards (total expenses, income, net cashflow, transaction count), partitioned net worth card (total net worth + wallet balance), cashflow trend chart, category breakdown donut chart, daily burn rate pacing, capital allocation simulator, live liquidity distribution, recent transactions |
| **Analytics** | Cashflow trend line chart, expenses by category donut, expenses by wallet donut, budget performance table, top 5 expenses, financial health & savings card, wealth efficiency score, auto-sweep projection, spending velocity, financial runway |
| **Expenses** | Paginated, sortable, filterable transaction table with receipt preview, print, inline editing, transfer history |
| **Reports** | Multi-format export with audit summary |
| **Settings** | Wallets, categories, budgets, goals, currencies, exchange rates, sweep config, backup/restore |

### Interactive Tools
- **Capital Allocation Simulator**: Drag sliders to allocate across spending, savings, investments, debt, and charity — see projected annual returns in real time.
- **Wealth Efficiency Score**: Computes budget utilization efficiency with color-coded status.
- **Spending Velocity**: Month-over-month spending rate comparison.
- **Financial Runway**: Calculates months/days of runway based on current wealth and burn rate.
- **FI/RE Independence Index**: Emergency liquidity runway tracking.

### Data Export & Backup

| Format | Scope |
|--------|-------|
| **CSV** | Current month transaction ledger |
| **Excel (.xlsx)** | Multi-sheet workbook: Budget Performance, Account Balances, Savings Progress |
| **JSON Backup** | Full database export (all 9 tables) for cross-machine transfer |
| **PDF Report** | Generated financial summary with jsPDF + audit notes |

### UX Features
- **5-Second Undo**: Animated undo modal on deletions with ID-preserving restoration.
- **Receipt Preview & Print**: Attach base64 receipt images to expenses; zoom, preview, and print.
- **Dark/Light Theme**: Toggle with persistence to localStorage.
- **PWA Ready**: vite-plugin-pwa configured for progressive web app installability.
- **Responsive Grid Layouts**: Charts and widgets auto-scale inside locked-height card boundaries.

---

## 🏗 Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | React 18 + TypeScript |
| **Bundler** | Vite 6 |
| **Styling** | Tailwind CSS v4 + shadcn/ui + custom CSS custom properties |
| **State & Data** | Dexie.js (IndexedDB) with `dexie-react-hooks` for reactive queries |
| **Routing** | react-router v7 (createBrowserRouter) |
| **Charts** | recharts (Area, Bar, Pie, Cell) |
| **Export** | xlsx (Excel), jsPDF + jspdf-autotable (PDF), native CSV |
| **Animation** | framer-motion, canvas-confetti |
| **Icons** | lucide-react, @mui/icons-material |
| **Form** | react-hook-form, input-otp, cmdk |

### Currency Architecture (Base Currency Storage)

All financial data is stored in the **base currency** (the user's selected display currency). There is no hidden USD storage — what you set as your base currency is what gets used everywhere.

```
User enters 500,000 PKR → stored as 50,000,000 cents → displays as ₨500,000.00
```

**Display formatting** (`formatMoney` in `src/app/utils/monetary.ts`):
- Takes raw integer cents stored in the base currency
- Divides by 100 to get dollar value
- Formats with the currency symbol and proper decimal places
- Does **NOT** multiply by any exchange rate

```
IndexedDB (base currency cents) → formatMoney(cents, baseCurrency) → "₨500,000.00"
```

**Currency conversion** happens only in ONE place: `handleBaseCurrencyChange` in `/src/app/pages/Settings.tsx`. When you switch currency:
- All wallet balances are multiplied by `newRate / oldRate`
- All savings goal targets & current amounts are multiplied
- All budget limits are multiplied
- Safety floor & capital shield settings are multiplied
- After conversion, everything continues in the new base currency with no further conversion needed

**Key Rules:**
- All database values stored as raw integer cents in the base currency
- All arithmetic (auto-sweep, balance updates, budget checks) uses pure base-currency math
- Currency conversion only happens once: at the moment of switching currency
- The `formatMoney` formatter just divides by 100 and adds the symbol

### Data Flow

```
IndexedDB (Dexie.js expenseManagementDB)
  └─ useLiveQuery() ──> React Components (reactive re-render)
        │
        ├─ Dashboard ──> Pacing, Simulator, Health, Transactions
        ├─ Analytics ──> Charts, Budget Table, Savings Card, Widgets
        ├─ Expenses ──> Transaction List, Modal Forms
        └─ Settings ──> Wallets, Categories, Budgets, Goals, Export/Import
```

All data persists in IndexedDB (`expenseManagementDB`). React components subscribe via `useLiveQuery` for automatic re-rendering on data changes. The `ExpenseContext` provider exposes all CRUD operations and orchestrates transactional wallet balance updates.

### Database Schema (9 Tables)

| Table | Key Fields |
|-------|------------|
| `wallets` | `id`, `name`, `type` (bank\|cash\|card), `balance` (base currency cents), `currency` |
| `categories` | `id`, `name`, `icon`, `type`, `parent_id` |
| `expenses` | `id`, `description`, `amount` (base currency cents), `category`, `subcategory`, `date`, `wallet_id`, `receiptImage?`, `type` (expense\|income\|transfer) |
| `budgets` | `id`, `category_name`, `limit_amount` (base currency cents), `month_year`, `rollover_amount?` |
| `transfers` | `id`, `source_wallet_id`, `destination_wallet_id`, `amount` (base currency cents), `transfer_type`, `created_at` |
| `settings` | `id`, `base_currency`, `rate_mode`, `exchange_rates`, `last_processed_sweep`, `last_sweep_frequency`, `custom_currencies`, `allocation_config`, `sweep_frequency` |
| `savings_goals` | `id`, `goal_id`, `user_id`, `name`, `target_amount` (base currency cents), `current_amount` (base currency cents), `target_date`, `category_icon`, `auto_deposit`, `auto_deposit_surplus`, `allocation_ratio`, `sweep_ratio`, `linked_wallet_id`, `created_at`, `system_category`, `system_subcategory` |
| `currencies` | `id`, `code`, `name`, `symbol`, `isDefault`, `is_custom` |
| `auditLogs` | `id`, `transaction_id`, `date`, `original_description`, `original_amount`, `original_category`, `original_subcategory`, `original_type`, `reason`, `wallet_id?` |

### Context Providers (Wrapping Order)

```
ThemeProvider
  └─ SettingsProvider
       └─ ExpenseProvider
            └─ AllocationProvider
                 └─ RouterProvider
                      └─ Toaster
```

- **ThemeContext**: Dark/light mode toggle with localStorage persistence.
- **SettingsContext**: Base currency, exchange rates (API or manual), budget alert preferences, sweep configuration.
- **ExpenseContext**: Full CRUD for expenses, wallets, categories, budgets, transfers, savings goals; auto-sweep heartbeat engine (60s interval).
- **AllocationContext**: Capital allocation simulator state management.

---

## 📁 Project Structure

```
src/
├── main.tsx                              # Entry point + ErrorBoundary
├── app/
│   ├── App.tsx                           # Root: providers + router (useMemo)
│   ├── routes.tsx                        # Route definitions (routes in App.tsx)
│   ├── db.ts                             # Dexie schema, interfaces, seed data, hooks
│   ├── seed.ts                           # Default data seeding
│   ├── styles/
│   │   ├── index.css                     # Imports tailwind + theme
│   │   ├── tailwind.css                  # Tailwind v4 source directives
│   │   ├── theme.css                     # CSS custom properties (shadcn/ui tokens)
│   │   ├── globals.css                   # Global styles
│   │   └── fonts.css                     # Custom fonts
│   ├── components/
│   │   ├── *.tsx                         # 25+ app-specific widgets
│   │   ├── ui/                           # 50+ shadcn/ui primitives
│   │   └── figma/                        # Figma-integrated components
│   ├── pages/
│   │   ├── Dashboard.tsx                 # Main overview with stats, charts, widgets
│   │   ├── Analytics.tsx                 # Deep analytics with charts and metrics
│   │   ├── Expenses.tsx                  # Transaction list with CRUD
│   │   ├── AddExpense.tsx                # Add/edit expense form
│   │   ├── Settings.tsx                  # Wallets, categories, budgets, goals, export
│   │   ├── Transfer.tsx                  # Wallet-to-wallet transfer form
│   │   ├── Reports.tsx                   # Export center
│   │   └── ReportPage.tsx                # Report viewer
│   ├── context/
│   │   ├── ThemeContext.tsx              # Theme management
│   │   ├── SettingsContext.tsx           # Currency, rates, sweep config
│   │   ├── ExpenseContext.tsx            # Central data layer + CRUD operations
│   │   └── AllocationContext.tsx         # Simulator state
│   ├── hooks/
│   │   ├── useFinancialMetrics.ts        # Computed financial metrics (raw cents)
│   │   └── useAutoSweep.ts               # Auto-sweep scheduling hook
│   ├── services/
│   │   ├── savingsEngine.ts              # Savings goal management + auto-sweep logic
│   │   └── exchangeEngine.ts             # Currency conversion
│   ├── seeds/
│   │   └── currencies.ts                 # Default currency data
│   └── utils/
│       ├── monetary.ts                   # formatMoney — displays base currency (÷100 + symbol)
│       ├── currency.ts                   # convertCurrency, symbols, exchange rates
│       ├── goalBalanceEngine.ts          # Dynamic goal balances
│       ├── excelEngine.ts                # Excel/CSV export utilities
│       ├── pdfGenerator.ts               # PDF generation
│       ├── categoryColors.ts             # Category color mapping
│       ├── emojiDictionary.ts            # Emoji keywords
│       ├── aggregateDataByTimeframe.ts   # Time-based aggregation
│       ├── asyncMutex.ts                 # Concurrency control
│       ├── clock.ts                      # Time utilities
│       ├── reportGenerator.ts            # Report data preparation
│       └── dates.ts                      # Date formatting
```

---

## 🚀 Quickstart

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Production build → dist/
npm run build
```

---

## 🔒 Privacy & Data Safety

- **100% Offline-First**: All data stored in IndexedDB within your browser. No external servers, no telemetry, no cloud sync.
- **Local Persistence**: Data survives page refreshes and browser restarts. Use **Settings → Download Master Backup** for external safekeeping.
- **⚠️ Warning**: Clearing browser site data (cookies, cache) or running aggressive system cleaners may wipe the database. Always keep a JSON backup.

---

## 💻 Development

### Key Conventions
- Components use PascalCase filenames matching the exported function name.
- Widget components use `useLiveQuery` for reactive IndexedDB bindings.
- Computed metrics use `useMemo` with proper dependency arrays.
- All currency values stored as **raw integer cents in the base currency**.
- All currency formatting uses `formatMoney(cents, baseCurrency)` — divides by 100 and adds symbol.
- No component may multiply values by exchange rates manually.
- Currency conversion **only** in `handleBaseCurrencyChange` (Settings.tsx) when switching currency.

### Available Scripts
```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build with chunk splitting
npm run db:clear  # Clear IndexedDB
npm run db:export # Export DB to JSON
npm run db:import # Import DB from JSON
```

---

## 🚢 Deployment

### PWA Build
```bash
npm run build
```
The `dist/` folder contains a production-ready PWA with:
- Service worker (via `vite-plugin-pwa`)
- Manifest for installability
- Optimized, code-split bundles
- Static assets with cache-busting hashes

### Hosting Options

**Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```
- Auto-detects Vite config
- Edge network with automatic HTTPS
- PWA headers configured via `vercel.json`

**Netlify**
```bash
# Build command: npm run build
# Publish directory: dist
```
- Add `_headers` file for service worker caching:
  ```
  /sw.js
    Cache-Control: no-cache, no-store, must-revalidate
  ```

**GitHub Pages**
```bash
# In vite.config.ts, set base: '/your-repo-name/'
npm run build
# Push dist/ to gh-pages branch
```

**Docker**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 📄 License

MIT License

Copyright (c) 2026 Shahid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history (or check GitHub releases).

---

**Built with ❤️ using React, TypeScript, Dexie.js, and Tailwind CSS**