'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import PageHeader from '@/components/layout/PageHeader';
import { DashboardSkeleton } from '@/components/shared/Skeleton';
import { formatMoney, formatMoneyShort } from '@/lib/utils/money';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { Category, Transaction, RecurringBill, AllocationAccount, AllocationPeriod } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Semantic chart colors — resolved hex (Recharts doesn't support CSS vars)
const GREEN = '#34D399';
const RED = '#F87171';
const CYAN = '#22d3ee';
const NEON_AMBER = '#f5a623';
const AMBER = CYAN;
const AMBER_WARN = NEON_AMBER;

const tooltipStyle = {
  background: '#0e1117', border: '1px solid #2a2f40', borderRadius: 8, fontSize: 12, color: '#f3f4f8',
};

const panelClass = "rounded-xl border p-5";
const panelStyle = { background: 'var(--card)', borderColor: 'var(--border)' };
const sectionHeadingClass = "mb-4 text-sm font-semibold";
const sectionHeadingStyle = { fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' };

export default function DashboardPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<(Transaction & { category?: Category })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringBills, setRecurringBills] = useState<(RecurringBill & { category?: Category })[]>([]);
  const [allocationAccounts, setAllocationAccounts] = useState<AllocationAccount[]>([]);
  const [allocationPeriods, setAllocationPeriods] = useState<AllocationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetMonth, setBudgetMonth] = useState<number | 'ytd'>('ytd');

  const loadData = useCallback(async () => {
    const [{ data: txns }, { data: cats }, { data: bills }, { data: accts }, { data: periods }] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(*)').order('date', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('recurring_bills').select('*, category:categories(*)'),
      supabase.from('allocation_accounts').select('*').order('sort_order'),
      supabase.from('allocation_periods').select('*'),
    ]);
    setTransactions(txns || []);
    setCategories(cats || []);
    setRecurringBills(bills || []);
    setAllocationAccounts(accts || []);
    setAllocationPeriods(periods || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const revCatIds = useMemo(() => new Set(categories.filter((c) => c.type === 'revenue').map((c) => c.id)), [categories]);

  // === Summary Stats ===
  const totalRev = transactions.filter((t) => t.category_id && revCatIds.has(t.category_id)).reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = transactions.filter((t) => !t.category_id || !revCatIds.has(t.category_id)).filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const netIncome = totalRev + totalExp;
  const margin = totalRev ? ((netIncome / totalRev) * 100).toFixed(1) : '0';

  const totalAllocated = allocationPeriods.reduce((s, p) => s + Number(p.starting_amount), 0);
  const goodBillsTotal = recurringBills.filter((b) => b.status === 'good').reduce((s, b) => s + Number(b.amount), 0);

  // Vault & Tax from allocation computation
  const vaultTax = useMemo(() => {
    let vault = 0, tax = 0;
    const periodMap = new Map(allocationPeriods.map((p) => [p.period_key, p]));
    const MN_PERIODS: { key: string; qEnd: boolean }[] = [];
    for (let m = 0; m < 12; m++) {
      MN_PERIODS.push({ key: m + '-10', qEnd: false });
      MN_PERIODS.push({ key: m + '-25', qEnd: m === 2 || m === 5 || m === 8 || m === 11 });
    }
    MN_PERIODS.forEach((p) => {
      const period = periodMap.get(p.key);
      const startAmt = Number(period?.starting_amount || 0);
      allocationAccounts.forEach((a) => {
        const val = Math.round(startAmt * (Number(a.percentage) / 100) * 100) / 100;
        if (a.tag === 'profit') vault += val;
        if (a.tag === 'tax') tax += val;
      });
      vault -= Number(period?.vault_draw || 0);
    });
    return { vault: Math.round(vault * 100) / 100, tax: Math.round(tax * 100) / 100 };
  }, [allocationAccounts, allocationPeriods]);

  // === Monthly Data for Charts ===
  const monthlyData = useMemo(() => {
    return MONTHS.map((m, i) => {
      const monthTxns = transactions.filter((t) => parseInt(t.date.split('-')[1]) === i + 1);
      const rev = monthTxns.filter((t) => t.category_id && revCatIds.has(t.category_id)).reduce((s, t) => s + Number(t.amount), 0);
      const exp = monthTxns.filter((t) => !t.category_id || !revCatIds.has(t.category_id)).reduce((s, t) => s + Number(t.amount), 0);
      return {
        month: m,
        revenue: Math.round(rev * 100) / 100,
        expenses: Math.round(Math.abs(exp) * 100) / 100,
        profit: Math.round((rev + exp) * 100) / 100,
      };
    });
  }, [transactions, revCatIds]);

  const activeMonthlyData = monthlyData.filter((d) => d.revenue > 0 || d.expenses > 0);

  // === Budget vs Actual per Category ===
  const budgetVsActual = useMemo(() => {
    const expenseCategories = categories.filter((c) => c.type === 'expense');

    // Filter periods by selected month or use all for YTD
    const filteredPeriods = budgetMonth === 'ytd'
      ? allocationPeriods
      : allocationPeriods.filter((p) => {
          const m = parseInt(p.period_key.split('-')[0]);
          return m === budgetMonth;
        });
    const periodStarting = filteredPeriods.reduce((s, p) => s + Number(p.starting_amount), 0);

    // Filter transactions by month
    const filteredTxns = budgetMonth === 'ytd'
      ? transactions
      : transactions.filter((t) => parseInt(t.date.split('-')[1]) - 1 === budgetMonth);

    // Committed: monthly amount. For YTD multiply by months with data
    const monthsWithData = budgetMonth === 'ytd'
      ? new Set(transactions.map((t) => parseInt(t.date.split('-')[1]))).size || 1
      : 1;

    return expenseCategories.map((cat) => {
      const account = allocationAccounts.find((a) => a.category_id === cat.id);
      const allocated = account ? Math.round(periodStarting * (Number(account.percentage) / 100) * 100) / 100 : 0;

      const monthlyCommitted = recurringBills
        .filter((b) => b.status === 'good' && b.category_id === cat.id)
        .reduce((s, b) => s + Number(b.amount), 0);
      const committed = budgetMonth === 'ytd' ? monthlyCommitted * monthsWithData : monthlyCommitted;

      const actual = Math.abs(
        filteredTxns
          .filter((t) => t.category_id === cat.id && Number(t.amount) < 0)
          .reduce((s, t) => s + Number(t.amount), 0)
      );

      return {
        category: cat.name,
        color: cat.color || '#6B6B72',
        allocated,
        committed,
        actual,
        variance: allocated > 0 ? allocated - actual : committed > 0 ? committed - actual : -actual,
      };
    }).filter((row) => row.allocated > 0 || row.committed > 0 || row.actual > 0)
      .sort((a, b) => b.actual - a.actual);
  }, [categories, allocationAccounts, allocationPeriods, recurringBills, transactions, budgetMonth]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div>
      <PageHeader title="Dashboard" eyebrow="// dashboard" subtitle="Plan vs commitments vs reality" />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card label="Revenue" value={formatMoney(totalRev)} accent={GREEN}
          trend={{ value: margin + '%', positive: Number(margin) > 0 }} sub="YTD 2026" />
        <Card label="Expenses" value={formatMoney(Math.abs(totalExp))} accent={RED}
          sub="YTD 2026" />
        <Card label="Net Income" value={formatMoney(netIncome)} accent={netIncome >= 0 ? CYAN : RED} sub={margin + '% margin'} />
        <Card label="Committed" value={'$' + goodBillsTotal.toLocaleString()} accent={NEON_AMBER}
          sub={recurringBills.filter((b) => b.status === 'good').length + ' active bills'}
          icon={<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
        <Card label="Vault" value={vaultTax.vault > 0 ? formatMoney(vaultTax.vault) : '\u2014'} accent="#a78bfa" sub="Profit reserve" />
        <Card label="Tax Reserve" value={formatMoney(vaultTax.tax)} accent="oklch(0.72 0.22 340)"
          sub="Set aside"
          icon={<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} />
      </div>

      {/* Charts Row — 1.3fr / 1fr */}
      {activeMonthlyData.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          {/* Monthly Rev/Exp twin-bar chart — custom SVG */}
          <div className={panelClass + ' scanlines'} style={panelStyle}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="eyebrow" style={{ color: 'var(--text-disabled)' }}>MONTHLY &middot; REVENUE VS EXPENSES</div>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Twin-bar rhythm</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm" style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rev</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm" style={{ background: RED, boxShadow: `0 0 6px ${RED}` }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Exp</span>
                </div>
              </div>
            </div>

            {/* Custom SVG bars */}
            {(() => {
              const maxVal = Math.max(...activeMonthlyData.map(d => Math.max(d.revenue, d.expenses)), 1);
              const barH = 180;
              return (
                <>
                  <div className="flex items-end justify-around" style={{ height: barH, borderBottom: '1px solid var(--border)', padding: '0 22px 0 22px' }}>
                    {activeMonthlyData.map((d) => {
                      const revPct = (d.revenue / maxVal) * 100;
                      const expPct = (d.expenses / maxVal) * 100;
                      return (
                        <div key={d.month} className="flex items-end gap-1">
                          <div style={{
                            width: 22, height: `${revPct}%`,
                            background: `linear-gradient(180deg, ${GREEN}, oklch(0.82 0.18 155 / 0.3))`,
                            boxShadow: `0 0 8px oklch(0.82 0.18 155 / 0.3)`,
                            borderRadius: '3px 3px 0 0',
                            minHeight: d.revenue > 0 ? 4 : 0,
                          }} />
                          <div style={{
                            width: 22, height: `${expPct}%`,
                            background: `linear-gradient(180deg, ${RED}, oklch(0.70 0.22 25 / 0.3))`,
                            boxShadow: `0 0 8px oklch(0.70 0.22 25 / 0.3)`,
                            borderRadius: '3px 3px 0 0',
                            minHeight: d.expenses > 0 ? 4 : 0,
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-around" style={{ padding: '0 22px' }}>
                    {activeMonthlyData.map((d) => (
                      <div key={d.month} className="text-center">
                        <div className="text-[10px] uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{d.month}</div>
                        <div className="text-[11px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: d.profit >= 0 ? GREEN : RED }}>
                          {d.profit >= 0 ? '+' : ''}{formatMoney(d.profit)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Cash Flow Pulse */}
          <div className={panelClass} style={panelStyle}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="eyebrow" style={{ color: 'var(--amber)' }}>// cash flow &middot; pulse</div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-disabled)' }}>30-day velocity</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase" style={{
                color: 'var(--amber)',
                background: 'var(--amber-soft)',
                border: '1px solid oklch(0.85 0.15 200 / 0.3)',
                letterSpacing: '0.04em',
              }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                LIVE
              </span>
            </div>
            <div className="text-[34px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: netIncome >= 0 ? CYAN : RED, letterSpacing: '-0.02em' }}>
              {netIncome >= 0 ? '+' : ''}{formatMoney(netIncome)}
            </div>
            <div className="mt-1 text-[11.5px]" style={{ color: 'var(--text-disabled)' }}>net after allocations & bills</div>

            {/* Sparkline SVG */}
            <svg viewBox="0 0 300 96" className="mt-4 w-full" style={{ height: 96 }}>
              <defs>
                <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CYAN} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <filter id="sparkGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path d="M0 70 Q 30 40 60 52 T 120 35 T 180 60 T 240 25 T 300 30" fill="none" stroke={CYAN} strokeWidth={2} filter="url(#sparkGlow)" />
              <path d="M0 70 Q 30 40 60 52 T 120 35 T 180 60 T 240 25 T 300 30 V 96 H 0 Z" fill="url(#cyanGrad)" />
            </svg>

            {/* Summary stats */}
            <div className="mt-3 grid grid-cols-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>In</div>
                <div className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: GREEN }}>{formatMoneyShort(totalRev)}</div>
              </div>
              <div>
                <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>Out</div>
                <div className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: RED }}>{formatMoneyShort(Math.abs(totalExp))}</div>
              </div>
              <div>
                <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>Avg/day</div>
                <div className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                  {formatMoney(Math.abs(totalExp) / Math.max(1, new Set(transactions.map(t => t.date.slice(0,7))).size * 30))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget vs Actual */}
      <div className={panelClass} style={panelStyle}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className={sectionHeadingClass} style={{ ...sectionHeadingStyle, marginBottom: 2 }}>
              Budget vs Actual
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-disabled)' }}>
              {budgetMonth === 'ytd' ? 'Year to Date' : MONTHS[budgetMonth as number] + ' 2026'} &middot; Allocated (Profit First) vs Committed (Recurring) vs Actual (Transactions)
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setBudgetMonth('ytd')}
              className="rounded-md px-2.5 py-1 text-[10px] font-semibold"
              style={{
                background: budgetMonth === 'ytd' ? 'var(--amber-soft)' : 'transparent',
                color: budgetMonth === 'ytd' ? 'var(--amber-hover)' : 'var(--text-muted)',
                border: budgetMonth === 'ytd' ? '1px solid var(--amber)' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >YTD</button>
            {MONTHS.slice(0, new Date().getMonth() + 1).map((m, i) => (
              <button
                key={m}
                onClick={() => setBudgetMonth(i)}
                className="rounded-md px-2 py-1 text-[10px] font-semibold"
                style={{
                  background: budgetMonth === i ? 'var(--amber-soft)' : 'transparent',
                  color: budgetMonth === i ? 'var(--amber-hover)' : 'var(--text-muted)',
                  border: budgetMonth === i ? '1px solid var(--amber)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >{m}</button>
            ))}
          </div>
        </div>

        {budgetVsActual.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--text-disabled)' }}>
            No data for this period. Link categories to allocation accounts and recurring bills to see the budget comparison.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Category</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--amber)', borderBottom: '1px solid var(--border)' }}>Allocated</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--amber-warn)', borderBottom: '1px solid var(--border)' }}>Committed</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--red)', borderBottom: '1px solid var(--border)' }}>Actual</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', minWidth: 140 }}>Burn</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {budgetVsActual.map((row) => {
                  const benchmark = row.allocated > 0 ? row.allocated : row.committed;
                  const overBudget = benchmark > 0 && row.actual > benchmark;
                  const pct = benchmark > 0 ? (row.actual / benchmark) * 100 : 0;
                  const barColor = pct > 100 ? RED : pct > 80 ? NEON_AMBER : GREEN;

                  return (
                    <tr key={row.category} className="transition-colors hover:bg-[var(--card-hover)]">
                      <td className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 3, height: 14, borderRadius: 1, background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
                          <span className="font-medium" style={{ color: 'var(--text)' }}>{row.category}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {row.allocated > 0 ? formatMoney(row.allocated) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber-warn)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {row.committed > 0 ? formatMoney(row.committed) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: overBudget ? 'var(--red)' : 'var(--text)', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)' }}>
                        {row.actual > 0 ? formatMoney(row.actual) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)', minWidth: 140 }}>
                        {benchmark > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1 rounded" style={{ height: 6, background: 'var(--border)' }}>
                              <div className="absolute inset-y-0 left-0 rounded transition-all" style={{
                                width: Math.min(100, pct) + '%',
                                background: barColor,
                                boxShadow: `0 0 ${pct > 100 ? 8 : 4}px ${barColor}88`,
                              }} />
                              {pct > 100 && (
                                <div className="absolute inset-y-0 rounded-r" style={{
                                  left: '100%',
                                  width: Math.min(50, pct - 100) + '%',
                                  background: RED,
                                  opacity: 0.4,
                                  transform: 'translateX(-100%)',
                                }} />
                              )}
                            </div>
                            <span className="text-[10px] font-semibold" style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              color: pct > 100 ? RED : pct > 80 ? NEON_AMBER : 'var(--text-muted)',
                              minWidth: 36,
                              textAlign: 'right',
                            }}>{Math.round(pct)}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: row.variance >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
                        {row.variance > 0 ? '+' : ''}{formatMoney(row.variance)}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <td className="px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>Total</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.allocated, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber-warn)' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.committed, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--red)' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.actual, 0))}
                  </td>
                  <td />
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: budgetVsActual.reduce((s, r) => s + r.variance, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.variance, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      {activeMonthlyData.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Top Expense Categories */}
          <div className={panelClass} style={panelStyle}>
            <h3 className="mb-3 text-sm font-semibold" style={sectionHeadingStyle}>
              Top Expenses
            </h3>
            {categories
              .filter((c) => c.type === 'expense')
              .map((cat) => ({
                name: cat.name,
                color: cat.color || RED,
                total: Math.abs(transactions.filter((t) => t.category_id === cat.id && Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0)),
              }))
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((cat) => (
                <div key={cat.name} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-sm" style={{ background: cat.color }} />
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--red)' }}>
                    {formatMoney(cat.total)}
                  </span>
                </div>
              ))}
          </div>

          {/* Revenue Sources */}
          <div className={panelClass} style={panelStyle}>
            <h3 className="mb-3 text-sm font-semibold" style={sectionHeadingStyle}>
              Revenue Sources
            </h3>
            {categories
              .filter((c) => c.type === 'revenue')
              .map((cat) => ({
                name: cat.name,
                color: cat.color || GREEN,
                total: transactions.filter((t) => t.category_id === cat.id && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0),
                pct: totalRev > 0 ? ((transactions.filter((t) => t.category_id === cat.id && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)) / totalRev * 100).toFixed(1) : '0',
              }))
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((cat) => (
                <div key={cat.name} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-sm" style={{ background: cat.color }} />
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--green)' }}>
                      {formatMoney(cat.total)}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cat.pct}%</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Allocation Overview */}
          <div className={panelClass} style={panelStyle}>
            <h3 className="mb-3 text-sm font-semibold" style={sectionHeadingStyle}>
              Allocation Overview
            </h3>
            {allocationAccounts.map((acct) => {
              const allocated = Math.round(totalAllocated * (Number(acct.percentage) / 100) * 100) / 100;
              return (
                <div key={acct.id} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{acct.name}</span>
                    {acct.tag && (
                      <span className="rounded px-1 py-0.5 text-[7px] font-bold"
                        style={{ color: acct.tag === 'profit' ? 'var(--green)' : 'var(--amber)', background: (acct.tag === 'profit' ? GREEN : AMBER) + '22' }}>
                        {acct.tag.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{acct.percentage}%</span>
                    <span className="text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>
                      {allocated > 0 ? formatMoney(allocated) : '\u2014'}
                    </span>
                  </div>
                </div>
              );
            })}
            {allocationAccounts.length === 0 && (
              <div className="py-4 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>No allocation accounts set up yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className={panelClass + ' mt-6'} style={panelStyle}>
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow" style={{ color: 'var(--amber)' }}>// recent transactions</div>
            <a href="/transactions" className="text-[11px] font-medium" style={{ color: 'var(--amber)', textDecoration: 'none' }}>View all &rarr;</a>
          </div>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)', letterSpacing: '0.1em' }}>Date</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)', letterSpacing: '0.1em' }}>Description</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)', letterSpacing: '0.1em' }}>Amount</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)', letterSpacing: '0.1em' }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 8).map((txn) => {
                const amt = Number(txn.amount);
                const catName = (txn.category as Category | undefined)?.name || 'Uncategorized';
                return (
                  <tr key={txn.id} className="transition-colors hover:bg-[var(--card-hover)]">
                    <td className="px-3 py-2.5 text-[12px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {txn.date.slice(5).replace('-', '/')}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] font-medium" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {txn.description}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] font-semibold" style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: amt >= 0 ? GREEN : RED,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      {formatMoney(amt)}
                    </td>
                    <td className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10.5px]" style={{
                        background: 'var(--panel-2)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}>
                        {catName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
