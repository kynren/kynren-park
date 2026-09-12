'use client';

import { useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';
import { SimpleCrud } from '../../../../components/SimpleCrud';

function SmeetzStatus() {
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [detail, setDetail] = useState('');

  async function test() {
    setState('checking'); setDetail('');
    try {
      const res = await api<{ ok: boolean; detail: string }>('/admin/smeetz/status');
      setState(res.ok ? 'ok' : 'error');
      setDetail(res.detail);
    } catch (e) {
      setState('error');
      setDetail(friendlyError(e, 'Could not reach Smeetz.'));
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Smeetz ticketing</h2>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>
            Real integration — guests link Smeetz-booked orders into their in-app wallet by reference.
          </p>
        </div>
        <button className="tbtn" onClick={test} disabled={state === 'checking'}>
          {state === 'checking' ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      {state === 'ok' && <p style={{ color: 'var(--accent,#22b365)', marginTop: 12 }}>✓ {detail}</p>}
      {state === 'error' && <p className="error" style={{ marginTop: 12 }}>{detail}</p>}
    </div>
  );
}

export default function ApiConnection() {
  return (
    <div>
      <SmeetzStatus />
      <p className="subtitle" style={{ marginTop: -6 }}>
        Register external apps to push or pull Kynren data. Define the endpoint, direction and auth; the
        connector runs on the configured schedule.
      </p>
      <SimpleCrud
        storageKey="sys_api_connections"
        addLabel="Add connection"
        emptyText="No API connections yet."
        fields={[
          { key: 'name', label: 'Connection name' },
          { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://partner.example.com/api' },
          { key: 'direction', label: 'Direction', type: 'select', options: ['Push (send data out)', 'Pull (fetch data in)', 'Both'] },
          { key: 'resource', label: 'Resource', type: 'select', options: ['Schedule', 'Restaurants', 'Bookings', 'Orders', 'Users'] },
          { key: 'authToken', label: 'Auth token / API key' },
          { key: 'enabled', label: 'Enabled', type: 'checkbox' },
        ]}
        columns={[{ key: 'name', label: 'Name' }, { key: 'direction', label: 'Direction' }, { key: 'resource', label: 'Resource' }, { key: 'enabled', label: 'Status' }]}
        renderCell={(r, k) => (k === 'enabled'
          ? <span className={`pillbadge ${r.enabled ? 'on' : 'off'}`}>{r.enabled ? 'Live' : 'Paused'}</span>
          : String(r[k] ?? '—') || '—')}
      />
    </div>
  );
}
