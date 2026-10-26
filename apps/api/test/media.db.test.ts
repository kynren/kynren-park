import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Hosted pictures against a real Postgres: storing a file once, what the public file address answers, staff uploads being
 * swapped for URLs as they are saved, and the one-off move of pictures already in the database.
 *
 * Skipped unless MIRROR_TEST_DATABASE_URL points at a DISPOSABLE database with the migrations applied (see smeetz-mirror.db.test.ts).
 */
const url = process.env.MIRROR_TEST_DATABASE_URL ?? '';
const skip = url ? false : 'no MIRROR_TEST_DATABASE_URL (needs a disposable database)';

let prisma: any, service: any, controller: any, interceptor: any, backfillMedia: any, mediaId: any;

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const MP4 = Buffer.alloc(1000, 7);
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;
const BASE = 'https://park.test';

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  const db = await import('@kynren/db');
  prisma = new db.PrismaClient({ adapter: db.createAdapter() });
  service = new (await import('../dist/media/media.service.js')).MediaService(prisma);
  controller = new (await import('../dist/media/media.controller.js')).MediaController(prisma);
  interceptor = new (await import('../dist/media/media.interceptor.js')).HostUploadedMedia(service);
  ({ backfillMedia } = await import('../dist/media/backfill.js'));
  ({ mediaId } = await import('../dist/media/media.logic.js'));
});
after(async () => {
  if (prisma) await prisma.$disconnect();
});
beforeEach(async () => {
  if (skip) return;
  await prisma.mediaFile.deleteMany();
  await prisma.parkMap.deleteMany();
  await prisma.pointOfInterest.deleteMany();
  await prisma.homeScreen.deleteMany();
});

const fakeRes = () => {
  const r: any = { headers: {} as Record<string, string>, status: 200, body: undefined };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (n: number) => ((r.code = n), r);
  r.end = (b?: Buffer) => ((r.body = b), r);
  return r;
};
const get = (id: string, headers: Record<string, string> = {}) => {
  const res = fakeRes();
  return controller.file(id, { headers }, res).then(() => res, (e: any) => ({ error: e }));
};

test('a file is stored once, however often it is sent', { skip }, async () => {
  const a = await service.store({ mime: 'image/png', bytes: PNG });
  const b = await service.store({ mime: 'image/png', bytes: Buffer.from(PNG) });
  assert.equal(a, b);
  assert.equal(a, mediaId(PNG));
  assert.equal(await prisma.mediaFile.count(), 1);
});

test('the public address serves the file with permanent caching, and answers a repeat visit without a lookup', { skip }, async () => {
  const id = await service.store({ mime: 'image/png', bytes: PNG });
  const res = await get(id);
  assert.equal(res.code, undefined, 'a plain 200');
  assert.deepEqual(res.body, PNG);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.match(res.headers['Cache-Control'], /immutable/);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
  assert.match(res.headers['Content-Security-Policy'], /sandbox/);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');

  await prisma.mediaFile.deleteMany(); // gone from the table, yet the cached copy is still confirmed: the id is the hash of the bytes
  assert.equal((await get(id, { 'if-none-match': `"${id}"` })).code, 304);
});

test('an unknown or malformed address is a plain not-found, never a crash or a path', { skip }, async () => {
  assert.equal((await get('f'.repeat(64))).error?.getStatus?.(), 404);
  assert.equal((await get('../../etc/passwd')).error?.getStatus?.(), 404);
});

test('a player can ask for part of a clip', { skip }, async () => {
  const id = await service.store({ mime: 'video/mp4', bytes: MP4 });
  const part = await get(id, { range: 'bytes=100-199' });
  assert.equal(part.code, 206);
  assert.equal(part.headers['Content-Range'], 'bytes 100-199/1000');
  assert.equal(part.body.length, 100);
  const tail = await get(id, { range: 'bytes=900-' });
  assert.equal(tail.headers['Content-Range'], 'bytes 900-999/1000');
});

test('what staff save has its pictures swapped for URLs; a guest\'s request is left alone', { skip }, async () => {
  const run = async (user: unknown, body: any) => {
    const req: any = { method: 'PATCH', user, body, protocol: 'https', get: () => 'park.test' };
    const context: any = { switchToHttp: () => ({ getRequest: () => req }) };
    await interceptor.intercept(context, { handle: () => ({}) });
    return req.body;
  };
  const body = { name: 'Map', imageUrl: dataUrl('image/png', PNG), images: [dataUrl('image/png', PNG), 'https://elsewhere/x.png'] };
  const staff = await run({ type: 'staff', sub: 's1' }, structuredClone(body));
  assert.equal(staff.imageUrl, `${BASE}/api/media/${mediaId(PNG)}`);
  assert.equal(staff.images[0], staff.imageUrl);
  assert.equal(staff.images[1], 'https://elsewhere/x.png');
  assert.equal(await prisma.mediaFile.count(), 1, 'the same picture twice is one file');

  const guest = await run({ type: 'user', sub: 'u1' }, structuredClone(body));
  assert.equal(guest.imageUrl, body.imageUrl, 'not a staff request: untouched');
  const none = await run(undefined, structuredClone(body));
  assert.equal(none.imageUrl, body.imageUrl);
});

test('pictures already in the database move out to hosted files: text, list and JSON columns, dry run first', { skip }, async () => {
  const pic = dataUrl('image/png', PNG);
  const map = await prisma.parkMap.create({ data: { name: 'Park map', imageUrl: pic } });
  const poi = await prisma.pointOfInterest.create({ data: { type: 'INFO', name: 'Info', lat: 54.67, lng: -1.68, image: pic, images: [pic, 'https://elsewhere/x.png'] } });
  const home = await prisma.homeScreen.create({ data: { name: 'Home', heroType: 'image', heroMediaUrl: dataUrl('image/png', Buffer.concat([PNG, Buffer.from([1])])), sections: [{ key: 'hero', extra: { pic } }] } });
  const plain = await prisma.pointOfInterest.create({ data: { type: 'INFO', name: 'data: is just how this one starts', lat: 54.67, lng: -1.68 } });

  const dry = await backfillMedia(prisma, { apply: false, base: BASE });
  assert.ok(dry.length >= 3);
  assert.equal(await prisma.mediaFile.count(), 0, 'a dry run stores nothing');
  assert.equal((await prisma.parkMap.findUnique({ where: { id: map.id } })).imageUrl, pic, 'and changes nothing');

  await backfillMedia(prisma, { apply: true, base: BASE });
  const link = `${BASE}/api/media/${mediaId(PNG)}`;
  assert.equal((await prisma.parkMap.findUnique({ where: { id: map.id } })).imageUrl, link);
  const p = await prisma.pointOfInterest.findUnique({ where: { id: poi.id } });
  assert.equal(p.image, link);
  assert.deepEqual(p.images, [link, 'https://elsewhere/x.png']);
  const h = await prisma.homeScreen.findUnique({ where: { id: home.id } });
  assert.match(h.heroMediaUrl, /\/api\/media\/[a-f0-9]{64}$/);
  assert.deepEqual(h.sections, [{ key: 'hero', extra: { pic: link } }]);
  assert.equal((await prisma.pointOfInterest.findUnique({ where: { id: plain.id } })).name, 'data: is just how this one starts', 'ordinary text is never touched');
  assert.equal(await prisma.mediaFile.count(), 2, 'two different pictures, however many places used them');

  const again = await backfillMedia(prisma, { apply: true, base: BASE });
  assert.equal(again.length, 0, 'a second run finds nothing left to move');
});
