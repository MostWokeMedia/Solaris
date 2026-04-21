'use client';

import { useEffect } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, wide, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-auto rounded-2xl border"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          maxWidth: wide ? 640 : 440,
          maxHeight: '90vh',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: 'var(--border)' }}
        >
          <h3
            className="text-base font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xl transition-colors"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            &#x2715;
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
