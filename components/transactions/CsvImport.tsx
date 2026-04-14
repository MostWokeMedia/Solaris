'use client';

import { useState } from 'react';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';

const BANKS: Record<string, { date: string; desc: string; amount: string }> = {
  'Generic CSV': { date: 'Date', desc: 'Description', amount: 'Amount' },
  'Chase': { date: 'Posting Date', desc: 'Description', amount: 'Amount' },
  'Wells Fargo': { date: 'Date', desc: 'Description', amount: 'Amount' },
  'Bank of America': { date: 'Date', desc: 'Description', amount: 'Amount' },
  'Discover': { date: 'Trans. Date', desc: 'Description', amount: 'Amount' },
  'Capital One': { date: 'Transaction Date', desc: 'Description', amount: 'Debit' },
};

export type ImportedTransaction = {
  date: string;
  description: string;
  amount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (transactions: ImportedTransaction[]) => void;
};

const inputStyle = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500";
const inputColors = { background: '#0A0E17', borderColor: '#1E293B', color: '#E2E8F0' };

export default function CsvImport({ open, onClose, onImport }: Props) {
  const [bank, setBank] = useState('Generic CSV');
  const [importData, setImportData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState({ date: '', desc: '', amount: '' });
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);

  function handleClose() {
    onClose();
    setImportData(null);
    setPreview([]);
    setImporting(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
      const preset = BANKS[bank];
      const autoMapping = {
        date: headers.find((h) => h.toLowerCase().includes(preset.date.toLowerCase())) || headers[0],
        desc: headers.find((h) => h.toLowerCase().includes(preset.desc.toLowerCase())) || headers[1],
        amount: headers.find((h) => h.toLowerCase().includes(preset.amount.toLowerCase())) || headers[2],
      };
      setMapping(autoMapping);

      const rows = lines.slice(1).map((line) => {
        // Handle quoted CSV fields
        const vals: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; continue; }
          if (char === ',' && !inQuotes) { vals.push(current.trim()); current = ''; continue; }
          current += char;
        }
        vals.push(current.trim());

        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      });

      setImportData({ headers, rows });
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!importData) return;
    setImporting(true);

    const transactions: ImportedTransaction[] = importData.rows
      .map((row) => {
        let dateStr = row[mapping.date] || '';
        // Convert MM/DD/YYYY to YYYY-MM-DD
        if (dateStr.includes('/')) {
          const p = dateStr.split('/');
          dateStr = (p[2].length === 2 ? '20' + p[2] : p[2]) + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0');
        }
        let amt = parseFloat((row[mapping.amount] || '0').replace(/[$,]/g, ''));
        if (isNaN(amt)) amt = 0;

        return {
          date: dateStr,
          description: row[mapping.desc] || 'Unknown',
          amount: amt,
        };
      })
      .filter((t) => t.date && t.amount !== 0);

    onImport(transactions);
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank CSV" wide>
      <Field label="Bank / Format">
        <select
          className={inputStyle}
          style={{ ...inputColors, cursor: 'pointer' }}
          value={bank}
          onChange={(e) => setBank(e.target.value)}
        >
          {Object.keys(BANKS).map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </Field>

      <Field label="Upload CSV">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className={inputStyle}
          style={{ ...inputColors, padding: '8px', cursor: 'pointer' }}
        />
      </Field>

      {importData && (
        <>
          <p className="mb-2 text-xs" style={{ color: '#64748B' }}>Map columns:</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(['date', 'desc', 'amount'] as const).map((f) => (
              <Field key={f} label={f === 'desc' ? 'Description' : f.charAt(0).toUpperCase() + f.slice(1)}>
                <select
                  className={inputStyle}
                  style={{ ...inputColors, cursor: 'pointer' }}
                  value={mapping[f]}
                  onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}
                >
                  <option value="">— skip —</option>
                  {importData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>

          {/* Preview */}
          <div
            className="mb-4 rounded-lg border p-3"
            style={{ background: '#0A0E17', borderColor: '#1E293B' }}
          >
            <div className="mb-1.5 text-[10px] font-semibold" style={{ color: '#64748B' }}>
              PREVIEW ({importData.rows.length} rows)
            </div>
            <div className="max-h-[120px] overflow-auto">
              {preview.map((r, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-1 text-xs"
                  style={{ borderBottom: '1px solid #1E293B22', color: '#94A3B8' }}
                >
                  <span className="w-[75px]">{r[mapping.date]}</span>
                  <span className="flex-1">{r[mapping.desc]}</span>
                  <span
                    className="w-[65px] text-right"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {r[mapping.amount]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setImportData(null); setPreview([]); }}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}
            >
              {importing ? 'Importing...' : `Import ${importData.rows.length} Transactions`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
