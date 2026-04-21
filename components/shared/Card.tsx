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
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150"
      style={{
        background: 'linear-gradient(180deg, var(--card) 0%, var(--bg-elevated) 100%)',
        borderColor: active ? 'var(--amber)' : 'var(--border)',
        boxShadow: active ? 'var(--amber-glow)' : undefined,
      }}
    >
      {/* Accent bar with glow */}
      <div
        className="absolute left-0 top-0 h-full"
        style={{
          background: accent,
          width: 2,
          boxShadow: `0 0 8px ${accent}88`,
        }}
      />
      <div
        className="text-[10px] font-medium uppercase"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-disabled)',
          letterSpacing: '0.14em',
        }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[22px] font-semibold leading-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: accent,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px]" style={{ color: 'var(--text-disabled)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
