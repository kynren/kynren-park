import { Injectable } from '@nestjs/common';
import { optimizeItinerary, DEFAULT_WALK_SECONDS } from '@kynren/shared';
import type { OptimizeItineraryInput, CandidateSession } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ItineraryService {
  constructor(private readonly prisma: PrismaService) {}

  async optimize(input: OptimizeItineraryInput) {
    const start = new Date(`${input.date}T00:00:00.000Z`);
    const end = new Date(`${input.date}T23:59:59.999Z`);

    const [sessions, walkEdges] = await Promise.all([
      this.prisma.showSession.findMany({
        where: {
          startTime: { gte: start, lte: end },
          status: { in: ['SCHEDULED', 'DELAYED', 'FULL'] },
        },
        include: { attraction: { include: { poi: true } } },
      }),
      this.prisma.walkEdge.findMany(),
    ]);

    const walkMap = new Map<string, number>();
    for (const e of walkEdges) walkMap.set(`${e.fromPoiId}->${e.toPoiId}`, e.seconds);
    const walk = (from: string | null, to: string | null) =>
      from && to ? walkMap.get(`${from}->${to}`) ?? DEFAULT_WALK_SECONDS : DEFAULT_WALK_SECONDS;

    const candidates: CandidateSession[] = sessions
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
    const itinerary = await this.prisma.itinerary.upsert({
      where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
      create: { userId, date: new Date(`${date}T00:00:00.000Z`) },
      update: {},
    });
    await this.prisma.itineraryItem.deleteMany({ where: { itineraryId: itinerary.id } });
    await this.prisma.itineraryItem.createMany({
      data: showSessionIds.map((showSessionId, i) => ({
        itineraryId: itinerary.id,
        showSessionId,
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
