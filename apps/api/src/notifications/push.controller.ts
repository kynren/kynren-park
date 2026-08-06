import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Expo } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public, CurrentUser } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';

/**
 * Device push-token registration. Public so a guest's device registers on
 * launch (a park app is mostly guests); links to the user once they sign in.
 */
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('register')
  async register(
    @CurrentUser() user: AuthPrincipal | undefined,
    @Body() body: { token?: string; platform?: string },
  ) {
    const token = body?.token;
    if (!token || !Expo.isExpoPushToken(token)) return { ok: false };
    const userId = user?.type === 'user' ? user.sub : null;
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { token, platform: body.platform ?? 'unknown', userId },
      update: { platform: body.platform ?? 'unknown', ...(userId ? { userId } : {}) },
    });
    return { ok: true };
  }

  @Public()
  @Post('unregister')
  async unregister(@Body() body: { token?: string }) {
    if (body?.token) await this.prisma.pushToken.deleteMany({ where: { token: body.token } });
    return { ok: true };
  }
}
