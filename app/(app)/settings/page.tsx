export default function SettingsPage() {
  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
          Settings
        </span>
      </h1>
      <p className="text-sm" style={{ color: '#64748B' }}>
        Categories, bank connections, and preferences.
      </p>
    </div>
  );
}
