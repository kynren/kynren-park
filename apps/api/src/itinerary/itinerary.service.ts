import { Injectable } from '@nestjs/common';
import { optimizeItinerary, DEFAULT_WALK_SECONDS } from '@kynren/shared';
import type { OptimizeItineraryInput, CandidateSession } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleService } from '../schedule/schedule.service.js';

@Injectable()
export class ItineraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
  ) {}

  async optimize(input: OptimizeItineraryInput) {
    // Sourced from ScheduleService.byDate(), not a direct ShowSession query:
    // most of a day's programme only exists as a weekly-template
    // materialisation with a synthetic id until staff touch it (see
    // schedule.service.ts's resolveOrCreateSession) — a raw showSession
    // query here would make every untouched slot invisible to the planner.
    const [sessions, walkEdges] = await Promise.all([
      this.schedule.byDate(input.date),
      this.prisma.walkEdge.findMany(),
    ]);

    const walkMap = new Map<string, number>();
    for (const e of walkEdges) walkMap.set(`${e.fromPoiId}->${e.toPoiId}`, e.seconds);
    const walk = (from: string | null, to: string | null) =>
      from && to ? walkMap.get(`${from}->${to}`) ?? DEFAULT_WALK_SECONDS : DEFAULT_WALK_SECONDS;

    const candidates: CandidateSession[] = sessions
      .filter((s) => ['SCHEDULED', 'DELAYED', 'FULL'].includes(s.status))
      .filter((s) => (input.includeEveningShow ? true : s.attraction.category !== 'EVENING_SHOW'))
      .map((s) => ({
        showSessionId: s.id,
        attractionId: s.attractionId,
        attractionName: s.attraction.name,
        category: s.attraction.category,
        poiId: s.attraction.poiId ?? null,
        start: s.revisedStart ?? s.startTime,
        end: s.endTime,
      }));

    return optimizeItinerary(candidates, walk, {
      date: input.date,
      arrival: new Date(`${input.date}T${input.arrival}:00.000Z`),
      departure: new Date(`${input.date}T${input.departure}:00.000Z`),
      attractionIds: input.attractionIds,
    });
  }

  async save(userId: string, date: string, showSessionIds: string[]) {
    // optimize()'s candidates can now carry a synthetic `${weeklySessionId}:${date}`
    // id for a slot nobody's touched yet — resolve each to a real, persisted
    // row before writing ItineraryItem, which has a hard FK to ShowSession.
    const resolved = await Promise.all(showSessionIds.map((id) => this.schedule.resolveOrCreateSession(id)));

    const itinerary = await this.prisma.itinerary.upsert({
      where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
      create: { userId, date: new Date(`${date}T00:00:00.000Z`) },
      update: {},
    });
    await this.prisma.itineraryItem.deleteMany({ where: { itineraryId: itinerary.id } });
    await this.prisma.itineraryItem.createMany({
      data: resolved.map((session, i) => ({
        itineraryId: itinerary.id,
        showSessionId: session.id,
        order: i,
      })),
      skipDuplicates: true,
    });
    return this.get(userId, date);
  }

  async get(userId: string, date: string) {
    return this.prisma.itinerary.findUnique({
      where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { showSession: { include: { attraction: true } } },
        },
      },
    });
  }
}
