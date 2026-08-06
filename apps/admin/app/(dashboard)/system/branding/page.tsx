'use client';

import { useEffect, useState } from 'react';

interface Branding { appName: string; tagline: string; primary: string; accent: string; logoText: string }
const DEFAULT: Branding = { appName: 'Kynren', tagline: 'The Storied Lands', primary: '#8f1d21', accent: '#22b365', logoText: 'Kynren' };
const KEY = 'sys_branding';

export default function BrandingPage() {
  const [b, setB] = useState<Branding>(DEFAULT);
  const [saved, setSaved] = useState(false);

  useEffect(() => { const raw = localStorage.getItem(KEY); if (raw) setB({ ...DEFAULT, ...JSON.parse(raw) }); }, []);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => { setB((p) => ({ ...p, [k]: v })); setSaved(false); };
  function save() { localStorage.setItem(KEY, JSON.stringify(b)); setSaved(true); setTimeout(() => setSaved(false), 1600); }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Branding applied across the admin and mobile app.</p>
        <button className="primary" onClick={save}>{saved ? '✓ Saved' : 'Save branding'}</button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="form-grid">
            <div className="form-row"><label>App name</label><input value={b.appName} onChange={(e) => set('appName', e.target.value)} /></div>
            <div className="form-row"><label>Logo wordmark</label><input value={b.logoText} onChange={(e) => set('logoText', e.target.value)} /></div>
            <div className="form-row full"><label>Tagline</label><input value={b.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
            <div className="form-row"><label>Primary colour</label><input type="color" value={b.primary} onChange={(e) => set('primary', e.target.value)} style={{ height: 42, padding: 4 }} /></div>
            <div className="form-row"><label>Accent colour</label><input type="color" value={b.accent} onChange={(e) => set('accent', e.target.value)} style={{ height: 42, padding: 4 }} /></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Preview</div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <div style={{ background: b.primary, color: '#fff', padding: '22px 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{b.logoText}</div>
              <div style={{ opacity: 0.9 }}>{b.tagline}</div>
            </div>
            <div style={{ padding: 16, display: 'flex', gap: 10 }}>
              <span style={{ background: b.primary, color: '#fff', padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>{b.appName}</span>
              <span style={{ background: b.accent, color: '#fff', padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>Accent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
