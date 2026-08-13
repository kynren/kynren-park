'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, apiUpload, friendlyError } from '../../../../../lib/api';
import { confirmDelete } from '../../../../../lib/confirm';
import { uploadToast } from '../../../../../lib/toast';
import { QrButton } from '../../../../../components/QrButton';
import { GalleryEditor } from '../../../../../components/GalleryEditor';
import { ImportCsvModal } from '../../../../../components/ImportCsvModal';

const MENU_IMPORT_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description' },
  { key: 'price', label: 'Price (£)' },
  { key: 'dietaryTags', label: 'Dietary tags' },
  { key: 'available', label: 'Available' },
];

interface Poi { id: string; name: string; type: string }
interface MenuItem { id: string; name: string; description: string | null; priceCents: number; image: string | null; dietaryTags: string[]; available: boolean }
interface Restaurant {
  id: string; name: string; slug: string; cuisine: string | null; description: string | null;
  priceRange: string; openingHours: string | null; heroImage: string | null; images: string[]; clickCollect: boolean;
  active: boolean; poiId: string | null; menuItems: MenuItem[];
}

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

function pounds(cents: number) { return (cents / 100).toFixed(2); }

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Restaurant | null>(null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const heroRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<(Partial<MenuItem> & { id?: string }) | null>(null);
  const itemFileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    api<Restaurant>(`/admin/restaurants/${id}`).then(setR).catch(() => setError('Could not load this restaurant.'));
    api<Poi[]>('/admin/pois').then((p) => setPois(p.filter((x) => x.type === 'RESTAURANT' || !x.type))).catch(() => undefined);
  }, [id]);
  useEffect(load, [load]);

  function set<K extends keyof Restaurant>(k: K, v: Restaurant[K]) { setR((cur) => (cur ? { ...cur, [k]: v } : cur)); }

  async function onHero(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { set('heroImage', await resizeToDataUrl(file, 1400)); } catch { setError('Could not read that image.'); }
  }

  async function saveRestaurant() {
    if (!r) return;
    setSaving(true); setSaved(false); setError('');
    const t = uploadToast('Saving restaurant…');
    try {
      await apiUpload(`/admin/restaurants/${r.id}`, {
        name: r.name, cuisine: r.cuisine, description: r.description, priceRange: r.priceRange,
        openingHours: r.openingHours, heroImage: r.heroImage, images: r.images, clickCollect: r.clickCollect,
        active: r.active, poiId: r.poiId || null,
      }, { method: 'PATCH', onProgress: (p) => t.progress(p) });
      t.success('Restaurant saved');
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { t.error(friendlyError(e, 'Save failed.')); setError('Save failed.'); }
    setSaving(false);
  }

  async function onItemImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !item) return;
    try { setItem({ ...item, image: await resizeToDataUrl(file, 900) }); } catch { /* ignore */ }
  }

  async function saveItem() {
    if (!item || !item.name?.trim() || !r) { setError('Item name is required.'); return; }
    const body = {
      name: item.name, description: item.description ?? null, image: item.image ?? null,
      priceCents: item.priceCents ?? 0, dietaryTags: item.dietaryTags ?? [], available: item.available ?? true,
    };
    const t = uploadToast('Saving item…');
    try {
      if (item.id) await apiUpload(`/admin/menu-items/${item.id}`, body, { method: 'PATCH', onProgress: (p) => t.progress(p) });
      else await apiUpload(`/admin/restaurants/${r.id}/menu-items`, body, { method: 'POST', onProgress: (p) => t.progress(p) });
      t.success('Item saved');
      setItem(null); load();
    } catch (e) { t.error(friendlyError(e, 'Could not save the item.')); setError('Could not save the item.'); }
  }

  async function removeItem(mi: MenuItem) {
    if (!(await confirmDelete(`Remove “${mi.name}” from the menu?`))) return;
    await api(`/admin/menu-items/${mi.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  async function importMenu(rows: Record<string, string>[]) {
    const items = rows.map((row) => ({
      name: row.name,
      description: row.description || null,
      priceCents: Math.round(parseFloat(row.price || '0') * 100) || 0,
      dietaryTags: row.dietaryTags ? row.dietaryTags.split(';').map((t) => t.trim()).filter(Boolean) : [],
      available: row.available ? !/^(false|no|0)$/i.test(row.available.trim()) : true,
    }));
    const res = await api<{ created: number; skipped: number }>(`/admin/restaurants/${id}/menu-items/bulk`, {
      method: 'POST', body: JSON.stringify({ items }),
    });
    load();
    return res;
  }

  if (!r) return <div>{error ? <div className="error">{error}</div> : <p style={{ color: 'var(--muted)' }}>Loading…</p>}</div>;

  return (
    <div>
      <div className="page-actions">
        <div><h1>{r.name}</h1><p className="subtitle" style={{ margin: 0 }}>Featured image, details and menu.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <QrButton type="restaurant" id={r.id} label={r.name} />
          {saved && <span className="tag-on">Saved ✓</span>}
          <button className="primary" onClick={saveRestaurant} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="form-grid">
          <div className="form-row full">
            <label>Featured image</label>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 200, height: 120, borderRadius: 10, overflow: 'hidden', background: 'var(--panel,#f0ece6)', flex: '0 0 auto' }}>
                {r.heroImage
                  ? <img src={r.heroImage} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>No image</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={heroRef} type="file" accept="image/*" hidden onChange={onHero} />
                <button className="tbtn" onClick={() => heroRef.current?.click()}>Upload image</button>
                {r.heroImage && <button className="tbtn danger" onClick={() => set('heroImage', '')}>Remove</button>}
                <span className="hint">Shows on the map pin, food list and detail screen.</span>
              </div>
            </div>
          </div>
          <div className="form-row full">
            <GalleryEditor images={r.images ?? []} onChange={(next) => set('images', next)} />
          </div>
          <div className="form-row"><label>Name *</label><input value={r.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="form-row"><label>Cuisine</label><input value={r.cuisine ?? ''} onChange={(e) => set('cuisine', e.target.value)} /></div>
          <div className="form-row"><label>Price range</label>
            <select value={r.priceRange} onChange={(e) => set('priceRange', e.target.value)}>
              <option value="BUDGET">£ Budget</option><option value="MODERATE">££ Moderate</option><option value="PREMIUM">£££ Premium</option>
            </select>
          </div>
          <div className="form-row"><label>Serving times</label><input placeholder="10:00–19:30" value={r.openingHours ?? ''} onChange={(e) => set('openingHours', e.target.value)} /></div>
          <div className="form-row full"><label>Description</label><textarea value={r.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="form-row"><label>Map location (POI)</label>
            <select value={r.poiId ?? ''} onChange={(e) => set('poiId', e.target.value)}>
              <option value="">— none —</option>
              {pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row"><label className="checkline"><input type="checkbox" checked={r.clickCollect} onChange={(e) => set('clickCollect', e.target.checked)} /> Click &amp; Collect</label></div>
          <div className="form-row"><label className="checkline"><input type="checkbox" checked={r.active} onChange={(e) => set('active', e.target.checked)} /> Visible in app</label></div>
        </div>
      </div>

      <div className="page-actions">
        <div><h2 style={{ margin: 0 }}>Menu</h2><p className="subtitle" style={{ margin: 0 }}>Each item can have an image and a price.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="tbtn" onClick={() => setImportOpen(true)}>Import menu (CSV)</button>
          <button className="primary" onClick={() => { setItem({ available: true, priceCents: 0, dietaryTags: [] }); setError(''); }}>+ Add item</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {r.menuItems.length === 0 && <p style={{ color: 'var(--muted)' }}>No menu items yet.</p>}
        {r.menuItems.map((mi) => (
          <div key={mi.id} className="card" style={{ padding: 12, display: 'flex', gap: 12, opacity: mi.available ? 1 : 0.55 }}>
            <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)', flex: '0 0 auto' }}>
              {mi.image && <img src={mi.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mi.name}</b>
                <span style={{ whiteSpace: 'nowrap' }}>£{pounds(mi.priceCents)}</span>
              </div>
              {mi.description && <p className="hint" style={{ margin: '2px 0' }}>{mi.description}</p>}
              <div style={{ marginTop: 6 }}>
                <button className="tbtn" onClick={() => setItem({ ...mi })}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => removeItem(mi)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {item && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setItem(null)}>
          <div className="modal" style={{ width: 480 }}>
            <h2>{item.id ? 'Edit item' : 'Add item'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Item image</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 84, height: 84, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)' }}>
                    {item.image && <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <input ref={itemFileRef} type="file" accept="image/*" hidden onChange={onItemImage} />
                  <button className="tbtn" onClick={() => itemFileRef.current?.click()}>Upload</button>
                  {item.image && <button className="tbtn danger" onClick={() => setItem({ ...item, image: '' })}>Remove</button>}
                </div>
              </div>
              <div className="form-row full"><label>Name *</label><input value={item.name ?? ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="form-row"><label>Price (£)</label><input type="number" step="0.01" min="0" value={((item.priceCents ?? 0) / 100).toString()} onChange={(e) => setItem({ ...item, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) })} /></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={item.available ?? true} onChange={(e) => setItem({ ...item, available: e.target.checked })} /> Available</label></div>
              <div className="form-row full"><label>Description</label><textarea value={item.description ?? ''} onChange={(e) => setItem({ ...item, description: e.target.value })} /></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setItem(null)}>Cancel</button>
              <button className="primary" onClick={saveItem}>{item.id ? 'Save item' : 'Add item'}</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <ImportCsvModal
          title="Import menu"
          columns={MENU_IMPORT_COLUMNS}
          note="dietaryTags is optional and semicolon-separated, e.g. vegan;gf. available defaults to yes unless set to false/no/0."
          onImport={importMenu}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
