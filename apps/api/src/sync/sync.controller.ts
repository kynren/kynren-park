import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators.js';
import { resolveHomeScreen } from '../admin/home-screen.util.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the mobile app needs to work fully offline for a given date.
   * The client persists this and re-fetches with If-None-Match to get a cheap
   * 304 when nothing has changed.
   */
  @Public()
  @Get('bundle')
  async bundle(@Query('date') date: string | undefined, @Req() req: Request, @Res() res: Response) {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr();
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);

    const [attractions, pois, walkEdges, restaurants, shops, ticketTypes, content, announcements, weekly, mapConfig, defaultMap, branding] =
      await Promise.all([
        this.prisma.attraction.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        this.prisma.pointOfInterest.findMany(),
        this.prisma.walkEdge.findMany(),
        this.prisma.restaurant.findMany({
          where: { active: true },
          include: { menuItems: { where: { available: true } } },
        }),
        this.prisma.shop.findMany({
          where: { active: true },
          orderBy: { name: 'asc' },
          include: { items: { where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
        }),
        this.prisma.ticketType.findMany({ where: { onSale: true } }),
        this.prisma.contentPage.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } }),
        this.prisma.announcement.findMany({
          where: { OR: [{ audience: 'ALL' }, { targetDate: start }] },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        // The programme is defined weekly (by day of the week); materialise the
        // sessions for the requested date's weekday below.
        this.prisma.weeklySession.findMany({
          where: { dayOfWeek: new Date(`${day}T00:00:00.000Z`).getUTCDay() },
          orderBy: { start: 'asc' },
          include: { attraction: { select: { id: true, slug: true, name: true, category: true } } },
        }),
        this.prisma.mapConfig.findFirst(),
        this.prisma.parkMap.findFirst({ where: { isDefault: true } }),
        this.prisma.branding.findFirst(),
      ]);

    // Materialise the weekly programme into concrete sessions for this date, so
    // the app keeps its existing (dated) session shape.
    const sessions = weekly.map((w) => ({
      id: `${w.id}:${day}`,
      attractionId: w.attractionId,
      date: start,
      startTime: new Date(`${day}T${w.start}:00.000Z`),
      endTime: new Date(`${day}T${w.end}:00.000Z`),
      status: w.status,
      revisedStart: null as Date | null,
      note: null as string | null,
      attraction: w.attraction,
    }));

    // The live, admin-designed home screen (published default), or null → the
    // app falls back to its built-in home look.
    const home = await resolveHomeScreen(this.prisma);

    // Admin-managed decorative images, keyed by slot for <ManagedImage>.
    const images = Object.fromEntries(
      (await this.prisma.managedImage.findMany()).map((r) => [
        r.key,
        { imageUrl: r.imageUrl, imageUrlDark: r.imageUrlDark, fit: r.fit, position: r.position, fade: r.fade, animation: r.animation },
      ]),
    );

    const payload = {
      date: day,
      generatedAt: new Date().toISOString(),
      attractions,
      pois,
      walkEdges,
      restaurants,
      shops,
      ticketTypes,
      content,
      announcements,
      sessions,
      mapConfig,
      defaultMap,
      branding,
      home,
      images,
    };

    const body = JSON.stringify(payload);
    const etag = `"${createHash('sha1').update(body).digest('hex')}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/json').send(body);
  }
}
