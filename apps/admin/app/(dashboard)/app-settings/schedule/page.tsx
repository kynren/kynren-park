'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';

interface Attraction { id: string; name: string; category: string; sortOrder?: number }
interface Weekly {
  id: string; dayOfWeek: number; start: string; end: string; status: string;
  attraction: { id: string; name: string; category: string };
}

// Ordered Monday-first for the UI; value is JS getDay() (0 = Sunday).
const WEEKDAYS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
const dayName = (n: number) => WEEKDAYS.find(([d]) => d === n)?.[1] ?? '';
const EMPTY = { attractionId: '', start: '11:00', end: '11:30', status: 'SCHEDULED' };
type Form = typeof EMPTY & { id?: string; days: number[] };

export default function ScheduleAdmin() {
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [dow, setDow] = useState<number>(() => new Date().getDay());
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api<Weekly[]>('/admin/weekly-sessions').then(setWeekly).catch(() => setError('Could not load the schedule.')); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<Attraction[]>('/admin/attractions').then(setAttractions).catch(() => undefined); }, []);

  const dayRows = useMemo(
    () => weekly.filter((w) => w.dayOfWeek === dow).sort((a, b) => a.start.localeCompare(b.start)),
    [weekly, dow],
  );

  function openNew() { setForm({ ...EMPTY, attractionId: attractions[0]?.id ?? '', days: [dow] }); setError(''); }
  function openEdit(w: Weekly) { setForm({ id: w.id, attractionId: w.attraction.id, start: w.start, end: w.end, status: w.status, days: [w.dayOfWeek] }); setError(''); }
  const toggleDay = (n: number) => setForm((f) => (f ? { ...f, days: f.days.includes(n) ? f.days.filter((x) => x !== n) : [...f.days, n] } : f));

  async function save() {
    if (!form) return;
    if (!form.attractionId) { setError('Pick a show.'); return; }
    if (!form.id && form.days.length === 0) { setError('Pick at least one day of the week.'); return; }
    try {
      if (form.id) {
        await api(`/admin/weekly-sessions/${form.id}`, { method: 'PATCH', body: JSON.stringify({ start: form.start, end: form.end, status: form.status }) });
      } else {
        await api('/admin/weekly-sessions', { method: 'POST', body: JSON.stringify({ attractionId: form.attractionId, days: form.days, start: form.start, end: form.end, status: form.status }) });
      }
      setForm(null); load();
    } catch { setError('Save failed — check the times (HH:MM).'); }
  }

  async function remove(w: Weekly) {
    if (!(await confirmDelete(`Delete the ${w.start} ${w.attraction.name} session on ${dayName(w.dayOfWeek)}?`))) return;
    await api(`/admin/weekly-sessions/${w.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1>Program Schedule</h1>
          <p className="subtitle" style={{ margin: 0 }}>The weekly programme — set which shows run on each day of the week. The same pattern repeats every week.</p>
        </div>
        <button className="primary" onClick={openNew}>+ Add session</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      {/* Day-of-week selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 16px' }}>
        {WEEKDAYS.map(([n, lbl]) => {
          const count = weekly.filter((w) => w.dayOfWeek === n).length;
          return (
            <button key={n} className={`systab ${dow === n ? 'active' : ''}`} onClick={() => setDow(n)}>
              {lbl}{count > 0 && <span style={{ opacity: 0.7 }}> · {count}</span>}
            </button>
          );
        })}
      </div>

      <table className="dtable">
        <thead><tr><th>Show</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {dayRows.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No sessions on {dayName(dow)} yet.</td></tr>}
          {dayRows.map((w) => (
            <tr key={w.id}>
              <td><b>{w.attraction.name}</b></td>
              <td>{w.start}</td>
              <td>{w.end}</td>
              <td><span className={`pill-status ${w.status}`}>{w.status[0] + w.status.slice(1).toLowerCase()}</span></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(w)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(w)}>Delete</button>
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
              {!form.id && (
                <div className="form-row full"><label>Days of the week</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {WEEKDAYS.map(([n, lbl]) => (
                      <button key={n} type="button" onClick={() => toggleDay(n)} className={`systab ${form.days.includes(n) ? 'active' : ''}`} style={{ padding: '7px 12px' }}>{lbl.slice(0, 3)}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-row"><label>Start (HH:MM)</label><input value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} placeholder="11:00" /></div>
              <div className="form-row"><label>End (HH:MM)</label><input value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} placeholder="11:30" /></div>
              <div className="form-row full"><label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['SCHEDULED', 'DELAYED', 'FULL', 'CANCELLED', 'FINISHED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            </div>
            <p className="hint">Times are park time (UTC). Pick one or more days — the show runs at these times every week on those days.</p>
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
