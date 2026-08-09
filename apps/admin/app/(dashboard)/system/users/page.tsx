'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { usePaged, Pager } from '../../../../components/Pager';

interface AppUser {
  id: string; name: string | null; email: string | null; locale: string; createdAt: string;
  installed: boolean; devices: number; bookings: number; orders: number; inPark: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { page, setPage, totalPages, pageRows, total, start, end } = usePaged(users, 10);

  const load = useCallback(() => { api<AppUser[]>('/admin/users').then(setUsers).catch(() => setError('Could not load users.')); }, []);
  useEffect(() => { load(); }, [load]);

  const installed = users.filter((u) => u.installed).length;
  const inPark = users.filter((u) => u.inPark).length;

  const pageIds = pageRows.map((u) => u.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => { const n = new Set(s); if (allOnPage) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });

  async function removeOne(u: AppUser) {
    if (!(await confirmDelete(`Remove ${u.name ?? u.email ?? 'this user'}? Their bookings, orders and saved data are permanently deleted.`))) return;
    await api(`/admin/users/${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    setSel((s) => { const n = new Set(s); n.delete(u.id); return n; });
    load();
  }
  async function removeSelected() {
    if (sel.size === 0) return;
    if (!(await confirmDelete(`Remove ${sel.size} selected user${sel.size === 1 ? '' : 's'}? This permanently deletes their data.`))) return;
    await api('/admin/users/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...sel] }) }).catch(() => undefined);
    setSel(new Set()); load();
  }

  return (
    <div>
      <div className="kv" style={{ marginBottom: 18 }}>
        <div className="cell"><div className="n">{users.length}</div><div className="l">Registered users</div></div>
        <div className="cell"><div className="n">{installed}</div><div className="l">Installed the app</div></div>
        <div className="cell"><div className="n">{inPark}</div><div className="l">In the park now</div></div>
      </div>
      {error && <div className="error">{error}</div>}

      {sel.size > 0 && (
        <div className="page-actions" style={{ margin: '0 0 12px' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{sel.size} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tbtn" onClick={() => setSel(new Set())}>Clear</button>
            <button className="tbtn danger" onClick={removeSelected}>Remove selected</button>
          </div>
        </div>
      )}

      <table className="dtable">
        <thead><tr>
          <th style={{ width: 34 }}><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" /></th>
          <th>Name</th><th>Email</th><th>App</th><th>Devices</th><th>Bookings</th><th>Orders</th><th>Presence</th><th></th>
        </tr></thead>
        <tbody>
          {users.length === 0 && !error && <tr><td colSpan={9} style={{ color: 'var(--muted)' }}>No users yet.</td></tr>}
          {pageRows.map((u) => (
            <tr key={u.id} className={sel.has(u.id) ? 'rowsel' : ''}>
              <td><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Select ${u.name ?? u.email ?? u.id}`} /></td>
              <td><b>{u.name ?? 'Guest'}</b></td>
              <td>{u.email ?? '—'}</td>
              <td>{u.installed ? <span className="pillbadge on">Installed</span> : <span className="pillbadge off">Web only</span>}</td>
              <td>{u.devices}</td>
              <td>{u.bookings}</td>
              <td>{u.orders}</td>
              <td>{u.inPark ? <span className="pillbadge park">● In park</span> : <span className="pillbadge off">Off-site</span>}</td>
              <td style={{ textAlign: 'right' }}><button className="tbtn danger" onClick={() => removeOne(u)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} setPage={setPage} totalPages={totalPages} total={total} start={start} end={end} />
      <p className="hint">Removing a user permanently deletes their account and all associated data (bookings, orders, favourites). This can’t be undone.</p>
    </div>
  );
}
