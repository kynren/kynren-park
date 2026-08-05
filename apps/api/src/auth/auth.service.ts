import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { RegisterInput, LoginInput } from '@kynren/shared';
import { hashPassword, verifyPassword } from '@kynren/shared/crypto';
import { PrismaService } from '../prisma/prisma.service.js';

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signAccess(payload: object) {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
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

  private async buildSession(userId: string, email: string | null, name: string | null) {
    const accessToken = this.signAccess({ sub: userId, type: 'user', email });
    const refreshToken = await this.issueRefreshToken(userId);
    return { accessToken, refreshToken, user: { id: userId, email, name } };
  }
}
