'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';

interface Poi { id: string; name: string; type: string }
interface Restaurant {
  id: string; name: string; slug: string; cuisine: string | null; description: string | null;
  priceRange: string; openingHours: string | null; heroImage: string | null; clickCollect: boolean;
  active: boolean; poiId: string | null; _count?: { menuItems: number };
}

const EMPTY = { name: '', cuisine: '', description: '', priceRange: 'MODERATE', openingHours: '', heroImage: '', clickCollect: true, active: true, poiId: '' };
type Form = typeof EMPTY & { id?: string };

export default function RestaurantsAdmin() {
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Restaurant[]>('/admin/restaurants').then(setRows).catch(() => setError('Could not load restaurants.'));
    api<Poi[]>('/admin/pois').then((p) => setPois(p.filter((x) => x.type === 'RESTAURANT' || !x.type))).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  function openNew() { setForm({ ...EMPTY }); setError(''); }
  function openEdit(r: Restaurant) {
    setForm({ id: r.id, name: r.name, cuisine: r.cuisine ?? '', description: r.description ?? '', priceRange: r.priceRange, openingHours: r.openingHours ?? '', heroImage: r.heroImage ?? '', clickCollect: r.clickCollect, active: r.active, poiId: r.poiId ?? '' });
    setError('');
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const body = { ...form, poiId: form.poiId || null };
    try {
      if (form.id) await api(`/admin/restaurants/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/restaurants', { method: 'POST', body: JSON.stringify(body) });
      setForm(null); load();
    } catch { setError('Save failed.'); }
  }

  async function remove(r: Restaurant) {
    if (!confirm(`Remove "${r.name}"? Guests will no longer see it.`)) return;
    await api(`/admin/restaurants/${r.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Restaurants</div>
      <div className="page-actions">
        <div>
          <h1>Restaurants</h1>
          <p className="subtitle" style={{ margin: 0 }}>Add, edit and remove dining venues shown in the app.</p>
        </div>
        <button className="primary" onClick={openNew}>+ Add restaurant</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead>
          <tr><th>Name</th><th>Cuisine</th><th>Price</th><th>Click &amp; Collect</th><th>Menu</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No restaurants yet.</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={r.active ? '' : 'rowdim'}>
              <td><b>{r.name}</b></td>
              <td>{r.cuisine ?? '—'}</td>
              <td>{{ BUDGET: '£', MODERATE: '££', PREMIUM: '£££' }[r.priceRange] ?? r.priceRange}</td>
              <td>{r.clickCollect ? <span className="tag-on">On</span> : <span className="tag-off">Off</span>}</td>
              <td>{r._count?.menuItems ?? 0} items</td>
              <td>{r.active ? <span className="tag-on">Active</span> : <span className="tag-off">Hidden</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(r)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(r)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2>{form.id ? 'Edit restaurant' : 'Add restaurant'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Cuisine</label><input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} /></div>
              <div className="form-row"><label>Price range</label>
                <select value={form.priceRange} onChange={(e) => setForm({ ...form, priceRange: e.target.value })}>
                  <option value="BUDGET">£ Budget</option><option value="MODERATE">££ Moderate</option><option value="PREMIUM">£££ Premium</option>
                </select>
              </div>
              <div className="form-row full"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-row"><label>Opening hours</label><input placeholder="10:00–19:30" value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} /></div>
              <div className="form-row"><label>Map location (POI)</label>
                <select value={form.poiId} onChange={(e) => setForm({ ...form, poiId: e.target.value })}>
                  <option value="">— none —</option>
                  {pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row full"><label>Hero image URL</label><input value={form.heroImage} onChange={(e) => setForm({ ...form, heroImage: e.target.value })} /></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={form.clickCollect} onChange={(e) => setForm({ ...form, clickCollect: e.target.checked })} /> Click &amp; Collect</label></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible in app</label></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
