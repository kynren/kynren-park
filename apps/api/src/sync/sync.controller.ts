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

    const [attractions, pois, walkEdges, restaurants, ticketTypes, content, announcements, sessions, mapConfig, defaultMap, branding] =
      await Promise.all([
        this.prisma.attraction.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        this.prisma.pointOfInterest.findMany(),
        this.prisma.walkEdge.findMany(),
        this.prisma.restaurant.findMany({
          where: { active: true },
          include: { menuItems: { where: { available: true } } },
        }),
        this.prisma.ticketType.findMany({ where: { onSale: true } }),
        this.prisma.contentPage.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } }),
        this.prisma.announcement.findMany({
          where: { OR: [{ audience: 'ALL' }, { targetDate: start }] },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.showSession.findMany({
          where: { startTime: { gte: start, lte: end } },
          orderBy: { startTime: 'asc' },
          include: { attraction: { select: { id: true, slug: true, name: true, category: true } } },
        }),
        this.prisma.mapConfig.findFirst(),
        this.prisma.parkMap.findFirst({ where: { isDefault: true } }),
        this.prisma.branding.findFirst(),
      ]);

    // The live, admin-designed home screen (published default), or null → the
    // app falls back to its built-in home look.
    const home = await resolveHomeScreen(this.prisma);

    const payload = {
      date: day,
      generatedAt: new Date().toISOString(),
      attractions,
      pois,
      walkEdges,
      restaurants,
      ticketTypes,
      content,
      announcements,
      sessions,
      mapConfig,
      defaultMap,
      branding,
      home,
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
