import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeItinerary, type CandidateSession } from '@kynren/shared';

const D = '2026-07-18';
const t = (hhmm: string) => new Date(`${D}T${hhmm}:00.000Z`);

function session(id: string, name: string, poi: string, start: string, end: string): CandidateSession {
  return {
    showSessionId: id,
    attractionId: name,
    attractionName: name,
    category: 'OTHER',
    poiId: poi,
    start: t(start),
    end: t(end),
  };
}

// No walking cost between POIs for the basic overlap tests.
const noWalk = () => 0;

test('schedules non-overlapping sessions, earliest finish first', () => {
  const sessions = [
    session('a1', 'Birds', 'p1', '11:00', '11:25'),
    session('b1', 'Vikings', 'p2', '11:20', '11:45'), // overlaps Birds
    session('b2', 'Vikings', 'p2', '12:00', '12:25'), // fits after Birds
  ];
  const plan = optimizeItinerary(sessions, noWalk, {
    date: D,
    arrival: t('10:30'),
    departure: t('18:00'),
    attractionIds: [],
  });
  assert.equal(plan.stops.length, 2);
  assert.deepEqual(plan.stops.map((s) => s.attractionName), ['Birds', 'Vikings']);
  assert.equal(plan.unschedulable.length, 0);
});

test('respects walking time between locations', () => {
  const sessions = [
    session('a1', 'Birds', 'p1', '11:00', '11:25'),
    session('c1', 'Lake', 'p2', '11:26', '11:50'), // only 1 min gap
  ];
  // 10 minutes to walk p1 -> p2, so the 11:26 Lake show is unreachable.
  const walk = (from: string | null, to: string | null) => (from && to && from !== to ? 600 : 0);
  const plan = optimizeItinerary(sessions, walk, {
    date: D,
    arrival: t('10:30'),
    departure: t('18:00'),
    attractionIds: [],
  });
  assert.equal(plan.stops.length, 1);
  assert.equal(plan.stops[0]!.attractionName, 'Birds');
  assert.deepEqual(plan.unschedulable, ['Lake']);
});

test('honours the arrival/departure window', () => {
  const sessions = [session('e1', 'Evening', 'p9', '21:30', '23:00')];
  const plan = optimizeItinerary(sessions, noWalk, {
    date: D,
    arrival: t('10:30'),
    departure: t('18:00'), // evening show falls outside the window
    attractionIds: [],
  });
  assert.equal(plan.stops.length, 0);
});
