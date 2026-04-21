'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { href: '/allocations', label: 'Allocations', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/transactions', label: 'Transactions', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href: '/recurring', label: 'Recurring', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('solaris.sidebar');
    if (saved === 'expanded') setExpanded(true);
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem('solaris.sidebar', next ? 'expanded' : 'collapsed');
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg border p-2 md:hidden"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r transition-all duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          width: expanded ? 220 : 60,
          background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center border-b"
          style={{ height: 58, borderColor: 'var(--border)', padding: expanded ? '0 16px' : '0' }}
        >
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-3"
            style={{ border: 'none', background: 'none', cursor: 'pointer', width: expanded ? 'auto' : 60, justifyContent: expanded ? 'flex-start' : 'center' }}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <div
              className="flex shrink-0 items-center justify-center rounded-lg"
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.72 0.22 340))',
                borderRadius: 7,
                boxShadow: '0 0 12px oklch(0.82 0.16 80 / 0.3), 0 0 1px oklch(0.82 0.16 80 / 0.6)',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bg)' }} />
            </div>
            {expanded && (
              <span className="text-sm font-bold heading-gradient" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Solaris
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5" style={{ padding: '12px 10px' }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={expanded ? undefined : item.label}
                className="flex items-center rounded-lg transition-all duration-150"
                style={{
                  height: 38,
                  padding: expanded ? '0 12px' : '0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  gap: 10,
                  background: active ? 'var(--amber-soft)' : 'transparent',
                  color: active ? 'var(--amber)' : 'var(--text-muted)',
                  border: active ? '1px solid oklch(0.85 0.15 200 / 0.3)' : '1px solid transparent',
                  boxShadow: active ? 'var(--amber-glow)' : 'none',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <svg className="shrink-0" width={17} height={17} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {expanded && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t" style={{ borderColor: 'var(--border)', padding: 10 }}>
          <button
            onClick={handleSignOut}
            title={expanded ? undefined : 'Sign Out'}
            className="flex w-full items-center rounded-lg transition-colors"
            style={{
              height: 38,
              padding: expanded ? '0 12px' : '0',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 10,
              color: 'var(--text-disabled)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <svg className="shrink-0" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {expanded && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
