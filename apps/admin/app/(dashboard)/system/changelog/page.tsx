'use client';

const RELEASES: { version: string; date: string; notes: string[] }[] = [
  { version: 'v0.5', date: '2026-08-06', notes: ['Super-admin System console (organizations, users, roles, backups, integrations, status).', 'App Settings: restaurants & program schedule management with live mobile sync.', 'Admin redesign with sidebar, dashboard overview and charts.'] },
  { version: 'v0.4', date: '2026-08-05', notes: ['Mobile redesign: home, map, program timetable, dining hub.', 'Adaptive light/dark theme, editable profile.', 'Map deep-link "Go to" with distance/proximity.'] },
  { version: 'v0.3', date: '2026-07-30', notes: ['Click & Collect food ordering + kitchen fulfilment.', 'Analytics dashboard and offline park map.'] },
  { version: 'v0.2', date: '2026-07-20', notes: ['Digital tickets with offline QR, notifications, favourites.'] },
  { version: 'v0.1', date: '2026-07-12', notes: ['Initial platform: attractions, live schedule, itinerary planner.'] },
];

export default function Changelog() {
  return (
    <div>
      <p className="subtitle" style={{ marginTop: -6 }}>Platform release history.</p>
      <div className="board">
        {RELEASES.map((r) => (
          <div className="panel" key={r.version}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <span className="panel-title">{r.version}</span>
              <span className="hint">{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
              {r.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
