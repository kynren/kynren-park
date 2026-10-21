import {
  Injectable, UnauthorizedException, ConflictException,
  ForbiddenException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { createHash, randomBytes } from 'node:crypto';
import type { RegisterInput, LoginInput } from '@kynren/shared';
import { hashPassword, verifyPassword } from '@kynren/shared/crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { MailService } from '../mail/mail.service.js';
import type { AuthPrincipal } from '../common/decorators.js';

const RESET_TTL_MS = 60 * 60_000;
const RESET_COOLDOWN_MS = 60_000;

/** Email addresses are matched without regard to case: phones capitalise the first letter. */
const sameEmail = (email: string) => ({ equals: email.trim(), mode: 'insensitive' as const });

function resetEmail(url: string) {
  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#22314a">
      <h2 style="color:#8f1d21">Kynren — The Storied Lands</h2>
      <p>Someone asked to reset the password for your <b>staff console</b> account.</p>
      <p><a href="${url}" style="display:inline-block;background:#8f1d21;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Choose a new password</a></p>
      <p style="color:#8a94a6;font-size:13px">Or paste this link into your browser:<br>${url}</p>
      <p style="color:#8a94a6;font-size:13px">The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password hasn't changed.</p>
    </div>`;
}

function changedEmail() {
  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#22314a">
      <h2 style="color:#8f1d21">Kynren — The Storied Lands</h2>
      <p>The password for your <b>staff console</b> account was just changed.</p>
      <p style="color:#8a94a6;font-size:13px">If that was you, nothing more to do. If it wasn't, ask an administrator to look at your account straight away.</p>
    </div>`;
}

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
    private readonly mail: MailService,
  ) {}

  private signAccess(payload: object) {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_TTL || '15m') as StringValue,
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const ttlDays = parseInt((process.env.JWT_REFRESH_TTL || '30d').replace('d', ''), 10) || 30;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: sha256(raw),
        userId,
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return raw;
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findFirst({ where: { email: sameEmail(input.email) } });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: hashPassword(input.password),
      },
    });
    return this.buildSession(user.id, user.email, user.name);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findFirst({ where: { email: sameEmail(input.email) }, orderBy: { createdAt: 'asc' } });
    if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildSession(user.id, user.email, user.name);
  }

  async refresh(rawToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Rotate: revoke the used token and issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.buildSession(record.user.id, record.user.email, record.user.name);
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash: sha256(rawToken) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    return { ok: true };
  }

  async staffLogin(input: LoginInput) {
    const staff = await this.prisma.staffUser.findFirst({ where: { email: sameEmail(input.email) } });
    if (!staff?.active || !verifyPassword(input.password, staff.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = this.jwt.sign(
      { sub: staff.id, type: 'staff', role: staff.role, email: staff.email },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '12h' },
    );
    return { accessToken, staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role } };
  }

  // ---- Forgotten staff password --------------------------------------------
  /**
   * Emails a one-hour, single-use link to an active staff account. Says nothing about whether the address is one, and a
   * second request inside a minute is ignored, so it cannot be used to find accounts or to fill somebody's inbox.
   */
  async requestStaffReset(rawEmail: string): Promise<void> {
    const email = String(rawEmail ?? '').trim();
    if (!email) return;
    const staff = await this.prisma.staffUser.findFirst({ where: { email: sameEmail(email) } });
    if (!staff?.active) return;
    if (staff.resetExpiresAt && staff.resetExpiresAt.getTime() - RESET_TTL_MS + RESET_COOLDOWN_MS > Date.now()) return;

    const token = randomBytes(32).toString('hex');
    await this.prisma.staffUser.update({
      where: { id: staff.id },
      data: { resetTokenHash: sha256(token), resetExpiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const base = (process.env.PUBLIC_ADMIN_URL || 'https://app-park.kynren.com').replace(/\/$/, '');
    await this.mail.send(staff.email, 'Reset your Kynren staff password', resetEmail(`${base}/reset-password?token=${token}`));
  }

  async resetStaffPassword(b: { token?: string; password?: string }) {
    const invalid = new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    if (!b.token || typeof b.token !== 'string') throw invalid;
    if (!b.password || b.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const staff = await this.prisma.staffUser.findUnique({ where: { resetTokenHash: sha256(b.token) } });
    if (!staff?.active || !staff.resetExpiresAt || staff.resetExpiresAt < new Date()) throw invalid;

    await this.prisma.staffUser.update({
      where: { id: staff.id },
      data: { passwordHash: hashPassword(b.password), resetTokenHash: null, resetExpiresAt: null },
    });
    await this.mail.send(staff.email, 'Your Kynren staff password was changed', changedEmail());
    return { ok: true };
  }

  // ---- Staff email invites --------------------------------------------------
  async inviteInfo(token: string) {
    const s = await this.prisma.staffUser.findUnique({ where: { inviteToken: token } });
    if (!s || !s.inviteExpiresAt || s.inviteExpiresAt < new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired');
    }
    return { email: s.email, role: s.role };
  }

  async acceptInvite(b: { token?: string; name?: string; password?: string }) {
    if (!b.token) throw new BadRequestException('Missing invite token');
    const s = await this.prisma.staffUser.findUnique({ where: { inviteToken: b.token } });
    if (!s || !s.inviteExpiresAt || s.inviteExpiresAt < new Date()) {
      throw new BadRequestException('This invitation is invalid or has expired');
    }
    if (!b.name?.trim()) throw new BadRequestException('Name is required');
    if (!b.password || b.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    await this.prisma.staffUser.update({
      where: { id: s.id },
      data: { name: b.name.trim(), passwordHash: hashPassword(b.password), active: true, inviteToken: null, inviteExpiresAt: null },
    });
    return this.staffLogin({ email: s.email, password: b.password });
  }

  // ---- Staff self-service ---------------------------------------------------
  private async staffProfile(id: string) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    const permissions = await this.permissions.forRole(s.role);
    return { id: s.id, name: s.name, email: s.email, role: s.role, active: s.active, permissions };
  }

  async staffMe(principal?: AuthPrincipal) {
    if (!principal || principal.type !== 'staff') throw new ForbiddenException('Staff access required');
    return this.staffProfile(principal.sub);
  }

  async updateStaffMe(principal: AuthPrincipal | undefined, b: { name?: string; email?: string }) {
    if (!principal || principal.type !== 'staff') throw new ForbiddenException('Staff access required');
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!email) throw new BadRequestException('Email cannot be empty');
      const other = await this.prisma.staffUser.findUnique({ where: { email } });
      if (other && other.id !== principal.sub) throw new ConflictException('That email is already in use');
      data.email = email;
    }
    await this.prisma.staffUser.update({ where: { id: principal.sub }, data });
    return this.staffProfile(principal.sub);
  }

  async changeStaffPassword(principal: AuthPrincipal | undefined, b: { currentPassword?: string; newPassword?: string }) {
    if (!principal || principal.type !== 'staff') throw new ForbiddenException('Staff access required');
    const s = await this.prisma.staffUser.findUnique({ where: { id: principal.sub } });
    if (!s) throw new NotFoundException('Staff not found');
    if (!b.currentPassword || !verifyPassword(b.currentPassword, s.passwordHash)) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (!b.newPassword || String(b.newPassword).length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    await this.prisma.staffUser.update({ where: { id: principal.sub }, data: { passwordHash: hashPassword(b.newPassword) } });
    return { ok: true };
  }

  private async buildSession(userId: string, email: string | null, name: string | null) {
    const accessToken = this.signAccess({ sub: userId, type: 'user', email });
    const refreshToken = await this.issueRefreshToken(userId);
    return { accessToken, refreshToken, user: { id: userId, email, name } };
  }
}
