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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Best-effort guess at which file header goes with each expected column,
 *  matching on the column's key or label (case/spacing-insensitive). */
function guessMapping(columns: ImportColumn[], fileHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const c of columns) {
    const key = normalize(c.key);
    const label = normalize(c.label);
    const match = fileHeaders.find((h) => normalize(h) === key || normalize(h) === label);
    if (match) mapping[c.key] = match;
  }
  return mapping;
}

function downloadTemplate(title: string, columns: ImportColumn[]) {
  const csv = columns.map((c) => c.key).join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reusable "import from CSV" modal: pick a file, parse it client-side, show a
 * preview, then hand the parsed rows to the caller's own bulk-create call.
 * Used for menu items, shop stock, and facilities — each just supplies its
 * own column list and `onImport`.
 *
 * A file whose headers match the expected column keys exactly skips straight
 * to the preview (e.g. one built from "Download template" below). Anything
 * else — a spreadsheet exported with its own column names — goes through a
 * one-time mapping step instead of failing outright.
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
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, string>[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const needsMapping = rawRows !== null && rows === null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setRows(null);
    setRawRows(null);
    try {
      const text = await file.text();
      const parsed = csvToObjects(text);
      if (parsed.length === 0) { setError('That file has no rows to import.'); return; }
      const headers = Object.keys(parsed[0]);
      setFileName(file.name);
      setFileHeaders(headers);
      setRawRows(parsed);

      const exact = columns.every((c) => headers.includes(c.key));
      if (exact) {
        setRows(parsed);
      } else {
        setMapping(guessMapping(columns, headers));
      }
    } catch {
      setError('Could not read that file.');
    }
  }

  function applyMapping() {
    if (!rawRows) return;
    const missing = columns.filter((c) => c.required && !mapping[c.key]);
    if (missing.length > 0) {
      setError(`Map a column for: ${missing.map((c) => c.label).join(', ')}`);
      return;
    }
    setError('');
    setRows(rawRows.map((r) => {
      const obj: Record<string, string> = {};
      for (const c of columns) {
        const src = mapping[c.key];
        obj[c.key] = src ? (r[src] ?? '') : '';
      }
      return obj;
    }));
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
      <div className="modal" style={{ width: 620 }}>
        <h2>{title}</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          A CSV file with a header row. Columns: {columns.map((c) => `${c.key}${c.required ? '*' : ''}`).join(', ')}.
          {note ? ` ${note}` : ''}
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="tbtn" onClick={() => fileRef.current?.click()}>Choose CSV file</button>
          <button className="tbtn" onClick={() => downloadTemplate(title, columns)}>Download template</button>
          {fileName && <span className="hint">{fileName}</span>}
        </div>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}

        {needsMapping && (
          <div style={{ marginTop: 14 }}>
            <p className="hint" style={{ margin: '0 0 8px' }}>
              This file’s columns don’t match ours exactly — match each field below, then continue.
            </p>
            <div className="form-grid">
              {columns.map((c) => (
                <div className="form-row" key={c.key}>
                  <label>{c.label}{c.required ? ' *' : ''}</label>
                  <select
                    value={mapping[c.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [c.key]: e.target.value }))}
                  >
                    <option value="">— not in file —</option>
                    {fileHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="primary" onClick={applyMapping}>Continue</button>
            </div>
          </div>
        )}

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
