type CardProps = {
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
};

export default function Card({ label, value, accent, sub }: CardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{ background: '#111827', borderColor: '#1E293B' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: accent }}
      />
      <div
        className="text-[10px] font-semibold uppercase"
        style={{ color: '#64748B', letterSpacing: '0.5px' }}
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
        <div className="mt-0.5 text-xs" style={{ color: '#475569' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
