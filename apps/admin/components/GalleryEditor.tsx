'use client';

import { useRef } from 'react';

function resizeToDataUrl(file: File, maxDim: number, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

/**
 * Add/remove/reorder photos for a detail-page carousel (mobile app). The
 * first photo leads the swipeable gallery; ◀▶ reorder, ✕ removes.
 */
export function GalleryEditor({ images, onChange, label = 'Gallery photos', maxDim = 1600 }: {
  images: string[]; onChange: (next: string[]) => void; label?: string; maxDim?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const added = await Promise.all(files.map((f) => resizeToDataUrl(f, maxDim)));
    onChange([...images, ...added]);
  }
  function remove(i: number) { onChange(images.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <label>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {images.map((url, i) => (
          <div key={i} style={{ position: 'relative', width: 110, height: 78, borderRadius: 8, overflow: 'hidden', background: 'var(--panel,#f0ece6)', border: '1px solid var(--line)' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 3 }}>
              <button type="button" className="tbtn" style={{ padding: '1px 5px', fontSize: 11 }} onClick={() => move(i, -1)} disabled={i === 0}>◀</button>
              <button type="button" className="tbtn" style={{ padding: '1px 5px', fontSize: 11 }} onClick={() => move(i, 1)} disabled={i === images.length - 1}>▶</button>
              <button type="button" className="tbtn danger" style={{ padding: '1px 5px', fontSize: 11 }} onClick={() => remove(i)}>✕</button>
            </div>
            {i === 0 && <span style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>1ST</span>}
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} style={{ width: 110, height: 78, borderRadius: 8, border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + Add photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      </div>
      <p className="hint" style={{ marginTop: 6 }}>Shown as a swipeable gallery at the top of the detail page. The first photo (marked 1ST) leads; use ◀▶ to reorder.</p>
    </div>
  );
}
