'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

interface AppUser {
  id: string; name: string | null; email: string | null; locale: string; createdAt: string;
  installed: boolean; devices: number; bookings: number; orders: number; inPark: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { api<AppUser[]>('/admin/users').then(setUsers).catch(() => setError('Could not load users.')); }, []);

  const installed = users.filter((u) => u.installed).length;
  const inPark = users.filter((u) => u.inPark).length;

  return (
    <div>
      <div className="kv" style={{ marginBottom: 18 }}>
        <div className="cell"><div className="n">{users.length}</div><div className="l">Registered users</div></div>
        <div className="cell"><div className="n">{installed}</div><div className="l">Installed the app</div></div>
        <div className="cell"><div className="n">{inPark}</div><div className="l">In the park now</div></div>
      </div>
      {error && <div className="error">{error}</div>}
      <table className="dtable">
        <thead><tr><th>Name</th><th>Email</th><th>App</th><th>Devices</th><th>Bookings</th><th>Orders</th><th>Presence</th></tr></thead>
        <tbody>
          {users.length === 0 && !error && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No users yet.</td></tr>}
          {users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name ?? 'Guest'}</b></td>
              <td>{u.email ?? '—'}</td>
              <td>{u.installed ? <span className="pillbadge on">Installed</span> : <span className="pillbadge off">Web only</span>}</td>
              <td>{u.devices}</td>
              <td>{u.bookings}</td>
              <td>{u.orders}</td>
              <td>{u.inPark ? <span className="pillbadge park">● In park</span> : <span className="pillbadge off">Off-site</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">“In park” currently derives from a booking for today. A live GPS geofence signal from the mobile app can make this real-time.</p>
    </div>
  );
}
