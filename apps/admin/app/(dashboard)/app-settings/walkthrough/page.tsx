'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';
import { usePaged, Pager } from '../../../../components/Pager';

interface Step {
  id: string; order: number; screen: string; position: string;
  title: string; body: string; active: boolean;
}

const SCREENS: { value: string; label: string }[] = [
  { value: 'index', label: 'Home' },
  { value: 'map', label: 'Plan / Map' },
  { value: 'tickets', label: 'Book' },
  { value: 'shows', label: 'Programme' },
  { value: 'food', label: 'Meal' },
];
const screenLabel = (v: string) => SCREENS.find((s) => s.value === v)?.label ?? v;
const POSITIONS = ['top', 'center', 'bottom'] as const;

const EMPTY = { screen: 'index', position: 'bottom', order: 0, title: '', body: '', active: true };
type Form = typeof EMPTY & { id?: string };

export default function WalkthroughPage() {
  const [rows, setRows] = useState<Step[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const { page, setPage, totalPages, pageRows, total, start, end } = usePaged(rows, 10);

  const load = useCallback(() => {
    api<Step[]>('/admin/walkthrough-steps').then(setRows).catch((e) => setError(friendlyError(e, 'Could not load the walkthrough.')));
    api<{ enabled: boolean }>('/admin/walkthrough-config').then((c) => setEnabled(c.enabled)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setTogglingEnabled(true);
    try { await api('/admin/walkthrough-config', { method: 'PATCH', body: JSON.stringify({ enabled: next }) }); }
    catch (e) { setEnabled(!next); setError(friendlyError(e, 'Could not change the walkthrough switch.')); }
    finally { setTogglingEnabled(false); }
  }

  function openNew() {
    // Default the order to appear after whatever's already on this screen.
    const nextOrder = Math.max(0, ...rows.filter((r) => r.screen === EMPTY.screen).map((r) => r.order + 1));
    setForm({ ...EMPTY, order: nextOrder });
    setError('');
  }
  function openEdit(s: Step) {
    setForm({ id: s.id, screen: s.screen, position: s.position, order: s.order, title: s.title, body: s.body, active: s.active });
    setError('');
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim() || !form.body.trim()) { setError('Title and text are required.'); return; }
    const payload = { screen: form.screen, position: form.position, order: form.order, title: form.title, body: form.body, active: form.active };
    try {
      if (form.id) await api(`/admin/walkthrough-steps/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/admin/walkthrough-steps', { method: 'POST', body: JSON.stringify(payload) });
      setForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
  }
  async function remove(s: Step) {
    if (!(await confirmDelete(`Delete the walkthrough step “${s.title}”?`))) return;
    await api(`/admin/walkthrough-steps/${s.id}`, { method: 'DELETE' }).catch(() => undefined);
    setForm(null); load();
  }
  async function toggleActive(s: Step) {
    await api(`/admin/walkthrough-steps/${s.id}`, { method: 'PATCH', body: JSON.stringify({ active: !s.active }) }).catch(() => undefined);
    load();
  }
  async function duplicate(s: Step) {
    try {
      await api('/admin/walkthrough-steps', {
        method: 'POST',
        body: JSON.stringify({ screen: s.screen, position: s.position, order: s.order + 1, title: `${s.title} (copy)`, body: s.body, active: s.active }),
      });
      load();
    } catch (e) { setError(friendlyError(e, 'Could not duplicate that step.')); }
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div>
          <h1>Walkthrough</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Cards shown to a guest the first time they reach a given tab — write the text and pick where each one appears.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label className="checkline" style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={enabled} disabled={togglingEnabled} onChange={toggleEnabled} /> Show walkthrough to new guests
          </label>
          <button className="primary" onClick={openNew}>+ New step</button>
        </div>
      </div>
      {!enabled && (
        <div className="hint" style={{ background: 'var(--panel,#f0ece6)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          The walkthrough is turned off — no guest will see any step below until you switch it back on, even active ones.
        </div>
      )}
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Screen</th><th>Position</th><th>Order</th><th>Title</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No walkthrough steps yet — new guests won’t see an onboarding tour until you add one.</td></tr>}
          {pageRows.map((s) => (
            <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(s)}>
              <td>{screenLabel(s.screen)}</td>
              <td style={{ textTransform: 'capitalize' }}>{s.position}</td>
              <td>{s.order}</td>
              <td><b>{s.title}</b><div style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.body}</div></td>
              <td onClick={(e) => e.stopPropagation()}>
                <label className="checkline"><input type="checkbox" checked={s.active} onChange={() => toggleActive(s)} /></label>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                <button className="tbtn" onClick={() => openEdit(s)}>Edit</button>{' '}
                <button className="tbtn" onClick={() => duplicate(s)}>Duplicate</button>{' '}
                <button className="tbtn danger" onClick={() => remove(s)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} setPage={setPage} totalPages={totalPages} total={total} start={start} end={end} />

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 520 }}>
            <h2>{form.id ? 'Edit walkthrough step' : 'New walkthrough step'}</h2>
            <div className="form-grid">
              <div className="form-row"><label>Screen</label>
                <select value={form.screen} onChange={(e) => setForm({ ...form, screen: e.target.value })}>
                  {SCREENS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Position on screen</label>
                <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Order</label>
                <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })} />
                <p className="hint" style={{ margin: '4px 0 0' }}>When a screen has more than one step, lower numbers show first.</p>
              </div>
              <div className="form-row full"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Find your way around" /></div>
              <div className="form-row full"><label>Text *</label><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Tap the map to explore attractions, restaurants and facilities." /></div>
              <div className="form-row full"><label className="checkline"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (shown to new guests)</label></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save' : 'Add step'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
