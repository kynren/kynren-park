import { Injectable, NotFoundException } from '@nestjs/common';
import { REALTIME_EVENTS } from '@kynren/shared';
import type { UpdateSessionStatusInput } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  async byDate(dateStr: string) {
    const { start, end } = dayRange(dateStr);
    return this.prisma.showSession.findMany({
      where: { startTime: { gte: start, lte: end } },
      orderBy: { startTime: 'asc' },
      include: { attraction: { select: { id: true, slug: true, name: true, category: true } } },
    });
  }

  async updateStatus(id: string, input: UpdateSessionStatusInput) {
    const session = await this.prisma.showSession.findUnique({
      where: { id },
      include: { attraction: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const updated = await this.prisma.showSession.update({
      where: { id },
      data: {
        status: input.status,
        revisedStart: input.revisedStart ? new Date(input.revisedStart) : input.status === 'DELAYED' ? session.revisedStart : null,
        note: input.note ?? null,
      },
    });

    const dateStr = session.date.toISOString().slice(0, 10);
    const event = {
      id: updated.id,
      attractionId: updated.attractionId,
      status: updated.status,
      revisedStart: updated.revisedStart?.toISOString() ?? null,
      note: updated.note,
      updatedAt: updated.updatedAt.toISOString(),
    };

    // 1) Realtime fan-out to everyone in the park that day.
    this.realtime.emit(REALTIME_EVENTS.sessionUpdated, event, dateStr);

    // 2) Push to guests who have this session in their itinerary.
    if (input.status === 'DELAYED' || input.status === 'CANCELLED') {
      const items = await this.prisma.itineraryItem.findMany({
        where: { showSessionId: id },
        include: { itinerary: { select: { userId: true } } },
      });
      const userIds = [...new Set(items.map((i) => i.itinerary.userId))];
      const verb = input.status === 'CANCELLED' ? 'has been cancelled' : 'is delayed';
      const time = updated.revisedStart ? updated.revisedStart.toISOString().slice(11, 16) : '';
      await this.push.sendTemplatedToUsers(
        userIds,
        'DELAY_ALERT',
        { title: `${session.attraction.name} ${verb}`, body: input.note || `Tap to see your updated plan for the day.` },
        { show: session.attraction.name, status: input.status, time, note: input.note ?? '' },
        { type: 'session', sessionId: id },
      );
    }

    return updated;
  }
}
