import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * A guest's stored position is wiped once it is older than a visit, against a real Postgres.
 *
 * Skipped unless LOCATION_TEST_DATABASE_URL points at a DISPOSABLE database with the migrations applied (see
 * smeetz-mirror.db.test.ts for the recipe), e.g.
 *   LOCATION_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:56433/park npm test
 */
const url = process.env.LOCATION_TEST_DATABASE_URL ?? '';
const skip = url ? false : 'no LOCATION_TEST_DATABASE_URL (needs a disposable database)';

let prisma: any;
let service: any;
let keepHours: number;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const mod = await import('../dist/users/location-retention.service.js');
  prisma = new PrismaService();
  await prisma.$connect();
  service = new mod.LocationRetentionService(prisma);
  keepHours = mod.LOCATION_KEEP_HOURS;
});
after(async () => {
  if (!skip) await prisma.$disconnect();
});
beforeEach(async () => {
  if (!skip) await prisma.user.deleteMany({});
});

const NOW = new Date('2026-11-04T15:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const guest = (id: string, data: Record<string, unknown> = {}) => prisma.user.create({ data: { id, email: `${id}@example.com`, name: id, ...data } });

test('a position older than the retention period is cleared, with the time it was seen', { skip }, async () => {
  await guest('stale', { lastLat: 54.6715, lastLng: -1.679, lastSeenAt: hoursAgo(keepHours + 1) });
  assert.equal(await service.sweep(NOW), 1);
  const u = await prisma.user.findUnique({ where: { id: 'stale' } });
  assert.equal(u.lastLat, null);
  assert.equal(u.lastLng, null);
  assert.equal(u.lastSeenAt, null);
});

test('a recent position is left alone, so the live "here now" view still works', { skip }, async () => {
  await guest('here', { lastLat: 54.6715, lastLng: -1.679, lastSeenAt: hoursAgo(0.5) });
  await guest('earlier', { lastLat: 54.67, lastLng: -1.68, lastSeenAt: hoursAgo(keepHours - 1) });
  assert.equal(await service.sweep(NOW), 0);
  const u = await prisma.user.findMany({ where: { id: { in: ['here', 'earlier'] } }, orderBy: { id: 'asc' } });
  assert.deepEqual(u.map((x: any) => x.lastLat), [54.67, 54.6715]);
});

test('coordinates with no time to age them by are cleared, and guests with no position are untouched', { skip }, async () => {
  await guest('untimed', { lastLat: 54.6715, lastLng: -1.679 });
  await guest('never', {});
  assert.equal(await service.sweep(NOW), 1);
  const u = await prisma.user.findUnique({ where: { id: 'untimed' } });
  assert.equal(u.lastLat, null);
  assert.equal((await prisma.user.findUnique({ where: { id: 'never' } })).name, 'never', 'nothing else about the guest is touched');
});

test('only the position goes: the guest and their details stay', { skip }, async () => {
  await guest('keeps', { lastLat: 54.6715, lastLng: -1.679, lastSeenAt: hoursAgo(48), locale: 'fr-FR' });
  await service.sweep(NOW);
  const u = await prisma.user.findUnique({ where: { id: 'keeps' } });
  assert.equal(u.email, 'keeps@example.com');
  assert.equal(u.locale, 'fr-FR');
});
