'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * A global "you are here" bar shown on every non-root page: a Back button that
 * goes up one level plus an auto-generated breadcrumb trail. Root pages (the
 * top-level sidebar destinations, i.e. single-segment routes) show nothing.
 *
 * Labels come from a full-path map; unknown segments are title-cased. Dynamic
 * id segments (a shop/restaurant id, etc.) are dropped from the trail — the
 * page's own heading already names the record.
 */
const LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/schedule': 'Live Schedule',
  '/attractions': 'Attractions',
  '/shows': 'Shows',
  '/kitchen': 'Kitchen',
  '/announcements': 'Announcements',
  '/analytics': 'Analytics',
  '/support': 'Support',
  '/settings': 'Settings',
  '/app-settings': 'App Settings',
  '/app-settings/restaurants': 'Restaurants',
  '/app-settings/shops': 'Shops',
  '/app-settings/categories': 'Categories & Services',
  '/app-settings/map': 'Map & Hotspots',
  '/app-settings/push': 'Push Templates',
  '/app-settings/schedule': 'Program Schedule',
  '/app-settings/walkthrough': 'Walkthrough',
  '/system': 'System',
  '/system/organizations': 'Organizations',
  '/system/agent-log': 'Agent Log',
  '/system/api-connection': 'API Connections',
  '/system/backups': 'Backups',
  '/system/branding': 'Branding',
  '/system/change-management': 'Change Management',
  '/system/changelog': 'Changelog',
  '/system/database': 'Database',
  '/system/home': 'Home Screen',
  '/system/images': 'App Images',
  '/system/integrations': 'Integrations',
  '/system/media': 'Media',
  '/system/roles': 'Roles',
  '/system/settings': 'Settings',
  '/system/staff': 'Staff',
  '/system/status': 'System Status',
  '/system/users': 'Users',
};

function titleize(seg: string) {
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function looksLikeId(fullPath: string, seg: string) {
  return !LABELS[fullPath] && (/^\d+$/.test(seg) || /^[a-z0-9]{12,}$/i.test(seg));
}

export function PageNav() {
  const pathname = usePathname() || '';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return null; // root page → no back / breadcrumb

  // Build the crumb trail, skipping dynamic id segments.
  const crumbs: { href: string; label: string }[] = [];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    if (looksLikeId(acc, seg)) continue;
    crumbs.push({ href: acc, label: LABELS[acc] ?? titleize(seg) });
  }
  if (crumbs.length === 0) return null;

  // Back goes up one level (parent path).
  const parent = '/' + segments.slice(0, -1).join('/');

  return (
    <div className="pagenav">
      <Link href={parent} className="backbtn" aria-label="Back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </Link>
      <nav className="crumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page" style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.label}</span>}
            {i < crumbs.length - 1 && <span aria-hidden>›</span>}
          </span>
        ))}
      </nav>
    </div>
  );
}
