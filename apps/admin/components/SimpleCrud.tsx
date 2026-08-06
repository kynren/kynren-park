'use client';

import { useEffect, useState } from 'react';

export interface Field {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'url' | 'select' | 'checkbox';
  options?: string[];
  placeholder?: string;
}
export interface Row { id: string; [k: string]: unknown }

/**
 * Generic list manager persisted to localStorage. Real add/edit/delete logic
 * for config-style resources (orgs, media, integrations, connectors…) until a
 * dedicated backend table is added.
 */
export function SimpleCrud({
  storageKey, fields, columns, seed = [], addLabel = 'Add', emptyText = 'Nothing here yet.',
  renderCell,
}: {
  storageKey: string;
  fields: Field[];
  columns: { key: string; label: string }[];
  seed?: Row[];
  addLabel?: string;
  emptyText?: string;
  renderCell?: (row: Row, key: string) => React.ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row | null>(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) setRows(JSON.parse(raw));
    else if (seed.length) { setRows(seed); localStorage.setItem(storageKey, JSON.stringify(seed)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(next: Row[]) { setRows(next); localStorage.setItem(storageKey, JSON.stringify(next)); }
  function openNew() {
    const blank: Row = { id: '' };
    for (const f of fields) blank[f.key] = f.type === 'checkbox' ? false : '';
    setForm(blank);
  }
  function save() {
    if (!form) return;
    if (form.id) persist(rows.map((r) => (r.id === form.id ? form : r)));
    else persist([...rows, { ...form, id: `${Date.now()}` }]);
    setForm(null);
  }
  function remove(r: Row) { if (confirm('Remove this item?')) persist(rows.filter((x) => x.id !== r.id)); }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <span />
        <button className="primary" onClick={openNew}>+ {addLabel}</button>
      </div>
      <table className="dtable">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length + 1} style={{ color: 'var(--muted)' }}>{emptyText}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.key}>{renderCell ? renderCell(r, c.key) : String(r[c.key] ?? '—') || '—'}</td>
              ))}
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => setForm(r)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(r)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2>{form.id ? 'Edit' : addLabel}</h2>
            <div className="form-grid">
              {fields.map((f) => (
                <div key={f.key} className={`form-row ${f.type === 'textarea' ? 'full' : ''}`}>
                  {f.type === 'checkbox' ? (
                    <label className="checkline"><input type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} /> {f.label}</label>
                  ) : (
                    <>
                      <label>{f.label}</label>
                      {f.type === 'textarea' ? (
                        <textarea value={String(form[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                      ) : f.type === 'select' ? (
                        <select value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                          <option value="">—</option>
                          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={String(form[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
