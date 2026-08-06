'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { ROLES } from '../../../../lib/perms';
import { confirmDelete, promptText } from '../../../../lib/confirm';

interface StaffMember {
  id: string; name: string; email: string; role: string; active: boolean; createdAt: string;
}
const EMPTY = { name: '', email: '', role: 'OPS', password: '', active: true };
type Form = typeof EMPTY & { id?: string };

const roleBadge: Record<string, React.CSSProperties> = {
  ADMIN: { background: 'var(--brand)', color: '#fff' },
  OPS: { background: '#e7f8ee', color: 'var(--green)' },
  FNB: { background: '#fbf1dd', color: 'var(--warn)' },
  CONTENT: { background: '#efeafd', color: 'var(--full)' },
};

export default function StaffPage() {
  const [list, setList] = useState<StaffMember[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    api<StaffMember[]>('/admin/staff').then(setList).catch(() => setError('Could not load staff. You need the “System administration” permission.'));
    setSelected(new Set());
  }, []);
  useEffect(load, [load]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => (s.size === list.length ? new Set() : new Set(list.map((x) => x.id))));
  }
  async function bulkRemove() {
    if (selected.size === 0) return;
    if (!(await confirmDelete(`Delete ${selected.size} staff account${selected.size > 1 ? 's' : ''}? This cannot be undone.`))) return;
    try { await api('/admin/staff/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...selected] }) }); load(); }
    catch (e) { setError((e as Error).message || 'Bulk delete failed.'); }
  }

  function openNew() { setForm({ ...EMPTY }); setFormError(''); }
  function openEdit(s: StaffMember) { setForm({ id: s.id, name: s.name, email: s.email, role: s.role, password: '', active: s.active }); setFormError(''); }

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) { setFormError('Name and email are required.'); return; }
    if (!form.id && form.password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
    try {
      if (form.id) {
        await api(`/admin/staff/${form.id}`, { method: 'PATCH', body: JSON.stringify({ name: form.name, email: form.email, role: form.role, active: form.active }) });
      } else {
        await api('/admin/staff', { method: 'POST', body: JSON.stringify({ name: form.name, email: form.email, role: form.role, password: form.password, active: form.active }) });
      }
      setForm(null); load();
    } catch (e) { setFormError((e as Error).message || 'Save failed.'); }
  }

  async function resetPassword(s: StaffMember) {
    const pw = await promptText(`New password for ${s.name} (min 8 characters):`, '', 'Reset password');
    if (pw == null) return;
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    await api(`/admin/staff/${s.id}/password`, { method: 'POST', body: JSON.stringify({ password: pw }) }).catch((e) => setError((e as Error).message));
  }

  async function remove(s: StaffMember) {
    if (!(await confirmDelete(`Delete staff account “${s.name}” (${s.email})?`))) return;
    try { await api(`/admin/staff/${s.id}`, { method: 'DELETE' }); setForm(null); load(); }
    catch (e) { setError((e as Error).message || 'Delete failed.'); }
  }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div><h1 style={{ margin: 0 }}>Staff accounts</h1><p className="subtitle" style={{ margin: 0 }}>Create staff, change their email, assign a role, or reset a password.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && <button className="tbtn danger" onClick={bulkRemove}>Delete selected ({selected.size})</button>}
          <button className="primary" onClick={openNew}>+ New staff</button>
        </div>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr>
          <th style={{ width: 32 }}><input type="checkbox" checked={list.length > 0 && selected.size === list.length} onChange={toggleAll} aria-label="Select all" /></th>
          <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No staff yet.</td></tr>}
          {list.map((s) => (
            <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(s)}>
              <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} /></td>
              <td><b>{s.name}</b></td>
              <td>{s.email}</td>
              <td><span className="pillbadge" style={roleBadge[s.role]}>{s.role}</span></td>
              <td>{s.active ? <span className="pillbadge on">Active</span> : <span className="pillbadge off">Disabled</span>}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                <button className="tbtn" onClick={() => openEdit(s)}>Edit</button>{' '}
                <button className="tbtn" onClick={() => resetPassword(s)}>Reset password</button>{' '}
                <button className="tbtn danger" onClick={() => remove(s)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 480 }}>
            <h2>{form.id ? 'Edit staff' : 'New staff'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row full"><label>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@kynren.com" /></div>
              <div className="form-row"><label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Status</label>
                <select value={form.active ? 'active' : 'disabled'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
                  <option value="active">Active</option><option value="disabled">Disabled</option>
                </select>
              </div>
              {!form.id && (
                <div className="form-row full"><label>Temporary password *</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 characters" /></div>
              )}
            </div>
            {form.id && <p className="hint">Use “Reset password” on the row to set a new password.</p>}
            {formError && <div className="error">{formError}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save}>{form.id ? 'Save' : 'Create staff'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
