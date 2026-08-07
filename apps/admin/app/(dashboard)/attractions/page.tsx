'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, friendlyError } from '../../../lib/api';
import { confirmDelete } from '../../../lib/confirm';
import { QrButton } from '../../../components/QrButton';

interface Poi { id: string; name: string; type: string }
interface Attraction {
  id: string; name: string; slug: string; category: string; tagline: string | null; synopsis: string;
  durationMins: number; heroImage: string | null; wheelchairAccessible: boolean; hasAudioDescription: boolean;
  hasCaptioning: boolean; hasBSL: boolean; sensoryNotes: string | null; sortOrder: number; active: boolean;
  poiId: string | null;
}

const CATEGORIES: [string, string][] = [
  ['BIRDS', 'Birds of prey'], ['HORSE', 'Horsemanship'], ['LAKE', 'Lakeside show'],
  ['VIKINGS', 'Vikings'], ['MAZE', 'Maze'], ['EVENING_SHOW', 'Evening show'], ['OTHER', 'Other'],
];
const catLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

const EMPTY = {
  name: '', category: 'OTHER', tagline: '', synopsis: '', durationMins: 30, heroImage: '',
  wheelchairAccessible: true, hasAudioDescription: false, hasCaptioning: false, hasBSL: false,
  sensoryNotes: '', sortOrder: 0, active: true, poiId: '',
};
type Form = typeof EMPTY & { id?: string };
const MAX_IMAGE_MB = 15; // source cap; the image is resized down before upload

// Resize an image file to a capped dimension and return a compact JPEG data URL,
// so the featured image uploads reliably (a full-res photo is too big to POST).
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

export default function AttractionsAdmin() {
  const [rows, setRows] = useState<Attraction[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<Attraction[]>('/admin/attractions').then(setRows).catch((e) => setError(friendlyError(e, 'Could not load attractions.')));
    api<Poi[]>('/admin/pois').then((p) => setPois(p.filter((x) => x.type === 'ATTRACTION' || !x.type))).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  function openNew() { setForm({ ...EMPTY, sortOrder: rows.length }); setError(''); }
  function openEdit(a: Attraction) {
    setForm({
      id: a.id, name: a.name, category: a.category, tagline: a.tagline ?? '', synopsis: a.synopsis,
      durationMins: a.durationMins, heroImage: a.heroImage ?? '', wheelchairAccessible: a.wheelchairAccessible,
      hasAudioDescription: a.hasAudioDescription, hasCaptioning: a.hasCaptioning, hasBSL: a.hasBSL,
      sensoryNotes: a.sensoryNotes ?? '', sortOrder: a.sortOrder, active: a.active, poiId: a.poiId ?? '',
    });
    setError('');
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !form) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`Image must be under ${MAX_IMAGE_MB} MB.`); return; }
    try {
      const url = await resizeToDataUrl(file, 1400); // downscale so the upload stays small
      setForm((f) => (f ? { ...f, heroImage: url } : f));
      setError('');
    } catch { setError('Could not read that image.'); }
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const body = { ...form, poiId: form.poiId || null };
    try {
      if (form.id) await api(`/admin/attractions/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/attractions', { method: 'POST', body: JSON.stringify(body) });
      setForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
  }

  async function remove(a: Attraction) {
    if (!(await confirmDelete(`Remove “${a.name}”? Guests will no longer see it.`))) return;
    await api(`/admin/attractions/${a.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div>
          <h1>Attractions</h1>
          <p className="subtitle" style={{ margin: 0 }}>The experiences shown across the app. The featured image appears in lists, on the map and the attraction page.</p>
        </div>
        <button className="primary" onClick={openNew}>+ Add attraction</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Duration</th><th>Map pin</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No attractions yet.</td></tr>}
          {rows.map((a) => (
            <tr key={a.id} className={a.active ? '' : 'rowdim'}>
              <td>
                <div style={{ width: 52, height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.heroImage
                    ? <img src={a.heroImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 16 }}>🎭</span>}
                </div>
              </td>
              <td><b>{a.name}</b>{a.tagline ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>{a.tagline}</div> : null}</td>
              <td>{catLabel(a.category)}</td>
              <td>{a.durationMins} min</td>
              <td>{a.poiId ? <span className="tag-on">Linked</span> : <span className="tag-off">—</span>}</td>
              <td>{a.active ? <span className="tag-on">Active</span> : <span className="tag-off">Hidden</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <QrButton type="attraction" id={a.id} label={a.name} />{' '}
                <button className="tbtn" onClick={() => openEdit(a)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(a)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 620 }}>
            <h2>{form.id ? 'Edit attraction' : 'Add attraction'}</h2>

            {/* Featured image */}
            <div className="form-row full">
              <label>Featured image</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 132, height: 90, borderRadius: 10, overflow: 'hidden', background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.heroImage
                    ? <img src={form.heroImage} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 22 }}>🎭</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
                  <button type="button" className="tbtn" onClick={() => fileRef.current?.click()}>Upload image</button>
                  {form.heroImage ? <button type="button" className="tbtn danger" onClick={() => setForm({ ...form, heroImage: '' })}>Remove</button> : null}
                  <span className="hint">Populates lists, the map pin and the attraction page. Large photos are resized automatically.</span>
                </div>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-row"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="form-row full"><label>Tagline</label><input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="A one-line hook" /></div>
              <div className="form-row full"><label>Synopsis</label><textarea value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} /></div>
              <div className="form-row"><label>Duration (mins)</label><input type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Map location (POI)</label>
                <select value={form.poiId} onChange={(e) => setForm({ ...form, poiId: e.target.value })}>
                  <option value="">— none —</option>
                  {pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Sort order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible in app</label></div>
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Accessibility</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <label className="checkline"><input type="checkbox" checked={form.wheelchairAccessible} onChange={(e) => setForm({ ...form, wheelchairAccessible: e.target.checked })} /> Wheelchair accessible</label>
                <label className="checkline"><input type="checkbox" checked={form.hasAudioDescription} onChange={(e) => setForm({ ...form, hasAudioDescription: e.target.checked })} /> Audio description</label>
                <label className="checkline"><input type="checkbox" checked={form.hasCaptioning} onChange={(e) => setForm({ ...form, hasCaptioning: e.target.checked })} /> Captioning</label>
                <label className="checkline"><input type="checkbox" checked={form.hasBSL} onChange={(e) => setForm({ ...form, hasBSL: e.target.checked })} /> BSL</label>
              </div>
              <div className="form-row full" style={{ marginTop: 10 }}><label>Sensory notes</label><input value={form.sensoryNotes} onChange={(e) => setForm({ ...form, sensoryNotes: e.target.value })} placeholder="e.g. loud effects, strobe lighting" /></div>
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
