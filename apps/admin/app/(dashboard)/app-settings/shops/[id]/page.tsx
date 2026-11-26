'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, apiUpload, friendlyError } from '../../../../../lib/api';
import { confirmDelete } from '../../../../../lib/confirm';
import { uploadToast } from '../../../../../lib/toast';
import { QrButton } from '../../../../../components/QrButton';
import { GalleryEditor } from '../../../../../components/GalleryEditor';
import { ImportCsvModal } from '../../../../../components/ImportCsvModal';
import { ImageField } from '../../../../../components/ImageField';
import { SaveBar } from '../../../../../components/SaveBar';

const STOCK_IMPORT_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description' },
  { key: 'price', label: 'Price (£)' },
  { key: 'available', label: 'Available' },
  { key: 'variants', label: 'Variants' },
];

// "Small:2.50;Large:3.50;Red" -> [{name:'Small',priceCents:250}, {name:'Large',priceCents:350}, {name:'Red'}].
// The price half is optional per variant — omit it to fall back to the product's base price.
function parseVariants(raw: string): Variant[] {
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, price] = entry.split(':');
      const priceCents = price !== undefined ? Math.round(parseFloat(price.trim()) * 100) : NaN;
      return { name: (name ?? '').trim(), ...(Number.isFinite(priceCents) ? { priceCents } : {}) };
    })
    .filter((v) => v.name);
}

interface Poi { id: string; name: string; type: string }
interface Variant { name: string; priceCents?: number }
interface ShopItem { id: string; name: string; description: string | null; priceCents: number; image: string | null; variants: Variant[] | null; available: boolean; sortOrder: number }
interface Shop {
  id: string; name: string; slug: string; category: string | null; description: string | null;
  openingHours: string | null; heroImage: string | null; images: string[]; active: boolean; poiId: string | null; items: ShopItem[];
}

/** The part of a shop edited on this page (products save on their own), used to tell whether anything changed. */
const editable = (v: Shop) => JSON.stringify([v.name, v.category, v.description, v.openingHours, v.heroImage, v.images, v.active, v.poiId]);

function pounds(cents: number) { return (cents / 100).toFixed(2); }

type ItemForm = { id?: string; name: string; description: string; image: string; priceCents: number; available: boolean; variants: Variant[] };

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<Shop | null>(null);
  const [base, setBase] = useState('');
  const [pois, setPois] = useState<Poi[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [item, setItem] = useState<ItemForm | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    api<Shop>(`/admin/shops/${id}`).then((v) => { setS(v); setBase(editable(v)); }).catch(() => setError('Could not load this shop.'));
    api<Poi[]>('/admin/pois').then(setPois).catch(() => undefined);
  }, [id]);
  useEffect(load, [load]);

  function set<K extends keyof Shop>(k: K, v: Shop[K]) { setS((cur) => (cur ? { ...cur, [k]: v } : cur)); }

  async function saveShop() {
    if (!s) return;
    setSaving(true); setSaved(false); setError('');
    const t = uploadToast('Saving shop…');
    try {
      await apiUpload(`/admin/shops/${s.id}`, {
        name: s.name, category: s.category, description: s.description,
        openingHours: s.openingHours, heroImage: s.heroImage, images: s.images, active: s.active, poiId: s.poiId || null,
      }, { method: 'PATCH', onProgress: (p) => t.progress(p) });
      t.success('Shop saved');
      setBase(editable(s));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { t.error(friendlyError(e, 'Save failed.')); setError('Save failed.'); }
    setSaving(false);
  }

  function newItem() { setItem({ name: '', description: '', image: '', priceCents: 0, available: true, variants: [] }); setError(''); }
  function editItem(it: ShopItem) {
    setItem({ id: it.id, name: it.name, description: it.description ?? '', image: it.image ?? '', priceCents: it.priceCents, available: it.available, variants: it.variants ?? [] });
    setError('');
  }

  async function saveItem() {
    if (!item || !item.name.trim() || !s) { setError('Product name is required.'); return; }
    const body = {
      name: item.name, description: item.description || null, image: item.image || null,
      priceCents: item.priceCents, available: item.available,
      variants: item.variants.filter((v) => v.name.trim()),
    };
    const t = uploadToast('Saving product…');
    try {
      if (item.id) await apiUpload(`/admin/shop-items/${item.id}`, body, { method: 'PATCH', onProgress: (p) => t.progress(p) });
      else await apiUpload(`/admin/shops/${s.id}/items`, body, { method: 'POST', onProgress: (p) => t.progress(p) });
      t.success('Product saved');
      setItem(null); load();
    } catch (e) { t.error(friendlyError(e, 'Could not save the product.')); setError('Could not save the product.'); }
  }

  async function removeItem(it: ShopItem) {
    if (!(await confirmDelete(`Remove “${it.name}”?`))) return;
    await api(`/admin/shop-items/${it.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  async function importStock(rows: Record<string, string>[]) {
    const items = rows.map((row) => ({
      name: row.name,
      description: row.description || null,
      priceCents: Math.round(parseFloat(row.price || '0') * 100) || 0,
      available: row.available ? !/^(false|no|0)$/i.test(row.available.trim()) : true,
      variants: row.variants ? parseVariants(row.variants) : [],
    }));
    const res = await api<{ created: number; skipped: number }>(`/admin/shops/${id}/items/bulk`, {
      method: 'POST', body: JSON.stringify({ items }),
    });
    load();
    return res;
  }

  if (!s) return <div>{error ? <div className="error">{error}</div> : <p style={{ color: 'var(--muted)' }}>Loading…</p>}</div>;

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1>{s.name}</h1>
          <p className="subtitle" style={{ margin: 0 }}>Featured image, details and products.{' '}
            <span className={`pillbadge ${s.active ? 'on' : 'off'}`}>{s.active ? 'Visible in app' : 'Hidden'}</span></p>
        </div>
        <QrButton type="shop" id={s.id} label={s.name} />
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="form-grid">
          <div className="form-row full">
            <ImageField label="Featured image" value={s.heroImage} onChange={(u) => set('heroImage', u)} onError={setError}
              hint="Shows on the map pin and the shop’s detail screen." />
          </div>
          <div className="form-row full">
            <GalleryEditor images={s.images ?? []} onChange={(next) => set('images', next)} />
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
        <div><h2 style={{ margin: 0 }}>Products <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({s.items.length})</span></h2><p className="subtitle" style={{ margin: 0 }}>Each product can have an image, a price and optional varieties (size, colour, flavour…).</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="tbtn" onClick={() => setImportOpen(true)}>Import stock (CSV)</button>
          <button className="primary" onClick={newItem}>+ Add product</button>
        </div>
      </div>

      {s.items.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>No products yet. Add one, or import your stock from a spreadsheet.</div>}
      <div className="itemgrid">
        {s.items.map((it) => (
          <div key={it.id} className={`itemcard ${it.available ? '' : 'off'}`}>
            <div className="mediabox">{it.image && <img src={it.image} alt="" />}</div>
            <div className="itemcard-body">
              <div className="itemcard-top">
                <b>{it.name}</b>
                <span className="itemcard-price">£{pounds(it.priceCents)}</span>
              </div>
              {it.description && <p className="hint" style={{ margin: '2px 0' }}>{it.description}</p>}
              {it.variants && it.variants.length > 0 && (
                <p className="hint" style={{ margin: '2px 0' }}>{it.variants.map((v) => v.name).join(' · ')}</p>
              )}
              {!it.available && <span className="pillbadge off">Unavailable</span>}
              <div className="itemcard-actions">
                <button className="tbtn" onClick={() => editItem(it)}>Edit</button>
                <QrButton type="shop-item" id={it.id} label={it.name} parentSlug={s.slug} />
                <button className="tbtn danger" onClick={() => removeItem(it)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SaveBar dirty={editable(s) !== base} saving={saving} saved={saved} onSave={saveShop} onDiscard={load} />

      {item && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setItem(null)}>
          <div className="modal" style={{ width: 540 }}>
            <h2>{item.id ? 'Edit product' : 'Add product'}</h2>
            <div className="form-grid">
              <div className="form-row full">
                <ImageField label="Product image" value={item.image} onChange={(u) => setItem({ ...item, image: u })} onError={setError} width={96} height={96} maxDim={900} />
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

      {importOpen && (
        <ImportCsvModal
          title="Import stock"
          columns={STOCK_IMPORT_COLUMNS}
          note="available defaults to yes unless set to false/no/0. variants is optional and semicolon-separated as Name:Price, e.g. Small:2.50;Large:3.50;Red (a variant with no price uses the base price)."
          onImport={importStock}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
