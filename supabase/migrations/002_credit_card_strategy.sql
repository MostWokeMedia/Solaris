-- Credit card strategy (editable cards on recurring bills page)
CREATE TABLE credit_card_strategy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT,
  bonus TEXT,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  pay_range TEXT,
  pay_date TEXT,
  color TEXT DEFAULT '#3B82F6',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_card_strategy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own credit_card_strategy" ON credit_card_strategy
  FOR ALL USING (auth.uid() = user_id);
