import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, Post, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { accountKeyOf } from '../src/common/account-throttle.js';

// The same two throttlers app.module.ts sets up, on a route that behaves like sign-in. The decorators are applied by hand
// because the test runner's transpiler does not do the parameter decorators Nest's own syntax uses.
class T {
  login() {
    return { ok: true };
  }
}
const login = Object.getOwnPropertyDescriptor(T.prototype, 'login')!;
Controller('t')(T);
Post('login')(T.prototype, 'login', login);
Throttle({ default: { limit: 5, ttl: 60_000 } })(T.prototype, 'login', login);

class M {}
Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'account', ttl: 60_000, limit: 10, getTracker: (req) => accountKeyOf(req) ?? '', skipIf: (ctx) => accountKeyOf(ctx.switchToHttp().getRequest()) === null },
    ]),
  ],
  controllers: [T],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})(M);

async function boot() {
  const app = await NestFactory.create<NestExpressApplication>(M, { logger: false });
  app.set('trust proxy', 1);
  await app.listen(0);
  const url = await app.getUrl();
  return { app, url: url.replace('[::1]', 'localhost') };
}

const post = (url: string, ip: string, email: string) =>
  fetch(`${url}/t/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email }) }).then((r) => r.status);

test('changing IP address does not reset the sign-in allowance for one account', async () => {
  const { app, url } = await boot();
  try {
    const statuses: number[] = [];
    // 15 attempts at ONE account, each from a different address: the per-IP limit never trips, the per-account one must.
    for (let i = 0; i < 15; i++) statuses.push(await post(url, `203.0.113.${i + 1}`, 'Victim@Example.com'));
    assert.equal(statuses.filter((s) => s === 201).length, 10, statuses.join(','));
    assert.equal(statuses.filter((s) => s === 429).length, 5, statuses.join(','));
    // another account is unaffected
    assert.equal(await post(url, '203.0.113.99', 'someone.else@example.com'), 201);
    // the same address is still limited on its own as before (5 a minute)
    const same: number[] = [];
    for (let i = 0; i < 7; i++) same.push(await post(url, '198.51.100.7', `user${i}@example.com`));
    assert.equal(same.filter((s) => s === 201).length, 5, same.join(','));
  } finally {
    await app.close();
  }
});
