'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Card from '@/components/shared/Card';
import { formatMoney } from '@/lib/utils/money';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AllocationAccount, AllocationPeriod, CreditCard, CreditCardCheck, Category } from '@/types';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIODS: { key: string; label: string; month: number; half: number; qEnd: boolean }[] = [];
for (let m = 0; m < 12; m++) {
  PERIODS.push({ key: m + '-10', label: MN[m] + ' 10', month: m, half: 0, qEnd: false });
  PERIODS.push({ key: m + '-25', label: MN[m] + ' 25', month: m, half: 1, qEnd: m === 2 || m === 5 || m === 8 || m === 11 });
}

const TAG_COLORS: Record<string, string> = { profit: 'var(--green)', tax: 'var(--neon-amber)' };
const TAG_BG: Record<string, string> = {
  profit: 'oklch(0.82 0.18 155 / 0.12)',
  tax: 'oklch(0.82 0.16 80 / 0.12)',
};
const TAG_LABELS: Record<string, string> = { profit: 'PROFIT', tax: 'TAX' };

const GREEN = '#34D399';
const RED = '#F87171';
const CYAN = '#22d3ee';
const MAGENTA = '#e879b8';

function SortableAccountRow({ acct, children }: { acct: AllocationAccount; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: acct.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderBottom: '1px solid var(--border)',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 rounded-md px-1 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center px-1"
        style={{ color: 'var(--text-disabled)', touchAction: 'none' }}
      >
        ⠿
      </div>
      {children}
    </div>
  );
}

export default function AllocationsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<AllocationAccount[]>([]);
  const [periods, setPeriods] = useState<Record<string, AllocationPeriod>>({});
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardChecks, setCardChecks] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [year] = useState(2026);

  // UI state
  const [showAcctMgr, setShowAcctMgr] = useState(false);
  const [showCardMgr, setShowCardMgr] = useState(false);
  const [editAcct, setEditAcct] = useState<AllocationAccount | null>(null);
  const [newAcct, setNewAcct] = useState({ name: '', pct: '', tag: '', category_id: '' });
  const [newCard, setNewCard] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'pct' | 'name' } | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: acctData }, { data: periodData }, { data: cardData }, { data: checkData }, { data: catData }] = await Promise.all([
      supabase.from('allocation_accounts').select('*').order('sort_order'),
      supabase.from('allocation_periods').select('*').eq('year', year),
      supabase.from('credit_cards').select('*').order('created_at'),
      supabase.from('credit_card_checks').select('*').eq('year', year),
      supabase.from('categories').select('*').eq('type', 'expense').order('name'),
    ]);
    setAccounts(acctData || []);
    setCategories(catData || []);
    const pMap: Record<string, AllocationPeriod> = {};
    (periodData || []).forEach((p: AllocationPeriod) => { pMap[p.period_key] = p; });
    setPeriods(pMap);
    setCards(cardData || []);
    const cMap: Record<string, boolean> = {};
    (checkData || []).forEach((c: CreditCardCheck) => { cMap[c.card_id + '-' + c.period_key] = c.paid; });
    setCardChecks(cMap);
    setLoading(false);
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Current period index based on today's date
  const currentPeriodIdx = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    if (curYear !== year) return curYear < year ? -1 : PERIODS.length - 1;
    let idx = -1;
    PERIODS.forEach((p, i) => {
      const day = p.half === 0 ? 10 : 25;
      const d = new Date(curYear, p.month, day);
      if (d <= today) idx = i;
    });
    return idx;
  }, [year]);

  const totalPct = accounts.reduce((s, a) => s + Number(a.percentage), 0);
  const unallocated = 100 - totalPct;

  const computed = useMemo(() => {
    const result: Record<string, {
      startAmt: number; allocations: Record<string, number>; acctTotal: number;
      afterAlloc: number; vaultBalance: number; taxBalance: number; isQEnd: boolean; draw: number;
    }> = {};
    let runVault = 0;
    let runTax = 0;

    PERIODS.forEach((p) => {
      const period = periods[p.key];
      const startAmt = Number(period?.starting_amount || 0);
      const allocations: Record<string, number> = {};
      let acctTotal = 0;

      accounts.forEach((a) => {
        const val = Math.round(startAmt * (Number(a.percentage) / 100) * 100) / 100;
        allocations[a.id] = val;
        acctTotal += val;
      });

      acctTotal = Math.round(acctTotal * 100) / 100;
      const afterAlloc = Math.round((startAmt - acctTotal) * 100) / 100;

      accounts.forEach((a) => {
        if (a.tag === 'profit') runVault += allocations[a.id] || 0;
        if (a.tag === 'tax') runTax += allocations[a.id] || 0;
      });

      const draw = Number(period?.vault_draw || 0);
      runVault -= draw;

      result[p.key] = {
        startAmt, allocations, acctTotal, afterAlloc,
        vaultBalance: Math.round(runVault * 100) / 100,
        taxBalance: Math.round(runTax * 100) / 100,
        isQEnd: p.qEnd, draw,
      };
    });
    return result;
  }, [accounts, periods]);

  const totals = useMemo(() => {
    const t = {
      startAmt: 0, acctTotal: 0, afterAlloc: 0, draws: 0,
      acctSums: {} as Record<string, number>, vaultFinal: 0, taxFinal: 0,
    };
    accounts.forEach((a) => { t.acctSums[a.id] = 0; });
    PERIODS.forEach((p) => {
      const c = computed[p.key];
      if (!c) return;
      t.startAmt += c.startAmt;
      t.acctTotal += c.acctTotal;
      t.afterAlloc += c.afterAlloc;
      t.draws += c.draw;
      accounts.forEach((a) => { t.acctSums[a.id] = (t.acctSums[a.id] || 0) + (c.allocations[a.id] || 0); });
    });
    const last = computed[PERIODS[PERIODS.length - 1]?.key];
    t.vaultFinal = last?.vaultBalance || 0;
    t.taxFinal = last?.taxBalance || 0;
    return t;
  }, [computed, accounts]);

  // === Data mutations ===
  async function upsertPeriod(key: string, field: 'starting_amount' | 'vault_draw', value: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const numVal = parseFloat(value) || 0;
    const existing = periods[key];
    if (existing?.id) {
      await supabase.from('allocation_periods').update({ [field]: numVal }).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('allocation_periods')
        .select('id').eq('user_id', user.id).eq('period_key', key).eq('year', year).maybeSingle();
      if (data) {
        await supabase.from('allocation_periods').update({ [field]: numVal }).eq('id', data.id);
      } else {
        await supabase.from('allocation_periods').insert({
          user_id: user.id, period_key: key, year,
          starting_amount: field === 'starting_amount' ? numVal : 0,
          vault_draw: field === 'vault_draw' ? numVal : 0,
        });
      }
    }
    loadData();
  }

  async function handleInlineSave(id: string, field: 'pct' | 'name', value: string) {
    if (field === 'pct') {
      await supabase.from('allocation_accounts').update({ percentage: parseFloat(value) || 0 }).eq('id', id);
    } else {
      await supabase.from('allocation_accounts').update({ name: value }).eq('id', id);
    }
    setInlineEdit(null);
    loadData();
  }

  async function handleAddAcct() {
    if (!newAcct.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('allocation_accounts').insert({
      user_id: user.id, name: newAcct.name,
      percentage: parseFloat(newAcct.pct) || 0,
      tag: newAcct.tag || null,
      category_id: newAcct.category_id || null,
      sort_order: accounts.length,
    });
    setNewAcct({ name: '', pct: '', tag: '', category_id: '' });
    loadData();
  }

  async function handleSaveAcct() {
    if (!editAcct) return;
    await supabase.from('allocation_accounts').update({
      name: editAcct.name, percentage: Number(editAcct.percentage), tag: editAcct.tag,
      category_id: editAcct.category_id || null,
    }).eq('id', editAcct.id);
    setEditAcct(null);
    loadData();
  }

  async function handleDeleteAcct(id: string) {
    await supabase.from('allocation_accounts').delete().eq('id', id);
    setConfirmDel(null);
    loadData();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = accounts.findIndex((a) => a.id === active.id);
    const newIdx = accounts.findIndex((a) => a.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(accounts, oldIdx, newIdx);
    setAccounts(reordered);
    await Promise.all(reordered.map((a, i) =>
      supabase.from('allocation_accounts').update({ sort_order: i }).eq('id', a.id)
    ));
  }

  async function handleToggleCard(cardId: string, periodKey: string) {
    const key = cardId + '-' + periodKey;
    const current = cardChecks[key] || false;
    const { data: existing } = await supabase
      .from('credit_card_checks')
      .select('id')
      .eq('card_id', cardId).eq('period_key', periodKey).eq('year', year)
      .maybeSingle();

    if (existing) {
      await supabase.from('credit_card_checks').update({ paid: !current }).eq('id', existing.id);
    } else {
      await supabase.from('credit_card_checks').insert({
        card_id: cardId, period_key: periodKey, year, paid: true,
      });
    }
    setCardChecks((prev) => ({ ...prev, [key]: !current }));
  }

  async function handleAddCard() {
    if (!newCard.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('credit_cards').insert({ user_id: user.id, name: newCard });
    setNewCard('');
    loadData();
  }

  async function handleDeleteCard(id: string) {
    await supabase.from('credit_cards').delete().eq('id', id);
    setConfirmDel(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading allocations...</div>
      </div>
    );
  }

  // Card colors for credit-card strategy panel — assigned by index
  const CARD_COLORS = [GREEN, MAGENTA, CYAN, '#a78bfa', RED, '#f5a623'];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{'// profit first · allocation grid'}</div>
          <h1
            className="mt-1 text-[22px] font-semibold heading-gradient"
            style={{ letterSpacing: '-0.02em' }}
          >
            Allocations
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Personal allocation system &middot; {year}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Allocated"
          value={totalPct.toFixed(1) + '%'}
          accent={totalPct > 100 ? RED : GREEN}
          sub="of each pay period"
        />
        <Card
          label="Unallocated"
          value={unallocated.toFixed(1) + '%'}
          accent={unallocated < 0 ? RED : '#f5a623'}
          sub="reserve / slack"
        />
        <Card
          label="Accounts"
          value={accounts.length.toString()}
          accent={CYAN}
          sub="allocation buckets"
        />
        <Card
          label="Vault Balance"
          value={totals.vaultFinal > 0 ? formatMoney(totals.vaultFinal) : '—'}
          accent={MAGENTA}
          sub="profit reserve"
        />
      </div>

      {/* Main grid panel */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-hdr">
          <div>
            <div className="eyebrow">{`// allocation grid · ${PERIODS.length} pay periods`}</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Inline-edit % and names · scroll for all periods
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setShowCardMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={2} y={5} width={20} height={14} rx={2} />
                <path d="M2 10h20" />
              </svg>
              Credit cards
            </button>
            <button className="btn amber" onClick={() => setShowAcctMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Manage accounts
            </button>
          </div>
        </div>

        <div style={{ overflow: 'auto', maxHeight: 600 }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="eyebrow" style={{ color: 'var(--text-muted)' }}>Reference %</span>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: 11.5 }}>
                      Account name
                    </span>
                  </div>
                </th>
                {PERIODS.map((p, i) => (
                  <th
                    key={p.key}
                    className={[
                      i === currentPeriodIdx ? 'current' : '',
                      p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                    ].join(' ').trim()}
                    style={{ minWidth: 92 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span>{p.label}</span>
                      {i === currentPeriodIdx && (
                        <span style={{ fontSize: 8, color: 'var(--magenta)', letterSpacing: '0.14em' }}>● CURRENT</span>
                      )}
                      {p.qEnd && i !== currentPeriodIdx && (
                        <span style={{ fontSize: 8, color: 'var(--neon-amber)', letterSpacing: '0.14em' }}>Q END</span>
                      )}
                    </div>
                  </th>
                ))}
                <th style={{ minWidth: 96, background: 'var(--bg-elevated)', color: 'var(--cyan)' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Account rows */}
              {accounts.map((acct) => {
                const isEditingPct = inlineEdit?.id === acct.id && inlineEdit.field === 'pct';
                const isEditingName = inlineEdit?.id === acct.id && inlineEdit.field === 'name';
                return (
                  <tr key={acct.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEditingPct ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.1"
                            className="input"
                            style={{ width: 60, height: 22, fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}
                            defaultValue={acct.percentage}
                            onBlur={(e) => handleInlineSave(acct.id, 'pct', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInlineSave(acct.id, 'pct', (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setInlineEdit(null);
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => setInlineEdit({ id: acct.id, field: 'pct' })}
                            className="pct-badge"
                            style={{ cursor: 'pointer' }}
                            title="Click to edit %"
                          >
                            {Number(acct.percentage) > 0 ? acct.percentage + '%' : '0%'}
                          </span>
                        )}
                        {isEditingName ? (
                          <input
                            autoFocus
                            className="input"
                            style={{ flex: 1, height: 22 }}
                            defaultValue={acct.name}
                            onBlur={(e) => handleInlineSave(acct.id, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInlineSave(acct.id, 'name', (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setInlineEdit(null);
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => setInlineEdit({ id: acct.id, field: 'name' })}
                            style={{ flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title="Click to edit name"
                          >
                            {acct.name}
                          </span>
                        )}
                        {acct.tag && !isEditingName && (
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 8,
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: 3,
                              letterSpacing: '0.06em',
                              color: TAG_COLORS[acct.tag],
                              background: TAG_BG[acct.tag],
                            }}
                          >
                            {TAG_LABELS[acct.tag]}
                          </span>
                        )}
                      </div>
                    </td>
                    {PERIODS.map((p, i) => {
                      const val = computed[p.key]?.allocations[acct.id] || 0;
                      return (
                        <td
                          key={p.key}
                          className={[
                            i === currentPeriodIdx ? 'current' : '',
                            p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                          ].join(' ').trim()}
                          style={{ color: val > 0 ? 'var(--text-secondary)' : 'var(--text-ghost)' }}
                        >
                          {val > 0 ? formatMoney(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="total-col">
                      {(totals.acctSums[acct.id] || 0) > 0 ? formatMoney(totals.acctSums[acct.id]) : '—'}
                    </td>
                  </tr>
                );
              })}

              {/* Accounts Total */}
              <tr className="total">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="pct-badge" style={{ color: 'var(--cyan)' }}>{totalPct.toFixed(1)}%</span>
                    <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>Accounts Total</span>
                  </div>
                </td>
                {PERIODS.map((p, i) => {
                  const v = computed[p.key]?.acctTotal || 0;
                  return (
                    <td
                      key={p.key}
                      className={[
                        i === currentPeriodIdx ? 'current' : '',
                        p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                      ].join(' ').trim()}
                      style={{ color: v > 0 ? 'var(--cyan)' : 'var(--text-ghost)' }}
                    >
                      {v > 0 ? formatMoney(v) : '—'}
                    </td>
                  );
                })}
                <td className="total-col">{totals.acctTotal > 0 ? formatMoney(totals.acctTotal) : '—'}</td>
              </tr>

              {/* Starting Amount */}
              <tr className="divider">
                <td style={{ color: 'var(--neon-amber)' }}>Starting Amount</td>
                {PERIODS.map((p, i) => (
                  <td
                    key={p.key}
                    className={[
                      i === currentPeriodIdx ? 'current' : '',
                      p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                    ].join(' ').trim()}
                    style={{ padding: 4 }}
                  >
                    <input
                      type="number"
                      className="grid-input"
                      value={periods[p.key]?.starting_amount || ''}
                      placeholder="0"
                      onChange={(e) => {
                        setPeriods((prev) => ({
                          ...prev,
                          [p.key]: { ...prev[p.key], starting_amount: parseFloat(e.target.value) || 0 } as AllocationPeriod,
                        }));
                      }}
                      onBlur={(e) => upsertPeriod(p.key, 'starting_amount', e.target.value)}
                    />
                  </td>
                ))}
                <td className="total-col" style={{ color: totals.startAmt > 0 ? 'var(--neon-amber)' : 'var(--text-ghost)' }}>
                  {totals.startAmt > 0 ? formatMoney(totals.startAmt) : '—'}
                </td>
              </tr>

              {/* After Allocations */}
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>After Allocations</td>
                {PERIODS.map((p, i) => {
                  const c = computed[p.key];
                  const v = c?.afterAlloc || 0;
                  return (
                    <td
                      key={p.key}
                      className={[
                        i === currentPeriodIdx ? 'current' : '',
                        p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                      ].join(' ').trim()}
                      style={{
                        color: c?.startAmt > 0 ? (v >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-ghost)',
                      }}
                    >
                      {c?.startAmt > 0 ? formatMoney(v) : '—'}
                    </td>
                  );
                })}
                <td className="total-col" style={{ color: totals.afterAlloc >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totals.startAmt > 0 ? formatMoney(totals.afterAlloc) : '—'}
                </td>
              </tr>

              {/* Vault Balance */}
              <tr className="vault divider">
                <td style={{ color: 'var(--green)' }}>Vault Balance</td>
                {PERIODS.map((p, i) => {
                  const v = computed[p.key]?.vaultBalance || 0;
                  return (
                    <td
                      key={p.key}
                      className={[
                        i === currentPeriodIdx ? 'current' : '',
                        p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                      ].join(' ').trim()}
                      style={{ color: v > 0 ? 'var(--green)' : 'var(--text-ghost)' }}
                    >
                      {v > 0 ? formatMoney(v) : '—'}
                    </td>
                  );
                })}
                <td className="total-col" style={{ color: 'var(--green)' }}>
                  {totals.vaultFinal > 0 ? formatMoney(totals.vaultFinal) : '—'}
                </td>
              </tr>

              {/* Vault Draw */}
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Vault Draw</td>
                {PERIODS.map((p, i) => (
                  <td
                    key={p.key}
                    className={[
                      i === currentPeriodIdx ? 'current' : '',
                      p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                    ].join(' ').trim()}
                    style={{ padding: 4 }}
                  >
                    <input
                      type="number"
                      className="grid-input"
                      style={{ color: 'var(--red)' }}
                      value={periods[p.key]?.vault_draw || ''}
                      placeholder="0"
                      onChange={(e) => {
                        setPeriods((prev) => ({
                          ...prev,
                          [p.key]: { ...prev[p.key], vault_draw: parseFloat(e.target.value) || 0 } as AllocationPeriod,
                        }));
                      }}
                      onBlur={(e) => upsertPeriod(p.key, 'vault_draw', e.target.value)}
                    />
                  </td>
                ))}
                <td className="total-col" style={{ color: totals.draws > 0 ? 'var(--red)' : 'var(--text-ghost)' }}>
                  {totals.draws > 0 ? formatMoney(totals.draws) : '—'}
                </td>
              </tr>

              {/* Profit Distribution (Quarter ends) */}
              <tr className="profit divider">
                <td style={{ color: 'var(--magenta)' }}>Profit Distribution</td>
                {PERIODS.map((p, i) => {
                  const v = computed[p.key]?.vaultBalance || 0;
                  const showQEnd = p.qEnd && v > 0;
                  return (
                    <td
                      key={p.key}
                      className={[
                        i === currentPeriodIdx ? 'current' : '',
                        p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                      ].join(' ').trim()}
                      style={{ color: showQEnd ? 'var(--magenta)' : 'var(--text-ghost)' }}
                    >
                      {showQEnd ? '◆ ' + formatMoney(v) : (p.qEnd ? '◆ QTR' : '—')}
                    </td>
                  );
                })}
                <td className="total-col" style={{ color: 'var(--magenta)' }}>—</td>
              </tr>

              {/* Tax Balance */}
              <tr className="tax">
                <td style={{ color: 'var(--neon-amber)' }}>Tax Acct. Balance</td>
                {PERIODS.map((p, i) => {
                  const v = computed[p.key]?.taxBalance || 0;
                  return (
                    <td
                      key={p.key}
                      className={[
                        i === currentPeriodIdx ? 'current' : '',
                        p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                      ].join(' ').trim()}
                      style={{ color: v > 0 ? 'var(--neon-amber)' : 'var(--text-ghost)' }}
                    >
                      {v > 0 ? formatMoney(v) : '—'}
                    </td>
                  );
                })}
                <td className="total-col" style={{ color: 'var(--neon-amber)' }}>
                  {totals.taxFinal > 0 ? formatMoney(totals.taxFinal) : '—'}
                </td>
              </tr>

              {/* Credit card paid checklist rows */}
              {cards.map((card) => {
                const checkCount = PERIODS.filter((p) => cardChecks[card.id + '-' + p.key]).length;
                return (
                  <tr key={card.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{card.name} Paid</td>
                    {PERIODS.map((p, i) => {
                      const checked = cardChecks[card.id + '-' + p.key];
                      return (
                        <td
                          key={p.key}
                          onClick={() => handleToggleCard(card.id, p.key)}
                          className={[
                            i === currentPeriodIdx ? 'current' : '',
                            p.qEnd && i !== currentPeriodIdx ? 'qend' : '',
                          ].join(' ').trim()}
                          style={{
                            cursor: 'pointer',
                            textAlign: 'center',
                            color: checked ? 'var(--green)' : 'var(--text-ghost)',
                            textShadow: checked
                              ? '0 0 calc(6px * var(--glow-k)) oklch(0.82 0.18 155 / 0.6)'
                              : 'none',
                          }}
                        >
                          {checked ? '✓' : '○'}
                        </td>
                      );
                    })}
                    <td className="total-col" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {checkCount}/{PERIODS.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-disabled)',
          }}
        >
          Scroll horizontally for all {PERIODS.length} pay periods &middot;{' '}
          <span style={{ color: 'var(--magenta)' }}>● CURRENT</span> column marks current period &middot;{' '}
          <span style={{ color: 'var(--neon-amber)' }}>Q END</span> marks quarterly distribution &middot;{' '}
          Click row labels to inline-edit
        </div>
      </div>

      {/* Credit Card Strategy Cards */}
      {cards.length > 0 && (
        <div className="panel mt-4">
          <div className="panel-hdr">
            <div>
              <div className="eyebrow">{'// credit · card · strategy'}</div>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Each card paired to a spending bucket
              </p>
            </div>
            <button className="btn amber" onClick={() => setShowCardMgr(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Manage cards
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ padding: 16 }}>
            {cards.map((card, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              const checkCount = PERIODS.filter((p) => cardChecks[card.id + '-' + p.key]).length;
              const pct = Math.round((checkCount / PERIODS.length) * 100);
              return (
                <div
                  key={card.id}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--panel-2)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 8,
                    padding: 14,
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
                      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                      opacity: 0.12,
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                      <rect x={2} y={5} width={20} height={14} rx={2} />
                      <path d="M2 10h20" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{card.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginBottom: 12 }}>
                    {checkCount} of {PERIODS.length} periods paid
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="eyebrow">Coverage</span>
                    <span
                      className="num"
                      style={{ color, fontSize: 18, fontWeight: 600 }}
                    >
                      {pct}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--border)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        boxShadow: `0 0 calc(6px * var(--glow-k)) ${color}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Account Manager Modal */}
      <Modal
        open={showAcctMgr}
        onClose={() => { setShowAcctMgr(false); setEditAcct(null); setConfirmDel(null); }}
        title="Manage Accounts"
        wide
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="input"
            style={{ flex: 2, minWidth: 120 }}
            placeholder="Account name..."
            value={newAcct.name}
            onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })}
          />
          <input
            className="input"
            style={{ width: 70 }}
            type="number"
            step="0.1"
            placeholder="%"
            value={newAcct.pct}
            onChange={(e) => setNewAcct({ ...newAcct, pct: e.target.value })}
          />
          <select
            className="input"
            style={{ minWidth: 90 }}
            value={newAcct.tag}
            onChange={(e) => setNewAcct({ ...newAcct, tag: e.target.value })}
          >
            <option value="">No tag</option>
            <option value="profit">Profit</option>
            <option value="tax">Tax</option>
          </select>
          <select
            className="input"
            style={{ minWidth: 110 }}
            value={newAcct.category_id}
            onChange={(e) => setNewAcct({ ...newAcct, category_id: e.target.value })}
          >
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            className="btn primary"
            onClick={handleAddAcct}
            disabled={!newAcct.name.trim()}
          >
            + Add
          </button>
        </div>

        <div className="mb-3 eyebrow" style={{ color: totalPct > 100 ? 'var(--red)' : 'var(--text-muted)' }}>
          Total: {totalPct.toFixed(1)}% allocated &middot; {unallocated.toFixed(1)}% unallocated
          {totalPct > 100 && ' — OVER 100%!'}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {accounts.map((acct) => {
              if (editAcct?.id === acct.id) {
                return (
                  <div key={acct.id} className="border-b py-2.5" style={{ borderColor: 'var(--border)' }}>
                    <div className="mb-2 grid grid-cols-[1fr_70px_90px_1fr] gap-2">
                      <input
                        className="input"
                        value={editAcct.name}
                        onChange={(e) => setEditAcct({ ...editAcct, name: e.target.value })}
                      />
                      <input
                        className="input"
                        type="number"
                        step="0.1"
                        value={editAcct.percentage}
                        onChange={(e) => setEditAcct({ ...editAcct, percentage: parseFloat(e.target.value) || 0 })}
                      />
                      <select
                        className="input"
                        value={editAcct.tag || ''}
                        onChange={(e) => setEditAcct({ ...editAcct, tag: (e.target.value || null) as 'profit' | 'tax' | null })}
                      >
                        <option value="">No tag</option>
                        <option value="profit">Profit</option>
                        <option value="tax">Tax</option>
                      </select>
                      <select
                        className="input"
                        value={editAcct.category_id || ''}
                        onChange={(e) => setEditAcct({ ...editAcct, category_id: e.target.value || null })}
                      >
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button className="btn sm" onClick={() => setEditAcct(null)}>Cancel</button>
                      <button className="btn primary sm" onClick={handleSaveAcct}>Save</button>
                    </div>
                  </div>
                );
              }
              return (
                <SortableAccountRow key={acct.id} acct={acct}>
                  <span className="pct-badge" style={{ minWidth: 42, textAlign: 'right' }}>
                    {Number(acct.percentage) > 0 ? acct.percentage + '%' : '0%'}
                  </span>
                  <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    {acct.name}
                    {acct.category_id && (
                      <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                        → {categories.find((c) => c.id === acct.category_id)?.name || ''}
                      </span>
                    )}
                  </span>
                  {acct.tag && (
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: 3,
                        letterSpacing: '0.06em',
                        color: TAG_COLORS[acct.tag],
                        background: TAG_BG[acct.tag],
                      }}
                    >
                      {TAG_LABELS[acct.tag]}
                    </span>
                  )}
                  {confirmDel === acct.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]" style={{ color: 'var(--red)' }}>Delete?</span>
                      <button className="btn red sm" onClick={() => handleDeleteAcct(acct.id)}>Yes</button>
                      <button className="btn sm" onClick={() => setConfirmDel(null)}>No</button>
                    </div>
                  ) : (
                    <>
                      <button className="btn icon sm" onClick={() => setEditAcct({ ...acct })} title="Edit">
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn icon sm" onClick={() => setConfirmDel(acct.id)} title="Delete">
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      </button>
                    </>
                  )}
                </SortableAccountRow>
              );
            })}
          </SortableContext>
        </DndContext>
      </Modal>

      {/* Card Manager Modal */}
      <Modal
        open={showCardMgr}
        onClose={() => { setShowCardMgr(false); setConfirmDel(null); }}
        title="Manage Credit Cards"
      >
        <div className="mb-4 flex gap-2">
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Card name..."
            value={newCard}
            onChange={(e) => setNewCard(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCard(); }}
          />
          <button
            className="btn primary"
            onClick={handleAddCard}
            disabled={!newCard.trim()}
          >
            + Add
          </button>
        </div>
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex items-center gap-2.5 rounded-md px-1 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{card.name}</span>
            {confirmDel === card.id ? (
              <div className="flex items-center gap-1">
                <button className="btn red sm" onClick={() => handleDeleteCard(card.id)}>Yes</button>
                <button className="btn sm" onClick={() => setConfirmDel(null)}>No</button>
              </div>
            ) : (
              <button className="btn icon sm" onClick={() => setConfirmDel(card.id)} title="Delete">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {cards.length === 0 && (
          <div className="py-4 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>
            No credit cards added yet.
          </div>
        )}
      </Modal>
    </div>
  );
}
