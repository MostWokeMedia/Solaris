'use client';

const STATUS_CONFIG = {
  good: { bg: '#0F2E22', text: 'var(--green)', dot: '#34D399' },
  paused: { bg: '#2E220F', text: 'var(--amber-warn)', dot: '#FBBF24' },
  cancelled: { bg: '#2E0F17', text: 'var(--red)', dot: '#F87171' },
} as const;

type StatusBadgeProps = {
  status: 'good' | 'paused' | 'cancelled';
  onClick?: () => void;
};

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold"
      style={{
        background: config.bg,
        color: config.text,
        borderColor: config.dot + '33',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: config.dot }}
      />
      {label}
    </button>
  );
}
