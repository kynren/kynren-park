'use client';

import { useEffect, useState } from 'react';
import { confirmDelete } from '../../../../lib/confirm';

interface Backup { id: string; when: string; size: string; status: string; type: string }
const KEY = 'sys_backups';

export default function Backups() {
  const [rows, setRows] = useState<Backup[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => { const raw = localStorage.getItem(KEY); if (raw) setRows(JSON.parse(raw)); }, []);
  function persist(next: Backup[]) { setRows(next); localStorage.setItem(KEY, JSON.stringify(next)); }

  function runBackup() {
    setRunning(true);
    setTimeout(() => {
      const b: Backup = {
        id: `${Date.now()}`, when: new Date().toISOString(),
        size: `${(Math.random() * 40 + 20).toFixed(1)} MB`, status: 'Complete', type: 'Manual',
      };
      persist([b, ...rows]);
      setRunning(false);
    }, 1200);
  }
  async function remove(b: Backup) { if (await confirmDelete('Delete this backup?')) persist(rows.filter((r) => r.id !== b.id)); }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Database snapshots. Automatic nightly backups run at 03:00.</p>
        <button className="primary" onClick={runBackup} disabled={running}>{running ? 'Backing up…' : 'Run backup now'}</button>
      </div>
      <table className="dtable">
        <thead><tr><th>Taken</th><th>Type</th><th>Size</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No backups yet. Run one to get started.</td></tr>}
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{new Date(b.when).toLocaleString('en-GB')}</td>
              <td>{b.type}</td>
              <td>{b.size}</td>
              <td><span className="pillbadge on">{b.status}</span></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => alert('Restore is a privileged operation — confirm with the DBA.')}>Restore</button>{' '}
                <button className="tbtn danger" onClick={() => remove(b)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
