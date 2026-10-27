import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The local copy of Smeetz's orders against a real Postgres: what is stored, how a guest's bookings are found by email, and what
 * the sync and the buyer index do with a scripted stand-in for Smeetz (nothing here can reach Smeetz).
 *
 * Skipped unless MIRROR_TEST_DATABASE_URL points at a DISPOSABLE database with the migrations applied, e.g.
 *   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=park -p 56433:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:56433/park npx prisma migrate deploy   (in packages/db)
 *   MIRROR_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:56433/park npm test
 */
const url = process.env.MIRROR_TEST_DATABASE_URL ?? '';
const skip = url ? false : 'no MIRROR_TEST_DATABASE_URL (needs a disposable database)';

type Fake = { host: string; path: string; query: Record<string, unknown> };
let calls: Fake[];
let script: (c: Fake) => { ok: true; data: unknown } | { ok: false; failure: { kind: string; status?: number; message?: string } };

let prisma: any;
let directory: any;
let sync: any;

const smeetz = {
  configured: true,
  environment: 'test',
  get: async (host: string, path: string, query: Record<string, unknown> = {}) => {
    const c = { host, path, query };
    calls.push(c);
    return script(c);
  },
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const order = (n: number, over: Record<string, unknown> = {}) => ({
  id: uuid(n),
  reference: `REF${n}`,
  status: 'COMPLETED',
  currency: 'GBP',
  customerId: `cust-${n}`,
  createdAt: `2026-10-${String(10 + (n % 10)).padStart(2, '0')}T10:00:00Z`,
  updatedAt: `2026-10-${String(10 + (n % 10)).padStart(2, '0')}T10:00:00Z`,
  items: {
    tickets: [
      {
        optionId: 'opt-1',
        optionName: 'Night Show',
        priceName: 'Adult',
        units: [{ id: `u${n}`, barcode: `BC${n}`, itemStatus: 'VALID', priceValue: 30, availabilityId: 555, guest: { firstName: 'Ann', lastName: 'Guest' } }],
      },
    ],
  },
  orderAdditionalInfo: [{ name: 'Allergies', value: 'secret-answer' }],
  ...over,
});

const detail = (name: string, email: string, extra: Record<string, unknown> = {}) => ({ ok: true as const, data: { data: { customer: { firstName: name.split(' ')[0], lastName: name.split(' ')[1], email, phone: '0123456', address: '1 High St', city: 'Leeds', ...extra } } } });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const { SmeetzOrderDirectory } = await import('../dist/smeetz/order-directory.service.js');
  const { SmeetzOrderSync } = await import('../dist/smeetz/order-sync.service.js');
  prisma = new PrismaService();
  await prisma.$connect();
  directory = new SmeetzOrderDirectory(prisma, smeetz);
  sync = new SmeetzOrderSync(prisma, smeetz, directory);
});

after(async () => {
  if (skip || !prisma) return;
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (skip) return;
  calls = [];
  script = () => ({ ok: false, failure: { kind: 'disabled' } });
  await prisma.smeetzOrderLine.deleteMany();
  await prisma.smeetzOrder.deleteMany();
  await prisma.smeetzBuyer.deleteMany();
  await prisma.smeetzSyncState.deleteMany();
});

test('an order is stored with a line per unit, replaced on a re-read, and the form answers are not kept', { skip }, async () => {
  assert.equal(await sync.upsertOrder(order(1)), true);
  assert.equal(await sync.upsertOrder(order(1, { status: 'CANCELLED' })), true);
  const rows = await prisma.smeetzOrder.findMany({ include: { lines: true } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'CANCELLED');
  assert.equal(rows[0].lines.length, 1, 'lines are replaced, not added to');
  assert.equal(rows[0].lines[0].barcode, 'BC1');
  assert.equal(rows[0].lines[0].guestFirstName, 'Ann');
  assert.equal(JSON.stringify(rows).includes('secret-answer'), false);
  assert.equal(await sync.upsertOrder({ reference: 'no id' }), false);
  assert.equal(await sync.upsertOrder(order(2, { createdAt: 'not a date' })), false);
});

test('an address finds its own orders and the same customer\'s others, never a stranger\'s, and says who the buyer is', { skip }, async () => {
  await sync.upsertOrder(order(1, { customerId: 'c-pat' }));
  await sync.upsertOrder(order(2, { customerId: 'c-pat' })); // a sibling, never read itself
  await sync.upsertOrder(order(3, { customerId: 'c-other' }));
  await directory.rememberBuyer(uuid(1), { name: 'Pat Buyer', email: 'Pat@Example.ORG', phone: '0123456', address: '1 High St, Leeds' });
  await directory.rememberBuyer(uuid(3), { name: 'Other One', email: 'other@example.org' });

  const { orders, buyer } = await directory.lookup('  PAT@example.org ');
  assert.deepEqual(orders.map((o: any) => o.reference).sort(), ['REF1', 'REF2']);
  assert.equal(orders[0].lines[0].tickets[0].holder, 'Ann Guest');
  assert.equal(orders[0].lines[0].tickets[0].barcode.startsWith('BC'), true);
  assert.deepEqual(buyer, { name: 'Pat Buyer', phone: '0123456', address: '1 High St, Leeds' });
  assert.equal(JSON.stringify(orders).includes('other@example.org'), false);

  assert.deepEqual(await directory.lookup('nobody@example.org'), { orders: [], buyer: null });
  assert.deepEqual(await directory.lookup('not an email'), { orders: [], buyer: null });
});

test('the guest\'s address is read from Smeetz once, and "none there" is remembered', { skip }, async () => {
  await sync.upsertOrder(order(1));
  await directory.rememberBuyer(uuid(1), { name: 'Pat Buyer', email: 'pat@example.org' });
  // rememberBuyer stores "" for a read buyer with no address; make this one look like the old, address-less rows
  await prisma.smeetzBuyer.update({ where: { orderId: uuid(1) }, data: { address: null } });

  script = (c) => (c.path === `/v1/order/${uuid(1)}` ? detail('Pat Buyer', 'pat@example.org') : { ok: false, failure: { kind: 'notFound', status: 404 } });
  await directory.fillAddress('pat@example.org');
  await directory.fillAddress('pat@example.org');
  assert.equal(calls.length, 1, 'read once');
  assert.equal((await directory.lookup('pat@example.org')).buyer.address, '1 High St, Leeds');

  await prisma.smeetzBuyer.update({ where: { orderId: uuid(1) }, data: { address: null } });
  script = () => detail('Pat Buyer', 'pat@example.org', { address: null, city: null });
  await directory.fillAddress('pat@example.org');
  assert.equal((await prisma.smeetzBuyer.findUnique({ where: { orderId: uuid(1) } })).address, '');
});

test('the buyer index reads newest first, skips what cannot or need not be read, and keeps what it reads', { skip }, async () => {
  await sync.upsertOrder(order(1, { customerId: 'c-a', createdAt: '2026-10-01T10:00:00Z' }));
  await sync.upsertOrder(order(2, { customerId: 'c-a', createdAt: '2026-10-02T10:00:00Z' })); // same customer as 1: one read serves both
  await sync.upsertOrder(order(3, { customerId: 'c-b', createdAt: '2026-10-03T10:00:00Z' }));
  await sync.upsertOrder(order(4, { customerId: 'c-c', status: 'CANCELLED', createdAt: '2026-10-04T10:00:00Z' }));
  await sync.upsertOrder({ ...order(5, { customerId: 'c-d' }), id: 'ABC123' }); // an old short-code id: not readable
  await sync.upsertOrder(order(6, { customerId: 'c-e', items: { tickets: [] } })); // nothing to bring to the gate
  await sync.upsertOrder(order(7, { customerId: 'c-f', createdAt: '2026-10-07T10:00:00Z' }));
  await directory.rememberBuyer(uuid(7), { name: 'Already Read', email: 'read@example.org' });

  assert.deepEqual((await sync.unreadOrders(10)).map((o: any) => o.id), [uuid(3), uuid(2), uuid(1)], 'newest first, and only readable ones');

  script = (c) => {
    const n = Number(c.path.split('-').pop());
    return detail(`Buyer ${n}`, `buyer${n}@example.org`);
  };
  const pass = await sync.indexBuyers(5_000);
  assert.equal(pass.error, undefined);
  assert.equal(pass.read, 2, 'order 1 and 2 share a customer, so only one of them is read');
  assert.equal(await prisma.smeetzBuyer.count(), 3);
  assert.equal(calls.length, 2);
  assert.equal((await sync.unreadOrders(10)).length, 0, 'the customer\'s other order is served by the read already made');
});

test('Smeetz having no such order is remembered, and Smeetz going quiet ends the pass and pauses', { skip }, async () => {
  for (const n of [1, 2, 3, 4, 5]) await sync.upsertOrder(order(n, { createdAt: `2026-10-0${n}T10:00:00Z` }));

  script = (c) => (c.path.endsWith(uuid(5)) ? { ok: false, failure: { kind: 'notFound', status: 404 } } : { ok: false, failure: { kind: 'server', status: 503 } });
  const pass = await sync.indexBuyers(5_000);
  assert.match(pass.error, /error \(503\)/);
  assert.equal((await prisma.smeetzBuyer.findUnique({ where: { orderId: uuid(5) } })).email, null, 'read, nobody there');
  assert.equal((await sync.unreadOrders(10)).some((o: any) => o.id === uuid(5)), false, 'not asked for again');

  calls.length = 0;
  assert.equal(await sync.indexBuyers(5_000), null, 'paused for a while after trouble');
  assert.equal(calls.length, 0);
});

test('the order sync pages through, moves its watermark, and does not trust an empty answer to a filter Smeetz ignored', { skip }, async () => {
  const pages: Record<number, unknown[]> = { 1: Array.from({ length: 9 }, (_, i) => order(100 + i)), 2: [order(120), order(121)] };
  script = (c) => ({ ok: true, data: { data: { orders: pages[Number(c.query.pageNumber)] ?? [] } } });
  const first = await sync.syncOrders();
  assert.equal(first.ok, true);
  assert.equal(first.ordersUpserted, 11);
  assert.equal(first.pagesFetched, 2);
  assert.ok((await prisma.smeetzSyncState.findUnique({ where: { key: 'ordersSyncedThrough' } })).value);

  const mark = (await prisma.smeetzSyncState.findUnique({ where: { key: 'ordersSyncedThrough' } })).value;
  // a bounded spot-check leaves the watermark alone
  await sync.syncOrders({ maxPages: 1, startDate: '2026-10-01' });
  assert.equal((await prisma.smeetzSyncState.findUnique({ where: { key: 'ordersSyncedThrough' } })).value, mark);

  // Smeetz answers the filtered request with nothing, but its unfiltered newest orders are newer than the filter: it ignored it
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  script = (c) => ({ ok: true, data: { data: { orders: c.query.startDate ? [] : [order(130, { createdAt: tomorrow })] } } });
  const broken = await sync.syncOrders({ startDate: '2026-10-01' });
  assert.equal(broken.ok, false);
  assert.match(broken.message, /newer ones/);
});

test('an order sync that is refused stops and says why, leaving the watermark where it was', { skip }, async () => {
  script = () => ({ ok: false, failure: { kind: 'unauthorised', status: 401 } });
  const result = await sync.syncOrders();
  assert.equal(result.ok, false);
  assert.match(result.message, /rejected the API key/);
  assert.equal(await prisma.smeetzSyncState.findUnique({ where: { key: 'ordersSyncedThrough' } }), null);
});

test('an upcoming ticket gets its night from the availability look-up', { skip }, async () => {
  await sync.upsertOrder(order(1)); // availabilityId 555, no night yet
  const when = new Date(Date.now() + 5 * 86_400_000);
  script = () => ({ ok: true, data: { data: [{ id: 555, dateTimeStart: when.toISOString() }, { id: 'x', dateTimeStart: 'bad' }] } });
  const { resolved } = await sync.resolveShowDates();
  assert.equal(resolved, 1);
  const { orders } = await (async () => {
    await directory.rememberBuyer(uuid(1), { name: 'Pat', email: 'pat@example.org' });
    return directory.lookup('pat@example.org');
  })();
  assert.deepEqual(orders[0].nights, [when.toISOString().slice(0, 10)]);
  assert.equal(orders[0].lines[0].tickets[0].night, when.toISOString().slice(0, 10));
});

test('a mirrored ticket gets its QR payload from Smeetz the first time it is looked at, once, and never from a stranger\'s order', { skip }, async () => {
  await sync.upsertOrder(order(1, { customerId: 'c-pat' })); // mirrored before the QR payload was kept: qrCode is null
  await directory.rememberBuyer(uuid(1), { name: 'Pat Buyer', email: 'pat@example.org' });
  assert.equal((await prisma.smeetzOrderLine.findFirst({ where: { orderId: uuid(1) } })).qrCode, null);

  script = (c) => (c.path === `/v1/order/${uuid(1)}` ? { ok: true, data: { data: { customer: { firstName: 'Pat', email: 'pat@example.org' }, tickets: [{ uuid: 'u1', qrCode: 'QR-FROM-SMEETZ' }] } } } : { ok: false, failure: { kind: 'notFound', status: 404 } });
  const first = await directory.lookup('pat@example.org');
  assert.equal(first.orders[0].lines[0].tickets[0].qr, 'QR-FROM-SMEETZ');
  assert.equal(first.orders[0].lines[0].tickets[0].barcode, 'BC1', 'the barcode stays as it was');
  assert.equal(calls.length, 1);

  await directory.lookup('pat@example.org');
  assert.equal(calls.length, 1, 'kept: not read again');

  // Smeetz unreachable: the guest still gets their order, without a payload (the app falls back to the barcode)
  await sync.upsertOrder(order(2, { customerId: 'c-pat' }));
  script = () => ({ ok: false, failure: { kind: 'network', message: 'down' } });
  const down = await directory.lookup('pat@example.org');
  const two = down.orders.find((o: any) => o.reference === 'REF2');
  assert.equal(two.lines[0].tickets[0].qr, null);
  assert.equal(two.lines[0].tickets[0].barcode, 'BC2');

  // Smeetz answers but has no payload for the ticket: remembered as "none", not asked again
  script = () => ({ ok: true, data: { data: { customer: { firstName: 'Pat' }, tickets: [] } } });
  calls = [];
  await directory.lookup('pat@example.org');
  await directory.lookup('pat@example.org');
  assert.equal(calls.length, 1);
  assert.equal((await prisma.smeetzOrderLine.findFirst({ where: { orderId: uuid(2) } })).qrCode, '');
});
