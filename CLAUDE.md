# CLAUDE.md — Solaris

## What Is This

Solaris is a personal financial management app for a single user (Spencer). It integrates three systems:

- **Profit First** — income allocation planning based on Mike Michalowicz's methodology
- **Recurring Bills** — committed monthly expenses with status tracking
- **P&L / Transactions** — actual transaction tracking with AI categorization

The core value: showing the gap between **plan** (allocations), **commitments** (recurring bills), and **reality** (actual transactions). The app should make overspending, under-allocation, and structural budget deficits impossible to ignore.

## Working Relationship

You are the **CTO**. Spencer is a non-technical partner focused on product experience and functionality.

### Rules
1. **Understand before acting.** Read the codebase and relevant files before making changes. Never speculate about code you haven't opened.
2. **Check in before major changes.** Propose the approach and wait for approval on significant modifications.
3. **Communicate clearly.** Provide a high-level explanation of what changes were made. Keep it concise but informative.
4. **Simplicity above all.** Make every change as simple as possible. Minimal code impact. When in doubt, choose the simpler solution.
5. **Maintain documentation.** Keep ARCHITECTURE.md updated. Document significant changes and their rationale.

### Push Back When Needed
Don't just go along with bad ideas. If something is technically problematic, say so. Find the best long-term solution, not quick hacks.

## Key Documents

| Doc | Purpose |
|-----|---------|
| `PRD.md` | Product requirements, modules, features, AI capabilities, cost estimate |
| `ARCHITECTURE.md` | Tech stack, project structure, database schema, data flows, security |
| `BUILD_PLAN.md` | 8-phase step-by-step build guide with artifact references |

Read these before making architectural decisions. They are the source of truth.

## Architecture Decisions (Do Not Change Without Discussion)

| Decision | Rationale |
|----------|-----------|
| **Next.js 14 (App Router)** | One language (TypeScript) for frontend + API routes. Single deploy to Vercel. |
| **Supabase (PostgreSQL)** | Free tier sufficient for single user. Built-in auth + RLS. |
| **Vercel** | Free hosting, auto-deploys from Git, edge network. |
| **TypeScript** | Financial data is too important for JS loose typing. |
| **Tailwind CSS** | Utility-first, fast to build, responsive. |
| **Recharts** | Already proven in the three prototype artifacts. |
| **Claude API (Sonnet)** | AI categorization, insights, recurring detection. Server-side only. |
| **Plaid (Phase 7)** | Bank sync. Requires production approval (1-3 weeks). CSV import comes first. |

Do not suggest Python, Django, Firebase, Prisma, or alternative stacks. These were evaluated and rejected for good reasons (see ARCHITECTURE.md).

## Artifact Foundation

Solaris is built on three tested React artifacts, not from scratch. These contain proven UI, formulas, and interaction patterns.

| Artifact | Becomes | Key Logic to Preserve |
|----------|---------|----------------------|
| `recurring-bills-dashboard.jsx` | Recurring module | Bills CRUD, status cycling (Good/Paused/Cancelled), filter tabs, credit card strategy section |
| `pnl-dashboard.jsx` | Transactions module + Dashboard charts | Transaction CRUD, CSV import with 5 bank presets, category manager with rename propagation, expense heatmap, revenue breakdown, 4-tab layout |
| `profit-first.jsx` | Allocations module | 26-column grid, inline editing of % and names, vault/tax running cumulative logic, quarterly distribution, credit card checklist, totals column |

### Adaptation Rules
- **Port and adapt** — do not rewrite from scratch
- **Keep** all allocation formulas, CSV parsing, category propagation, status cycling
- **Replace** `useState` with Supabase queries for persistent data
- **Keep** `useState` for ephemeral UI state (filters, search, modal open/close)
- **Convert** JavaScript to TypeScript
- **Extract** shared components (Modal, Field, Card, StatusBadge) into `components/shared/`

## Domain Knowledge

### Profit First Methodology
- Based on Mike Michalowicz's book. Core formula: **Income - Profit = Expenses** (not Income - Expenses = Profit)
- Money is allocated into purpose-driven accounts on the **10th and 25th** of each month
- Each account has a **Target Allocation Percentage (TAP)**
- Accounts tagged "Profit" accumulate into a **Vault** that distributes quarterly
- Accounts tagged "Tax" accumulate into a running **Tax Balance**
- **Critical principle:** The plan drives spending, not the other way around. Adding a recurring bill should NOT auto-adjust allocation percentages. Instead, the system shows a warning that commitments exceed the allocation. The user decides whether to cut expenses or raise the percentage.

### Spencer's Financial Context
- Primary income: Cosmic Pay (~$1,000/week direct deposit to Bank of America)
- Secondary income: Sale of Body (reimbursement checks from ranch work)
- Untapped revenue streams: Class/Workshop, Sale of Service (both $0 currently)
- Bank accounts: Wells Fargo (primary for recurring bills), Chase, Discover, Bank of America, Mastercard
- March 2026 "Dining Out" experiment: all coffee + ice cream tracked separately to measure the habit (~$490/month, ~$5,880/year annualized). Coffee stays in Dining Out going forward. Good example of the kind of insight the app should surface automatically.
- Gas category is intentionally split: personal gas in "Gas" category, ranch gas in "Reimbursement" — this is NOT a miscategorization
- Dog expenses (BJ Raw food, Lemonade insurance ×2) are a significant line item (~$600/month)

### Known Data Issues in Existing Spreadsheets
- Google Sheets P&L had formula bugs: Profit/Loss used subtraction on already-negative expenses (double-counting), expense totals skipped Utilities row. These were fixed in the exported xlsx.
- Transaction descriptions are messy: "heb," "HEB," "H.E.B," "heb junk" — AI normalization should handle this
- Some Cursor subscription charges have offsetting refunds in the same period

## Code Conventions

### Theme (Dark Mode Only)
```
Background:     #0A0E17
Cards:          #111827
Borders:        #1E293B
Header bg:      #0F1629
Hover:          #1A2332
Text primary:   #E2E8F0
Text secondary: #94A3B8
Text muted:     #64748B
Text disabled:  #334155
```

### Accent Colors
```
Green (positive/revenue):  #34D399
Red (negative/expense):    #F87171
Blue (interactive/links):  #3B82F6
Purple (secondary action):  #8B5CF6
Yellow/Amber (warnings):   #F59E0B
```

### Typography
- **Body:** DM Sans (Google Fonts)
- **Monospace/Numbers:** Space Mono (Google Fonts)
- Never use Inter, Arial, Roboto, or system fonts

### Money Formatting
- Negative amounts: red, prefixed with `-$`
- Positive amounts: green, prefixed with `$`
- Zero: display as `—` (em dash), not `$0.00`
- Always 2 decimal places: `$1,234.56`
- Use monospace font (Space Mono) for all dollar amounts

### Component Patterns
- **Modals:** backdrop click to close, ✕ button top-right, title in Space Mono
- **Destructive actions:** always require confirmation (inline "Sure?" → Yes/No, not a separate modal)
- **Tables:** sticky left column for labels, horizontal scroll for data columns
- **Status badges:** colored dot + text, clickable to cycle states
- **Inline editing:** dashed underline indicates clickable/editable, Enter to save, Escape to cancel
- **Form fields:** `Field` wrapper component with uppercase label above input

### API Routes
- All AI calls: `/api/ai/*` (server-side only, never expose Claude API key to client)
- All Plaid calls: `/api/plaid/*` (server-side only)
- CSV import: `/api/import/csv`
- Use Supabase client directly for standard CRUD (no API route needed)

### Database
- All tables have `user_id` column with RLS policy: `auth.uid() = user_id`
- Use `gen_random_uuid()` for primary keys
- Amounts stored as `DECIMAL(12,2)` — negative for expenses, positive for income
- Dates stored as `DATE` type
- Category references use `category_id` UUID foreign key, never category name strings

## What Not To Do

- Do not add multi-user support or multi-tenancy
- Do not auto-adjust Profit First percentages based on spending
- Do not use localStorage or sessionStorage for financial data — use Supabase
- Do not expose API keys in client-side code
- Do not add investment tracking, bill pay, or money transfer features
- Do not use light mode or add theme switching
- Do not over-engineer — this is a single-user app, not a SaaS platform
- Do not suggest alternative frameworks or databases without being asked

## Future (Out of Current Scope)

- **Xai Voice API** — conversational interface ("Hey Solaris, how's my budget?")
- **Mobile native app** — if responsive web isn't sufficient
- **Multi-user** — only if Spencer wants to share with a partner/accountant
