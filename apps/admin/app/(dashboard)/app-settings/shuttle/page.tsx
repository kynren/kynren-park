'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';
import { confirmDelete } from '../../../../lib/confirm';

interface Stop { id: string; name: string; order: number; times: string[]; poiId: string | null }
interface Route { id: string; name: string; description: string | null; active: boolean; sortOrder: number; stops: Stop[] }

const EMPTY_ROUTE = { name: '', description: '', active: true, sortOrder: '0' };
type RouteForm = typeof EMPTY_ROUTE & { id?: string };

const EMPTY_STOP = { name: '', order: '0', times: '' };
type StopForm = typeof EMPTY_STOP & { id?: string; routeId: string };

export default function Shuttle() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeForm, setRouteForm] = useState<RouteForm | null>(null);
  const [stopForm, setStopForm] = useState<StopForm | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Route[]>('/admin/shuttle-routes').then(setRoutes).catch(() => setError('Could not load shuttle routes.'));
  }, []);
  useEffect(load, [load]);

  function openNewRoute() { setRouteForm({ ...EMPTY_ROUTE }); setError(''); }
  function openEditRoute(r: Route) {
    setRouteForm({ id: r.id, name: r.name, description: r.description ?? '', active: r.active, sortOrder: String(r.sortOrder) });
    setError('');
  }

  async function saveRoute() {
    if (!routeForm) return;
    if (!routeForm.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const body = { name: routeForm.name, description: routeForm.description || null, active: routeForm.active, sortOrder: Number(routeForm.sortOrder) || 0 };
    try {
      if (routeForm.id) await api(`/admin/shuttle-routes/${routeForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/shuttle-routes', { method: 'POST', body: JSON.stringify(body) });
      setRouteForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
    setSaving(false);
  }

  async function removeRoute(r: Route) {
    if (!(await confirmDelete(`Remove route “${r.name}” and all its stops?`))) return;
    await api(`/admin/shuttle-routes/${r.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  function openNewStop(routeId: string) { setStopForm({ ...EMPTY_STOP, routeId }); setError(''); }
  function openEditStop(routeId: string, s: Stop) {
    setStopForm({ id: s.id, routeId, name: s.name, order: String(s.order), times: s.times.join(', ') });
    setError('');
  }

  async function saveStop() {
    if (!stopForm) return;
    if (!stopForm.name.trim()) { setError('Stop name is required.'); return; }
    setSaving(true); setError('');
    const times = stopForm.times.split(',').map((t) => t.trim()).filter(Boolean);
    const body = { name: stopForm.name, order: Number(stopForm.order) || 0, times };
    try {
      if (stopForm.id) await api(`/admin/shuttle-routes/stops/${stopForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/admin/shuttle-routes/${stopForm.routeId}/stops`, { method: 'POST', body: JSON.stringify(body) });
      setStopForm(null); load();
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
    setSaving(false);
  }

  async function removeStop(s: Stop) {
    if (!(await confirmDelete(`Remove stop “${s.name}”?`))) return;
    await api(`/admin/shuttle-routes/stops/${s.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1>Shuttle</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Scheduled shuttle routes and stop timetables. Departure times are fixed — this is not live GPS tracking.
          </p>
        </div>
        <button className="primary" onClick={openNewRoute}>+ Add route</button>
      </div>
      {error && !routeForm && !stopForm && <div className="error">{error}</div>}

      {routes.length === 0 && <p style={{ color: 'var(--muted)' }}>No shuttle routes yet.</p>}
      {routes.map((r) => (
        <div key={r.id} className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>{r.name} {!r.active && <span className="pillbadge off">Inactive</span>}</h3>
              {r.description && <p className="subtitle" style={{ margin: '4px 0 0' }}>{r.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tbtn" onClick={() => openNewStop(r.id)}>+ Add stop</button>
              <button className="tbtn" onClick={() => openEditRoute(r)}>Edit</button>
              <button className="tbtn danger" onClick={() => removeRoute(r)}>Remove</button>
            </div>
          </div>
          <table className="dtable" style={{ marginTop: 12 }}>
            <thead><tr><th>Order</th><th>Stop</th><th>Departure times</th><th></th></tr></thead>
            <tbody>
              {r.stops.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No stops yet.</td></tr>}
              {r.stops.map((s) => (
                <tr key={s.id}>
                  <td>{s.order}</td>
                  <td>{s.name}</td>
                  <td>{s.times.length ? s.times.join(', ') : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="tbtn" onClick={() => openEditStop(r.id, s)}>Edit</button>{' '}
                    <button className="tbtn danger" onClick={() => removeStop(s)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {routeForm && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setRouteForm(null)}>
          <div className="modal" style={{ width: 480 }}>
            <h2>{routeForm.id ? 'Edit route' : 'Add route'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Name *</label><input value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} /></div>
              <div className="form-row full"><label>Description</label><textarea value={routeForm.description} onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })} /></div>
              <div className="form-row"><label>Sort order</label><input type="number" value={routeForm.sortOrder} onChange={(e) => setRouteForm({ ...routeForm, sortOrder: e.target.value })} /></div>
              <div className="form-row"><label>Active</label><input type="checkbox" checked={routeForm.active} onChange={(e) => setRouteForm({ ...routeForm, active: e.target.checked })} /></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setRouteForm(null)}>Cancel</button>
              <button className="primary" onClick={saveRoute} disabled={saving}>{saving ? 'Saving…' : routeForm.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {stopForm && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setStopForm(null)}>
          <div className="modal" style={{ width: 440 }}>
            <h2>{stopForm.id ? 'Edit stop' : 'Add stop'}</h2>
            <div className="form-grid">
              <div className="form-row full"><label>Name *</label><input value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} /></div>
              <div className="form-row"><label>Order</label><input type="number" value={stopForm.order} onChange={(e) => setStopForm({ ...stopForm, order: e.target.value })} /></div>
              <div className="form-row full"><label>Departure times (comma-separated, HH:MM)</label><input placeholder="09:00, 09:30, 10:00" value={stopForm.times} onChange={(e) => setStopForm({ ...stopForm, times: e.target.value })} /></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setStopForm(null)}>Cancel</button>
              <button className="primary" onClick={saveStop} disabled={saving}>{saving ? 'Saving…' : stopForm.id ? 'Save changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
