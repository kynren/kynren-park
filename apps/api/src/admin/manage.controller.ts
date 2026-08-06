import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

function slugify(s: string): string {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}
function pick<T extends Record<string, unknown>>(b: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (b[k] !== undefined) out[k] = b[k];
  return out;
}
function dayDate(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestException('date must be YYYY-MM-DD');
  return new Date(`${d}T00:00:00.000Z`);
}
function timeOn(d: string, hhmm: string) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) throw new BadRequestException('time must be HH:MM');
  return new Date(`${d}T${hhmm}:00.000Z`);
}

/**
 * Admin content management: create/edit/remove the entities the mobile app
 * reads from the sync bundle (restaurants, shows, schedule sessions, map POIs).
 * ADMIN and CONTENT staff only.
 */
@ApiTags('admin-manage')
@ApiBearerAuth()
@Roles('ADMIN', 'CONTENT')
@UseGuards(RolesGuard)
@Controller('admin')
export class ManageController {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueSlug(model: 'restaurant' | 'attraction', base: string, ignoreId?: string): Promise<string> {
    const root = slugify(base);
    let slug = root;
    for (let i = 2; i < 50; i++) {
      const existing =
        model === 'restaurant'
          ? await this.prisma.restaurant.findUnique({ where: { slug } })
          : await this.prisma.attraction.findUnique({ where: { slug } });
      if (!existing || existing.id === ignoreId) return slug;
      slug = `${root}-${i}`;
    }
    return `${root}-${Date.now()}`;
  }

  // ---- Restaurants -----------------------------------------------------------
  @Get('restaurants')
  listRestaurants() {
    return this.prisma.restaurant.findMany({
      orderBy: { name: 'asc' },
      include: { poi: true, _count: { select: { menuItems: true } } },
    });
  }

  @Post('restaurants')
  async createRestaurant(@Body() b: any) {
    if (!b?.name) throw new BadRequestException('name is required');
    const slug = await this.uniqueSlug('restaurant', b.slug || b.name);
    return this.prisma.restaurant.create({
      data: {
        slug,
        name: b.name,
        cuisine: b.cuisine ?? null,
        description: b.description ?? null,
        priceRange: b.priceRange ?? 'MODERATE',
        openingHours: b.openingHours ?? null,
        heroImage: b.heroImage ?? null,
        clickCollect: b.clickCollect ?? true,
        active: b.active ?? true,
        poiId: b.poiId || undefined,
      },
    });
  }

  @Patch('restaurants/:id')
  updateRestaurant(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['name', 'cuisine', 'description', 'priceRange', 'openingHours', 'heroImage', 'clickCollect', 'active']);
    if (b.poiId !== undefined) data.poiId = b.poiId || null;
    return this.prisma.restaurant.update({ where: { id }, data });
  }

  @Delete('restaurants/:id')
  async deleteRestaurant(@Param('id') id: string) {
    try {
      await this.prisma.restaurant.delete({ where: { id } });
      return { deleted: true };
    } catch {
      // Existing orders block a hard delete — deactivate so it disappears from the app.
      await this.prisma.restaurant.update({ where: { id }, data: { active: false } });
      return { deleted: false, deactivated: true };
    }
  }

  // ---- Shows / Attractions ---------------------------------------------------
  @Get('attractions')
  listAttractions() {
    return this.prisma.attraction.findMany({ orderBy: { sortOrder: 'asc' }, include: { poi: true } });
  }

  @Post('attractions')
  async createAttraction(@Body() b: any) {
    if (!b?.name) throw new BadRequestException('name is required');
    const slug = await this.uniqueSlug('attraction', b.slug || b.name);
    return this.prisma.attraction.create({
      data: {
        slug,
        name: b.name,
        category: b.category ?? 'OTHER',
        tagline: b.tagline ?? null,
        synopsis: b.synopsis ?? '',
        durationMins: Number(b.durationMins ?? 30),
        heroImage: b.heroImage ?? null,
        wheelchairAccessible: b.wheelchairAccessible ?? true,
        hasAudioDescription: b.hasAudioDescription ?? false,
        hasCaptioning: b.hasCaptioning ?? false,
        hasBSL: b.hasBSL ?? false,
        sensoryNotes: b.sensoryNotes ?? null,
        sortOrder: Number(b.sortOrder ?? 0),
        active: b.active ?? true,
        poiId: b.poiId || undefined,
      },
    });
  }

  @Patch('attractions/:id')
  updateAttraction(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, [
      'name', 'category', 'tagline', 'synopsis', 'heroImage', 'wheelchairAccessible',
      'hasAudioDescription', 'hasCaptioning', 'hasBSL', 'sensoryNotes', 'active',
    ]);
    if (b.durationMins !== undefined) data.durationMins = Number(b.durationMins);
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
    if (b.poiId !== undefined) data.poiId = b.poiId || null;
    return this.prisma.attraction.update({ where: { id }, data });
  }

  @Delete('attractions/:id')
  async deleteAttraction(@Param('id') id: string) {
    try {
      await this.prisma.attraction.delete({ where: { id } });
      return { deleted: true };
    } catch {
      await this.prisma.attraction.update({ where: { id }, data: { active: false } });
      return { deleted: false, deactivated: true };
    }
  }

  // ---- Program schedule (sessions) ------------------------------------------
  @Get('sessions')
  listSessions() {
    return this.prisma.showSession.findMany({
      orderBy: { startTime: 'asc' },
      include: { attraction: { select: { id: true, name: true, category: true } } },
    });
  }

  @Post('sessions')
  createSession(@Body() b: any) {
    if (!b?.attractionId || !b?.date || !b?.start || !b?.end) {
      throw new BadRequestException('attractionId, date, start and end are required');
    }
    return this.prisma.showSession.create({
      data: {
        attractionId: b.attractionId,
        date: dayDate(b.date),
        startTime: timeOn(b.date, b.start),
        endTime: timeOn(b.date, b.end),
        status: b.status ?? 'SCHEDULED',
        capacity: b.capacity != null ? Number(b.capacity) : null,
      },
    });
  }

  @Patch('sessions/:id')
  async updateSession(@Param('id') id: string, @Body() b: any) {
    const data: Record<string, unknown> = {};
    const existing = await this.prisma.showSession.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('session not found');
    const d = b.date ?? existing.date.toISOString().slice(0, 10);
    if (b.date) data.date = dayDate(b.date);
    if (b.start) data.startTime = timeOn(d, b.start);
    if (b.end) data.endTime = timeOn(d, b.end);
    if (b.status) data.status = b.status;
    if (b.capacity !== undefined) data.capacity = b.capacity != null ? Number(b.capacity) : null;
    return this.prisma.showSession.update({ where: { id }, data });
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    await this.prisma.showSession.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- Map POIs / hotspots ---------------------------------------------------
  @Get('pois')
  listPois() {
    return this.prisma.pointOfInterest.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('pois')
  createPoi(@Body() b: any) {
    if (!b?.name || b?.lat == null || b?.lng == null) {
      throw new BadRequestException('name, lat and lng are required');
    }
    return this.prisma.pointOfInterest.create({
      data: {
        type: b.type ?? 'INFO',
        name: b.name,
        description: b.description ?? null,
        lat: Number(b.lat),
        lng: Number(b.lng),
        mapZone: b.mapZone ?? null,
        icon: b.icon ?? null,
        color: b.color ?? null,
      },
    });
  }

  @Patch('pois/:id')
  updatePoi(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['type', 'name', 'description', 'mapZone', 'icon', 'color']);
    if (b.lat !== undefined) data.lat = Number(b.lat);
    if (b.lng !== undefined) data.lng = Number(b.lng);
    return this.prisma.pointOfInterest.update({ where: { id }, data });
  }

  @Delete('pois/:id')
  async deletePoi(@Param('id') id: string) {
    await this.prisma.pointOfInterest.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- Map configuration (customer marker, bounds, base image) --------------
  @Get('map-config')
  async getMapConfig() {
    const existing = await this.prisma.mapConfig.findFirst();
    if (existing) return existing;
    return this.prisma.mapConfig.create({ data: { singleton: true } });
  }

  @Patch('map-config')
  async updateMapConfig(@Body() b: any) {
    const existing = await this.prisma.mapConfig.findFirst();
    const data = pick(b, ['markerColor', 'markerStyle', 'mapImageUrl']);
    for (const k of ['minLat', 'maxLat', 'minLng', 'maxLng']) if (b[k] !== undefined) data[k] = b[k] === null ? null : Number(b[k]);
    if (existing) return this.prisma.mapConfig.update({ where: { id: existing.id }, data });
    return this.prisma.mapConfig.create({ data: { singleton: true, ...data } });
  }

  // ---- Push notification templates ------------------------------------------
  @Get('notification-templates')
  listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Post('notification-templates')
  createTemplate(@Body() b: any) {
    if (!b?.name || !b?.title || !b?.body) throw new BadRequestException('name, title and body are required');
    return this.prisma.notificationTemplate.create({
      data: {
        name: b.name, action: b.action ?? 'CUSTOM', title: b.title, body: b.body,
        deepLink: b.deepLink ?? null, sound: b.sound ?? true, active: b.active ?? true,
      },
    });
  }

  @Patch('notification-templates/:id')
  updateTemplate(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['name', 'action', 'title', 'body', 'deepLink', 'sound', 'active']);
    return this.prisma.notificationTemplate.update({ where: { id }, data });
  }

  @Delete('notification-templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    await this.prisma.notificationTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- System console: app users -------------------------------------------
  @Get('users')
  async listUsers() {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const [users, todayBookings] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true, email: true, name: true, locale: true, createdAt: true,
          _count: { select: { pushTokens: true, bookings: true, orders: true } },
        },
      }),
      this.prisma.booking.findMany({ where: { visitDate: today }, select: { userId: true } }),
    ]);
    const inPark = new Set(todayBookings.map((b) => b.userId));
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      locale: u.locale,
      createdAt: u.createdAt,
      installed: u._count.pushTokens > 0,
      devices: u._count.pushTokens,
      bookings: u._count.bookings,
      orders: u._count.orders,
      inPark: inPark.has(u.id),
    }));
  }

  // ---- System console: database stats --------------------------------------
  @Get('db-stats')
  async dbStats() {
    const [users, staff, attractions, sessions, restaurants, menuItems, orders, bookings, tickets, pois, announcements, pushTokens] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.staffUser.count(),
        this.prisma.attraction.count(),
        this.prisma.showSession.count(),
        this.prisma.restaurant.count(),
        this.prisma.menuItem.count(),
        this.prisma.order.count(),
        this.prisma.booking.count(),
        this.prisma.ticket.count(),
        this.prisma.pointOfInterest.count(),
        this.prisma.announcement.count(),
        this.prisma.pushToken.count(),
      ]);
    return {
      generatedAt: new Date().toISOString(),
      tables: [
        { name: 'Users', rows: users }, { name: 'Staff', rows: staff },
        { name: 'Attractions', rows: attractions }, { name: 'Sessions', rows: sessions },
        { name: 'Restaurants', rows: restaurants }, { name: 'Menu items', rows: menuItems },
        { name: 'Orders', rows: orders }, { name: 'Bookings', rows: bookings },
        { name: 'Tickets', rows: tickets }, { name: 'Map POIs', rows: pois },
        { name: 'Announcements', rows: announcements }, { name: 'Push tokens', rows: pushTokens },
      ],
    };
  }
}
