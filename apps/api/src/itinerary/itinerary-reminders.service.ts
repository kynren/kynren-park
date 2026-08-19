import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../notifications/push.service.js';

// Show/session times (including revisedStart) are stored as the admin's UK
// wall-clock digits wearing a UTC label, not real UTC — see
// apps/mobile/lib/format.ts and schedule.service.ts's ukTodayStr() for the
// full rationale. "Now" has to be computed the same way so a plain epoch
// subtraction against a session's startTime yields real UK minutes-until-start.
function ukNow(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000Z`);
}
function ukTodayStr(): string {
  return ukNow().toISOString().slice(0, 10);
}

const TICK_MS = 60_000;
// If a due reminder was somehow missed (a deploy, a downed pod) don't fire a
// "starting soon" push for a show that's already well underway — mark it
// sent and move on rather than paging the guest about something half over.
const GRACE_MINUTES_PAST_START = 10;

/**
 * Fires the "Vikings starts in 20 minutes" push for each saved itinerary
 * item, per ItineraryItem.reminderMins. Follows the same OnModuleInit
 * setInterval pattern as StatusService — deliberately no new cron/queue
 * dependency for a single once-a-minute sweep.
 */
@Injectable()
export class ItineraryRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ItineraryRemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.error(e)), TICK_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const today = new Date(`${ukTodayStr()}T00:00:00.000Z`);
    const now = ukNow();

    const items = await this.prisma.itineraryItem.findMany({
      where: { reminderSentAt: null, showSession: { date: today } },
      include: {
        itinerary: { select: { userId: true } },
        showSession: { include: { attraction: { select: { name: true, slug: true } } } },
      },
    });
    if (items.length === 0) return;

    const due = items.filter((it) => {
      const start = it.showSession.revisedStart ?? it.showSession.startTime;
      const minsUntil = (start.getTime() - now.getTime()) / 60_000;
      return minsUntil <= it.reminderMins && minsUntil >= -GRACE_MINUTES_PAST_START;
    });
    if (due.length === 0) return;

    for (const it of due) {
      // Still mark cancelled shows as handled below — just skip sending a
      // "starting soon" push for a show the guest already knows is off.
      if (it.showSession.status === 'CANCELLED') continue;
      const start = it.showSession.revisedStart ?? it.showSession.startTime;
      const time = start.toISOString().slice(11, 16);
      await this.push.sendTemplatedToUsers(
        [it.itinerary.userId],
        'SHOW_REMINDER',
        {
          title: `${it.showSession.attraction.name} starts soon`,
          body: `Starting at ${time} — ${it.reminderMins} min to get there.`,
          deepLink: `/attraction/${it.showSession.attraction.slug}`,
        },
        { show: it.showSession.attraction.name, time },
        { type: 'reminder', showSessionId: it.showSessionId },
      ).catch((e) => this.logger.error(`Reminder push failed for item ${it.id}: ${(e as Error).message}`));
    }

    await this.prisma.itineraryItem.updateMany({
      where: { id: { in: due.map((it) => it.id) } },
      data: { reminderSentAt: new Date() },
    });
  }
}
