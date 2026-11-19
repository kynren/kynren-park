import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountKeyOf } from '../src/common/account-throttle.js';
import { isPlausibleFix, MAX_SPEED_MPS } from '../src/users/presence-check.js';

test('the account a request is about is its email, whatever the case or spacing, and nothing else', () => {
  assert.equal(accountKeyOf({ body: { email: '  Guest@Example.COM ' } }), 'guest@example.com');
  assert.equal(accountKeyOf({ body: { email: 'a@b.co' } }), 'a@b.co');
  assert.equal(accountKeyOf({ body: {} }), null);
  assert.equal(accountKeyOf({ body: { email: 42 } }), null);
  assert.equal(accountKeyOf({ body: { email: 'x' } }), null);
  assert.equal(accountKeyOf({ body: { email: 'a'.repeat(300) } }), null);
  assert.equal(accountKeyOf({ body: 'text' }), null);
  assert.equal(accountKeyOf(undefined), null);
});

const now = new Date('2026-11-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const PARK = { lat: 54.6715, lng: -1.679 };

test('numbers that are not coordinates are refused', () => {
  for (const bad of [{ lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: Infinity, lng: 1 }, { lat: 0, lng: 0 }]) {
    assert.equal(isPlausibleFix(bad, null, now), false, JSON.stringify(bad));
  }
});

test('a first report anywhere real is accepted', () => {
  assert.equal(isPlausibleFix(PARK, null, now), true);
});

test('a walk from the last report is accepted, a jump across the country in a minute is not', () => {
  assert.equal(isPlausibleFix({ lat: PARK.lat + 0.001, lng: PARK.lng }, { ...PARK, at: minutesAgo(5) }, now), true);
  const london = { lat: 51.5074, lng: -0.1278 }; // about 400 km away
  assert.equal(isPlausibleFix(london, { ...PARK, at: minutesAgo(1) }, now), false);
  // ...but the same trip over five hours is a drive
  assert.equal(isPlausibleFix(london, { ...PARK, at: minutesAgo(300) }, now), true);
});

test('two reports in the same second do not divide by zero', () => {
  assert.equal(isPlausibleFix(PARK, { ...PARK, at: now }, now), true);
  assert.ok(MAX_SPEED_MPS > 30);
});
