'use client';

import { useState } from 'react';
import Modal from '@/components/shared/Modal';
import Field from '@/components/shared/Field';
import type { Category } from '@/types';

const BANKS: Record<string, { date: string; desc: string; amount: string; isCreditCard: boolean }> = {
  'Generic CSV': { date: 'Date', desc: 'Description', amount: 'Amount', isCreditCard: false },
  'Chase (Checking)': { date: 'Posting Date', desc: 'Description', amount: 'Amount', isCreditCard: false },
  'Chase (Credit Card)': { date: 'Posting Date', desc: 'Description', amount: 'Amount', isCreditCard: true },
  'Wells Fargo': { date: 'Date', desc: 'Description', amount: 'Amount', isCreditCard: false },
  'Bank of America': { date: 'Date', desc: 'Description', amount: 'Amount', isCreditCard: false },
  'Discover (Credit Card)': { date: 'Trans. Date', desc: 'Description', amount: 'Amount', isCreditCard: true },
  'Capital One (Credit Card)': { date: 'Transaction Date', desc: 'Description', amount: 'Debit', isCreditCard: true },
  'Master Card (Credit Card)': { date: 'Date', desc: 'Description', amount: 'Amount', isCreditCard: true },
};

const CONFIDENCE_COLORS = {
  high: '#34D399',
  medium: '#FBBF24',
  low: '#F87171',
};

export type ImportedTransaction = {
  date: string;
  description: string;
  original_description: string;
  amount: number;
  category_id: string | null;
};

type AiSuggestion = {
  cleaned_description: string;
  suggested_category: string;
  confidence: 'high' | 'medium' | 'low';
};

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (transactions: ImportedTransaction[]) => void;
  categories: Category[];
};

type Step = 'upload' | 'categorizing' | 'review';

const inputStyle = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500";
const inputColors = { background: '#0A0E17', borderColor: '#1E293B', color: '#E2E8F0' };

export default function CsvImport({ open, onClose, onImport, categories }: Props) {
  const [bank, setBank] = useState('Generic CSV');
  const [flipSigns, setFlipSigns] = useState(false);
  const [importData, setImportData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState({ date: '', desc: '', amount: '' });
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [reviewRows, setReviewRows] = useState<Array<{
    date: string;
    original_description: string;
    cleaned_description: string;
    amount: number;
    category_id: string | null;
    confidence: 'high' | 'medium' | 'low';
  }>>([]);
  const [aiError, setAiError] = useState('');

  function handleClose() {
    onClose();
    setImportData(null);
    setPreview([]);
    setStep('upload');
    setParsedRows([]);
    setSuggestions([]);
    setReviewRows([]);
    setAiError('');
    setFlipSigns(false);
  }

  function handleBankChange(newBank: string) {
    setBank(newBank);
    setFlipSigns(BANKS[newBank]?.isCreditCard ?? false);
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

  function parseRows(): ParsedRow[] {
    if (!importData) return [];
    return importData.rows
      .map((row) => {
        let dateStr = row[mapping.date] || '';
        if (dateStr.includes('/')) {
          const p = dateStr.split('/');
          dateStr = (p[2].length === 2 ? '20' + p[2] : p[2]) + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0');
        }
        let amt = parseFloat((row[mapping.amount] || '0').replace(/[$,]/g, ''));
        if (isNaN(amt)) amt = 0;
        if (flipSigns) amt = -amt;
        return { date: dateStr, description: row[mapping.desc] || 'Unknown', amount: amt };
      })
      .filter((t) => t.date && t.amount !== 0);
  }

  async function handleCategorize() {
    const parsed = parseRows();
    setParsedRows(parsed);
    setStep('categorizing');
    setAiError('');

    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: parsed.map((t) => ({ description: t.description, amount: t.amount })),
        }),
      });

      if (!res.ok) throw new Error('Categorization failed');

      const { results } = await res.json() as {
        results: AiSuggestion[];
      };
      setSuggestions(results);

      // Build review rows with AI suggestions mapped to category IDs
      const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const review = parsed.map((row, i) => {
        const suggestion = results[i];
        const categoryId = catMap.get(suggestion?.suggested_category?.toLowerCase() || '') || null;
        return {
          date: row.date,
          original_description: row.description,
          cleaned_description: suggestion?.cleaned_description || row.description,
          amount: row.amount,
          category_id: categoryId,
          confidence: suggestion?.confidence || 'low' as const,
        };
      });
      setReviewRows(review);
      setStep('review');
    } catch {
      // If AI fails, fall back to import without categorization
      setAiError('AI categorization unavailable. You can still import without categories.');
      const review = parsed.map((row) => ({
        date: row.date,
        original_description: row.description,
        cleaned_description: row.description,
        amount: row.amount,
        category_id: null,
        confidence: 'low' as const,
      }));
      setReviewRows(review);
      setStep('review');
    }
  }

  function handleSkipAi() {
    const parsed = parseRows();
    setParsedRows(parsed);
    const review = parsed.map((row) => ({
      date: row.date,
      original_description: row.description,
      cleaned_description: row.description,
      amount: row.amount,
      category_id: null,
      confidence: 'low' as const,
    }));
    setReviewRows(review);
    setStep('review');
  }

  function handleFinalImport() {
    const transactions: ImportedTransaction[] = reviewRows.map((r) => ({
      date: r.date,
      description: r.cleaned_description,
      original_description: r.original_description,
      amount: r.amount,
      category_id: r.category_id,
    }));
    onImport(transactions);
    handleClose();
  }

  function updateReviewRow(index: number, field: string, value: string) {
    setReviewRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank CSV" wide>
      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <>
          <Field label="Bank / Format">
            <select
              className={inputStyle}
              style={{ ...inputColors, cursor: 'pointer' }}
              value={bank}
              onChange={(e) => handleBankChange(e.target.value)}
            >
              {Object.keys(BANKS).map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>

          {/* Flip signs toggle */}
          <div
            className="mb-4 flex items-center gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: flipSigns ? '#FBBF2444' : '#1E293B',
              background: flipSigns ? '#3B2E0D' : 'transparent',
            }}
          >
            <button
              onClick={() => setFlipSigns(!flipSigns)}
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: flipSigns ? '#FBBF24' : '#334155', cursor: 'pointer', border: 'none' }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                style={{
                  background: '#E2E8F0',
                  left: flipSigns ? 18 : 2,
                }}
              />
            </button>
            <div>
              <div className="text-xs font-semibold" style={{ color: flipSigns ? '#FBBF24' : '#94A3B8' }}>
                Credit Card Mode {flipSigns ? 'ON' : 'OFF'}
              </div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>
                {flipSigns
                  ? 'Signs will be flipped: purchases → expenses, payments → positive'
                  : 'Amounts imported as-is (use for checking/savings accounts)'}
              </div>
            </div>
          </div>

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
                      {importData.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                ))}
              </div>

              <div className="mb-4 rounded-lg border p-3" style={{ background: '#0A0E17', borderColor: '#1E293B' }}>
                <div className="mb-1.5 text-[10px] font-semibold" style={{ color: '#64748B' }}>
                  PREVIEW ({importData.rows.length} rows)
                </div>
                <div className="max-h-[120px] overflow-auto">
                  {preview.map((r, i) => (
                    <div key={i} className="flex gap-3 py-1 text-xs" style={{ borderBottom: '1px solid #1E293B22', color: '#94A3B8' }}>
                      <span className="w-[75px]">{r[mapping.date]}</span>
                      <span className="flex-1">{r[mapping.desc]}</span>
                      <span className="w-[65px] text-right" style={{ fontFamily: "'Space Mono', monospace" }}>{r[mapping.amount]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSkipAi}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}
                >
                  Skip AI
                </button>
                <button
                  onClick={handleCategorize}
                  className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', cursor: 'pointer' }}
                >
                  Categorize with AI
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* STEP 2: Categorizing */}
      {step === 'categorizing' && (
        <div className="flex flex-col items-center py-10">
          <div
            className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
          />
          <div className="text-sm font-medium" style={{ color: '#E2E8F0' }}>
            AI is categorizing {parsedRows.length} transactions...
          </div>
          <div className="mt-1 text-xs" style={{ color: '#64748B' }}>
            Cleaning descriptions and matching categories
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && (
        <>
          {aiError && (
            <div className="mb-4 rounded-lg border px-4 py-3 text-xs" style={{ background: '#3B2E0D', borderColor: '#FBBF2433', color: '#FBBF24' }}>
              {aiError}
            </div>
          )}

          <div className="mb-3 text-xs" style={{ color: '#64748B' }}>
            Review AI suggestions below. Edit any row before importing.
          </div>

          <div className="mb-4 max-h-[350px] overflow-auto rounded-lg border" style={{ borderColor: '#1E293B' }}>
            {/* Header */}
            <div
              className="sticky top-0 z-10 grid gap-2 px-3 py-2 text-[10px] font-semibold uppercase"
              style={{
                gridTemplateColumns: '2fr 1fr 1.5fr 60px',
                background: '#0F1629',
                borderBottom: '1px solid #1E293B',
                color: '#475569',
              }}
            >
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div>Category</div>
              <div className="text-center">Conf.</div>
            </div>

            {reviewRows.map((row, i) => (
              <div
                key={i}
                className="grid items-center gap-2 px-3 py-1.5"
                style={{
                  gridTemplateColumns: '2fr 1fr 1.5fr 60px',
                  borderBottom: '1px solid #1E293B11',
                  background: i % 2 === 0 ? 'transparent' : '#0A0E1744',
                }}
              >
                <div>
                  <input
                    className="w-full border-none bg-transparent text-xs outline-none"
                    style={{ color: '#E2E8F0' }}
                    value={row.cleaned_description}
                    onChange={(e) => updateReviewRow(i, 'cleaned_description', e.target.value)}
                  />
                  {row.cleaned_description !== row.original_description && (
                    <div className="text-[9px]" style={{ color: '#475569' }}>
                      was: {row.original_description}
                    </div>
                  )}
                </div>
                <div
                  className="text-right text-xs font-bold"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    color: row.amount >= 0 ? '#34D399' : '#F87171',
                  }}
                >
                  {row.amount < 0 ? '-' : ''}${Math.abs(row.amount).toFixed(2)}
                </div>
                <select
                  className="rounded border bg-transparent px-1 py-0.5 text-[11px] outline-none"
                  style={{ borderColor: '#1E293B', color: '#94A3B8' }}
                  value={row.category_id || ''}
                  onChange={(e) => updateReviewRow(i, 'category_id', e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="text-center">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: CONFIDENCE_COLORS[row.confidence] }}
                    title={row.confidence + ' confidence'}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 flex gap-4 text-[10px]" style={{ color: '#475569' }}>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#34D399' }} /> High
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#FBBF24' }} /> Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#F87171' }} /> Low
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <button
              onClick={() => { setStep('upload'); setAiError(''); }}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: '#1E293B', color: '#64748B', background: 'transparent', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={handleFinalImport}
              className="rounded-lg border-none px-5 py-2 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', cursor: 'pointer' }}
            >
              Import {reviewRows.length} Transactions
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
