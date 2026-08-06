'use client';

import { useEffect, useState } from 'react';
import { api, getStaff } from './api';

export const PERMISSIONS = [
  { key: 'schedule', label: 'Manage schedule' },
  { key: 'food', label: 'Manage food orders' },
  { key: 'content', label: 'Manage content & app settings' },
  { key: 'announce', label: 'Send announcements' },
  { key: 'analytics', label: 'View analytics' },
  { key: 'system', label: 'System administration' },
] as const;

export const ROLES = ['ADMIN', 'OPS', 'FNB', 'CONTENT'] as const;
export type PermMatrix = Record<string, Record<string, boolean>>;

// Mirrors the API's DEFAULT_MATRIX — used for instant nav gating before the
// live permissions load from /auth/staff/me.
export const DEFAULT_MATRIX: PermMatrix = {
  ADMIN: { schedule: true, food: true, content: true, announce: true, analytics: true, system: true },
  OPS: { schedule: true, food: false, content: false, announce: true, analytics: true, system: false },
  FNB: { schedule: false, food: true, content: false, announce: false, analytics: true, system: false },
  CONTENT: { schedule: false, food: false, content: true, announce: true, analytics: true, system: false },
};

const PERMS_KEY = 'kynren_staff_perms';

function cached(): Record<string, boolean> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PERMS_KEY);
  return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
}
export function setCachedPerms(p: Record<string, boolean>) {
  if (typeof window !== 'undefined') localStorage.setItem(PERMS_KEY, JSON.stringify(p));
}

export function rolePerms(role?: string): Record<string, boolean> {
  if (role === 'ADMIN') return Object.fromEntries(PERMISSIONS.map((p) => [p.key, true]));
  return (role && DEFAULT_MATRIX[role]) || {};
}

/** Current staff role + a live `can(permission)` check (role-default first, then server truth). */
export function usePerms() {
  const staff = typeof window !== 'undefined' ? getStaff() : null;
  const role = staff?.role;
  const [perms, setPerms] = useState<Record<string, boolean>>(() => cached() ?? rolePerms(role));

  useEffect(() => {
    api<{ role: string; permissions: Record<string, boolean> }>('/auth/staff/me')
      .then((me) => { setPerms(me.permissions); setCachedPerms(me.permissions); })
      .catch(() => undefined);
  }, []);

  const can = (permission: string) => role === 'ADMIN' || !!perms[permission];
  return { role, perms, can };
}
