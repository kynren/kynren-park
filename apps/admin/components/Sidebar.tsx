'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '../lib/api';
import { usePerms } from '../lib/perms';
import { useBranding } from '../lib/branding';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const NAV: { href: string; label: string; icon: string; badge?: number; perm?: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 11l9-8 9 8|M5 10v10h14V10' },
  { href: '/schedule', label: 'Live Schedule', icon: 'M4 5h16v16H4z|M8 3v4M16 3v4M4 10h16', perm: 'schedule' },
  { href: '/attractions', label: 'Attractions', icon: 'M4 20l6-11 4 7 3-5 3 9|M4 20h16', perm: 'content' },
  { href: '/shows', label: 'Shows', icon: 'M3 5h18v12H3z|M3 21h18|M8 9l4 3-4 3', perm: 'content' },
  { href: '/kitchen', label: 'Kitchen', icon: 'M6 3v8a3 3 0 0 0 6 0V3|M9 11v10|M17 3c-1.5 2-1.5 6 0 8.5V21', perm: 'food' },
  { href: '/announcements', label: 'Announcements', icon: 'M3 11l14-6v14L3 13z|M3 11v2M8 12v5a2 2 0 0 0 4 0', perm: 'announce' },
  { href: '/analytics', label: 'Analytics', icon: 'M4 20V10|M10 20V4|M16 20v-7|M21 20H3', perm: 'analytics' },
];

// App Settings sub-sections (prefix match highlights the parent).
const APP_SETTINGS = '/app-settings';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = usePerms();
  const brand = useBranding();

  const item = (href: string, label: string, icon: string, opts?: { badge?: number; match?: (p: string) => boolean }) => {
    const active = opts?.match ? opts.match(pathname) : pathname === href || (href === '/dashboard' && pathname === '/');
    return (
      <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
        <Icon d={icon} />
        <span>{label}</span>
        {opts?.badge ? <span className="nav-badge">{opts.badge}</span> : null}
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <div className="logo">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.appName} style={{ maxHeight: 34, maxWidth: 170 }} />
          : <>{brand.appName}</>}
      </div>
      <nav className="nav">
        {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => item(n.href, n.label, n.icon, { badge: n.badge }))}
        {can('content') && item(APP_SETTINGS, 'App Settings', 'M12 2l2.4 2.4H18v3.6L20.4 12 18 14.4V18h-3.6L12 20.4 9.6 18H6v-3.6L3.6 12 6 9.6V6h3.6z|M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0', {
          match: (p) => p.startsWith(APP_SETTINGS),
        })}
        {can('system') && item('/system/organizations', 'System', 'M4 4h16v6H4z|M4 14h16v6H4z|M8 7h.01M8 17h.01', {
          match: (p) => p.startsWith('/system'),
        })}
      </nav>
      <div className="nav-spacer" />
      <div className="nav-foot">
        <Link href="/support" className={`nav-item ${pathname === '/support' ? 'active' : ''}`}>
          <Icon d="M12 8v4l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /><span>Support</span>
        </Link>
        {item('/settings', 'Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.3 7')}
        <button className="nav-item" onClick={() => { clearSession(); router.replace('/login'); }}>
          <Icon d="M16 17l5-5-5-5|M21 12H9|M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
