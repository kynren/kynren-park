'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { QrButton } from '../../../../components/QrButton';

interface Shop {
  id: string; name: string; slug: string; category: string | null;
  heroImage: string | null; active: boolean; poiId: string | null; _count?: { items: number };
}

export default function ShopsAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Shop[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(() => {
    api<Shop[]>('/admin/shops').then(setRows).catch(() => setError('Could not load shops.'));
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      const s = await api<Shop>('/admin/shops', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      setCreating(false); setName('');
      router.push(`/app-settings/shops/${s.id}`);
    } catch { setError('Could not create the shop.'); }
  }

  async function remove(s: Shop) {
    if (!(await confirmDelete(`Remove “${s.name}”? Guests will no longer see it.`))) return;
    await api(`/admin/shops/${s.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Shops</div>
      <div className="page-actions">
        <div>
          <h1>Shops</h1>
          <p className="subtitle" style={{ margin: 0 }}>Add a shop, then open it to set its featured image and the products it sells.</p>
        </div>
        <button className="primary" onClick={() => { setCreating(true); setName(''); setError(''); }}>+ Add shop</button>
      </div>
      {error && <div className="error">{error}</div>}

      <table className="dtable">
        <thead>
          <tr><th></th><th>Name</th><th>Category</th><th>Products</th><th>On map</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No shops yet.</td></tr>}
          {rows.map((s) => (
            <tr key={s.id} className={s.active ? '' : 'rowdim'} style={{ cursor: 'pointer' }} onClick={() => router.push(`/app-settings/shops/${s.id}`)}>
              <td style={{ width: 52 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--panel,#f0ece6)', overflow: 'hidden' }}>
                  {s.heroImage && <img src={s.heroImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              </td>
              <td><b>{s.name}</b></td>
              <td>{s.category ?? '—'}</td>
              <td>{s._count?.items ?? 0} items</td>
              <td>{s.poiId ? <span className="tag-on">Placed</span> : <span className="tag-off">—</span>}</td>
              <td>{s.active ? <span className="tag-on">Active</span> : <span className="tag-off">Hidden</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <QrButton type="shop" id={s.id} label={s.name} />{' '}
                <Link className="tbtn" href={`/app-settings/shops/${s.id}`}>Edit</Link>{' '}
                <button className="tbtn danger" onClick={() => remove(s)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {creating && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="modal" style={{ width: 420 }}>
            <h2>New shop</h2>
            <div className="form-row full"><label>Name *</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. The Storied Gift Shop" />
            </div>
            <p className="hint" style={{ marginTop: 6 }}>You’ll set the featured image, details and products on the next screen.</p>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="primary" onClick={create}>Create &amp; edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
