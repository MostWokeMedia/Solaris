'use client';

import { useState } from 'react';
import Modal from './Modal';
import Field from './Field';
import type { Category } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (name: string, type: 'revenue' | 'expense') => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  transactionCounts: Record<string, number>;
};

const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors";
const inputColors = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' };

export default function CategoryManager({
  open, onClose, categories, onAdd, onRename, onDelete, transactionCounts,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'revenue' | 'expense'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const revCats = categories.filter((c) => c.type === 'revenue');
  const expCats = categories.filter((c) => c.type === 'expense');

  function handleAdd() {
    if (!newName.trim()) return;
    if (categories.some((c) => c.name.toLowerCase() === newName.trim().toLowerCase())) return;
    onAdd(newName.trim(), newType);
    setNewName('');
    setNewType('expense');
  }

  function handleRename(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    const cat = categories.find((c) => c.id === id);
    if (editName.trim() === cat?.name) { setEditingId(null); return; }
    if (categories.some((c) => c.id !== id && c.name.toLowerCase() === editName.trim().toLowerCase())) {
      setEditingId(null);
      return;
    }
    onRename(id, editName.trim());
    setEditingId(null);
  }

  function handleDelete(id: string) {
    onDelete(id);
    setConfirmDeleteId(null);
  }

  function renderCategory(cat: Category) {
    const count = transactionCounts[cat.id] || 0;
    const accentColor = cat.type === 'revenue' ? '#34D399' : '#F87171';
    const dotColor = cat.color || accentColor;

    return (
      <div
        key={cat.id}
        className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-[#1A2332]"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="h-2 w-2 shrink-0 rounded-sm" style={{ background: dotColor }} />

        {editingId === cat.id ? (
          <input
            className={inputStyle}
            style={{ ...inputColors, flex: 1, padding: '4px 8px', fontSize: 12 }}
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename(cat.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
            onBlur={() => handleRename(cat.id)}
          />
        ) : (
          <span
            onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
            className="flex-1 cursor-pointer text-[13px]"
            style={{ color: 'var(--text)' }}
          >
            {cat.name}
          </span>
        )}

        <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>{count} txns</span>

        {confirmDeleteId === cat.id ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDelete(cat.id)}
              className="rounded border px-2 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: '#F8717133', color: 'var(--red)', background: 'transparent' }}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="rounded border px-2 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
              className="border-none bg-transparent px-1.5 py-0.5 text-xs"
              style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              &#x270E;
            </button>
            <button
              onClick={() => setConfirmDeleteId(cat.id)}
              className="border-none bg-transparent px-1.5 py-0.5 text-xs"
              style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              &#x2715;
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={() => { onClose(); setEditingId(null); setConfirmDeleteId(null); }} title="Manage Categories" wide>
      {/* Add new */}
      <div className="mb-5 flex gap-2">
        <input
          className={inputStyle + ' flex-1'}
          style={inputColors}
          placeholder="New category name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ ...inputColors, cursor: 'pointer', minWidth: 100 }}
          value={newType}
          onChange={(e) => setNewType(e.target.value as 'revenue' | 'expense')}
        >
          <option value="expense">Expense</option>
          <option value="revenue">Revenue</option>
        </select>
        <button
          onClick={handleAdd}
          className="whitespace-nowrap rounded-lg border-none px-4 py-2 text-sm font-semibold text-white"
          style={{
            background: 'var(--amber)', color: '#0A0A0B',
            opacity: newName.trim() ? 1 : 0.4,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>

      {/* Revenue */}
      <div
        className="mb-2 text-xs font-semibold uppercase"
        style={{ color: 'var(--green)', letterSpacing: '0.5px' }}
      >
        Revenue Categories
      </div>
      <div className="mb-5">
        {revCats.length === 0 && (
          <div className="py-3 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>No revenue categories</div>
        )}
        {revCats.map(renderCategory)}
      </div>

      {/* Expense */}
      <div
        className="mb-2 text-xs font-semibold uppercase"
        style={{ color: 'var(--red)', letterSpacing: '0.5px' }}
      >
        Expense Categories
      </div>
      <div>
        {expCats.length === 0 && (
          <div className="py-3 text-center text-xs" style={{ color: 'var(--text-disabled)' }}>No expense categories</div>
        )}
        {expCats.map(renderCategory)}
      </div>

      <p className="mt-4 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
        Click a name to rename &middot; Renaming updates all linked transactions automatically &middot; Deleting unlinks transactions
      </p>
    </Modal>
  );
}
