'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  const inputStyle = {
    background: 'oklch(0.19 0.02 240)',
    borderColor: 'oklch(0.25 0.015 240)',
    color: 'var(--text)',
    fontFamily: "'Space Grotesk', sans-serif",
  };

  return (
    <div className="relative min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 60% at 20% 30%, oklch(0.85 0.15 200 / 0.06), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.72 0.22 340 / 0.05), transparent 60%)',
      }} />

      {/* Left — Brand */}
      <div className="relative hidden flex-1 flex-col justify-center px-16 lg:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg"
            style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.72 0.22 340))',
              borderRadius: 10,
              boxShadow: '0 0 20px oklch(0.82 0.16 80 / 0.4)',
            }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>Solaris</span>
        </div>

        <h2 className="mb-4 text-[32px] font-semibold leading-tight" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Personal Financial<br />
          <span style={{ color: 'var(--amber)' }}>Command Center</span>
        </h2>
        <p className="mb-10 max-w-md text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Track spending, allocate income with Profit First methodology, and get AI-powered insights — all in one dark, data-dense dashboard.
        </p>

        {/* Stats */}
        <div className="flex gap-8">
          {[
            { label: 'Accounts', value: '5', color: 'var(--amber)' },
            { label: 'Categories', value: '25', color: 'var(--green)' },
            { label: 'AI Powered', value: '✓', color: 'oklch(0.72 0.22 340)' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-[28px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color }}>{s.value}</div>
              <div className="text-[11px] uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', letterSpacing: '0.1em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Security badges */}
        <div className="mt-10 flex gap-4">
          {['End-to-end encrypted', 'SOC 2 via Teller', 'Single-user'].map(b => (
            <span key={b} className="rounded-md px-3 py-1.5 text-[10px] font-medium" style={{
              background: 'oklch(0.17 0.018 240)',
              border: '1px solid oklch(0.25 0.015 240)',
              color: 'var(--text-muted)',
            }}>{b}</span>
          ))}
        </div>
      </div>

      {/* Right — Auth card */}
      <div className="relative flex flex-1 items-center justify-center px-4 lg:flex-none lg:w-[480px]">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-3 inline-flex items-center justify-center rounded-lg" style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.72 0.22 340))',
              borderRadius: 9,
              boxShadow: '0 0 16px oklch(0.82 0.16 80 / 0.35)',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--bg)' }} />
            </div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>Solaris</h1>
          </div>

          <form onSubmit={handleLogin}
            className="overflow-hidden rounded-xl border"
            style={{ background: 'oklch(0.17 0.018 240)', borderColor: 'oklch(0.30 0.02 240)', boxShadow: '0 20px 60px oklch(0 0 0 / 0.6)' }}>

            <div className="border-b px-8 py-5" style={{ borderColor: 'oklch(0.25 0.015 240)' }}>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Sign in to Solaris</h2>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--text-disabled)' }}>Enter your credentials to continue</p>
            </div>

            <div className="px-8 py-6">
              {error && (
                <div className="mb-4 rounded-lg border px-4 py-3 text-[12px]"
                  style={{ background: 'oklch(0.70 0.22 25 / 0.08)', borderColor: 'oklch(0.70 0.22 25 / 0.3)', color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="eyebrow mb-2 block">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  className="w-full rounded-md border px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'oklch(0.75 0.18 205)'; e.currentTarget.style.boxShadow = 'var(--glow-cyan)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'oklch(0.25 0.015 240)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              <div className="mb-6">
                <label className="eyebrow mb-2 block">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-md border px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'oklch(0.75 0.18 205)'; e.currentTarget.style.boxShadow = 'var(--glow-cyan)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'oklch(0.25 0.015 240)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              <Button type="submit" loading={loading} fullWidth>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </form>

          <p className="mt-4 text-center text-[10px]" style={{ color: 'var(--text-ghost)' }}>
            Solaris is a single-user application. Contact the admin for access.
          </p>
        </div>
      </div>
    </div>
  );
}
