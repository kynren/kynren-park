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
import type { AuthPrincipal } from '../common/decorators.js';

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
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
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
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
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
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
    const staff = await this.prisma.staffUser.findUnique({ where: { email: input.email } });
    if (!staff?.active || !verifyPassword(input.password, staff.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = this.jwt.sign(
      { sub: staff.id, type: 'staff', role: staff.role, email: staff.email },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '12h' },
    );
    return { accessToken, staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role } };
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
