'use client';

import Link from 'next/link';

type PageHeaderProps = {
  title: string;
  eyebrow: string;
  subtitle?: string;
};

export default function PageHeader({ title, eyebrow, subtitle }: PageHeaderProps) {
  function openAskAI() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-start justify-between gap-3"
      style={{
        padding: '18px 0',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, var(--bg-elevated), transparent)',
      }}
    >
      {/* Title cluster: title + inline eyebrow + subtitle */}
      <div>
        <div className="flex items-baseline gap-3">
          <h1
            className="text-[22px] font-semibold"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          <span className="eyebrow" style={{ color: 'var(--cyan)' }}>{eyebrow}</span>
        </div>
        {subtitle && (
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-disabled)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right toolbar */}
      <div className="flex items-center gap-2">
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Alerts
          <span
            className="inline-flex items-center justify-center rounded px-1.5 text-[9px] font-bold"
            style={{
              background: 'var(--amber-soft)',
              color: 'var(--cyan)',
              border: '1px solid oklch(0.85 0.15 200 / 0.3)',
              minWidth: 18,
              height: 18,
            }}
          >
            3
          </span>
        </Link>

        <button
          onClick={openAskAI}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: 'oklch(0.85 0.15 200 / 0.08)',
            border: '1px solid oklch(0.85 0.15 200 / 0.4)',
            color: 'var(--cyan)',
            cursor: 'pointer',
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Ask
          <span
            className="rounded px-1.5 py-0.5 text-[9px]"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-disabled)',
              border: '1px solid var(--border)',
              background: 'var(--panel-2)',
            }}
          >
            ⌘K
          </span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-strong)', margin: '0 4px' }} />

        <div
          className="inline-flex items-center gap-2 rounded-full px-2 py-1"
          style={{ border: '1px solid var(--border-strong)', background: 'var(--panel-2)' }}
        >
          <div
            className="flex items-center justify-center rounded-full text-[11px] font-bold"
            style={{
              width: 24,
              height: 24,
              background: 'linear-gradient(135deg, oklch(0.72 0.22 340), oklch(0.82 0.16 80))',
              color: 'var(--bg)',
            }}
          >
            S
          </div>
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>mostwokemedia</span>
        </div>
      </div>
    </div>
  );
}
