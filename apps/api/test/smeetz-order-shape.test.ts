import { test } from 'node:test';
import assert from 'node:assert/strict';
// The compiled code: run `nest build` first (the npm script does).
import { flattenLines, parseOrderDetail, toGuestOrder, normaliseEmail } from '../dist/smeetz/order-shape.js';
import { backoffMs, failureForStatus, filterLooksBroken, parseRetryAfter, shouldRetry, smeetzDate, smeetzEnvironment, baseUrlFor } from '../dist/smeetz/smeetz-config.js';

test('every kind of unit becomes a flat line, and a surprising type costs a value rather than the order', () => {
  const lines = flattenLines({
    items: {
      tickets: [{ optionId: 'o1', optionName: 'Night Show', priceName: 'Adult', units: [{ id: 7, barcode: 'BC1', token: 'TOK-QR-1', itemStatus: 'VALID', priceValue: 30, availabilityId: 55, guest: { firstName: 'Ann', lastName: 'Guest' } }, { id: 'u2', priceValue: 'thirty' }] }],
      retails: [{ retailName: 'Programme', quantity: 2, itemStatus: 'PAID' }, {}],
      vouchers: [{ name: 'Gift', units: [{ id: 'v1', code: 'GIFT1', voucherStatus: 'ACTIVE' }] }, { name: 'Empty gift' }],
      memberships: [{ optionName: 'Annual', priceName: 'Family', optionId: 'm1', units: [{ id: 99, membershipCode: 'MEM1', membershipStatus: 'ACTIVE' }] }],
    },
  });
  assert.deepEqual(lines.map((l: any) => l.kind), ['TICKET', 'TICKET', 'RETAIL', 'RETAIL', 'VOUCHER', 'VOUCHER', 'MEMBERSHIP']);
  assert.equal(lines[0].unitId, '7', 'a numeric id is kept as text');
  assert.equal(lines[0].availabilityId, '55');
  assert.equal(lines[0].guestFirstName, 'Ann');
  assert.equal(lines[1].priceValue, null, 'a price that is not a number is dropped, not stored');
  assert.equal(lines[2].quantity, 2);
  assert.equal(lines[3].itemName, '(unnamed item)');
  assert.equal(lines[4].voucherCode, 'GIFT1');
  assert.equal(lines[5].itemName, 'Empty gift');
  assert.equal(lines[6].membershipCode, 'MEM1');
  assert.deepEqual(flattenLines({}), []);
});

const row = (over: Record<string, unknown>) => ({ kind: 'TICKET', itemName: 'Night Show', priceName: 'Adult', priceValue: 30, quantity: 1, itemStatus: 'VALID', showDate: null, barcode: null, qrCode: null, voucherCode: null, voucherStatus: null, membershipCode: null, membershipStatus: null, guestFirstName: null, guestLastName: null, ...over });

test('what a guest sees: lines grouped by kind and price tier, live tickets counted, cancelled ones not charged', () => {
  const night = new Date('2026-10-30T00:00:00Z');
  const g = toGuestOrder({
    reference: 'AB12',
    status: 'COMPLETED',
    currency: 'GBP',
    smeetzCreatedAt: new Date('2026-10-01T10:00:00Z'),
    lines: [
      row({ barcode: 'BC1', showDate: night, guestFirstName: 'Ann', guestLastName: 'Guest' }),
      row({ barcode: 'BC2', showDate: night }),
      row({ barcode: 'BC3', itemStatus: 'CANCELLED' }),
      row({ kind: 'VOUCHER', itemName: 'Gift', priceName: null, priceValue: null, itemStatus: null, voucherCode: 'G1', voucherStatus: 'ACTIVE' }),
      row({ kind: 'SOMETHING_NEW', itemName: 'Odd', priceName: null, priceValue: null }),
    ],
  });
  assert.equal(g.lines.length, 3, 'tickets, the voucher, and the unknown kind (shown as a ticket line)');
  const tickets = g.lines[0];
  assert.equal(tickets.quantity, 3);
  assert.deepEqual(tickets.tickets.map((t: any) => t.barcode), ['BC1', 'BC2', 'BC3']);
  assert.equal(tickets.tickets[0].holder, 'Ann Guest');
  assert.equal(tickets.tickets[0].night, '2026-10-30');
  assert.equal(g.valueTotal, 60, 'the cancelled ticket is not counted');
  assert.equal(g.liveTickets, 3, 'two valid tickets and the unknown kind; the cancelled one is not live');
  assert.deepEqual(g.nights, ['2026-10-30']);
  assert.equal(g.lines[1].tickets[0].barcode, 'G1');
  assert.equal(g.lines[1].tickets[0].status, 'ACTIVE');
  assert.equal(g.placedAt, '2026-10-01T10:00:00.000Z');
  assert.equal(JSON.stringify(g).includes('customerId'), false);
});

test('who bought: name, phone and the address as street, city, postcode and country', () => {
  const d = parseOrderDetail({ data: { customer: { firstName: ' Pat ', lastName: 'Buyer', email: 'Pat@Example.org', phone: '0123456', address: '1 High St', city: 'Leeds', zipCode: 'LS1 1AA', country: 'UK', company: '' } } });
  assert.deepEqual(d.customer, { name: 'Pat Buyer', company: null, email: 'Pat@Example.org', phone: '0123456', address: '1 High St, Leeds, LS1 1AA, UK' });
  assert.equal(parseOrderDetail({ data: { customer: { firstName: 'Solo' } } }).customer.address, null);
  assert.equal(parseOrderDetail({ data: {} }), null);
  assert.equal(parseOrderDetail('nope'), null);
  assert.equal(parseOrderDetail(null), null);
});

test('email addresses are compared trimmed and lowercased; junk is refused', () => {
  assert.equal(normaliseEmail('  Pat@Example.ORG '), 'pat@example.org');
  assert.equal(normaliseEmail('a b@c.co'), '');
  assert.equal(normaliseEmail(undefined), '');
});

test('a fresh checkout reads the test host; live must be asked for, by name or by the live URL', () => {
  assert.equal(smeetzEnvironment({}), 'test');
  assert.equal(smeetzEnvironment({ SMEETZ_API_URL: 'https://services.test.smeetz.com' }), 'test');
  assert.equal(smeetzEnvironment({ SMEETZ_API_URL: 'https://services-live.smeetz.com' }), 'live');
  assert.equal(smeetzEnvironment({ SMEETZ_ENVIRONMENT: ' LIVE ', SMEETZ_API_URL: 'https://services.test.smeetz.com' }), 'live');
  assert.equal(smeetzEnvironment({ SMEETZ_ENVIRONMENT: 'bogus' }), 'test');
  assert.equal(baseUrlFor('live', 'api'), 'https://api-live.smeetz.com');
  assert.equal(baseUrlFor('test', 'services'), 'https://services.test.smeetz.com');
});

test('failures are classified, and only what retrying can fix is retried', () => {
  assert.equal(failureForStatus(200), null);
  assert.deepEqual(failureForStatus(401), { kind: 'unauthorised', status: 401 });
  assert.deepEqual(failureForStatus(404), { kind: 'notFound', status: 404 });
  const limited = failureForStatus(429, '3')!;
  assert.deepEqual(limited, { kind: 'rateLimited', status: 429, retryAfterMs: 3000 });
  assert.equal(shouldRetry(limited), true);
  assert.equal(shouldRetry(failureForStatus(503)!), true);
  assert.equal(shouldRetry(failureForStatus(400)!), false);
  assert.equal(shouldRetry(failureForStatus(401)!), false);
  assert.equal(shouldRetry({ kind: 'notFound', status: 404 }), false);
  assert.equal(backoffMs(0), 400);
  assert.equal(backoffMs(10), 5000);
  assert.equal(backoffMs(0, limited), 3000);
  assert.equal(parseRetryAfter('nonsense'), 0);
  assert.equal(parseRetryAfter(new Date(Date.now() + 5000).toUTCString(), Date.now()) > 3000, true);
});

test('dates go to Smeetz as plain days, and an ignored date filter is recognised', () => {
  assert.equal(smeetzDate('2026-10-23T18:30:00Z'), '2026-10-23');
  assert.equal(smeetzDate('rubbish'), undefined);
  assert.equal(smeetzDate(undefined), undefined);
  assert.equal(filterLooksBroken('2026-10-23', ['2026-10-24T01:00:00Z']), true);
  assert.equal(filterLooksBroken('2026-10-23', ['2026-10-01T01:00:00Z']), false);
  assert.equal(filterLooksBroken('2026-10-23', []), false);
});

test('a ticket\'s QR payload is the per-ticket token, kept apart from the barcode, and reaches the guest only when there is one', () => {
  const lines = flattenLines({ items: { tickets: [{ optionName: 'Night Show', units: [{ id: 'u1', barcode: 'BC1', token: 'TOKEN-ONE' }, { id: 'u2', barcode: 'BC2' }] }] } });
  assert.equal(lines[0].barcode, 'BC1');
  assert.equal(lines[0].qrCode, 'TOKEN-ONE');
  assert.equal(lines[1].qrCode, null, 'no token, nothing invented');

  const g = toGuestOrder({ reference: 'R', status: 'COMPLETED', currency: 'GBP', smeetzCreatedAt: new Date('2026-10-01T10:00:00Z'), lines: [row({ barcode: 'BC1', qrCode: 'TOKEN-ONE' }), row({ barcode: 'BC2', qrCode: null }), row({ barcode: 'BC3', qrCode: '' })] } as any);
  assert.deepEqual(g.lines[0].tickets.map((t: any) => [t.barcode, t.qr]), [['BC1', 'TOKEN-ONE'], ['BC2', null], ['BC3', null]], "'' means Smeetz was asked and has none: the app gets null");
});

test('the one-order call gives each ticket\'s QR payload by the ticket\'s id', () => {
  const detail = parseOrderDetail({ data: { customer: { firstName: 'Pat', email: 'p@example.org' }, tickets: [{ uuid: 'u1', qrCode: 'QR-1', voucher: '' }, { uuid: 'u2' }, { qrCode: 'orphan' }] } })!;
  assert.deepEqual(detail.tickets, [{ uuid: 'u1', qrCode: 'QR-1' }, { uuid: 'u2', qrCode: null }], 'a ticket with no id is dropped');
  assert.deepEqual(parseOrderDetail({ data: { customer: { firstName: 'Pat' } } })!.tickets, []);
});
