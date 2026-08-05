import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUser } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  me(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, name: true, locale: true, accessibilityPrefs: true },
    });
  }

  /** Register an Expo push token for this device. */
  @Post('push-tokens')
  async registerPushToken(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { token: string; platform: string },
  ) {
    return this.prisma.pushToken.upsert({
      where: { token: body.token },
      create: { token: body.token, platform: body.platform, userId: user.sub },
      update: { userId: user.sub, platform: body.platform },
    });
  }

  @Delete('push-tokens')
  async removePushToken(@Body() body: { token: string }) {
    await this.prisma.pushToken.deleteMany({ where: { token: body.token } });
    return { ok: true };
  }

  // --- Favorites & "seen" tracking -----------------------------------------
  @Get('favorites')
  favorites(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.favorite.findMany({ where: { userId: user.sub }, include: { attraction: true } });
  }

  @Post('favorites')
  addFavorite(@CurrentUser() user: AuthPrincipal, @Body() body: { attractionId: string }) {
    return this.prisma.favorite.upsert({
      where: { userId_attractionId: { userId: user.sub, attractionId: body.attractionId } },
      create: { userId: user.sub, attractionId: body.attractionId },
      update: {},
    });
  }

  @Post('seen')
  markSeen(@CurrentUser() user: AuthPrincipal, @Body() body: { attractionId: string }) {
    return this.prisma.attractionSeen.upsert({
      where: { userId_attractionId: { userId: user.sub, attractionId: body.attractionId } },
      create: { userId: user.sub, attractionId: body.attractionId },
      update: { seenAt: new Date() },
    });
  }

  @Get('seen')
  seen(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.attractionSeen.findMany({ where: { userId: user.sub } });
  }
}
