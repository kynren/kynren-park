'use client';

import { useEffect, useState } from 'react';

const ROLES = ['ADMIN', 'OPS', 'FNB', 'CONTENT'] as const;
const PERMS = [
  { key: 'schedule', label: 'Manage schedule' },
  { key: 'food', label: 'Manage food orders' },
  { key: 'content', label: 'Manage content & app settings' },
  { key: 'announce', label: 'Send announcements' },
  { key: 'analytics', label: 'View analytics' },
  { key: 'system', label: 'System administration' },
];
const DEFAULTS: Record<string, Record<string, boolean>> = {
  ADMIN: { schedule: true, food: true, content: true, announce: true, analytics: true, system: true },
  OPS: { schedule: true, food: false, content: false, announce: true, analytics: true, system: false },
  FNB: { schedule: false, food: true, content: false, announce: false, analytics: true, system: false },
  CONTENT: { schedule: false, food: false, content: true, announce: true, analytics: true, system: false },
};
const KEY = 'sys_roles_matrix';

export default function RolesPermissions() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => { const raw = localStorage.getItem(KEY); if (raw) setMatrix(JSON.parse(raw)); }, []);

  function toggle(role: string, perm: string) {
    if (role === 'ADMIN') return; // Admin always has everything.
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [perm]: !m[role]?.[perm] } }));
    setSaved(false);
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(matrix)); setSaved(true); setTimeout(() => setSaved(false), 1600); }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Permissions granted to each staff role.</p>
        <button className="primary" onClick={save}>{saved ? '✓ Saved' : 'Save matrix'}</button>
      </div>
      <table className="dtable">
        <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}</tr></thead>
        <tbody>
          {PERMS.map((p) => (
            <tr key={p.key}>
              <td><b>{p.label}</b></td>
              {ROLES.map((r) => {
                const on = r === 'ADMIN' ? true : !!matrix[r]?.[p.key];
                return (
                  <td key={r} style={{ textAlign: 'center' }}>
                    <button className={`switch ${on ? 'on' : ''}`} disabled={r === 'ADMIN'} onClick={() => toggle(r, p.key)} aria-label={`${r} ${p.label}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">ADMIN always has full access. Save writes the matrix for this workspace.</p>
    </div>
  );
}
