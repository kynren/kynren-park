import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const PERMISSION_KEYS = ['schedule', 'food', 'content', 'manage', 'announce', 'analytics', 'system'] as const;
export const STAFF_ROLES = ['ADMIN', 'OPS', 'FNB', 'CONTENT'] as const;
export type PermMatrix = Record<string, Record<string, boolean>>;

// Sensible starting point; ADMIN is always full and cannot be edited.
export const DEFAULT_MATRIX: PermMatrix = {
  ADMIN: { schedule: true, food: true, content: true, manage: true, announce: true, analytics: true, system: true },
  OPS: { schedule: true, food: false, content: false, manage: false, announce: true, analytics: true, system: false },
  FNB: { schedule: false, food: true, content: false, manage: false, announce: false, analytics: true, system: false },
  CONTENT: { schedule: false, food: false, content: true, manage: true, announce: true, analytics: true, system: false },
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full role→permission matrix: defaults overlaid with any stored overrides. */
  async getMatrix(): Promise<PermMatrix> {
    const rows = await this.prisma.rolePermission.findMany();
    const m: PermMatrix = {};
    for (const role of STAFF_ROLES) m[role] = { ...(DEFAULT_MATRIX[role] ?? {}) };
    for (const r of rows) {
      (m[r.role] ??= {})[r.permission] = r.allowed;
    }
    // ADMIN is always all-true.
    m.ADMIN = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
    return m;
  }

  /** Persist the editable roles (everything except ADMIN). */
  async setMatrix(matrix: PermMatrix): Promise<PermMatrix> {
    const ops = [];
    for (const role of STAFF_ROLES) {
      if (role === 'ADMIN') continue;
      for (const permission of PERMISSION_KEYS) {
        const allowed = !!matrix?.[role]?.[permission];
        ops.push(
          this.prisma.rolePermission.upsert({
            where: { role_permission: { role: role as any, permission } },
            create: { role: role as any, permission, allowed },
            update: { allowed },
          }),
        );
      }
    }
    await this.prisma.$transaction(ops);
    return this.getMatrix();
  }

  /** The permissions a single role currently holds. */
  async forRole(role: string | undefined): Promise<Record<string, boolean>> {
    const m = await this.getMatrix();
    if (role === 'ADMIN') return m.ADMIN;
    return (role && m[role]) || {};
  }

  async can(role: string | undefined, permission: string): Promise<boolean> {
    if (role === 'ADMIN') return true;
    if (!role) return false;
    return !!(await this.forRole(role))[permission];
  }
}
