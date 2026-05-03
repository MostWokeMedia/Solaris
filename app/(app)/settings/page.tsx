'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import CategoryManager from '@/components/shared/CategoryManager';
import type { Category } from '@/types';

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

const CYAN = '#22d3ee';
const GREEN = '#34D399';
const NEON_AMBER = '#f5a623';
const MAGENTA = '#e879b8';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<{ category_id: string | null }[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ txnCount: 0, billCount: 0, acctCount: 0 });

  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [tellerReady, setTellerReady] = useState(false);
  const [tellerError, setTellerError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const loadData = useCallback(async () => {
    const [
      { data: catData },
      { data: txnData },
      { data: { user } },
      { count: billCount },
      { count: acctCount },
      { data: connData },
    ] = await Promise.all([
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
    setUserCreatedAt(user?.created_at || null);
    setStats({ txnCount: txnData?.length || 0, billCount: billCount || 0, acctCount: acctCount || 0 });
    setConnections(connData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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

  const revCats = categories.filter((c) => c.type === 'revenue');
  const expCats = categories.filter((c) => c.type === 'expense');
  const memberSince = userCreatedAt ? new Date(userCreatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="eyebrow">{'// settings · account & data'}</div>
        <h1
          className="mt-1 text-[22px] font-semibold heading-gradient"
          style={{ letterSpacing: '-0.02em' }}
        >
          Settings
        </h1>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Categories, bank connections, and account info
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Transactions" value={String(stats.txnCount)} accent={CYAN} sub="tracked" />
        <Card label="Categories" value={String(categories.length)} accent={GREEN} sub={`${revCats.length} rev / ${expCats.length} exp`} />
        <Card label="Recurring bills" value={String(stats.billCount)} accent={NEON_AMBER} sub="committed" />
        <Card label="Allocation accts" value={String(stats.acctCount)} accent={MAGENTA} sub="profit first" />
      </div>

      {/* Categories panel */}
      <div className="panel">
        <div className="panel-hdr">
          <div>
            <div className="eyebrow">{'// categories · revenue & expense'}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Click a category to rename · renames cascade to all linked transactions
            </p>
          </div>
          <button className="btn primary" onClick={() => setShowCatMgr(true)}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={3} y={3} width={7} height={7} /><rect x={14} y={3} width={7} height={7} />
              <rect x={3} y={14} width={7} height={7} /><rect x={14} y={14} width={7} height={7} />
            </svg>
            Manage
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {/* Revenue */}
          <div className="mb-4">
            <div className="eyebrow mb-2" style={{ color: 'var(--green)' }}>
              Revenue ({revCats.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {revCats.length === 0 && (
                <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
              )}
              {revCats.map((cat) => (
                <span key={cat.id} className="cat-pill">
                  <span className="dot" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                  {cat.name}
                  <span className="num" style={{ color: 'var(--text-disabled)', fontSize: 10, marginLeft: 4 }}>
                    {txnCounts[cat.id] || 0}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Expense */}
          <div>
            <div className="eyebrow mb-2" style={{ color: 'var(--red)' }}>
              Expense ({expCats.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {expCats.length === 0 && (
                <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
              )}
              {expCats.map((cat) => (
                <span key={cat.id} className="cat-pill">
                  <span className="dot" style={{ background: 'var(--red)' }} />
                  {cat.name}
                  <span className="num" style={{ color: 'var(--text-disabled)', fontSize: 10, marginLeft: 4 }}>
                    {txnCounts[cat.id] || 0}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bank Connections */}
      <div className="panel mt-4">
        <div className="panel-hdr">
          <div>
            <div className="eyebrow">{'// bank · connections'}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Sync transactions automatically via Teller &middot; AI categorizes on import
            </p>
          </div>
          <button className="btn primary" onClick={handleConnectBank} disabled={!tellerReady}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            {tellerReady ? 'Connect bank' : 'Loading...'}
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {tellerError && (
            <div
              className="mb-3 rounded-lg border px-4 py-3 text-xs"
              style={{
                background: 'oklch(0.70 0.22 25 / 0.08)',
                borderColor: 'oklch(0.70 0.22 25 / 0.35)',
                color: 'var(--red)',
              }}
            >
              {tellerError}
            </div>
          )}

          {connections.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>
              No banks connected. Click &ldquo;Connect bank&rdquo; to link your accounts via Teller, or use CSV import on the Transactions page.
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="rounded-lg border px-4 py-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel-2)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {conn.institution_name}
                      </div>
                      <div className="num mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {conn.last_synced
                          ? `Last synced: ${new Date(conn.last_synced).toLocaleString()}`
                          : 'Never synced'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn green sm"
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Sync'}
                      </button>
                      {confirmDisconnect === conn.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]" style={{ color: 'var(--red)' }}>Sure?</span>
                          <button className="btn red sm" onClick={() => handleDisconnect(conn.id)}>Yes</button>
                          <button className="btn sm" onClick={() => setConfirmDisconnect(null)}>No</button>
                        </div>
                      ) : (
                        <button
                          className="btn icon sm"
                          onClick={() => setConfirmDisconnect(conn.id)}
                          title="Disconnect"
                        >
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {syncResult?.id === conn.id && (
                    <div
                      className="mt-2 rounded-md px-3 py-2 text-xs"
                      style={{
                        background: syncResult.message.includes('Imported')
                          ? 'oklch(0.82 0.18 155 / 0.08)'
                          : 'var(--bg-elevated)',
                        color: syncResult.message.includes('Imported') ? 'var(--green)' : 'var(--text-secondary)',
                      }}
                    >
                      {syncResult.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="panel mt-4">
        <div className="panel-hdr">
          <div>
            <div className="eyebrow">{'// account · info'}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Authentication & subscription
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" style={{ padding: 18 }}>
          <div>
            <div className="eyebrow mb-1">Email</div>
            <div className="num text-[13px]" style={{ color: 'var(--text)' }}>{userEmail || '—'}</div>
          </div>
          <div>
            <div className="eyebrow mb-1">Plan</div>
            <div className="text-[13px]" style={{ color: 'var(--text)' }}>
              Single-user{' '}
              <span className="num" style={{ color: 'var(--text-disabled)', fontSize: 11 }}>· personal</span>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">Member since</div>
            <div className="num text-[13px]" style={{ color: 'var(--text)' }}>{memberSince}</div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="panel mt-4"
        style={{ borderColor: 'oklch(0.70 0.22 25 / 0.3)' }}
      >
        <div className="panel-hdr">
          <div>
            <div className="eyebrow" style={{ color: 'var(--red)' }}>{'// danger · zone'}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Irreversible actions
            </p>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>Sign out of Solaris</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                You&apos;ll need to log in again to access your data.
              </div>
            </div>
            {confirmSignOut ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--red)' }}>Sure?</span>
                <button className="btn red sm" onClick={handleSignOut}>Yes, sign out</button>
                <button className="btn sm" onClick={() => setConfirmSignOut(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn red" onClick={() => setConfirmSignOut(true)}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      <div className="panel mt-4">
        <div style={{ padding: 18 }}>
          <div className="eyebrow mb-2">{'// about · solaris'}</div>
          <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Personal financial command center &middot; Profit First methodology, recurring bills, and P&amp;L tracking.{' '}
            <span style={{ color: 'var(--text-disabled)' }}>
              Built with Next.js, Supabase, Tailwind, Recharts, and Claude AI.
            </span>
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

      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={() => setTellerReady(true)}
        strategy="afterInteractive"
      />
    </div>
  );
}
