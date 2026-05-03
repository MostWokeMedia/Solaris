'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import Card from '@/components/shared/Card';
import PageHeader from '@/components/layout/PageHeader';
import CategoryManager from '@/components/shared/CategoryManager';
import CsvImport, { type ImportedTransaction } from '@/components/transactions/CsvImport';
import { formatMoney } from '@/lib/utils/money';
import type { Category, Transaction } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const GREEN = '#34D399';
const RED = '#F87171';
const CYAN = '#22d3ee';
const MAGENTA = '#e879b8';

type TransactionWithCategory = Transaction & { category?: Category | null };

export default function TransactionsPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Modals
  const [editTxn, setEditTxn] = useState<TransactionWithCategory | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Recategorize
  const [recategorizing, setRecategorizing] = useState(false);
  const [recategorizeResult, setRecategorizeResult] = useState('');

  // New transaction form
  const [newTxn, setNewTxn] = useState({
    date: '', description: '', amount: '', category_id: '', note: '',
  });

  const revCatIds = useMemo(
    () => new Set(categories.filter((c) => c.type === 'revenue').map((c) => c.id)),
    [categories]
  );

  const loadData = useCallback(async () => {
    const [{ data: txnData }, { data: catData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    setTransactions(txnData || []);
    setCategories(catData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter + search
  const filtered = useMemo(() => {
    let f = [...transactions];
    if (filterMonth !== 'all') {
      const monthIdx = parseInt(filterMonth);
      f = f.filter((t) => parseInt(t.date.split('-')[1]) === monthIdx);
    }
    if (filterType === 'revenue') f = f.filter((t) => t.category_id && revCatIds.has(t.category_id));
    else if (filterType === 'expense') f = f.filter((t) => !t.category_id || !revCatIds.has(t.category_id));
    if (searchQ) {
      const q = searchQ.toLowerCase();
      f = f.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        (t.category as Category | null)?.name?.toLowerCase().includes(q)
      );
    }
    return f;
  }, [transactions, filterMonth, filterType, searchQ, revCatIds]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Summary stats
  const totalRev = transactions
    .filter((t) => t.category_id && revCatIds.has(t.category_id))
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = transactions
    .filter((t) => !t.category_id || !revCatIds.has(t.category_id))
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const netIncome = totalRev + totalExp;
  const margin = totalRev ? ((netIncome / totalRev) * 100).toFixed(1) : '0';

  const txnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  const activeMonths = useMemo(() => {
    const monthSet = new Set<number>();
    transactions.forEach((t) => {
      const mi = parseInt(t.date.split('-')[1]);
      if (mi >= 1 && mi <= 12) monthSet.add(mi);
    });
    return Array.from(monthSet).sort((a, b) => a - b);
  }, [transactions]);

  const uncategorizedCount = transactions.filter((t) => !t.category_id).length;

  // === CRUD ===
  async function handleSaveEdit() {
    if (!editTxn) return;
    const { error } = await supabase
      .from('transactions')
      .update({
        date: editTxn.date,
        description: editTxn.description,
        amount: Number(editTxn.amount),
        category_id: editTxn.category_id || null,
        note: editTxn.note,
      })
      .eq('id', editTxn.id);
    if (!error) {
      setEditTxn(null);
      loadData();
    }
  }

  async function handleAdd() {
    if (!newTxn.description.trim() || !newTxn.date) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      date: newTxn.date,
      description: newTxn.description,
      amount: parseFloat(newTxn.amount) || 0,
      category_id: newTxn.category_id || null,
      note: newTxn.note || null,
    });
    if (!error) {
      setNewTxn({ date: '', description: '', amount: '', category_id: '', note: '' });
      setShowAdd(false);
      loadData();
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      setConfirmDel(null);
      setEditTxn(null);
      loadData();
    }
  }

  async function handleRecategorize() {
    setRecategorizing(true);
    setRecategorizeResult('');
    try {
      const res = await fetch('/api/ai/recategorize', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRecategorizeResult(
          data.updated > 0
            ? `Categorized ${data.updated} transactions${data.still_uncategorized > 0 ? ` (${data.still_uncategorized} still uncategorized — AI wasn't confident)` : ''}`
            : data.message || 'No changes'
        );
        loadData();
      } else {
        setRecategorizeResult(data.error || 'Recategorize failed');
      }
    } catch {
      setRecategorizeResult('Recategorize failed');
    }
    setRecategorizing(false);
  }

  async function handleImport(imported: ImportedTransaction[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const batch = new Date().toISOString();
    const rows = imported.map((t) => ({
      user_id: user.id,
      date: t.date,
      description: t.description,
      original_description: t.original_description,
      amount: t.amount,
      category_id: t.category_id || null,
      import_batch: batch,
      note: 'imported',
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('transactions').insert(rows.slice(i, i + 500));
    }
    loadData();
  }

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

  function getCategoryName(t: TransactionWithCategory): string {
    if (t.category && typeof t.category === 'object' && 'name' in t.category) {
      return (t.category as Category).name;
    }
    return 'Uncategorized';
  }

  function isRevenueTxn(t: TransactionWithCategory) {
    return !!t.category_id && revCatIds.has(t.category_id);
  }

  function formatDate(iso: string): string {
    if (!iso) return '—';
    const parts = iso.split('-');
    return MONTHS[parseInt(parts[1]) - 1] + ' ' + parseInt(parts[2]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading transactions...</div>
      </div>
    );
  }

  // Pagination chip range (max 5 chips around current page)
  const pageRange = (() => {
    const max = totalPages;
    const cur = page + 1;
    const start = Math.max(1, Math.min(cur - 2, max - 4));
    const end = Math.min(max, start + 4);
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  })();

  return (
    <div>
      <PageHeader
        title="Transactions"
        eyebrow="// transactions"
        subtitle={`${transactions.length} total transactions`}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Revenue" value={formatMoney(totalRev)} accent={GREEN} sub="YTD 2026" />
        <Card label="Expenses" value={formatMoney(Math.abs(totalExp))} accent={RED} sub="YTD 2026" />
        <Card
          label="Net Income"
          value={formatMoney(netIncome)}
          accent={netIncome >= 0 ? CYAN : RED}
          sub={margin + '% margin'}
        />
        <Card
          label="Transactions"
          value={transactions.length.toString()}
          accent={MAGENTA}
          sub={activeMonths.length + ' months tracked'}
        />
      </div>

      {/* Main panel */}
      <div className="panel">
        <div className="panel-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Filter cluster */}
          <div className="flex flex-1 flex-wrap items-center gap-2" style={{ minWidth: 0 }}>
            <div className="relative" style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
              <span
                className="pointer-events-none absolute"
                style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx={11} cy={11} r={7} />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                className="input"
                style={{ width: '100%', paddingLeft: 30 }}
                placeholder="Search transactions..."
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(0); }}
              />
            </div>
            <select
              className="input"
              value={filterMonth}
              onChange={(e) => { setFilterMonth(e.target.value); setPage(0); }}
            >
              <option value="all">All months</option>
              {activeMonths.map((m) => (
                <option key={m} value={String(m).padStart(2, '0')}>
                  {MONTHS[m - 1]}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
            >
              <option value="all">All types</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {/* Action cluster */}
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => setShowCatMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={3} y={3} width={7} height={7} /><rect x={14} y={3} width={7} height={7} />
                <rect x={3} y={14} width={7} height={7} /><rect x={14} y={14} width={7} height={7} />
              </svg>
              Categories
            </button>
            {uncategorizedCount > 0 && (
              <button
                className="btn green"
                onClick={handleRecategorize}
                disabled={recategorizing}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {recategorizing ? 'Categorizing...' : `AI categorize (${uncategorizedCount})`}
              </button>
            )}
            <button className="btn amber" onClick={() => setShowImport(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Import CSV
            </button>
            <button className="btn primary" onClick={() => setShowAdd(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Pagination strip */}
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          <span className="eyebrow">
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
            {filtered.length !== transactions.length && ` (filtered from ${transactions.length})`}
            {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button className="chip" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Prev</button>
              {pageRange.map((n) => (
                <button
                  key={n}
                  className={'chip' + (n === page + 1 ? ' active' : '')}
                  onClick={() => setPage(n - 1)}
                >
                  {n}
                </button>
              ))}
              <button className="chip" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</button>
            </div>
          )}
        </div>

        {/* Recategorize result banner */}
        {recategorizeResult && (
          <div
            className="text-xs"
            style={{
              padding: '10px 18px',
              borderBottom: '1px solid var(--border)',
              background: recategorizeResult.includes('Categorized') ? 'oklch(0.82 0.18 155 / 0.08)' : 'oklch(0.82 0.16 80 / 0.08)',
              color: recategorizeResult.includes('Categorized') ? 'var(--green)' : 'var(--neon-amber)',
            }}
          >
            {recategorizeResult}
          </div>
        )}

        {/* Transaction Table */}
        {paged.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-disabled)' }}>
            {transactions.length === 0
              ? 'No transactions yet. Import a CSV or add one manually.'
              : 'No transactions match your filters.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Date</th>
                <th>Description</th>
                <th className="r" style={{ width: 140 }}>Amount</th>
                <th style={{ width: 220 }}>Category</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => {
                const isRev = isRevenueTxn(t);
                const positive = Number(t.amount) >= 0;
                return (
                  <tr key={t.id} onClick={() => { setEditTxn({ ...t }); setConfirmDel(null); }}>
                    <td className="num" style={{ color: 'var(--text-disabled)' }}>{formatDate(t.date)}</td>
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                      {t.description}
                      {t.note && (
                        <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-disabled)' }}>{t.note}</div>
                      )}
                    </td>
                    <td
                      className="r num"
                      style={{
                        color: positive ? 'var(--green)' : 'var(--red)',
                        fontWeight: 600,
                        textShadow: positive
                          ? `0 0 calc(8px * var(--glow-k)) oklch(0.82 0.18 155 / calc(0.6 * var(--glow-k)))`
                          : `0 0 calc(8px * var(--glow-k)) oklch(0.70 0.22 25 / calc(0.5 * var(--glow-k)))`,
                      }}
                    >
                      {positive ? '+' : ''}{formatMoney(Number(t.amount))}
                    </td>
                    <td>
                      <span className="cat-pill">
                        <span
                          className="dot"
                          style={{
                            background: isRev ? 'var(--green)' : 'var(--neon-amber)',
                            boxShadow: isRev ? '0 0 6px var(--green)' : '0 0 6px var(--neon-amber)',
                          }}
                        />
                        {getCategoryName(t)}
                      </span>
                    </td>
                    <td>
                      <div
                        className="flex justify-end gap-1"
                        style={{ opacity: 0.55 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn icon sm"
                          onClick={() => { setEditTxn({ ...t }); setConfirmDel(null); }}
                          title="Edit"
                        >
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="btn icon sm"
                          onClick={() => { setEditTxn({ ...t }); setConfirmDel(t.id); }}
                          title="Delete"
                        >
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Transaction Modal */}
      <Modal open={!!editTxn} onClose={() => setEditTxn(null)} title="Edit Transaction">
        {editTxn && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="date"
                  value={editTxn.date}
                  onChange={(e) => setEditTxn({ ...editTxn, date: e.target.value })}
                />
              </Field>
              <Field label="Amount">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.01"
                  value={editTxn.amount}
                  onChange={(e) => setEditTxn({ ...editTxn, amount: parseFloat(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editTxn.description}
                onChange={(e) => setEditTxn({ ...editTxn, description: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className="input"
                style={{ width: '100%' }}
                value={editTxn.category_id || ''}
                onChange={(e) => setEditTxn({ ...editTxn, category_id: e.target.value || null })}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editTxn.note || ''}
                onChange={(e) => setEditTxn({ ...editTxn, note: e.target.value })}
              />
            </Field>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmDel === editTxn.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--red)' }}>Sure?</span>
                  <button className="btn red sm" onClick={() => handleDelete(editTxn.id)}>Yes</button>
                  <button className="btn sm" onClick={() => setConfirmDel(null)}>No</button>
                </div>
              ) : (
                <button className="btn red" onClick={() => setConfirmDel(editTxn.id)}>Delete</button>
              )}
              <button className="btn primary" onClick={handleSaveEdit}>Save</button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Transaction Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              className="input"
              style={{ width: '100%' }}
              type="date"
              value={newTxn.date}
              onChange={(e) => setNewTxn({ ...newTxn, date: e.target.value })}
            />
          </Field>
          <Field label="Amount (neg=expense)">
            <input
              className="input"
              style={{ width: '100%' }}
              type="number"
              step="0.01"
              placeholder="-25.00"
              value={newTxn.amount}
              onChange={(e) => setNewTxn({ ...newTxn, amount: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Description">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. HEB groceries"
            value={newTxn.description}
            onChange={(e) => setNewTxn({ ...newTxn, description: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <select
            className="input"
            style={{ width: '100%' }}
            value={newTxn.category_id}
            onChange={(e) => setNewTxn({ ...newTxn, category_id: e.target.value })}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input
            className="input"
            style={{ width: '100%' }}
            value={newTxn.note}
            onChange={(e) => setNewTxn({ ...newTxn, note: e.target.value })}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
          <button
            className="btn primary"
            onClick={handleAdd}
            disabled={!newTxn.description.trim() || !newTxn.date}
          >
            Add
          </button>
        </div>
      </Modal>

      {/* CSV Import */}
      <CsvImport open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} categories={categories} />

      {/* Category Manager */}
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
