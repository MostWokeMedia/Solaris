import { useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";

const INIT_CATEGORIES = ["Cosmic Pay","Sale of Body","Sale of Items","Sale of Service","Class/Workshop","Utilities","Taxes","Crypto","Subscriptions","Groceries","Dining Out","Reimbursement","Supplies","Stormy (Truck)","Gas","Dog Food/insur/Supply"];
const INIT_REVENUE_CATS = ["Cosmic Pay","Sale of Body","Sale of Items","Sale of Service","Class/Workshop"];
const INIT_EXPENSE_CATS = ["Reimbursement","Subscriptions","Dog Food/insur/Supply","Taxes","Groceries","Dining Out","Crypto","Supplies","Gas","Utilities","Stormy (Truck)"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CC = {
  "Reimbursement":"#EF4444","Subscriptions":"#8B5CF6","Dog Food/insur/Supply":"#F59E0B",
  "Taxes":"#DC2626","Groceries":"#10B981","Dining Out":"#EC4899","Crypto":"#3B82F6",
  "Supplies":"#F97316","Gas":"#14B8A6","Utilities":"#6366F1","Stormy (Truck)":"#A3E635",
  "Cosmic Pay":"#34D399","Sale of Body":"#22D3EE","Sale of Items":"#818CF8",
  "Sale of Service":"#FB923C","Class/Workshop":"#E879F9"
};

const BANKS = {
  "Generic CSV": { date:"Date", desc:"Description", amount:"Amount" },
  "Chase": { date:"Posting Date", desc:"Description", amount:"Amount" },
  "Wells Fargo": { date:"Date", desc:"Description", amount:"Amount" },
  "Discover": { date:"Trans. Date", desc:"Description", amount:"Amount" },
  "Capital One": { date:"Transaction Date", desc:"Description", amount:"Debit" },
};

// Transaction data compressed as arrays: [id, date, desc, amount, category, note]
const RAW = [[1,"2026-01-01","BJ raw",-208.99,"Dog Food/insur/Supply",""],[2,"2026-01-01","HEB",-74.85,"Groceries",""],[3,"2026-01-01","Skool",-184,"Subscriptions",""],[4,"2026-01-01","Taxes (Gal/UFCU)",-1682,"Taxes",""],[5,"2026-01-02","Cosmos Ranch pay",1000,"Cosmic Pay",""],[6,"2026-01-02","Anthropic",-5.33,"Subscriptions",""],[7,"2026-01-03","X",-40,"Subscriptions",""],[8,"2026-01-04","JDs",-9.11,"Groceries",""],[9,"2026-01-04","Google",-2.18,"Subscriptions",""],[10,"2026-01-05","kraken",-111,"Crypto",""],[11,"2026-01-05","kraken",-300,"Crypto",""],[12,"2026-01-06","DG",-4.95,"Groceries",""],[13,"2026-01-06","pearce Gas",-46.96,"Reimbursement",""],[14,"2026-01-06","pearce Gas",-35,"Reimbursement",""],[15,"2026-01-06","Skool",-9,"Subscriptions",""],[16,"2026-01-07","walmart",-28.92,"Groceries",""],[17,"2026-01-07","elory",-9.71,"Dining Out",""],[18,"2026-01-07","Cursor",-21.32,"Subscriptions",""],[19,"2026-01-07","Spotify",-12.98,"Subscriptions",""],[20,"2026-01-08","DG",-11,"Groceries",""],[21,"2026-01-08","Amazon",-66.74,"Reimbursement",""],[22,"2026-01-08","Cursor",-63.96,"Subscriptions",""],[23,"2026-01-08","Cursor refund",19.32,"Subscriptions",""],[24,"2026-01-09","Cosmos Ranch pay",1000,"Cosmic Pay",""],[25,"2026-01-09","Claude",-21.32,"Subscriptions",""],[26,"2026-01-10","HEB",-60.34,"Groceries",""],[27,"2026-01-10","Mint",-129.4,"Subscriptions",""],[28,"2026-01-11","Cursor",-213.2,"Subscriptions",""],[29,"2026-01-11","Cursor refund",55.1,"Subscriptions",""],[30,"2026-01-11","Helius",-49,"Subscriptions",""],[31,"2026-01-12","HEB",-85.42,"Groceries",""],[32,"2026-01-13","coffee",-15.63,"Dining Out",""],[33,"2026-01-13","mccoys",-112.54,"Reimbursement","tottle paid $200"],[34,"2026-01-14","elroy ice cream",-17.2,"Dining Out",""],[35,"2026-01-14","mccoys",-16.01,"Reimbursement",""],[36,"2026-01-14","Birdeye",-39,"Subscriptions",""],[37,"2026-01-15","heb",-40.44,"Groceries",""],[38,"2026-01-15","coffee",-14.12,"Dining Out",""],[39,"2026-01-15","heb",-49.79,"Groceries",""],[40,"2026-01-16","elroy ice cream",-8.65,"Dining Out",""],[41,"2026-01-16","home depot water",-14.73,"Groceries",""],[42,"2026-01-16","home depot",-21.63,"Supplies",""],[43,"2026-01-16","Home depot",-6.13,"Reimbursement",""],[44,"2026-01-16","home depot",-75.98,"Reimbursement",""],[45,"2026-01-16","Cosmos Ranch pay",1000,"Cosmic Pay",""],[46,"2026-01-18","Sprouts",-104.97,"Groceries",""],[47,"2026-01-19","walmart",-38.78,"Groceries",""],[48,"2026-01-19","Reimbursement check",246.82,"Sale of Body",""],[49,"2026-01-20","Home depot",-84.65,"Reimbursement",""],[50,"2026-01-20","coffee",-14.7,"Dining Out",""],[51,"2026-01-20","Gas",-67.54,"Reimbursement",""],[52,"2026-01-20","home depot",-84.65,"Reimbursement",""],[53,"2026-01-20","Kraken",-250,"Crypto",""],[54,"2026-01-21","elory",-10.48,"Dining Out",""],[55,"2026-01-21","DSW",-235.92,"Supplies",""],[56,"2026-01-21","Kraken",-15,"Crypto",""],[57,"2026-01-21","DSW",-235.92,"Subscriptions",""],[58,"2026-01-21","IQ",-20.74,"Subscriptions",""],[59,"2026-01-21","Lotus ranch Hay",-108,"Reimbursement",""],[60,"2026-01-22","bj raw",-208.99,"Dog Food/insur/Supply",""],[61,"2026-01-22","propane",-54,"Utilities",""],[62,"2026-01-22","coffee",-6.41,"Dining Out",""],[63,"2026-01-22","Gas",-14.52,"Reimbursement",""],[64,"2026-01-22","Gass",-77.34,"Reimbursement",""],[65,"2026-01-22","mccoys",-103.91,"Reimbursement",""],[66,"2026-01-22","mcoys chansaw",-955.77,"Reimbursement",""],[67,"2026-01-22","Lemonade Dog insure",-77.1,"Dog Food/insur/Supply",""],[68,"2026-01-22","Lemonade Dog insure",-94.93,"Dog Food/insur/Supply",""],[69,"2026-01-22","Nichole massage",-139.05,"Supplies",""],[70,"2026-01-23","ELORY",-15.49,"Gas",""],[71,"2026-01-23","coffee",-14.11,"Dining Out",""],[72,"2026-01-23","elroy ice cream",-24.17,"Dining Out",""],[73,"2026-01-23","Calahans straw",-120,"Reimbursement",""],[74,"2026-01-23","Calahans straw",-60,"Reimbursement",""],[75,"2026-01-23","Cosmos Ranch pay",1000,"Cosmic Pay",""],[76,"2026-01-26","HOME DEPOT",-10.26,"Supplies",""],[77,"2026-01-26","Reimbursement check",1591.98,"Sale of Body",""],[78,"2026-01-26","Coinbase card yearly",-49.99,"Crypto",""],[79,"2026-01-27","elory",-25.95,"Dining Out",""],[80,"2026-01-27","DG",-15.9,"Groceries",""],[81,"2026-01-27","HEB",-56.73,"Groceries",""],[82,"2026-01-28","coffee",-15.39,"Dining Out",""],[83,"2026-01-29","elory",-17.3,"Dining Out",""],[84,"2026-01-30","walmart",-6.55,"Groceries",""],[85,"2026-01-30","walmart",-65.1,"Supplies",""],[86,"2026-01-30","home depot",-153.15,"Reimbursement",""],[87,"2026-01-30","Cosmos Ranch pay",1000,"Cosmic Pay",""],[88,"2026-02-01","HEB",-90.96,"Groceries",""],[89,"2026-02-01","Digital ocean",-6.39,"Subscriptions",""],[90,"2026-02-02","Kraken",-111,"Crypto",""],[91,"2026-02-03","HEB",-50.43,"Groceries",""],[92,"2026-02-03","X.com",-40,"Subscriptions",""],[93,"2026-02-03","Govt truck papers",-178.19,"Subscriptions",""],[94,"2026-02-04","HEB",-66.92,"Groceries",""],[95,"2026-02-04","Google",-2.18,"Subscriptions",""],[96,"2026-02-05","kraken",-111,"Crypto",""],[97,"2026-02-06","coffee",-12.7,"Dining Out",""],[98,"2026-02-06","Elroy ice cream",-27.78,"Dining Out",""],[99,"2026-02-06","Cosmos Ranch pay",1000,"Cosmic Pay",""],[100,"2026-02-06","Skool",-9,"Subscriptions",""],[101,"2026-02-06","BJ raw",-208.99,"Dog Food/insur/Supply",""],[102,"2026-02-06","BJ raw refund",208.99,"Dog Food/insur/Supply",""],[103,"2026-02-07","HEB",-96.52,"Groceries",""],[104,"2026-02-07","Home depot",-69.6,"Supplies",""],[105,"2026-02-07","DG HDMI",-26.86,"Supplies",""],[106,"2026-02-07","Spotify",-12.98,"Subscriptions",""],[107,"2026-02-08","DG",-13.45,"Groceries",""],[108,"2026-02-08","o REILLY",-73.96,"Supplies",""],[109,"2026-02-08","homedepot",-400,"Subscriptions",""],[110,"2026-02-09","coffee",-15.97,"Dining Out",""],[111,"2026-02-09","Claude",-21.32,"Subscriptions",""],[112,"2026-02-09","Sunbelt",-130.39,"Subscriptions",""],[113,"2026-02-09","homedepot refund",400,"Subscriptions",""],[114,"2026-02-10","HEB",-48.73,"Groceries",""],[115,"2026-02-10","Sunbelt",-130.39,"Reimbursement",""],[116,"2026-02-10","Kraken",-150,"Crypto",""],[117,"2026-02-11","kraken",-111,"Crypto",""],[118,"2026-02-11","Helius",-49,"Subscriptions",""],[119,"2026-02-12","Gas",-44.45,"Gas",""],[120,"2026-02-12","HEB",-28.48,"Groceries",""],[121,"2026-02-13","Cosmos Ranch pay",1000,"Cosmic Pay",""],[122,"2026-02-13","BJ raw",-208.99,"Dog Food/insur/Supply",""],[123,"2026-02-13","Lotus ranch Hay",-72,"Reimbursement",""],[124,"2026-02-14","Birdeye",-39,"Subscriptions",""],[125,"2026-02-18","MCcoys",-30.48,"Supplies",""],[126,"2026-02-18","Audible",-16.18,"Subscriptions",""],[127,"2026-02-19","JD market",-12.8,"Groceries",""],[128,"2026-02-20","Cosmos Ranch pay",1000,"Cosmic Pay",""],[129,"2026-02-20","HEB",-62.1,"Groceries",""],[130,"2026-02-20","BJ raw rabbit",-31.74,"Dog Food/insur/Supply",""],[131,"2026-02-21","JB Raw dog food",-96.98,"Dog Food/insur/Supply",""],[132,"2026-02-21","IQ",-20.74,"Subscriptions",""],[133,"2026-02-22","HEB",-75.33,"Groceries",""],[134,"2026-02-22","BJ raw Rabbit",-96.98,"Dog Food/insur/Supply",""],[135,"2026-02-22","Lemonade Dog insure",-77.1,"Dog Food/insur/Supply",""],[136,"2026-02-22","Lemonade Dog insure",-94.93,"Dog Food/insur/Supply",""],[137,"2026-02-22","Hims and hers",-175,"Subscriptions",""],[138,"2026-02-24","HEB",-63.41,"Groceries",""],[139,"2026-02-25","Coffee",-4.5,"Dining Out",""],[140,"2026-02-25","Coffee",-3.8,"Dining Out",""],[141,"2026-02-25","Coffee",-20.21,"Dining Out",""],[142,"2026-02-25","Kraken",-120,"Crypto",""],[143,"2026-02-26","OSS",-10,"Subscriptions",""],[144,"2026-02-26","ATG",-20.26,"Subscriptions",""],[145,"2026-02-27","Cosmos Ranch pay",1000,"Cosmic Pay",""],[146,"2026-02-27","Ice Cream",-14.64,"Dining Out",""],[147,"2026-02-27","Gas",-40.12,"Gas",""],[148,"2026-02-28","Ice Cream",-9.99,"Dining Out",""],[149,"2026-02-28","Coffee",-14.33,"Dining Out",""],[150,"2026-03-01","Elroy",-22.79,"Groceries",""],[151,"2026-03-01","Coffee",-7.49,"Dining Out",""],[152,"2026-03-01","Digital ocean",-6.39,"Subscriptions",""],[153,"2026-03-02","BJ raw",-139.98,"Dog Food/insur/Supply",""],[154,"2026-03-02","HEB",-27.26,"Groceries",""],[155,"2026-03-02","HEB",-51.36,"Groceries",""],[156,"2026-03-03","ice cream",-22.7,"Dining Out",""],[157,"2026-03-03","BJ raw",-139.98,"Dog Food/insur/Supply",""],[158,"2026-03-03","X.com",-40,"Subscriptions",""],[159,"2026-03-04","ice cream",-22.76,"Dining Out",""],[160,"2026-03-04","Google",-2.18,"Subscriptions",""],[161,"2026-03-06","Cosmos Ranch pay",1000,"Cosmic Pay",""],[162,"2026-03-06","Coffee",-16.99,"Dining Out",""],[163,"2026-03-06","chips",-9.05,"Dining Out",""],[164,"2026-03-06","BJ raw refund",208.99,"Dog Food/insur/Supply",""],[165,"2026-03-06","Skool refund",9,"Subscriptions",""],[166,"2026-03-06","BJ raw refund",208.99,"Dog Food/insur/Supply",""],[167,"2026-03-07","Coffee",-8.66,"Dining Out",""],[168,"2026-03-07","HEB JUNK",-47.19,"Dining Out",""],[169,"2026-03-07","Spotify",-14.06,"Subscriptions",""],[170,"2026-03-08","ice cream",-14.59,"Dining Out",""],[171,"2026-03-08","Coffee",-8.66,"Dining Out",""],[172,"2026-03-08","claude",-106.39,"Subscriptions",""],[173,"2026-03-09","Ice cream",-8.65,"Dining Out",""],[174,"2026-03-09","mc coys",-34.83,"Supplies",""],[175,"2026-03-09","Cosmic reimurst",858.85,"Sale of Body",""],[176,"2026-03-10","gas",-36.96,"Gas",""],[177,"2026-03-10","coffee",-15.39,"Dining Out",""],[178,"2026-03-10","ice cream",-8.65,"Dining Out",""],[179,"2026-03-10","Home depot",-40,"Supplies",""],[180,"2026-03-10","Dollor G",-4.5,"Groceries",""],[181,"2026-03-10","Tractor supply",-166.46,"Supplies",""],[182,"2026-03-10","Walmart",-3.97,"Groceries",""],[183,"2026-03-10","Home depot",-157.61,"Reimbursement",""],[184,"2026-03-10","Prairie creek vet",-86.82,"Dog Food/insur/Supply",""],[185,"2026-03-10","Tractor supply dog",-166.46,"Dog Food/insur/Supply",""],[186,"2026-03-11","homedepot",-5.92,"Reimbursement",""],[187,"2026-03-11","coffee",-8.79,"Dining Out",""],[188,"2026-03-11","Walmart",-6.03,"Groceries",""],[189,"2026-03-11","Ice Cream",-17.3,"Dining Out",""],[190,"2026-03-11","Home depot return",80.75,"Sale of Items",""],[191,"2026-03-11","Helius",-49,"Subscriptions",""],[192,"2026-03-12","Gas",-42.9,"Reimbursement",""],[193,"2026-03-12","Dollor G",-4.5,"Groceries",""],[194,"2026-03-12","ice cream",-8.65,"Dining Out",""],[195,"2026-03-12","Gass",-80.32,"Reimbursement",""],[196,"2026-03-12","Gas",-80.32,"Gas",""],[197,"2026-03-13","Cosmos Ranch pay",1000,"Cosmic Pay",""],[198,"2026-03-13","HEB ice cream",-41.03,"Dining Out",""],[199,"2026-03-13","HEB mouthwash",-40,"Supplies",""],[200,"2026-03-13","Coffee",-15.63,"Dining Out",""],[201,"2026-03-14","Coffee",-15.63,"Dining Out",""],[202,"2026-03-14","Digital ocean",-2.74,"Subscriptions",""],[203,"2026-03-14","Helium",-0.63,"Subscriptions",""],[204,"2026-03-15","airport junk food",-18.42,"Dining Out",""],[205,"2026-03-15","Elroy",-8.65,"Dining Out",""],[206,"2026-03-15","Kans Thai",-24.52,"Dining Out",""],[207,"2026-03-16","Fairview coffee",-20.65,"Dining Out",""],[208,"2026-03-16","HEB",-22.69,"Dining Out",""],[209,"2026-03-16","Coffee",-10.64,"Dining Out",""],[210,"2026-03-16","Fairview coffee",-16.99,"Dining Out",""],[211,"2026-03-17","Elroy",-18.17,"Dining Out",""],[212,"2026-03-17","Lotus ranch Hay",-72,"Reimbursement",""],[213,"2026-03-18","Blueprint",-98,"Groceries",""],[214,"2026-03-18","Terrasoul",-110.47,"Groceries",""],[215,"2026-03-19","Elroy",-17.3,"Dining Out",""],[216,"2026-03-19","D store junkfood",-9,"Dining Out",""],[217,"2026-03-19","Kans Thai",-72.85,"Dining Out",""],[218,"2026-03-19","Kans Thai refund",39,"Dining Out",""],[219,"2026-03-19","Bj raw",-208.99,"Dog Food/insur/Supply",""],[220,"2026-03-20","Cosmos Ranch pay",1000,"Cosmic Pay",""],[221,"2026-03-20","Elroy",-17.3,"Dining Out",""],[222,"2026-03-20","Diesel",-71.61,"Reimbursement",""],[223,"2026-03-20","BJ raw",-208.99,"Dog Food/insur/Supply",""],[224,"2026-03-21","Gas",-40.18,"Gas",""],[225,"2026-03-21","walmart",-50.86,"Supplies",""],[226,"2026-03-21","Propane",-90,"Utilities",""],[227,"2026-03-22","Elroy",-8.65,"Dining Out",""],[228,"2026-03-22","Coffee",-7.49,"Dining Out",""],[229,"2026-03-22","Oreilly",-1.83,"Supplies",""],[230,"2026-03-23","elroy",-17.3,"Dining Out",""],[231,"2026-03-23","BJ raw rabbit",-180.98,"Dog Food/insur/Supply",""],[232,"2026-03-24","Coffee",-15.63,"Dining Out",""],[233,"2026-03-25","chips",-4.5,"Dining Out",""],[234,"2026-03-25","ice cream",-9.99,"Dining Out",""],[235,"2026-03-26","ice cream",-14.5,"Dining Out",""],[236,"2026-03-27","cosmos Ranch pay",1000,"Cosmic Pay",""],[237,"2026-03-28","pull up bar",-84.39,"Supplies",""],[238,"2026-03-28","coffee",-8.98,"Dining Out",""],[239,"2026-03-28","HEB",-19.32,"Supplies",""],[240,"2026-03-28","home depot",-19.45,"Supplies",""],[241,"2026-03-28","gas",-35.06,"Gas",""],[242,"2026-03-28","home depot",-58.43,"Reimbursement",""],[243,"2026-03-28","ice cream",-10,"Dining Out",""],[244,"2026-03-30","coffee",-7.38,"Dining Out",""],[245,"2026-03-30","ice cream",-13.71,"Dining Out",""],[246,"2026-03-30","gas",-33.35,"Reimbursement",""],[247,"2026-03-30","home depot",-6.47,"Reimbursement",""]];

const INIT = RAW.map(r => ({ id: r[0], date: r[1], desc: r[2], amount: r[3], category: r[4], note: r[5] }));

function fm(n) {
  const a = Math.abs(n);
  return (n < 0 ? "-" : "") + "$" + a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmS(n) {
  if (Math.abs(n) >= 1000) return (n < 0 ? "-" : "") + "$" + (Math.abs(n) / 1000).toFixed(1) + "k";
  return fm(n);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const parts = iso.split("-");
  return MONTHS[parseInt(parts[1]) - 1] + " " + parseInt(parts[2]);
}
function gM(iso) { return parseInt(iso.split("-")[1]); }

const iS = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #1E293B", background: "#0A0E17", color: "#E2E8F0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
const sS = { ...iS, cursor: "pointer", appearance: "none" };
const bP = { padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const bD = { padding: "8px 20px", borderRadius: 8, border: "1px solid #F8717133", background: "transparent", color: "#F87171", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ttS = { background: "#1E293B", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#E2E8F0" };

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111827", borderRadius: 16, border: "1px solid #1E293B", width: "100%", maxWidth: wide ? 640 : 440, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: "'Space Mono',monospace", color: "#E2E8F0" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Card({ label, value, accent, sub }) {
  return (
    <div style={{ background: "#111827", borderRadius: 12, padding: "16px 18px", border: "1px solid #1E293B", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700, color: accent, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ background: "#111827", borderRadius: 14, border: "1px solid #1E293B", padding: "20px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: "#94A3B8", margin: 0, fontWeight: 600 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function PnLDashboard() {
  const [txns, setTxns] = useState(INIT);
  const [categories, setCategories] = useState(INIT_CATEGORIES);
  const [revCats, setRevCats] = useState(INIT_REVENUE_CATS);
  const [expCats, setExpCats] = useState(INIT_EXPENSE_CATS);
  const [view, setView] = useState("overview");
  const [editTxn, setEditTxn] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [confirmCatDel, setConfirmCatDel] = useState(null);
  const [newTxn, setNewTxn] = useState({ date: "", desc: "", amount: "", category: "Groceries", note: "" });
  const [confirmDel, setConfirmDel] = useState(null);
  const [txnFilter, setTxnFilter] = useState("All");
  const [txnMonth, setTxnMonth] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [importBank, setImportBank] = useState("Generic CSV");
  const [importData, setImportData] = useState(null);
  const [importMapping, setImportMapping] = useState({ date: "", desc: "", amount: "" });
  const [importPreview, setImportPreview] = useState([]);
  const [drillCat, setDrillCat] = useState(null);
  const nextId = useRef(1000);

  function handleRenameCat(oldName, newName) {
    if (!newName.trim() || newName === oldName) { setEditingCat(null); return; }
    if (categories.includes(newName)) { setEditingCat(null); return; }
    setCategories(p => p.map(c => c === oldName ? newName : c));
    setRevCats(p => p.map(c => c === oldName ? newName : c));
    setExpCats(p => p.map(c => c === oldName ? newName : c));
    setTxns(p => p.map(t => t.category === oldName ? { ...t, category: newName } : t));
    setEditingCat(null);
  }

  function handleAddCat() {
    if (!newCatName.trim() || categories.includes(newCatName)) return;
    setCategories(p => [...p, newCatName]);
    if (newCatType === "revenue") setRevCats(p => [...p, newCatName]);
    else setExpCats(p => [...p, newCatName]);
    setNewCatName("");
    setNewCatType("expense");
  }

  function handleDeleteCat(name) {
    setCategories(p => p.filter(c => c !== name));
    setRevCats(p => p.filter(c => c !== name));
    setExpCats(p => p.filter(c => c !== name));
    setTxns(p => p.map(t => t.category === name ? { ...t, category: "Uncategorized" } : t));
    setConfirmCatDel(null);
  }

  const activeMonths = useMemo(() => MONTHS.filter((_, i) => txns.some(t => gM(t.date) === i + 1)), [txns]);

  const monthlyData = useMemo(() => MONTHS.map((m, i) => {
    const mt = txns.filter(t => gM(t.date) === i + 1);
    const rev = mt.filter(t => revCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
    const exp = mt.filter(t => !revCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
    return { month: m, revenue: Math.round(rev * 100) / 100, expenses: Math.round(Math.abs(exp) * 100) / 100, profit: Math.round((rev + exp) * 100) / 100 };
  }), [txns, revCats]);

  const catMonthly = useMemo(() => {
    const map = {};
    expCats.forEach(c => { map[c] = { total: 0 }; MONTHS.forEach(m => { map[c][m] = 0; }); });
    txns.filter(t => !revCats.includes(t.category) && t.amount < 0).forEach(t => {
      const m = MONTHS[gM(t.date) - 1];
      if (map[t.category]) { map[t.category][m] += Math.abs(t.amount); map[t.category].total += Math.abs(t.amount); }
    });
    return Object.entries(map).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => ({ name, ...data }));
  }, [txns, revCats, expCats]);

  const revMonthly = useMemo(() => {
    const map = {};
    revCats.forEach(c => { map[c] = { total: 0 }; MONTHS.forEach(m => { map[c][m] = 0; }); });
    txns.filter(t => revCats.includes(t.category) && t.amount > 0).forEach(t => {
      const m = MONTHS[gM(t.date) - 1];
      if (map[t.category]) { map[t.category][m] += t.amount; map[t.category].total += t.amount; }
    });
    return Object.entries(map).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => ({ name, ...data }));
  }, [txns, revCats, expCats]);

  const drillTxns = useMemo(() => {
    if (!drillCat) return [];
    return txns.filter(t => t.category === drillCat).sort((a, b) => a.date.localeCompare(b.date));
  }, [txns, drillCat]);

  const totalRev = txns.filter(t => revCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
  const totalExp = txns.filter(t => !revCats.includes(t.category) && t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const netIncome = totalRev + totalExp;
  const margin = totalRev ? ((netIncome / totalRev) * 100).toFixed(1) : 0;
  const maxCatVal = useMemo(() => Math.max(...catMonthly.flatMap(c => activeMonths.map(m => c[m] || 0)), 1), [catMonthly, activeMonths]);

  const filteredTxns = useMemo(() => {
    let f = [...txns];
    if (txnMonth !== "All") f = f.filter(t => gM(t.date) === MONTHS.indexOf(txnMonth) + 1);
    if (txnFilter === "Revenue") f = f.filter(t => revCats.includes(t.category));
    else if (txnFilter === "Expenses") f = f.filter(t => !revCats.includes(t.category));
    if (searchQ) f = f.filter(t => t.desc.toLowerCase().includes(searchQ.toLowerCase()) || t.category.toLowerCase().includes(searchQ.toLowerCase()));
    return f.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [txns, txnFilter, txnMonth, searchQ, revCats]);

  function handleSaveEdit() { setTxns(p => p.map(t => t.id === editTxn.id ? { ...editTxn, amount: parseFloat(editTxn.amount) || 0 } : t)); setEditTxn(null); }
  function handleAdd() { if (!newTxn.desc.trim() || !newTxn.date) return; setTxns(p => [...p, { ...newTxn, id: nextId.current++, amount: parseFloat(newTxn.amount) || 0 }]); setNewTxn({ date: "", desc: "", amount: "", category: "Groceries", note: "" }); setShowAdd(false); }
  function handleDelete(id) { setTxns(p => p.filter(t => t.id !== id)); setConfirmDel(null); setEditTxn(null); }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
      const preset = BANKS[importBank];
      const mapping = {
        date: headers.find(h => h.toLowerCase().includes(preset.date.toLowerCase())) || headers[0],
        desc: headers.find(h => h.toLowerCase().includes(preset.desc.toLowerCase())) || headers[1],
        amount: headers.find(h => h.toLowerCase().includes(preset.amount.toLowerCase())) || headers[2],
      };
      setImportMapping(mapping);
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(s => s.replace(/"/g, "").trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setImportData({ headers, rows });
      setImportPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!importData) return;
    const newTxns = importData.rows.map(row => {
      let ds = row[importMapping.date] || "";
      if (ds.includes("/")) {
        const p = ds.split("/");
        ds = (p[2].length === 2 ? "20" + p[2] : p[2]) + "-" + p[0].padStart(2, "0") + "-" + p[1].padStart(2, "0");
      }
      let amt = parseFloat((row[importMapping.amount] || "0").replace(/[$,]/g, ""));
      if (isNaN(amt)) amt = 0;
      return { id: nextId.current++, date: ds, desc: row[importMapping.desc] || "Unknown", amount: amt, category: "Uncategorized", note: "imported" };
    }).filter(t => t.date && t.amount !== 0);
    setTxns(p => [...p, ...newTxns]);
    setShowImport(false);
    setImportData(null);
    setImportPreview([]);
  }

  function heatColor(val, max) {
    if (!val) return "transparent";
    const intensity = Math.min(val / max, 1);
    return "rgba(239,68,68," + (0.15 + intensity * 0.65) + ")";
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#0A0E17", color: "#E2E8F0", minHeight: "100vh", padding: "28px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 980, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#34D399,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Spencer's P&L</h1>
            <p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>2026 Profit & Loss</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["overview", "categories", "revenue", "transactions"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "7px 16px", borderRadius: 8, border: view === v ? "1px solid #3B82F6" : "1px solid #1E293B", background: view === v ? "#1E3A5F" : "#111827", color: view === v ? "#93C5FD" : "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
          <Card label="Revenue" value={fm(totalRev)} accent="#34D399" />
          <Card label="Expenses" value={fm(Math.abs(totalExp))} accent="#F87171" />
          <Card label="Net Income" value={fm(netIncome)} accent={netIncome >= 0 ? "#34D399" : "#F87171"} sub={margin + "% margin"} />
          <Card label="Transactions" value={txns.length} accent="#818CF8" sub={activeMonths.length + " months tracked"} />
        </div>

        {/* OVERVIEW */}
        {view === "overview" && (
          <>
            <Section title="Monthly Revenue vs Expenses">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData.filter(d => d.revenue > 0 || d.expenses > 0)} barGap={4}>
                  <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmS(v)} />
                  <Tooltip contentStyle={ttS} formatter={v => fm(v)} />
                  <Bar dataKey="revenue" fill="#34D399" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#F87171" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Monthly Profit/Loss">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData.filter(d => d.revenue > 0 || d.expenses > 0)}>
                  <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "$" + v} />
                  <Tooltip contentStyle={ttS} formatter={v => fm(v)} />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]} name="Profit/Loss">
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#34D399" : "#F87171"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8, fontSize: 12 }}>
                {monthlyData.filter(d => d.revenue > 0 || d.expenses > 0).map(d => (
                  <div key={d.month} style={{ textAlign: "center" }}>
                    <div style={{ color: "#64748B" }}>{d.month}</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, color: d.profit >= 0 ? "#34D399" : "#F87171" }}>{fm(d.profit)}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* categories */}
        {view === "categories" && (
          <>
            <Section title="Expense Heatmap — Category x Month" action={<span style={{ fontSize: 10, color: "#475569" }}>Click a row to drill down</span>}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748B", fontWeight: 600, fontSize: 10, borderBottom: "1px solid #1E293B", minWidth: 150 }}>Category</th>
                      {activeMonths.map(m => <th key={m} style={{ textAlign: "right", padding: "8px 8px", color: "#64748B", fontWeight: 600, fontSize: 10, borderBottom: "1px solid #1E293B", minWidth: 70 }}>{m}</th>)}
                      <th style={{ textAlign: "right", padding: "8px 10px", color: "#94A3B8", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #1E293B", minWidth: 80 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catMonthly.map((c) => (
                      <tr key={c.name} onClick={() => setDrillCat(c.name)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1A2332"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #1E293B22" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: CC[c.name] || "#64748B", flexShrink: 0 }} />
                            <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{c.name}</span>
                          </div>
                        </td>
                        {activeMonths.map(m => (
                          <td key={m} style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1E293B22", background: heatColor(c[m], maxCatVal), borderRadius: 2 }}>
                            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: c[m] ? "#E2E8F0" : "#334155", fontWeight: c[m] ? 600 : 400 }}>
                              {c[m] ? fm(c[m]) : "—"}
                            </span>
                          </td>
                        ))}
                        <td style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #1E293B22", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#F87171", fontSize: 12 }}>{fm(c.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#0F1629" }}>
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: "#94A3B8" }}>Total</td>
                      {activeMonths.map(m => {
                        const t = catMonthly.reduce((s, c) => s + (c[m] || 0), 0);
                        return <td key={m} style={{ textAlign: "right", padding: "10px 8px", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#F87171", fontSize: 12 }}>{fm(t)}</td>;
                      })}
                      <td style={{ textAlign: "right", padding: "10px 10px", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#F87171", fontSize: 13 }}>{fm(Math.abs(totalExp))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* REVENUE */}
        {view === "revenue" && (
          <>
            <Section title="Revenue Sources — Monthly Breakdown">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748B", fontWeight: 600, fontSize: 10, borderBottom: "1px solid #1E293B", minWidth: 140 }}>Source</th>
                      {activeMonths.map(m => <th key={m} style={{ textAlign: "right", padding: "8px 8px", color: "#64748B", fontWeight: 600, fontSize: 10, borderBottom: "1px solid #1E293B", minWidth: 80 }}>{m}</th>)}
                      <th style={{ textAlign: "right", padding: "8px 10px", color: "#94A3B8", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #1E293B" }}>Total</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: "#94A3B8", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #1E293B" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revMonthly.map(c => (
                      <tr key={c.name} onClick={() => setDrillCat(c.name)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1A2332"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #1E293B22" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: CC[c.name] || "#34D399", flexShrink: 0 }} />
                            <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{c.name}</span>
                          </div>
                        </td>
                        {activeMonths.map(m => <td key={m} style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1E293B22", fontFamily: "'Space Mono',monospace", fontSize: 11, color: c[m] ? "#34D399" : "#334155" }}>{c[m] ? fm(c[m]) : "—"}</td>)}
                        <td style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #1E293B22", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#34D399" }}>{fm(c.total)}</td>
                        <td style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #1E293B22", fontFamily: "'Space Mono',monospace", fontWeight: 600, color: "#94A3B8", fontSize: 11 }}>{totalRev ? (c.total / totalRev * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#0F1629" }}>
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: "#94A3B8" }}>Total Revenue</td>
                      {activeMonths.map(m => {
                        const t = revMonthly.reduce((s, c) => s + (c[m] || 0), 0);
                        return <td key={m} style={{ textAlign: "right", padding: "10px 8px", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#34D399", fontSize: 12 }}>{fm(t)}</td>;
                      })}
                      <td style={{ textAlign: "right", padding: "10px 10px", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#34D399", fontSize: 13 }}>{fm(totalRev)}</td>
                      <td style={{ textAlign: "right", padding: "10px 10px", fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#94A3B8" }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Revenue Insights">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                <div style={{ background: "#0A0E17", borderRadius: 10, padding: 16, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Primary Source</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#34D399", fontFamily: "'Space Mono',monospace" }}>Cosmic Pay</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{totalRev ? ((revMonthly.find(r => r.name === "Cosmic Pay")?.total || 0) / totalRev * 100).toFixed(0) : 0}% of all revenue</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>~$1,000/week from ranch work</div>
                </div>
                <div style={{ background: "#0A0E17", borderRadius: 10, padding: 16, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Secondary Income</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#22D3EE", fontFamily: "'Space Mono',monospace" }}>Sale of Body</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{fm(revMonthly.find(r => r.name === "Sale of Body")?.total || 0)} Q1 total</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Reimbursement checks from ranch</div>
                </div>
                <div style={{ background: "#0A0E17", borderRadius: 10, padding: 16, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Untapped Potential</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B", fontFamily: "'Space Mono',monospace" }}>$0.00</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Class/Workshop & Sale of Service</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>No revenue yet — growth opportunity</div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* TRANSACTIONS */}
        {view === "transactions" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...iS, maxWidth: 220 }} placeholder="Search..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              <select style={{ ...sS, width: "auto", minWidth: 90 }} value={txnMonth} onChange={e => setTxnMonth(e.target.value)}>
                <option value="All">All Months</option>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
              <select style={{ ...sS, width: "auto", minWidth: 90 }} value={txnFilter} onChange={e => setTxnFilter(e.target.value)}>
                <option value="All">All Types</option>
                <option value="Revenue">Revenue</option>
                <option value="Expenses">Expenses</option>
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowCatMgr(true)} style={{ ...bP, background: "linear-gradient(135deg,#F59E0B,#D97706)", fontSize: 12 }}>Categories</button>
              <button onClick={() => setShowImport(true)} style={{ ...bP, background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", fontSize: 12 }}>Import CSV</button>
              <button onClick={() => setShowAdd(true)} style={{ ...bP, fontSize: 12 }}>+ Add</button>
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{filteredTxns.length} transactions</div>
            <div style={{ background: "#111827", borderRadius: 14, border: "1px solid #1E293B", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr 0.9fr 1.2fr", padding: "12px 18px", background: "#0F1629", borderBottom: "1px solid #1E293B", fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                <div>Date</div><div>Description</div><div style={{ textAlign: "right" }}>Amount</div><div style={{ textAlign: "right" }}>Category</div>
              </div>
              <div style={{ maxHeight: 500, overflow: "auto" }}>
                {filteredTxns.map(t => (
                  <div key={t.id} onClick={() => { setEditTxn({ ...t }); setConfirmDel(null); }}
                    style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr 0.9fr 1.2fr", padding: "10px 18px", borderBottom: "1px solid #1E293B11", alignItems: "center", cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#1A2332"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{fmtDate(t.date)}</div>
                    <div>
                      <div style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>{t.desc}</div>
                      {t.note && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{t.note}</div>}
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700, color: t.amount >= 0 ? "#34D399" : "#F87171" }}>{fm(t.amount)}</div>
                    <div style={{ textAlign: "right", fontSize: 11, color: "#64748B" }}>{t.category}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drill-Down Modal */}
      <Modal open={!!drillCat} onClose={() => setDrillCat(null)} title={drillCat + " — All Transactions"} wide>
        {drillCat && (
          <>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
              {drillTxns.length} transactions · Total: <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, color: revCats.includes(drillCat) ? "#34D399" : "#F87171" }}>{fm(drillTxns.reduce((s, t) => s + t.amount, 0))}</span>
            </div>
            <div style={{ maxHeight: 400, overflow: "auto" }}>
              {drillTxns.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1E293B22", fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ color: "#64748B", minWidth: 60 }}>{fmtDate(t.date)}</span>
                    <span style={{ color: "#CBD5E1" }}>{t.desc}</span>
                  </div>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 600, color: t.amount >= 0 ? "#34D399" : "#F87171" }}>{fm(t.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editTxn} onClose={() => setEditTxn(null)} title="Edit Transaction">
        {editTxn && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Date"><input style={iS} type="date" value={editTxn.date} onChange={e => setEditTxn({ ...editTxn, date: e.target.value })} /></Field>
              <Field label="Amount"><input style={iS} type="number" step="0.01" value={editTxn.amount} onChange={e => setEditTxn({ ...editTxn, amount: e.target.value })} /></Field>
            </div>
            <Field label="Description"><input style={iS} value={editTxn.desc} onChange={e => setEditTxn({ ...editTxn, desc: e.target.value })} /></Field>
            <Field label="Category">
              <select style={sS} value={editTxn.category} onChange={e => setEditTxn({ ...editTxn, category: e.target.value })}>
                {categories.map(c => <option key={c}>{c}</option>)}
                <option>Uncategorized</option>
              </select>
            </Field>
            <Field label="Note"><input style={iS} value={editTxn.note} onChange={e => setEditTxn({ ...editTxn, note: e.target.value })} /></Field>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", gap: 8 }}>
              {confirmDel === editTxn.id ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#F87171" }}>Sure?</span>
                  <button onClick={() => handleDelete(editTxn.id)} style={{ ...bD, padding: "6px 12px", fontSize: 11 }}>Yes</button>
                  <button onClick={() => setConfirmDel(null)} style={{ ...bD, color: "#64748B", borderColor: "#1E293B", padding: "6px 12px", fontSize: 11 }}>No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(editTxn.id)} style={bD}>Delete</button>
              )}
              <button onClick={handleSaveEdit} style={bP}>Save</button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Date"><input style={iS} type="date" value={newTxn.date} onChange={e => setNewTxn({ ...newTxn, date: e.target.value })} /></Field>
          <Field label="Amount (neg=expense)"><input style={iS} type="number" step="0.01" value={newTxn.amount} placeholder="-25.00" onChange={e => setNewTxn({ ...newTxn, amount: e.target.value })} /></Field>
        </div>
        <Field label="Description"><input style={iS} value={newTxn.desc} placeholder="e.g. HEB groceries" onChange={e => setNewTxn({ ...newTxn, desc: e.target.value })} /></Field>
        <Field label="Category">
          <select style={sS} value={newTxn.category} onChange={e => setNewTxn({ ...newTxn, category: e.target.value })}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)"><input style={iS} value={newTxn.note} onChange={e => setNewTxn({ ...newTxn, note: e.target.value })} /></Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button onClick={() => setShowAdd(false)} style={{ ...bD, color: "#64748B", borderColor: "#1E293B" }}>Cancel</button>
          <button onClick={handleAdd} style={{ ...bP, opacity: newTxn.desc.trim() && newTxn.date ? 1 : 0.4 }}>Add</button>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportData(null); setImportPreview([]); }} title="Import Bank CSV" wide>
        <Field label="Bank / Format">
          <select style={sS} value={importBank} onChange={e => setImportBank(e.target.value)}>
            {Object.keys(BANKS).map(b => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Upload CSV">
          <input type="file" accept=".csv" onChange={handleFileSelect} style={{ ...iS, padding: "8px", cursor: "pointer" }} />
        </Field>
        {importData && (
          <>
            <p style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>Map columns:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {["date", "desc", "amount"].map(f => (
                <Field key={f} label={f === "desc" ? "Description" : f.charAt(0).toUpperCase() + f.slice(1)}>
                  <select style={sS} value={importMapping[f]} onChange={e => setImportMapping({ ...importMapping, [f]: e.target.value })}>
                    <option value="">— skip —</option>
                    {importData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </Field>
              ))}
            </div>
            <div style={{ background: "#0A0E17", borderRadius: 8, padding: 12, marginBottom: 14, border: "1px solid #1E293B" }}>
              <div style={{ fontSize: 10, color: "#64748B", marginBottom: 6, fontWeight: 600 }}>PREVIEW ({importData.rows.length} rows)</div>
              <div style={{ overflow: "auto", maxHeight: 120 }}>
                {importPreview.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "3px 0", borderBottom: "1px solid #1E293B22", fontSize: 11, color: "#94A3B8" }}>
                    <span style={{ width: 75 }}>{r[importMapping.date]}</span>
                    <span style={{ flex: 1 }}>{r[importMapping.desc]}</span>
                    <span style={{ width: 65, textAlign: "right", fontFamily: "'Space Mono',monospace" }}>{r[importMapping.amount]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setImportData(null); setImportPreview([]); }} style={{ ...bD, color: "#64748B", borderColor: "#1E293B" }}>Cancel</button>
              <button onClick={handleImport} style={bP}>Import {importData.rows.length} Transactions</button>
            </div>
          </>
        )}
      </Modal>

      {/* Category Manager Modal */}
      <Modal open={showCatMgr} onClose={() => { setShowCatMgr(false); setEditingCat(null); setConfirmCatDel(null); }} title="Manage Categories" wide>
        {/* Add New Category */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input style={{ ...iS, flex: 1 }} placeholder="New category name..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
          <select style={{ ...sS, width: "auto", minWidth: 100 }} value={newCatType} onChange={e => setNewCatType(e.target.value)}>
            <option value="expense">Expense</option>
            <option value="revenue">Revenue</option>
          </select>
          <button onClick={handleAddCat} style={{ ...bP, opacity: newCatName.trim() ? 1 : 0.4, whiteSpace: "nowrap" }}>+ Add</button>
        </div>

        {/* Revenue Categories */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Revenue Categories</div>
        <div style={{ marginBottom: 20 }}>
          {categories.filter(c => revCats.includes(c)).map(cat => {
            const count = txns.filter(t => t.category === cat).length;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #1E293B22", borderRadius: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1A2332"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CC[cat] || "#34D399", flexShrink: 0 }} />
                {editingCat === cat ? (
                  <input style={{ ...iS, flex: 1, padding: "4px 8px", fontSize: 12 }} autoFocus value={editCatName}
                    onChange={e => setEditCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRenameCat(cat, editCatName); if (e.key === "Escape") setEditingCat(null); }}
                    onBlur={() => handleRenameCat(cat, editCatName)} />
                ) : (
                  <span onClick={() => { setEditingCat(cat); setEditCatName(cat); }} style={{ flex: 1, color: "#CBD5E1", fontSize: 13, cursor: "pointer" }}>{cat}</span>
                )}
                <span style={{ fontSize: 10, color: "#475569" }}>{count} txns</span>
                {confirmCatDel === cat ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={() => handleDeleteCat(cat)} style={{ ...bD, padding: "3px 8px", fontSize: 10 }}>Yes</button>
                    <button onClick={() => setConfirmCatDel(null)} style={{ ...bD, color: "#64748B", borderColor: "#1E293B", padding: "3px 8px", fontSize: 10 }}>No</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setEditingCat(cat); setEditCatName(cat); }} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>✎</button>
                    <button onClick={() => setConfirmCatDel(cat)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>✕</button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Expense Categories */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#F87171", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Expense Categories</div>
        <div>
          {categories.filter(c => expCats.includes(c)).map(cat => {
            const count = txns.filter(t => t.category === cat).length;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #1E293B22", borderRadius: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1A2332"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CC[cat] || "#F87171", flexShrink: 0 }} />
                {editingCat === cat ? (
                  <input style={{ ...iS, flex: 1, padding: "4px 8px", fontSize: 12 }} autoFocus value={editCatName}
                    onChange={e => setEditCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRenameCat(cat, editCatName); if (e.key === "Escape") setEditingCat(null); }}
                    onBlur={() => handleRenameCat(cat, editCatName)} />
                ) : (
                  <span onClick={() => { setEditingCat(cat); setEditCatName(cat); }} style={{ flex: 1, color: "#CBD5E1", fontSize: 13, cursor: "pointer" }}>{cat}</span>
                )}
                <span style={{ fontSize: 10, color: "#475569" }}>{count} txns</span>
                {confirmCatDel === cat ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={() => handleDeleteCat(cat)} style={{ ...bD, padding: "3px 8px", fontSize: 10 }}>Yes</button>
                    <button onClick={() => setConfirmCatDel(null)} style={{ ...bD, color: "#64748B", borderColor: "#1E293B", padding: "3px 8px", fontSize: 10 }}>No</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setEditingCat(cat); setEditCatName(cat); }} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>✎</button>
                    <button onClick={() => setConfirmCatDel(cat)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>✕</button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Uncategorized notice */}
        {txns.some(t => t.category === "Uncategorized") && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#3B2E0D", borderRadius: 8, fontSize: 11, color: "#FBBF24" }}>
            {txns.filter(t => t.category === "Uncategorized").length} transactions are uncategorized — edit them in the Transactions tab to assign a category.
          </div>
        )}

        <p style={{ fontSize: 10, color: "#334155", marginTop: 16 }}>Click a name to rename · Renaming updates all transactions in that category · Deleting moves transactions to "Uncategorized"</p>
      </Modal>
    </div>
  );
}
