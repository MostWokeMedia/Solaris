import { useState, useRef } from "react";

const INITIAL_BILLS = [
  { id: 1, name: "Add/Anny Food", amount: 308, status: "Good", due: "2026-04-10", category: "Dog Food", paidFrom: "Wells Fargo", notes: "" },
  { id: 2, name: "Add/Anny Food", amount: 208, status: "Good", due: "2026-03-20", category: "Dog Food", paidFrom: "Wells Fargo", notes: "" },
  { id: 3, name: "Add/Anny Insurance", amount: 170, status: "Good", due: "2026-04-22", category: "Insurance", paidFrom: "Wells Fargo", notes: "" },
  { id: 4, name: "Claude AI", amount: 100, status: "Good", due: "2026-04-08", category: "AI", paidFrom: "Wells Fargo", notes: "" },
  { id: 5, name: "Propane", amount: 45, status: "Good", due: "2026-05-21", category: "RV", paidFrom: "Wells Fargo", notes: "2 months $90" },
  { id: 6, name: "Mint Mobile", amount: 40, status: "Good", due: "2026-04-10", category: "Phone", paidFrom: "Wells Fargo", notes: "3 months $120" },
  { id: 7, name: "X Badge", amount: 40, status: "Good", due: "2026-04-01", category: "X.com", paidFrom: "Wells Fargo", notes: "" },
  { id: 8, name: "Him", amount: 30, status: "Good", due: "2026-06-30", category: "Subscription", paidFrom: "Wells Fargo", notes: "6 months $175" },
  { id: 9, name: "ATG", amount: 21, status: "Good", due: "2026-04-26", category: "Subscription", paidFrom: "Wells Fargo", notes: "" },
  { id: 10, name: "Amazon Prime", amount: 17, status: "Good", due: "2026-04-01", category: "Subscription", paidFrom: "Chase Card", notes: "" },
  { id: 11, name: "NordVPN", amount: 13, status: "Good", due: "2026-03-20", category: "VPN", paidFrom: "Wells Fargo", notes: "Annual $161.87" },
  { id: 12, name: "GoDaddy (Elysium)", amount: 10, status: "Good", due: "2026-09-29", category: "Domain", paidFrom: "Wells Fargo", notes: "Annual $50" },
  { id: 13, name: "OSS", amount: 10, status: "Good", due: "2026-04-26", category: "Subscription", paidFrom: "Wells Fargo", notes: "" },
  { id: 14, name: "Google Storage", amount: 3, status: "Good", due: "2026-04-02", category: "Cloud Storage", paidFrom: "Wells Fargo", notes: "" },
  { id: 15, name: "Truck Repairs", amount: 320, status: "Paused", due: "2026-03-22", category: "Vehicle", paidFrom: "Discover Card", notes: "$1,555 total" },
  { id: 16, name: "Groceries", amount: 300, status: "Paused", due: "2026-04-01", category: "Groceries", paidFrom: "Master Card", notes: "" },
  { id: 17, name: "Crypto DCA #1", amount: 200, status: "Paused", due: "2026-01-10", category: "Investing", paidFrom: "Banana Stand", notes: "" },
  { id: 18, name: "Crypto DCA #2", amount: 200, status: "Paused", due: "2026-01-25", category: "Investing", paidFrom: "Banana Stand", notes: "" },
  { id: 19, name: "Dread Locs Retwist", amount: 120, status: "Paused", due: "2026-04-04", category: "Personal Care", paidFrom: "Wells Fargo", notes: "" },
  { id: 20, name: "Identity IQ", amount: 35, status: "Cancelled", due: "2026-04-20", category: "Credit Monitoring", paidFrom: "Wells Fargo", notes: "Call to cancel" },
  { id: 21, name: "Skool Elysium", amount: 9, status: "Cancelled", due: "2026-03-09", category: "Subscription", paidFrom: "Wells Fargo", notes: "" },
];

const PAYMENT_SOURCES = ["Wells Fargo", "Chase Card", "Discover Card", "Master Card", "Banana Stand"];
const STATUSES = ["Good", "Paused", "Cancelled"];

const STATUS_CONFIG = {
  Good: { bg: "#0D3B2E", text: "#34D399", dot: "#34D399" },
  Paused: { bg: "#3B2E0D", text: "#FBBF24", dot: "#FBBF24" },
  Cancelled: { bg: "#3B0D1A", text: "#F87171", dot: "#F87171" },
};

const CARDS = [
  { name: "Discover", purpose: "Large buys / Extended debt", bonus: "2% Gas & Restaurant, 1% everything else", limit: 3300, payRange: "$33–$99", payDate: "The 9th", color: "#FF6600" },
  { name: "Chase", purpose: "Amazon, Gas, Small buys", bonus: "6% Amazon Day, 5% Amazon & Chase Travel, 2% Gas/Restaurants, 1% other", limit: 2100, payRange: "$11–$33", payDate: "The 13th", color: "#1A5276" },
  { name: "Wells Fargo", purpose: "Recurring bills & buys", bonus: "Unlimited 2%", limit: 2500, payRange: "$25–$75", payDate: "The 23rd", color: "#C0392B" },
  { name: "Master Card", purpose: "Food & Air Pump", bonus: "None", limit: 300, payRange: "$3–$9", payDate: "The 30th", color: "#7D3C98" },
];

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m)-1]} ${parseInt(d)}`;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#111827", borderRadius: 16, border: "1px solid #1E293B",
        width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #1E293B",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#E2E8F0" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid #1E293B", background: "#0A0E17", color: "#E2E8F0",
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};

const selectStyle = {
  ...inputStyle, cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
};

const btnPrimary = {
  padding: "10px 24px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const btnDanger = {
  padding: "10px 24px", borderRadius: 8, border: "1px solid #F8717133",
  background: "transparent", color: "#F87171", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

export default function RecurringBillsDashboard() {
  const [bills, setBills] = useState(INITIAL_BILLS);
  const [filter, setFilter] = useState("All");
  const [expandedCard, setExpandedCard] = useState(null);
  const [editBill, setEditBill] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newBill, setNewBill] = useState({ name: "", amount: "", status: "Good", due: "", category: "", paidFrom: "Wells Fargo", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const nextId = useRef(100);

  const filtered = filter === "All" ? bills : bills.filter(b => b.status === filter);
  const goodTotal = bills.filter(b => b.status === "Good").reduce((s, b) => s + b.amount, 0);
  const pausedTotal = bills.filter(b => b.status === "Paused").reduce((s, b) => s + b.amount, 0);
  const cancelledTotal = bills.filter(b => b.status === "Cancelled").reduce((s, b) => s + b.amount, 0);

  const statusCounts = {
    All: bills.length,
    Good: bills.filter(b => b.status === "Good").length,
    Paused: bills.filter(b => b.status === "Paused").length,
    Cancelled: bills.filter(b => b.status === "Cancelled").length,
  };

  function handleSaveEdit() {
    setBills(prev => prev.map(b => b.id === editBill.id ? { ...editBill, amount: parseFloat(editBill.amount) || 0 } : b));
    setEditBill(null);
    setConfirmDelete(null);
  }

  function handleAdd() {
    if (!newBill.name.trim()) return;
    setBills(prev => [...prev, { ...newBill, id: nextId.current++, amount: parseFloat(newBill.amount) || 0 }]);
    setNewBill({ name: "", amount: "", status: "Good", due: "", category: "", paidFrom: "Wells Fargo", notes: "" });
    setShowAdd(false);
  }

  function handleDelete(id) {
    setBills(prev => prev.filter(b => b.id !== id));
    setConfirmDelete(null);
    setEditBill(null);
  }

  function cycleStatus(id) {
    setBills(prev => prev.map(b => {
      if (b.id !== id) return b;
      const next = STATUSES[(STATUSES.indexOf(b.status) + 1) % 3];
      return { ...b, status: next };
    }));
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "#0A0E17", color: "#E2E8F0",
      minHeight: "100vh", padding: "32px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, margin: 0,
              background: "linear-gradient(135deg, #34D399, #3B82F6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Recurring Bills</h1>
            <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>Click a row to edit · Tap status badges to cycle</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Expense
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Active Monthly", value: `$${goodTotal.toLocaleString()}`, sub: `${statusCounts.Good} bills`, accent: "#34D399" },
            { label: "Paused", value: `$${pausedTotal.toLocaleString()}`, sub: `${statusCounts.Paused} items`, accent: "#FBBF24" },
            { label: "Cancelled", value: `$${cancelledTotal.toLocaleString()}`, sub: `${statusCounts.Cancelled} items`, accent: "#F87171" },
            { label: "Total Items", value: bills.length, sub: "tracked", accent: "#818CF8" },
          ].map((c, i) => (
            <div key={i} style={{
              background: "#111827", borderRadius: 12, padding: "18px 20px",
              border: "1px solid #1E293B", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: c.accent, borderRadius: "12px 0 0 12px" }} />
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: c.accent, marginTop: 4 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["All", "Good", "Paused", "Cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "8px 18px", borderRadius: 8,
              border: filter === s ? "1px solid #3B82F6" : "1px solid #1E293B",
              background: filter === s ? "#1E3A5F" : "#111827",
              color: filter === s ? "#93C5FD" : "#64748B",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {s} <span style={{ opacity: 0.5 }}>({statusCounts[s]})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#111827", borderRadius: 14, border: "1px solid #1E293B", overflow: "hidden", marginBottom: 32 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 0.9fr 0.9fr 0.8fr 1.1fr",
            padding: "14px 20px", background: "#0F1629", borderBottom: "1px solid #1E293B",
            fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.8px",
          }}>
            <div>Name</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div style={{ textAlign: "center" }}>Status</div>
            <div style={{ textAlign: "center" }}>Due</div>
            <div>Paid From</div>
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#475569", fontSize: 14 }}>No bills in this category</div>
          )}

          {filtered.map((bill, i) => {
            const sc = STATUS_CONFIG[bill.status];
            return (
              <div key={bill.id} style={{
                display: "grid", gridTemplateColumns: "2fr 0.9fr 0.9fr 0.8fr 1.1fr",
                padding: "14px 20px",
                borderBottom: i < filtered.length - 1 ? "1px solid #1E293B22" : "none",
                alignItems: "center", cursor: "pointer", transition: "background 0.15s",
              }}
                onClick={() => { setEditBill({ ...bill }); setConfirmDelete(null); }}
                onMouseEnter={e => e.currentTarget.style.background = "#1A2332"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#E2E8F0" }}>{bill.name}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {bill.category}{bill.notes ? ` · ${bill.notes}` : ""}
                  </div>
                </div>
                <div style={{
                  textAlign: "right", fontFamily: "'Space Mono', monospace",
                  fontSize: 14, fontWeight: 700,
                  color: bill.status === "Good" ? "#E2E8F0" : "#64748B",
                }}>${bill.amount}</div>
                <div style={{ textAlign: "center" }} onClick={e => { e.stopPropagation(); cycleStatus(bill.id); }}>
                  <button style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 6,
                    background: sc.bg, color: sc.text, border: "1px solid " + sc.text + "33",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                    {bill.status}
                  </button>
                </div>
                <div style={{ textAlign: "center", fontSize: 13, color: "#94A3B8" }}>{formatDate(bill.due)}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{bill.paidFrom}</div>
              </div>
            );
          })}
        </div>

        {/* Credit Cards */}
        <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: "#94A3B8", marginBottom: 16 }}>Credit Card Strategy</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {CARDS.map((card, i) => (
            <div key={i} onClick={() => setExpandedCard(expandedCard === i ? null : i)} style={{
              background: "#111827", borderRadius: 12, border: "1px solid #1E293B",
              overflow: "hidden", cursor: "pointer", transition: "border-color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = card.color + "66"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1E293B"}
            >
              <div style={{ height: 4, background: `linear-gradient(90deg, ${card.color}, ${card.color}88)` }} />
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0" }}>{card.name}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{card.purpose}</div>
                  </div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: card.color }}>${card.limit.toLocaleString()}</div>
                </div>
                {expandedCard === i && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1E293B", fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
                    <div style={{ marginBottom: 8 }}><span style={{ color: "#64748B" }}>Rewards: </span>{card.bonus}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div><span style={{ color: "#64748B" }}>Target: </span><span style={{ color: "#E2E8F0", fontWeight: 600 }}>{card.payRange}</span></div>
                      <div><span style={{ color: "#64748B" }}>Due: </span><span style={{ color: "#E2E8F0", fontWeight: 600 }}>{card.payDate}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#334155", marginTop: 8, textAlign: "center" }}>Tap a card to expand details</p>
      </div>

      {/* ===== EDIT MODAL ===== */}
      <Modal open={!!editBill} onClose={() => { setEditBill(null); setConfirmDelete(null); }} title="Edit Expense">
        {editBill && (<>
          <Field label="Name">
            <input style={inputStyle} value={editBill.name} onChange={e => setEditBill({ ...editBill, name: e.target.value })}
              onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amount ($)">
              <input style={inputStyle} type="number" value={editBill.amount} onChange={e => setEditBill({ ...editBill, amount: e.target.value })}
                onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
            </Field>
            <Field label="Status">
              <select style={selectStyle} value={editBill.status} onChange={e => setEditBill({ ...editBill, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Due Date">
              <input style={inputStyle} type="date" value={editBill.due} onChange={e => setEditBill({ ...editBill, due: e.target.value })}
                onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
            </Field>
            <Field label="Paid From">
              <select style={selectStyle} value={editBill.paidFrom} onChange={e => setEditBill({ ...editBill, paidFrom: e.target.value })}>
                {PAYMENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Category">
            <input style={inputStyle} value={editBill.category} onChange={e => setEditBill({ ...editBill, category: e.target.value })}
              onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
          </Field>
          <Field label="Notes">
            <input style={inputStyle} value={editBill.notes} onChange={e => setEditBill({ ...editBill, notes: e.target.value })}
              onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
          </Field>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            {confirmDelete === editBill.id ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#F87171" }}>Sure?</span>
                <button onClick={() => handleDelete(editBill.id)} style={{ ...btnDanger, padding: "6px 14px", fontSize: 12 }}>Yes, delete</button>
                <button onClick={() => setConfirmDelete(null)} style={{ ...btnDanger, color: "#64748B", borderColor: "#1E293B", padding: "6px 14px", fontSize: 12 }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(editBill.id)} style={btnDanger}>Delete</button>
            )}
            <button onClick={handleSaveEdit} style={btnPrimary}>Save Changes</button>
          </div>
        </>)}
      </Modal>

      {/* ===== ADD MODAL ===== */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <Field label="Name">
          <input style={inputStyle} value={newBill.name} placeholder="e.g. Netflix" onChange={e => setNewBill({ ...newBill, name: e.target.value })}
            onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Amount ($)">
            <input style={inputStyle} type="number" value={newBill.amount} placeholder="0" onChange={e => setNewBill({ ...newBill, amount: e.target.value })}
              onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
          </Field>
          <Field label="Status">
            <select style={selectStyle} value={newBill.status} onChange={e => setNewBill({ ...newBill, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Due Date">
            <input style={inputStyle} type="date" value={newBill.due} onChange={e => setNewBill({ ...newBill, due: e.target.value })}
              onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
          </Field>
          <Field label="Paid From">
            <select style={selectStyle} value={newBill.paidFrom} onChange={e => setNewBill({ ...newBill, paidFrom: e.target.value })}>
              {PAYMENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Category">
          <input style={inputStyle} value={newBill.category} placeholder="e.g. Streaming" onChange={e => setNewBill({ ...newBill, category: e.target.value })}
            onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
        </Field>
        <Field label="Notes (optional)">
          <input style={inputStyle} value={newBill.notes} placeholder="" onChange={e => setNewBill({ ...newBill, notes: e.target.value })}
            onFocus={e => e.target.style.borderColor = "#3B82F6"} onBlur={e => e.target.style.borderColor = "#1E293B"} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
          <button onClick={() => setShowAdd(false)} style={{ ...btnDanger, color: "#64748B", borderColor: "#1E293B" }}>Cancel</button>
          <button onClick={handleAdd} style={{ ...btnPrimary, opacity: newBill.name.trim() ? 1 : 0.4 }}>Add Expense</button>
        </div>
      </Modal>
    </div>
  );
}
