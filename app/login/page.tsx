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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight heading-gradient"
            style={{ fontFamily: "'Space Mono', monospace" }}>
            Solaris
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Personal Financial Command Center
          </p>
        </div>

        <form onSubmit={handleLogin}
          className="rounded-2xl border p-8"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

          {error && (
            <div className="mb-4 rounded-lg border px-4 py-3 text-sm"
              style={{ background: '#2E0F17', borderColor: '#F8717133', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <Button type="submit" loading={loading} fullWidth>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
