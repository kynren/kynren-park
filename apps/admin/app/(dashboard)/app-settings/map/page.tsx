'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, apiUpload, friendlyError } from '../../../../lib/api';
import { confirmDelete, promptText } from '../../../../lib/confirm';
import { uploadToast } from '../../../../lib/toast';
import { QrButton } from '../../../../components/QrButton';

interface Poi { id: string; type: string; name: string; lat: number; lng: number; color: string | null; mapZone: string | null; image: string | null }
interface MapConfig { markerColor: string; markerStyle: string; mapImageUrl: string | null }
interface ParkMap { id: string; name: string; imageUrl: string | null; bgColor: string | null; isDefault: boolean }
interface EntityLite { id: string; name: string; poiId: string | null; heroImage?: string | null; category?: string }
type DragEntity = { kind: 'attraction' | 'restaurant' | 'shop' | 'facility'; id?: string; type?: string; name: string; heroImage?: string | null };

// Facility types offered in the drag palette (attractions/restaurants come from data).
const FACILITY_PALETTE: [string, string][] = [
  ['RESTROOM', 'Restroom'], ['FIRST_AID', 'First aid'], ['SHOP', 'Shop'], ['PARKING', 'Parking'],
  ['ACCESSIBILITY', 'Accessibility'], ['BABY_CHANGING', 'Baby changing'], ['PICNIC', 'Picnic'], ['ENTRANCE', 'Entrance'], ['INFO', 'Info'],
];
const dragChipStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12, fontWeight: 600, cursor: 'grab' };
// Fixed projection bounds for the park, so pins never reproject when one is added/moved.
const PARK_BOUNDS = { minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674 };
const CANVAS_ASPECT = 7 / 5; // the .mapcanvas aspect-ratio; the base map is contain-fitted inside it

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
  const [attractions, setAttractions] = useState<EntityLite[]>([]);
  const [restaurants, setRestaurants] = useState<EntityLite[]>([]);
  const [shops, setShops] = useState<EntityLite[]>([]);
  const [mapAspect, setMapAspect] = useState<number | null>(null); // natural aspect of the base map image
  const [err, setErr] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const moved = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressId = useRef<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Zoom (1–4) + pan offset (px) for the editor viewport.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const panning = useRef(false);
  const panStart = useRef({ sx: 0, sy: 0, px: 0, py: 0 });

  const loadEntities = useCallback(() => {
    api<EntityLite[]>('/admin/attractions').then(setAttractions).catch(() => undefined);
    api<EntityLite[]>('/admin/restaurants').then(setRestaurants).catch(() => undefined);
    api<EntityLite[]>('/admin/shops').then(setShops).catch(() => undefined);
  }, []);
  const load = useCallback(() => {
    api<Poi[]>('/admin/pois').then(setPois).catch(() => undefined);
    api<MapConfig>('/admin/map-config').then((c) => setConfig({ markerColor: c.markerColor, markerStyle: c.markerStyle, mapImageUrl: c.mapImageUrl })).catch(() => undefined);
    api<ParkMap[]>('/admin/maps').then(setMaps).catch(() => undefined);
    loadEntities();
  }, [loadEntities]);
  useEffect(load, [load]);

  // Drop an entity from the palette onto the map: create a hotspot at the point
  // and (for attractions/restaurants) link it, so it leaves the palette.
  async function placeEntity(data: DragEntity, lat: number, lng: number) {
    try {
      if (data.kind === 'facility') {
        const created = await api<Poi>('/admin/pois', { method: 'POST', body: JSON.stringify({ name: data.name, type: data.type, lat, lng }) });
        setPois((p) => [...p, created]); setSelId(created.id); setErr('');
        return;
      }
      const type = data.kind === 'restaurant' ? 'RESTAURANT' : data.kind === 'shop' ? 'SHOP' : 'ATTRACTION';
      const endpoint = data.kind === 'restaurant' ? 'restaurants' : data.kind === 'shop' ? 'shops' : 'attractions';
      const created = await api<Poi>('/admin/pois', { method: 'POST', body: JSON.stringify({ name: data.name, type, lat, lng, image: data.heroImage ?? null }) });
      await api(`/admin/${endpoint}/${data.id}`, { method: 'PATCH', body: JSON.stringify({ poiId: created.id }) });
      setPois((p) => [...p, created]); setSelId(created.id); setErr('');
      loadEntities();
    } catch (e) { setErr(friendlyError(e, 'Could not place that on the map.')); }
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain'); if (!raw) return;
    let data: DragEntity; try { data = JSON.parse(raw); } catch { return; }
    const { lat, lng } = unproj(e.clientX, e.clientY);
    placeEntity(data, lat, lng);
  }

  const refreshMaps = () => api<ParkMap[]>('/admin/maps').then(setMaps).catch(() => undefined);
  async function addMap() {
    if (!newMapName.trim()) return;
    try { await api('/admin/maps', { method: 'POST', body: JSON.stringify({ name: newMapName.trim() }) }); setErr(''); }
    catch (e) { setErr(friendlyError(e, 'Could not add the map.')); }
    setNewMapName(''); refreshMaps();
  }
  // One-click base-map upload: make a default map if there isn't one, then pick a file.
  async function uploadBaseMap() {
    let target = maps.find((m) => m.isDefault) ?? maps[0];
    if (!target) {
      try {
        target = await api<ParkMap>('/admin/maps', { method: 'POST', body: JSON.stringify({ name: 'Park map' }) });
        setMaps((prev) => [...prev, target as ParkMap]);
      } catch (e) { setErr(friendlyError(e, 'Could not create the map.')); return; }
    }
    triggerUpload(target.id);
  }
  async function setDefaultMap(id: string) { await api(`/admin/maps/${id}/default`, { method: 'POST' }).catch((e) => setErr(friendlyError(e, 'Could not set the default map.'))); refreshMaps(); }
  async function setMapImage(id: string, url: string | null, bgColor?: string | null) {
    const body: Record<string, unknown> = { imageUrl: url };
    if (bgColor !== undefined) body.bgColor = bgColor;
    try { await api(`/admin/maps/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); setErr(''); }
    catch (e) { setErr(friendlyError(e, 'Could not update the map image.')); }
    refreshMaps();
  }
  async function deleteMap(id: string) {
    if (!(await confirmDelete('Delete this map?'))) return;
    try { await api(`/admin/maps/${id}`, { method: 'DELETE' }); setErr(''); }
    catch (e) { setErr(friendlyError(e, 'Could not delete the map.')); }
    refreshMaps();
  }

  // Upload an image file → resized data URL (keeps it reasonable for the app bundle).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);
  const uploadKind = useRef<'map' | 'spot'>('map');
  function triggerUpload(id: string) { uploadKind.current = 'map'; uploadTarget.current = id; fileInputRef.current?.click(); }
  function triggerSpotUpload() { uploadKind.current = 'spot'; fileInputRef.current?.click(); }
  // Returns the resized JPEG data URL plus the image's average colour (used to
  // fill the map screen's edges on mobile so they blend with the map).
  function resizeToDataUrl(file: File, maxDim: number, quality = 0.9): Promise<{ url: string; color: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const s = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * s), h = Math.round(img.height * s);
          const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const url = canvas.toDataURL('image/jpeg', quality);
          let r = 0, g = 0, b = 0, n = 0;
          try {
            const d = ctx.getImageData(0, 0, w, h).data;
            const step = Math.max(1, Math.floor((w * h) / 3000)) * 4;
            for (let i = 0; i < d.length; i += step) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          } catch { n = 0; }
          const color = n ? '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('') : '#a9c97f';
          resolve({ url, color });
        };
        img.onerror = reject; img.src = reader.result as string;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { alert('Please choose an image under 500 MB.'); return; }
    if (uploadKind.current === 'spot') {
      if (!selected) return;
      const t = uploadToast('Optimising image…');
      try {
        const { url } = await resizeToDataUrl(file, 512); // small — it sits inside a marker
        t.label('Uploading…');
        await apiUpload(`/admin/pois/${selected.id}`, { image: url }, { method: 'PATCH', onProgress: (p) => t.progress(p) });
        setPois((prev) => prev.map((p) => (p.id === selected.id ? { ...p, image: url } : p)));
        t.success('Image updated');
      } catch (err) { t.error(friendlyError(err, 'Could not upload the image.')); }
      return;
    }
    if (uploadTarget.current) {
      const t = uploadToast('Optimising image…');
      try {
        const { url, color } = await resizeToDataUrl(file, 4096, 0.92);
        t.label('Uploading map…');
        await apiUpload(`/admin/maps/${uploadTarget.current}`, { imageUrl: url, bgColor: color }, { method: 'PATCH', onProgress: (p) => t.progress(p) });
        setErr(''); refreshMaps();
        t.success('Map uploaded');
      } catch (err) { t.error(friendlyError(err, 'Could not upload the map.')); }
    }
  }

  const bounds = PARK_BOUNDS;
  // The base map is drawn objectFit:contain inside a 7/5 canvas, so it may be
  // letterboxed. Project markers onto the *image* rectangle (not the canvas box)
  // so a pin lands on — and stays at — the exact map spot, whatever the map's
  // aspect. Values are fractions (0–1) of the canvas box.
  const imgRect = useMemo(() => {
    const a = mapAspect;
    if (!a) return { ox: 0, oy: 0, w: 1, h: 1 };
    if (a > CANVAS_ASPECT) { const h = CANVAS_ASPECT / a; return { ox: 0, oy: (1 - h) / 2, w: 1, h }; }
    const w = a / CANVAS_ASPECT; return { ox: (1 - w) / 2, oy: 0, w, h: 1 };
  }, [mapAspect]);
  const proj = (p: { lat: number; lng: number }) => {
    const fx = (p.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    const fy = (bounds.maxLat - p.lat) / (bounds.maxLat - bounds.minLat);
    return { left: (imgRect.ox + fx * imgRect.w) * 100, top: (imgRect.oy + fy * imgRect.h) * 100 };
  };
  const clampPan = (x: number, y: number, z: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(w * (1 - z), x)),
    y: Math.min(0, Math.max(h * (1 - z), y)),
  });
  const unproj = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    // Undo the zoom/pan transform to get the point in un-transformed canvas space,
    // then map it through the image rectangle so drops land on the exact spot.
    const cx = (clientX - r.left - view.x) / view.zoom;
    const cy = (clientY - r.top - view.y) / view.zoom;
    const fx = Math.min(1, Math.max(0, (cx / r.width - imgRect.ox) / imgRect.w));
    const fy = Math.min(1, Math.max(0, (cy / r.height - imgRect.oy) / imgRect.h));
    return { lat: bounds.maxLat - fy * (bounds.maxLat - bounds.minLat), lng: bounds.minLng + fx * (bounds.maxLng - bounds.minLng) };
  };
  // Zoom toward a point (px within the canvas), keeping that point stable.
  function zoomAt(px: number, py: number, factor: number) {
    setView((v) => {
      const r = canvasRef.current?.getBoundingClientRect();
      const w = r?.width ?? 1, h = r?.height ?? 1;
      const nz = Math.min(4, Math.max(1, +(v.zoom * factor).toFixed(3)));
      const contentX = (px - v.x) / v.zoom, contentY = (py - v.y) / v.zoom;
      return { zoom: nz, ...clampPan(px - contentX * nz, py - contentY * nz, nz, w, h) };
    });
  }
  function zoomCenter(factor: number) { const r = canvasRef.current?.getBoundingClientRect(); zoomAt((r?.width ?? 0) / 2, (r?.height ?? 0) / 2, factor); }
  function onWheelZoom(e: React.WheelEvent) { const r = canvasRef.current!.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15); }
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (view.zoom <= 1) return; // pan only when zoomed in
    panning.current = true; moved.current = false;
    panStart.current = { sx: e.clientX, sy: e.clientY, px: view.x, py: view.y };
  }

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
    if (dragId.current) {
      moved.current = true;
      const { lat, lng } = unproj(e.clientX, e.clientY);
      setPois((prev) => prev.map((p) => (p.id === dragId.current ? { ...p, lat, lng } : p)));
      return;
    }
    if (panning.current) {
      const r = canvasRef.current!.getBoundingClientRect();
      moved.current = true;
      const c = clampPan(panStart.current.px + (e.clientX - panStart.current.sx), panStart.current.py + (e.clientY - panStart.current.sy), view.zoom, r.width, r.height);
      setView((v) => ({ ...v, x: c.x, y: c.y }));
    }
  }
  function onPointerUp() {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (panning.current) { panning.current = false; return; }
    const id = dragId.current;
    dragId.current = null;
    if (id) {
      const p = pois.find((x) => x.id === id);
      if (p) api(`/admin/pois/${id}`, { method: 'PATCH', body: JSON.stringify({ lat: p.lat, lng: p.lng }) }).catch(() => undefined);
      return;
    }
    // A short tap on a pin (no drag) opens its editor popup.
    if (pressId.current) { setSelId(pressId.current); setModalOpen(true); pressId.current = null; }
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
      loadEntities(); // any attraction/restaurant that was linked returns to the palette
    } catch (e) { setErr(friendlyError(e, 'Could not delete the hotspot.')); }
  }
  // Wipe every hotspot from the map. Deleting each POI also unlinks its
  // attraction/restaurant/shop, so they all return to the palette to re-place.
  async function clearAllHotspots() {
    if (pois.length === 0) return;
    if (!(await confirmDelete(`Remove all ${pois.length} hotspots from the map? Attractions, restaurants and shops will return to the palette so you can place them again. This can’t be undone.`))) return;
    try {
      await Promise.all(pois.map((p) => api(`/admin/pois/${p.id}`, { method: 'DELETE' })));
      setPois([]); setSelId(null); setModalOpen(false); setErr('');
      loadEntities();
    } catch (e) { setErr(friendlyError(e, 'Could not clear all hotspots.')); load(); }
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
      <div className="page-actions">
        <div><h1>Map &amp; Hotspots</h1><p className="subtitle" style={{ margin: 0 }}>Scroll to zoom, drag to pan (when zoomed). Tap a hotspot to edit, press-hold to move, or click an empty spot to add one.</p></div>
        <label className="checkline"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Show labels</label>
      </div>
      {err && <div className="error" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>{err}</div>}

      <div className="mapedit">
        <div style={{ position: 'relative' }}>
          <div ref={canvasRef} className="mapcanvas" style={{ overflow: 'hidden' }} onClick={onCanvasClick} onPointerDown={onCanvasPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheelZoom} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
            {defaultMap?.imageUrl && <img src={defaultMap.imageUrl} alt="" onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && t.naturalHeight) setMapAspect(t.naturalWidth / t.naturalHeight); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
            <div className="grid" />
            {pois.map((p) => {
              const { left, top } = proj(p);
              return (
                <div key={p.id}>
                  <div
                    className={`hot ${selId === p.id ? 'sel' : ''}`}
                    style={{ left: `${left}%`, top: `${top}%`, background: colorOf(p) }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pressId.current = p.id; moved.current = false;
                      // Press and hold to pick the pin up; a quick tap opens the popup.
                      holdTimer.current = setTimeout(() => { dragId.current = p.id; setSelId(p.id); }, 260);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={p.name}
                  >{p.image ? <img src={p.image} alt="" /> : p.type[0]}</div>
                  {showLabels && <div className="hotlabel" style={{ left: `${left}%`, top: `${top}%` }}>{p.name}</div>}
                </div>
              );
            })}
            {/* Customer marker preview */}
            <div className="custmark" style={{ left: `${custPos.left}%`, top: `${custPos.top}%`, background: config.markerColor, boxShadow: `0 0 0 6px ${config.markerColor}40` }} />
            </div>{/* /zoom-pan transform */}
          </div>
          {/* Zoom controls */}
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
            <button className="tbtn" style={{ width: 34, height: 34, padding: 0, fontSize: 18, lineHeight: 1 }} onClick={() => zoomCenter(1.3)} title="Zoom in">＋</button>
            <button className="tbtn" style={{ width: 34, height: 34, padding: 0, fontSize: 18, lineHeight: 1 }} onClick={() => zoomCenter(1 / 1.3)} title="Zoom out">－</button>
            <button className="tbtn" style={{ width: 34, height: 34, padding: 0, fontSize: 15, lineHeight: 1 }} onClick={() => setView({ zoom: 1, x: 0, y: 0 })} title="Reset view">⤢</button>
          </div>
          <p className="maphint">🟦 The ringed marker previews the guest’s “you are here” marker. Hotspots are coloured by type unless overridden.</p>
        </div>

        {/* Side panel */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Drag-and-drop palette: unplaced entities + reusable facility types */}
          <div className="editcard">
            <h3 style={{ margin: 0 }}>Place on map</h3>
            <p className="hint" style={{ margin: '6px 0 12px' }}>Drag an item onto the map to drop a hotspot. Delete a hotspot to bring its entity back here.</p>
            {attractions.filter((a) => !a.poiId).length === 0 && restaurants.filter((r) => !r.poiId).length === 0 && shops.filter((s) => !s.poiId).length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 10px' }}>All attractions, restaurants &amp; shops are placed. ✓</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {attractions.filter((a) => !a.poiId).map((a) => (
                <span key={a.id} draggable style={dragChipStyle}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'attraction', id: a.id, name: a.name, heroImage: a.heroImage } as DragEntity))}>🎭 {a.name}</span>
              ))}
              {restaurants.filter((r) => !r.poiId).map((r) => (
                <span key={r.id} draggable style={dragChipStyle}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'restaurant', id: r.id, name: r.name, heroImage: r.heroImage } as DragEntity))}>🍴 {r.name}</span>
              ))}
              {shops.filter((s) => !s.poiId).map((s) => (
                <span key={s.id} draggable style={dragChipStyle}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'shop', id: s.id, name: s.name, heroImage: s.heroImage } as DragEntity))}>🛍️ {s.name}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 0 6px', fontWeight: 700 }}>Facilities (reusable)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FACILITY_PALETTE.map(([type, label]) => (
                <span key={type} draggable style={dragChipStyle}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'facility', type, name: label } as DragEntity))}>{label}</span>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', margin: '14px 0 0', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pois.length} hotspot{pois.length === 1 ? '' : 's'} on the map</span>
              <button className="tbtn danger" onClick={clearAllHotspots} disabled={pois.length === 0}>Clear all hotspots</button>
            </div>
          </div>
          <div className="editcard">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Base maps</h3>
              <button className="primary" onClick={uploadBaseMap}>⬆ Upload map image</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '10px 0 12px', lineHeight: 1.5 }}>
              The <b>default</b> map is what the mobile app shows. For the illustrated 3D look, use a <b>portrait,
              phone-shaped</b> image (about <b>9:19.5</b>, e.g. <b>1440&nbsp;×&nbsp;3120&nbsp;px</b> or larger) so it
              fills the screen edge-to-edge with no cropping. Up to <b>4096&nbsp;px</b> on the longest edge is kept for
              sharpness when guests zoom in; <b>PNG or JPG</b>, up to <b>500&nbsp;MB</b> — large originals are optimised
              automatically in your browser before upload, so only a lightweight version is stored and sent to phones.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {maps.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No maps yet — add one below.</p>}
              {maps.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <button onClick={() => setDefaultMap(m.id)} title="Set as default"
                    style={{ width: 18, height: 18, borderRadius: '50%', border: 0, cursor: 'pointer', background: m.isDefault ? '#22b365' : '#fff', boxShadow: '0 0 0 1px var(--border)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name} {m.isDefault && <span className="pillbadge on">Default</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{m.imageUrl ? (m.imageUrl.startsWith('data:') ? 'Uploaded image' : m.imageUrl) : 'no image (illustrated map)'}</div>
                  </div>
                  <button className="tbtn" onClick={() => triggerUpload(m.id)}>Upload</button>
                  <button className="tbtn" onClick={async () => { const u = await promptText('Image URL (leave blank to remove)', m.imageUrl ?? '', 'Map image URL'); if (u !== null) setMapImage(m.id, u.trim() || null); }}>URL</button>
                  {m.imageUrl && <button className="tbtn" onClick={() => setMapImage(m.id, null, null)}>Remove</button>}
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
            <h3>Hotspots</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>Tap a hotspot to edit it in a popup. Press and hold a hotspot to drag it. Drag an item from “Place on map” above, or click an empty spot to add one.</p>
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

      {/* Hotspot editor popup — opens on tapping a marker */}
      {selected && modalOpen && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal" style={{ width: 420, maxWidth: '94vw' }}>
            <h2 style={{ marginBottom: 8 }}>Edit hotspot</h2>
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
                    ? <img src={selected.image} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--border)' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: '50%', background: colorOf(selected), display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>{selected.type[0]}</div>}
                  <button className="tbtn" onClick={triggerSpotUpload}>Upload</button>
                  {selected.image && <button className="tbtn" onClick={() => patchSel({ image: null })}>Remove</button>}
                </div>
              </div>
              <div className="form-grid">
                <div className="form-row"><label>Latitude</label><input value={selected.lat.toFixed(5)} onChange={(e) => patchSel({ lat: Number(e.target.value) || selected.lat })} /></div>
                <div className="form-row"><label>Longitude</label><input value={selected.lng.toFixed(5)} onChange={(e) => patchSel({ lng: Number(e.target.value) || selected.lng })} /></div>
              </div>
            </div>
            <div className="modal-foot" style={{ gap: 8 }}>
              <QrButton type="poi" id={selected.id} label={selected.name} />
              <button className="tbtn danger" onClick={async () => { await removeSel(); setModalOpen(false); }}>Delete</button>
              <button className="primary" onClick={() => setModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
