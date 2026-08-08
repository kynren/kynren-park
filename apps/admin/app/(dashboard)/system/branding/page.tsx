'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../../../lib/api';
import { DEFAULT_BRANDING, resizeToDataUrl, rawDataUrl, type Branding } from '../../../../lib/branding';

export default function BrandingPage() {
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const logoInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const splashInput = useRef<HTMLInputElement>(null);
  const splashType = b.splashType ?? 'none';

  async function pickSplash(file?: File | null) {
    if (!file) return;
    try {
      // Keep GIFs raw (resizing flattens the animation); resize plain photos.
      const url = file.type === 'image/gif' ? await rawDataUrl(file) : await resizeToDataUrl(file, 1200);
      setB((p) => ({ ...p, splashMediaUrl: url, splashType: file.type === 'image/gif' ? 'gif' : 'photo' }));
      setSaved(false);
    } catch { setError('Could not read that file.'); }
  }

  useEffect(() => {
    api<Branding>('/branding').then((v) => setB({ ...DEFAULT_BRANDING, ...v })).catch(() => setError('Could not load branding.'));
  }, []);

  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => { setB((p) => ({ ...p, [k]: v })); setSaved(false); };

  async function pick(kind: 'logo' | 'icon' | 'favicon', file?: File | null) {
    if (!file) return;
    const maxDim = kind === 'logo' ? 640 : kind === 'favicon' ? 64 : 512;
    const field = kind === 'logo' ? 'logoUrl' : kind === 'favicon' ? 'faviconUrl' : 'iconUrl';
    try { set(field, await resizeToDataUrl(file, maxDim)); }
    catch { setError('Could not read that image.'); }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const next = await api<Branding>('/admin/branding', {
        method: 'PATCH',
        body: JSON.stringify({ appName: b.appName, tagline: b.tagline, primary: b.primary, accent: b.accent, font: b.font ?? 'system', logoUrl: b.logoUrl ?? null, iconUrl: b.iconUrl ?? null, faviconUrl: b.faviconUrl ?? null, splashType: b.splashType ?? 'none', splashMediaUrl: b.splashMediaUrl ?? null }),
      });
      setB({ ...DEFAULT_BRANDING, ...next });
      localStorage.setItem('kynren_branding', JSON.stringify(next));
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch { setError('Save failed — you need the “System administration” permission.'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Logo, icon and colours — applied across the admin and the mobile app.</p>
        <button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save branding'}</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="grid-2">
        <div className="panel">
          <div className="form-grid">
            <div className="form-row"><label>App name</label><input value={b.appName} onChange={(e) => set('appName', e.target.value)} /></div>
            <div className="form-row full"><label>Tagline</label><input value={b.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
            <div className="form-row"><label>Primary colour</label><input type="color" value={b.primary} onChange={(e) => set('primary', e.target.value)} style={{ height: 42, padding: 4 }} /></div>
            <div className="form-row"><label>Accent colour</label><input type="color" value={b.accent} onChange={(e) => set('accent', e.target.value)} style={{ height: 42, padding: 4 }} /></div>
            <div className="form-row"><label>App font</label>
              <select value={b.font ?? 'system'} onChange={(e) => set('font', e.target.value)}>
                <option value="system">System (default)</option>
                <option value="serif">Serif (classic)</option>
                <option value="rounded">Rounded</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
          </div>

          <div className="panel-title" style={{ margin: '18px 0 10px' }}>Logo (wordmark)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ height: 48, minWidth: 120, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', display: 'grid', placeItems: 'center', padding: 6 }}>
              {b.logoUrl ? <img src={b.logoUrl} alt="logo" style={{ maxHeight: 40, maxWidth: 160 }} /> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>No logo</span>}
            </div>
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => pick('logo', e.target.files?.[0])} />
            <button className="tbtn" onClick={() => logoInput.current?.click()}>Upload</button>
            {b.logoUrl && <button className="tbtn danger" onClick={() => set('logoUrl', null)}>Remove</button>}
          </div>

          <div className="panel-title" style={{ margin: '18px 0 10px' }}>Icon (square)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, border: '1px solid var(--line)', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {b.iconUrl ? <img src={b.iconUrl} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>None</span>}
            </div>
            <input ref={iconInput} type="file" accept="image/*" hidden onChange={(e) => pick('icon', e.target.files?.[0])} />
            <button className="tbtn" onClick={() => iconInput.current?.click()}>Upload</button>
            {b.iconUrl && <button className="tbtn danger" onClick={() => set('iconUrl', null)}>Remove</button>}
          </div>

          <div className="panel-title" style={{ margin: '18px 0 10px' }}>Favicon (browser tab)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--line)', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {b.faviconUrl ? <img src={b.faviconUrl} alt="favicon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>}
            </div>
            <input ref={faviconInput} type="file" accept="image/*" hidden onChange={(e) => pick('favicon', e.target.files?.[0])} />
            <button className="tbtn" onClick={() => faviconInput.current?.click()}>Upload</button>
            {b.faviconUrl && <button className="tbtn danger" onClick={() => set('faviconUrl', null)}>Remove</button>}
          </div>
          <p className="hint" style={{ marginTop: 14 }}>Best results: logo ~640px wide PNG (transparent), icon a 512×512 square, favicon a small square (32–64px). The phone’s home-screen launcher icon is set at build time and needs an app rebuild to change.</p>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Preview</div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <div style={{ background: b.primary, color: '#fff', padding: '22px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {b.iconUrl && <img src={b.iconUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
              <div>
                {b.logoUrl ? <img src={b.logoUrl} alt="" style={{ maxHeight: 34, maxWidth: 180 }} /> : <div style={{ fontSize: 24, fontWeight: 800 }}>{b.appName}</div>}
                <div style={{ opacity: 0.9, fontSize: 13 }}>{b.tagline}</div>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', gap: 10 }}>
              <span style={{ background: b.primary, color: '#fff', padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>{b.appName}</span>
              <span style={{ background: b.accent, color: '#fff', padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>Accent</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-title" style={{ marginBottom: 4 }}>App loading screen (mobile)</div>
        <p className="subtitle" style={{ marginTop: 0 }}>Shown while the app opens — choose a photo, GIF or video. Plays muted, looping and cover-fit on both iOS and Android.</p>
        <div className="grid-2">
          <div>
            <div className="form-row" style={{ marginBottom: 10 }}><label>Type</label>
              <select value={splashType} onChange={(e) => set('splashType', e.target.value as Branding['splashType'])}>
                <option value="none">None (default cross)</option>
                <option value="photo">Photo</option>
                <option value="gif">GIF</option>
                <option value="video">Video</option>
              </select>
            </div>
            {splashType !== 'none' && (
              <>
                <div className="form-row" style={{ marginBottom: 10 }}><label>Media URL {splashType === 'video' ? '(mp4 / HLS)' : '(or upload below)'}</label>
                  <input value={b.splashMediaUrl ?? ''} onChange={(e) => set('splashMediaUrl', e.target.value)} placeholder="https://…" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(splashType === 'photo' || splashType === 'gif') && (
                    <>
                      <input ref={splashInput} type="file" accept={splashType === 'gif' ? 'image/gif' : 'image/*'} hidden onChange={(e) => pickSplash(e.target.files?.[0])} />
                      <button className="tbtn" onClick={() => splashInput.current?.click()}>Upload {splashType}</button>
                    </>
                  )}
                  {b.splashMediaUrl && <button className="tbtn danger" onClick={() => set('splashMediaUrl', null)}>Remove</button>}
                </div>
              </>
            )}
            <p className="hint" style={{ marginTop: 14 }}>
              Recommended — <b>Photo/GIF</b>: portrait 1080×1920 (9:16), under ~2&nbsp;MB. <b>Video</b>: MP4 (H.264 + AAC), 1080×1920, 3–6&nbsp;s, muted, under ~10&nbsp;MB — host it and paste the URL rather than uploading. The splash stays up ~1.6&nbsp;s minimum (never flashes) and caps at 6&nbsp;s.
            </p>
          </div>
          <div>
            <div className="panel-title" style={{ marginBottom: 10 }}>Phone preview</div>
            <div style={{ width: 190, height: 340, margin: '0 auto', borderRadius: 24, overflow: 'hidden', border: '7px solid #111', background: '#000', display: 'grid', placeItems: 'center' }}>
              {splashType === 'none' || !b.splashMediaUrl
                ? <span style={{ color: '#888', fontSize: 12 }}>Default cross</span>
                : splashType === 'video'
                  ? <video src={b.splashMediaUrl} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src={b.splashMediaUrl} alt="loading screen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
