'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function ApiConnection() {
  return (
    <div>
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
