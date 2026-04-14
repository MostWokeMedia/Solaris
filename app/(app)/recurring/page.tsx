'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import Card from '@/components/shared/Card';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatMoney } from '@/lib/utils/money';
import type { RecurringBill, Category } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUSES: Array<'good' | 'paused' | 'cancelled'> = ['good', 'paused', 'cancelled'];
const DEFAULT_SOURCES = ['Wells Fargo', 'Chase Card', 'Discover Card', 'Master Card', 'Banana Stand'];

const COLOR_OPTIONS = ['#FF6600', '#1A5276', '#C0392B', '#7D3C98', '#3B82F6', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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

const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500";
const inputColors = { background: '#0A0E17', borderColor: '#1E293B', color: '#E2E8F0' };

type BillWithCategory = RecurringBill & { category?: Category | null };

export default function RecurringPage() {
  const supabase = createClient();
  const [bills, setBills] = useState<BillWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'good' | 'paused' | 'cancelled'>('All');
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

  // Credit card strategy state
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

  // Load custom sources from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('solaris_payment_sources');
    if (saved) setCustomSources(JSON.parse(saved));
  }, []);

  // Build dynamic payment sources: defaults + custom + any from existing bills
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
    // Update custom sources list
    saveCustomSources(customSources.map((s) => s === oldName ? newName.trim() : s));
    // Update all bills with this source
    bills.filter((b) => b.paid_from === oldName).forEach(async (b) => {
      await supabase.from('recurring_bills').update({ paid_from: newName.trim() }).eq('id', b.id);
    });
    setEditSourceIdx(null);
    loadData();
  }

  function handleDeleteSource(name: string) {
    saveCustomSources(customSources.filter((s) => s !== name));
  }

  // Credit card strategy CRUD
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

  const filtered = filter === 'All' ? bills : bills.filter((b) => b.status === filter);

  const goodTotal = bills.filter((b) => b.status === 'good').reduce((s, b) => s + Number(b.amount), 0);
  const pausedTotal = bills.filter((b) => b.status === 'paused').reduce((s, b) => s + Number(b.amount), 0);
  const cancelledTotal = bills.filter((b) => b.status === 'cancelled').reduce((s, b) => s + Number(b.amount), 0);
  const statusCounts = {
    All: bills.length,
    good: bills.filter((b) => b.status === 'good').length,
    paused: bills.filter((b) => b.status === 'paused').length,
    cancelled: bills.filter((b) => b.status === 'cancelled').length,
  };

  function formatDate(iso: string | null): string {
    if (!iso) return '\u2014';
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
        <div className="text-sm" style={{ color: '#64748B' }}>Loading bills...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
            <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Recurring Bills
            </span>
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Click a row to edit &middot; Tap status badges to cycle
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSourceMgr(true)}
            className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', cursor: 'pointer' }}
          >
            Payment Sources
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}
          >
            <span className="text-lg leading-none">+</span> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Active Monthly" value={'$' + goodTotal.toLocaleString()} accent="#34D399" sub={statusCounts.good + ' bills'} />
        <Card label="Paused" value={'$' + pausedTotal.toLocaleString()} accent="#FBBF24" sub={statusCounts.paused + ' items'} />
        <Card label="Cancelled" value={'$' + cancelledTotal.toLocaleString()} accent="#F87171" sub={statusCounts.cancelled + ' items'} />
        <Card label="Total Items" value={bills.length.toString()} accent="#818CF8" sub="tracked" />
      </div>

      {/* Filter Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(['All', 'good', 'paused', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="rounded-lg border px-4 py-2 text-xs font-semibold"
            style={{
              borderColor: filter === s ? '#3B82F6' : '#1E293B',
              background: filter === s ? '#1E3A5F' : '#111827',
              color: filter === s ? '#93C5FD' : '#64748B',
              cursor: 'pointer',
            }}
          >
            {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}{' '}
            <span style={{ opacity: 0.5 }}>({statusCounts[s]})</span>
          </button>
        ))}
      </div>

      {/* Bills Table */}
      <div className="mb-8 overflow-hidden rounded-xl border" style={{ background: '#111827', borderColor: '#1E293B' }}>
        <div
          className="grid px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: '2fr 0.9fr 0.9fr 0.8fr 1.1fr',
            background: '#0F1629',
            borderBottom: '1px solid #1E293B',
            color: '#475569',
          }}
        >
          <div>Name</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Status</div>
          <div className="text-center">Due</div>
          <div>Paid From</div>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: '#475569' }}>
            {bills.length === 0 ? 'No recurring bills yet. Add one to get started.' : 'No bills in this category.'}
          </div>
        )}

        {filtered.map((bill) => (
          <div
            key={bill.id}
            onClick={() => { setEditBill({ ...bill }); setConfirmDel(null); }}
            className="grid cursor-pointer items-center px-5 py-3 transition-colors hover:bg-[#1A2332]"
            style={{
              gridTemplateColumns: '2fr 0.9fr 0.9fr 0.8fr 1.1fr',
              borderBottom: '1px solid #1E293B22',
            }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: '#E2E8F0' }}>{bill.name}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: '#475569' }}>
                {getCategoryName(bill)}{bill.note ? ` \u00B7 ${bill.note}` : ''}
              </div>
            </div>
            <div
              className="text-right text-sm font-bold"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: bill.status === 'good' ? '#E2E8F0' : '#64748B',
              }}
            >
              ${Number(bill.amount).toLocaleString()}
            </div>
            <div
              className="text-center"
              onClick={(e) => { e.stopPropagation(); cycleStatus(bill.id, bill.status); }}
            >
              <StatusBadge status={bill.status} onClick={() => {}} />
            </div>
            <div className="text-center text-[13px]" style={{ color: '#94A3B8' }}>
              {formatDate(bill.due_date)}
            </div>
            <div className="text-xs" style={{ color: '#64748B' }}>{bill.paid_from}</div>
          </div>
        ))}
      </div>

      {/* Credit Card Strategy */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "'Space Mono', monospace", color: '#94A3B8' }}
        >
          Credit Card Strategy
        </h2>
        <button
          onClick={() => setShowAddCard(true)}
          className="flex items-center gap-1.5 rounded-lg border-none px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}
        >
          <span className="text-sm leading-none">+</span> Add Card
        </button>
      </div>

      {strategyCards.length === 0 && (
        <div className="rounded-xl border py-8 text-center text-sm" style={{ background: '#111827', borderColor: '#1E293B', color: '#475569' }}>
          No credit cards added yet. Click &ldquo;Add Card&rdquo; to set up your strategy.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {strategyCards.map((card) => (
          <div
            key={card.id}
            className="overflow-hidden rounded-xl border transition-colors"
            style={{ background: '#111827', borderColor: '#1E293B' }}
          >
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${card.color}, ${card.color}88)` }} />
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setExpandedCard(expandedCard === card.sort_order ? null : card.sort_order)}
                >
                  <div className="text-[15px] font-semibold" style={{ color: '#E2E8F0' }}>{card.name}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: '#64748B' }}>{card.purpose}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-bold" style={{ fontFamily: "'Space Mono', monospace", color: card.color }}>
                    ${Number(card.credit_limit).toLocaleString()}
                  </div>
                  <button
                    onClick={() => setEditCard({ ...card })}
                    className="border-none bg-transparent px-1 py-0.5 text-xs"
                    style={{ color: '#64748B', cursor: 'pointer' }}
                  >
                    &#x270E;
                  </button>
                </div>
              </div>
              {expandedCard === card.sort_order && (
                <div className="mt-3 border-t pt-3 text-xs leading-relaxed" style={{ borderColor: '#1E293B', color: '#94A3B8' }}>
                  <div className="mb-2"><span style={{ color: '#64748B' }}>Rewards: </span>{card.bonus || 'None'}</div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div><span style={{ color: '#64748B' }}>Target: </span><span className="font-semibold" style={{ color: '#E2E8F0' }}>{card.pay_range || '\u2014'}</span></div>
                    <div><span style={{ color: '#64748B' }}>Due: </span><span className="font-semibold" style={{ color: '#E2E8F0' }}>{card.pay_date || '\u2014'}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {strategyCards.length > 0 && (
        <p className="mt-2 text-center text-[11px]" style={{ color: '#334155' }}>Tap a card to expand &middot; Click &#x270E; to edit</p>
      )}

      {/* Edit Modal */}
      <Modal open={!!editBill} onClose={() => { setEditBill(null); setConfirmDel(null); }} title="Edit Expense">
        {editBill && (
          <>
            <Field label="Name">
              <input className={inputStyle} style={inputColors} value={editBill.name}
                onChange={(e) => setEditBill({ ...editBill, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount ($)">
                <input className={inputStyle} style={inputColors} type="number" value={editBill.amount}
                  onChange={(e) => setEditBill({ ...editBill, amount: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="Status">
                <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={editBill.status}
                  onChange={(e) => setEditBill({ ...editBill, status: e.target.value as 'good' | 'paused' | 'cancelled' })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date">
                <input className={inputStyle} style={inputColors} type="date" value={editBill.due_date || ''}
                  onChange={(e) => setEditBill({ ...editBill, due_date: e.target.value })} />
              </Field>
              <Field label="Paid From">
                <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={editBill.paid_from || ''}
                  onChange={(e) => setEditBill({ ...editBill, paid_from: e.target.value })}>
                  {paymentSources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Category">
              <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={editBill.category_id || ''}
                onChange={(e) => setEditBill({ ...editBill, category_id: e.target.value || null })}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input className={inputStyle} style={inputColors} value={editBill.note || ''}
                onChange={(e) => setEditBill({ ...editBill, note: e.target.value })} />
            </Field>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmDel === editBill.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: '#F87171' }}>Sure?</span>
                  <button onClick={() => handleDelete(editBill.id)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: '#F8717133', color: '#F87171', background: 'transparent', cursor: 'pointer' }}>
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDel(null)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(editBill.id)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#F8717133', color: '#F87171', background: 'transparent', cursor: 'pointer' }}>
                  Delete
                </button>
              )}
              <button onClick={handleSaveEdit}
                className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}>
                Save Changes
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <Field label="Name">
          <input className={inputStyle} style={inputColors} value={newBill.name} placeholder="e.g. Netflix"
            onChange={(e) => setNewBill({ ...newBill, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <input className={inputStyle} style={inputColors} type="number" value={newBill.amount} placeholder="0"
              onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={newBill.status}
              onChange={(e) => setNewBill({ ...newBill, status: e.target.value as 'good' | 'paused' | 'cancelled' })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due Date">
            <input className={inputStyle} style={inputColors} type="date" value={newBill.due_date}
              onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })} />
          </Field>
          <Field label="Paid From">
            <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={newBill.paid_from}
              onChange={(e) => setNewBill({ ...newBill, paid_from: e.target.value })}>
              {paymentSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={newBill.category_id}
            onChange={(e) => setNewBill({ ...newBill, category_id: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Notes (optional)">
          <input className={inputStyle} style={inputColors} value={newBill.note}
            onChange={(e) => setNewBill({ ...newBill, note: e.target.value })} />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={() => setShowAdd(false)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleAdd}
            className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              opacity: newBill.name.trim() ? 1 : 0.4,
              cursor: 'pointer',
            }}>
            Add Expense
          </button>
        </div>
      </Modal>

      {/* Payment Sources Modal */}
      <Modal open={showSourceMgr} onClose={() => { setShowSourceMgr(false); setEditSourceIdx(null); }} title="Manage Payment Sources">
        <div className="mb-4 flex gap-2">
          <input
            className={inputStyle + ' flex-1'}
            style={inputColors}
            placeholder="New payment source..."
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
          />
          <button
            onClick={handleAddSource}
            className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer', opacity: newSource.trim() ? 1 : 0.4 }}
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
              className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-[#1A2332]"
              style={{ borderBottom: '1px solid #1E293B22' }}
            >
              {editSourceIdx === i ? (
                <input
                  className={inputStyle + ' flex-1'}
                  style={{ ...inputColors, padding: '4px 8px', fontSize: 12 }}
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
                <span className="flex-1 text-[13px]" style={{ color: '#CBD5E1' }}>{source}</span>
              )}
              <span className="text-[10px]" style={{ color: '#475569' }}>{billCount} bills</span>
              {isDefault && !isCustom && (
                <span className="text-[9px]" style={{ color: '#334155' }}>default</span>
              )}
              {(isCustom || !isDefault) && (
                <>
                  <button
                    onClick={() => { setEditSourceIdx(i); setEditSourceName(source); }}
                    className="border-none bg-transparent px-1.5 py-0.5 text-xs"
                    style={{ color: '#64748B', cursor: 'pointer' }}
                  >
                    &#x270E;
                  </button>
                  <button
                    onClick={() => handleDeleteSource(source)}
                    className="border-none bg-transparent px-1.5 py-0.5 text-xs"
                    style={{ color: '#64748B', cursor: 'pointer' }}
                  >
                    &#x2715;
                  </button>
                </>
              )}
            </div>
          );
        })}

        <p className="mt-4 text-[10px]" style={{ color: '#334155' }}>
          Default sources are always available. Custom sources can be edited or removed.
          Sources used by existing bills will appear automatically.
        </p>
      </Modal>

      {/* Add Card Modal */}
      <Modal open={showAddCard} onClose={() => setShowAddCard(false)} title="Add Credit Card">
        <Field label="Card Name">
          <input className={inputStyle} style={inputColors} value={newCard.name} placeholder="e.g. Chase Sapphire"
            onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} />
        </Field>
        <Field label="Purpose">
          <input className={inputStyle} style={inputColors} value={newCard.purpose} placeholder="e.g. Travel & dining"
            onChange={(e) => setNewCard({ ...newCard, purpose: e.target.value })} />
        </Field>
        <Field label="Rewards / Bonus">
          <input className={inputStyle} style={inputColors} value={newCard.bonus} placeholder="e.g. 3x on dining, 2x on travel"
            onChange={(e) => setNewCard({ ...newCard, bonus: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit Limit ($)">
            <input className={inputStyle} style={inputColors} type="number" value={newCard.credit_limit} placeholder="0"
              onChange={(e) => setNewCard({ ...newCard, credit_limit: e.target.value })} />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} onClick={() => setNewCard({ ...newCard, color: c })}
                  className="h-6 w-6 rounded-md border-2"
                  style={{ background: c, borderColor: newCard.color === c ? '#E2E8F0' : 'transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Payment">
            <input className={inputStyle} style={inputColors} value={newCard.pay_range} placeholder="e.g. $25–$75"
              onChange={(e) => setNewCard({ ...newCard, pay_range: e.target.value })} />
          </Field>
          <Field label="Due Date">
            <input className={inputStyle} style={inputColors} value={newCard.pay_date} placeholder="e.g. The 23rd"
              onChange={(e) => setNewCard({ ...newCard, pay_date: e.target.value })} />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={() => setShowAddCard(false)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAddStrategyCard}
            className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer', opacity: newCard.name.trim() ? 1 : 0.4 }}>
            Add Card
          </button>
        </div>
      </Modal>

      {/* Edit Card Modal */}
      <Modal open={!!editCard} onClose={() => { setEditCard(null); setConfirmCardDel(null); }} title="Edit Credit Card">
        {editCard && (
          <>
            <Field label="Card Name">
              <input className={inputStyle} style={inputColors} value={editCard.name}
                onChange={(e) => setEditCard({ ...editCard, name: e.target.value })} />
            </Field>
            <Field label="Purpose">
              <input className={inputStyle} style={inputColors} value={editCard.purpose || ''}
                onChange={(e) => setEditCard({ ...editCard, purpose: e.target.value })} />
            </Field>
            <Field label="Rewards / Bonus">
              <input className={inputStyle} style={inputColors} value={editCard.bonus || ''}
                onChange={(e) => setEditCard({ ...editCard, bonus: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Credit Limit ($)">
                <input className={inputStyle} style={inputColors} type="number" value={editCard.credit_limit}
                  onChange={(e) => setEditCard({ ...editCard, credit_limit: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="Color">
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} onClick={() => setEditCard({ ...editCard, color: c })}
                      className="h-6 w-6 rounded-md border-2"
                      style={{ background: c, borderColor: editCard.color === c ? '#E2E8F0' : 'transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target Payment">
                <input className={inputStyle} style={inputColors} value={editCard.pay_range || ''}
                  onChange={(e) => setEditCard({ ...editCard, pay_range: e.target.value })} />
              </Field>
              <Field label="Due Date">
                <input className={inputStyle} style={inputColors} value={editCard.pay_date || ''}
                  onChange={(e) => setEditCard({ ...editCard, pay_date: e.target.value })} />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              {confirmCardDel === editCard.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: '#F87171' }}>Sure?</span>
                  <button onClick={() => handleDeleteStrategyCard(editCard.id)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: '#F8717133', color: '#F87171', background: 'transparent', cursor: 'pointer' }}>Yes, delete</button>
                  <button onClick={() => setConfirmCardDel(null)}
                    className="rounded border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmCardDel(editCard.id)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#F8717133', color: '#F87171', background: 'transparent', cursor: 'pointer' }}>Delete</button>
              )}
              <button onClick={handleSaveStrategyCard}
                className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}>Save Changes</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
