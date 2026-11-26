'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { ImageField } from '../../../../components/ImageField';
import { resizeToJpeg } from '../../../../lib/images';

type Section = { key: string; visible: boolean };
interface HomeScreen {
  id: string; name: string; isDefault: boolean; status: string;
  heroType: string; heroMediaUrl: string | null; tagline: string | null;
  greeting: string | null; greetingSub: string | null; primaryColor: string | null;
  accentColor: string | null; sections: Section[] | null; publishAt: string | null; publishedAt: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  actions: 'Ticket & account buttons',
  welcome: 'Welcome & opening hours',
  info: 'Weather, shuttle & access tiles',
  services: 'Theme park services (shows, attractions, restaurants, shops)',
  visit: 'Add visit dates card',
  announcement: 'Latest announcement',
  alerts: 'Today’s changes',
  comingUp: 'Coming up (next shows)',
  favourites: 'Your favourites (next show per favourited attraction)',
};
const DEFAULT_SECTIONS: Section[] = [
  { key: 'actions', visible: true }, { key: 'welcome', visible: true }, { key: 'info', visible: true }, { key: 'services', visible: true }, { key: 'visit', visible: true },
  { key: 'announcement', visible: true }, { key: 'alerts', visible: true }, { key: 'comingUp', visible: true },
  { key: 'favourites', visible: true },
];
const MAX_MB = 8; // source cap; still images are resized down before upload
const BRAND_NAVY = '#1b2b4b', BRAND_RED = '#db0833';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

const EMPTY = {
  name: '', heroType: 'none', heroMediaUrl: '', tagline: 'An epic tale\nof England',
  greeting: 'Welcome', greetingSub: '', primaryColor: '#1b2b4b', accentColor: '#db0833',
  sections: DEFAULT_SECTIONS as Section[],
};
type Form = typeof EMPTY & { id?: string };

const statusBadge: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: 'var(--line)', fg: 'var(--muted)', label: 'Draft' },
  scheduled: { bg: 'var(--full-soft)', fg: 'var(--full)', label: 'Scheduled' },
  published: { bg: 'var(--ok-soft)', fg: 'var(--ok)', label: 'Published' },
};

export default function HomeDesigner() {
  const [list, setList] = useState<HomeScreen[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<HomeScreen[]>('/admin/home-screens').then(setList).catch((e) => setError(friendlyError(e, 'Could not load home screens.')));
  }, []);
  useEffect(load, [load]);

  function openNew() { setForm({ ...EMPTY, name: `Layout ${list.length + 1}` }); setError(''); setScheduleAt(''); }
  function openEdit(h: HomeScreen) {
    setForm({
      id: h.id, name: h.name, heroType: h.heroType, heroMediaUrl: h.heroMediaUrl ?? '',
      tagline: h.tagline ?? '', greeting: h.greeting ?? '', greetingSub: h.greetingSub ?? '',
      primaryColor: h.primaryColor ?? '#1b2b4b', accentColor: h.accentColor ?? '#db0833',
      sections: (h.sections?.length ? h.sections : DEFAULT_SECTIONS).map((s) => ({ ...s })),
    });
    setError(''); setScheduleAt('');
  }

  function moveSection(i: number, dir: -1 | 1) {
    if (!form) return;
    const next = [...form.sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setForm({ ...form, sections: next });
  }
  function toggleSection(i: number) {
    if (!form) return;
    const next = form.sections.map((s, k) => (k === i ? { ...s, visible: !s.visible } : s));
    setForm({ ...form, sections: next });
  }

  async function saveDraft(): Promise<string | null> {
    if (!form) return null;
    if (!form.name.trim()) { setError('Give this layout a name.'); return null; }
    const body = { ...form, heroMediaUrl: form.heroMediaUrl || null };
    try {
      if (form.id) { await api(`/admin/home-screens/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) }); return form.id; }
      const created = await api<HomeScreen>('/admin/home-screens', { method: 'POST', body: JSON.stringify(body) });
      setForm({ ...form, id: created.id });
      return created.id;
    } catch (e) { setError(friendlyError(e, 'Save failed.')); return null; }
  }
  async function save() { setBusy(true); const id = await saveDraft(); setBusy(false); if (id) { setForm(null); load(); } }

  async function publishNow() {
    setBusy(true);
    const id = await saveDraft();
    if (id) {
      try { await api(`/admin/home-screens/${id}/publish`, { method: 'POST', body: JSON.stringify({}) }); setForm(null); load(); }
      catch (e) { setError(friendlyError(e, 'Publish failed.')); }
    }
    setBusy(false);
  }
  async function schedule() {
    if (!scheduleAt) { setError('Pick a date & time to schedule.'); return; }
    setBusy(true);
    const id = await saveDraft();
    if (id) {
      try { await api(`/admin/home-screens/${id}/publish`, { method: 'POST', body: JSON.stringify({ at: new Date(scheduleAt).toISOString() }) }); setForm(null); load(); }
      catch (e) { setError(friendlyError(e, 'Schedule failed.')); }
    }
    setBusy(false);
  }
  async function makeDefault(h: HomeScreen) {
    await api(`/admin/home-screens/${h.id}/default`, { method: 'POST' }).catch((e) => setError(friendlyError(e, 'Could not set default.')));
    load();
  }
  async function remove(h: HomeScreen) {
    if (!(await confirmDelete(`Delete layout “${h.name}”?`))) return;
    await api(`/admin/home-screens/${h.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>Design the mobile home screen. Keep several layouts; the default (published) one is what guests see.</p>
        <button className="primary" onClick={openNew}>+ New layout</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Layout</th><th>Status</th><th>Default</th><th>Scheduled for</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No layouts yet — create one to start designing.</td></tr>}
          {list.map((h) => {
            const sb = statusBadge[h.status] ?? statusBadge.draft;
            return (
              <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(h)}>
                <td><b>{h.name}</b></td>
                <td><span className="pillbadge" style={{ background: sb.bg, color: sb.fg }}>{sb.label}</span></td>
                <td>{h.isDefault ? <span className="tag-on">Default</span> : '—'}</td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{h.status === 'scheduled' && h.publishAt ? new Date(h.publishAt).toLocaleString('en-GB') : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  {!h.isDefault && <><button className="tbtn" onClick={() => makeDefault(h)}>Set default</button>{' '}</>}
                  <button className="tbtn" onClick={() => openEdit(h)}>Edit</button>{' '}
                  <button className="tbtn danger" onClick={() => remove(h)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 900, maxWidth: '96vw' }}>
            <h2>{form.id ? 'Edit layout' : 'New layout'}</h2>
            <div className="split-300">
              {/* Editor */}
              <div>
                <div className="form-grid">
                  <div className="form-row full"><label>Layout name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </div>

                <div className="fsec">
                  <span className="fsec-title">Hero media</span>
                  <div className="form-grid">
                    <div className="form-row"><label>Type</label>
                      <select value={form.heroType} onChange={(e) => setForm({ ...form, heroType: e.target.value })}>
                        <option value="none">Built-in illustration</option>
                        <option value="image">Image</option>
                        <option value="gif">GIF</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                    {form.heroType === 'video' && (
                      <div className="form-row"><label>Video URL</label><input value={form.heroMediaUrl} onChange={(e) => setForm({ ...form, heroMediaUrl: e.target.value })} placeholder="https://…/hero.mp4" /></div>
                    )}
                  </div>
                  {(form.heroType === 'image' || form.heroType === 'gif') && (
                    <div style={{ marginTop: 12 }}>
                      <ImageField value={form.heroMediaUrl} onChange={(u) => setForm({ ...form, heroMediaUrl: u })} onError={setError}
                        accept={form.heroType === 'gif' ? 'image/gif' : 'image/*'} maxMb={MAX_MB} width={160} height={96}
                        read={form.heroType === 'gif' ? readAsDataUrl : (f) => resizeToJpeg(f, 1600)}
                        hint={`Up to ${MAX_MB} MB. ${form.heroType === 'gif' ? 'Kept animated.' : 'Large photos are resized.'}`} />
                    </div>
                  )}
                </div>

                <div className="fsec">
                  <span className="fsec-title">Text</span>
                  <div className="form-grid">
                    <div className="form-row full"><label>Hero tagline</label><textarea value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} rows={2} /></div>
                    <div className="form-row"><label>Greeting</label><input value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Welcome" /></div>
                    <div className="form-row"><label>Greeting subtitle</label><input value={form.greetingSub} onChange={(e) => setForm({ ...form, greetingSub: e.target.value })} placeholder="(blank = show opening hours)" /></div>
                  </div>
                </div>

                <div className="fsec">
                  <span className="fsec-title">Colours</span>
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label className="checkline">Primary <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} /></label>
                    <label className="checkline">Accent <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></label>
                    <button type="button" className="tbtn" onClick={() => setForm({ ...form, primaryColor: BRAND_NAVY, accentColor: BRAND_RED })}>Use the park’s navy &amp; red</button>
                  </div>
                </div>

                <div className="fsec">
                  <span className="fsec-title">Sections: reorder and switch on or off</span>
                  <div className="seclist">
                    {form.sections.map((s, i) => (
                      <div key={s.key} className={`secitem ${s.visible ? '' : 'off'}`}>
                        <div className="secmove">
                          <button type="button" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="Move up">▲</button>
                          <button type="button" disabled={i === form.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="Move down">▼</button>
                        </div>
                        <span className="secname">{SECTION_LABELS[s.key] ?? s.key}</span>
                        <label className="checkline" style={{ fontSize: 12 }}><input type="checkbox" checked={s.visible} onChange={() => toggleSection(i)} /> Visible</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="previewcol">
                <label style={{ fontWeight: 600, fontSize: 13 }}>Preview</label>
                <Preview form={form} />
                <p className="hint">A rough guide. Guests see their real shows, weather and tickets in each section.</p>
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="modal-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 'auto' }}>
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <button className="btn-ghost" onClick={schedule} disabled={busy}>Schedule</button>
              </div>
              <button className="btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-ghost" onClick={save} disabled={busy}>Save draft</button>
              <button className="primary" onClick={publishNow} disabled={busy}>{busy ? 'Working…' : 'Publish now'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({ form }: { form: Form }) {
  const sec = (label: string) => (
    <div style={{ background: '#fff', border: '1px solid #eceae6', borderLeft: `3px solid ${form.accentColor}`, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#333' }}>{label}</div>
  );
  const hasPicture = !!form.heroMediaUrl && (form.heroType === 'image' || form.heroType === 'gif');
  return (
    <div className="phoneframe" style={{ marginTop: 8, width: 260 }}>
      <div style={{ height: 160, background: hasPicture ? `center/cover no-repeat url(${form.heroMediaUrl})` : `linear-gradient(160deg, ${form.primaryColor}, #0e1830)`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 12 }}>
        {form.heroType === 'video' && <span style={{ position: 'absolute', top: 8, left: 10, color: '#fff', fontSize: 10, opacity: 0.85 }}>▶ video{form.heroMediaUrl ? '' : ' (add a URL)'}</span>}
        {form.greeting && <span style={{ color: '#fff', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.85, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{form.greeting}{form.greetingSub ? ` · ${form.greetingSub}` : ''}</span>}
        <b style={{ color: '#fff', fontSize: 16, lineHeight: 1.12, whiteSpace: 'pre-line', textShadow: '0 1px 4px rgba(0,0,0,.55)' }}>{form.tagline}</b>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ background: form.accentColor, color: '#fff', borderRadius: 999, textAlign: 'center', padding: '7px 0', fontSize: 12, fontWeight: 700 }}>Buy tickets</div>
        {form.sections.filter((s) => s.visible).map((s) => (
          <div key={s.key}>{sec(SECTION_LABELS[s.key] ?? s.key)}</div>
        ))}
      </div>
    </div>
  );
}
