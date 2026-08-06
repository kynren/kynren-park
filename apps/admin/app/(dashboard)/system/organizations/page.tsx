'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function Organizations() {
  return (
    <SimpleCrud
      storageKey="sys_organizations"
      addLabel="Add organization"
      emptyText="No organizations yet."
      seed={[{ id: 'seed1', name: 'Eleven Arches — Kynren', plan: 'Enterprise', contact: 'ops@kynren.com', status: 'Active' }]}
      fields={[
        { key: 'name', label: 'Organization name' },
        { key: 'plan', label: 'Plan', type: 'select', options: ['Basic', 'Pro', 'Enterprise'] },
        { key: 'contact', label: 'Contact email' },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Suspended'] },
      ]}
      columns={[{ key: 'name', label: 'Name' }, { key: 'plan', label: 'Plan' }, { key: 'contact', label: 'Contact' }, { key: 'status', label: 'Status' }]}
      renderCell={(r, k) => (k === 'status'
        ? <span className={`pillbadge ${r.status === 'Active' ? 'on' : 'off'}`}>{String(r.status)}</span>
        : String(r[k] ?? '—') || '—')}
    />
  );
}
