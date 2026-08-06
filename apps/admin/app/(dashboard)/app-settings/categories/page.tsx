'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';

interface Poi { id: string; type: string; name: string; lat: number; lng: number; color: string | null; mapZone: string | null }

// Facility categories that appear on the mobile map alongside shows & restaurants.
const CATS = ['RESTROOM', 'FIRST_AID', 'SHOP', 'PARKING', 'ACCESSIBILITY', 'BABY_CHANGING', 'PICNIC', 'ENTRANCE', 'INFO'];
const LABEL: Record<string, string> = {
  RESTROOM: 'Toilets', FIRST_AID: 'First aid', SHOP: 'Shop', PARKING: 'Parking', ACCESSIBILITY: 'Accessibility',
  BABY_CHANGING: 'Baby changing', PICNIC: 'Picnic area', ENTRANCE: 'Entrance', INFO: 'Information',
};
const DEF_COLOR: Record<string, string> = {
  RESTROOM: '#3a86c8', FIRST_AID: '#e5544b', SHOP: '#8b6ff0', PARKING: '#6b6460', ACCESSIBILITY: '#3a86c8',
  BABY_CHANGING: '#e2a53b', PICNIC: '#2e8b57', ENTRANCE: '#22b365', INFO: '#6d5df6',
};
const PALETTE = ['#e5544b', '#f5601e', '#e2a53b', '#22b365', '#2e8b57', '#3a86c8', '#1a73e8', '#6d5df6', '#8b6ff0', '#6b6460'];
const EMPTY = { type: 'RESTROOM', name: '', mapZone: '', color: '', lat: '54.6715', lng: '-1.6785' };
type Form = typeof EMPTY & { id?: string };

export default function Categories() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api<Poi[]>('/admin/pois').then(setPois).catch(() => setError('Could not load categories.')); }, []);
  useEffect(load, [load]);

  const facilities = pois.filter((p) => CATS.includes(p.type));

  function openNew() { setForm({ ...EMPTY }); setError(''); }
  function openEdit(p: Poi) { setForm({ id: p.id, type: p.type, name: p.name, mapZone: p.mapZone ?? '', color: p.color ?? '', lat: String(p.lat), lng: String(p.lng) }); setError(''); }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const body = { type: form.type, name: form.name, mapZone: form.mapZone || null, color: form.color || null, lat: Number(form.lat), lng: Number(form.lng) };
    try {
      if (form.id) await api(`/admin/pois/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/pois', { method: 'POST', body: JSON.stringify(body) });
      setForm(null); load();
    } catch { setError('Save failed.'); }
  }
  async function remove(p: Poi) {
    if (!confirm(`Remove "${p.name}"?`)) return;
    await api(`/admin/pois/${p.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Categories &amp; Services</div>
      <div className="page-actions">
        <div><h1>Categories &amp; Services</h1><p className="subtitle" style={{ margin: 0 }}>Toilets, first aid, shops and more — shown on the app map under “Facilities”.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/app-settings/map" className="tbtn" style={{ padding: '10px 14px' }}>Open map editor</Link>
          <button className="primary" onClick={openNew}>+ Add service</button>
        </div>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Name</th><th>Category</th><th>Zone</th><th>Colour</th><th>Location</th><th></th></tr></thead>
        <tbody>
          {facilities.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No services yet.</td></tr>}
          {facilities.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b></td>
              <td>{LABEL[p.type] ?? p.type}</td>
              <td>{p.mapZone ?? '—'}</td>
              <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: p.color ?? DEF_COLOR[p.type], verticalAlign: 'middle' }} /></td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(p)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(p)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2>{form.id ? 'Edit service' : 'Add service'}</h2>
            <div className="form-grid">
              <div className="form-row"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Category</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {CATS.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Zone label</label><input value={form.mapZone} onChange={(e) => setForm({ ...form, mapZone: e.target.value })} /></div>
              <div className="form-row"><label>Marker colour</label>
                <div className="swatches">
                  <button className={`swatch-btn ${!form.color ? 'on' : ''}`} style={{ background: DEF_COLOR[form.type] }} onClick={() => setForm({ ...form, color: '' })} title="Default" />
                  {PALETTE.map((c) => <button key={c} className={`swatch-btn ${form.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />)}
                </div>
              </div>
              <div className="form-row"><label>Latitude</label><input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
              <div className="form-row"><label>Longitude</label><input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
            </div>
            <p className="hint">Tip: use the map editor to place services visually.</p>
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
