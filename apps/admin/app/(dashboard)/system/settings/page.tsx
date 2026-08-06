'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function SystemSettings() {
  return (
    <div>
      <p className="subtitle" style={{ marginTop: -6 }}>Global key/value configuration for the platform.</p>
      <SimpleCrud
        storageKey="sys_settings"
        addLabel="Add setting"
        emptyText="No settings defined."
        seed={[
          { id: 'k1', key: 'park.timezone', value: 'Europe/London' },
          { id: 'k2', key: 'park.openingDate', value: '2026-07-18' },
          { id: 'k3', key: 'push.reminderMins', value: '20' },
        ]}
        fields={[{ key: 'key', label: 'Key' }, { key: 'value', label: 'Value' }]}
        columns={[{ key: 'key', label: 'Key' }, { key: 'value', label: 'Value' }]}
      />
    </div>
  );
}
