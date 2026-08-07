'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, friendlyError } from '../../../lib/api';
import { confirmDelete } from '../../../lib/confirm';

interface Announcement {
  id: string; title: string; body: string; audience: string; deepLink: string | null;
  scheduledAt: string | null; sentAt: string | null; startAt: string | null; endAt: string | null;
  recurrence: string; createdAt: string;
}

const EMPTY = { title: '', body: '', audience: 'ALL', deepLink: '', scheduleMode: 'now' as 'now' | 'custom', scheduledAt: '', startAt: '', endAt: '', recurrence: 'none' };
type Form = typeof EMPTY & { id?: string };

const toLocal = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function statusOf(a: Announcement, nextUpId: string | null): { label: string; cls: string } {
  const now = Date.now();
  if (a.sentAt) {
    if (a.endAt && new Date(a.endAt).getTime() < now) return { label: 'Expired', cls: 'off' };
    return { label: 'Published', cls: 'on' };
  }
  if (a.scheduledAt && new Date(a.scheduledAt).getTime() > now) return a.id === nextUpId ? { label: 'Next up', cls: 'next' } : { label: 'Scheduled', cls: 'sched' };
  return { label: 'Pending', cls: 'pending' };
}
const badgeStyle: Record<string, React.CSSProperties> = {
  on: { background: '#e7f8ee', color: 'var(--green)' },
  sched: { background: '#efeafd', color: 'var(--full)' },
  next: { background: 'var(--brand)', color: '#fff' },
  pending: { background: '#fbf1dd', color: 'var(--warn)' },
  off: { background: 'var(--line)', color: 'var(--muted)' },
};

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api<Announcement[]>('/announcements/manage').then(setList).catch((e) => setError(friendlyError(e, 'Could not load announcements.'))); }, []);
  useEffect(load, [load]);

  const nextUpId = useMemo(() => {
    const now = Date.now();
    const upcoming = list.filter((a) => !a.sentAt && a.scheduledAt && new Date(a.scheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    return upcoming[0]?.id ?? null;
  }, [list]);

  function openNew() {
    const inOneHour = toLocal(new Date(Date.now() + 3600000).toISOString());
    setForm({ ...EMPTY, scheduledAt: inOneHour }); setError('');
  }
  function openEdit(a: Announcement) {
    setForm({
      id: a.id, title: a.title, body: a.body, audience: a.audience, deepLink: a.deepLink ?? '',
      scheduleMode: a.scheduledAt ? 'custom' : 'now', scheduledAt: toLocal(a.scheduledAt),
      startAt: toLocal(a.startAt), endAt: toLocal(a.endAt), recurrence: a.recurrence,
    });
    setError('');
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim() || !form.body.trim()) { setError('Title and message are required.'); return; }
    const payload = {
      title: form.title, body: form.body, audience: form.audience, deepLink: form.deepLink || null,
      scheduledAt: form.scheduleMode === 'custom' ? fromLocal(form.scheduledAt) : null,
      startAt: fromLocal(form.startAt), endAt: fromLocal(form.endAt), recurrence: form.recurrence,
    };
    try {
      if (form.id) await api(`/announcements/manage/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/announcements/manage', { method: 'POST', body: JSON.stringify(payload) });
      setForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
  }
  async function remove(a: Announcement) {
    if (!(await confirmDelete(`Delete announcement “${a.title}”?`))) return;
    await api(`/announcements/manage/${a.id}`, { method: 'DELETE' }).catch(() => undefined);
    setForm(null); load();
  }
  async function resend(a: Announcement) {
    if (!(await confirmDelete(`Resend “${a.title}” to all guests now?`, 'Resend now?', { confirmLabel: 'Resend', danger: false }))) return;
    await api(`/announcements/manage/${a.id}/resend`, { method: 'POST' }).catch(() => undefined);
    setForm(null); load();
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div><h1>Announcements</h1><p className="subtitle" style={{ margin: 0 }}>Publish live messages — send now or schedule, with an active window and recurrence.</p></div>
        <button className="primary" onClick={openNew}>+ New announcement</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Title</th><th>Status</th><th>Active window</th><th>Repeats</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No announcements yet.</td></tr>}
          {list.map((a) => {
            const st = statusOf(a, nextUpId);
            return (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(a)}>
                <td><b>{a.title}</b><div style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.body}</div></td>
                <td><span className="pillbadge" style={{ ...badgeStyle[st.cls] }}>{st.label}</span>{a.scheduledAt && !a.sentAt && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{fmt(a.scheduledAt)}</div>}</td>
                <td style={{ fontSize: 13, color: 'var(--muted)' }}>{a.startAt || a.endAt ? `${fmt(a.startAt)} → ${fmt(a.endAt)}` : '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{a.recurrence === 'none' ? '—' : a.recurrence}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <button className="tbtn" onClick={() => resend(a)}>Resend</button>{' '}
                  <button className="tbtn" onClick={() => openEdit(a)}>Edit</button>{' '}
                  <button className="tbtn danger" onClick={() => remove(a)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 560 }}>
            <h2>{form.id ? 'Edit announcement' : 'New announcement'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Legend of the Wear moved to 5pm" /></div>
              <div className="form-row full"><label>Message *</label><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <div className="form-row"><label>Audience</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  <option value="ALL">All guests</option><option value="TICKET_HOLDERS">Ticket holders</option>
                </select>
              </div>
              <div className="form-row"><label>Deep link (optional)</label><input value={form.deepLink} onChange={(e) => setForm({ ...form, deepLink: e.target.value })} placeholder="kynren://…" /></div>

              <div className="form-row full"><label>Send</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label className="checkline"><input type="radio" checked={form.scheduleMode === 'now'} onChange={() => setForm({ ...form, scheduleMode: 'now' })} /> Now</label>
                  <label className="checkline"><input type="radio" checked={form.scheduleMode === 'custom'} onChange={() => setForm({ ...form, scheduleMode: 'custom' })} /> Schedule for…</label>
                </div>
              </div>
              {form.scheduleMode === 'custom' && (
                <div className="form-row full"><label>Send at</label><input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              )}

              <div className="form-row"><label>Active from (optional)</label><input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
              <div className="form-row"><label>Active to (optional)</label><input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></div>
              <div className="form-row"><label>Repeats</label>
                <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                  <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <p className="hint">The active window controls when the in-app megaphone shows to guests. “Now” sends the push immediately.</p>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              {form.id && <button className="btn-ghost" style={{ marginRight: 'auto' }} onClick={() => resend({ id: form.id!, title: form.title } as Announcement)}>Resend now</button>}
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save' : form.scheduleMode === 'now' ? 'Publish now' : 'Schedule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
