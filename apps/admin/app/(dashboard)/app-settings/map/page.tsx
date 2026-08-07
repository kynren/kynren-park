'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, friendlyError } from '../../../../lib/api';
import { confirmDelete, promptText } from '../../../../lib/confirm';
import { QrButton } from '../../../../components/QrButton';

interface Poi { id: string; type: string; name: string; lat: number; lng: number; color: string | null; mapZone: string | null; image: string | null }
interface MapConfig { markerColor: string; markerStyle: string; mapImageUrl: string | null }
interface ParkMap { id: string; name: string; imageUrl: string | null; isDefault: boolean }

const TYPES = ['ATTRACTION', 'RESTAURANT', 'RESTROOM', 'SHOP', 'FIRST_AID', 'ENTRANCE', 'PARKING', 'ACCESSIBILITY', 'BABY_CHANGING', 'PICNIC', 'INFO'];
const TYPE_COLOR: Record<string, string> = {
  ATTRACTION: '#e5544b', RESTAURANT: '#f5601e', RESTROOM: '#3a86c8', SHOP: '#8b6ff0', FIRST_AID: '#e5544b',
  ENTRANCE: '#22b365', PARKING: '#6b6460', ACCESSIBILITY: '#3a86c8', BABY_CHANGING: '#e2a53b', PICNIC: '#2e8b57', INFO: '#6d5df6',
};
const PALETTE = ['#e5544b', '#f5601e', '#e2a53b', '#22b365', '#2e8b57', '#3a86c8', '#1a73e8', '#6d5df6', '#8b6ff0', '#6b6460'];
const colorOf = (p: Poi) => p.color || TYPE_COLOR[p.type] || '#6b6460';

export default function MapEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [config, setConfig] = useState<MapConfig>({ markerColor: '#1a73e8', markerStyle: 'pulse', mapImageUrl: null });
  const [maps, setMaps] = useState<ParkMap[]>([]);
  const [newMapName, setNewMapName] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const moved = useRef(false);

  const load = useCallback(() => {
    api<Poi[]>('/admin/pois').then(setPois).catch(() => undefined);
    api<MapConfig>('/admin/map-config').then((c) => setConfig({ markerColor: c.markerColor, markerStyle: c.markerStyle, mapImageUrl: c.mapImageUrl })).catch(() => undefined);
    api<ParkMap[]>('/admin/maps').then(setMaps).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const refreshMaps = () => api<ParkMap[]>('/admin/maps').then(setMaps).catch(() => undefined);
  async function addMap() {
    if (!newMapName.trim()) return;
    await api('/admin/maps', { method: 'POST', body: JSON.stringify({ name: newMapName.trim() }) }).catch(() => undefined);
    setNewMapName(''); refreshMaps();
  }
  async function setDefaultMap(id: string) { await api(`/admin/maps/${id}/default`, { method: 'POST' }).catch(() => undefined); refreshMaps(); }
  async function setMapImage(id: string, url: string | null) {
    try { await api(`/admin/maps/${id}`, { method: 'PATCH', body: JSON.stringify({ imageUrl: url }) }); setErr(''); }
    catch (e) { setErr(friendlyError(e, 'Could not update the map image.')); }
    refreshMaps();
  }
  async function deleteMap(id: string) { if (!(await confirmDelete('Delete this map?'))) return; await api(`/admin/maps/${id}`, { method: 'DELETE' }).catch(() => undefined); refreshMaps(); }

  // Upload an image file → resized data URL (keeps it reasonable for the app bundle).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);
  const uploadKind = useRef<'map' | 'spot'>('map');
  function triggerUpload(id: string) { uploadKind.current = 'map'; uploadTarget.current = id; fileInputRef.current?.click(); }
  function triggerSpotUpload() { uploadKind.current = 'spot'; fileInputRef.current?.click(); }
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
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject; img.src = reader.result as string;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert('Please choose an image under 15 MB.'); return; }
    try {
      if (uploadKind.current === 'spot') {
        if (!selected) return;
        await patchSel({ image: await resizeToDataUrl(file, 512) }); // small — it sits inside a marker
      } else if (uploadTarget.current) {
        await setMapImage(uploadTarget.current, await resizeToDataUrl(file, 2400));
      }
    } catch { alert('Could not read that image.'); }
  }

  // Bounds (with margin) drive the pixel↔lat/lng projection.
  const bounds = useMemo(() => {
    if (pois.length < 2) return { minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674 };
    const lats = pois.map((p) => p.lat), lngs = pois.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const mLat = (maxLat - minLat) * 0.12 || 0.002, mLng = (maxLng - minLng) * 0.12 || 0.002;
    return { minLat: minLat - mLat, maxLat: maxLat + mLat, minLng: minLng - mLng, maxLng: maxLng + mLng };
  }, [pois]);
  const proj = (p: { lat: number; lng: number }) => ({
    left: ((p.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100,
    top: ((bounds.maxLat - p.lat) / (bounds.maxLat - bounds.minLat)) * 100,
  });
  const unproj = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return { lat: bounds.maxLat - fy * (bounds.maxLat - bounds.minLat), lng: bounds.minLng + fx * (bounds.maxLng - bounds.minLng) };
  };

  const selected = pois.find((p) => p.id === selId) ?? null;

  async function createAt(clientX: number, clientY: number) {
    const { lat, lng } = unproj(clientX, clientY);
    try {
      const created = await api<Poi>('/admin/pois', { method: 'POST', body: JSON.stringify({ name: 'New hotspot', type: 'INFO', lat, lng }) });
      setPois((p) => [...p, created]); setSelId(created.id); setErr('');
    } catch (e) { setErr(friendlyError(e, 'Could not add the hotspot.')); }
  }
  function onCanvasClick(e: React.MouseEvent) {
    if (moved.current) { moved.current = false; return; }
    // Allow clicks on the canvas, the grid overlay, or the base-map image itself.
    const t = e.target as HTMLElement;
    if (t !== canvasRef.current && !t.classList.contains('grid') && t.tagName !== 'IMG') return;
    createAt(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragId.current) return;
    moved.current = true;
    const { lat, lng } = unproj(e.clientX, e.clientY);
    setPois((prev) => prev.map((p) => (p.id === dragId.current ? { ...p, lat, lng } : p)));
  }
  function onPointerUp() {
    const id = dragId.current;
    dragId.current = null;
    if (!id) return;
    const p = pois.find((x) => x.id === id);
    if (p) api(`/admin/pois/${id}`, { method: 'PATCH', body: JSON.stringify({ lat: p.lat, lng: p.lng }) }).catch(() => undefined);
  }

  async function patchSel(patch: Partial<Poi>) {
    if (!selected) return;
    setPois((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
    try { await api(`/admin/pois/${selected.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); setErr(''); }
    catch (e) { setErr(friendlyError(e, 'Could not save the change.')); }
  }
  async function removeSel() {
    if (!selected) return;
    if (!(await confirmDelete(`Delete hotspot “${selected.name}”? It will disappear from the app map.`))) return;
    try {
      await api(`/admin/pois/${selected.id}`, { method: 'DELETE' });
      setPois((prev) => prev.filter((p) => p.id !== selected.id));
      setSelId(null); setErr('');
    } catch (e) { setErr(friendlyError(e, 'Could not delete the hotspot.')); }
  }
  async function saveConfig(patch: Partial<MapConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    await api('/admin/map-config', { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => undefined);
  }

  const entrance = pois.find((p) => p.type === 'ENTRANCE');
  const custPos = entrance ? proj(entrance) : { left: 50, top: 72 };
  const defaultMap = maps.find((m) => m.isDefault) ?? null;

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Map &amp; Hotspots</div>
      <div className="page-actions">
        <div><h1>Map &amp; Hotspots</h1><p className="subtitle" style={{ margin: 0 }}>Click the map to add a hotspot; drag to move. Changes sync to the app map.</p></div>
        <label className="checkline"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Show labels</label>
      </div>
      {err && <div className="error" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>{err}</div>}

      <div className="mapedit">
        <div>
          <div ref={canvasRef} className="mapcanvas" onClick={onCanvasClick} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
            {defaultMap?.imageUrl && <img src={defaultMap.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div className="grid" />
            {pois.map((p) => {
              const { left, top } = proj(p);
              return (
                <div key={p.id}>
                  <div
                    className={`hot ${selId === p.id ? 'sel' : ''}`}
                    style={{ left: `${left}%`, top: `${top}%`, background: colorOf(p) }}
                    onPointerDown={(e) => { e.stopPropagation(); setSelId(p.id); dragId.current = p.id; moved.current = false; }}
                    onClick={(e) => e.stopPropagation()}
                    title={p.name}
                  >{p.image ? <img src={p.image} alt="" /> : p.type[0]}</div>
                  {showLabels && <div className="hotlabel" style={{ left: `${left}%`, top: `${top}%` }}>{p.name}</div>}
                </div>
              );
            })}
            {/* Customer marker preview */}
            <div className="custmark" style={{ left: `${custPos.left}%`, top: `${custPos.top}%`, background: config.markerColor, boxShadow: `0 0 0 6px ${config.markerColor}40` }} />
          </div>
          <p className="maphint">🟦 The ringed marker previews the guest’s “you are here” marker. Hotspots are coloured by type unless overridden.</p>
        </div>

        {/* Side panel */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="editcard">
            <h3>Base maps</h3>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
              The <b>default</b> map is what the mobile app shows. Recommended image: <b>2000–3000&nbsp;px</b> on the
              longest edge, roughly <b>4:3</b>, <b>PNG or JPG</b>, under <b>5&nbsp;MB</b> — big enough to stay sharp when
              guests zoom in, small enough to load fast.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {maps.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No maps yet — add one below.</p>}
              {maps.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <button onClick={() => setDefaultMap(m.id)} title="Set as default"
                    style={{ width: 18, height: 18, borderRadius: '50%', border: 0, cursor: 'pointer', background: m.isDefault ? '#22b365' : '#fff', boxShadow: '0 0 0 1px var(--border)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name} {m.isDefault && <span className="pillbadge on">Default</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.imageUrl ?? 'no image (illustrated map)'}</div>
                  </div>
                  <button className="tbtn" onClick={() => triggerUpload(m.id)}>Upload</button>
                  <button className="tbtn" onClick={async () => { const u = await promptText('Image URL (leave blank to remove)', m.imageUrl ?? '', 'Map image URL'); if (u !== null) setMapImage(m.id, u.trim() || null); }}>URL</button>
                  {m.imageUrl && <button className="tbtn" onClick={() => setMapImage(m.id, null)}>Remove</button>}
                  <button className="tbtn danger" onClick={() => deleteMap(m.id)}>✕</button>
                </div>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={newMapName} onChange={(e) => setNewMapName(e.target.value)} placeholder="New map name" style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addMap()} />
              <button className="primary" onClick={addMap}>Add map</button>
            </div>
          </div>

          <div className="editcard">
            <h3>{selected ? 'Edit hotspot' : 'Hotspot'}</h3>
            {!selected && <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Select a hotspot on the map, or click an empty spot to add one.</p>}
            {selected && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="form-row"><label>Name</label><input value={selected.name} onChange={(e) => patchSel({ name: e.target.value })} /></div>
                <div className="form-row"><label>Category</label>
                  <select value={selected.type} onChange={(e) => patchSel({ type: e.target.value })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-row"><label>Zone label</label><input value={selected.mapZone ?? ''} onChange={(e) => patchSel({ mapZone: e.target.value })} /></div>
                <div className="form-row"><label>Colour</label>
                  <div className="swatches">
                    {PALETTE.map((c) => <button key={c} className={`swatch-btn ${colorOf(selected) === c ? 'on' : ''}`} style={{ background: c }} onClick={() => patchSel({ color: c })} />)}
                  </div>
                </div>
                <div className="form-row"><label>Marker image (fits inside the pin)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selected.image
                      ? <img src={selected.image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--border)' }} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: colorOf(selected), display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>{selected.type[0]}</div>}
                    <button className="tbtn" onClick={triggerSpotUpload}>Upload</button>
                    {selected.image && <button className="tbtn" onClick={() => patchSel({ image: null })}>Remove</button>}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-row"><label>Latitude</label><input value={selected.lat.toFixed(5)} onChange={(e) => patchSel({ lat: Number(e.target.value) || selected.lat })} /></div>
                  <div className="form-row"><label>Longitude</label><input value={selected.lng.toFixed(5)} onChange={(e) => patchSel({ lng: Number(e.target.value) || selected.lng })} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <QrButton type="poi" id={selected.id} label={selected.name} />
                  <button className="tbtn danger" onClick={removeSel}>Delete hotspot</button>
                </div>
              </div>
            )}
          </div>

          <div className="editcard">
            <h3>Guest marker &amp; map</h3>
            <div className="form-row" style={{ marginBottom: 12 }}><label>Marker colour</label>
              <div className="swatches">
                {PALETTE.map((c) => <button key={c} className={`swatch-btn ${config.markerColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => saveConfig({ markerColor: c })} />)}
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}><label>Marker style</label>
              <select value={config.markerStyle} onChange={(e) => saveConfig({ markerStyle: e.target.value })}>
                <option value="pulse">Pulsing dot</option><option value="dot">Solid dot</option><option value="pin">Pin</option>
              </select>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Manage the base map image under <b>Base maps</b> above.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
