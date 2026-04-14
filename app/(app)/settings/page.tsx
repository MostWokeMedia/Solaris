'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import CategoryManager from '@/components/shared/CategoryManager';
import type { Category } from '@/types';

const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500";
const inputColors = { background: '#0A0E17', borderColor: '#1E293B', color: '#E2E8F0' };

export default function SettingsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<{ category_id: string | null }[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ txnCount: 0, billCount: 0, acctCount: 0 });

  const loadData = useCallback(async () => {
    const [{ data: catData }, { data: txnData }, { data: { user } }, { count: billCount }, { count: acctCount }] = await Promise.all([
      supabase.from('categories').select('*').order('type').order('sort_order'),
      supabase.from('transactions').select('category_id'),
      supabase.auth.getUser(),
      supabase.from('recurring_bills').select('*', { count: 'exact', head: true }),
      supabase.from('allocation_accounts').select('*', { count: 'exact', head: true }),
    ]);
    setCategories(catData || []);
    setTransactions(txnData || []);
    setUserEmail(user?.email || '');
    setStats({ txnCount: txnData?.length || 0, billCount: billCount || 0, acctCount: acctCount || 0 });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const txnCounts = transactions.reduce((acc, t) => {
    if (t.category_id) acc[t.category_id] = (acc[t.category_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  async function handleAddCategory(name: string, type: 'revenue' | 'expense') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('categories').insert({ user_id: user.id, name, type });
    loadData();
  }

  async function handleRenameCategory(id: string, newName: string) {
    await supabase.from('categories').update({ name: newName }).eq('id', id);
    loadData();
  }

  async function handleDeleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: '#64748B' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>Manage categories, view account info</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
            Account
          </h3>
          <div className="mb-3">
            <div className="text-[10px] font-semibold uppercase" style={{ color: '#64748B', letterSpacing: '0.5px' }}>Email</div>
            <div className="mt-1 text-sm" style={{ color: '#E2E8F0' }}>{userEmail}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#1E293B' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#3B82F6' }}>{stats.txnCount}</div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>Transactions</div>
            </div>
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#1E293B' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#FBBF24' }}>{stats.billCount}</div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>Recurring Bills</div>
            </div>
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: '#1E293B' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#34D399' }}>{stats.acctCount}</div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>Allocation Accts</div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Categories
            </h3>
            <button
              onClick={() => setShowCatMgr(true)}
              className="rounded-lg border-none px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', cursor: 'pointer' }}
            >
              Manage
            </button>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase" style={{ color: '#34D399', letterSpacing: '0.5px' }}>
              Revenue ({categories.filter((c) => c.type === 'revenue').length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.type === 'revenue').map((cat) => (
                <span key={cat.id} className="rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: '#1E293B', color: '#CBD5E1' }}>
                  {cat.name}
                </span>
              ))}
              {categories.filter((c) => c.type === 'revenue').length === 0 && (
                <span className="text-xs" style={{ color: '#475569' }}>None yet</span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase" style={{ color: '#F87171', letterSpacing: '0.5px' }}>
              Expense ({categories.filter((c) => c.type === 'expense').length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.type === 'expense').map((cat) => (
                <span key={cat.id} className="rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: '#1E293B', color: '#CBD5E1' }}>
                  {cat.name}
                </span>
              ))}
              {categories.filter((c) => c.type === 'expense').length === 0 && (
                <span className="text-xs" style={{ color: '#475569' }}>None yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
            Bank Connections
          </h3>
          <p className="text-xs" style={{ color: '#475569' }}>
            Plaid bank sync coming soon. Use CSV import in the Transactions page for now.
          </p>
        </div>

        {/* About */}
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
            About Solaris
          </h3>
          <div className="space-y-2 text-xs" style={{ color: '#64748B' }}>
            <div>Personal Financial Command Center</div>
            <div>Profit First methodology &middot; Recurring Bills &middot; P&L Tracking</div>
            <div className="pt-1" style={{ color: '#334155' }}>
              Built with Next.js, Supabase, Tailwind, Recharts, and Claude AI
            </div>
          </div>
        </div>
      </div>

      <CategoryManager
        open={showCatMgr}
        onClose={() => setShowCatMgr(false)}
        categories={categories}
        onAdd={handleAddCategory}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
        transactionCounts={txnCounts}
      />
    </div>
  );
}
