'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function ChangeManagement() {
  return (
    <div>
      <p className="subtitle" style={{ marginTop: -6 }}>Record and track platform changes and releases.</p>
      <SimpleCrud
        storageKey="sys_changes"
        addLabel="Log a change"
        emptyText="No changes recorded."
        fields={[
          { key: 'title', label: 'Title' },
          { key: 'type', label: 'Type', type: 'select', options: ['Feature', 'Fix', 'Config', 'Migration', 'Rollback'] },
          { key: 'status', label: 'Status', type: 'select', options: ['Planned', 'In progress', 'Deployed', 'Reverted'] },
          { key: 'date', label: 'Date' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        columns={[{ key: 'title', label: 'Change' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' }]}
        renderCell={(r, k) => (k === 'status'
          ? <span className={`pillbadge ${r.status === 'Deployed' ? 'on' : r.status === 'Reverted' ? 'off' : 'park'}`}>{String(r.status)}</span>
          : String(r[k] ?? '—') || '—')}
      />
    </div>
  );
}
