'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { QrButton } from '../../../../components/QrButton';
import { usePaged, Pager } from '../../../../components/Pager';

interface Restaurant {
  id: string; name: string; slug: string; cuisine: string | null;
  priceRange: string; heroImage: string | null; clickCollect: boolean;
  active: boolean; poiId: string | null; _count?: { menuItems: number };
}

export default function RestaurantsAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const { page, setPage, totalPages, pageRows, total, start, end } = usePaged(rows, 10);

  const load = useCallback(() => {
    api<Restaurant[]>('/admin/restaurants').then(setRows).catch(() => setError('Could not load restaurants.'));
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      const r = await api<Restaurant>('/admin/restaurants', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      setCreating(false); setName('');
      router.push(`/app-settings/restaurants/${r.id}`);
    } catch { setError('Could not create the restaurant.'); }
  }

  async function remove(r: Restaurant) {
    if (!(await confirmDelete(`Remove “${r.name}”? Guests will no longer see it.`))) return;
    await api(`/admin/restaurants/${r.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1>Restaurants</h1>
          <p className="subtitle" style={{ margin: 0 }}>Add a dining venue, then open it to set its featured image and menu.</p>
        </div>
        <button className="primary" onClick={() => { setCreating(true); setName(''); setError(''); }}>+ Add restaurant</button>
      </div>
      {error && <div className="error">{error}</div>}

      <table className="dtable">
        <thead>
          <tr><th></th><th>Name</th><th>Cuisine</th><th>Price</th><th>Menu</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No restaurants yet.</td></tr>}
          {pageRows.map((r) => (
            <tr key={r.id} className={r.active ? '' : 'rowdim'} style={{ cursor: 'pointer' }} onClick={() => router.push(`/app-settings/restaurants/${r.id}`)}>
              <td style={{ width: 52 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--panel,#f0ece6)', overflow: 'hidden' }}>
                  {r.heroImage && <img src={r.heroImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              </td>
              <td><b>{r.name}</b></td>
              <td>{r.cuisine ?? '—'}</td>
              <td>{{ BUDGET: '£', MODERATE: '££', PREMIUM: '£££' }[r.priceRange] ?? r.priceRange}</td>
              <td>{r._count?.menuItems ?? 0} items</td>
              <td>{r.active ? <span className="tag-on">Active</span> : <span className="tag-off">Hidden</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <QrButton type="restaurant" id={r.id} label={r.name} />{' '}
                <Link className="tbtn" href={`/app-settings/restaurants/${r.id}`}>Edit</Link>{' '}
                <button className="tbtn danger" onClick={() => remove(r)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} setPage={setPage} totalPages={totalPages} total={total} start={start} end={end} />

      {creating && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="modal" style={{ width: 420 }}>
            <h2>New restaurant</h2>
            <div className="form-row full"><label>Name *</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. The Feast Hall" />
            </div>
            <p className="hint" style={{ marginTop: 6 }}>You’ll set the featured image, details and menu on the next screen.</p>
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
