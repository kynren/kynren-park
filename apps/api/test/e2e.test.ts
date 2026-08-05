import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// Import the COMPILED module: NestJS DI needs emitDecoratorMetadata, which
// tsx/esbuild does not emit. The tsc-built dist carries that metadata, so DI
// resolves correctly. Run `nest build` before this test (the npm script does).
import { AppModule } from '../dist/app.module.js';

// Load env (repo-root .env) so DATABASE_URL and JWT secrets are available.
for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (!process.env.DATABASE_URL && existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}

let app: INestApplication;
let base = '';

const api = async (path: string, opts: RequestInit & { token?: string } = {}) => {
  const res = await fetch(base + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body } as { status: number; body: any };
};

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1').replace('0.0.0.0', '127.0.0.1') + '/api';
});

after(async () => {
  await app?.close();
});

test('health reports the database is up', async () => {
  const { status, body } = await api('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'up');
});

test('attractions catalogue is seeded', async () => {
  const { status, body } = await api('/attractions');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 5, `expected >=5 attractions, got ${body.length}`);
});

test('itinerary optimize returns a conflict-free plan', async () => {
  const { status, body } = await api('/itinerary/optimize', {
    method: 'POST',
    body: JSON.stringify({ date: '2026-07-18', attractionIds: [], arrival: '10:30', departure: '18:00' }),
  });
  assert.equal(status, 201);
  assert.ok(body.stops.length >= 1);
  // No two stops overlap in time.
  for (let i = 1; i < body.stops.length; i++) {
    assert.ok(new Date(body.stops[i].startTime) >= new Date(body.stops[i - 1].endTime));
  }
});

test('register → book → offline QR → staff single-use validation', async () => {
  const email = `e2e_${Date.now()}@example.com`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'hunter2pass', name: 'E2E' }),
  });
  assert.equal(reg.status, 201);
  const token = reg.body.accessToken as string;
  assert.ok(token);

  const types = await api('/ticket-types');
  const adult = types.body.find((t: any) => t.category === 'ADULT');
  assert.ok(adult);

  const booking = await api('/bookings', {
    method: 'POST',
    token,
    body: JSON.stringify({ visitDate: '2026-07-18', items: [{ ticketTypeId: adult.id, quantity: 1 }] }),
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.body.tickets.length, 1);
  const qrToken = booking.body.tickets[0].qrToken as string;
  assert.ok(qrToken.length > 20);

  const staff = await api('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@kynren.com', password: 'kynren-admin' }),
  });
  assert.equal(staff.status, 201);
  const staffToken = staff.body.accessToken as string;

  const first = await api('/tickets/validate', { method: 'POST', token: staffToken, body: JSON.stringify({ qrToken }) });
  assert.equal(first.body.valid, true);
  const second = await api('/tickets/validate', { method: 'POST', token: staffToken, body: JSON.stringify({ qrToken }) });
  assert.equal(second.body.valid, false, 'a used ticket must not validate twice');
});

test('staff-only endpoints reject anonymous callers', async () => {
  const { status } = await api('/schedule/does-not-matter/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SCHEDULED' }),
  });
  assert.equal(status, 401);
});
