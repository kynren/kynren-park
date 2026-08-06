'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';

interface Poi { id: string; type: string; name: string; lat: number; lng: number; color: string | null; mapZone: string | null }
interface MapConfig { markerColor: string; markerStyle: string; mapImageUrl: string | null }

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
  const [selId, setSelId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const moved = useRef(false);

  const load = useCallback(() => {
    api<Poi[]>('/admin/pois').then(setPois).catch(() => undefined);
    api<MapConfig>('/admin/map-config').then((c) => setConfig({ markerColor: c.markerColor, markerStyle: c.markerStyle, mapImageUrl: c.mapImageUrl })).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

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
    const created = await api<Poi>('/admin/pois', { method: 'POST', body: JSON.stringify({ name: 'New hotspot', type: 'INFO', lat, lng }) }).catch(() => null);
    if (created) { setPois((p) => [...p, created]); setSelId(created.id); }
  }
  function onCanvasClick(e: React.MouseEvent) {
    if (moved.current) { moved.current = false; return; }
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains('grid')) return;
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
    await api(`/admin/pois/${selected.id}`, { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => undefined);
  }
  async function removeSel() {
    if (!selected || !confirm(`Delete hotspot "${selected.name}"?`)) return;
    await api(`/admin/pois/${selected.id}`, { method: 'DELETE' }).catch(() => undefined);
    setPois((prev) => prev.filter((p) => p.id !== selected.id));
    setSelId(null);
  }
  async function saveConfig(patch: Partial<MapConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    await api('/admin/map-config', { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => undefined);
  }

  const entrance = pois.find((p) => p.type === 'ENTRANCE');
  const custPos = entrance ? proj(entrance) : { left: 50, top: 72 };

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Map &amp; Hotspots</div>
      <div className="page-actions">
        <div><h1>Map &amp; Hotspots</h1><p className="subtitle" style={{ margin: 0 }}>Click the map to add a hotspot; drag to move. Changes sync to the app map.</p></div>
      </div>

      <div className="mapedit">
        <div>
          <div ref={canvasRef} className="mapcanvas" onClick={onCanvasClick} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
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
                  >{p.type[0]}</div>
                  <div className="hotlabel" style={{ left: `${left}%`, top: `${top}%` }}>{p.name}</div>
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
                <div className="form-grid">
                  <div className="form-row"><label>Latitude</label><input value={selected.lat.toFixed(5)} onChange={(e) => patchSel({ lat: Number(e.target.value) || selected.lat })} /></div>
                  <div className="form-row"><label>Longitude</label><input value={selected.lng.toFixed(5)} onChange={(e) => patchSel({ lng: Number(e.target.value) || selected.lng })} /></div>
                </div>
                <button className="tbtn danger" onClick={removeSel}>Delete hotspot</button>
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
            <div className="form-row"><label>Base map image URL (optional)</label><input value={config.mapImageUrl ?? ''} placeholder="https://… (leave blank for illustrated map)" onChange={(e) => saveConfig({ mapImageUrl: e.target.value })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
