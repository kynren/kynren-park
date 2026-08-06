'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';

interface Template {
  id: string; name: string; action: string; title: string; body: string;
  deepLink: string | null; sound: boolean; active: boolean;
}
const ACTIONS = ['SHOW_REMINDER', 'ORDER_READY', 'DELAY_ALERT', 'ANNOUNCEMENT', 'WELCOME', 'CUSTOM'];
const ACTION_LABEL: Record<string, string> = {
  SHOW_REMINDER: 'Show reminder', ORDER_READY: 'Order ready', DELAY_ALERT: 'Delay alert',
  ANNOUNCEMENT: 'Announcement', WELCOME: 'Welcome', CUSTOM: 'Custom',
};
const EMPTY = { name: '', action: 'SHOW_REMINDER', title: '', body: '', deepLink: '', sound: true, active: true };
type Form = typeof EMPTY & { id?: string };

export default function PushTemplates() {
  const [rows, setRows] = useState<Template[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api<Template[]>('/admin/notification-templates').then(setRows).catch(() => setError('Could not load templates.')); }, []);
  useEffect(load, [load]);

  function openNew() { setForm({ ...EMPTY }); setError(''); }
  function openEdit(t: Template) { setForm({ id: t.id, name: t.name, action: t.action, title: t.title, body: t.body, deepLink: t.deepLink ?? '', sound: t.sound, active: t.active }); setError(''); }

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.title.trim() || !form.body.trim()) { setError('Name, title and body are required.'); return; }
    const body = { ...form, deepLink: form.deepLink || null };
    try {
      if (form.id) await api(`/admin/notification-templates/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/notification-templates', { method: 'POST', body: JSON.stringify(body) });
      setForm(null); load();
    } catch { setError('Save failed.'); }
  }
  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await api(`/admin/notification-templates/${t.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Push Templates</div>
      <div className="page-actions">
        <div><h1>Push Templates</h1><p className="subtitle" style={{ margin: 0 }}>Create notification templates and assign them to app actions.</p></div>
        <button className="primary" onClick={openNew}>+ New template</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Name</th><th>Action</th><th>Title</th><th>Sound</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No templates yet.</td></tr>}
          {rows.map((t) => (
            <tr key={t.id} className={t.active ? '' : 'rowdim'}>
              <td><b>{t.name}</b></td>
              <td><span className="pillbadge park">{ACTION_LABEL[t.action] ?? t.action}</span></td>
              <td>{t.title}</td>
              <td>{t.sound ? 'On' : 'Off'}</td>
              <td>{t.active ? <span className="tag-on">Active</span> : <span className="tag-off">Off</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(t)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(t)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2>{form.id ? 'Edit template' : 'New template'}</h2>
            <div className="form-grid">
              <div className="form-row"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Assigned action</label>
                <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                </select>
              </div>
              <div className="form-row full"><label>Notification title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Vikings starts soon!" /></div>
              <div className="form-row full"><label>Body *</label><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Land of the Vikings starts in 20 minutes — 5 min walk away." /></div>
              <div className="form-row full">
                <p className="hint" style={{ margin: 0 }}>
                  Variables: {form.action === 'DELAY_ALERT' && <code>{'{show} {time} {status} {note}'}</code>}
                  {form.action === 'ORDER_READY' && <code>{'{restaurant}'}</code>}
                  {form.action === 'SHOW_REMINDER' && <code>{'{show} {time}'}</code>}
                  {(form.action === 'ANNOUNCEMENT' || form.action === 'WELCOME' || form.action === 'CUSTOM') && '— none for this action yet'}
                  . Active templates are used automatically when that action fires (delay/cancel alerts and order-ready are live now).
                </p>
              </div>
              <div className="form-row full"><label>Deep link (optional)</label><input value={form.deepLink} onChange={(e) => setForm({ ...form, deepLink: e.target.value })} placeholder="kynren://attraction/land-of-the-vikings" /></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={form.sound} onChange={(e) => setForm({ ...form, sound: e.target.checked })} /> Play sound</label></div>
              <div className="form-row"><label className="checkline"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label></div>
            </div>
            {/* Live preview */}
            <div style={{ background: 'var(--app-bg)', borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Preview</div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{form.title || 'Notification title'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{form.body || 'Notification body preview…'}</div>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
