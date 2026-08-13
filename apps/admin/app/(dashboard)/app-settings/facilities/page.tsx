'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, apiUpload, friendlyError } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { uploadToast } from '../../../../lib/toast';
import { GalleryEditor } from '../../../../components/GalleryEditor';
import { ImportCsvModal } from '../../../../components/ImportCsvModal';

interface Poi {
  id: string; type: string; name: string; lat: number; lng: number; color: string | null; mapZone: string | null;
  description: string | null; image: string | null; heroImage: string | null; images: string[]; openingHours: string | null;
}

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
const EMPTY = {
  type: 'RESTROOM', name: '', mapZone: '', color: '', lat: '54.6715', lng: '-1.6785',
  description: '', image: '', heroImage: '', images: [] as string[], openingHours: '',
};
type Form = typeof EMPTY & { id?: string };

const IMPORT_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'type', label: 'Category' },
  { key: 'lat', label: 'Latitude', required: true },
  { key: 'lng', label: 'Longitude', required: true },
  { key: 'mapZone', label: 'Zone' },
  { key: 'description', label: 'Description' },
  { key: 'openingHours', label: 'Opening hours' },
  { key: 'color', label: 'Colour' },
];

function resizeToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export default function Facilities() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => { api<Poi[]>('/admin/pois').then(setPois).catch(() => setError('Could not load facilities.')); }, []);
  useEffect(load, [load]);

  const facilities = pois.filter((p) => CATS.includes(p.type));

  function openNew() { setForm({ ...EMPTY }); setError(''); }
  function openEdit(p: Poi) {
    setForm({
      id: p.id, type: p.type, name: p.name, mapZone: p.mapZone ?? '', color: p.color ?? '',
      lat: String(p.lat), lng: String(p.lng), description: p.description ?? '', image: p.image ?? '',
      heroImage: p.heroImage ?? '', images: p.images ?? [], openingHours: p.openingHours ?? '',
    });
    setError('');
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !form) return;
    try { setForm({ ...form, image: await resizeToDataUrl(file, 400) }); } catch { /* ignore */ }
  }
  async function onHero(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !form) return;
    try { setForm({ ...form, heroImage: await resizeToDataUrl(file, 1400) }); } catch { /* ignore */ }
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const body = {
      type: form.type, name: form.name, mapZone: form.mapZone || null, color: form.color || null,
      lat: Number(form.lat), lng: Number(form.lng), description: form.description || null,
      image: form.image || null, heroImage: form.heroImage || null, images: form.images, openingHours: form.openingHours || null,
    };
    const t = uploadToast('Saving facility…');
    try {
      if (form.id) await apiUpload(`/admin/pois/${form.id}`, body, { method: 'PATCH', onProgress: (p) => t.progress(p) });
      else await apiUpload('/admin/pois', body, { method: 'POST', onProgress: (p) => t.progress(p) });
      t.success('Facility saved');
      setForm(null); load();
    } catch (e) { t.error(friendlyError(e, 'Save failed.')); setError('Save failed.'); }
    setSaving(false);
  }
  async function remove(p: Poi) {
    if (!(await confirmDelete(`Remove “${p.name}”?`))) return;
    await api(`/admin/pois/${p.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  async function importFacilities(rows: Record<string, string>[]) {
    const items = rows.map((row) => ({
      name: row.name,
      type: CATS.includes((row.type || '').toUpperCase()) ? row.type.toUpperCase() : 'INFO',
      lat: row.lat, lng: row.lng,
      mapZone: row.mapZone || null,
      description: row.description || null,
      openingHours: row.openingHours || null,
      color: row.color || null,
    }));
    const res = await api<{ created: number; skipped: number }>('/admin/pois/bulk', { method: 'POST', body: JSON.stringify({ items }) });
    load();
    return res;
  }

  return (
    <div>
      <div className="page-actions">
        <div><h1>Facilities</h1><p className="subtitle" style={{ margin: 0 }}>Toilets, first aid, shops and any service shown on the app map under “Facilities”.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/app-settings/map" className="tbtn" style={{ padding: '10px 14px' }}>Open map editor</Link>
          <button className="tbtn" onClick={() => setImportOpen(true)}>Import facilities (CSV)</button>
          <button className="primary" onClick={openNew}>+ Add facility</button>
        </div>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Name</th><th>Category</th><th>Zone</th><th>Colour</th><th>Location</th><th></th></tr></thead>
        <tbody>
          {facilities.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No facilities yet.</td></tr>}
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
          <div className="modal" style={{ width: 560 }}>
            <h2>{form.id ? 'Edit facility' : 'Add facility'}</h2>
            <div className="form-grid">
              <div className="form-row full">
                <label>Marker image (optional)</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)' }}>
                    {form.image && <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <input ref={imageRef} type="file" accept="image/*" hidden onChange={onImage} />
                  <button className="tbtn" onClick={() => imageRef.current?.click()}>Upload</button>
                  {form.image && <button className="tbtn danger" onClick={() => setForm({ ...form, image: '' })}>Remove</button>}
                </div>
              </div>
              <div className="form-row"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Category</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {CATS.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Zone label</label><input value={form.mapZone} onChange={(e) => setForm({ ...form, mapZone: e.target.value })} /></div>
              <div className="form-row"><label>Opening hours</label><input placeholder="10:00–18:00" value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} /></div>
              <div className="form-row"><label>Marker colour</label>
                <div className="swatches">
                  <button className={`swatch-btn ${!form.color ? 'on' : ''}`} style={{ background: DEF_COLOR[form.type] }} onClick={() => setForm({ ...form, color: '' })} title="Default" />
                  {PALETTE.map((c) => <button key={c} className={`swatch-btn ${form.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />)}
                </div>
              </div>
              <div className="form-row"><label>Latitude</label><input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
              <div className="form-row"><label>Longitude</label><input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
              <div className="form-row full"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-row full">
                <label>Detail page image (optional)</label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 160, height: 100, borderRadius: 10, overflow: 'hidden', background: 'var(--panel,#f0ece6)', flex: '0 0 auto' }}>
                    {form.heroImage
                      ? <img src={form.heroImage} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>No image</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input ref={heroRef} type="file" accept="image/*" hidden onChange={onHero} />
                    <button className="tbtn" onClick={() => heroRef.current?.click()}>Upload image</button>
                    {form.heroImage && <button className="tbtn danger" onClick={() => setForm({ ...form, heroImage: '' })}>Remove</button>}
                  </div>
                </div>
              </div>
              <div className="form-row full">
                <GalleryEditor images={form.images} onChange={(next) => setForm({ ...form, images: next })} />
              </div>
            </div>
            <p className="hint">Tip: use the map editor to place facilities visually.</p>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <ImportCsvModal
          title="Import facilities"
          columns={IMPORT_COLUMNS}
          note={`type must be one of: ${CATS.join(', ')} (defaults to INFO if missing/unrecognised).`}
          onImport={importFacilities}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
