import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmeetzReadClient } from './smeetz-read.client.js';
import { SmeetzOrderDirectory } from './order-directory.service.js';
import { backoffMs, describeFailure, filterLooksBroken, shouldRetry, smeetzDate } from './smeetz-config.js';
import { flattenLines, parseOrderDetail, type RawSmeetzOrder } from './order-shape.js';

/** Smeetz caps its order list at nine rows a page; ten or more is refused. */
const PAGE_SIZE = 9;
/** Between pages: this endpoint throttles harder than the account-wide 250 a minute. */
const PAGE_DELAY_MS = 1500;
const OVERLAP_MS = 24 * 60 * 60 * 1000; // an order can still change (payment completing, cancellation) after it was first seen
const WATERMARK = 'ordersSyncedThrough';

const ORDER_SYNC_EVERY_MS = 10 * 60_000;
const BUYER_PASS_EVERY_MS = 60_000;
const BUYER_PASS_BUDGET_MS = 45_000;
/** Two readers, each pausing between reads: about 90 a minute, well under half the account's limit of 250. */
const READ_DELAY_MS = 800;
const READERS = 2;
const GIVE_UP_AFTER = 3; // Smeetz not answering this many times in a row ends a pass
const BACK_OFF_MS = 10 * 60_000;
const SHOW_DATES_EVERY_MS = 6 * 60 * 60_000;
const SHOW_DATE_WINDOW_DAYS = 180;
const OPTION_DELAY_MS = 1500;

export type SyncResult = { ok: boolean; message: string; ordersUpserted: number; ordersFailed: number; pagesFetched: number };
export type BuyerPass = { read: number; failed: number; error?: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Keeps the park's own copy of Smeetz's orders up to date, and learns who bought each - everything an emailed code is checked
 * against, with nothing live. Three quiet loops, all READ-ONLY against Smeetz:
 *  1. the order list, a little each ten minutes (everything since the last run, with a day's overlap);
 *  2. the buyer index, ~90 one-order reads a minute, newest orders first, never reading an order twice;
 *  3. each ticket's night, for slots still to come (Smeetz's availability look-up cannot see the past).
 * Off unless SMEETZ_ORDER_SYNC=on, so a development machine or a second copy of the API never reads Smeetz by accident.
 */
@Injectable()
export class SmeetzOrderSync implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmeetzOrderSync.name);
  private timers: NodeJS.Timeout[] = [];
  private busy = { orders: false, buyers: false, nights: false };
  private pausedUntil = 0;
  private last: { orders: (SyncResult & { at: Date }) | null; buyers: (BuyerPass & { at: Date }) | null; nights: { resolved: number; at: Date } | null } = { orders: null, buyers: null, nights: null };

  constructor(
    private readonly prisma: PrismaService,
    private readonly smeetz: SmeetzReadClient,
    private readonly directory: SmeetzOrderDirectory,
  ) {}

  get enabled(): boolean {
    return process.env.SMEETZ_ORDER_SYNC === 'on' && this.smeetz.configured;
  }

  onModuleInit() {
    if (process.env.SMEETZ_ORDER_SYNC !== 'on') return;
    if (!this.smeetz.configured) {
      this.logger.warn('SMEETZ_ORDER_SYNC is on but SMEETZ_API_KEY is not set: the Smeetz order mirror will not update.');
      return;
    }
    this.logger.log(`Smeetz order mirror is on (${this.smeetz.environment}).`);
    const every = (ms: number, first: number, key: 'orders' | 'buyers' | 'nights', job: () => Promise<unknown>) => {
      const run = async () => {
        if (this.busy[key]) return; // a slow pass must not pile runs up behind it
        this.busy[key] = true;
        try {
          await job();
        } catch (e) {
          this.logger.error(`Smeetz ${key} job failed: ${(e as Error).message}`);
        } finally {
          this.busy[key] = false;
        }
      };
      const start = setTimeout(run, first);
      const timer = setInterval(run, ms);
      start.unref?.();
      timer.unref?.();
      this.timers.push(start, timer);
    };
    every(ORDER_SYNC_EVERY_MS, 2 * 60_000, 'orders', () => this.syncOrders());
    every(BUYER_PASS_EVERY_MS, 90_000, 'buyers', () => this.indexBuyers());
    every(SHOW_DATES_EVERY_MS, 10 * 60_000, 'nights', () => this.resolveShowDates());
  }

  onModuleDestroy() {
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
  }

  // ----------------------------------------------------------------- 1. the order list

  /** Where to start reading from: the last run's start, else just before the newest order we already hold, else a month back. */
  private async startDate(): Promise<string> {
    const mark = await this.prisma.smeetzSyncState.findUnique({ where: { key: WATERMARK } });
    if (mark) {
      const at = new Date(mark.value);
      if (!Number.isNaN(at.getTime())) return smeetzDate(new Date(at.getTime() - OVERLAP_MS))!;
    }
    const newest = await this.prisma.smeetzOrder.findFirst({ orderBy: { smeetzCreatedAt: 'desc' }, select: { smeetzCreatedAt: true } });
    if (newest) return smeetzDate(new Date(newest.smeetzCreatedAt.getTime() - OVERLAP_MS))!;
    return smeetzDate(new Date(Date.now() - 30 * 24 * 60 * 60_000))!;
  }

  async syncOrders(options: { startDate?: string; maxPages?: number } = {}): Promise<SyncResult> {
    const startDate = options.startDate ?? (await this.startDate());
    const maxPages = options.maxPages ?? Infinity;
    const startedAt = new Date();
    let pageNumber = 1;
    let ordersUpserted = 0;
    let ordersFailed = 0;
    let pagesFetched = 0;

    const finish = (result: SyncResult) => {
      this.last.orders = { ...result, at: new Date() };
      if (!result.ok) this.logger.warn(result.message);
      return result;
    };

    for (;;) {
      let attempt = 0;
      let orders: RawSmeetzOrder[] = [];
      for (;;) {
        const res = await this.smeetz.get<{ data?: { orders?: RawSmeetzOrder[] } }>('api', '/v1/orders', { pageSize: PAGE_SIZE, pageNumber, locale: 'en', startDate });
        if (res.ok) {
          orders = res.data.data?.orders ?? [];
          break;
        }
        if (!shouldRetry(res.failure) || attempt >= 3) {
          return finish({ ok: false, message: `Order sync stopped at page ${pageNumber}: ${describeFailure(res.failure)}`, ordersUpserted, ordersFailed, pagesFetched });
        }
        await sleep(backoffMs(attempt, res.failure));
        attempt += 1;
      }

      for (const order of orders) {
        try {
          if (await this.upsertOrder(order)) ordersUpserted += 1;
        } catch (e) {
          // One order storing badly must not cost every order after it.
          ordersFailed += 1;
          this.logger.warn(`Order ${order.id ?? '(no id)'} could not be stored: ${(e as Error).message}`);
        }
      }
      pagesFetched += 1;
      if (orders.length < PAGE_SIZE || pagesFetched >= maxPages) break;
      pageNumber += 1;
      await sleep(PAGE_DELAY_MS);
    }

    // An empty answer to a date-filtered request is normal on a quiet night, and also exactly what Smeetz gives for a filter
    // it cannot read. If its newest orders are newer than where this run began, the empty answer was wrong: say so, and leave
    // the watermark alone so the next run still covers the gap.
    if (ordersUpserted === 0 && ordersFailed === 0) {
      const newest = await this.smeetz.get<{ data?: { orders?: RawSmeetzOrder[] } }>('api', '/v1/orders', { pageSize: PAGE_SIZE, pageNumber: 1, locale: 'en' });
      if (newest.ok && filterLooksBroken(startDate, (newest.data.data?.orders ?? []).map((o) => o.createdAt))) {
        return finish({ ok: false, message: `Smeetz returned no orders for ${startDate} onward although it has newer ones; nothing was recorded and the watermark was not moved.`, ordersUpserted, ordersFailed, pagesFetched });
      }
    }

    // A bounded run (maxPages, or an explicit startDate) is a spot check: moving the watermark on one would make a later,
    // real run skip orders it never saw.
    if (options.maxPages === undefined && options.startDate === undefined) {
      await this.prisma.smeetzSyncState.upsert({ where: { key: WATERMARK }, create: { key: WATERMARK, value: startedAt.toISOString() }, update: { value: startedAt.toISOString() } });
    }
    return finish({ ok: true, message: `Synced ${ordersUpserted} order(s) across ${pagesFetched} page(s).${ordersFailed ? ` ${ordersFailed} could not be stored.` : ''}`, ordersUpserted, ordersFailed, pagesFetched });
  }

  /** One order and its flattened lines, replaced as a unit. False for a row too malformed to store. */
  async upsertOrder(order: RawSmeetzOrder): Promise<boolean> {
    if (!order.id) return false;
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
    const updated = order.updatedAt ? new Date(order.updatedAt) : createdAt;
    const updatedAt = Number.isNaN(updated.getTime()) ? createdAt : updated;
    const id = String(order.id);
    const data = {
      reference: order.reference ?? '',
      status: order.status ?? 'UNKNOWN',
      currency: order.currency ?? '',
      customerId: order.customerId !== undefined && order.customerId !== null ? String(order.customerId) : null,
      language: order.language ?? null,
      smeetzUpdatedAt: updatedAt,
    };
    const lines = flattenLines(order).map((l) => ({ ...l, orderId: id }));
    await this.prisma.$transaction([
      this.prisma.smeetzOrder.upsert({ where: { id }, create: { id, smeetzCreatedAt: createdAt, ...data }, update: { ...data, syncedAt: new Date() } }),
      // Replaced wholesale rather than diffed: a handful of rows per order makes reconciling a diff pure overhead.
      this.prisma.smeetzOrderLine.deleteMany({ where: { orderId: id } }),
      this.prisma.smeetzOrderLine.createMany({ data: lines }),
    ]);
    return true;
  }

  // ----------------------------------------------------------------- 2. the buyer index

  /**
   * The next orders whose buyer has not been read: not cancelled, with a live ticket, a UUID id (the one-order call refuses the
   * short codes of older orders), and no buyer already read for the order or for another of the same Smeetz customer.
   * Newest first: what has just been booked is what is most likely wanted.
   */
  async unreadOrders(limit: number): Promise<{ id: string; customerId: string | null }[]> {
    return this.prisma.$queryRaw<{ id: string; customerId: string | null }[]>`
      SELECT o."id", o."customerId"
      FROM "SmeetzOrder" o
      WHERE o."id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND o."status" !~* 'CANCEL|REFUND|VOID|EXPIRE'
        AND NOT EXISTS (SELECT 1 FROM "SmeetzBuyer" b WHERE b."orderId" = o."id")
        AND (o."customerId" IS NULL OR NOT EXISTS (
          SELECT 1 FROM "SmeetzOrder" o2 JOIN "SmeetzBuyer" b2 ON b2."orderId" = o2."id" WHERE o2."customerId" = o."customerId"))
        AND EXISTS (
          SELECT 1 FROM "SmeetzOrderLine" l
          WHERE l."orderId" = o."id" AND l."kind" = 'TICKET' AND (l."itemStatus" IS NULL OR l."itemStatus" !~* 'CANCEL|REFUND|VOID|EXPIRE'))
      ORDER BY o."smeetzCreatedAt" DESC
      LIMIT ${limit}`;
  }

  async unreadCount(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n
      FROM "SmeetzOrder" o
      WHERE o."id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND o."status" !~* 'CANCEL|REFUND|VOID|EXPIRE'
        AND NOT EXISTS (SELECT 1 FROM "SmeetzBuyer" b WHERE b."orderId" = o."id")
        AND (o."customerId" IS NULL OR NOT EXISTS (
          SELECT 1 FROM "SmeetzOrder" o2 JOIN "SmeetzBuyer" b2 ON b2."orderId" = o2."id" WHERE o2."customerId" = o."customerId"))
        AND EXISTS (
          SELECT 1 FROM "SmeetzOrderLine" l
          WHERE l."orderId" = o."id" AND l."kind" = 'TICKET' AND (l."itemStatus" IS NULL OR l."itemStatus" !~* 'CANCEL|REFUND|VOID|EXPIRE'))`;
    return Number(row?.n ?? 0);
  }

  /** One pass: read the next few unread buyers, a little at a time, and stop at once if Smeetz stops answering. */
  async indexBuyers(budgetMs = BUYER_PASS_BUDGET_MS, now = Date.now()): Promise<BuyerPass | null> {
    if (now < this.pausedUntil) return null;
    const deadline = now + budgetMs;
    const todo = await this.unreadOrders(Math.ceil((budgetMs / READ_DELAY_MS) * READERS) + READERS);
    const progress: BuyerPass = { read: 0, failed: 0 };
    let misses = 0;
    let stopped = false;
    let next = 0;
    const readCustomers = new Set<string>();

    const reader = async () => {
      let asked = 0;
      while (!stopped) {
        const at = next++;
        if (at >= todo.length || Date.now() > deadline) return;
        const candidate = todo[at];
        // The same customer as one being read in this pass: the same buyer, so nothing more to ask. Claimed before the read, so two
        // readers never ask about the same person at once.
        if (candidate.customerId) {
          if (readCustomers.has(candidate.customerId)) continue;
          readCustomers.add(candidate.customerId);
        }
        if (asked > 0) await sleep(READ_DELAY_MS);
        asked += 1;
        const res = await this.smeetz.get<unknown>('api', `/v1/order/${candidate.id}`, { locale: 'en' });
        if (!res.ok && res.failure.kind === 'notFound') {
          // Smeetz has no such order: kept as "read, nobody", so it is not asked again every pass.
          await this.directory.rememberBuyer(candidate.id, null);
          misses = 0;
          continue;
        }
        const detail = res.ok ? parseOrderDetail(res.data) : null;
        if (!res.ok || !detail) {
          progress.failed += 1;
          misses += 1;
          if (misses >= GIVE_UP_AFTER) {
            progress.error = res.ok ? 'Smeetz answered with something unexpected' : describeFailure(res.failure);
            stopped = true;
          }
          continue;
        }
        misses = 0;
        await this.directory.rememberBuyer(candidate.id, detail.customer);
        progress.read += 1;
      }
    };
    await Promise.all(Array.from({ length: READERS }, () => reader()));
    if (progress.error) {
      this.pausedUntil = now + BACK_OFF_MS;
      this.logger.warn(`Buyer index paused for ten minutes: ${progress.error}`);
    }
    this.last.buyers = { ...progress, at: new Date() };
    return progress;
  }

  // ----------------------------------------------------------------- 3. each ticket's night

  /**
   * Fills in the night for ticket lines whose slot is still to come. Smeetz's availability look-up is forward-looking only, so a
   * past sale is left alone rather than guessed at.
   */
  async resolveShowDates(): Promise<{ resolved: number }> {
    const pending = await this.prisma.smeetzOrderLine.findMany({
      where: { kind: 'TICKET', optionId: { not: null }, availabilityId: { not: null }, showDate: null },
      select: { optionId: true },
      distinct: ['optionId'],
    });
    const from = new Date();
    const to = new Date(from.getTime() + SHOW_DATE_WINDOW_DAYS * 24 * 60 * 60_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    let resolved = 0;
    for (const { optionId } of pending) {
      if (!optionId) continue;
      const res = await this.smeetz.get<{ data?: { id?: unknown; localDateTimeStart?: string; dateTimeStart?: string }[] }>('services', '/public/v1/availability', {
        option_ids: optionId,
        locale: 'en',
        local_date_time_start: `${iso(from)}T00:00:00`,
        local_date_time_end: `${iso(to)}T23:59:59`,
        page_size: 100,
      });
      if (res.ok) {
        for (const entry of res.data.data ?? []) {
          const start = entry.localDateTimeStart ?? entry.dateTimeStart;
          if (typeof entry.id !== 'number' || typeof start !== 'string') continue;
          const at = new Date(start);
          if (Number.isNaN(at.getTime())) continue;
          const { count } = await this.prisma.smeetzOrderLine.updateMany({ where: { optionId, availabilityId: String(entry.id), showDate: null }, data: { showDate: at } });
          resolved += count;
        }
      }
      await sleep(OPTION_DELAY_MS);
    }
    this.last.nights = { resolved, at: new Date() };
    return { resolved };
  }

  // ----------------------------------------------------------------- for the admin page

  async status() {
    const [orders, buyers, mark, unread] = await Promise.all([
      this.prisma.smeetzOrder.count(),
      this.prisma.smeetzBuyer.count(),
      this.prisma.smeetzSyncState.findUnique({ where: { key: WATERMARK } }),
      this.unreadCount(),
    ]);
    return {
      on: this.enabled,
      environment: this.smeetz.environment,
      orders,
      buyersRead: buyers,
      buyersToRead: unread,
      ordersSyncedThrough: mark?.value ?? null,
      lastOrderSync: this.last.orders,
      lastBuyerPass: this.last.buyers,
      lastNightsPass: this.last.nights,
    };
  }
}
