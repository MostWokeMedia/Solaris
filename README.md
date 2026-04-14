# Solaris

Personal Financial Command Center built on the Profit First methodology.

## Modules

- **Dashboard** — Budget vs Actual, charts, unified financial overview
- **Allocations** — Profit First 26-column allocation grid with vault & tax tracking
- **Transactions** — Transaction management, CSV import with AI categorization
- **Recurring Bills** — Committed expense tracking with status cycling

## Tech Stack

- Next.js (App Router, TypeScript)
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS
- Recharts
- Claude AI (transaction categorization)
- Vercel (hosting)

## Setup

```bash
npm install
cp .env.local.example .env.local  # Fill in your keys
npm run dev
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```
