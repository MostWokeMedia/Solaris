'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import { DashboardSkeleton } from '@/components/shared/Skeleton';
import { formatMoney, formatMoneyShort } from '@/lib/utils/money';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { Category, Transaction, RecurringBill, AllocationAccount, AllocationPeriod } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const tooltipStyle = {
  background: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#E2E8F0',
};

export default function DashboardPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<(Transaction & { category?: Category })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringBills, setRecurringBills] = useState<(RecurringBill & { category?: Category })[]>([]);
  const [allocationAccounts, setAllocationAccounts] = useState<AllocationAccount[]>([]);
  const [allocationPeriods, setAllocationPeriods] = useState<AllocationPeriod[]>([]);
  const [loading, setLoading] = useState(true);

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
    const totalStarting = allocationPeriods.reduce((s, p) => s + Number(p.starting_amount), 0);

    return expenseCategories.map((cat) => {
      // Allocated: find allocation account linked to this category
      const account = allocationAccounts.find((a) => a.category_id === cat.id);
      const allocated = account ? Math.round(totalStarting * (Number(account.percentage) / 100) * 100) / 100 : 0;

      // Committed: sum of recurring bills in this category
      const committed = recurringBills
        .filter((b) => b.status === 'good' && b.category_id === cat.id)
        .reduce((s, b) => s + Number(b.amount), 0);

      // Actual: sum of transactions in this category
      const actual = Math.abs(
        transactions
          .filter((t) => t.category_id === cat.id && Number(t.amount) < 0)
          .reduce((s, t) => s + Number(t.amount), 0)
      );

      return {
        category: cat.name,
        color: cat.color || '#64748B',
        allocated,
        committed,
        actual,
        variance: allocated - actual,
      };
    }).filter((row) => row.allocated > 0 || row.committed > 0 || row.actual > 0)
      .sort((a, b) => b.actual - a.actual);
  }, [categories, allocationAccounts, allocationPeriods, recurringBills, transactions]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>Plan vs Commitments vs Reality</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card label="Revenue" value={formatMoney(totalRev)} accent="#34D399" />
        <Card label="Expenses" value={formatMoney(Math.abs(totalExp))} accent="#F87171" />
        <Card label="Net Income" value={formatMoney(netIncome)} accent={netIncome >= 0 ? '#34D399' : '#F87171'} sub={margin + '% margin'} />
        <Card label="Committed" value={'$' + goodBillsTotal.toLocaleString()} accent="#FBBF24" sub={recurringBills.filter((b) => b.status === 'good').length + ' active bills'} />
        <Card label="Vault" value={formatMoney(vaultTax.vault)} accent="#34D399" sub="Profit reserve" />
        <Card label="Tax Reserve" value={formatMoney(vaultTax.tax)} accent="#F59E0B" sub="Set aside" />
      </div>

      {/* Charts Row */}
      {activeMonthlyData.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Revenue vs Expenses */}
          <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
            <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Monthly Revenue vs Expenses
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeMonthlyData} barGap={4}>
                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="revenue" fill="#34D399" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#F87171" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit/Loss */}
          <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
            <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Monthly Profit / Loss
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeMonthlyData}>
                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} name="Profit/Loss">
                  {activeMonthlyData.map((d, i) => (
                    <Cell key={i} fill={d.profit >= 0 ? '#34D399' : '#F87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              {activeMonthlyData.map((d) => (
                <div key={d.month} className="text-center">
                  <div className="text-[11px]" style={{ color: '#64748B' }}>{d.month}</div>
                  <div className="text-xs font-bold" style={{ fontFamily: "'Space Mono', monospace", color: d.profit >= 0 ? '#34D399' : '#F87171' }}>
                    {formatMoney(d.profit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Budget vs Actual */}
      <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
        <h3 className="mb-4 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
          Budget vs Actual
        </h3>
        <p className="mb-4 text-xs" style={{ color: '#475569' }}>
          Allocated (Profit First) vs Committed (Recurring Bills) vs Actual (Transactions)
        </p>

        {budgetVsActual.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: '#475569' }}>
            Link categories to allocation accounts and recurring bills to see the budget comparison.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: '#64748B', borderBottom: '1px solid #1E293B' }}>Category</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: '#3B82F6', borderBottom: '1px solid #1E293B' }}>Allocated</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: '#FBBF24', borderBottom: '1px solid #1E293B' }}>Committed</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: '#F87171', borderBottom: '1px solid #1E293B' }}>Actual</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>Variance</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: '#64748B', borderBottom: '1px solid #1E293B', minWidth: 120 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {budgetVsActual.map((row) => {
                  const overBudget = row.allocated > 0 && row.actual > row.allocated;
                  const overCommitted = row.allocated > 0 && row.committed > row.allocated;
                  const pct = row.allocated > 0 ? Math.min((row.actual / row.allocated) * 100, 100) : 0;

                  return (
                    <tr key={row.category} className="transition-colors hover:bg-[#1A2332]">
                      <td className="px-3 py-2.5" style={{ borderBottom: '1px solid #1E293B22' }}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-sm" style={{ background: row.color }} />
                          <span className="font-medium" style={{ color: '#CBD5E1' }}>{row.category}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'Space Mono', monospace", color: '#3B82F6', borderBottom: '1px solid #1E293B22' }}>
                        {row.allocated > 0 ? formatMoney(row.allocated) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'Space Mono', monospace", color: overCommitted ? '#F87171' : '#FBBF24', borderBottom: '1px solid #1E293B22' }}>
                        {row.committed > 0 ? formatMoney(row.committed) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'Space Mono', monospace", color: overBudget ? '#F87171' : '#E2E8F0', fontWeight: 700, borderBottom: '1px solid #1E293B22' }}>
                        {row.actual > 0 ? formatMoney(row.actual) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: "'Space Mono', monospace", color: row.variance >= 0 ? '#34D399' : '#F87171', fontWeight: 600, borderBottom: '1px solid #1E293B22' }}>
                        {row.allocated > 0 ? formatMoney(row.variance) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5" style={{ borderBottom: '1px solid #1E293B22' }}>
                        {row.allocated > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: '#1E293B' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: pct + '%',
                                  background: overBudget ? '#F87171' : pct > 80 ? '#FBBF24' : '#34D399',
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold" style={{ color: overBudget ? '#F87171' : '#64748B', minWidth: 32, textAlign: 'right' }}>
                              {Math.round(pct)}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                <tr style={{ background: '#0F1629' }}>
                  <td className="px-3 py-2.5 font-bold" style={{ color: '#94A3B8' }}>Total</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#3B82F6' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.allocated, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#FBBF24' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.committed, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#F87171' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.actual, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontFamily: "'Space Mono', monospace", color: budgetVsActual.reduce((s, r) => s + r.variance, 0) >= 0 ? '#34D399' : '#F87171' }}>
                    {formatMoney(budgetVsActual.reduce((s, r) => s + r.variance, 0))}
                  </td>
                  <td />
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
          <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Top Expenses
            </h3>
            {categories
              .filter((c) => c.type === 'expense')
              .map((cat) => ({
                name: cat.name,
                color: cat.color || '#F87171',
                total: Math.abs(transactions.filter((t) => t.category_id === cat.id && Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0)),
              }))
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((cat) => (
                <div key={cat.name} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-sm" style={{ background: cat.color }} />
                    <span className="text-xs" style={{ color: '#CBD5E1' }}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#F87171' }}>
                    {formatMoney(cat.total)}
                  </span>
                </div>
              ))}
          </div>

          {/* Revenue Sources */}
          <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Revenue Sources
            </h3>
            {categories
              .filter((c) => c.type === 'revenue')
              .map((cat) => ({
                name: cat.name,
                color: cat.color || '#34D399',
                total: transactions.filter((t) => t.category_id === cat.id && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0),
                pct: totalRev > 0 ? ((transactions.filter((t) => t.category_id === cat.id && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)) / totalRev * 100).toFixed(1) : '0',
              }))
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((cat) => (
                <div key={cat.name} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-sm" style={{ background: cat.color }} />
                    <span className="text-xs" style={{ color: '#CBD5E1' }}>{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#34D399' }}>
                      {formatMoney(cat.total)}
                    </span>
                    <span className="text-[10px]" style={{ color: '#64748B' }}>{cat.pct}%</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Allocation Overview */}
          <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}>
              Allocation Overview
            </h3>
            {allocationAccounts.map((acct) => {
              const allocated = Math.round(totalAllocated * (Number(acct.percentage) / 100) * 100) / 100;
              return (
                <div key={acct.id} className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#CBD5E1' }}>{acct.name}</span>
                    {acct.tag && (
                      <span className="rounded px-1 py-0.5 text-[7px] font-bold"
                        style={{ color: acct.tag === 'profit' ? '#34D399' : '#F59E0B', background: (acct.tag === 'profit' ? '#34D399' : '#F59E0B') + '22' }}>
                        {acct.tag.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: '#64748B' }}>{acct.percentage}%</span>
                    <span className="text-xs font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#E2E8F0' }}>
                      {allocated > 0 ? formatMoney(allocated) : '\u2014'}
                    </span>
                  </div>
                </div>
              );
            })}
            {allocationAccounts.length === 0 && (
              <div className="py-4 text-center text-xs" style={{ color: '#475569' }}>No allocation accounts set up yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
