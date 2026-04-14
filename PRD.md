# PRD.md — Solaris — Personal Financial Command Center

## Overview

A personal financial management app that integrates three systems into one:

- **Profit First** — income allocation planning (the plan)
- **Recurring Bills** — committed monthly expenses (the commitments)
- **P&L Dashboard** — actual transaction tracking and analysis (the reality)

The core value is showing the **gap between plan and reality** — where allocations don't match commitments, where spending exceeds budgets, and where money is leaking.

**Built on tested prototypes:** Three React artifacts were developed and refined in Claude as interactive prototypes. These serve as the UI and logic foundation — not throwaway mockups. The artifacts contain proven allocation formulas, CSV import with bank presets, category management with rename propagation, and the complete Profit First grid with vault tracking. The production app adapts these directly, replacing local state with Supabase persistence and adding AI + bank sync layers.

## User

Single user (Spencer). No multi-tenancy needed. Simple auth to protect financial data.

## Platforms

- **Primary:** Desktop web app (accessed via browser)
- **Secondary:** Mobile-responsive for phone access (same app, responsive layout)
- No native mobile apps needed.

## Core Modules

### 1. Dashboard (Home)

The first thing you see. Answers: "How am I doing this month?"

- **Budget vs Actual** — per category, shows Profit First allocation vs actual P&L spending
- **Recurring vs Allocated** — per category, shows committed recurring bills vs Profit First allocation
- **Monthly summary cards** — total income, total expenses, net income, vault balance
- **Alerts** — AI-generated warnings when spending exceeds pace, when categories are over-committed, when unknown transactions need categorization
- **Cash flow forecast** — based on income schedule, upcoming bills, and spending patterns

### 2. Profit First (The Plan)

The 26-column allocation grid from the artifact, connected to real data.

- **Starting Amount** per pay period (auto-filled when income detected from bank, manual override available)
- **Allocation accounts** with editable names, percentages, and tags (Profit/Tax/None)
- **Vault Balance** — running cumulative of Profit-tagged accounts
- **Tax Balance** — running cumulative of Tax-tagged accounts
- **Quarterly distribution** markers
- **Credit card payment checklist**
- **Totals column**
- **Inline editing** of percentages and account names
- **Budget vs Committed overlay** — shows recurring bill total next to each allocation

### 3. Recurring Bills (The Commitments)

Tracks all recurring expenses with status.

- **Fields:** Name, Amount, Status (Good/Paused/Cancelled), Due Date, Category, Paid From, Notes
- **CRUD** — add, edit, delete bills
- **Status cycling** — quick-toggle between Good/Paused/Cancelled
- **Category mapping** — each bill maps to a Profit First allocation account
- **Auto-detection** — AI scans transactions for recurring patterns and suggests new bills
- **Summary cards** — total active, total paused, total cancelled

### 4. Transactions (The Reality)

Full transaction ledger with analysis.

- **Auto-import from banks** via Plaid (Phase 2) or CSV import (Phase 1)
- **AI auto-categorization** — Claude reads transaction descriptions and assigns categories based on history
- **Description cleanup** — AI normalizes messy bank descriptions ("heb," "HEB," "H.E.B" → "HEB")
- **CRUD** — add, edit, delete transactions
- **Filters** — by month, category, type (revenue/expense), search
- **Category management** — add, rename, delete categories (changes propagate everywhere)
- **Monthly/Quarterly P&L view** — revenue vs expenses breakdown
- **Category heatmap** — spending per category per month
- **Revenue breakdown** — income sources with percentages and trends

### 5. Categories (Shared)

One unified category system across all three modules.

- Each category maps to a Profit First allocation account
- Recurring bills reference categories
- Transactions reference categories
- Renaming a category updates everywhere
- Categories have a type: Revenue or Expense

## Bank Connections

### Phase 1 (MVP)
- CSV import from Wells Fargo, Chase, Discover, Bank of America, Mastercard
- Bank preset column mappings
- AI auto-categorization on import
- Manual transaction entry

### Phase 2 (Post-Plaid Approval)
- Plaid integration for automatic transaction syncing
- Connected accounts: Wells Fargo, Chase, Discover, Bank of America, Mastercard
- Automatic income detection (Cosmic Pay direct deposits from Bank of America)
- Real-time transaction feed

## AI Features

All powered by Claude API (claude-sonnet-4-20250514).

1. **Auto-categorization** — on CSV import or Plaid sync, categorize transactions based on description + historical patterns
2. **Recurring bill detection** — identify transactions that repeat monthly and suggest adding to Recurring Bills
3. **Description normalization** — clean up messy bank descriptions
4. **Spending alerts** — flag when category spending exceeds allocation pace
5. **Gap analysis** — compare allocations vs commitments vs actuals and surface structural problems
6. **Spending insights** — periodic analysis like "coffee + ice cream = $5,880/year"

## Non-Goals (Current Scope)

- No multi-user support
- No auto-adjustment of Profit First percentages (plan drives behavior, not vice versa)
- No investment tracking
- No bill pay / money transfer
- No native mobile apps

## Future Considerations

- **Xai Voice API** — conversational interface ("Hey Solaris, how's my budget this month?"). Evaluate once core app is stable.

## Monthly Cost Estimate

| Service | Cost |
|---------|------|
| Vercel (Hobby) | $0 |
| Supabase (Free tier) | $0 |
| Plaid (5 connections) | ~$1.50/mo |
| Claude API (light usage) | ~$2-5/mo |
| **Total** | **~$3.50-6.50/mo** |
