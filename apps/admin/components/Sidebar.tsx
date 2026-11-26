'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '../lib/api';
import { usePerms } from '../lib/perms';
import { useBranding } from '../lib/branding';
import { SIDEBAR_ICON as I } from '../lib/nav';

export function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const OPERATIONS: { href: string; label: string; icon: string; perm?: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: I.dashboard },
  { href: '/schedule', label: 'Live Schedule', icon: I.schedule, perm: 'schedule' },
  { href: '/kitchen', label: 'Kitchen', icon: I.kitchen, perm: 'food' },
  { href: '/announcements', label: 'Announcements', icon: I.announcements, perm: 'announce' },
  { href: '/analytics', label: 'Analytics', icon: I.analytics, perm: 'analytics' },
];
const CONTENT: { href: string; label: string; icon: string; perm?: string }[] = [
  { href: '/attractions', label: 'Attractions', icon: I.attractions, perm: 'content' },
  { href: '/shows', label: 'Shows', icon: I.shows, perm: 'content' },
];

// App Settings sub-sections (prefix match highlights the parent).
const APP_SETTINGS = '/app-settings';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = usePerms();
  const brand = useBranding();

  const item = (href: string, label: string, icon: string, match?: (p: string) => boolean) => {
    const active = match ? match(pathname) : pathname === href || (href === '/dashboard' && pathname === '/');
    return (
      <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
        <Icon d={icon} />
        <span>{label}</span>
      </Link>
    );
  };

  const ops = OPERATIONS.filter((n) => !n.perm || can(n.perm));
  const content = CONTENT.filter((n) => !n.perm || can(n.perm));
  const showApp = can('content');
  const showSystem = can('system');

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="logo">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.appName} />
          : <span>{brand.appName}<b>.</b></span>}
      </div>
      <nav className="nav">
        {ops.length > 0 && <div className="nav-label">Operations</div>}
        {ops.map((n) => item(n.href, n.label, n.icon))}
        {(content.length > 0 || showApp) && <div className="nav-label">Content</div>}
        {content.map((n) => item(n.href, n.label, n.icon))}
        {showApp && item(APP_SETTINGS, 'App Settings', I.appSettings, (p) => p.startsWith(APP_SETTINGS))}
        {showSystem && <div className="nav-label">Admin</div>}
        {showSystem && item('/system/organizations', 'System', I.system, (p) => p.startsWith('/system'))}
      </nav>
      <div className="nav-spacer" />
      <div className="nav-foot">
        {item('/support', 'Support', I.support)}
        {item('/settings', 'My settings', I.settings)}
        <button className="nav-item" onClick={() => { clearSession(); router.replace('/login'); }}>
          <Icon d={I.logout} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
