'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SYSTEM_TABS: { href: string; label: string }[] = [
  { href: '/system/organizations', label: 'Organizations' },
  { href: '/system/users', label: 'Users' },
  { href: '/system/staff', label: 'Staff' },
  { href: '/system/roles', label: 'Roles & Permissions' },
  { href: '/system/backups', label: 'Backups' },
  { href: '/system/settings', label: 'System Settings' },
  { href: '/system/branding', label: 'Branding' },
  { href: '/system/home', label: 'Home Screen' },
  { href: '/system/images', label: 'App Images' },
  { href: '/system/database', label: 'Database' },
  { href: '/system/media', label: 'Media Center' },
  { href: '/system/integrations', label: 'Integrations' },
  { href: '/system/status', label: 'System Status' },
  { href: '/system/change-management', label: 'Change Management' },
  { href: '/system/agent-log', label: 'Agent Log' },
  { href: '/system/changelog', label: 'Changelog' },
  { href: '/system/api-connection', label: 'API Connection' },
];

export function SystemTabs() {
  const pathname = usePathname();
  return (
    <div className="systabs">
      {SYSTEM_TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`systab ${pathname === t.href ? 'active' : ''}`}>{t.label}</Link>
      ))}
    </div>
  );
}
