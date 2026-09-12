'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string | null;
  sortOrder: number;
  published: boolean;
}

const CATEGORIES = ['faq', 'info', 'safety', 'accessibility'];
const EMPTY = { title: '', body: '', category: 'info', sortOrder: '0', published: true };
type Form = typeof EMPTY & { id?: string };

export default function ContentPages() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<ContentPage[]>('/admin/content-pages').then(setPages).catch(() => setError('Could not load content pages.'));
  }, []);
  useEffect(load, [load]);

  function openNew() { setForm({ ...EMPTY }); setError(''); }
  function openEdit(p: ContentPage) {
    setForm({ id: p.id, title: p.title, body: p.body, category: p.category ?? 'info', sortOrder: String(p.sortOrder), published: p.published });
    setError('');
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    const body = { title: form.title, body: form.body, category: form.category, sortOrder: Number(form.sortOrder) || 0, published: form.published };
    try {
      if (form.id) await api(`/admin/content-pages/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/content-pages', { method: 'POST', body: JSON.stringify(body) });
      setForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
    setSaving(false);
  }

  async function remove(p: ContentPage) {
    if (!(await confirmDelete(`Remove “${p.title}”?`))) return;
    await api(`/admin/content-pages/${p.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions">
        <div><h1>Content Pages</h1><p className="subtitle" style={{ margin: 0 }}>FAQ, info, safety and accessibility pages shown in the app’s help section.</p></div>
        <button className="primary" onClick={openNew}>+ Add page</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <table className="dtable">
        <thead><tr><th>Title</th><th>Slug</th><th>Category</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {pages.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No content pages yet.</td></tr>}
          {pages.map((p) => (
            <tr key={p.id}>
              <td><b>{p.title}</b></td>
              <td style={{ color: 'var(--muted)' }}>{p.slug}</td>
              <td>{p.category ?? '—'}</td>
              <td><span className={`pillbadge ${p.published ? 'on' : 'off'}`}>{p.published ? 'Published' : 'Draft'}</span></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="tbtn" onClick={() => openEdit(p)}>Edit</button>{' '}
                <button className="tbtn danger" onClick={() => remove(p)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ width: 640 }}>
            <h2>{form.id ? 'Edit page' : 'Add page'}</h2>
            <div className="form-grid">
              <div className="form-row"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="form-row"><label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Sort order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
              <div className="form-row"><label>Published</label>
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              </div>
              <div className="form-row full"><label>Body (Markdown)</label><textarea rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
