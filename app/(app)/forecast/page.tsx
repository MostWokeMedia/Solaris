'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/shared/Card';
import { formatMoney } from '@/lib/utils/money';
import type { Transaction, RecurringBill, Category } from '@/types';

const CYAN = '#22d3ee';
const GREEN = '#34D399';
const RED = '#F87171';
const MAGENTA = '#e879a8';

const panelClass = "rounded-xl border p-5";
const panelStyle = { background: 'var(--card)', borderColor: 'var(--border)' };

type Scenario = 'base' | 'optimistic' | 'pessimistic';

export default function ForecastPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringBills, setRecurringBills] = useState<(RecurringBill & { category?: Category })[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(90);
  const [scenario, setScenario] = useState<Scenario>('base');

  const loadData = useCallback(async () => {
    const [{ data: txns }, { data: bills }] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('recurring_bills').select('*, category:categories(*)').eq('status', 'good'),
    ]);
    setTransactions(txns || []);
    setRecurringBills(bills || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute averages from historical data
  const stats = useMemo(() => {
    if (transactions.length === 0) return { avgDailyIncome: 0, avgDailyExpense: 0, monthlyBills: 0 };
    const months = new Set(transactions.map(t => t.date.slice(0, 7)));
    const numDays = Math.max(1, months.size * 30);
    const income = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const expense = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
    const monthlyBills = recurringBills.reduce((s, b) => s + Number(b.amount), 0);
    return { avgDailyIncome: income / numDays, avgDailyExpense: expense / numDays, monthlyBills };
  }, [transactions, recurringBills]);

  // Generate forecast data points
  const forecast = useMemo(() => {
    const multipliers = {
      base: { income: 1, expense: 1 },
      optimistic: { income: 1.15, expense: 1 },
      pessimistic: { income: 0.82, expense: 1.12 },
    };
    const m = multipliers[scenario];
    const totalIncome = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
    const startBalance = totalIncome - totalExpense;

    const points: { day: number; date: string; balance: number }[] = [];
    let balance = startBalance;
    const today = new Date();

    for (let d = 0; d <= horizon; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().slice(5, 10).replace('-', '/');

      if (d > 0) {
        balance += stats.avgDailyIncome * m.income;
        balance -= stats.avgDailyExpense * m.expense;

        // Add recurring bill hits on due dates
        const dayOfMonth = date.getDate();
        recurringBills.forEach(b => {
          const dueDay = b.due_date ? new Date(b.due_date).getDate() : 0;
          if (dueDay === dayOfMonth) {
            balance -= Number(b.amount) * m.expense;
          }
        });
      }

      points.push({ day: d, date: dateStr, balance: Math.round(balance * 100) / 100 });
    }

    return points;
  }, [transactions, recurringBills, stats, horizon, scenario]);

  const startBalance = forecast[0]?.balance || 0;
  const endBalance = forecast[forecast.length - 1]?.balance || 0;
  const lowestPoint = Math.min(...forecast.map(p => p.balance));
  const riskDays = forecast.filter(p => p.balance < 500).length;

  // SVG chart dimensions
  const W = 1040, H = 300, PAD = 50;
  const maxBal = Math.max(...forecast.map(p => p.balance), 1000);
  const minBal = Math.min(...forecast.map(p => p.balance), 0);
  const range = maxBal - minBal || 1;

  function toX(i: number) { return PAD + (i / Math.max(1, forecast.length - 1)) * (W - PAD * 2); }
  function toY(v: number) { return PAD + (1 - (v - minBal) / range) * (H - PAD * 2); }

  const linePath = forecast.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(p.balance).toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${toX(forecast.length - 1).toFixed(1)} ${(H - PAD).toFixed(1)} L${PAD} ${(H - PAD).toFixed(1)} Z`;
  const riskY = toY(500);

  // Upcoming events (next 14 days of recurring bills)
  const upcomingEvents = useMemo(() => {
    const events: { name: string; date: string; daysOut: number; amount: number; type: 'expense' | 'income' }[] = [];
    const today = new Date();
    for (let d = 1; d <= 14; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dayOfMonth = date.getDate();
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      recurringBills.forEach(b => {
        const dueDay = b.due_date ? new Date(b.due_date).getDate() : 0;
        if (dueDay === dayOfMonth) {
          events.push({ name: b.name, date: dateStr, daysOut: d, amount: Number(b.amount), type: 'expense' });
        }
      });

      // Weekly income assumption
      if (date.getDay() === 5) {
        events.push({ name: 'Projected Income', date: dateStr, daysOut: d, amount: stats.avgDailyIncome * 7, type: 'income' });
      }
    }
    return events.sort((a, b) => a.daysOut - b.daysOut);
  }, [recurringBills, stats]);

  if (loading) return <div className="flex h-64 items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading forecast...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1 text-[22px] font-semibold heading-gradient" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
          Forecast
        </h1>
        <p className="text-[12.5px]" style={{ color: 'var(--text-disabled)' }}>Projected cash flow with scenarios</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Starting Balance" value={formatMoney(startBalance)} accent={CYAN} />
        <Card label={`Projected (${horizon}d)`} value={formatMoney(endBalance)} accent={endBalance >= startBalance ? GREEN : RED} />
        <Card label="Lowest Point" value={formatMoney(lowestPoint)} accent={lowestPoint < 500 ? RED : GREEN} />
        <Card label="Risk Days (<$500)" value={String(riskDays)} accent={riskDays > 0 ? RED : GREEN} sub={riskDays > 0 ? 'Action needed' : 'Clear'} />
      </div>

      {/* Chart Panel */}
      <div className={panelClass} style={panelStyle}>
        <div className="mb-4 flex items-center justify-between">
          <div className="eyebrow" style={{ color: 'var(--magenta, oklch(0.72 0.22 340))' }}>// cash flow &middot; projection</div>
          <div className="flex gap-2">
            {/* Scenario selector */}
            {(['base', 'optimistic', 'pessimistic'] as Scenario[]).map(s => (
              <button key={s} onClick={() => setScenario(s)}
                className="rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize"
                style={{
                  background: scenario === s ? 'oklch(0.72 0.22 340 / 0.1)' : 'transparent',
                  color: scenario === s ? MAGENTA : 'var(--text-muted)',
                  border: scenario === s ? '1px solid oklch(0.72 0.22 340 / 0.5)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>{s}</button>
            ))}
            <div style={{ width: 1, background: 'var(--border-strong)', margin: '0 4px' }} />
            {/* Horizon selector */}
            {[30, 60, 90, 180].map(h => (
              <button key={h} onClick={() => setHorizon(h)}
                className="rounded-md px-2 py-1 text-[10px] font-semibold"
                style={{
                  background: horizon === h ? 'var(--amber-soft)' : 'transparent',
                  color: horizon === h ? 'var(--amber-hover)' : 'var(--text-muted)',
                  border: horizon === h ? '1px solid var(--amber)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>{h}d</button>
            ))}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600, height: 300 }}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MAGENTA} stopOpacity={0.3} />
                <stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
              </linearGradient>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Risk zone */}
            {minBal < 500 && (
              <>
                <rect x={PAD} y={riskY} width={W - PAD * 2} height={H - PAD - riskY} fill={RED} opacity={0.06} />
                <line x1={PAD} y1={riskY} x2={W - PAD} y2={riskY} stroke={RED} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                <text x={W - PAD - 4} y={riskY - 4} textAnchor="end" fill={RED} fontSize={9} fontFamily="JetBrains Mono" opacity={0.7}>$500 RISK</text>
              </>
            )}

            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const val = minBal + pct * range;
              return (
                <text key={pct} x={PAD - 8} y={toY(val) + 3} textAnchor="end" fill="#5d6274" fontSize={9} fontFamily="JetBrains Mono">
                  ${Math.round(val / 1000)}k
                </text>
              );
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#forecastGrad)" />

            {/* Line */}
            <path d={linePath} fill="none" stroke={MAGENTA} strokeWidth={2} filter="url(#lineGlow)" />

            {/* Lowest point marker */}
            {(() => {
              const lowIdx = forecast.findIndex(p => p.balance === lowestPoint);
              if (lowIdx < 0) return null;
              return (
                <g>
                  <circle cx={toX(lowIdx)} cy={toY(lowestPoint)} r={4} fill={RED} />
                  <text x={toX(lowIdx)} y={toY(lowestPoint) - 10} textAnchor="middle" fill={RED} fontSize={9} fontFamily="JetBrains Mono" fontWeight={600}>LOW</text>
                </g>
              );
            })()}

            {/* X-axis month ticks */}
            {forecast.filter((_, i) => i % Math.max(1, Math.floor(forecast.length / 6)) === 0).map((p, i) => (
              <text key={i} x={toX(p.day)} y={H - PAD + 18} textAnchor="middle" fill="#5d6274" fontSize={9} fontFamily="JetBrains Mono">
                {p.date}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* Upcoming Events */}
        <div className={panelClass} style={panelStyle}>
          <div className="eyebrow mb-4" style={{ color: 'var(--amber)' }}>// upcoming events &middot; next 14 days</div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {upcomingEvents.length === 0 && (
              <div className="py-6 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>No upcoming events in the next 14 days.</div>
            )}
            {upcomingEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--card-hover)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="min-w-[60px]">
                  <div className="text-[11px] font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>{ev.date}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>{ev.daysOut}d out</div>
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{ev.name}</div>
                </div>
                <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{
                  color: ev.type === 'income' ? GREEN : RED,
                  background: ev.type === 'income' ? 'oklch(0.82 0.18 155 / 0.1)' : 'oklch(0.70 0.22 25 / 0.1)',
                  border: `1px solid ${ev.type === 'income' ? 'oklch(0.82 0.18 155 / 0.35)' : 'oklch(0.70 0.22 25 / 0.35)'}`,
                }}>{ev.type === 'income' ? 'IN' : 'OUT'}</span>
                <div className="min-w-[80px] text-right text-[12.5px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: ev.type === 'income' ? GREEN : RED }}>
                  {ev.type === 'income' ? '+' : '-'}{formatMoney(ev.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className={panelClass} style={panelStyle}>
          <div className="eyebrow mb-4" style={{ color: 'oklch(0.72 0.22 340)' }}>// scenario insights</div>
          <p className="mb-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Under the <strong style={{ color: 'var(--text)' }}>{scenario}</strong> scenario over {horizon} days, your balance
            {endBalance >= startBalance
              ? <> grows by <span style={{ fontFamily: "'JetBrains Mono', monospace", color: GREEN }}>{formatMoney(endBalance - startBalance)}</span>.</>
              : <> declines by <span style={{ fontFamily: "'JetBrains Mono', monospace", color: RED }}>{formatMoney(Math.abs(endBalance - startBalance))}</span>.</>
            }
            {lowestPoint < 500 && <> You hit a low of <span style={{ fontFamily: "'JetBrains Mono', monospace", color: RED }}>{formatMoney(lowestPoint)}</span> — below the $500 risk threshold.</>}
          </p>

          <div className="space-y-3">
            {riskDays > 0 && (
              <div className="flex gap-3 rounded-lg border p-3" style={{ background: 'var(--bg-elevated)', borderColor: 'oklch(0.70 0.22 25 / 0.3)', borderLeft: '2px solid var(--red)' }}>
                <span style={{ color: RED }}>&#x26A0;</span>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>Risk Warning</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{riskDays} day{riskDays !== 1 ? 's' : ''} below $500. Consider reducing discretionary spending.</div>
                </div>
              </div>
            )}
            <div className="flex gap-3 rounded-lg border p-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderLeft: '2px solid var(--amber)' }}>
              <span style={{ color: CYAN }}>&#x24D8;</span>
              <div>
                <div className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>Monthly Committed</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  {formatMoney(stats.monthlyBills)} in recurring bills locks {stats.avgDailyIncome > 0 ? Math.round((stats.monthlyBills / (stats.avgDailyIncome * 30)) * 100) : 0}% of projected income.
                </div>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border p-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderLeft: '2px solid oklch(0.82 0.18 155)' }}>
              <span style={{ color: GREEN }}>&#x26A1;</span>
              <div>
                <div className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>Avg Daily Pace</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  In: {formatMoney(stats.avgDailyIncome)}/day &middot; Out: {formatMoney(stats.avgDailyExpense)}/day &middot; Net: <span style={{ color: stats.avgDailyIncome - stats.avgDailyExpense >= 0 ? GREEN : RED }}>{formatMoney(stats.avgDailyIncome - stats.avgDailyExpense)}/day</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
