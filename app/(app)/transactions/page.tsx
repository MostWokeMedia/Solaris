'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import Card from '@/components/shared/Card';
import CategoryManager from '@/components/shared/CategoryManager';
import CsvImport, { type ImportedTransaction } from '@/components/transactions/CsvImport';
import { formatMoney } from '@/lib/utils/money';
import type { Category, Transaction } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors";
const inputColors = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' };

const GREEN = '#34D399';
const RED = '#F87171';

type TransactionWithCategory = Transaction & { category?: Category | null };

export default function TransactionsPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');

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

  const revCatIds = useMemo(() => new Set(categories.filter((c) => c.type === 'revenue').map((c) => c.id)), [categories]);

  // Load data
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
    if (filterMonth !== 'All') {
      const monthIdx = MONTHS.indexOf(filterMonth) + 1;
      f = f.filter((t) => parseInt(t.date.split('-')[1]) === monthIdx);
    }
    if (filterType === 'Revenue') f = f.filter((t) => t.category_id && revCatIds.has(t.category_id));
    else if (filterType === 'Expenses') f = f.filter((t) => !t.category_id || !revCatIds.has(t.category_id));
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
  const totalPages = Math.ceil(filtered.length / pageSize);

  // Summary stats
  const totalRev = transactions
    .filter((t) => t.category_id && revCatIds.has(t.category_id))
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = transactions
    .filter((t) => !t.category_id || !revCatIds.has(t.category_id))
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const netIncome = totalRev + totalExp;

  // Transaction counts per category (for CategoryManager)
  const txnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  // Active months for filter dropdown
  const activeMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((t) => {
      const mi = parseInt(t.date.split('-')[1]) - 1;
      if (mi >= 0 && mi < 12) monthSet.add(MONTHS[mi]);
    });
    return MONTHS.filter((m) => monthSet.has(m));
  }, [transactions]);

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

  // CSV Import
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

  // Category CRUD
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

  function formatDate(iso: string): string {
    if (!iso) return '\u2014';
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="mb-1 text-2xl font-bold heading-gradient"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            Transactions
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {transactions.length} total transactions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Revenue" value={formatMoney(totalRev)} accent={GREEN} />
        <Card label="Expenses" value={formatMoney(Math.abs(totalExp))} accent={RED} />
        <Card
          label="Net Income"
          value={formatMoney(netIncome)}
          accent={netIncome >= 0 ? GREEN : RED}
          sub={totalRev ? (((netIncome / totalRev) * 100).toFixed(1) + '% margin') : undefined}
        />
        <Card label="Transactions" value={transactions.length.toString()} accent="#818CF8" sub={activeMonths.length + ' months tracked'} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={inputStyle}
          style={{ ...inputColors, maxWidth: 220 }}
          placeholder="Search..."
          value={searchQ}
          onChange={(e) => { setSearchQ(e.target.value); setPage(0); }}
        />
        <select
          className={inputStyle}
          style={{ ...inputColors, width: 'auto', minWidth: 110, cursor: 'pointer' }}
          value={filterMonth}
          onChange={(e) => { setFilterMonth(e.target.value); setPage(0); }}
        >
          <option value="All">All Months</option>
          {activeMonths.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select
          className={inputStyle}
          style={{ ...inputColors, width: 'auto', minWidth: 100, cursor: 'pointer' }}
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
        >
          <option value="All">All Types</option>
          <option value="Revenue">Revenue</option>
          <option value="Expenses">Expenses</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setShowCatMgr(true)}
          className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
          style={{ background: 'transparent', border: '1px solid var(--amber)', color: 'var(--amber)', cursor: 'pointer' }}
        >
          Categories
        </button>
        {transactions.some((t) => !t.category_id) && (
          <button
            onClick={handleRecategorize}
            disabled={recategorizing}
            className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid var(--green)', color: 'var(--green)', cursor: 'pointer' }}
          >
            {recategorizing ? 'Categorizing...' : `AI Categorize (${transactions.filter((t) => !t.category_id).length})`}
          </button>
        )}
        <button
          onClick={() => setShowImport(true)}
          className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
          style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)', color: 'var(--amber)', cursor: 'pointer' }}
        >
          Import CSV
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
          style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer' }}
        >
          + Add
        </button>
      </div>

      <div className="mb-2 text-xs" style={{ color: 'var(--text-disabled)' }}>
        {filtered.length} transactions{filtered.length !== transactions.length ? ` (filtered from ${transactions.length})` : ''}
      </div>

      {recategorizeResult && (
        <div className="mb-3 rounded-lg border px-4 py-3 text-xs"
          style={{
            background: recategorizeResult.includes('Categorized') ? '#0D3B2E' : '#3B2E0D',
            borderColor: recategorizeResult.includes('Categorized') ? '#34D39933' : '#FBBF2433',
            color: recategorizeResult.includes('Categorized') ? 'var(--green)' : 'var(--amber-warn)',
          }}>
          {recategorizeResult}
        </div>
      )}

      {/* Transaction Table */}
      <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div
          className="grid gap-0 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: '0.8fr 2fr 0.9fr 1.2fr',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-disabled)',
          }}
        >
          <div>Date</div>
          <div>Description</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Category</div>
        </div>

        <div className="max-h-[500px] overflow-auto">
          {paged.length === 0 && (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-disabled)' }}>
              {transactions.length === 0 ? 'No transactions yet. Import a CSV or add one manually.' : 'No transactions match your filters.'}
            </div>
          )}
          {paged.map((t) => (
            <div
              key={t.id}
              onClick={() => { setEditTxn({ ...t }); setConfirmDel(null); }}
              className="grid cursor-pointer items-center gap-0 px-4 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
              style={{
                gridTemplateColumns: '0.8fr 2fr 0.9fr 1.2fr',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(t.date)}</div>
              <div>
                <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{t.description}</div>
                {t.note && <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-disabled)' }}>{t.note}</div>}
              </div>
              <div
                className="text-right text-[13px] font-bold"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: Number(t.amount) >= 0 ? 'var(--green)' : 'var(--red)',
                }}
              >
                {formatMoney(Number(t.amount))}
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                {getCategoryName(t)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--card)', cursor: 'pointer' }}
          >
            Prev
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--card)', cursor: 'pointer' }}
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Transaction Modal */}
      <Modal open={!!editTxn} onClose={() => setEditTxn(null)} title="Edit Transaction">
        {editTxn && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  className={inputStyle}
                  style={inputColors}
                  type="date"
                  value={editTxn.date}
                  onChange={(e) => setEditTxn({ ...editTxn, date: e.target.value })}
                />
              </Field>
              <Field label="Amount">
                <input
                  className={inputStyle}
                  style={inputColors}
                  type="number"
                  step="0.01"
                  value={editTxn.amount}
                  onChange={(e) => setEditTxn({ ...editTxn, amount: parseFloat(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                className={inputStyle}
                style={inputColors}
                value={editTxn.description}
                onChange={(e) => setEditTxn({ ...editTxn, description: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputStyle}
                style={{ ...inputColors, cursor: 'pointer' }}
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
                className={inputStyle}
                style={inputColors}
                value={editTxn.note || ''}
                onChange={(e) => setEditTxn({ ...editTxn, note: e.target.value })}
              />
            </Field>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmDel === editTxn.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--red)' }}>Sure?</span>
                  <button
                    onClick={() => handleDelete(editTxn.id)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDel(editTxn.id)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleSaveEdit}
                className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Transaction Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              className={inputStyle}
              style={inputColors}
              type="date"
              value={newTxn.date}
              onChange={(e) => setNewTxn({ ...newTxn, date: e.target.value })}
            />
          </Field>
          <Field label="Amount (neg=expense)">
            <input
              className={inputStyle}
              style={inputColors}
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
            className={inputStyle}
            style={inputColors}
            placeholder="e.g. HEB groceries"
            value={newTxn.description}
            onChange={(e) => setNewTxn({ ...newTxn, description: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <select
            className={inputStyle}
            style={{ ...inputColors, cursor: 'pointer' }}
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
            className={inputStyle}
            style={inputColors}
            value={newTxn.note}
            onChange={(e) => setNewTxn({ ...newTxn, note: e.target.value })}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => setShowAdd(false)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
            style={{
              background: 'var(--amber)', color: '#0A0A0B',
              opacity: newTxn.description.trim() && newTxn.date ? 1 : 0.4,
              cursor: 'pointer',
            }}
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
