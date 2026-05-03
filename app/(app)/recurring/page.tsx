'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import Card from '@/components/shared/Card';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatMoney } from '@/lib/utils/money';
import type { RecurringBill, Category } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUSES: Array<'good' | 'paused' | 'cancelled'> = ['good', 'paused', 'cancelled'];
const DEFAULT_SOURCES = ['Wells Fargo', 'Chase Card', 'Discover Card', 'Master Card', 'Banana Stand'];

const COLOR_OPTIONS = ['#FF6600', '#1A5276', '#C0392B', '#7D3C98', '#3B82F6', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const GREEN = '#34D399';
const RED = '#F87171';
const CYAN = '#22d3ee';
const NEON_AMBER = '#f5a623';

type StrategyCard = {
  id: string;
  user_id: string;
  name: string;
  purpose: string | null;
  bonus: string | null;
  credit_limit: number;
  pay_range: string | null;
  pay_date: string | null;
  color: string;
  sort_order: number;
};

type BillWithCategory = RecurringBill & { category?: Category | null };

export default function RecurringPage() {
  const supabase = createClient();
  const [bills, setBills] = useState<BillWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'good' | 'paused' | 'cancelled'>('all');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [editBill, setEditBill] = useState<BillWithCategory | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [newBill, setNewBill] = useState<{
    name: string; amount: string; status: 'good' | 'paused' | 'cancelled';
    due_date: string; category_id: string; paid_from: string; note: string;
  }>({
    name: '', amount: '', status: 'good', due_date: '',
    category_id: '', paid_from: 'Wells Fargo', note: '',
  });

  const [showSourceMgr, setShowSourceMgr] = useState(false);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [editSourceIdx, setEditSourceIdx] = useState<number | null>(null);
  const [editSourceName, setEditSourceName] = useState('');

  const [strategyCards, setStrategyCards] = useState<StrategyCard[]>([]);
  const [editCard, setEditCard] = useState<StrategyCard | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [confirmCardDel, setConfirmCardDel] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({
    name: '', purpose: '', bonus: '', credit_limit: '', pay_range: '', pay_date: '', color: '#3B82F6',
  });

  const loadData = useCallback(async () => {
    const [{ data: billData }, { data: catData }, { data: cardData }] = await Promise.all([
      supabase.from('recurring_bills').select('*, category:categories(*)').order('amount', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('credit_card_strategy').select('*').order('sort_order'),
    ]);
    setBills(billData || []);
    setCategories(catData || []);
    setStrategyCards(cardData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const saved = localStorage.getItem('solaris_payment_sources');
    if (saved) setCustomSources(JSON.parse(saved));
  }, []);

  const paymentSources = useMemo(() => {
    const all = new Set([...DEFAULT_SOURCES, ...customSources]);
    bills.forEach((b) => { if (b.paid_from) all.add(b.paid_from); });
    return Array.from(all).sort();
  }, [bills, customSources]);

  function saveCustomSources(sources: string[]) {
    setCustomSources(sources);
    localStorage.setItem('solaris_payment_sources', JSON.stringify(sources));
  }

  function handleAddSource() {
    if (!newSource.trim() || paymentSources.includes(newSource.trim())) return;
    saveCustomSources([...customSources, newSource.trim()]);
    setNewSource('');
  }

  function handleRenameSource(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) { setEditSourceIdx(null); return; }
    saveCustomSources(customSources.map((s) => s === oldName ? newName.trim() : s));
    bills.filter((b) => b.paid_from === oldName).forEach(async (b) => {
      await supabase.from('recurring_bills').update({ paid_from: newName.trim() }).eq('id', b.id);
    });
    setEditSourceIdx(null);
    loadData();
  }

  function handleDeleteSource(name: string) {
    saveCustomSources(customSources.filter((s) => s !== name));
  }

  async function handleAddStrategyCard() {
    if (!newCard.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('credit_card_strategy').insert({
      user_id: user.id,
      name: newCard.name,
      purpose: newCard.purpose || null,
      bonus: newCard.bonus || null,
      credit_limit: parseFloat(newCard.credit_limit) || 0,
      pay_range: newCard.pay_range || null,
      pay_date: newCard.pay_date || null,
      color: newCard.color,
      sort_order: strategyCards.length,
    });
    setNewCard({ name: '', purpose: '', bonus: '', credit_limit: '', pay_range: '', pay_date: '', color: '#3B82F6' });
    setShowAddCard(false);
    loadData();
  }

  async function handleSaveStrategyCard() {
    if (!editCard) return;
    await supabase.from('credit_card_strategy').update({
      name: editCard.name,
      purpose: editCard.purpose,
      bonus: editCard.bonus,
      credit_limit: Number(editCard.credit_limit),
      pay_range: editCard.pay_range,
      pay_date: editCard.pay_date,
      color: editCard.color,
    }).eq('id', editCard.id);
    setEditCard(null);
    loadData();
  }

  async function handleDeleteStrategyCard(id: string) {
    await supabase.from('credit_card_strategy').delete().eq('id', id);
    setConfirmCardDel(null);
    setEditCard(null);
    loadData();
  }

  const filtered = filter === 'all' ? bills : bills.filter((b) => b.status === filter);

  const goodTotal = bills.filter((b) => b.status === 'good').reduce((s, b) => s + Number(b.amount), 0);
  const pausedTotal = bills.filter((b) => b.status === 'paused').reduce((s, b) => s + Number(b.amount), 0);
  const cancelledTotal = bills.filter((b) => b.status === 'cancelled').reduce((s, b) => s + Number(b.amount), 0);
  const statusCounts = {
    all: bills.length,
    good: bills.filter((b) => b.status === 'good').length,
    paused: bills.filter((b) => b.status === 'paused').length,
    cancelled: bills.filter((b) => b.status === 'cancelled').length,
  };

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const [, m, d] = iso.split('-');
    return MONTHS[parseInt(m) - 1] + ' ' + parseInt(d);
  }

  function getCategoryName(bill: BillWithCategory): string {
    if (bill.category && typeof bill.category === 'object' && 'name' in bill.category) {
      return (bill.category as Category).name;
    }
    return '';
  }

  async function cycleStatus(id: string, currentStatus: string) {
    const nextStatus = STATUSES[(STATUSES.indexOf(currentStatus as typeof STATUSES[number]) + 1) % 3];
    await supabase.from('recurring_bills').update({ status: nextStatus }).eq('id', id);
    loadData();
  }

  async function handleSaveEdit() {
    if (!editBill) return;
    await supabase.from('recurring_bills').update({
      name: editBill.name,
      amount: Number(editBill.amount),
      status: editBill.status,
      due_date: editBill.due_date || null,
      category_id: editBill.category_id || null,
      paid_from: editBill.paid_from,
      note: editBill.note,
    }).eq('id', editBill.id);
    setEditBill(null);
    loadData();
  }

  async function handleAdd() {
    if (!newBill.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('recurring_bills').insert({
      user_id: user.id,
      name: newBill.name,
      amount: parseFloat(newBill.amount) || 0,
      status: newBill.status,
      due_date: newBill.due_date || null,
      category_id: newBill.category_id || null,
      paid_from: newBill.paid_from,
      note: newBill.note || null,
    });
    setNewBill({ name: '', amount: '', status: 'good', due_date: '', category_id: '', paid_from: 'Wells Fargo', note: '' });
    setShowAdd(false);
    loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from('recurring_bills').delete().eq('id', id);
    setConfirmDel(null);
    setEditBill(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading bills...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Recurring"
        eyebrow="// recurring"
        subtitle="Click a row to edit · tap status badges to cycle"
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Active / Monthly" value={formatMoney(goodTotal)} accent={GREEN} sub={statusCounts.good + ' bills'} />
        <Card label="Paused" value={formatMoney(pausedTotal)} accent={NEON_AMBER} sub={statusCounts.paused + ' items'} />
        <Card label="Cancelled" value={formatMoney(cancelledTotal)} accent={RED} sub={statusCounts.cancelled + ' items'} />
        <Card label="Total items" value={bills.length.toString()} accent={CYAN} sub="tracked" />
      </div>

      {/* Main table panel */}
      <div className="panel">
        <div className="panel-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'good', label: 'Good' },
              { id: 'paused', label: 'Paused' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={'chip' + (filter === t.id ? ' active' : '')}
              >
                {t.label}
                <span className="num" style={{ opacity: 0.6, fontSize: 10 }}>
                  {statusCounts[t.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setShowSourceMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-1" />
                <path d="M16 12h5M16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              Payment sources
            </button>
            <button className="btn primary" onClick={() => setShowAdd(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add expense
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-disabled)' }}>
            {bills.length === 0 ? 'No recurring bills yet. Add one to get started.' : 'No bills in this category.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th className="r" style={{ width: 110 }}>Amount</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 80 }}>Due</th>
                <th style={{ width: 130 }}>Paid from</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill) => {
                const dim = bill.status !== 'good';
                return (
                  <tr key={bill.id} onClick={() => { setEditBill({ ...bill }); setConfirmDel(null); }}>
                    <td style={{ color: dim ? 'var(--text-muted)' : 'var(--text)', fontWeight: 500 }}>
                      {bill.name}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{getCategoryName(bill) || '—'}</td>
                    <td
                      className="r num"
                      style={{
                        color: dim ? 'var(--text-disabled)' : 'var(--text)',
                        fontWeight: 600,
                      }}
                    >
                      ${Number(bill.amount).toLocaleString()}
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); cycleStatus(bill.id, bill.status); }}>
                      <StatusBadge status={bill.status} onClick={() => {}} />
                    </td>
                    <td className="num" style={{ color: 'var(--text-muted)' }}>{formatDate(bill.due_date)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{bill.paid_from || '—'}</td>
                    <td
                      style={{
                        color: 'var(--text-disabled)',
                        fontSize: 11.5,
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={bill.note || ''}
                    >
                      {bill.note || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-disabled)',
          }}
        >
          Tap a status badge to cycle Good → Paused → Cancelled
        </div>
      </div>

      {/* Credit Card Strategy panel */}
      <div className="panel mt-4">
        <div className="panel-hdr">
          <div>
            <div className="eyebrow">{'// credit · card · strategy'}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Each card paired to a spending bucket
            </p>
          </div>
          <button className="btn primary" onClick={() => setShowAddCard(true)}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add card
          </button>
        </div>

        {strategyCards.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-disabled)' }}>
            No credit cards added yet. Click &ldquo;Add card&rdquo; to set up your strategy.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ padding: 16 }}>
            {strategyCards.map((card) => (
              <div
                key={card.id}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${card.color}`,
                  borderRadius: 8,
                }}
              >
                {/* Soft glow */}
                <div
                  style={{
                    position: 'absolute',
                    right: -20,
                    top: -20,
                    width: 120,
                    height: 120,
                    background: `radial-gradient(circle, ${card.color} 0%, transparent 70%)`,
                    opacity: 0.12,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ padding: 14 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedCard(expandedCard === card.sort_order ? null : card.sort_order)}
                    >
                      <div className="flex items-center gap-2">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth={2}>
                          <rect x={2} y={5} width={20} height={14} rx={2} />
                          <path d="M2 10h20" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{card.name}</span>
                      </div>
                      {card.purpose && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{card.purpose}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="num"
                        style={{ color: card.color, fontSize: 16, fontWeight: 600 }}
                      >
                        ${Number(card.credit_limit).toLocaleString()}
                      </span>
                      <button
                        className="btn icon sm"
                        onClick={() => setEditCard({ ...card })}
                        title="Edit"
                      >
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expandedCard === card.sort_order && (
                    <div
                      className="mt-3 border-t pt-3 text-xs leading-relaxed"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      <div className="mb-2">
                        <span className="eyebrow" style={{ marginRight: 8 }}>Rewards</span>
                        {card.bonus || 'None'}
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <span className="eyebrow" style={{ marginRight: 8 }}>Target</span>
                          <span className="num" style={{ color: 'var(--text)' }}>{card.pay_range || '—'}</span>
                        </div>
                        <div>
                          <span className="eyebrow" style={{ marginRight: 8 }}>Due</span>
                          <span className="num" style={{ color: 'var(--text)' }}>{card.pay_date || '—'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {strategyCards.length > 0 && (
          <div
            style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-disabled)',
              textAlign: 'center',
            }}
          >
            Tap a card to expand details &middot; Click pencil to edit
          </div>
        )}
      </div>

      {/* Edit Bill Modal */}
      <Modal open={!!editBill} onClose={() => { setEditBill(null); setConfirmDel(null); }} title="Edit Expense">
        {editBill && (
          <>
            <Field label="Name">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editBill.name}
                onChange={(e) => setEditBill({ ...editBill, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount ($)">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  value={editBill.amount}
                  onChange={(e) => setEditBill({ ...editBill, amount: parseFloat(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Status">
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={editBill.status}
                  onChange={(e) => setEditBill({ ...editBill, status: e.target.value as 'good' | 'paused' | 'cancelled' })}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="date"
                  value={editBill.due_date || ''}
                  onChange={(e) => setEditBill({ ...editBill, due_date: e.target.value })}
                />
              </Field>
              <Field label="Paid From">
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={editBill.paid_from || ''}
                  onChange={(e) => setEditBill({ ...editBill, paid_from: e.target.value })}
                >
                  {paymentSources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Category">
              <select
                className="input"
                style={{ width: '100%' }}
                value={editBill.category_id || ''}
                onChange={(e) => setEditBill({ ...editBill, category_id: e.target.value || null })}
              >
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editBill.note || ''}
                onChange={(e) => setEditBill({ ...editBill, note: e.target.value })}
              />
            </Field>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmDel === editBill.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--red)' }}>Sure?</span>
                  <button className="btn red sm" onClick={() => handleDelete(editBill.id)}>Yes, delete</button>
                  <button className="btn sm" onClick={() => setConfirmDel(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn red" onClick={() => setConfirmDel(editBill.id)}>Delete</button>
              )}
              <button className="btn primary" onClick={handleSaveEdit}>Save changes</button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Bill Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <Field label="Name">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. Netflix"
            value={newBill.name}
            onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <input
              className="input"
              style={{ width: '100%' }}
              type="number"
              placeholder="0"
              value={newBill.amount}
              onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              style={{ width: '100%' }}
              value={newBill.status}
              onChange={(e) => setNewBill({ ...newBill, status: e.target.value as 'good' | 'paused' | 'cancelled' })}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due Date">
            <input
              className="input"
              style={{ width: '100%' }}
              type="date"
              value={newBill.due_date}
              onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
            />
          </Field>
          <Field label="Paid From">
            <select
              className="input"
              style={{ width: '100%' }}
              value={newBill.paid_from}
              onChange={(e) => setNewBill({ ...newBill, paid_from: e.target.value })}
            >
              {paymentSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select
            className="input"
            style={{ width: '100%' }}
            value={newBill.category_id}
            onChange={(e) => setNewBill({ ...newBill, category_id: e.target.value })}
          >
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Notes (optional)">
          <input
            className="input"
            style={{ width: '100%' }}
            value={newBill.note}
            onChange={(e) => setNewBill({ ...newBill, note: e.target.value })}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
          <button
            className="btn primary"
            onClick={handleAdd}
            disabled={!newBill.name.trim()}
          >
            Add expense
          </button>
        </div>
      </Modal>

      {/* Payment Sources Modal */}
      <Modal
        open={showSourceMgr}
        onClose={() => { setShowSourceMgr(false); setEditSourceIdx(null); }}
        title="Manage Payment Sources"
      >
        <div className="mb-4 flex gap-2">
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="New payment source..."
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
          />
          <button
            className="btn primary"
            onClick={handleAddSource}
            disabled={!newSource.trim()}
          >
            + Add
          </button>
        </div>

        {paymentSources.map((source, i) => {
          const billCount = bills.filter((b) => b.paid_from === source).length;
          const isDefault = DEFAULT_SOURCES.includes(source);
          const isCustom = customSources.includes(source);

          return (
            <div
              key={source}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-[var(--card-hover)]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {editSourceIdx === i ? (
                <input
                  className="input"
                  style={{ flex: 1 }}
                  autoFocus
                  value={editSourceName}
                  onChange={(e) => setEditSourceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSource(source, editSourceName);
                    if (e.key === 'Escape') setEditSourceIdx(null);
                  }}
                  onBlur={() => handleRenameSource(source, editSourceName)}
                />
              ) : (
                <span className="flex-1 text-[13px]" style={{ color: 'var(--text)' }}>{source}</span>
              )}
              <span className="num text-[10px]" style={{ color: 'var(--text-disabled)' }}>{billCount} bills</span>
              {isDefault && !isCustom && (
                <span className="eyebrow">default</span>
              )}
              {(isCustom || !isDefault) && (
                <>
                  <button
                    className="btn icon sm"
                    onClick={() => { setEditSourceIdx(i); setEditSourceName(source); }}
                    title="Rename"
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="btn icon sm"
                    onClick={() => handleDeleteSource(source)}
                    title="Delete"
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          );
        })}

        <p className="mt-4 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
          Default sources are always available. Custom sources can be edited or removed.
          Sources used by existing bills will appear automatically.
        </p>
      </Modal>

      {/* Add Card Modal */}
      <Modal open={showAddCard} onClose={() => setShowAddCard(false)} title="Add Credit Card">
        <Field label="Card Name">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. Chase Sapphire"
            value={newCard.name}
            onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
          />
        </Field>
        <Field label="Purpose">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. Travel & dining"
            value={newCard.purpose}
            onChange={(e) => setNewCard({ ...newCard, purpose: e.target.value })}
          />
        </Field>
        <Field label="Rewards / Bonus">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. 3x on dining, 2x on travel"
            value={newCard.bonus}
            onChange={(e) => setNewCard({ ...newCard, bonus: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit Limit ($)">
            <input
              className="input"
              style={{ width: '100%' }}
              type="number"
              placeholder="0"
              value={newCard.credit_limit}
              onChange={(e) => setNewCard({ ...newCard, credit_limit: e.target.value })}
            />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCard({ ...newCard, color: c })}
                  className="h-6 w-6 rounded-md border-2"
                  style={{
                    background: c,
                    borderColor: newCard.color === c ? 'var(--text)' : 'transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Payment">
            <input
              className="input"
              style={{ width: '100%' }}
              placeholder="e.g. $25–$75"
              value={newCard.pay_range}
              onChange={(e) => setNewCard({ ...newCard, pay_range: e.target.value })}
            />
          </Field>
          <Field label="Due Date">
            <input
              className="input"
              style={{ width: '100%' }}
              placeholder="e.g. The 23rd"
              value={newCard.pay_date}
              onChange={(e) => setNewCard({ ...newCard, pay_date: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn" onClick={() => setShowAddCard(false)}>Cancel</button>
          <button
            className="btn primary"
            onClick={handleAddStrategyCard}
            disabled={!newCard.name.trim()}
          >
            Add card
          </button>
        </div>
      </Modal>

      {/* Edit Card Modal */}
      <Modal
        open={!!editCard}
        onClose={() => { setEditCard(null); setConfirmCardDel(null); }}
        title="Edit Credit Card"
      >
        {editCard && (
          <>
            <Field label="Card Name">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editCard.name}
                onChange={(e) => setEditCard({ ...editCard, name: e.target.value })}
              />
            </Field>
            <Field label="Purpose">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editCard.purpose || ''}
                onChange={(e) => setEditCard({ ...editCard, purpose: e.target.value })}
              />
            </Field>
            <Field label="Rewards / Bonus">
              <input
                className="input"
                style={{ width: '100%' }}
                value={editCard.bonus || ''}
                onChange={(e) => setEditCard({ ...editCard, bonus: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Credit Limit ($)">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  value={editCard.credit_limit}
                  onChange={(e) => setEditCard({ ...editCard, credit_limit: parseFloat(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Color">
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditCard({ ...editCard, color: c })}
                      className="h-6 w-6 rounded-md border-2"
                      style={{
                        background: c,
                        borderColor: editCard.color === c ? 'var(--text)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target Payment">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={editCard.pay_range || ''}
                  onChange={(e) => setEditCard({ ...editCard, pay_range: e.target.value })}
                />
              </Field>
              <Field label="Due Date">
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={editCard.pay_date || ''}
                  onChange={(e) => setEditCard({ ...editCard, pay_date: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmCardDel === editCard.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--red)' }}>Sure?</span>
                  <button className="btn red sm" onClick={() => handleDeleteStrategyCard(editCard.id)}>Yes, delete</button>
                  <button className="btn sm" onClick={() => setConfirmCardDel(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn red" onClick={() => setConfirmCardDel(editCard.id)}>Delete</button>
              )}
              <button className="btn primary" onClick={handleSaveStrategyCard}>Save changes</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
