export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: 'revenue' | 'expense';
  allocation_tag: 'profit' | 'tax' | null;
  color: string | null;
  sort_order: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  date: string;
  description: string;
  original_description: string | null;
  amount: number;
  category_id: string | null;
  bank_account: string | null;
  plaid_transaction_id: string | null;
  import_batch: string | null;
  note: string | null;
  is_recurring: boolean;
  created_at: string;
};

export type RecurringBill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  status: 'good' | 'paused' | 'cancelled';
  due_date: string | null;
  category_id: string | null;
  paid_from: string | null;
  note: string | null;
  created_at: string;
};

export type AllocationAccount = {
  id: string;
  user_id: string;
  name: string;
  percentage: number;
  tag: 'profit' | 'tax' | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
};

export type AllocationPeriod = {
  id: string;
  user_id: string;
  period_key: string;
  starting_amount: number;
  vault_draw: number;
  year: number;
  created_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type CreditCardCheck = {
  id: string;
  card_id: string;
  period_key: string;
  year: number;
  paid: boolean;
};
