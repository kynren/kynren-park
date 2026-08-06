'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';

interface Attraction { id: string; name: string; category: string; sortOrder?: number }
interface Session {
  id: string; startTime: string; endTime: string; status: string; revisedStart: string | null;
  attraction: { id: string; name: string; category: string };
}

const OPENING_DAY = '2026-07-18';
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const minsUTC = (iso: string) => new Date(iso).getUTCHours() * 60 + new Date(iso).getUTCMinutes();

const EMPTY = { attractionId: '', start: '11:00', end: '11:30', status: 'SCHEDULED' };
type Form = typeof EMPTY & { id?: string };
const WEEKDAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export default function ScheduleAdmin() {
  const [date, setDate] = useState(OPENING_DAY);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [until, setUntil] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);

  const load = useCallback((d: string) => {
    api<Session[]>(`/schedule?date=${d}`).then(setSessions).catch(() => setError('Could not load schedule.'));
  }, []);
  useEffect(() => load(date), [date, load]);
  useEffect(() => { api<Attraction[]>('/admin/attractions').then(setAttractions).catch(() => undefined); }, []);

  // Ruler window (daytime spread, evening clamps right — like the app).
  const ruler = useMemo(() => {
    const day = sessions.filter((s) => s.attraction.category !== 'EVENING_SHOW');
    const basis = day.length ? day : sessions;
    if (!basis.length) return { start: 600, end: 1080, hours: [10, 12, 14, 16, 18] };
    let lo = Infinity, hi = -Infinity;
    for (const s of basis) { lo = Math.min(lo, minsUTC(s.startTime)); hi = Math.max(hi, minsUTC(s.endTime)); }
    const start = Math.floor(lo / 60) * 60, end = Math.max(start + 120, Math.ceil(hi / 60) * 60);
    const hours: number[] = [];
    for (let h = start; h <= end; h += 120) hours.push(h / 60);
    return { start, end, hours };
  }, [sessions]);
  const pos = (mins: number) => Math.max(0, Math.min(100, ((mins - ruler.start) / (ruler.end - ruler.start)) * 100));

  const byAttraction = useMemo(() => {
    const m = new Map<string, { name: string; category: string; sessions: Session[] }>();
    for (const s of sessions) {
      const e = m.get(s.attraction.id) ?? { name: s.attraction.name, category: s.attraction.category, sessions: [] };
      e.sessions.push(s); m.set(s.attraction.id, e);
    }
    return [...m.values()];
  }, [sessions]);

  function openNew() {
    setForm({ ...EMPTY, attractionId: attractions[0]?.id ?? '' });
    setRepeat(false); setUntil(addDays(date, 7)); setDays([1, 2, 3, 4, 5, 6, 0]); setError('');
  }
  function openEdit(s: Session) {
    setForm({ id: s.id, attractionId: s.attraction.id, start: fmt(s.startTime), end: fmt(s.endTime), status: s.status });
    setRepeat(false); setError('');
  }
  const toggleDay = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));

  async function save() {
    if (!form) return;
    if (!form.attractionId) { setError('Pick a show.'); return; }
    try {
      if (form.id) {
        await api(`/admin/sessions/${form.id}`, { method: 'PATCH', body: JSON.stringify({ start: form.start, end: form.end, status: form.status }) });
      } else if (repeat) {
        if (!until) { setError('Choose an end date for the repeat.'); return; }
        if (days.length === 0) { setError('Select at least one day.'); return; }
        await api('/admin/sessions/recurring', { method: 'POST', body: JSON.stringify({ attractionId: form.attractionId, startDate: date, endDate: until, days, start: form.start, end: form.end, status: form.status }) });
      } else {
        await api('/admin/sessions', { method: 'POST', body: JSON.stringify({ attractionId: form.attractionId, date, start: form.start, end: form.end, status: form.status }) });
      }
      setForm(null); load(date);
    } catch { setError('Save failed — check the times and range.'); }
  }

  async function remove(s: Session) {
    if (!(await confirmDelete(`Delete the ${fmt(s.startTime)} ${s.attraction.name} session?`))) return;
    await api(`/admin/sessions/${s.id}`, { method: 'DELETE' }).catch(() => undefined);
    load(date);
  }

  return (
    <div>
      <div className="crumb"><Link href="/app-settings">App Settings</Link> › Program Schedule</div>
      <div className="page-actions">
        <div>
          <h1>Program Schedule</h1>
          <p className="subtitle" style={{ margin: 0 }}>Shown to guests in the mobile timetable format.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="primary" onClick={openNew}>+ Add session</button>
        </div>
      </div>
      {error && !form && <div className="error">{error}</div>}

      {/* Mobile-style timetable */}
      <div className="tt">
        <div className="tt-ruler" style={{ marginLeft: 190 }}>
          {ruler.hours.map((h) => <span key={h}>{h}:00</span>)}
        </div>
        {byAttraction.length === 0 && <div className="empty-chart" style={{ padding: 8 }}>No sessions scheduled for {date}.</div>}
        {byAttraction.map((a) => (
          <div className="tt-row" key={a.name}>
            <div className="tt-name">{a.name}<small>{a.category.toLowerCase().replace('_', ' ')}</small></div>
            <div className="tt-track">
              {a.sessions.map((s) => (
                <div key={s.id} className={`tt-pill ${s.status}`} style={{ left: `${pos(minsUTC(s.revisedStart ?? s.startTime))}%` }}
                  title="Click to edit" onClick={() => openEdit(s)}>
                  {fmt(s.revisedStart ?? s.startTime)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Editable list */}
      <table className="dtable">
        <thead><tr><th>Show</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {sessions.slice().sort((x, y) => minsUTC(x.startTime) - minsUTC(y.startTime)).map((s) => (
            <tr key={s.id}>
              <td><b>{s.attraction.name}</b></td>
              <td>{fmt(s.revisedStart ?? s.startTime)}</td>
              <td>{fmt(s.endTime)}</td>
              <td><span className={`pill-status ${s.status}`}>{s.status[0] + s.status.slice(1).toLowerCase()}</span></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(s)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(s)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2>{form.id ? 'Edit session' : 'Add session'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Show</label>
                <select value={form.attractionId} disabled={!!form.id} onChange={(e) => setForm({ ...form, attractionId: e.target.value })}>
                  {attractions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Start (HH:MM)</label><input value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} placeholder="11:00" /></div>
              <div className="form-row"><label>End (HH:MM)</label><input value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} placeholder="11:30" /></div>
              <div className="form-row full"><label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['SCHEDULED', 'DELAYED', 'FULL', 'CANCELLED', 'FINISHED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            </div>

            {!form.id && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <label className="checkline" style={{ fontWeight: 600 }}>
                  <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Repeat this session
                </label>
                {repeat && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                    <div className="form-row"><label>Repeat until</label><input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} /></div>
                    <div className="form-row">
                      <label>On days</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {WEEKDAYS.map(([n, lbl]) => (
                          <button key={n} type="button" onClick={() => toggleDay(n)}
                            className={`systab ${days.includes(n) ? 'active' : ''}`} style={{ padding: '7px 12px' }}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>Creates one session per selected weekday from {date} to {until || '…'}.</p>
                  </div>
                )}
              </div>
            )}

            <p className="hint">Start date: {date}. Times are park time (UTC).</p>
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
