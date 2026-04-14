# ARCHITECTURE.md — Solaris — Personal Financial Command Center

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 14 (App Router) | React-based, server components, API routes built-in, deploys to Vercel in one click |
| **Hosting** | Vercel (Hobby tier) | Free, auto-deploys from Git, edge network, perfect for Next.js |
| **Database** | Supabase (PostgreSQL) | Free tier generous (500MB, 50k rows), real-time subscriptions, built-in auth, REST API |
| **Auth** | Supabase Auth | Simple email/password for single user, protects all data behind login |
| **Bank Sync** | Plaid (Phase 2) | Industry standard for bank connections, handles OAuth + security |
| **AI** | Claude API (Sonnet) | Auto-categorization, insights, description cleanup |
| **Styling** | Tailwind CSS | Utility-first, fast to build, responsive out of the box |
| **Charts** | Recharts | Already proven in our artifacts, works well with React |
| **Language** | TypeScript | Catches bugs early, better IDE support in VS Code |

## Artifact Foundation

Solaris is built on three tested React artifacts, not from scratch. These contain proven UI patterns, formulas, and interaction logic.

| Artifact | Lines | Key Components to Port |
|----------|-------|----------------------|
| `recurring-bills-dashboard.jsx` | ~550 | BillsTable, BillModal, StatusBadge, SummaryCards, CreditCardStrategy, filter tabs |
| `pnl-dashboard.jsx` | ~688 | TransactionTable, CsvImport (with 5 bank presets), CategoryManager (add/rename/delete with propagation), CategoryHeatmap, RevenueBreakdown, charts (BarChart, AreaChart), drill-down modal |
| `profit-first.jsx` | ~629 | AllocationGrid (26 columns), inline editing (% and name), vault/tax cumulative logic, quarterly distribution, CreditCardChecklist, AccountManager modal, Totals column |

### Shared Patterns Across All Three
- **Modal** component (same structure in all three)
- **Field** component (label + input wrapper)
- **Card** component (stat card with accent color bar)
- **Dark theme** (`#0A0E17` bg, `#111827` cards, `#1E293B` borders)
- **Typography** (DM Sans body, Space Mono monospace numbers)
- **Money formatting** (negative = red, positive = green, $X,XXX.XX format)
- **Hover states** on table rows (`#1A2332`)
- **Confirmation pattern** for destructive actions (inline "Sure?" → Yes/No)

## Project Structure

```
solaris/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (nav, auth wrapper)
│   ├── page.tsx                # Dashboard (home)
│   ├── allocations/
│   │   └── page.tsx            # Profit First grid
│   ├── transactions/
│   │   └── page.tsx            # P&L + transaction management
│   ├── recurring/
│   │   └── page.tsx            # Recurring bills tracker
│   ├── settings/
│   │   └── page.tsx            # Categories, bank connections, preferences
│   ├── login/
│   │   └── page.tsx            # Auth page
│   └── api/
│       ├── ai/
│       │   ├── categorize/route.ts      # AI categorization endpoint
│       │   ├── insights/route.ts        # AI spending insights
│       │   └── detect-recurring/route.ts # AI recurring detection
│       ├── plaid/
│       │   ├── create-link/route.ts     # Plaid Link token
│       │   ├── exchange-token/route.ts  # Exchange public token
│       │   └── sync/route.ts           # Sync transactions
│       └── import/
│           └── csv/route.ts            # CSV import + AI categorization
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── dashboard/
│   │   ├── BudgetVsActual.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── Alerts.tsx
│   │   └── CashFlowForecast.tsx
│   ├── allocations/
│   │   ├── AllocationGrid.tsx
│   │   ├── AccountRow.tsx
│   │   └── VaultSection.tsx
│   ├── transactions/
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionModal.tsx
│   │   ├── CsvImport.tsx
│   │   ├── CategoryHeatmap.tsx
│   │   └── RevenueBreakdown.tsx
│   ├── recurring/
│   │   ├── BillsTable.tsx
│   │   ├── BillModal.tsx
│   │   └── StatusBadge.tsx
│   └── shared/
│       ├── Modal.tsx
│       ├── Card.tsx
│       └── CategoryManager.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── server.ts           # Server Supabase client
│   │   └── middleware.ts       # Auth middleware
│   ├── plaid/
│   │   └── client.ts           # Plaid client config
│   ├── ai/
│   │   └── claude.ts           # Claude API helper
│   └── utils/
│       ├── money.ts            # Formatting helpers
│       ├── dates.ts            # Date helpers
│       └── categories.ts       # Category mapping logic
├── types/
│   └── index.ts                # TypeScript type definitions
├── supabase/
│   └── migrations/             # Database migration SQL files
│       ├── 001_categories.sql
│       ├── 002_transactions.sql
│       ├── 003_recurring_bills.sql
│       ├── 004_allocations.sql
│       └── 005_bank_connections.sql
├── .env.local                  # API keys (never committed)
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── PRD.md
├── ARCHITECTURE.md
└── BUILD_PLAN.md
```

## Database Schema

### categories
```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  allocation_tag TEXT CHECK (allocation_tag IN ('profit', 'tax', NULL)),
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  original_description TEXT,        -- raw bank description before AI cleanup
  amount DECIMAL(12,2) NOT NULL,    -- negative = expense, positive = income
  category_id UUID REFERENCES categories(id),
  bank_account TEXT,                -- which account this came from
  plaid_transaction_id TEXT,        -- Plaid reference (Phase 2)
  import_batch TEXT,                -- groups CSV imports together
  note TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### recurring_bills
```sql
CREATE TABLE recurring_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('good', 'paused', 'cancelled')),
  due_date DATE,
  category_id UUID REFERENCES categories(id),
  paid_from TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### allocation_accounts
```sql
CREATE TABLE allocation_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  tag TEXT CHECK (tag IN ('profit', 'tax', NULL)),
  category_id UUID REFERENCES categories(id),  -- maps to unified category
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### allocation_periods
```sql
CREATE TABLE allocation_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  period_key TEXT NOT NULL,          -- e.g. "0-10" for Jan 10th
  starting_amount DECIMAL(12,2) DEFAULT 0,
  vault_draw DECIMAL(12,2) DEFAULT 0,
  year INT NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_key, year)
);
```

### credit_cards
```sql
CREATE TABLE credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### credit_card_checks
```sql
CREATE TABLE credit_card_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  year INT NOT NULL DEFAULT 2026,
  paid BOOLEAN DEFAULT false,
  UNIQUE(card_id, period_key, year)
);
```

### bank_connections (Phase 2)
```sql
CREATE TABLE bank_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  plaid_item_id TEXT NOT NULL,
  plaid_access_token TEXT NOT NULL,  -- encrypted
  institution_name TEXT,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Row Level Security

Every table gets RLS policies so only the authenticated user sees their data:

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own data" ON transactions
  FOR ALL USING (auth.uid() = user_id);
```

Same pattern for all tables.

## Data Flow

### CSV Import Flow
```
User uploads CSV
  → Browser parses CSV, maps columns
  → Sends batch to /api/import/csv
  → Server calls Claude API: "categorize these transactions"
  → Claude returns categories based on description + user's existing categories
  → Server inserts transactions into Supabase
  → Browser refreshes transaction list
```

### Plaid Sync Flow (Phase 2)
```
User clicks "Connect Bank"
  → /api/plaid/create-link returns Link token
  → Plaid Link UI opens, user logs into bank
  → Plaid returns public token
  → /api/plaid/exchange-token exchanges for access token, stores in bank_connections
  → /api/plaid/sync fetches transactions
  → Server calls Claude for categorization
  → Inserts into Supabase
```

### Budget vs Actual Calculation
```
For each category:
  allocated  = allocation_account.percentage × sum of starting_amounts for period
  committed  = sum of recurring_bills WHERE status = 'good' AND category matches
  actual     = sum of transactions WHERE category matches AND date in period
  
  Display: allocated | committed | actual | variance
```

## API Keys Required

Stored in `.env.local`, never committed to Git:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
ANTHROPIC_API_KEY=your_claude_key
PLAID_CLIENT_ID=your_plaid_id          # Phase 2
PLAID_SECRET=your_plaid_secret          # Phase 2
```

## Security Notes

- All API keys server-side only (except Supabase anon key which is safe to expose)
- Plaid access tokens encrypted at rest in Supabase
- RLS on every table ensures data isolation
- Auth required for all pages except login
- No financial data in client-side logs
