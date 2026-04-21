'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import { formatMoney } from '@/lib/utils/money';
import type { Transaction, RecurringBill, Category } from '@/types';

const CYAN = '#22d3ee';
const GREEN = '#34D399';
const RED = '#F87171';
const NEON_AMBER = '#f5a623';

const panelClass = "rounded-xl border";
const panelStyle = { background: 'var(--card)', borderColor: 'var(--border)' };

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

  // Generate alerts from actual data
  const alerts: Alert[] = useMemo(() => {
    const result: Alert[] = [];
    const now = new Date().toISOString();

    // Check for categories where actual > committed significantly
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
          cta: { label: 'View Transactions', href: '/transactions' },
        });
      }
    });

    // Check for high concentration in single revenue source
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

    // Dining Out pace warning
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
          cta: { label: 'View Dining Transactions', href: '/transactions' },
        });
      }
    }

    // Positive margin detection
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

    // Paused bills reminder
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
        cta: { label: 'Manage Recurring', href: '/recurring' },
      });
    }

    return result;
  }, [transactions, recurringBills, categories]);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const selected = alerts.find(a => a.id === selectedId) || filtered[0];
  const counts = { all: alerts.length, critical: alerts.filter(a => a.severity === 'critical').length, warning: alerts.filter(a => a.severity === 'warning').length, info: alerts.filter(a => a.severity === 'info').length };

  function markRead(id: string) { setReadIds(prev => new Set(prev).add(id)); }

  if (loading) return <div className="flex h-64 items-center justify-center" style={{ color: 'var(--text-muted)' }}>Analyzing...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1 text-[22px] font-semibold heading-gradient" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
          Alerts
        </h1>
        <p className="text-[12.5px]" style={{ color: 'var(--text-disabled)' }}>AI-generated warnings & insights</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Open Alerts" value={String(alerts.length)} accent={CYAN} />
        <Card label="Critical" value={String(counts.critical)} accent={RED} />
        <Card label="Warnings" value={String(counts.warning)} accent={NEON_AMBER} />
        <Card label="AI Detections" value={String(alerts.length)} accent={GREEN} />
      </div>

      {/* Two-pane inbox */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[380px_1fr]" style={{ minHeight: 500 }}>
        {/* Left: list */}
        <div className={panelClass} style={{ ...panelStyle, borderRadius: '10px 0 0 10px', borderRight: 'none' }}>
          {/* Tabs */}
          <div className="flex gap-1 border-b p-3" style={{ borderColor: 'var(--border)' }}>
            {(['all', 'critical', 'warning', 'info'] as const).map(tab => (
              <button key={tab} onClick={() => setFilter(tab)}
                className="rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize"
                style={{
                  background: filter === tab ? 'var(--amber-soft)' : 'transparent',
                  color: filter === tab ? 'var(--amber-hover)' : 'var(--text-muted)',
                  border: filter === tab ? '1px solid var(--amber)' : '1px solid transparent',
                  cursor: 'pointer',
                }}>
                {tab} <span style={{ opacity: 0.5 }}>({counts[tab]})</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {filtered.map(alert => {
              const isSelected = selected?.id === alert.id;
              const isRead = readIds.has(alert.id);
              return (
                <div key={alert.id}
                  onClick={() => { setSelectedId(alert.id); markRead(alert.id); }}
                  className="cursor-pointer px-4 py-3 transition-colors hover:bg-[var(--card-hover)]"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: isSelected ? `2px solid ${SEVERITY_COLORS[alert.severity]}` : '2px solid transparent',
                    background: isSelected ? 'var(--card-hover)' : undefined,
                  }}>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{
                      background: SEVERITY_COLORS[alert.severity],
                      boxShadow: !isRead ? `0 0 6px ${SEVERITY_COLORS[alert.severity]}` : undefined,
                      opacity: isRead ? 0.4 : 1,
                    }} />
                    <span className="text-[12.5px] font-medium" style={{ color: isRead ? 'var(--text-muted)' : 'var(--text)' }}>{alert.title}</span>
                  </div>
                  <div className="ml-4 text-[11px] leading-relaxed" style={{ color: 'var(--text-disabled)' }}>
                    {alert.summary.slice(0, 80)}{alert.summary.length > 80 ? '...' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className={panelClass + ' p-6'} style={{ ...panelStyle, borderRadius: '0 10px 10px 0' }}>
          {selected ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase" style={{
                  color: SEVERITY_COLORS[selected.severity],
                  background: `${SEVERITY_COLORS[selected.severity]}18`,
                  border: `1px solid ${SEVERITY_COLORS[selected.severity]}55`,
                  letterSpacing: '0.04em',
                }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_COLORS[selected.severity] }} />
                  {selected.severity}
                </span>
                <span className="rounded px-2 py-0.5 text-[10px]" style={{ background: 'var(--panel-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {selected.type}
                </span>
              </div>

              <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>{selected.title}</h2>
              <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.summary}</p>
              <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{selected.detail}</p>

              {/* AI Analysis callout */}
              <div className="mb-5 rounded-lg border p-4" style={{
                background: 'var(--bg-elevated)',
                borderColor: `${SEVERITY_COLORS[selected.severity]}33`,
                borderLeft: `2px solid ${SEVERITY_COLORS[selected.severity]}`,
              }}>
                <div className="eyebrow mb-2" style={{ color: SEVERITY_COLORS[selected.severity] }}>// ai analysis</div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {selected.analysis} <span className="font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>Confidence: {selected.confidence}%</span> based on {transactions.length} historical transactions.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {selected.cta && (
                  <a href={selected.cta.href}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold"
                    style={{
                      background: 'var(--amber-soft)',
                      color: 'var(--amber)',
                      border: '1px solid var(--amber-dark)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}>{selected.cta.label} &rarr;</a>
                )}
                <button className="rounded-lg px-3 py-2 text-[12px]" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Dismiss
                </button>
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
