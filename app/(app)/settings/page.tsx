'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import CategoryManager from '@/components/shared/CategoryManager';
import type { Category } from '@/types';

// Teller Connect types (loaded via CDN script tag)
type TellerEnrollment = {
  accessToken: string;
  enrollment: { id: string; institution: { name: string } };
  user: { id: string };
};

type TellerConnect = {
  setup: (options: {
    applicationId: string;
    environment?: 'sandbox' | 'development' | 'production';
    onSuccess: (enrollment: TellerEnrollment) => void;
    onExit?: () => void;
    onFailure?: (failure: unknown) => void;
  }) => { open: () => void };
};

declare global {
  interface Window { TellerConnect?: TellerConnect }
}

type BankConnection = {
  id: string;
  institution_name: string;
  last_synced: string | null;
  created_at: string;
};

const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors";
const inputColors = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' };

export default function SettingsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<{ category_id: string | null }[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ txnCount: 0, billCount: 0, acctCount: 0 });

  // Bank connections (Teller)
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [tellerReady, setTellerReady] = useState(false);

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

  // Teller Connect
  const [tellerError, setTellerError] = useState('');

  function handleConnectBank() {
    setTellerError('');
    const appId = process.env.NEXT_PUBLIC_TELLER_APP_ID;
    if (!appId) {
      setTellerError('Teller App ID not configured. Add NEXT_PUBLIC_TELLER_APP_ID to environment variables.');
      return;
    }
    if (!window.TellerConnect) {
      setTellerError('Teller Connect is still loading. Try again in a moment.');
      return;
    }

    const tellerConnect = window.TellerConnect.setup({
      applicationId: appId,
      environment: (process.env.NEXT_PUBLIC_TELLER_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
      onSuccess: async (enrollment) => {
        try {
          const res = await fetch('/api/teller/enrollment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: enrollment.accessToken,
              enrollmentId: enrollment.enrollment.id,
              institutionName: enrollment.enrollment.institution.name,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            setTellerError(data.error || 'Failed to save bank connection.');
          } else {
            loadData();
          }
        } catch {
          setTellerError('Failed to save bank connection.');
        }
      },
      onFailure: (failure) => {
        console.error('Teller Connect failure:', failure);
        setTellerError('Bank connection failed. Please try again.');
      },
    });
    tellerConnect.open();
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId);
    setSyncResult(null);
    try {
      const res = await fetch('/api/teller/sync', {
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
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="heading-gradient">Settings</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage categories, view account info</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>
            Account
          </h3>
          <div className="mb-3">
            <div className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Email</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--text)' }}>{userEmail}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--amber)' }}>{stats.txnCount}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Transactions</div>
            </div>
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--amber-warn)' }}>{stats.billCount}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Recurring Bills</div>
            </div>
            <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--green)' }}>{stats.acctCount}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Allocation Accts</div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>
              Categories
            </h3>
            <button
              onClick={() => setShowCatMgr(true)}
              className="rounded-lg border-none px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'transparent', border: '1px solid var(--amber)', color: 'var(--amber)', cursor: 'pointer' }}
            >
              Manage
            </button>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase" style={{ color: 'var(--green)', letterSpacing: '0.5px' }}>
              Revenue ({categories.filter((c) => c.type === 'revenue').length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.type === 'revenue').map((cat) => (
                <span key={cat.id} className="rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  {cat.name}
                </span>
              ))}
              {categories.filter((c) => c.type === 'revenue').length === 0 && (
                <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase" style={{ color: 'var(--red)', letterSpacing: '0.5px' }}>
              Expense ({categories.filter((c) => c.type === 'expense').length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.type === 'expense').map((cat) => (
                <span key={cat.id} className="rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  {cat.name}
                </span>
              ))}
              {categories.filter((c) => c.type === 'expense').length === 0 && (
                <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Bank Connections */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>
              Bank Connections
            </h3>
            <button
              onClick={handleConnectBank}
              disabled={!tellerReady}
              className="rounded-lg border-none px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer' }}
            >
              {tellerReady ? '+ Connect Bank' : 'Loading...'}
            </button>
          </div>

          {tellerError && (
            <div className="mb-3 rounded-lg border px-4 py-3 text-xs"
              style={{ background: '#2E0F17', borderColor: '#F8717133', color: 'var(--red)' }}>
              {tellerError}
            </div>
          )}

          {connections.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-disabled)' }}>
              No banks connected. Click &ldquo;Connect Bank&rdquo; to link your accounts via Teller, or use CSV import in the Transactions page.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{conn.institution_name}</div>
                      <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
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
                        style={{ borderColor: 'var(--border)', color: 'var(--green)', background: 'transparent', cursor: 'pointer' }}
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Sync'}
                      </button>
                      {confirmDisconnect === conn.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]" style={{ color: 'var(--red)' }}>Sure?</span>
                          <button onClick={() => handleDisconnect(conn.id)}
                            className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                            style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}>Yes</button>
                          <button onClick={() => setConfirmDisconnect(null)}
                            className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDisconnect(conn.id)}
                          className="border-none bg-transparent px-1.5 py-0.5 text-xs"
                          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
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
                        color: syncResult.message.includes('Imported') ? 'var(--green)' : 'var(--text-secondary)',
                      }}>
                      {syncResult.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
            Transactions are automatically categorized by AI on sync. Duplicates are skipped.
          </p>
        </div>

        {/* About */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>
            About Solaris
          </h3>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div>Personal Financial Command Center</div>
            <div>Profit First methodology &middot; Recurring Bills &middot; P&L Tracking</div>
            <div className="pt-1" style={{ color: 'var(--text-disabled)' }}>
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

      {/* Teller Connect CDN script */}
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={() => setTellerReady(true)}
        strategy="afterInteractive"
      />
    </div>
  );
}
