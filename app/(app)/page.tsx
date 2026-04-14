export default function DashboardPage() {
  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
          Dashboard
        </span>
      </h1>
      <p className="text-sm" style={{ color: '#64748B' }}>
        Budget vs Actual overview coming in Phase 6.
      </p>
    </div>
  );
}
