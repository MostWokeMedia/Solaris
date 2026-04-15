type CardProps = {
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
  active?: boolean;
};

export default function Card({ label, value, accent, sub, active }: CardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-shadow"
      style={{
        background: 'var(--card)',
        borderColor: active ? 'var(--amber)' : 'var(--border)',
        boxShadow: active ? 'var(--amber-glow)' : undefined,
      }}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-l-xl"
        style={{ background: accent, width: active ? 4 : 3 }}
      />
      <div
        className="text-[10px] font-semibold uppercase"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-xl font-bold"
        style={{ fontFamily: "'Space Mono', monospace", color: accent }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--text-disabled)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
