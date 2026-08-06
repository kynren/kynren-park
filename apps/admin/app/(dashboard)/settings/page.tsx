'use client';

import { useEffect, useState } from 'react';
import { API_URL, getStaff, type Staff } from '../../../lib/api';

export default function SettingsPage() {
  const [staff, setStaff] = useState<Staff | null>(null);
  useEffect(() => setStaff(getStaff()), []);

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">Your staff account and workspace configuration.</p>

      <div className="set-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Account</div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>Name</label><input readOnly value={staff?.name ?? ''} /></div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>Email</label><input readOnly value={staff?.email ?? ''} /></div>
          <div className="form-row"><label>Role</label><input readOnly value={staff?.role ?? ''} /></div>
        </div>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Workspace</div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>API endpoint</label><input readOnly value={API_URL} /></div>
          <div className="form-row"><label>Environment</label><input readOnly value={process.env.NODE_ENV ?? 'development'} /></div>
          <p className="hint">Manage app content, restaurants, schedule and the map under <b>App Settings</b>.</p>
        </div>
      </div>
    </div>
  );
}
