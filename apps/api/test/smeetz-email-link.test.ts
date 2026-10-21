import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
// The compiled service: run `nest build` first (the npm script does).
import { SmeetzEmailLinkService, hashCode, normaliseEmail } from '../dist/smeetz/smeetz-email-link.service.js';

process.env.JWT_REFRESH_SECRET = 'unit-test-secret-unit-test-secret';

type Row = { id: string; userId: string; email: string; codeHash: string; attempts: number; expiresAt: Date; consumedAt: Date | null; createdAt: Date };

function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, want]) => {
    const have = row[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
      if ('gt' in want) return have > want.gt;
      if ('not' in want) return have !== want.not;
      return false;
    }
    return have === want;
  });
}

function fakePrisma() {
  const verifications: Row[] = [];
  const linked: any[] = [];
  const prisma = {
    emailVerification: {
      count: async ({ where }: any) => verifications.filter((r) => matches(r, where)).length,
      aggregate: async ({ where }: any) => ({ _sum: { attempts: verifications.filter((r) => matches(r, where)).reduce((n, r) => n + r.attempts, 0) } }),
      create: async ({ data }: any) => {
        const row: Row = { attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
        verifications.push(row);
        return row;
      },
      findFirst: async ({ where }: any) => [...verifications].reverse().find((r) => matches(r, where)) ?? null,
      findMany: async ({ where }: any) => {
        const hits = verifications.filter((r) => matches(r, where));
        return [...new Map(hits.map((r) => [r.email, { email: r.email }])).values()];
      },
      update: async ({ where, data }: any) => {
        const row = verifications.find((r) => r.id === where.id)!;
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        else if (data.attempts?.decrement) row.attempts -= data.attempts.decrement;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      },
    },
    smeetzLinkedOrder: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.userId_orderReference;
        const have = linked.find((l) => l.userId === key.userId && l.orderReference === key.orderReference);
        if (have) Object.assign(have, update);
        else linked.push({ ...create });
      },
    },
  };
  return { prisma, verifications, linked };
}

const order = (reference: string) => ({ reference, status: 'COMPLETED', placedAt: '2026-08-01T10:00:00Z', currency: 'GBP', valueTotal: 80, liveTickets: 2, nights: [], lines: [] });

let state: ReturnType<typeof fakePrisma>;
let sent: { to: string; subject: string; html: string }[];
let orders: Record<string, any[]>;
let groupsDown: boolean;
let svc: SmeetzEmailLinkService;

beforeEach(() => {
  state = fakePrisma();
  sent = [];
  orders = {};
  groupsDown = false;
  const mail = { send: async (to: string, subject: string, html: string) => (sent.push({ to, subject, html }), { sent: true }) };
  const groups = {
    ordersForEmail: async (email: string) => {
      if (groupsDown) throw new Error('down');
      return orders[email] ?? [];
    },
  };
  svc = new (SmeetzEmailLinkService as any)(state.prisma, mail, groups);
});

const deliver = (email: string, user = 'u1') => (svc as any).deliver(user, email);
const lastCode = () => sent.at(-1)!.html.match(/>(\d{6})</)![1];

test('normaliseEmail trims, lowercases and rejects junk', () => {
  assert.equal(normaliseEmail('  Pat@Example.ORG '), 'pat@example.org');
  assert.equal(normaliseEmail('nope'), '');
});

test('an address with no bookings is never emailed and nothing is stored', async () => {
  await deliver('nobody@example.org');
  assert.equal(sent.length, 0);
  assert.equal(state.verifications.length, 0);
});

test('an address with bookings gets a six-digit code; only its hash is kept', async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org');
  assert.equal(sent.length, 1);
  const code = lastCode();
  assert.match(code, /^\d{6}$/);
  assert.notEqual(state.verifications[0].codeHash, code);
  assert.equal(state.verifications[0].codeHash, hashCode(state.verifications[0].id, code));
});

test('a bad address is refused up front, and a user is limited to five requests an hour', async () => {
  await assert.rejects(() => svc.requestCode('u1', 'nope'), /valid email/);
  for (let i = 0; i < 5; i++) await state.prisma.emailVerification.create({ data: { id: `v${i}`, userId: 'u1', email: `e${i}@x.co`, codeHash: '', expiresAt: new Date(Date.now() + 1000) } });
  await assert.rejects(() => svc.requestCode('u1', 'pat@example.org'), /Too many requests/);
});

test('a resend inside a minute, or a fourth code for one address in an hour, sends nothing more', async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org');
  await deliver('pat@example.org');
  assert.equal(sent.length, 1);

  state.verifications.forEach((r) => (r.createdAt = new Date(Date.now() - 120_000)));
  await deliver('pat@example.org', 'u2');
  await deliver('pat@example.org', 'u3');
  await deliver('pat@example.org', 'u4');
  assert.equal(sent.length, 3);
});

test('the right code links every order and cannot be used twice', async () => {
  orders['pat@example.org'] = [order('AB12'), order('CD34')];
  await deliver('pat@example.org');
  const code = lastCode();

  const result = await svc.verify('u1', 'PAT@example.org', code);
  assert.equal(result.linked, 2);
  assert.deepEqual(state.linked.map((l) => l.orderReference).sort(), ['AB12', 'CD34']);
  assert.equal(state.linked[0].source, 'email');
  assert.equal(state.linked[0].email, 'pat@example.org');
  await assert.rejects(() => svc.verify('u1', 'pat@example.org', code), /expired/);
});

test("somebody else's account cannot use the code", async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org', 'u1');
  await assert.rejects(() => svc.verify('u2', 'pat@example.org', lastCode()), /expired/);
  assert.equal(state.linked.length, 0);
});

test('five wrong guesses lock the code, even for the right one afterwards', async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org');
  const code = lastCode();
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await assert.rejects(() => svc.verify('u1', 'pat@example.org', wrong), /not right/);
  await assert.rejects(() => svc.verify('u1', 'pat@example.org', code), /expired/);
  assert.equal(state.linked.length, 0);
});

test('an expired code is refused', async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org');
  const code = lastCode();
  state.verifications[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(() => svc.verify('u1', 'pat@example.org', code), /expired/);
});

test('if the booking lookup is down, a correct code is not spent', async () => {
  orders['pat@example.org'] = [order('AB12')];
  await deliver('pat@example.org');
  const code = lastCode();

  groupsDown = true;
  await assert.rejects(() => svc.verify('u1', 'pat@example.org', code), /down/);
  assert.equal(state.verifications[0].consumedAt, null);
  assert.equal(state.verifications[0].attempts, 0);

  groupsDown = false;
  assert.equal((await svc.verify('u1', 'pat@example.org', code)).linked, 1);
});

test('refresh looks again only for addresses this guest has proved, and picks up newer bookings', async () => {
  orders['pat@example.org'] = [order('AB12')];
  orders['other@example.org'] = [order('ZZ99')];
  await deliver('pat@example.org');
  await svc.verify('u1', 'pat@example.org', lastCode());

  orders['pat@example.org'] = [order('AB12'), order('NEW1')];
  const result = await svc.refresh('u1');
  assert.equal(result.linked, 2);
  const refs = state.linked.map((l) => l.orderReference).sort();
  assert.deepEqual(refs, ['AB12', 'NEW1']);
  assert.equal(refs.includes('ZZ99'), false);
});

test('a guest can prove at most three addresses', async () => {
  for (const e of ['a@x.co', 'b@x.co', 'c@x.co', 'd@x.co']) orders[e] = [order(e)];
  for (const e of ['a@x.co', 'b@x.co', 'c@x.co']) {
    await deliver(e);
    state.verifications.forEach((r) => (r.createdAt = new Date(Date.now() - 120_000)));
    await svc.verify('u1', e, lastCode());
  }
  const before = sent.length;
  await deliver('d@x.co');
  assert.equal(sent.length, before);
});
