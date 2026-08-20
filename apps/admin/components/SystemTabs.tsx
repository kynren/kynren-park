'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SystemTab { href: string; label: string }
interface SystemTabGroup { key: string; label: string; tabs: SystemTab[] }

// Two-tier nav: a top row of categories, and — for any category with more
// than one page — a second row of its own pages underneath. Replaces a
// single flat row of 17 identical-looking pills that had become impossible
// to scan at a glance.
export const SYSTEM_TAB_GROUPS: SystemTabGroup[] = [
  {
    key: 'organization',
    label: 'Organization',
    tabs: [
      { href: '/system/organizations', label: 'Organizations' },
    ],
  },
  {
    key: 'people',
    label: 'People & Access',
    tabs: [
      { href: '/system/users', label: 'Users' },
      { href: '/system/staff', label: 'Staff' },
      { href: '/system/roles', label: 'Roles & Permissions' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    tabs: [
      { href: '/system/settings', label: 'System Settings' },
      { href: '/system/database', label: 'Database' },
      { href: '/system/backups', label: 'Backups' },
      { href: '/system/api-connection', label: 'API Connection' },
    ],
  },
  {
    key: 'branding',
    label: 'Branding & Media',
    tabs: [
      { href: '/system/branding', label: 'Branding' },
      { href: '/system/home', label: 'Home Screen' },
      { href: '/system/images', label: 'App Images' },
      { href: '/system/media', label: 'Media Center' },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    tabs: [
      { href: '/system/integrations', label: 'Integrations' },
    ],
  },
  {
    key: 'monitoring',
    label: 'Monitoring & Change',
    tabs: [
      { href: '/system/status', label: 'System Status' },
      { href: '/system/change-management', label: 'Change Management' },
      { href: '/system/agent-log', label: 'Agent Log' },
      { href: '/system/changelog', label: 'Changelog' },
    ],
  },
];

export function SystemTabs() {
  const pathname = usePathname();
  const activeGroup =
    SYSTEM_TAB_GROUPS.find((g) => g.tabs.some((t) => t.href === pathname)) ?? SYSTEM_TAB_GROUPS[0]!;

  return (
    <div>
      <div className="systabs">
        {SYSTEM_TAB_GROUPS.map((g) => (
          <Link
            key={g.key}
            href={g.tabs[0]!.href}
            className={`systab ${g.key === activeGroup.key ? 'active' : ''}`}
          >
            {g.label}
          </Link>
        ))}
      </div>
      {activeGroup.tabs.length > 1 && (
        <div className="systabs systabs-sub">
          {activeGroup.tabs.map((t) => (
            <Link key={t.href} href={t.href} className={`systab systab-sm ${pathname === t.href ? 'active' : ''}`}>
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
