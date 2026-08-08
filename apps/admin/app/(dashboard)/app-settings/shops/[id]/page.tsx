'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { confirmDelete } from '../../../../../lib/confirm';
import { QrButton } from '../../../../../components/QrButton';

interface Poi { id: string; name: string; type: string }
interface Variant { name: string; priceCents?: number }
interface ShopItem { id: string; name: string; description: string | null; priceCents: number; image: string | null; variants: Variant[] | null; available: boolean; sortOrder: number }
interface Shop {
  id: string; name: string; slug: string; category: string | null; description: string | null;
  openingHours: string | null; heroImage: string | null; active: boolean; poiId: string | null; items: ShopItem[];
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

type ItemForm = { id?: string; name: string; description: string; image: string; priceCents: number; available: boolean; variants: Variant[] };

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<Shop | null>(null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const heroRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<ItemForm | null>(null);
  const itemFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<Shop>(`/admin/shops/${id}`).then(setS).catch(() => setError('Could not load this shop.'));
    api<Poi[]>('/admin/pois').then(setPois).catch(() => undefined);
  }, [id]);
  useEffect(load, [load]);

  function set<K extends keyof Shop>(k: K, v: Shop[K]) { setS((cur) => (cur ? { ...cur, [k]: v } : cur)); }

  async function onHero(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { set('heroImage', await resizeToDataUrl(file, 1400)); } catch { setError('Could not read that image.'); }
  }

  async function saveShop() {
    if (!s) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await api(`/admin/shops/${s.id}`, { method: 'PATCH', body: JSON.stringify({
        name: s.name, category: s.category, description: s.description,
        openingHours: s.openingHours, heroImage: s.heroImage, active: s.active, poiId: s.poiId || null,
      }) });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { setError('Save failed.'); }
    setSaving(false);
  }

  function newItem() { setItem({ name: '', description: '', image: '', priceCents: 0, available: true, variants: [] }); setError(''); }
  function editItem(it: ShopItem) {
    setItem({ id: it.id, name: it.name, description: it.description ?? '', image: it.image ?? '', priceCents: it.priceCents, available: it.available, variants: it.variants ?? [] });
    setError('');
  }

  async function onItemImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !item) return;
    try { setItem({ ...item, image: await resizeToDataUrl(file, 900) }); } catch { /* ignore */ }
  }

  async function saveItem() {
    if (!item || !item.name.trim() || !s) { setError('Product name is required.'); return; }
    const body = {
      name: item.name, description: item.description || null, image: item.image || null,
      priceCents: item.priceCents, available: item.available,
      variants: item.variants.filter((v) => v.name.trim()),
    };
    try {
      if (item.id) await api(`/admin/shop-items/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/admin/shops/${s.id}/items`, { method: 'POST', body: JSON.stringify(body) });
      setItem(null); load();
    } catch { setError('Could not save the product.'); }
  }

  async function removeItem(it: ShopItem) {
    if (!(await confirmDelete(`Remove “${it.name}”?`))) return;
    await api(`/admin/shop-items/${it.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  if (!s) return <div>{error ? <div className="error">{error}</div> : <p style={{ color: 'var(--muted)' }}>Loading…</p>}</div>;

  return (
    <div>
      <div className="page-actions">
        <div><h1>{s.name}</h1><p className="subtitle" style={{ margin: 0 }}>Featured image, details and products.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <QrButton type="shop" id={s.id} label={s.name} />
          {saved && <span className="tag-on">Saved ✓</span>}
          <button className="primary" onClick={saveShop} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="form-grid">
          <div className="form-row full">
            <label>Featured image</label>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 200, height: 120, borderRadius: 10, overflow: 'hidden', background: 'var(--panel,#f0ece6)', flex: '0 0 auto' }}>
                {s.heroImage
                  ? <img src={s.heroImage} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>No image</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={heroRef} type="file" accept="image/*" hidden onChange={onHero} />
                <button className="tbtn" onClick={() => heroRef.current?.click()}>Upload image</button>
                {s.heroImage && <button className="tbtn danger" onClick={() => set('heroImage', '')}>Remove</button>}
                <span className="hint">Shows on the map pin and the shop’s detail screen.</span>
              </div>
            </div>
          </div>
          <div className="form-row"><label>Name *</label><input value={s.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="form-row"><label>Category</label><input placeholder="Gifts, sweets, clothing…" value={s.category ?? ''} onChange={(e) => set('category', e.target.value)} /></div>
          <div className="form-row"><label>Opening hours</label><input placeholder="10:00–18:00" value={s.openingHours ?? ''} onChange={(e) => set('openingHours', e.target.value)} /></div>
          <div className="form-row"><label>Map location (POI)</label>
            <select value={s.poiId ?? ''} onChange={(e) => set('poiId', e.target.value)}>
              <option value="">— none —</option>
              {pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row full"><label>Description</label><textarea value={s.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="form-row"><label className="checkline"><input type="checkbox" checked={s.active} onChange={(e) => set('active', e.target.checked)} /> Visible in app</label></div>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>Tip: to place this shop on the map, choose a POI here, or drag it onto the map from App Settings → Map &amp; Hotspots.</p>
      </div>

      <div className="page-actions">
        <div><h2 style={{ margin: 0 }}>Products</h2><p className="subtitle" style={{ margin: 0 }}>Each product can have an image, a price and optional varieties (size, colour, flavour…).</p></div>
        <button className="primary" onClick={newItem}>+ Add product</button>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {s.items.length === 0 && <p style={{ color: 'var(--muted)' }}>No products yet.</p>}
        {s.items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 12, display: 'flex', gap: 12, opacity: it.available ? 1 : 0.55 }}>
            <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)', flex: '0 0 auto' }}>
              {it.image && <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</b>
                <span style={{ whiteSpace: 'nowrap' }}>£{pounds(it.priceCents)}</span>
              </div>
              {it.description && <p className="hint" style={{ margin: '2px 0' }}>{it.description}</p>}
              {it.variants && it.variants.length > 0 && (
                <p className="hint" style={{ margin: '2px 0' }}>{it.variants.map((v) => v.name).join(' · ')}</p>
              )}
              <div style={{ marginTop: 6 }}>
                <button className="tbtn" onClick={() => editItem(it)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => removeItem(it)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {item && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setItem(null)}>
          <div className="modal" style={{ width: 520 }}>
            <h2>{item.id ? 'Edit product' : 'Add product'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Product image</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 84, height: 84, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)' }}>
                    {item.image && <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <input ref={itemFileRef} type="file" accept="image/*" hidden onChange={onItemImage} />
                  <button className="tbtn" onClick={() => itemFileRef.current?.click()}>Upload</button>
                  {item.image && <button className="tbtn danger" onClick={() => setItem({ ...item, image: '' })}>Remove</button>}
                </div>
              </div>
              <div className="form-row full"><label>Name *</label><input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="form-row"><label>Price (£)</label><input type="number" step="0.01" min="0" value={(item.priceCents / 100).toString()} onChange={(e) => setItem({ ...item, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) })} /></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={item.available} onChange={(e) => setItem({ ...item, available: e.target.checked })} /> Available</label></div>
              <div className="form-row full"><label>Description</label><textarea value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} /></div>

              <div className="form-row full">
                <label>Varieties (optional)</label>
                <p className="hint" style={{ margin: '0 0 8px' }}>Add each variety — e.g. “Small”, “Large”, “Red”. Leave the £ blank to use the base price, or set a variety-specific price.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {item.variants.map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input style={{ flex: 1 }} placeholder="Variety name" value={v.name} onChange={(e) => { const vs = [...item.variants]; vs[i] = { ...vs[i], name: e.target.value }; setItem({ ...item, variants: vs }); }} />
                      <input style={{ width: 110 }} type="number" step="0.01" min="0" placeholder="£ (opt.)" value={v.priceCents !== undefined ? (v.priceCents / 100).toString() : ''} onChange={(e) => { const vs = [...item.variants]; const raw = e.target.value; vs[i] = { ...vs[i], priceCents: raw === '' ? undefined : Math.round(parseFloat(raw) * 100) }; setItem({ ...item, variants: vs }); }} />
                      <button className="tbtn danger" onClick={() => setItem({ ...item, variants: item.variants.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                  ))}
                  <button className="tbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setItem({ ...item, variants: [...item.variants, { name: '' }] })}>+ Add variety</button>
                </div>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setItem(null)}>Cancel</button>
              <button className="primary" onClick={saveItem}>{item.id ? 'Save product' : 'Add product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
