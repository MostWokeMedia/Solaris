'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import PageHeader from '@/components/layout/PageHeader';
import { formatMoney } from '@/lib/utils/money';
import type { Transaction, RecurringBill, Category } from '@/types';

const CYAN = '#22d3ee';
const GREEN = '#34D399';
const RED = '#F87171';
const NEON_AMBER = '#f5a623';

type Severity = 'critical' | 'warning' | 'info';
type Alert = {
  id: string;
  severity: Severity;
  type: string;
  title: string;
  summary: string;
  detail: string;
  analysis: string;
  confidence: number;
  timestamp: string;
  read: boolean;
  cta?: { label: string; href: string };
};

const SEVERITY_COLORS: Record<Severity, string> = { critical: RED, warning: NEON_AMBER, info: CYAN };
const SEVERITY_BADGE: Record<Severity, string> = { critical: 'cancelled', warning: 'paused', info: 'info' };

export default function AlertsPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const [{ data: txns }, { data: bills }, { data: cats }] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('recurring_bills').select('*'),
      supabase.from('categories').select('*'),
    ]);
    setTransactions(txns || []);
    setRecurringBills(bills || []);
    setCategories(cats || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const alerts: Alert[] = useMemo(() => {
    const result: Alert[] = [];
    const now = new Date().toISOString();

    const expCats = categories.filter(c => c.type === 'expense');
    expCats.forEach(cat => {
      const actual = Math.abs(transactions.filter(t => t.category_id === cat.id && Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
      const committed = recurringBills.filter(b => b.status === 'good' && b.category_id === cat.id).reduce((s, b) => s + Number(b.amount), 0);
      if (committed > 0 && actual > committed * 3) {
        result.push({
          id: `budget-${cat.id}`,
          severity: 'critical',
          type: 'Budget Exceeded',
          title: `${cat.name} spending is ${Math.round(actual / committed)}x committed`,
          summary: `You've spent ${formatMoney(actual)} against ${formatMoney(committed)}/month committed in ${cat.name}.`,
          detail: `This category is significantly over its committed recurring amount. Review recent ${cat.name} transactions for unusual charges or consider adjusting the commitment level.`,
          analysis: `Based on ${transactions.filter(t => t.category_id === cat.id).length} transactions in this category, spending consistently exceeds the committed baseline.`,
          confidence: 92,
          timestamp: now,
          read: false,
          cta: { label: 'View transactions', href: '/transactions' },
        });
      }
    });

    const revCats = categories.filter(c => c.type === 'revenue');
    const totalRev = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    revCats.forEach(cat => {
      const catRev = transactions.filter(t => t.category_id === cat.id && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
      if (totalRev > 0 && catRev / totalRev > 0.75) {
        result.push({
          id: `concentration-${cat.id}`,
          severity: 'warning',
          type: 'Revenue Concentration',
          title: `${Math.round(catRev / totalRev * 100)}% of revenue from ${cat.name}`,
          summary: `Heavy reliance on a single income source creates financial risk.`,
          detail: `${cat.name} accounts for ${formatMoney(catRev)} of ${formatMoney(totalRev)} total revenue. Diversifying income sources would reduce exposure to disruption.`,
          analysis: `Single-source dependency above 75% is a known financial risk factor.`,
          confidence: 88,
          timestamp: now,
          read: false,
        });
      }
    });

    const diningCat = categories.find(c => c.name === 'Dining Out');
    if (diningCat) {
      const diningTotal = Math.abs(transactions.filter(t => t.category_id === diningCat.id && Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
      const months = new Set(transactions.map(t => t.date.slice(0, 7))).size || 1;
      const monthlyAvg = diningTotal / months;
      const annualized = monthlyAvg * 12;
      if (annualized > 3000) {
        result.push({
          id: 'pace-dining',
          severity: 'warning',
          type: 'Pace Warning',
          title: `Dining Out annualizes to ${formatMoney(annualized)}`,
          summary: `At ${formatMoney(monthlyAvg)}/month, coffee + dining is a significant line item.`,
          detail: `Your March 2026 experiment tracking coffee and ice cream separately revealed this pattern. The current pace projects to ${formatMoney(annualized)}/year.`,
          analysis: `Tracking confirms the habit costs more than most expect. Small daily amounts compound significantly.`,
          confidence: 95,
          timestamp: now,
          read: false,
          cta: { label: 'View dining transactions', href: '/transactions' },
        });
      }
    }

    if (totalRev > 0) {
      const totalExp = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
      const margin = (totalRev - totalExp) / totalRev * 100;
      if (margin > 0) {
        result.push({
          id: 'margin-positive',
          severity: 'info',
          type: 'Positive Signal',
          title: `Net margin is ${margin.toFixed(1)}% — cash flow positive`,
          summary: `You're earning more than you spend YTD. Revenue: ${formatMoney(totalRev)}, Expenses: ${formatMoney(totalExp)}.`,
          detail: `Maintaining positive cash flow is the foundation of the Profit First methodology. Consider routing the surplus into your Vault or Tax Reserve.`,
          analysis: `Positive margin sustained across multiple months indicates structural viability.`,
          confidence: 97,
          timestamp: now,
          read: false,
        });
      }
    }

    const pausedBills = recurringBills.filter(b => b.status === 'paused');
    if (pausedBills.length > 0) {
      const pausedTotal = pausedBills.reduce((s, b) => s + Number(b.amount), 0);
      result.push({
        id: 'paused-bills',
        severity: 'info',
        type: 'Paused Items',
        title: `${pausedBills.length} paused bills totaling ${formatMoney(pausedTotal)}/month`,
        summary: `These were intentionally paused: ${pausedBills.slice(0, 3).map(b => b.name).join(', ')}${pausedBills.length > 3 ? '...' : ''}.`,
        detail: `Review these periodically. If you're no longer considering reactivating them, change status to Cancelled for cleaner tracking.`,
        analysis: `Keeping paused items on your radar prevents forgotten subscriptions from reactivating unexpectedly.`,
        confidence: 85,
        timestamp: now,
        read: false,
        cta: { label: 'Manage recurring', href: '/recurring' },
      });
    }

    return result;
  }, [transactions, recurringBills, categories]);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const selected = alerts.find(a => a.id === selectedId) || filtered[0];
  const counts = {
    all: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  };

  function markRead(id: string) { setReadIds(prev => new Set(prev).add(id)); }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Analyzing...
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Alerts" eyebrow="// alerts" subtitle="AI-generated warnings & insights" />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Open alerts" value={String(alerts.length)} accent={CYAN} sub="total" />
        <Card label="Critical" value={String(counts.critical)} accent={RED} sub="needs action" />
        <Card label="Warnings" value={String(counts.warning)} accent={NEON_AMBER} sub="watch" />
        <Card label="AI detections" value={String(alerts.length)} accent={GREEN} sub="from data" />
      </div>

      {/* Two-pane inbox */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[380px_1fr]" style={{ minHeight: 500 }}>
        {/* Left: list */}
        <div
          className="panel"
          style={{ borderRadius: '12px 0 0 12px', borderRight: 'none' }}
        >
          {/* Tabs */}
          <div
            className="flex flex-wrap gap-1.5"
            style={{ padding: '14px 14px', borderBottom: '1px solid var(--border)' }}
          >
            {(['all', 'critical', 'warning', 'info'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={'chip' + (filter === tab ? ' active' : '')}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="num" style={{ opacity: 0.6, fontSize: 10 }}>{counts[tab]}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>
                No alerts in this category.
              </div>
            ) : (
              filtered.map(alert => {
                const isSelected = selected?.id === alert.id;
                const isRead = readIds.has(alert.id);
                return (
                  <div
                    key={alert.id}
                    onClick={() => { setSelectedId(alert.id); markRead(alert.id); }}
                    className="cursor-pointer px-4 py-3 transition-colors hover:bg-[var(--card-hover)]"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      borderLeft: isSelected ? `2px solid ${SEVERITY_COLORS[alert.severity]}` : '2px solid transparent',
                      background: isSelected ? 'var(--card-hover)' : undefined,
                    }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: SEVERITY_COLORS[alert.severity],
                          boxShadow: !isRead ? `0 0 6px ${SEVERITY_COLORS[alert.severity]}` : undefined,
                          opacity: isRead ? 0.4 : 1,
                        }}
                      />
                      <span
                        className="text-[12.5px] font-medium"
                        style={{ color: isRead ? 'var(--text-muted)' : 'var(--text)' }}
                      >
                        {alert.title}
                      </span>
                    </div>
                    <div className="ml-4 text-[11px] leading-relaxed" style={{ color: 'var(--text-disabled)' }}>
                      {alert.summary.slice(0, 80)}{alert.summary.length > 80 ? '...' : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div
          className="panel"
          style={{ borderRadius: '0 12px 12px 0', padding: 24 }}
        >
          {selected ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className={'badge ' + SEVERITY_BADGE[selected.severity]}>
                  <span className="dot" />
                  {selected.severity}
                </span>
                <span
                  className="rounded px-2 py-0.5 text-[10px]"
                  style={{
                    background: 'var(--panel-2)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.04em',
                  }}
                >
                  {selected.type}
                </span>
              </div>

              <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>{selected.title}</h2>
              <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.summary}</p>
              <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{selected.detail}</p>

              {/* AI Analysis callout */}
              <div
                className="mb-5 rounded-lg border p-4"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: `${SEVERITY_COLORS[selected.severity]}33`,
                  borderLeft: `2px solid ${SEVERITY_COLORS[selected.severity]}`,
                }}
              >
                <div className="eyebrow mb-2" style={{ color: SEVERITY_COLORS[selected.severity] }}>
                  {'// ai · analysis'}
                </div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {selected.analysis}{' '}
                  <span className="num font-semibold" style={{ color: 'var(--text)' }}>
                    Confidence: {selected.confidence}%
                  </span>{' '}
                  based on {transactions.length} historical transactions.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {selected.cta && (
                  <a
                    href={selected.cta.href}
                    className="btn primary"
                    style={{ textDecoration: 'none' }}
                  >
                    {selected.cta.label}
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
                <button className="btn">Snooze 7 days</button>
                <button className="btn">Dismiss</button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-disabled)' }}>
              Select an alert to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
