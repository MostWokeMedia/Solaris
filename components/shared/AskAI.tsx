'use client';

import { useState, useEffect, useRef } from 'react';

const SUGGESTIONS = [
  "How's my budget this month?",
  "Where am I overspending?",
  "What's my biggest expense category?",
  "Am I on track to save?",
  "How much do I spend on dining out?",
];

export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function handleAsk(question: string) {
    if (!question.trim() || loading) return;
    setQuery(question);
    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const ans = data.answer || data.error || 'No response.';
      setAnswer(ans);
      setHistory(prev => [{ q: question, a: ans }, ...prev].slice(0, 8));
    } catch {
      setAnswer('Failed to connect. Check your API key.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[8000] flex items-start justify-center pt-[15vh]"
      style={{ background: 'oklch(0.05 0 0 / 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[680px] overflow-hidden rounded-xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border-strong)', boxShadow: '0 30px 80px -10px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--amber)', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 text-sm outline-none"
            style={{ background: 'transparent', color: 'var(--text)', border: 'none', fontFamily: 'inherit' }}
            placeholder="Ask Solaris anything about your finances..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAsk(query); }}
          />
          <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-disabled)', border: '1px solid var(--border)', background: 'var(--panel-2)' }}>ESC</span>
        </div>

        {/* Content */}
        <div className="px-5 py-4" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-6">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full" style={{
                    background: 'var(--amber)',
                    animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Thinking...</span>
            </div>
          )}

          {/* Answer */}
          {answer && !loading && (
            <div className="mb-4 rounded-lg border p-4" style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              borderLeft: '2px solid var(--amber)',
            }}>
              <div className="eyebrow mb-2" style={{ color: 'var(--amber)' }}>// solaris ai</div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{answer}</p>
            </div>
          )}

          {/* Suggestions (when no answer) */}
          {!answer && !loading && (
            <div>
              <div className="eyebrow mb-3" style={{ color: 'var(--text-disabled)' }}>Suggestions</div>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => handleAsk(s)}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12.5px] transition-colors hover:bg-[var(--card-hover)]"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <span style={{ color: 'var(--text-disabled)' }}>&rsaquo;</span>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && !loading && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div className="eyebrow mb-3" style={{ color: 'var(--text-disabled)' }}>Recent</div>
              {history.map((h, i) => (
                <button key={i} onClick={() => handleAsk(h.q)}
                  className="mb-1 flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[11.5px] transition-colors hover:bg-[var(--card-hover)]"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {h.q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
