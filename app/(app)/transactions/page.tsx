export default function TransactionsPage() {
  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
          Transactions
        </span>
      </h1>
      <p className="text-sm" style={{ color: '#64748B' }}>
        Transaction management + CSV import coming in Phase 2.
      </p>
    </div>
  );
}
