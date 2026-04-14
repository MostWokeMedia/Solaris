'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
      style={{ background: '#0A0E17' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Mono', monospace" }}>
            <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Solaris
            </span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#64748B' }}>
            Personal Financial Command Center
          </p>
        </div>

        <form onSubmit={handleLogin}
          className="rounded-2xl border p-8"
          style={{ background: '#111827', borderColor: '#1E293B' }}>

          {error && (
            <div className="mb-4 rounded-lg border px-4 py-3 text-sm"
              style={{ background: '#3B0D1A', borderColor: '#F8717133', color: '#F87171' }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#64748B', letterSpacing: '0.5px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              style={{
                background: '#0A0E17',
                borderColor: '#1E293B',
                color: '#E2E8F0',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#64748B', letterSpacing: '0.5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              style={{
                background: '#0A0E17',
                borderColor: '#1E293B',
                color: '#E2E8F0',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
