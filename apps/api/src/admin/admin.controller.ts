import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN', 'OPS')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** Rich dashboard analytics for the selected day. */
  @Get('analytics')
  async analytics(@Query('date') date?: string) {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);
    const dayDate = new Date(`${day}T00:00:00.000Z`);

    const [
      sessionStatusGroups,
      orderStatusGroups,
      ticketsScanned,
      favGroups,
      seenGroups,
      ticketTypeGroups,
      bookingsAgg,
      foodAgg,
      announcementsSent,
      attractions,
      ticketTypes,
    ] = await Promise.all([
      this.prisma.showSession.groupBy({
        by: ['status'],
        where: { startTime: { gte: start, lte: end } },
        _count: { status: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.ticket.count({ where: { status: 'USED', usedAt: { gte: start, lte: end } } }),
      this.prisma.favorite.groupBy({ by: ['attractionId'], _count: { attractionId: true } }),
      this.prisma.attractionSeen.groupBy({ by: ['attractionId'], _count: { attractionId: true } }),
      this.prisma.ticket.groupBy({
        by: ['ticketTypeId'],
        where: { booking: { visitDate: dayDate } },
        _count: { ticketTypeId: true },
      }),
      this.prisma.booking.aggregate({ where: { visitDate: dayDate }, _sum: { totalCents: true }, _count: true }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
        _sum: { totalCents: true },
        _count: true,
      }),
      this.prisma.announcement.count({ where: { sentAt: { not: null } } }),
      this.prisma.attraction.findMany({ select: { id: true, name: true, category: true } }),
      this.prisma.ticketType.findMany({ select: { id: true, name: true } }),
    ]);

    const attrName = new Map(attractions.map((a) => [a.id, a.name]));
    const ttName = new Map(ticketTypes.map((t) => [t.id, t.name]));
    const favMap = new Map(favGroups.map((g) => [g.attractionId, g._count.attractionId]));
    const seenMap = new Map(seenGroups.map((g) => [g.attractionId, g._count.attractionId]));

    const statusCount = (groups: { status: string; _count: { status: number } }[]) =>
      Object.fromEntries(groups.map((g) => [g.status, g._count.status]));
    const sessionStatus = statusCount(sessionStatusGroups as never);
    const orderStatus = statusCount(orderStatusGroups as never);

    const popularAttractions = attractions
      .map((a) => ({ name: a.name, category: a.category, favorites: favMap.get(a.id) ?? 0, seen: seenMap.get(a.id) ?? 0 }))
      .sort((a, b) => b.favorites + b.seen - (a.favorites + a.seen));

    const ticketTypeBreakdown = ticketTypeGroups
      .map((g) => ({ name: ttName.get(g.ticketTypeId) ?? 'Unknown', count: g._count.ticketTypeId }))
      .sort((a, b) => b.count - a.count);

    const bookingsRevenueCents = bookingsAgg._sum.totalCents ?? 0;
    const foodRevenueCents = foodAgg._sum.totalCents ?? 0;

    return {
      date: day,
      kpis: {
        sessionsToday: Object.values(sessionStatus).reduce((a, b) => a + b, 0),
        delayed: sessionStatus['DELAYED'] ?? 0,
        cancelled: sessionStatus['CANCELLED'] ?? 0,
        ticketsScanned,
        bookings: bookingsAgg._count,
        ordersToday: foodAgg._count,
        openOrders: (orderStatus['PENDING'] ?? 0) + (orderStatus['PREPARING'] ?? 0) + (orderStatus['READY'] ?? 0),
        bookingsRevenueCents,
        foodRevenueCents,
        totalRevenueCents: bookingsRevenueCents + foodRevenueCents,
        announcementsSent,
      },
      sessionStatus,
      orderStatus,
      popularAttractions,
      ticketTypeBreakdown,
    };
  }
}
