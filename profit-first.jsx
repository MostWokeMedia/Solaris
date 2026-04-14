import { useState, useMemo, useRef } from "react";

const INIT_ACCOUNTS = [
  { id: 1, name: "House & Utilities", pct: 0, tag: "" },
  { id: 2, name: "Food", pct: 7.5, tag: "" },
  { id: 3, name: "Dogs (food/med/toys/insure)", pct: 15, tag: "" },
  { id: 4, name: "IRS + Tax Catch Up", pct: 12.3, tag: "tax" },
  { id: 5, name: "Insurances", pct: 0, tag: "" },
  { id: 6, name: "Draf Star (LG Buys / Debt)", pct: 7.5, tag: "" },
  { id: 7, name: "Nebula (Subscriptions)", pct: 10, tag: "" },
  { id: 8, name: "Learning", pct: 5, tag: "" },
  { id: 9, name: "Crypto Account", pct: 15, tag: "profit" },
];

const PERIODS = [];
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
for (let m = 0; m < 12; m++) {
  PERIODS.push({ key: m + "-10", label: MN[m] + " 10th", month: m, half: 0, qEnd: false });
  PERIODS.push({ key: m + "-25", label: MN[m] + " 25th", month: m, half: 1, qEnd: m === 2 || m === 5 || m === 8 || m === 11 });
}

const INIT_CARDS = ["Discover C.C", "Mastercard C.C", "Wells Fargo C.C", "Chase/Amazon C.C"];

function fm(n) {
  if (n === 0) return "\u2014";
  var a = Math.abs(n);
  return (n < 0 ? "-" : "") + "$" + a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

var baseInput = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #1E293B", background: "#0A0E17", color: "#E2E8F0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
var baseSelect = Object.assign({}, baseInput, { cursor: "pointer", appearance: "none" });
var btnBlue = { padding: "7px 16px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" };
var btnRed = { padding: "7px 16px", borderRadius: 7, border: "1px solid #F8717133", background: "transparent", color: "#F87171", fontSize: 12, fontWeight: 600, cursor: "pointer" };

function Modal(props) {
  if (!props.open) return null;
  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#111827", borderRadius: 16, border: "1px solid #1E293B", width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: "'Space Mono',monospace", color: "#E2E8F0" }}>{props.title}</h3>
          <button onClick={props.onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 18, cursor: "pointer" }}>&#x2715;</button>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>{props.children}</div>
      </div>
    </div>
  );
}

function Field(props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{props.label}</label>
      {props.children}
    </div>
  );
}

var tagColors = { profit: "#34D399", tax: "#F59E0B" };
var tagLabels = { profit: "PROFIT", tax: "TAX" };

export default function ProfitFirst() {
  var _a = useState(INIT_ACCOUNTS), accounts = _a[0], setAccounts = _a[1];
  var _b = useState({}), amounts = _b[0], setAmounts = _b[1];
  var _c = useState(INIT_CARDS), cards = _c[0], setCards = _c[1];
  var _d = useState({}), cardChecks = _d[0], setCardChecks = _d[1];
  var _e = useState(false), showAcctMgr = _e[0], setShowAcctMgr = _e[1];
  var _f = useState(false), showCardMgr = _f[0], setShowCardMgr = _f[1];
  var _g = useState(null), editAcct = _g[0], setEditAcct = _g[1];
  var _h = useState({ name: "", pct: "", tag: "" }), newAcct = _h[0], setNewAcct = _h[1];
  var _i = useState(""), newCard = _i[0], setNewCard = _i[1];
  var _j = useState(null), confirmDel = _j[0], setConfirmDel = _j[1];
  var _k = useState({}), vaultDraws = _k[0], setVaultDraws = _k[1];
  var _l = useState(null), inlineEdit = _l[0], setInlineEdit = _l[1];
  var nextId = useRef(100);

  function handleInlineSave(id, field, value) {
    setAccounts(function(p) {
      return p.map(function(a) {
        if (a.id !== id) return a;
        var updated = Object.assign({}, a);
        if (field === "pct") {
          updated.pct = parseFloat(value) || 0;
        } else if (field === "name") {
          updated.name = value || a.name;
        }
        return updated;
      });
    });
    setInlineEdit(null);
  }

  var totalPct = accounts.reduce(function(s, a) { return s + a.pct; }, 0);
  var unallocated = 100 - totalPct;

  var computed = useMemo(function() {
    var result = {};
    var runVault = 0;
    var runTax = 0;

    PERIODS.forEach(function(p) {
      var startAmt = parseFloat(amounts[p.key]) || 0;
      var allocations = {};
      var acctTotal = 0;

      accounts.forEach(function(a) {
        var val = Math.round(startAmt * (a.pct / 100) * 100) / 100;
        allocations[a.id] = val;
        acctTotal += val;
      });

      acctTotal = Math.round(acctTotal * 100) / 100;
      var afterAlloc = Math.round((startAmt - acctTotal) * 100) / 100;

      accounts.forEach(function(a) {
        if (a.tag === "profit") runVault += allocations[a.id] || 0;
        if (a.tag === "tax") runTax += allocations[a.id] || 0;
      });

      var draw = parseFloat(vaultDraws[p.key]) || 0;
      runVault -= draw;

      result[p.key] = {
        startAmt: startAmt,
        allocations: allocations,
        acctTotal: acctTotal,
        afterAlloc: afterAlloc,
        vaultBalance: Math.round(runVault * 100) / 100,
        taxBalance: Math.round(runTax * 100) / 100,
        isQEnd: p.qEnd,
        draw: draw,
      };
    });

    return result;
  }, [accounts, amounts, vaultDraws]);

  var totals = useMemo(function() {
    var t = { startAmt: 0, acctTotal: 0, afterAlloc: 0, draws: 0, distributions: 0, acctSums: {} };
    accounts.forEach(function(a) { t.acctSums[a.id] = 0; });
    PERIODS.forEach(function(p) {
      var c = computed[p.key];
      if (!c) return;
      t.startAmt += c.startAmt;
      t.acctTotal += c.acctTotal;
      t.afterAlloc += c.afterAlloc;
      t.draws += c.draw;
      if (c.isQEnd && c.vaultBalance > 0) t.distributions += c.vaultBalance;
      accounts.forEach(function(a) {
        t.acctSums[a.id] = (t.acctSums[a.id] || 0) + (c.allocations[a.id] || 0);
      });
    });
    var last = computed[PERIODS[PERIODS.length - 1]?.key];
    t.vaultFinal = last?.vaultBalance || 0;
    t.taxFinal = last?.taxBalance || 0;
    return t;
  }, [computed, accounts]);

  function handleSetAmount(key, val) {
    setAmounts(function(p) { var n = Object.assign({}, p); n[key] = val; return n; });
  }

  function handleToggleCard(periodKey, cardIdx) {
    var k = periodKey + "-" + cardIdx;
    setCardChecks(function(p) { var n = Object.assign({}, p); n[k] = !p[k]; return n; });
  }

  function handleSaveAcct() {
    if (!editAcct) return;
    var saved = Object.assign({}, editAcct, { pct: parseFloat(editAcct.pct) || 0 });
    setAccounts(function(p) { return p.map(function(a) { return a.id === saved.id ? saved : a; }); });
    setEditAcct(null);
  }

  function handleAddAcct() {
    if (!newAcct.name.trim()) return;
    var acct = { name: newAcct.name, pct: parseFloat(newAcct.pct) || 0, tag: newAcct.tag, id: nextId.current++ };
    setAccounts(function(p) { return p.concat([acct]); });
    setNewAcct({ name: "", pct: "", tag: "" });
  }

  function handleDeleteAcct(id) {
    setAccounts(function(p) { return p.filter(function(a) { return a.id !== id; }); });
    setConfirmDel(null);
  }

  var gridCols = "200px repeat(" + PERIODS.length + ", 100px) 110px";

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#0A0E17", color: "#E2E8F0", minHeight: "100vh", padding: "28px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 24, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#F59E0B,#EF4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Profit First
            </h1>
            <p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>Spencer's Personal Allocation System &middot; 2026</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={function() { setShowAcctMgr(true); }} style={btnBlue}>Manage Accounts</button>
            <button onClick={function() { setShowCardMgr(true); }} style={Object.assign({}, btnBlue, { background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" })}>Credit Cards</button>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Allocated", value: totalPct.toFixed(1) + "%", color: totalPct > 100 ? "#F87171" : "#34D399" },
            { label: "Unallocated", value: unallocated.toFixed(1) + "%", color: unallocated < 0 ? "#F87171" : "#818CF8" },
            { label: "Accounts", value: accounts.length, color: "#E2E8F0" },
            { label: "Vault Balance", value: fm(computed[PERIODS[PERIODS.length - 1]?.key]?.vaultBalance || 0), color: "#34D399" },
          ].map(function(c, i) {
            return (
              <div key={i} style={{ background: "#111827", borderRadius: 10, padding: "12px 18px", border: "1px solid #1E293B", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>{c.label}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700, color: c.color, marginTop: 2 }}>{c.value}</div>
              </div>
            );
          })}
        </div>

        {/* Main Grid */}
        <div style={{ background: "#111827", borderRadius: 14, border: "1px solid #1E293B", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 200 + PERIODS.length * 100 + 110 }}>

              {/* Header Row */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "2px solid #1E293B" }}>
                <div style={{ padding: "12px 14px", background: "#0F1629", fontSize: 11, fontWeight: 700, color: "#94A3B8", position: "sticky", left: 0, zIndex: 2 }}>
                  <div>Reference %</div>
                  <div style={{ marginTop: 2 }}>Account Name</div>
                </div>
                {PERIODS.map(function(p) {
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", background: p.qEnd ? "#1A1A2E" : "#0F1629",
                      fontSize: 10, fontWeight: 600, color: p.qEnd ? "#F59E0B" : "#64748B",
                      textAlign: "center", borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B22",
                    }}>
                      {p.label}
                      {p.qEnd && <div style={{ fontSize: 8, color: "#F59E0B", marginTop: 2 }}>Q END</div>}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", background: "#0F1629", fontSize: 11, fontWeight: 700, color: "#94A3B8", textAlign: "center", borderLeft: "2px solid #3B82F6" }}>
                  Totals:
                </div>
              </div>

              {/* Account Rows */}
              {accounts.map(function(acct) {
                var isEditingPct = inlineEdit && inlineEdit.id === acct.id && inlineEdit.field === "pct";
                var isEditingName = inlineEdit && inlineEdit.id === acct.id && inlineEdit.field === "name";
                return (
                  <div key={acct.id} style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B22" }}>
                    <div style={{
                      padding: "4px 8px", display: "flex", alignItems: "center", gap: 6,
                      position: "sticky", left: 0, background: "#111827", zIndex: 1, borderRight: "1px solid #1E293B",
                    }}>
                      {isEditingPct ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.1"
                          style={Object.assign({}, baseInput, { width: 50, padding: "4px 6px", fontSize: 11, fontFamily: "'Space Mono',monospace", textAlign: "right" })}
                          defaultValue={acct.pct}
                          onBlur={function(e) { handleInlineSave(acct.id, "pct", e.target.value); }}
                          onKeyDown={function(e) { if (e.key === "Enter") { handleInlineSave(acct.id, "pct", e.target.value); } if (e.key === "Escape") { setInlineEdit(null); } }}
                        />
                      ) : (
                        <span
                          onClick={function() { setInlineEdit({ id: acct.id, field: "pct" }); }}
                          style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#64748B", minWidth: 38, textAlign: "right", cursor: "pointer", borderBottom: "1px dashed #334155", padding: "2px 0" }}
                          title="Click to edit %"
                        >
                          {acct.pct > 0 ? acct.pct + "%" : "0%"}
                        </span>
                      )}
                      {isEditingName ? (
                        <input
                          autoFocus
                          style={Object.assign({}, baseInput, { flex: 1, padding: "4px 6px", fontSize: 12 })}
                          defaultValue={acct.name}
                          onBlur={function(e) { handleInlineSave(acct.id, "name", e.target.value); }}
                          onKeyDown={function(e) { if (e.key === "Enter") { handleInlineSave(acct.id, "name", e.target.value); } if (e.key === "Escape") { setInlineEdit(null); } }}
                        />
                      ) : (
                        <span
                          onClick={function() { setInlineEdit({ id: acct.id, field: "name" }); }}
                          style={{ fontSize: 12, color: "#CBD5E1", fontWeight: 500, cursor: "pointer", borderBottom: "1px dashed #334155", padding: "2px 0", flex: 1 }}
                          title="Click to edit name"
                        >
                          {acct.name}
                        </span>
                      )}
                      {acct.tag && !isEditingName && (
                        <span style={{ fontSize: 8, fontWeight: 700, color: tagColors[acct.tag], background: tagColors[acct.tag] + "22", padding: "1px 5px", borderRadius: 3 }}>
                          {tagLabels[acct.tag]}
                        </span>
                      )}
                    </div>
                    {PERIODS.map(function(p) {
                      var val = computed[p.key]?.allocations[acct.id] || 0;
                      return (
                        <div key={p.key} style={{
                          padding: "8px 6px", textAlign: "right",
                          fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 500,
                          color: val > 0 ? "#E2E8F0" : "#334155",
                          borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                        }}>
                          {val > 0 ? fm(val) : "\u2014"}
                        </div>
                      );
                    })}
                    <div style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700,
                      color: totals.acctSums[acct.id] > 0 ? "#E2E8F0" : "#334155",
                      borderLeft: "2px solid #3B82F6", background: "#0F1629",
                    }}>
                      {totals.acctSums[acct.id] > 0 ? fm(totals.acctSums[acct.id]) : "\u2014"}
                    </div>
                  </div>
                );
              })}

              {/* Accounts Total */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderTop: "2px solid #1E293B", borderBottom: "1px solid #1E293B", background: "#0F1629" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#94A3B8", position: "sticky", left: 0, background: "#0F1629", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#64748B", marginRight: 8 }}>{totalPct.toFixed(1)}%</span>
                  Accounts Total
                </div>
                {PERIODS.map(function(p) {
                  var v = computed[p.key]?.acctTotal || 0;
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: v > 0 ? "#F87171" : "#334155",
                      borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                    }}>
                      {v > 0 ? fm(v) : "\u2014"}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: totals.acctTotal > 0 ? "#F87171" : "#334155", borderLeft: "2px solid #3B82F6", background: "#0F1629" }}>
                  {totals.acctTotal > 0 ? fm(totals.acctTotal) : "\u2014"}
                </div>
              </div>

              {/* Spacer */}
              <div style={{ height: 8, background: "#0A0E17" }} />

              {/* Starting Amount */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B", background: "#0D1B2A" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#3B82F6", position: "sticky", left: 0, background: "#0D1B2A", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  Starting Amount
                </div>
                {PERIODS.map(function(p) {
                  return (
                    <div key={p.key} style={{ padding: "4px 4px", borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11" }}>
                      <input
                        type="number"
                        style={Object.assign({}, baseInput, { textAlign: "right", padding: "5px 6px", fontSize: 11, fontFamily: "'Space Mono',monospace" })}
                        value={amounts[p.key] || ""}
                        placeholder="0"
                        onChange={function(e) { handleSetAmount(p.key, e.target.value); }}
                      />
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: totals.startAmt > 0 ? "#3B82F6" : "#334155", borderLeft: "2px solid #3B82F6", background: "#0D1B2A" }}>
                  {totals.startAmt > 0 ? fm(totals.startAmt) : "\u2014"}
                </div>
              </div>

              {/* After Allocations */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#94A3B8", position: "sticky", left: 0, background: "#111827", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  After Allocations
                </div>
                {PERIODS.map(function(p) {
                  var c = computed[p.key];
                  var v = c?.afterAlloc || 0;
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600,
                      color: c?.startAmt > 0 ? (v >= 0 ? "#34D399" : "#F87171") : "#334155",
                      borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                    }}>
                      {c?.startAmt > 0 ? fm(v) : "\u2014"}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: totals.afterAlloc >= 0 ? "#34D399" : "#F87171", borderLeft: "2px solid #3B82F6", background: "#0F1629" }}>
                  {totals.startAmt > 0 ? fm(totals.afterAlloc) : "\u2014"}
                </div>
              </div>

              {/* Spacer */}
              <div style={{ height: 8, background: "#0A0E17" }} />

              {/* Vault Balance */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B", background: "#0D2818" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#34D399", position: "sticky", left: 0, background: "#0D2818", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  Vault Balance
                </div>
                {PERIODS.map(function(p) {
                  var v = computed[p.key]?.vaultBalance || 0;
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700,
                      color: "#34D399",
                      borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                    }}>
                      {v > 0 ? fm(v) : "\u2014"}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: "#34D399", borderLeft: "2px solid #3B82F6", background: "#0D2818" }}>
                  {totals.vaultFinal > 0 ? fm(totals.vaultFinal) : "\u2014"}
                </div>
              </div>

              {/* Vault Draw */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#94A3B8", position: "sticky", left: 0, background: "#111827", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  Vault Draw
                </div>
                {PERIODS.map(function(p) {
                  return (
                    <div key={p.key} style={{ padding: "4px 4px", borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11" }}>
                      <input
                        type="number"
                        style={Object.assign({}, baseInput, { textAlign: "right", padding: "5px 6px", fontSize: 11, fontFamily: "'Space Mono',monospace" })}
                        value={vaultDraws[p.key] || ""}
                        placeholder="0"
                        onChange={function(e) { setVaultDraws(function(prev) { var n = Object.assign({}, prev); n[p.key] = e.target.value; return n; }); }}
                      />
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600, color: totals.draws > 0 ? "#F87171" : "#334155", borderLeft: "2px solid #3B82F6", background: "#0F1629" }}>
                  {totals.draws > 0 ? fm(totals.draws) : "\u2014"}
                </div>
              </div>

              {/* Profit Distribution */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B", background: "#1A1A2E" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#F59E0B", position: "sticky", left: 0, background: "#1A1A2E", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  Profit Distribution
                </div>
                {PERIODS.map(function(p) {
                  var v = computed[p.key]?.vaultBalance || 0;
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700,
                      color: p.qEnd && v > 0 ? "#F59E0B" : "#334155",
                      borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                    }}>
                      {p.qEnd && v > 0 ? fm(v) : "\u2014"}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: "#F59E0B", borderLeft: "2px solid #3B82F6", background: "#1A1A2E" }}>
                  {"\u2014"}
                </div>
              </div>

              {/* Tax Balance */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B", background: "#1A1500" }}>
                <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#F59E0B", position: "sticky", left: 0, background: "#1A1500", zIndex: 1, borderRight: "1px solid #1E293B" }}>
                  Tax Acct. Balance
                </div>
                {PERIODS.map(function(p) {
                  var v = computed[p.key]?.taxBalance || 0;
                  return (
                    <div key={p.key} style={{
                      padding: "8px 6px", textAlign: "right",
                      fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600,
                      color: "#F59E0B",
                      borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                    }}>
                      {v > 0 ? fm(v) : "\u2014"}
                    </div>
                  );
                })}
                <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: "#F59E0B", borderLeft: "2px solid #3B82F6", background: "#1A1500" }}>
                  {totals.taxFinal > 0 ? fm(totals.taxFinal) : "\u2014"}
                </div>
              </div>

              {/* Spacer */}
              <div style={{ height: 8, background: "#0A0E17" }} />

              {/* Credit Card Checklist */}
              {cards.map(function(card, ci) {
                var checkCount = PERIODS.filter(function(p) { return cardChecks[p.key + "-" + ci]; }).length;
                return (
                  <div key={ci} style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid #1E293B22" }}>
                    <div style={{ padding: "6px 14px", fontSize: 11, color: "#94A3B8", position: "sticky", left: 0, background: "#111827", zIndex: 1, borderRight: "1px solid #1E293B", display: "flex", alignItems: "center", gap: 6 }}>
                      {card} Paid
                    </div>
                    {PERIODS.map(function(p) {
                      var checked = cardChecks[p.key + "-" + ci];
                      return (
                        <div key={p.key}
                          onClick={function() { handleToggleCard(p.key, ci); }}
                          style={{
                            padding: "6px 6px", textAlign: "center", cursor: "pointer",
                            fontSize: 13, color: checked ? "#34D399" : "#334155",
                            borderLeft: p.half === 0 ? "2px solid #1E293B" : "1px solid #1E293B11",
                          }}
                        >
                          {checked ? "\u2713" : "\u25CB"}
                        </div>
                      );
                    })}
                    <div style={{ padding: "6px 6px", textAlign: "center", fontSize: 10, color: "#64748B", borderLeft: "2px solid #3B82F6", background: "#0F1629", fontFamily: "'Space Mono',monospace" }}>
                      {checkCount}/{PERIODS.length}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#334155", marginTop: 8, textAlign: "center" }}>
          Scroll horizontally for all 26 pay periods &middot; Q END columns mark quarterly distribution points
        </p>
      </div>

      {/* Account Manager */}
      <Modal open={showAcctMgr} onClose={function() { setShowAcctMgr(false); setEditAcct(null); setConfirmDel(null); }} title="Manage Accounts">
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input style={Object.assign({}, baseInput, { flex: 2, minWidth: 120 })} placeholder="Account name..." value={newAcct.name} onChange={function(e) { setNewAcct(Object.assign({}, newAcct, { name: e.target.value })); }} />
          <input style={Object.assign({}, baseInput, { flex: 0, width: 70 })} type="number" step="0.1" placeholder="%" value={newAcct.pct} onChange={function(e) { setNewAcct(Object.assign({}, newAcct, { pct: e.target.value })); }} />
          <select style={Object.assign({}, baseSelect, { width: "auto", minWidth: 80 })} value={newAcct.tag} onChange={function(e) { setNewAcct(Object.assign({}, newAcct, { tag: e.target.value })); }}>
            <option value="">No tag</option>
            <option value="profit">Profit</option>
            <option value="tax">Tax</option>
          </select>
          <button onClick={handleAddAcct} style={Object.assign({}, btnBlue, { opacity: newAcct.name.trim() ? 1 : 0.4 })}>+ Add</button>
        </div>

        <div style={{ fontSize: 10, color: totalPct > 100 ? "#F87171" : "#64748B", marginBottom: 12, fontWeight: 600 }}>
          Total: {totalPct.toFixed(1)}% allocated &middot; {unallocated.toFixed(1)}% unallocated
          {totalPct > 100 && " \u2014 OVER 100%!"}
        </div>

        {accounts.map(function(acct) {
          if (editAcct?.id === acct.id) {
            return (
              <div key={acct.id} style={{ padding: "10px 0", borderBottom: "1px solid #1E293B22" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px", gap: 8, marginBottom: 8 }}>
                  <input style={baseInput} value={editAcct.name} onChange={function(e) { setEditAcct(Object.assign({}, editAcct, { name: e.target.value })); }} />
                  <input style={baseInput} type="number" step="0.1" value={editAcct.pct} onChange={function(e) { setEditAcct(Object.assign({}, editAcct, { pct: e.target.value })); }} />
                  <select style={baseSelect} value={editAcct.tag} onChange={function(e) { setEditAcct(Object.assign({}, editAcct, { tag: e.target.value })); }}>
                    <option value="">No tag</option>
                    <option value="profit">Profit</option>
                    <option value="tax">Tax</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={function() { setEditAcct(null); }} style={Object.assign({}, btnRed, { color: "#64748B", borderColor: "#1E293B", padding: "5px 12px", fontSize: 11 })}>Cancel</button>
                  <button onClick={handleSaveAcct} style={Object.assign({}, btnBlue, { padding: "5px 12px", fontSize: 11 })}>Save</button>
                </div>
              </div>
            );
          }
          return (
            <div key={acct.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: "1px solid #1E293B22" }}
              onMouseEnter={function(e) { e.currentTarget.style.background = "#1A2332"; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#64748B", minWidth: 45, textAlign: "right" }}>
                {acct.pct > 0 ? acct.pct + "%" : "0%"}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "#CBD5E1", fontWeight: 500 }}>{acct.name}</span>
              {acct.tag && (
                <span style={{ fontSize: 8, fontWeight: 700, color: tagColors[acct.tag], background: tagColors[acct.tag] + "22", padding: "2px 6px", borderRadius: 3 }}>
                  {tagLabels[acct.tag]}
                </span>
              )}
              {confirmDel === acct.id ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#F87171" }}>Delete?</span>
                  <button onClick={function() { handleDeleteAcct(acct.id); }} style={Object.assign({}, btnRed, { padding: "3px 8px", fontSize: 10 })}>Yes</button>
                  <button onClick={function() { setConfirmDel(null); }} style={Object.assign({}, btnRed, { color: "#64748B", borderColor: "#1E293B", padding: "3px 8px", fontSize: 10 })}>No</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={function() { setEditAcct(Object.assign({}, acct)); }} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12 }}>&#x270E;</button>
                  <button onClick={function() { setConfirmDel(acct.id); }} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12 }}>&#x2715;</button>
                </div>
              )}
            </div>
          );
        })}

        <p style={{ fontSize: 10, color: "#334155", marginTop: 12 }}>
          Tag "Profit" feeds the Vault &middot; Tag "Tax" accumulates in Tax Balance &middot; Changing % recalculates all periods instantly
        </p>
      </Modal>

      {/* Credit Card Manager */}
      <Modal open={showCardMgr} onClose={function() { setShowCardMgr(false); }} title="Manage Credit Cards">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={Object.assign({}, baseInput, { flex: 1 })} placeholder="Card name..." value={newCard} onChange={function(e) { setNewCard(e.target.value); }} />
          <button onClick={function() { if (newCard.trim()) { setCards(function(p) { return p.concat([newCard.trim()]); }); setNewCard(""); } }} style={Object.assign({}, btnBlue, { opacity: newCard.trim() ? 1 : 0.4 })}>+ Add</button>
        </div>
        {cards.map(function(card, i) {
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px solid #1E293B22" }}>
              <span style={{ fontSize: 13, color: "#CBD5E1" }}>{card}</span>
              <button onClick={function() { setCards(function(p) { return p.filter(function(_, j) { return j !== i; }); }); }} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12 }}>&#x2715;</button>
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
