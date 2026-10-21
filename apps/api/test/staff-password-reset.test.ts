import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '@kynren/shared/crypto';
// The compiled service: run `nest build` first (the npm script does).
import { AuthService } from '../dist/auth/auth.service.js';

type Staff = { id: string; email: string; name: string; role: string; active: boolean; passwordHash: string; resetTokenHash: string | null; resetExpiresAt: Date | null };

let staff: Staff[];
let sent: { to: string; subject: string; html: string }[];
let svc: AuthService;

const prisma = {
  staffUser: {
    findFirst: async ({ where }: any) => staff.find((s) => s.email.toLowerCase() === String(where.email.equals).toLowerCase()) ?? null,
    findUnique: async ({ where }: any) => staff.find((s) => s.resetTokenHash !== null && s.resetTokenHash === where.resetTokenHash) ?? null,
    update: async ({ where, data }: any) => Object.assign(staff.find((s) => s.id === where.id)!, data),
  },
};

beforeEach(() => {
  staff = [
    { id: 's1', email: 'ops@kynren.com', name: 'Ops', role: 'OPS', active: true, passwordHash: hashPassword('old-password'), resetTokenHash: null, resetExpiresAt: null },
    { id: 's2', email: 'gone@kynren.com', name: 'Gone', role: 'OPS', active: false, passwordHash: hashPassword('old-password'), resetTokenHash: null, resetExpiresAt: null },
  ];
  sent = [];
  const mail = { send: async (to: string, subject: string, html: string) => (sent.push({ to, subject, html }), { sent: true }) };
  const jwt = { sign: () => 'jwt' };
  const permissions = {};
  svc = new (AuthService as any)(prisma, jwt, permissions, mail);
});

const tokenFromEmail = () => sent.at(-1)!.html.match(/reset-password\?token=([0-9a-f]{64})/)![1];

test('an address that is not a staff account gets no email', async () => {
  await svc.requestStaffReset('nobody@kynren.com');
  await svc.requestStaffReset('   ');
  assert.equal(sent.length, 0);
});

test('a deactivated account gets no email', async () => {
  await svc.requestStaffReset('gone@kynren.com');
  assert.equal(sent.length, 0);
});

test('an active account, typed in any case, gets one link; only its hash is stored', async () => {
  await svc.requestStaffReset('  OPS@Kynren.com ');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ops@kynren.com');
  const token = tokenFromEmail();
  assert.notEqual(staff[0].resetTokenHash, token);
  assert.ok(staff[0].resetExpiresAt!.getTime() > Date.now() + 55 * 60_000);
});

test('asking again inside a minute sends nothing more', async () => {
  await svc.requestStaffReset('ops@kynren.com');
  await svc.requestStaffReset('ops@kynren.com');
  assert.equal(sent.length, 1);
  staff[0].resetExpiresAt = new Date(Date.now() + 50 * 60_000);
  await svc.requestStaffReset('ops@kynren.com');
  assert.equal(sent.length, 2);
});

test('the emailed link sets a new password once, then is spent', async () => {
  await svc.requestStaffReset('ops@kynren.com');
  const token = tokenFromEmail();
  assert.deepEqual(await svc.resetStaffPassword({ token, password: 'a-new-password' }), { ok: true });
  assert.equal(verifyPassword('a-new-password', staff[0].passwordHash), true);
  assert.equal(verifyPassword('old-password', staff[0].passwordHash), false);
  assert.equal(staff[0].resetTokenHash, null);
  assert.match(sent.at(-1)!.subject, /changed/);
  await assert.rejects(() => svc.resetStaffPassword({ token, password: 'another-one-here' }), /invalid or has expired/);
});

test('a wrong, missing or expired token changes nothing', async () => {
  await svc.requestStaffReset('ops@kynren.com');
  const token = tokenFromEmail();
  await assert.rejects(() => svc.resetStaffPassword({ token: 'f'.repeat(64), password: 'a-new-password' }), /invalid or has expired/);
  await assert.rejects(() => svc.resetStaffPassword({ password: 'a-new-password' }), /invalid or has expired/);
  staff[0].resetExpiresAt = new Date(Date.now() - 1000);
  await assert.rejects(() => svc.resetStaffPassword({ token, password: 'a-new-password' }), /invalid or has expired/);
  assert.equal(verifyPassword('old-password', staff[0].passwordHash), true);
});

test('a too-short password is refused and does not spend the link', async () => {
  await svc.requestStaffReset('ops@kynren.com');
  const token = tokenFromEmail();
  await assert.rejects(() => svc.resetStaffPassword({ token, password: 'short' }), /at least 8/);
  assert.deepEqual(await svc.resetStaffPassword({ token, password: 'long-enough-now' }), { ok: true });
});

test('a link for an account deactivated since is refused', async () => {
  await svc.requestStaffReset('ops@kynren.com');
  const token = tokenFromEmail();
  staff[0].active = false;
  await assert.rejects(() => svc.resetStaffPassword({ token, password: 'a-new-password' }), /invalid or has expired/);
});

test('staff sign in regardless of the case the email is typed in', async () => {
  for (const typed of ['ops@kynren.com', 'Ops@Kynren.com', '  OPS@KYNREN.COM ']) {
    const res = await svc.staffLogin({ email: typed, password: 'old-password' });
    assert.equal(res.staff.email, 'ops@kynren.com');
  }
  await assert.rejects(() => svc.staffLogin({ email: 'Ops@Kynren.com', password: 'wrong' }), /Invalid credentials/);
});
