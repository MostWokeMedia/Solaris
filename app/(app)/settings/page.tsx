'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import PageHeader from '@/components/layout/PageHeader';
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

const BANK_SLOTS = ['Wells Fargo', 'Chase', 'Discover', 'Bank of America', 'Mastercard'];
const TECH_STACK = ['Next.js', 'Supabase', 'Tailwind', 'Recharts', 'Claude AI'];

export default function SettingsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<{ category_id: string | null }[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ txnCount: 0, billCount: 0, acctCount: 0 });

  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [tellerReady, setTellerReady] = useState(false);
  const [tellerError, setTellerError] = useState('');

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
  const connectedNames = new Set(connections.map((c) => c.institution_name));

  return (
    <div>
      <PageHeader title="Settings" eyebrow="// settings" subtitle="Manage categories, view account info" />

      {/* 2-column grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* === Account === */}
        <div className="panel">
          <div className="panel-hdr">
            <div className="eyebrow">Account</div>
          </div>
          <div style={{ padding: 18 }}>
            <div className="eyebrow mb-1">Email</div>
            <div className="num text-[14px]" style={{ color: 'var(--text)', marginBottom: 16 }}>
              {userEmail || '—'}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-lg border text-center"
                style={{ borderColor: 'var(--border)', padding: '14px 8px' }}
              >
                <div
                  className="num text-[22px] font-semibold leading-none"
                  style={{ color: 'var(--cyan)' }}
                >
                  {stats.txnCount}
                </div>
                <div className="eyebrow mt-2">Transactions</div>
              </div>
              <div
                className="rounded-lg border text-center"
                style={{ borderColor: 'var(--border)', padding: '14px 8px' }}
              >
                <div
                  className="num text-[22px] font-semibold leading-none"
                  style={{ color: 'var(--neon-amber)' }}
                >
                  {stats.billCount}
                </div>
                <div className="eyebrow mt-2">Recurring Bills</div>
              </div>
              <div
                className="rounded-lg border text-center"
                style={{ borderColor: 'var(--border)', padding: '14px 8px' }}
              >
                <div
                  className="num text-[22px] font-semibold leading-none"
                  style={{ color: 'var(--green)' }}
                >
                  {stats.acctCount}
                </div>
                <div className="eyebrow mt-2">Allocations</div>
              </div>
            </div>
          </div>
        </div>

        {/* === Categories === */}
        <div className="panel">
          <div className="panel-hdr">
            <div className="eyebrow">Categories</div>
            <button className="btn amber" onClick={() => setShowCatMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Manage
            </button>
          </div>
          <div style={{ padding: 18 }}>
            <div className="mb-4">
              <div className="eyebrow mb-2" style={{ color: 'var(--green)' }}>
                Revenue ({revCats.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {revCats.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
                )}
                {revCats.map((cat) => (
                  <span
                    key={cat.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--green)',
                      background: 'oklch(0.82 0.18 155 / 0.08)',
                      border: '1px solid oklch(0.82 0.18 155 / 0.3)',
                    }}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2" style={{ color: 'var(--red)' }}>
                Expense ({expCats.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {expCats.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>None yet</span>
                )}
                {expCats.map((cat) => (
                  <span
                    key={cat.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--border-strong)',
                    }}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* === Bank Connections === */}
        <div className="panel">
          <div className="panel-hdr">
            <div className="eyebrow">Bank Connections</div>
            {!tellerReady && (
              <span
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                style={{
                  color: 'var(--neon-amber)',
                  background: 'oklch(0.82 0.16 80 / 0.1)',
                  border: '1px solid oklch(0.82 0.16 80 / 0.35)',
                  letterSpacing: '0.04em',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--neon-amber)' }} />
                Loading
              </span>
            )}
          </div>
          <div style={{ padding: 18 }}>
            {tellerError && (
              <div
                className="mb-3 rounded-lg border px-3 py-2 text-xs"
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
              <p className="mb-3 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                No banks connected. Click <span style={{ color: 'var(--cyan)' }}>&ldquo;Connect bank&rdquo;</span>{' '}
                to link your accounts via Teller, or use CSV Import in Transactions.
              </p>
            ) : (
              <div className="mb-3 space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel-2)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                          {conn.institution_name}
                        </div>
                        <div className="num text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {conn.last_synced
                            ? `Last: ${new Date(conn.last_synced).toLocaleString()}`
                            : 'Never synced'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="btn green sm"
                          onClick={() => handleSync(conn.id)}
                          disabled={syncing === conn.id}
                        >
                          {syncing === conn.id ? '...' : 'Sync'}
                        </button>
                        {confirmDisconnect === conn.id ? (
                          <>
                            <button className="btn red sm" onClick={() => handleDisconnect(conn.id)}>Yes</button>
                            <button className="btn sm" onClick={() => setConfirmDisconnect(null)}>No</button>
                          </>
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
                        className="mt-2 rounded-md px-2 py-1.5 text-[11px]"
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

            <p className="mb-3 text-[11px]" style={{ color: 'var(--text-disabled)' }}>
              Transactions are automatically categorized by AI on sync. Money envelopes.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              <button className="btn primary" onClick={handleConnectBank} disabled={!tellerReady}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                Connect bank
              </button>
              <button
                className="btn"
                onClick={() => (window.location.href = '/transactions')}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Import CSV
              </button>
            </div>

            {/* Bank slot pills */}
            <div className="grid grid-cols-2 gap-2">
              {BANK_SLOTS.map((bank) => {
                const isConnected = connectedNames.has(bank);
                return (
                  <div
                    key={bank}
                    className="flex items-center gap-2 rounded-md px-3 py-2"
                    style={{
                      background: 'var(--panel-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isConnected ? 'var(--green)' : 'var(--text-ghost)',
                        boxShadow: isConnected ? '0 0 6px var(--green)' : undefined,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="text-[12px]"
                      style={{ color: isConnected ? 'var(--text)' : 'var(--text-muted)' }}
                    >
                      {bank}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === About Solaris === */}
        <div className="panel">
          <div className="panel-hdr">
            <div className="eyebrow">About Solaris</div>
            <span
              className="num"
              style={{
                color: 'var(--text-disabled)',
                fontSize: 11,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              v2.0.0
            </span>
          </div>
          <div style={{ padding: 18 }}>
            <div className="text-[13.5px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Personal Financial Command Center
            </div>
            <p className="mb-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Profit First methodology &middot; Recurring Bills &middot; P&amp;L Tracking
            </p>
            <p className="mb-4 text-[12px]" style={{ color: 'var(--text-disabled)' }}>
              Built with Next.js, Supabase, Tailwind, Recharts, and Claude AI.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TECH_STACK.map((t) => (
                <span
                  key={t}
                  className="num"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--cyan)',
                    background: 'oklch(0.85 0.15 200 / 0.08)',
                    border: '1px solid oklch(0.85 0.15 200 / 0.3)',
                  }}
                >
                  {t}
                </span>
              ))}
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

      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={() => setTellerReady(true)}
        strategy="afterInteractive"
      />
    </div>
  );
}
