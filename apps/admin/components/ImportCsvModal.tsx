'use client';

import { useRef, useState } from 'react';
import { csvToObjects } from '../lib/csv';
import { toastError, toastSuccess } from '../lib/toast';
import { friendlyError } from '../lib/api';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
}

/**
 * Reusable "import from CSV" modal: pick a file, parse it client-side, show a
 * preview, then hand the parsed rows to the caller's own bulk-create call.
 * Used for menu items, shop stock, and facilities — each just supplies its
 * own column list and `onImport`.
 */
export function ImportCsvModal({
  title, columns, note, onImport, onClose,
}: {
  title: string;
  columns: ImportColumn[];
  note?: string;
  onImport: (rows: Record<string, string>[]) => Promise<{ created: number; skipped: number }>;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setRows(null);
    try {
      const text = await file.text();
      const parsed = csvToObjects(text);
      if (parsed.length === 0) { setError('That file has no rows to import.'); return; }
      const missing = columns.filter((c) => c.required && !(c.key in parsed[0]));
      if (missing.length > 0) {
        setError(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.map((c) => c.key).join(', ')}`);
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError('Could not read that file.');
    }
  }

  async function doImport() {
    if (!rows) return;
    setImporting(true);
    try {
      const { created, skipped } = await onImport(rows);
      toastSuccess(skipped > 0 ? `Imported ${created} — skipped ${skipped} (missing required fields)` : `Imported ${created}`);
      onClose();
    } catch (e) {
      toastError(friendlyError(e, 'Import failed.'));
    }
    setImporting(false);
  }

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <h2>{title}</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          A CSV file with a header row. Columns: {columns.map((c) => `${c.key}${c.required ? '*' : ''}`).join(', ')}.
          {note ? ` ${note}` : ''}
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="tbtn" onClick={() => fileRef.current?.click()}>Choose CSV file</button>
          {fileName && <span className="hint">{fileName}</span>}
        </div>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        {rows && (
          <div style={{ marginTop: 14 }}>
            <p className="hint" style={{ margin: '0 0 6px' }}>{rows.length} row{rows.length === 1 ? '' : 's'} found — preview of the first 5:</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="dtable">
                <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key] || <span style={{ color: 'var(--muted)' }}>—</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={doImport} disabled={!rows || importing}>
            {importing ? 'Importing…' : rows ? `Import ${rows.length} row${rows.length === 1 ? '' : 's'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
