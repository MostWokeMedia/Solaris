# BUILD_PLAN.md — Step-by-Step Build Guide

## Existing Artifacts (Our Foundation)

We've already built and tested three React artifacts that serve as the UI and logic foundation for Solaris. These are NOT throwaway prototypes — they contain proven formulas, interaction patterns, and UI components that we'll adapt directly into the real app.

| Artifact | File | What it solves | Reuse in Solaris |
|----------|------|---------------|-----------------|
| **Recurring Bills Dashboard** | `recurring-bills-dashboard.jsx` | Bills CRUD, status cycling, credit card strategy, add/edit/delete modals, filter tabs | → **Recurring module**. Port UI components, adapt useState to Supabase queries. Keep modal patterns, status badge component, table layout. |
| **P&L Dashboard** | `pnl-dashboard.jsx` | Transaction CRUD, CSV import with bank presets, category management (add/rename/delete with propagation), monthly P&L charts, expense heatmap, revenue breakdown, category drill-down | → **Transactions module + Dashboard charts**. Port CSV import logic, category manager, transaction table, chart components. Replace hardcoded data with Supabase. Add AI categorization layer on top of existing import flow. |
| **Profit First** | `profit-first.jsx` | 26-column allocation grid, inline % and name editing, vault/tax running balances, quarterly distribution, credit card checklist, totals column, account manager modal | → **Allocations module**. Port entire grid component, allocation formulas, vault logic. Replace useState with Supabase-backed state. Wire category_id links to unified categories. |

### Adaptation Strategy

For each artifact:
1. **Copy** the component code into the Next.js project as a starting point
2. **Convert** JavaScript to TypeScript (add type annotations)
3. **Extract** reusable components (Modal, Field, Card, StatusBadge, etc.) into `components/shared/`
4. **Replace** `useState` with Supabase queries for persistent data (transactions, accounts, bills)
5. **Keep** `useState` for ephemeral UI state (filters, search, modal open/close)
6. **Wire** AI features into existing flows (CSV import gets auto-categorization, transaction list gets recurring detection)
7. **Unify** categories across all three modules via shared `categories` table

### What We Keep As-Is
- Allocation math (percentage × starting amount, vault accumulation, tax accumulation)
- CSV parsing and bank preset column mappings
- Category rename propagation logic
- Status cycling (Good → Paused → Cancelled)
- Inline editing UX pattern
- Dark theme color system and typography (DM Sans + Space Mono)
- Chart configurations (Recharts bar/area charts)
- Modal and form patterns

### What Changes
- Data source: hardcoded arrays → Supabase PostgreSQL
- State management: local useState → database-backed with optimistic updates
- Categories: three separate systems → one unified table
- Auth: none → Supabase Auth protecting all routes
- AI: none → Claude API for categorization, insights, recurring detection

## Phase Overview

| Phase | What | Foundation Artifact | Duration | You can use |
|-------|------|-------------------|----------|-------------|
| **0** | Dev environment setup | — | 1 session | Nothing yet |
| **1** | Database + Auth + Shell | All 3 (shared components) | 1-2 sessions | Login, nav, dark theme |
| **2** | Transactions + CSV Import | `pnl-dashboard.jsx` | 2-3 sessions | Import bank CSVs, manage transactions |
| **3** | AI Categorization | `pnl-dashboard.jsx` (import flow) | 1 session | Auto-categorize on import |
| **4** | Recurring Bills | `recurring-bills-dashboard.jsx` | 1-2 sessions | Track recurring expenses |
| **5** | Profit First | `profit-first.jsx` | 2-3 sessions | Full allocation grid |
| **6** | Dashboard + Integration | `pnl-dashboard.jsx` (charts) | 2-3 sessions | Budget vs Actual, alerts, insights |
| **7** | Plaid Bank Sync | — (new code) | 1-2 sessions | Automatic bank transactions |
| **8** | Polish + Deploy | — | 1 session | Production app |

Each phase results in a working, deployable app. You never wait until "everything is done" to use it.

---

## Phase 0: Dev Environment Setup

### Step 0.1 — Verify Node.js
```bash
node --version    # Need v18+
npm --version     # Should come with Node
```
If not v18+, install from https://nodejs.org (LTS version).

### Step 0.2 — Create the Next.js Project
```bash
cd ~/Projects    # or wherever you keep code
npx create-next-app@latest solaris
```
When prompted:
- TypeScript? **Yes**
- ESLint? **Yes**
- Tailwind CSS? **Yes**
- `src/` directory? **No**
- App Router? **Yes**
- Customize import alias? **No** (keep default @/)

```bash
cd solaris
```

### Step 0.3 — Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr recharts
npm install -D supabase
```

### Step 0.4 — Initialize Git
```bash
git init
git add .
git commit -m "Initial Next.js project"
```

### Step 0.5 — Create GitHub Repository
1. Go to https://github.com/new
2. Name: `solaris`
3. Public or Private (your call — Public lets you share it)
4. Don't initialize with README (we already have files)
5. Follow the "push existing repo" instructions GitHub shows:
```bash
git remote add origin https://github.com/YOUR_USERNAME/solaris.git
git branch -M main
git push -u origin main
```

### Step 0.6 — Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `solaris`
4. Generate a strong database password (save it somewhere safe)
5. Region: Choose closest to Dallas (US East or US Central)
6. Wait for project to provision (~2 minutes)
7. Go to Settings → API → copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret)

### Step 0.7 — Create Environment File
Create `.env.local` in your project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
```

Get your Claude API key from https://console.anthropic.com/settings/keys

**IMPORTANT:** Verify `.env.local` is in `.gitignore` (it should be by default). Never commit this file.

### Step 0.8 — Connect Vercel
1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your `solaris` GitHub repo
4. Add the same environment variables from `.env.local` in the Vercel dashboard (Settings → Environment Variables)
5. Deploy — Vercel gives you a URL like `solaris.vercel.app`

### Step 0.9 — Verify
```bash
npm run dev
```
Open http://localhost:3000 — you should see the Next.js starter page. Every `git push` now auto-deploys to Vercel.

---

## Phase 1: Database + Auth + App Shell

### Step 1.1 — Run Database Migrations
Create `supabase/migrations/001_initial.sql` with the full schema from ARCHITECTURE.md. Run via Supabase dashboard SQL Editor.

### Step 1.2 — Set Up Supabase Auth
- Configure email/password auth in Supabase dashboard
- Create your single user account
- Build login page at `app/login/page.tsx`
- Add auth middleware to protect all routes

### Step 1.3 — Extract Shared Components from Artifacts
Pull reusable pieces that all three artifacts share into `components/shared/`:
- `Modal.tsx` — from any artifact (all three use the same pattern)
- `Field.tsx` — form field wrapper with label
- `Card.tsx` — summary stat card with accent color bar
- `StatusBadge.tsx` — from recurring bills artifact
- `Section.tsx` — from P&L artifact (titled content container)
- Convert all to TypeScript with proper prop types

### Step 1.4 — Build App Shell
- Root layout with sidebar navigation (Dashboard, Allocations, Transactions, Recurring, Settings)
- Port the dark theme from artifacts: background `#0A0E17`, cards `#111827`, borders `#1E293B`
- Port typography: DM Sans body + Space Mono for numbers
- Mobile-responsive nav (hamburger menu on small screens)
- Empty placeholder pages for each route

### Checkpoint: You can log in, see the sidebar with the Solaris dark theme, navigate between pages. Shared components ready for all modules.

---

## Phase 2: Transactions + CSV Import

**Foundation:** `pnl-dashboard.jsx` — we port the transaction table, CSV import, and category manager from this artifact.

### Step 2.1 — Port Category Manager
- Adapt the category management modal from `pnl-dashboard.jsx` (the one with add/rename/delete and revenue/expense tags)
- Wire to Supabase `categories` table instead of local state
- Rename propagation now happens via database update (all transactions with that category_id stay linked automatically)

### Step 2.2 — Port Transaction Table
- Adapt `filteredTxns` logic, table UI, edit/delete modals from `pnl-dashboard.jsx`
- Replace `INITIAL_TXN` hardcoded array with Supabase query
- Keep the month filter, category filter, search, and revenue/expense toggle as-is
- Add pagination (artifact showed all at once — won't scale with bank data)

### Step 2.3 — Port CSV Import
- Adapt the CSV import modal from `pnl-dashboard.jsx` (bank presets, column mapping, preview)
- Add Bank of America preset to the existing Chase/Wells Fargo/Discover/Capital One list
- Wire to `/api/import/csv` server route for database insertion
- Keep the file parsing and column mapping logic from the artifact

### Step 2.4 — Seed Initial Data
- Import your existing Q1 2026 transaction data (from the xlsx) as a starting dataset
- Set up your existing categories from both the P&L and Recurring Bills artifacts

### Checkpoint: You can import a bank CSV, see transactions, edit/delete them, manage categories. Same UX as the artifact, but data persists.

---

## Phase 3: AI Categorization

**Foundation:** Layered on top of the CSV import flow ported from `pnl-dashboard.jsx`.

### Step 3.1 — Claude API Integration
- Server-side `/api/ai/categorize` endpoint
- Sends transaction descriptions + user's existing categories to Claude
- Returns category assignments with confidence

### Step 3.2 — Auto-categorize on Import
- Insert AI step between the artifact's CSV parsing and database insert
- After column mapping + preview (existing flow), call AI categorization
- Show AI suggestions in the preview table with a color indicator
- User can accept/reject/change each before final import
- The import modal from the artifact gains a new "Categorizing..." step

### Step 3.3 — Description Cleanup
- AI normalizes messy descriptions during import
- Stores raw bank text in `original_description`, cleaned version in `description`
- Uses your existing transaction history as context for normalization

### Checkpoint: CSV import now auto-categorizes. Same import UX from the artifact, but with an AI assist layer.

---

## Phase 4: Recurring Bills

**Foundation:** `recurring-bills-dashboard.jsx` — we port the entire bills UI, modals, and status system.

### Step 4.1 — Port Bills Table + CRUD
- Adapt the bills table, edit modal, and add modal from `recurring-bills-dashboard.jsx`
- Port StatusBadge component and click-to-cycle behavior
- Port filter tabs (All/Good/Paused/Cancelled)
- Wire to Supabase `recurring_bills` table instead of local state
- Map each bill's category to the unified `categories` table (replaces the hardcoded category strings)

### Step 4.2 — Port Summary Cards
- Adapt the four summary cards (Active Monthly, Paused, Cancelled, Card Payments)
- Values now computed from database queries instead of in-memory reduce

### Step 4.3 — Port Credit Card Strategy Section
- Adapt the expandable credit card section from the artifact
- Wire to a `credit_card_strategy` table or keep as local config (low-change data)

### Step 4.4 — AI Recurring Detection
- `/api/ai/detect-recurring` analyzes transaction history from Supabase
- Surfaces patterns: "Spotify $12.98 monthly — add to recurring?"
- Confirmation adds to `recurring_bills` with category pre-mapped

### Checkpoint: Full recurring bills management with same UX as artifact. AI suggests new recurring bills from transaction patterns.

---

## Phase 5: Profit First

**Foundation:** `profit-first.jsx` — we port the entire allocation grid, vault logic, and account management.

### Step 5.1 — Port Account Manager
- Adapt the account management modal from `profit-first.jsx` (add/edit/delete with name, percentage, tag)
- Wire to Supabase `allocation_accounts` table
- Add `category_id` foreign key linking each account to the unified categories table
- Keep inline editing (click percentage or name in grid to edit)

### Step 5.2 — Port Allocation Grid
- Adapt the 26-column grid from `profit-first.jsx`
- Keep the exact allocation formulas: `starting_amount × (percentage / 100)`
- Wire `starting_amount` and `vault_draw` inputs to Supabase `allocation_periods` table
- Keep the Accounts Total, After Allocations, and Totals column logic as-is

### Step 5.3 — Port Vault + Tax Tracking
- Keep the running cumulative vault balance logic from the artifact
- Keep the running cumulative tax balance logic
- Keep quarterly distribution display (Q END markers)
- Wire vault draws to database

### Step 5.4 — Port Credit Card Checklist
- Adapt from `profit-first.jsx` (toggleable checkmarks per period)
- Wire to Supabase `credit_cards` + `credit_card_checks` tables
- Keep the card manager modal

### Step 5.5 — Add Budget vs Committed Overlay (New)
- This is NEW — not in the artifact
- Each allocation account row shows a secondary number: total recurring bills mapped to that category
- Visual warning when recurring commitments exceed the allocation
- Example: "Subscriptions: 10% = $200 allocated | $319 committed in recurring bills"

### Checkpoint: Full Profit First grid with same UX as artifact, now persistent and linked to categories + recurring bills.

---

## Phase 6: Dashboard + Integration

**Foundation:** Chart components and heatmap from `pnl-dashboard.jsx`. The integration logic (Budget vs Actual) is new.

### Step 6.1 — Budget vs Actual (New — the core integration)
- Per category: allocated (from Profit First) vs committed (from Recurring) vs actual (from Transactions)
- Color-coded variance (green under, red over)
- Monthly and quarterly views
- This is the single most valuable view in the app — the reason the three modules exist together

### Step 6.2 — Port Summary Cards
- Adapt the Card component pattern used across all three artifacts
- Total income, total expenses, net income, vault balance, tax balance, profit margin

### Step 6.3 — Port Charts from P&L Artifact
- Monthly revenue vs expenses bar chart (from `pnl-dashboard.jsx` overview tab)
- Monthly Profit/Loss chart with per-bar coloring
- Category expense heatmap (from `pnl-dashboard.jsx` categories tab)
- Revenue source breakdown (from `pnl-dashboard.jsx` revenue tab)
- All chart configs reused — just swap Supabase data for hardcoded arrays

### Step 6.4 — AI Alerts + Insights (New)
- Spending pace warnings ("80% of Food budget used by the 15th")
- Structural gap alerts ("Subscriptions: $400 allocated, $639 committed")
- Periodic spending insights ("Coffee + ice cream = $5,880/year")
- Cash flow forecast based on income schedule + upcoming bills

### Checkpoint: Fully integrated dashboard showing plan vs commitments vs reality. All three artifact UIs now connected through shared data.

---

## Phase 7: Plaid Bank Sync

### Step 7.1 — Apply for Plaid Production Access
- Apply at https://dashboard.plaid.com
- Takes 1-3 weeks for approval
- Use Sandbox mode for development in the meantime

### Step 7.2 — Plaid Link Integration
- Plaid Link button in Settings page
- OAuth flow for each bank
- Store access tokens (encrypted) in bank_connections

### Step 7.3 — Transaction Sync
- Scheduled sync (or manual trigger)
- Fetch new transactions since last sync
- AI categorization on new transactions
- Deduplication against existing transactions
- Auto-detect income (Cosmic Pay from BofA)

### Step 7.4 — Auto-fill Profit First
- When income detected, suggest starting amount for current period
- User confirms

### Checkpoint: Bank transactions flow in automatically. Manual CSV import still available as backup.

---

## Phase 8: Polish + Production Deploy

### Step 8.1 — Error Handling
- Graceful error states for all API calls
- Loading skeletons
- Offline handling

### Step 8.2 — Performance
- Pagination for large transaction lists
- Optimize database queries with indexes
- Cache computed values where appropriate

### Step 8.3 — Final UI Polish
- Consistent spacing and typography
- Smooth transitions
- Keyboard shortcuts for power-user actions
- Mobile layout refinements

### Step 8.4 — Production Checklist
- [ ] All env vars set in Vercel
- [ ] Supabase RLS policies verified
- [ ] No API keys in client-side code
- [ ] Error monitoring (Vercel Analytics — free)
- [ ] Database backup schedule (Supabase handles this on paid, manual export on free)
- [ ] Test full flow: login → import → categorize → view dashboard

### Checkpoint: Production-ready app at your Vercel URL.
