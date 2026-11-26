/** Every place a staff member can go, shared by the sidebar and the Ctrl/Cmd+K search. */
export interface Dest {
  href: string;
  label: string;
  group: 'Operations' | 'Content' | 'App settings' | 'System' | 'Account';
  perm?: string;
  /** extra words the search should match */
  keywords?: string;
}

export const SIDEBAR_ICON = {
  dashboard: 'M3 11l9-8 9 8|M5 10v10h14V10',
  schedule: 'M4 5h16v16H4z|M8 3v4M16 3v4M4 10h16',
  attractions: 'M4 20l6-11 4 7 3-5 3 9|M4 20h16',
  shows: 'M3 5h18v12H3z|M3 21h18|M8 9l4 3-4 3',
  kitchen: 'M6 3v8a3 3 0 0 0 6 0V3|M9 11v10|M17 3c-1.5 2-1.5 6 0 8.5V21',
  announcements: 'M3 11l14-6v14L3 13z|M3 11v2M8 12v5a2 2 0 0 0 4 0',
  analytics: 'M4 20V10|M10 20V4|M16 20v-7|M21 20H3',
  appSettings: 'M12 2l2.4 2.4H18v3.6L20.4 12 18 14.4V18h-3.6L12 20.4 9.6 18H6v-3.6L3.6 12 6 9.6V6h3.6z|M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0',
  system: 'M4 4h16v6H4z|M4 14h16v6H4z|M8 7h.01M8 17h.01',
  support: 'M12 8v4l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.3 7',
  logout: 'M16 17l5-5-5-5|M21 12H9|M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
} as const;

export const DESTINATIONS: Dest[] = [
  { href: '/dashboard', label: 'Dashboard', group: 'Operations', keywords: 'home overview today' },
  { href: '/schedule', label: 'Live Schedule', group: 'Operations', perm: 'schedule', keywords: 'sessions delay cancel times' },
  { href: '/kitchen', label: 'Kitchen', group: 'Operations', perm: 'food', keywords: 'orders food' },
  { href: '/announcements', label: 'Announcements', group: 'Operations', perm: 'announce', keywords: 'push notifications messages' },
  { href: '/analytics', label: 'Analytics', group: 'Operations', perm: 'analytics', keywords: 'reports stats numbers' },
  { href: '/attractions', label: 'Attractions', group: 'Content', perm: 'content' },
  { href: '/shows', label: 'Shows', group: 'Content', perm: 'content', keywords: 'programme' },
  { href: '/app-settings', label: 'App Settings', group: 'App settings', perm: 'content', keywords: 'guest app' },
  { href: '/app-settings/restaurants', label: 'Restaurants', group: 'App settings', perm: 'content', keywords: 'eat menu food' },
  { href: '/app-settings/shops', label: 'Shops', group: 'App settings', perm: 'content', keywords: 'retail' },
  { href: '/app-settings/facilities', label: 'Facilities', group: 'App settings', perm: 'content', keywords: 'toilets first aid' },
  { href: '/app-settings/map', label: 'Map & Hotspots', group: 'App settings', perm: 'content', keywords: 'pins places walkways' },
  { href: '/app-settings/push', label: 'Push Templates', group: 'App settings', perm: 'content', keywords: 'notifications' },
  { href: '/app-settings/schedule', label: 'Program Schedule', group: 'App settings', perm: 'content', keywords: 'timetable' },
  { href: '/app-settings/shuttle', label: 'Shuttle', group: 'App settings', perm: 'content', keywords: 'bus' },
  { href: '/app-settings/walkthrough', label: 'Walkthrough', group: 'App settings', perm: 'content', keywords: 'onboarding intro' },
  { href: '/app-settings/content', label: 'App content', group: 'App settings', perm: 'content', keywords: 'pages text' },
  { href: '/system/organizations', label: 'Organizations', group: 'System', perm: 'system' },
  { href: '/system/staff', label: 'Staff', group: 'System', perm: 'system', keywords: 'team invite people' },
  { href: '/system/roles', label: 'Roles', group: 'System', perm: 'system', keywords: 'permissions access' },
  { href: '/system/users', label: 'Users', group: 'System', perm: 'system', keywords: 'guests accounts' },
  { href: '/system/home', label: 'Home Screen', group: 'System', perm: 'system', keywords: 'designer hero app' },
  { href: '/system/images', label: 'App Images', group: 'System', perm: 'system', keywords: 'artwork slots' },
  { href: '/system/media', label: 'Media', group: 'System', perm: 'system', keywords: 'uploads files' },
  { href: '/system/branding', label: 'Branding', group: 'System', perm: 'system', keywords: 'logo colours' },
  { href: '/system/status', label: 'System Status', group: 'System', perm: 'system', keywords: 'health uptime' },
  { href: '/system/integrations', label: 'Integrations', group: 'System', perm: 'system', keywords: 'smeetz' },
  { href: '/system/api-connection', label: 'API Connections', group: 'System', perm: 'system' },
  { href: '/system/backups', label: 'Backups', group: 'System', perm: 'system' },
  { href: '/system/database', label: 'Database', group: 'System', perm: 'system' },
  { href: '/system/changelog', label: 'Changelog', group: 'System', perm: 'system', keywords: 'releases' },
  { href: '/system/change-management', label: 'Change Management', group: 'System', perm: 'system' },
  { href: '/system/agent-log', label: 'Agent Log', group: 'System', perm: 'system' },
  { href: '/system/settings', label: 'System Settings', group: 'System', perm: 'system' },
  { href: '/support', label: 'Support', group: 'Account' },
  { href: '/settings', label: 'My settings', group: 'Account', keywords: 'password profile account' },
];
