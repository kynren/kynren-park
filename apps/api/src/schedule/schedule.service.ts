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

// The UK's current calendar date. Session/show times are stored as the
// admin's UK wall-clock digits with a UTC label (not real UTC — see the
// mobile app's lib/format.ts for the full rationale), so "today" has to be
// derived the same way: a plain `new Date().toISOString()` is true UTC and
// runs an hour behind the UK for the entire show season (BST, opens 18
// July), which would silently misfire the "is this today's session" check
// below right when it matters most.
function ukTodayStr(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  async byDate(dateStr: string) {
    const { start } = dayRange(dateStr);
    const dayOfWeek = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
    // The programme is defined weekly (by day of the week); materialise it into
    // concrete sessions for this date. A real ShowSession row only exists once
    // staff have actually changed something for this specific date (a delay,
    // cancellation, retime, or a genuine one-off extra show) — see
    // resolveOrCreateSession below — so merge any such overrides in, matched
    // to their weekly slot by (attractionId, startTime), and fall back to the
    // synthetic `${weeklySessionId}:${date}` id for slots nobody has touched.
    const [weekly, overrides] = await Promise.all([
      this.prisma.weeklySession.findMany({
        where: { dayOfWeek },
        orderBy: { start: 'asc' },
        include: { attraction: { select: { id: true, slug: true, name: true, category: true } } },
      }),
      this.prisma.showSession.findMany({
        where: { date: start },
        include: { attraction: { select: { id: true, slug: true, name: true, category: true } } },
      }),
    ]);
    const overrideByKey = new Map(overrides.map((o) => [`${o.attractionId}:${o.startTime.toISOString()}`, o]));
    const usedOverrideIds = new Set<string>();
    const merged = weekly.map((w) => {
      const startTime = new Date(`${dateStr}T${w.start}:00.000Z`);
      const o = overrideByKey.get(`${w.attractionId}:${startTime.toISOString()}`);
      if (o) { usedOverrideIds.add(o.id); return o; }
      return {
        id: `${w.id}:${dateStr}`,
        attractionId: w.attractionId,
        date: start,
        startTime,
        endTime: new Date(`${dateStr}T${w.end}:00.000Z`),
        status: w.status,
        revisedStart: null as Date | null,
        note: null as string | null,
        attraction: w.attraction,
      };
    });
    // A one-off show added for just this date won't match any weekly slot —
    // it still needs to appear.
    for (const o of overrides) if (!usedOverrideIds.has(o.id)) merged.push(o);
    return merged;
  }

  /**
   * Every consumer that changes a session's live state (delay/cancel/retime)
   * is handed either a real ShowSession id, or — for a slot nobody has ever
   * overridden yet — the synthetic `${weeklySessionId}:${date}` id byDate()
   * returns for it. Resolve to a real, persisted row either way, creating one
   * from the weekly template on first touch.
   *
   * Idempotent by design, not just by convenience: a client that already
   * holds the synthetic id (e.g. the Live Schedule Board's in-memory session
   * list, which keeps its original id after an optimistic update rather than
   * swapping in the real one the PATCH response returns) can call this again
   * with the same stale synthetic id for a second action on the same show —
   * re-deriving and re-checking the slot by (attractionId, startTime) instead
   * of blindly creating means that lands on the same row instead of a
   * duplicate.
   */
  async resolveOrCreateSession(id: string) {
    const existing = await this.prisma.showSession.findUnique({ where: { id }, include: { attraction: true } });
    if (existing) return existing;
    const sep = id.lastIndexOf(':');
    if (sep === -1) throw new NotFoundException('Session not found');
    const weeklyId = id.slice(0, sep);
    const dateStr = id.slice(sep + 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new NotFoundException('Session not found');
    const weekly = await this.prisma.weeklySession.findUnique({ where: { id: weeklyId } });
    if (!weekly) throw new NotFoundException('Session not found');
    const startTime = new Date(`${dateStr}T${weekly.start}:00.000Z`);
    const already = await this.prisma.showSession.findFirst({
      where: { attractionId: weekly.attractionId, startTime },
      include: { attraction: true },
    });
    if (already) return already;
    return this.prisma.showSession.create({
      data: {
        attractionId: weekly.attractionId,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        startTime,
        endTime: new Date(`${dateStr}T${weekly.end}:00.000Z`),
        status: weekly.status,
      },
      include: { attraction: true },
    });
  }

  /** Same resolution as resolveOrCreateSession, but for delete: never create
   *  a row just to immediately remove it — a slot nobody has overridden yet
   *  has nothing to delete. */
  async findRealSessionIfAny(id: string) {
    const existing = await this.prisma.showSession.findUnique({ where: { id } });
    if (existing) return existing;
    return null;
  }

  async updateStatus(id: string, input: UpdateSessionStatusInput) {
    const session = await this.resolveOrCreateSession(id);

    const updated = await this.prisma.showSession.update({
      where: { id: session.id },
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

    // 2) Push to guests who have this session in their itinerary, plus
    // anyone who's favourited the attraction and hasn't itineraried it —
    // but only for a change happening today: a favourite has no date
    // attached (unlike an itinerary item), so without this a delay to a
    // showing three weeks out would page every guest who ever starred the
    // attraction, regardless of whether they're even visiting that day.
    if (input.status === 'DELAYED' || input.status === 'CANCELLED') {
      const items = await this.prisma.itineraryItem.findMany({
        where: { showSessionId: session.id },
        include: { itinerary: { select: { userId: true } } },
      });
      const userIds = new Set(items.map((i) => i.itinerary.userId));
      if (dateStr === ukTodayStr()) {
        const favourites = await this.prisma.favorite.findMany({
          where: { attractionId: session.attractionId },
          select: { userId: true },
        });
        for (const f of favourites) userIds.add(f.userId);
      }
      const verb = input.status === 'CANCELLED' ? 'has been cancelled' : 'is delayed';
      const time = updated.revisedStart ? updated.revisedStart.toISOString().slice(11, 16) : '';
      await this.push.sendTemplatedToUsers(
        [...userIds],
        'DELAY_ALERT',
        { title: `${session.attraction.name} ${verb}`, body: input.note || `Tap to see your updated plan for the day.` },
        { show: session.attraction.name, status: input.status, time, note: input.note ?? '' },
        { type: 'session', sessionId: session.id },
      );
    }

    return updated;
  }
}
