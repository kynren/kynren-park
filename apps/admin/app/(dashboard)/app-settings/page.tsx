'use client';

import Link from 'next/link';

function I({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const CARDS: { href: string; title: string; desc: string; icon: string; ready: boolean }[] = [
  { href: '/app-settings/restaurants', title: 'Restaurants', ready: true, icon: 'M6 3v8a3 3 0 0 0 6 0V3|M9 11v10|M17 3c-1.5 2-1.5 6 0 8.5V21', desc: 'Add, edit and remove restaurants, their featured image and menu. Live in the mobile app.' },
  { href: '/app-settings/shops', title: 'Shops', ready: true, icon: 'M4 9h16l-1 11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z|M4 9l1.5-5h13L20 9|M9 13a3 3 0 0 0 6 0', desc: 'Add shops, their featured image and the products they sell (with prices and varieties). Placeable on the map.' },
  { href: '/app-settings/schedule', title: 'Program Schedule', ready: true, icon: 'M4 5h16v16H4z|M8 3v4M16 3v4M4 10h16', desc: 'Add, edit and remove show sessions in the mobile timetable format.' },
  { href: '/app-settings/map', title: 'Map & Hotspots', ready: true, icon: 'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z|M9 4v14M15 6v14', desc: 'Plot hotspots, set lat/lng, colours and categories, and tune the map.' },
  { href: '/app-settings/facilities', title: 'Facilities', ready: true, icon: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z', desc: 'Toilets, first aid, shops and any service shown on the map — add one at a time or import a batch from a CSV.' },
  { href: '/app-settings/push', title: 'Push Templates', ready: true, icon: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0', desc: 'Create push-notification templates and assign them to actions.' },
  { href: '/app-settings/walkthrough', title: 'Walkthrough', ready: true, icon: 'M12 2 2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5', desc: 'Write the first-time onboarding tour and pick which tab each step appears on.' },
  { href: '/system/api-connection', title: 'API Connections', ready: true, icon: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1|M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1', desc: 'Push and pull data to and from other applications.' },
  { href: '/system/users', title: 'Users', ready: true, icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M22 21v-2a4 4 0 0 0-3-3.9', desc: 'Everyone who installed the app and who is in the park right now.' },
];

export default function AppSettingsHub() {
  return (
    <div>
      <h1>App Settings</h1>
      <p className="subtitle">Everything that powers the Kynren mobile app. Changes here sync straight to guests.</p>
      <div className="set-grid">
        {CARDS.map((c) => {
          const inner = (
            <>
              <div className="set-ico"><I d={c.icon} /></div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <span className={`set-tag ${c.ready ? '' : 'soon'}`}>{c.ready ? 'Manage' : 'Coming next'}</span>
            </>
          );
          return c.ready ? (
            <Link key={c.href} href={c.href} className="set-card">{inner}</Link>
          ) : (
            <div key={c.href} className="set-card soon">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
