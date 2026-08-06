'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { PERMISSIONS, ROLES, DEFAULT_MATRIX, type PermMatrix } from '../../../../lib/perms';

export default function RolesPermissions() {
  const [matrix, setMatrix] = useState<PermMatrix>(DEFAULT_MATRIX);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PermMatrix>('/admin/permissions')
      .then((m) => setMatrix(m))
      .catch(() => setError('Could not load permissions. Showing defaults.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(role: string, perm: string) {
    if (role === 'ADMIN') return; // Admin always has everything.
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [perm]: !m[role]?.[perm] } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const next = await api<PermMatrix>('/admin/permissions', { method: 'PUT', body: JSON.stringify({ matrix }) });
      setMatrix(next);
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch {
      setError('Save failed — you need the “System administration” permission.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Permissions granted to each staff role. Enforced across the API and this console.</p>
        <button className="primary" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save matrix'}</button>
      </div>
      {error && <div className="error">{error}</div>}
      <table className="dtable">
        <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}</tr></thead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <tr key={p.key}>
              <td><b>{p.label}</b><div style={{ color: 'var(--muted)', fontSize: 11 }}>{p.key}</div></td>
              {ROLES.map((r) => {
                const on = r === 'ADMIN' ? true : !!matrix[r]?.[p.key];
                return (
                  <td key={r} style={{ textAlign: 'center' }}>
                    <button className={`switch ${on ? 'on' : ''}`} disabled={r === 'ADMIN' || loading} onClick={() => toggle(r, p.key)} aria-label={`${r} ${p.label}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">ADMIN always has full access. Changes take effect immediately after saving.</p>
    </div>
  );
}
