'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';

interface Slot {
  key: string; label: string; location: string; aspect: number;
  imageUrl: string | null; imageUrlDark: string | null;
  fit: string; position: string; fade: string; animation: string;
}

const FITS = ['cover', 'contain'];
const POSITIONS = ['top', 'center', 'bottom'];
const FADES = [['none', 'No fade'], ['down', 'Fade at bottom'], ['up', 'Fade at top']];
const ANIMS = [['fade', 'Fade in'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['zoom', 'Zoom in'], ['none', 'None']];

function resizeToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export default function AppImages() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [edit, setEdit] = useState<Slot | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<Slot[]>('/admin/images').then(setSlots).catch((e) => setError(friendlyError(e, 'Could not load images.')));
  }, []);
  useEffect(load, [load]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>, which: 'imageUrl' | 'imageUrlDark') {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !edit) return;
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8 MB.'); return; }
    try { setEdit({ ...edit, [which]: await resizeToDataUrl(file, 1600) }); setError(''); }
    catch { setError('Could not read that image.'); }
  }

  async function save() {
    if (!edit) return;
    setSaving(true); setError('');
    try {
      await api(`/admin/images/${edit.key}`, { method: 'PUT', body: JSON.stringify({
        imageUrl: edit.imageUrl, imageUrlDark: edit.imageUrlDark, fit: edit.fit, position: edit.position, fade: edit.fade, animation: edit.animation,
      }) });
      setEdit(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <p className="subtitle" style={{ marginTop: 0 }}>Swap any decorative image in the mobile app. Each slot supports a light and dark version, how it's fitted, an edge fade and an entrance animation.</p>
      {error && !edit && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th></th><th>Image</th><th>Where it appears</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {slots.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>Loading…</td></tr>}
          {slots.map((s) => (
            <tr key={s.key} style={{ cursor: 'pointer' }} onClick={() => setEdit({ ...s })}>
              <td>
                <div style={{ width: 64, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.imageUrl ? <img src={s.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>🖼️</span>}
                </div>
              </td>
              <td><b>{s.label}</b><div style={{ color: 'var(--muted)', fontSize: 11 }}>{s.key}</div></td>
              <td style={{ fontSize: 13, color: 'var(--muted)' }}>{s.location}</td>
              <td>{s.imageUrl ? <span className="tag-on">Set</span> : <span className="tag-off">Default</span>}</td>
              <td style={{ textAlign: 'right' }}><button className="tbtn" onClick={(e) => { e.stopPropagation(); setEdit({ ...s }); }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <div className="modal" style={{ width: 860, maxWidth: '96vw' }}>
            <h2 style={{ marginBottom: 2 }}>{edit.label}</h2>
            <p className="subtitle">{edit.location}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, marginTop: 8 }}>
              <div>
                <div className="form-grid">
                  <div className="form-row"><label>Light image</label>
                    <input ref={lightRef} type="file" accept="image/*" onChange={(e) => pick(e, 'imageUrl')} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="tbtn" onClick={() => lightRef.current?.click()}>Upload</button>
                      {edit.imageUrl && <button type="button" className="tbtn danger" onClick={() => setEdit({ ...edit, imageUrl: null })}>Clear</button>}
                    </div>
                  </div>
                  <div className="form-row"><label>Dark image (optional)</label>
                    <input ref={darkRef} type="file" accept="image/*" onChange={(e) => pick(e, 'imageUrlDark')} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="tbtn" onClick={() => darkRef.current?.click()}>Upload</button>
                      {edit.imageUrlDark && <button type="button" className="tbtn danger" onClick={() => setEdit({ ...edit, imageUrlDark: null })}>Clear</button>}
                    </div>
                  </div>
                  <div className="form-row"><label>Fit</label><select value={edit.fit} onChange={(e) => setEdit({ ...edit, fit: e.target.value })}>{FITS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div className="form-row"><label>Position</label><select value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })}>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="form-row"><label>Edge fade</label><select value={edit.fade} onChange={(e) => setEdit({ ...edit, fade: e.target.value })}>{FADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div className="form-row"><label>Entrance animation</label><select value={edit.animation} onChange={(e) => setEdit({ ...edit, animation: e.target.value })}>{ANIMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                </div>
              </div>
              {/* Phone preview */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Preview</label>
                <div style={{ marginTop: 8, width: 260, height: 400, border: '10px solid #111', borderRadius: 26, overflow: 'hidden', background: '#f4f2ee', position: 'relative' }}>
                  {edit.imageUrl ? (
                    <>
                      <img src={edit.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: edit.fit as 'cover' | 'contain', objectPosition: `center ${edit.position}` }} />
                      {edit.fade !== 'none' && (
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${edit.fade === 'down' ? 'to bottom' : 'to top'}, rgba(244,242,238,0), rgba(244,242,238,1))` }} />
                      )}
                    </>
                  ) : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)' }}>No image — app default</div>}
                </div>
                <p className="hint" style={{ marginTop: 8 }}>Entrance: <b>{ANIMS.find(([v]) => v === edit.animation)?.[1]}</b> on load.</p>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setEdit(null)} disabled={saving}>Cancel</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
