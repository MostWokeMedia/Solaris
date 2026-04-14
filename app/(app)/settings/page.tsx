'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlaidLink } from 'react-plaid-link';
import CategoryManager from '@/components/shared/CategoryManager';
import type { Category } from '@/types';

type BankConnection = {
  id: string;
  institution_name: string;
  last_synced: string | null;
  created_at: string;
};

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

  // Plaid
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: catData }, { data: txnData }, { data: { user } }, { count: billCount }, { count: acctCount }, { data: connData }] = await Promise.all([
      supabase.from('categories').select('*').order('type').order('sort_order'),
      supabase.from('transactions').select('category_id'),
      supabase.auth.getUser(),
      supabase.from('recurring_bills').select('*', { count: 'exact', head: true }),
      supabase.from('allocation_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('bank_connections').select('id, institution_name, last_synced, created_at').order('created_at'),
    ]);
    setCategories(catData || []);
    setTransactions(txnData || []);
    setUserEmail(user?.email || '');
    setStats({ txnCount: txnData?.length || 0, billCount: billCount || 0, acctCount: acctCount || 0 });
    setConnections(connData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Plaid Link
  const [plaidError, setPlaidError] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function handleConnectBank() {
    setPlaidError('');
    setConnecting(true);
    try {
      const res = await fetch('/api/plaid/create-link', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setPlaidError(data.error || 'Failed to connect. Check Plaid credentials in environment variables.');
      }
    } catch (err) {
      setPlaidError('Network error — could not reach the server.');
    }
    setConnecting(false);
  }

  async function handlePlaidSuccess(publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) {
    await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_token: publicToken,
        institution: metadata.institution,
      }),
    });
    setLinkToken(null);
    loadData();
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId);
    setSyncResult(null);
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({
          id: connectionId,
          message: data.imported > 0
            ? `Imported ${data.imported} new transactions (${data.duplicates_skipped} duplicates skipped)`
            : 'No new transactions found',
        });
        loadData();
      } else {
        setSyncResult({ id: connectionId, message: data.error || 'Sync failed' });
      }
    } catch {
      setSyncResult({ id: connectionId, message: 'Sync failed' });
    }
    setSyncing(null);
  }

  async function handleDisconnect(connectionId: string) {
    await supabase.from('bank_connections').delete().eq('id', connectionId);
    setConfirmDisconnect(null);
    loadData();
  }

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

        {/* Bank Connections */}
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Bank Connections
            </h3>
            <button
              onClick={handleConnectBank}
              disabled={connecting}
              className="rounded-lg border-none px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}
            >
              {connecting ? 'Connecting...' : '+ Connect Bank'}
            </button>
          </div>

          {plaidError && (
            <div className="mb-3 rounded-lg border px-4 py-3 text-xs"
              style={{ background: '#3B0D1A', borderColor: '#F8717133', color: '#F87171' }}>
              {plaidError}
            </div>
          )}

          {connections.length === 0 ? (
            <p className="text-xs" style={{ color: '#475569' }}>
              No banks connected. Click &ldquo;Connect Bank&rdquo; to link your accounts via Plaid.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="rounded-lg border px-4 py-3" style={{ borderColor: '#1E293B' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#E2E8F0' }}>{conn.institution_name}</div>
                      <div className="mt-0.5 text-[10px]" style={{ color: '#64748B' }}>
                        {conn.last_synced
                          ? `Last synced: ${new Date(conn.last_synced).toLocaleDateString()} ${new Date(conn.last_synced).toLocaleTimeString()}`
                          : 'Never synced'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ borderColor: '#1E293B', color: '#34D399', background: 'transparent', cursor: 'pointer' }}
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Sync'}
                      </button>
                      {confirmDisconnect === conn.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]" style={{ color: '#F87171' }}>Sure?</span>
                          <button onClick={() => handleDisconnect(conn.id)}
                            className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                            style={{ borderColor: '#F8717133', color: '#F87171', background: 'transparent', cursor: 'pointer' }}>Yes</button>
                          <button onClick={() => setConfirmDisconnect(null)}
                            className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                            style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}>No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDisconnect(conn.id)}
                          className="border-none bg-transparent px-1.5 py-0.5 text-xs"
                          style={{ color: '#64748B', cursor: 'pointer' }}
                        >
                          &#x2715;
                        </button>
                      )}
                    </div>
                  </div>
                  {syncResult?.id === conn.id && (
                    <div className="mt-2 rounded-md px-3 py-2 text-xs"
                      style={{
                        background: syncResult.message.includes('Imported') ? '#0D3B2E' : '#1E293B',
                        color: syncResult.message.includes('Imported') ? '#34D399' : '#94A3B8',
                      }}>
                      {syncResult.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[10px]" style={{ color: '#334155' }}>
            Transactions are automatically categorized by AI on sync. Duplicates are skipped.
          </p>
        </div>

        {/* Plaid Link (invisible until triggered) */}
        {linkToken && (
          <PlaidLinkButton linkToken={linkToken} onSuccess={handlePlaidSuccess} onExit={() => setLinkToken(null)} />
        )}

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

// Separate component because usePlaidLink needs the token at render time
function PlaidLinkButton({
  linkToken,
  onSuccess,
  onExit,
}: {
  linkToken: string;
  onSuccess: (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      onSuccess(public_token, metadata);
    },
    onExit: () => {
      onExit();
    },
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}
