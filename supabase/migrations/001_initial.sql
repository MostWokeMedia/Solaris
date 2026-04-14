-- Solaris: Initial database schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- CATEGORIES (unified across all modules)
-- ============================================
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  allocation_tag TEXT CHECK (allocation_tag IN ('profit', 'tax', NULL)),
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own categories" ON categories
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  original_description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  bank_account TEXT,
  plaid_transaction_id TEXT,
  import_batch TEXT,
  note TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);

-- ============================================
-- RECURRING BILLS
-- ============================================
CREATE TABLE recurring_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('good', 'paused', 'cancelled')),
  due_date DATE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  paid_from TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own recurring_bills" ON recurring_bills
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ALLOCATION ACCOUNTS (Profit First)
-- ============================================
CREATE TABLE allocation_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  tag TEXT CHECK (tag IN ('profit', 'tax', NULL)),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE allocation_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own allocation_accounts" ON allocation_accounts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ALLOCATION PERIODS (per pay period data)
-- ============================================
CREATE TABLE allocation_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  starting_amount DECIMAL(12,2) DEFAULT 0,
  vault_draw DECIMAL(12,2) DEFAULT 0,
  year INT NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_key, year)
);

ALTER TABLE allocation_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own allocation_periods" ON allocation_periods
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CREDIT CARDS (Profit First checklist)
-- ============================================
CREATE TABLE credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own credit_cards" ON credit_cards
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CREDIT CARD CHECKS
-- ============================================
CREATE TABLE credit_card_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  year INT NOT NULL DEFAULT 2026,
  paid BOOLEAN DEFAULT false,
  UNIQUE(card_id, period_key, year)
);

-- RLS for credit_card_checks goes through the card's user_id
ALTER TABLE credit_card_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own credit_card_checks" ON credit_card_checks
  FOR ALL USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

-- ============================================
-- BANK CONNECTIONS (Phase 7 — Plaid)
-- ============================================
CREATE TABLE bank_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL,
  plaid_access_token TEXT NOT NULL,
  institution_name TEXT,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own bank_connections" ON bank_connections
  FOR ALL USING (auth.uid() = user_id);
