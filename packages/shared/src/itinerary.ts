import type { OptimizedItinerary, PlannedStop } from './dto.js';

export interface CandidateSession {
  showSessionId: string;
  attractionId: string;
  attractionName: string;
  category: PlannedStop['category'];
  poiId: string | null;
  start: Date;
  end: Date;
}

/** Walking time between two POIs in seconds; falls back to a default. */
export type WalkLookup = (fromPoiId: string | null, toPoiId: string | null) => number;

const DEFAULT_WALK_SECONDS = 5 * 60;

export interface OptimizeOptions {
  date: string;
  arrival: Date;
  departure: Date;
  /** Only these attraction ids are considered (empty = all). */
  attractionIds: string[];
  reminderMins?: number;
}

/**
 * Greedy interval scheduling with walking constraints.
 *
 * For each wanted attraction we pick the session that finishes earliest while
 * (a) starting after we could realistically walk there from the previous stop
 * and (b) fitting inside the arrival→departure window. Finishing earliest first
 * is the classic optimal strategy for maximising the number of non-overlapping
 * activities, extended here to respect walk times between show locations.
 */
export function optimizeItinerary(
  sessions: CandidateSession[],
  walk: WalkLookup,
  opts: OptimizeOptions,
): OptimizedItinerary {
  const wanted = new Set(opts.attractionIds);
  const reminderMins = opts.reminderMins ?? 20;

  // One attraction may have several sessions; keep only wanted attractions.
  const pool = sessions
    .filter((s) => (wanted.size === 0 ? true : wanted.has(s.attractionId)))
    .filter((s) => s.start >= opts.arrival && s.end <= opts.departure)
    .sort((a, b) => a.end.getTime() - b.end.getTime());

  const stops: PlannedStop[] = [];
  const scheduledAttractions = new Set<string>();
  let cursorTime = opts.arrival;
  let cursorPoi: string | null = null;

  for (const s of pool) {
    if (scheduledAttractions.has(s.attractionId)) continue;
    const walkSeconds = walk(cursorPoi, s.poiId);
    const earliestArrive = new Date(cursorTime.getTime() + walkSeconds * 1000);
    if (s.start < earliestArrive) continue; // can't make it in time

    stops.push({
      showSessionId: s.showSessionId,
      attractionId: s.attractionId,
      attractionName: s.attractionName,
      category: s.category,
      startTime: s.start.toISOString(),
      endTime: s.end.toISOString(),
      walkSecondsFromPrev: cursorPoi === null ? 0 : walkSeconds,
      reminderMins,
    });
    scheduledAttractions.add(s.attractionId);
    cursorTime = s.end;
    cursorPoi = s.poiId;
  }

  const requested =
    wanted.size === 0
      ? new Set(sessions.map((s) => s.attractionId))
      : wanted;
  const unschedulable = [...requested]
    .filter((id) => !scheduledAttractions.has(id))
    .map((id) => sessions.find((s) => s.attractionId === id)?.attractionName ?? id);

  return { date: opts.date, stops, unschedulable };
}

export { DEFAULT_WALK_SECONDS };
