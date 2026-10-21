import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@kynren/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { GroupsOrdersClient, type GuestOrder } from './groups-orders.client.js';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_REQUESTS_PER_USER_PER_HOUR = 5;
const MAX_CODES_PER_EMAIL_PER_HOUR = 3;
const MAX_FAILED_GUESSES_PER_EMAIL_PER_DAY = 15;
const MAX_EMAILS_PER_USER = 3;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export function normaliseEmail(raw: unknown): string {
  const text = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(text) ? text : '';
}

function codeSecret(): string {
  return process.env.EMAIL_CODE_SECRET || process.env.JWT_REFRESH_SECRET || '';
}

export function hashCode(verificationId: string, code: string): string {
  return createHmac('sha256', codeSecret()).update(`${verificationId}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

function codeEmail(code: string): string {
  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#22314a">
      <h2 style="color:#8f1d21">Kynren — The Storied Lands</h2>
      <p>Use this code in the Kynren app to add your bookings to your account:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#8a94a6;font-size:13px">The code works for 10 minutes. If you didn't ask for it, you can ignore this email — nothing has been shared.</p>
    </div>`;
}

/**
 * Pulls the orders bought with an email address into a guest's account, once they prove they own the address.
 *
 * Two things are kept deliberately blind: the request for a code always answers the same way (so nobody can use it to
 * learn which addresses have bookings), and a code is only ever emailed to an address that has some.
 */
@Injectable()
export class SmeetzEmailLinkService {
  private readonly logger = new Logger(SmeetzEmailLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly groups: GroupsOrdersClient,
  ) {}

  private tooMany(message: string): never {
    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Always resolves the same way, whatever was or was not found; the work after the limit check runs in the background. */
  async requestCode(userId: string, rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    if (!email) throw new BadRequestException('Enter a valid email address');

    const hourAgo = new Date(Date.now() - HOUR_MS);
    const mine = await this.prisma.emailVerification.count({ where: { userId, createdAt: { gt: hourAgo } } });
    if (mine >= MAX_REQUESTS_PER_USER_PER_HOUR) this.tooMany('Too many requests. Try again later.');

    void this.deliver(userId, email).catch((e) => this.logger.error(`Code delivery failed: ${(e as Error).message}`));
  }

  private async deliver(userId: string, email: string): Promise<void> {
    const now = Date.now();

    const verified = await this.verifiedEmails(userId);
    if (!verified.includes(email) && verified.length >= MAX_EMAILS_PER_USER) return;

    const [recentForEmail, recentForPair, failed] = await Promise.all([
      this.prisma.emailVerification.count({ where: { email, createdAt: { gt: new Date(now - HOUR_MS) } } }),
      this.prisma.emailVerification.count({ where: { userId, email, createdAt: { gt: new Date(now - RESEND_COOLDOWN_MS) } } }),
      this.prisma.emailVerification.aggregate({ where: { email, createdAt: { gt: new Date(now - DAY_MS) } }, _sum: { attempts: true } }),
    ]);
    if (recentForEmail >= MAX_CODES_PER_EMAIL_PER_HOUR || recentForPair > 0) return;
    if ((failed._sum.attempts ?? 0) >= MAX_FAILED_GUESSES_PER_EMAIL_PER_DAY) return;

    const orders = await this.groups.ordersForEmail(email);
    if (orders.length === 0) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const id = randomUUID();
    await this.prisma.emailVerification.create({
      data: { id, userId, email, codeHash: hashCode(id, code), expiresAt: new Date(now + CODE_TTL_MS) },
    });

    const { sent } = await this.mail.send(email, `Your Kynren code: ${code}`, codeEmail(code));
    if (!sent) this.logger.warn(`A verification code could not be emailed (id ${id}).`);
  }

  async verify(userId: string, rawEmail: string, rawCode: string): Promise<{ linked: number; orders: GuestOrder[] }> {
    const email = normaliseEmail(rawEmail);
    const code = String(rawCode ?? '').replace(/\s+/g, '');
    if (!email || !/^\d{6}$/.test(code)) throw new BadRequestException('Enter the 6-digit code from the email');

    const failed = await this.prisma.emailVerification.aggregate({
      where: { email, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
      _sum: { attempts: true },
    });
    if ((failed._sum.attempts ?? 0) >= MAX_FAILED_GUESSES_PER_EMAIL_PER_DAY) this.tooMany('Too many attempts. Try again tomorrow.');

    const row = await this.prisma.emailVerification.findFirst({
      where: { userId, email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.attempts >= MAX_ATTEMPTS_PER_CODE) throw new BadRequestException('That code has expired. Request a new one.');

    // Counted before it is compared, so parallel guesses cannot beat the limit.
    await this.prisma.emailVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    if (!sameHash(hashCode(row.id, code), row.codeHash)) throw new BadRequestException('That code is not right.');

    let orders: GuestOrder[];
    try {
      orders = await this.groups.ordersForEmail(email);
    } catch (e) {
      // The code was right: give the attempt back, so a lookup outage does not cost the guest their code.
      await this.prisma.emailVerification.update({ where: { id: row.id }, data: { attempts: { decrement: 1 } } });
      throw e;
    }

    await this.prisma.emailVerification.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    await this.store(userId, email, orders);
    return { linked: orders.length, orders };
  }

  /** Looks again, for every address this guest has proved they own: bookings made since are picked up. */
  async refresh(userId: string): Promise<{ linked: number }> {
    const emails = await this.verifiedEmails(userId);
    let linked = 0;
    let failures = 0;
    for (const email of emails) {
      try {
        const orders = await this.groups.ordersForEmail(email);
        await this.store(userId, email, orders);
        linked += orders.length;
      } catch {
        failures += 1;
      }
    }
    if (emails.length > 0 && failures === emails.length) throw new HttpException('Booking lookup is temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    return { linked };
  }

  async verifiedEmails(userId: string): Promise<string[]> {
    const rows = await this.prisma.emailVerification.findMany({
      where: { userId, consumedAt: { not: null } },
      select: { email: true },
      distinct: ['email'],
    });
    return rows.map((r) => r.email);
  }

  private async store(userId: string, email: string, orders: GuestOrder[]): Promise<void> {
    const now = new Date();
    for (const order of orders) {
      const snapshot = order as unknown as Prisma.InputJsonValue;
      await this.prisma.smeetzLinkedOrder.upsert({
        where: { userId_orderReference: { userId, orderReference: order.reference } },
        create: { userId, orderReference: order.reference, source: 'email', email, snapshot, snapshotAt: now },
        update: { snapshot, snapshotAt: now },
      });
    }
  }
}
