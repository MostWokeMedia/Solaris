type CardProps = {
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
  trend?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  active?: boolean;
};

export default function Card({ label, value, accent, sub, trend, icon, active }: CardProps) {
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
        className="flex items-center gap-1.5 text-[10px] font-medium uppercase"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-disabled)',
          letterSpacing: '0.14em',
        }}
      >
        {icon}
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
      {(sub || trend) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-disabled)' }}>
          {trend && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: trend.positive ? '#34D399' : '#F87171',
              marginRight: 2,
            }}>
              {trend.positive ? '▲' : '▼'} {trend.value}
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}
