'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function Integrations() {
  return (
    <SimpleCrud
      storageKey="sys_integrations"
      addLabel="Add integration"
      emptyText="No integrations configured."
      seed={[
        { id: 's1', name: 'Expo Push', category: 'Notifications', enabled: true },
        { id: 's2', name: 'Stripe', category: 'Payments', enabled: false },
        { id: 's3', name: 'Mailchimp', category: 'Marketing', enabled: false },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category', type: 'select', options: ['Notifications', 'Payments', 'Marketing', 'Analytics', 'Other'] },
        { key: 'apiKey', label: 'API key' },
        { key: 'enabled', label: 'Enabled', type: 'checkbox' },
      ]}
      columns={[{ key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'enabled', label: 'Status' }]}
      renderCell={(r, k) => (k === 'enabled'
        ? <span className={`pillbadge ${r.enabled ? 'on' : 'off'}`}>{r.enabled ? 'Enabled' : 'Disabled'}</span>
        : String(r[k] ?? '—') || '—')}
    />
  );
}
