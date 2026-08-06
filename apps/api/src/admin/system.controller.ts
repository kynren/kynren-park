import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards,
  BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '@kynren/shared/crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService, STAFF_ROLES } from '../permissions/permissions.service.js';
import { MailService } from '../mail/mail.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

function inviteEmailHtml(url: string, role: string) {
  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#22314a">
      <h2 style="color:#8f1d21">Kynren — The Storied Lands</h2>
      <p>You've been invited to the <b>staff console</b> as <b>${role}</b>.</p>
      <p>Click below to set your name and password and get started:</p>
      <p><a href="${url}" style="display:inline-block;background:#8f1d21;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Accept invitation</a></p>
      <p style="color:#8a94a6;font-size:13px">Or paste this link into your browser:<br>${url}</p>
      <p style="color:#8a94a6;font-size:13px">This invitation expires in 7 days.</p>
    </div>`;
}

/**
 * System console: staff-account management and the role→permission matrix.
 * ADMIN only — this is the highest-privilege surface.
 */
@ApiTags('admin-system')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly mail: MailService,
  ) {}

  private inviteUrl(token: string) {
    const base = (process.env.PUBLIC_ADMIN_URL || 'https://app-park.kynren.com').replace(/\/$/, '');
    return `${base}/accept-invite?token=${token}`;
  }

  private async createInvite(email: string, role: string) {
    if (!STAFF_ROLES.includes(role as any)) throw new BadRequestException('Invalid role');
    const token = randomBytes(24).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 86_400_000);
    const existing = await this.prisma.staffUser.findUnique({ where: { email } });
    let staff;
    if (existing) {
      if (existing.active) throw new ConflictException('That email already has an active account');
      staff = await this.prisma.staffUser.update({ where: { id: existing.id }, data: { role: role as any, inviteToken: token, inviteExpiresAt } });
    } else {
      staff = await this.prisma.staffUser.create({
        data: {
          email, name: email.split('@')[0], role: role as any, active: false,
          passwordHash: hashPassword(randomBytes(16).toString('hex')), // placeholder until accepted
          inviteToken: token, inviteExpiresAt,
        },
      });
    }
    const url = this.inviteUrl(token);
    const { sent } = await this.mail.send(email, 'You’re invited to the Kynren staff console', inviteEmailHtml(url, role));
    return { id: staff.id, email: staff.email, role: staff.role, inviteUrl: url, emailSent: sent };
  }

  private view(s: { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date; inviteToken?: string | null }) {
    return { id: s.id, name: s.name, email: s.email, role: s.role, active: s.active, pending: !s.active && !!s.inviteToken, createdAt: s.createdAt };
  }

  private async assertNotLastAdmin(excludeId: string) {
    const admins = await this.prisma.staffUser.count({
      where: { role: 'ADMIN', active: true, NOT: { id: excludeId } },
    });
    if (admins === 0) throw new BadRequestException('There must always be at least one active admin');
  }

  // ---- Staff accounts -------------------------------------------------------
  @Get('staff')
  async listStaff() {
    const staff = await this.prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } });
    return staff.map((s) => this.view(s));
  }

  @Post('staff')
  async createStaff(@Body() b: any) {
    const email = String(b.email ?? '').trim().toLowerCase();
    const name = String(b.name ?? '').trim();
    if (!email || !name) throw new BadRequestException('Name and email are required');
    if (!STAFF_ROLES.includes(b.role)) throw new BadRequestException('Invalid role');
    if (!b.password || String(b.password).length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (await this.prisma.staffUser.findUnique({ where: { email } })) {
      throw new ConflictException('A staff member with that email already exists');
    }
    const s = await this.prisma.staffUser.create({
      data: { email, name, role: b.role, passwordHash: hashPassword(b.password), active: b.active ?? true },
    });
    return this.view(s);
  }

  @Patch('staff/:id')
  async updateStaff(@Param('id') id: string, @Body() b: any) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!email) throw new BadRequestException('Email cannot be empty');
      const other = await this.prisma.staffUser.findUnique({ where: { email } });
      if (other && other.id !== id) throw new ConflictException('That email is already in use');
      data.email = email;
    }
    if (b.role !== undefined) {
      if (!STAFF_ROLES.includes(b.role)) throw new BadRequestException('Invalid role');
      if (s.role === 'ADMIN' && b.role !== 'ADMIN') await this.assertNotLastAdmin(id);
      data.role = b.role;
    }
    if (b.active !== undefined) {
      if (s.role === 'ADMIN' && b.active === false) await this.assertNotLastAdmin(id);
      data.active = !!b.active;
    }
    const updated = await this.prisma.staffUser.update({ where: { id }, data });
    return this.view(updated);
  }

  @Post('staff/:id/password')
  async resetPassword(@Param('id') id: string, @Body() b: any) {
    if (!b.password || String(b.password).length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (!(await this.prisma.staffUser.findUnique({ where: { id } }))) throw new NotFoundException('Staff not found');
    await this.prisma.staffUser.update({ where: { id }, data: { passwordHash: hashPassword(b.password) } });
    return { ok: true };
  }

  @Delete('staff/:id')
  async deleteStaff(@Param('id') id: string) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    if (s.role === 'ADMIN') await this.assertNotLastAdmin(id);
    await this.prisma.staffUser.delete({ where: { id } });
    return { deleted: true };
  }

  @Post('staff/bulk-delete')
  async bulkDelete(@Body() b: { ids?: string[] }) {
    const ids = Array.isArray(b?.ids) ? b.ids : [];
    if (ids.length === 0) throw new BadRequestException('No staff selected');
    // Never let a bulk delete remove the last active admin.
    const remainingAdmins = await this.prisma.staffUser.count({
      where: { role: 'ADMIN', active: true, NOT: { id: { in: ids } } },
    });
    const deletingAnActiveAdmin = await this.prisma.staffUser.count({
      where: { id: { in: ids }, role: 'ADMIN', active: true },
    });
    if (deletingAnActiveAdmin > 0 && remainingAdmins === 0) {
      throw new BadRequestException('That would remove the last active admin');
    }
    const res = await this.prisma.staffUser.deleteMany({ where: { id: { in: ids } } });
    return { deleted: res.count };
  }

  // ---- Email invites --------------------------------------------------------
  @Post('staff/invite')
  async invite(@Body() b: any) {
    const email = String(b?.email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');
    return this.createInvite(email, b?.role);
  }

  @Post('staff/:id/invite')
  async resendInvite(@Param('id') id: string) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    if (s.active) throw new BadRequestException('That account is already active');
    return this.createInvite(s.email, s.role);
  }

  // ---- Role → permission matrix --------------------------------------------
  @Get('permissions')
  getPermissions() {
    return this.permissions.getMatrix();
  }

  @Put('permissions')
  setPermissions(@Body() b: any) {
    return this.permissions.setMatrix(b?.matrix ?? b ?? {});
  }
}
