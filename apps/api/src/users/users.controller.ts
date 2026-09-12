import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@kynren/db';
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
      select: {
        id: true, email: true, name: true, locale: true, accessibilityPrefs: true,
        marketingConsent: true, consentedAt: true,
      },
    });
  }

  /** Merge-patch the guest's accessibility preferences (a free-form JSON blob). */
  @Patch('accessibility')
  async updateAccessibility(@CurrentUser() user: AuthPrincipal, @Body() body: Record<string, unknown>) {
    const current = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { accessibilityPrefs: true } });
    const merged = { ...(current?.accessibilityPrefs as Record<string, unknown> | null ?? {}), ...body };
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { accessibilityPrefs: merged as Prisma.InputJsonValue },
      select: { accessibilityPrefs: true },
    });
    return updated.accessibilityPrefs;
  }

  // --- GDPR: consent, export, deletion ---------------------------------------

  @Patch('consent')
  async setConsent(@CurrentUser() user: AuthPrincipal, @Body() body: { marketingConsent?: boolean }) {
    const marketingConsent = !!body?.marketingConsent;
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { marketingConsent, consentedAt: marketingConsent ? new Date() : null },
      select: { marketingConsent: true, consentedAt: true },
    });
    return updated;
  }

  /** Right to data portability: a JSON dump of everything tied to this account. */
  @Get('export')
  async exportData(@CurrentUser() user: AuthPrincipal) {
    const [profile, bookings, orders, favorites, itineraries, notifications, smeetzLinkedOrders] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          id: true, email: true, name: true, locale: true, accessibilityPrefs: true,
          marketingConsent: true, consentedAt: true, createdAt: true,
        },
      }),
      this.prisma.booking.findMany({ where: { userId: user.sub }, include: { tickets: true } }),
      this.prisma.order.findMany({ where: { userId: user.sub }, include: { items: true } }),
      this.prisma.favorite.findMany({ where: { userId: user.sub } }),
      this.prisma.itinerary.findMany({ where: { userId: user.sub }, include: { items: true } }),
      this.prisma.notification.findMany({ where: { userId: user.sub } }),
      this.prisma.smeetzLinkedOrder.findMany({ where: { userId: user.sub } }),
    ]);
    return { exportedAt: new Date().toISOString(), profile, bookings, orders, favorites, itineraries, notifications, smeetzLinkedOrders };
  }

  /**
   * Right to erasure — implemented as anonymization rather than a hard
   * cascading delete, so booking/order history needed for accounting/legal
   * retention survives while all personal identifiers are cleared.
   */
  @Delete()
  async deleteAccount(@CurrentUser() user: AuthPrincipal) {
    await this.prisma.$transaction([
      this.prisma.pushToken.deleteMany({ where: { userId: user.sub } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.sub } }),
      this.prisma.user.update({
        where: { id: user.sub },
        data: {
          email: null,
          name: null,
          passwordHash: null,
          accessibilityPrefs: Prisma.JsonNull,
          lastLat: null,
          lastLng: null,
          lastSeenAt: null,
          marketingConsent: false,
          consentedAt: null,
        },
      }),
    ]);
    return { ok: true };
  }

  /** Report the guest's current location (for in-park presence). */
  @Post('presence')
  async presence(@CurrentUser() user: AuthPrincipal, @Body() body: { lat: number; lng: number }) {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') return { ok: false };
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { lastLat: body.lat, lastLng: body.lng, lastSeenAt: new Date() },
    });
    return { ok: true };
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

  // --- Personal notification history ---------------------------------------
  // Delay/cancel alerts, order-ready and show reminders, logged by
  // PushService.sendToUsers regardless of whether the push itself was ever
  // delivered. Broadcast announcements aren't in here — /announcements is
  // their own list.
  @Get('notifications')
  notifications(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.notification.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('notifications/unread-count')
  async unreadCount(@CurrentUser() user: AuthPrincipal) {
    const count = await this.prisma.notification.count({ where: { userId: user.sub, readAt: null } });
    return { count };
  }

  @Post('notifications/read')
  async markNotificationsRead(@CurrentUser() user: AuthPrincipal) {
    await this.prisma.notification.updateMany({ where: { userId: user.sub, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
