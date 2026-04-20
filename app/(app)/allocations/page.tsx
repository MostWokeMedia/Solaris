'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import { formatMoney } from '@/lib/utils/money';
import type { AllocationAccount, AllocationPeriod, CreditCard, CreditCardCheck, Category } from '@/types';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIODS: { key: string; label: string; month: number; half: number; qEnd: boolean }[] = [];
for (let m = 0; m < 12; m++) {
  PERIODS.push({ key: m + '-10', label: MN[m] + ' 10th', month: m, half: 0, qEnd: false });
  PERIODS.push({ key: m + '-25', label: MN[m] + ' 25th', month: m, half: 1, qEnd: m === 2 || m === 5 || m === 8 || m === 11 });
}

const TAG_COLORS: Record<string, string> = { profit: '#34D399', tax: '#F59E0B' };
const TAG_LABELS: Record<string, string> = { profit: 'PROFIT', tax: 'TAX' };

const inputStyle = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors";
const inputColors = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' };

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
    const t = { startAmt: 0, acctTotal: 0, afterAlloc: 0, draws: 0, acctSums: {} as Record<string, number>, vaultFinal: 0, taxFinal: 0 };
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

  async function handleMoveAcct(id: string, direction: 'up' | 'down') {
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= accounts.length) return;
    const a = accounts[idx], b = accounts[swapIdx];
    await Promise.all([
      supabase.from('allocation_accounts').update({ sort_order: swapIdx }).eq('id', a.id),
      supabase.from('allocation_accounts').update({ sort_order: idx }).eq('id', b.id),
    ]);
    loadData();
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

  const gridCols = `200px repeat(${PERIODS.length}, 100px) 110px`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading allocations...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
            <span className="heading-gradient">Profit First</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Personal Allocation System &middot; {year}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAcctMgr(true)}
            className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
            style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer' }}>
            Manage Accounts
          </button>
          <button onClick={() => setShowCardMgr(true)}
            className="rounded-lg border-none px-4 py-2 text-xs font-semibold text-white"
            style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)', color: 'var(--amber)', cursor: 'pointer' }}>
            Credit Cards
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { label: 'Allocated', value: totalPct.toFixed(1) + '%', color: totalPct > 100 ? 'var(--red)' : 'var(--green)' },
          { label: 'Unallocated', value: unallocated.toFixed(1) + '%', color: unallocated < 0 ? 'var(--red)' : 'var(--text-secondary)' },
          { label: 'Accounts', value: accounts.length.toString(), color: 'var(--text)' },
          { label: 'Vault Balance', value: formatMoney(computed[PERIODS[PERIODS.length - 1]?.key]?.vaultBalance || 0), color: 'var(--green)' },
        ].map((c, i) => (
          <div key={i} className="min-w-[140px] flex-1 rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
            <div className="mt-0.5 text-xl font-bold" style={{ fontFamily: "'Space Mono', monospace", color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 200 + PERIODS.length * 100 + 110 }}>

            {/* Header Row */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '2px solid #1E293B' }}>
              <div className="sticky left-0 z-[2] px-3 py-3 text-[11px] font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                <div>Reference %</div>
                <div className="mt-0.5">Account Name</div>
              </div>
              {PERIODS.map((p) => (
                <div key={p.key} className="px-1.5 py-2 text-center text-[10px] font-semibold"
                  style={{
                    background: p.qEnd ? '#1A1A2E' : '#0F1629',
                    color: p.qEnd ? '#F59E0B' : '#64748B',
                    borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                  }}>
                  {p.label}
                  {p.qEnd && <div className="mt-0.5 text-[8px]" style={{ color: 'var(--amber)' }}>Q END</div>}
                </div>
              ))}
              <div className="px-1.5 py-2 text-center text-[11px] font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderLeft: '2px solid var(--amber)' }}>
                Totals:
              </div>
            </div>

            {/* Account Rows */}
            {accounts.map((acct) => {
              const isEditingPct = inlineEdit?.id === acct.id && inlineEdit.field === 'pct';
              const isEditingName = inlineEdit?.id === acct.id && inlineEdit.field === 'name';
              return (
                <div key={acct.id} style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="sticky left-0 z-[1] flex items-center gap-1.5 px-2 py-1" style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
                    {isEditingPct ? (
                      <input autoFocus type="number" step="0.1"
                        className="w-[50px] rounded border px-1.5 py-1 text-right text-[11px] outline-none"
                        style={{ ...inputColors, fontFamily: "'Space Mono', monospace" }}
                        defaultValue={acct.percentage}
                        onBlur={(e) => handleInlineSave(acct.id, 'pct', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleInlineSave(acct.id, 'pct', (e.target as HTMLInputElement).value); if (e.key === 'Escape') setInlineEdit(null); }}
                      />
                    ) : (
                      <span onClick={() => setInlineEdit({ id: acct.id, field: 'pct' })}
                        className="min-w-[38px] cursor-pointer border-b border-dashed py-0.5 text-right text-[11px]"
                        style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)', borderColor: '#334155' }}
                        title="Click to edit %">
                        {Number(acct.percentage) > 0 ? acct.percentage + '%' : '0%'}
                      </span>
                    )}
                    {isEditingName ? (
                      <input autoFocus
                        className="flex-1 rounded border px-1.5 py-1 text-xs outline-none"
                        style={inputColors}
                        defaultValue={acct.name}
                        onBlur={(e) => handleInlineSave(acct.id, 'name', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleInlineSave(acct.id, 'name', (e.target as HTMLInputElement).value); if (e.key === 'Escape') setInlineEdit(null); }}
                      />
                    ) : (
                      <span onClick={() => setInlineEdit({ id: acct.id, field: 'name' })}
                        className="flex-1 cursor-pointer border-b border-dashed py-0.5 text-xs font-medium"
                        style={{ color: 'var(--text)', borderColor: '#334155' }}
                        title="Click to edit name">
                        {acct.name}
                      </span>
                    )}
                    {acct.tag && !isEditingName && (
                      <span className="rounded px-1.5 py-0.5 text-[8px] font-bold"
                        style={{ color: TAG_COLORS[acct.tag], background: TAG_COLORS[acct.tag] + '22' }}>
                        {TAG_LABELS[acct.tag]}
                      </span>
                    )}
                  </div>
                  {PERIODS.map((p) => {
                    const val = computed[p.key]?.allocations[acct.id] || 0;
                    return (
                      <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-medium"
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          color: val > 0 ? '#E2E8F0' : '#334155',
                          borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                        }}>
                        {val > 0 ? formatMoney(val) : '\u2014'}
                      </div>
                    );
                  })}
                  <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      color: (totals.acctSums[acct.id] || 0) > 0 ? '#E2E8F0' : '#334155',
                      borderLeft: '2px solid var(--amber)', background: 'var(--bg-elevated)',
                    }}>
                    {(totals.acctSums[acct.id] || 0) > 0 ? formatMoney(totals.acctSums[acct.id]) : '\u2014'}
                  </div>
                </div>
              );
            })}

            {/* Accounts Total */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderTop: '2px solid #1E293B', borderBottom: '1px solid #1E293B', background: 'var(--bg-elevated)' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
                <span className="mr-2 text-[11px]" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)' }}>{totalPct.toFixed(1)}%</span>
                Accounts Total
              </div>
              {PERIODS.map((p) => {
                const v = computed[p.key]?.acctTotal || 0;
                return (
                  <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-bold"
                    style={{ fontFamily: "'Space Mono', monospace", color: v > 0 ? '#F87171' : '#334155', borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)' }}>
                    {v > 0 ? formatMoney(v) : '\u2014'}
                  </div>
                );
              })}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: totals.acctTotal > 0 ? '#F87171' : '#334155', borderLeft: '2px solid var(--amber)' }}>
                {totals.acctTotal > 0 ? formatMoney(totals.acctTotal) : '\u2014'}
              </div>
            </div>

            {/* Spacer */}
            <div className="h-2" style={{ background: '#0A0E17' }} />

            {/* Starting Amount */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B', background: '#1F1405' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-bold" style={{ color: 'var(--amber)', background: '#1F1405', borderRight: '1px solid var(--border)' }}>
                Starting Amount
              </div>
              {PERIODS.map((p) => (
                <div key={p.key} className="px-1 py-1" style={{ borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)' }}>
                  <input type="number"
                    className="w-full rounded border px-1.5 py-1 text-right text-[11px] outline-none"
                    style={{ ...inputColors, fontFamily: "'Space Mono', monospace" }}
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
                </div>
              ))}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: totals.startAmt > 0 ? '#3B82F6' : '#334155', borderLeft: '2px solid var(--amber)', background: '#1F1405' }}>
                {totals.startAmt > 0 ? formatMoney(totals.startAmt) : '\u2014'}
              </div>
            </div>

            {/* After Allocations */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)', background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
                After Allocations
              </div>
              {PERIODS.map((p) => {
                const c = computed[p.key];
                const v = c?.afterAlloc || 0;
                return (
                  <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-semibold"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      color: c?.startAmt > 0 ? (v >= 0 ? '#34D399' : '#F87171') : '#334155',
                      borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                    }}>
                    {c?.startAmt > 0 ? formatMoney(v) : '\u2014'}
                  </div>
                );
              })}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: totals.afterAlloc >= 0 ? '#34D399' : '#F87171', borderLeft: '2px solid var(--amber)', background: 'var(--bg-elevated)' }}>
                {totals.startAmt > 0 ? formatMoney(totals.afterAlloc) : '\u2014'}
              </div>
            </div>

            <div className="h-2" style={{ background: '#0A0E17' }} />

            {/* Vault Balance */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B', background: '#0D2818' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-bold" style={{ color: 'var(--green)', background: '#0D2818', borderRight: '1px solid var(--border)' }}>
                Vault Balance
              </div>
              {PERIODS.map((p) => {
                const v = computed[p.key]?.vaultBalance || 0;
                return (
                  <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-bold"
                    style={{ fontFamily: "'Space Mono', monospace", color: 'var(--green)', borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)' }}>
                    {v > 0 ? formatMoney(v) : '\u2014'}
                  </div>
                );
              })}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: 'var(--green)', borderLeft: '2px solid var(--amber)', background: '#0D2818' }}>
                {totals.vaultFinal > 0 ? formatMoney(totals.vaultFinal) : '\u2014'}
              </div>
            </div>

            {/* Vault Draw */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)', background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
                Vault Draw
              </div>
              {PERIODS.map((p) => (
                <div key={p.key} className="px-1 py-1" style={{ borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)' }}>
                  <input type="number"
                    className="w-full rounded border px-1.5 py-1 text-right text-[11px] outline-none"
                    style={{ ...inputColors, fontFamily: "'Space Mono', monospace" }}
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
                </div>
              ))}
              <div className="px-1.5 py-2 text-right text-[11px] font-semibold"
                style={{ fontFamily: "'Space Mono', monospace", color: totals.draws > 0 ? '#F87171' : '#334155', borderLeft: '2px solid var(--amber)', background: 'var(--bg-elevated)' }}>
                {totals.draws > 0 ? formatMoney(totals.draws) : '\u2014'}
              </div>
            </div>

            {/* Profit Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B', background: '#1A1A2E' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-bold" style={{ color: 'var(--amber)', background: '#1A1A2E', borderRight: '1px solid var(--border)' }}>
                Profit Distribution
              </div>
              {PERIODS.map((p) => {
                const v = computed[p.key]?.vaultBalance || 0;
                return (
                  <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-bold"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      color: p.qEnd && v > 0 ? '#F59E0B' : '#334155',
                      borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                    }}>
                    {p.qEnd && v > 0 ? formatMoney(v) : '\u2014'}
                  </div>
                );
              })}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: 'var(--amber)', borderLeft: '2px solid var(--amber)', background: '#1A1A2E' }}>
                {'\u2014'}
              </div>
            </div>

            {/* Tax Balance */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #1E293B', background: '#1A1500' }}>
              <div className="sticky left-0 z-[1] px-3 py-2 text-xs font-bold" style={{ color: 'var(--amber)', background: '#1A1500', borderRight: '1px solid var(--border)' }}>
                Tax Acct. Balance
              </div>
              {PERIODS.map((p) => {
                const v = computed[p.key]?.taxBalance || 0;
                return (
                  <div key={p.key} className="px-1.5 py-2 text-right text-[11px] font-semibold"
                    style={{ fontFamily: "'Space Mono', monospace", color: 'var(--amber)', borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)' }}>
                    {v > 0 ? formatMoney(v) : '\u2014'}
                  </div>
                );
              })}
              <div className="px-1.5 py-2 text-right text-[11px] font-bold"
                style={{ fontFamily: "'Space Mono', monospace", color: 'var(--amber)', borderLeft: '2px solid var(--amber)', background: '#1A1500' }}>
                {totals.taxFinal > 0 ? formatMoney(totals.taxFinal) : '\u2014'}
              </div>
            </div>

            <div className="h-2" style={{ background: '#0A0E17' }} />

            {/* Credit Card Checklist */}
            {cards.map((card) => {
              const checkCount = PERIODS.filter((p) => cardChecks[card.id + '-' + p.key]).length;
              return (
                <div key={card.id} style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="sticky left-0 z-[1] flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                    style={{ color: 'var(--text-secondary)', background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
                    {card.name} Paid
                  </div>
                  {PERIODS.map((p) => {
                    const checked = cardChecks[card.id + '-' + p.key];
                    return (
                      <div key={p.key}
                        onClick={() => handleToggleCard(card.id, p.key)}
                        className="cursor-pointer px-1.5 py-1.5 text-center text-[13px]"
                        style={{
                          color: checked ? '#34D399' : '#334155',
                          borderLeft: p.half === 0 ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                        }}>
                        {checked ? '\u2713' : '\u25CB'}
                      </div>
                    );
                  })}
                  <div className="px-1.5 py-1.5 text-center text-[10px]"
                    style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)', borderLeft: '2px solid var(--amber)', background: 'var(--bg-elevated)' }}>
                    {checkCount}/{PERIODS.length}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px]" style={{ color: 'var(--text-disabled)' }}>
        Scroll horizontally for all 26 pay periods &middot; Q END columns mark quarterly distribution points
      </p>

      {/* Account Manager Modal */}
      <Modal open={showAcctMgr} onClose={() => { setShowAcctMgr(false); setEditAcct(null); setConfirmDel(null); }} title="Manage Accounts">
        <div className="mb-4 flex flex-wrap gap-2">
          <input className={inputStyle + ' min-w-[120px] flex-[2]'} style={inputColors} placeholder="Account name..." value={newAcct.name}
            onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })} />
          <input className={inputStyle + ' w-[70px] flex-none'} style={inputColors} type="number" step="0.1" placeholder="%"
            value={newAcct.pct} onChange={(e) => setNewAcct({ ...newAcct, pct: e.target.value })} />
          <select className={inputStyle + ' w-auto min-w-[80px]'} style={{ ...inputColors, cursor: 'pointer' }}
            value={newAcct.tag} onChange={(e) => setNewAcct({ ...newAcct, tag: e.target.value })}>
            <option value="">No tag</option>
            <option value="profit">Profit</option>
            <option value="tax">Tax</option>
          </select>
          <select className={inputStyle + ' w-auto min-w-[100px]'} style={{ ...inputColors, cursor: 'pointer' }}
            value={newAcct.category_id} onChange={(e) => setNewAcct({ ...newAcct, category_id: e.target.value })}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={handleAddAcct}
            className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer', opacity: newAcct.name.trim() ? 1 : 0.4 }}>
            + Add
          </button>
        </div>

        <div className="mb-3 text-[10px] font-semibold" style={{ color: totalPct > 100 ? 'var(--red)' : 'var(--text-muted)' }}>
          Total: {totalPct.toFixed(1)}% allocated &middot; {unallocated.toFixed(1)}% unallocated
          {totalPct > 100 && ' \u2014 OVER 100%!'}
        </div>

        {accounts.map((acct) => {
          if (editAcct?.id === acct.id) {
            return (
              <div key={acct.id} className="border-b py-2.5" style={{ borderColor: '#1E293B22' }}>
                <div className="mb-2 grid grid-cols-[1fr_70px_90px_1fr] gap-2">
                  <input className={inputStyle} style={inputColors} value={editAcct.name}
                    onChange={(e) => setEditAcct({ ...editAcct, name: e.target.value })} />
                  <input className={inputStyle} style={inputColors} type="number" step="0.1" value={editAcct.percentage}
                    onChange={(e) => setEditAcct({ ...editAcct, percentage: parseFloat(e.target.value) || 0 })} />
                  <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={editAcct.tag || ''}
                    onChange={(e) => setEditAcct({ ...editAcct, tag: (e.target.value || null) as 'profit' | 'tax' | null })}>
                    <option value="">No tag</option>
                    <option value="profit">Profit</option>
                    <option value="tax">Tax</option>
                  </select>
                  <select className={inputStyle} style={{ ...inputColors, cursor: 'pointer' }} value={editAcct.category_id || ''}
                    onChange={(e) => setEditAcct({ ...editAcct, category_id: e.target.value || null })}>
                    <option value="">No category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditAcct(null)}
                    className="rounded border px-3 py-1 text-[11px] font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSaveAcct}
                    className="rounded border-none px-3 py-1 text-[11px] font-semibold text-white"
                    style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            );
          }
          return (
            <div key={acct.id} className="flex items-center gap-2.5 rounded-md px-1 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="min-w-[45px] text-right text-xs" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)' }}>
                {Number(acct.percentage) > 0 ? acct.percentage + '%' : '0%'}
              </span>
              <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                {acct.name}
                {acct.category_id && (
                  <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                    &rarr; {categories.find((c) => c.id === acct.category_id)?.name || ''}
                  </span>
                )}
              </span>
              {acct.tag && (
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold"
                  style={{ color: TAG_COLORS[acct.tag], background: TAG_COLORS[acct.tag] + '22' }}>
                  {TAG_LABELS[acct.tag]}
                </span>
              )}
              {confirmDel === acct.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px]" style={{ color: 'var(--red)' }}>Delete?</span>
                  <button onClick={() => handleDeleteAcct(acct.id)}
                    className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}>Yes</button>
                  <button onClick={() => setConfirmDel(null)}
                    className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>No</button>
                </div>
              ) : (
                <>
                  <button onClick={() => handleMoveAcct(acct.id, 'up')} disabled={accounts.indexOf(acct) === 0}
                    className="border-none bg-transparent px-1 py-0.5 text-xs" style={{ color: accounts.indexOf(acct) === 0 ? 'var(--text-disabled)' : 'var(--text-muted)', cursor: accounts.indexOf(acct) === 0 ? 'default' : 'pointer' }}>&uarr;</button>
                  <button onClick={() => handleMoveAcct(acct.id, 'down')} disabled={accounts.indexOf(acct) === accounts.length - 1}
                    className="border-none bg-transparent px-1 py-0.5 text-xs" style={{ color: accounts.indexOf(acct) === accounts.length - 1 ? 'var(--text-disabled)' : 'var(--text-muted)', cursor: accounts.indexOf(acct) === accounts.length - 1 ? 'default' : 'pointer' }}>&darr;</button>
                  <button onClick={() => setEditAcct({ ...acct })}
                    className="border-none bg-transparent px-1.5 py-0.5 text-xs" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>&#x270E;</button>
                  <button onClick={() => setConfirmDel(acct.id)}
                    className="border-none bg-transparent px-1.5 py-0.5 text-xs" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>&#x2715;</button>
                </>
              )}
            </div>
          );
        })}
      </Modal>

      {/* Card Manager Modal */}
      <Modal open={showCardMgr} onClose={() => { setShowCardMgr(false); setConfirmDel(null); }} title="Manage Credit Cards">
        <div className="mb-4 flex gap-2">
          <input className={inputStyle + ' flex-1'} style={inputColors} placeholder="Card name..." value={newCard}
            onChange={(e) => setNewCard(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCard(); }} />
          <button onClick={handleAddCard}
            className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--amber)', color: '#0A0A0B', cursor: 'pointer', opacity: newCard.trim() ? 1 : 0.4 }}>
            + Add
          </button>
        </div>
        {cards.map((card) => (
          <div key={card.id} className="flex items-center gap-2.5 rounded-md px-1 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{card.name}</span>
            {confirmDel === card.id ? (
              <div className="flex items-center gap-1">
                <button onClick={() => handleDeleteCard(card.id)}
                  className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}>Yes</button>
                <button onClick={() => setConfirmDel(null)}
                  className="rounded border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(card.id)}
                className="border-none bg-transparent px-1.5 py-0.5 text-xs" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>&#x2715;</button>
            )}
          </div>
        ))}
        {cards.length === 0 && (
          <div className="py-4 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>No credit cards added yet.</div>
        )}
      </Modal>
    </div>
  );
}
