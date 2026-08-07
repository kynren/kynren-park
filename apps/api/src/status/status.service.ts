import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { PushService } from '../notifications/push.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export type Health = 'up' | 'down' | 'degraded';
type DayCell = { date: string; status: Health | 'none' };

export interface ComponentStatus {
  key: string;
  name: string;
  status: Health;
  detail: string;
  latencyMs: number | null;
  checkedAt: string | null;
  uptimePct: number | null;
  days: DayCell[];
}
export interface StatusReport {
  overall: Health;
  intervalMinutes: number;
  lastCheckedAt: string | null;
  components: ComponentStatus[];
}

const COMPONENTS = [
  { key: 'api', name: 'API Server' },
  { key: 'database', name: 'Database' },
  { key: 'email', name: 'Email Notifications' },
  { key: 'push', name: 'Push Notifications' },
  { key: 'realtime', name: 'Realtime (WebSocket)' },
] as const;

const INTERVAL_KEY = 'status.intervalMinutes';
const DEFAULT_INTERVAL = 60;
const HISTORY_DAYS = 90;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class StatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('StatusService');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit() {
    const minutes = await this.getIntervalMinutes();
    this.schedule(minutes);
    // First probe shortly after boot (let the DB/gateway settle).
    setTimeout(() => this.runChecks().catch(() => undefined), 4000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private schedule(minutes: number) {
    if (this.timer) clearInterval(this.timer);
    const ms = Math.max(1, minutes) * 60_000;
    this.timer = setInterval(() => this.runChecks().catch(() => undefined), ms);
    this.logger.log(`Health checks scheduled every ${minutes} min.`);
  }

  // ---- individual probes -----------------------------------------------------
  private async probe(key: string): Promise<{ status: Health; detail: string; latencyMs: number | null }> {
    const t0 = Date.now();
    const ms = () => Date.now() - t0;
    try {
      switch (key) {
        case 'api':
          return { status: 'up', detail: 'API server is responding.', latencyMs: 0 };
        case 'database': {
          await this.prisma.$queryRaw`SELECT 1`;
          return { status: 'up', detail: 'Database connection healthy.', latencyMs: ms() };
        }
        case 'email': {
          const r = await this.mail.verify();
          return { status: r.ok ? 'up' : 'degraded', detail: r.detail, latencyMs: ms() };
        }
        case 'push': {
          const r = await this.push.healthCheck();
          return { status: r.ok ? 'up' : 'degraded', detail: r.detail, latencyMs: ms() };
        }
        case 'realtime': {
          const up = !!this.realtime.server;
          return up
            ? { status: 'up', detail: 'WebSocket gateway online.', latencyMs: ms() }
            : { status: 'down', detail: 'Gateway not initialised.', latencyMs: null };
        }
        default:
          return { status: 'down', detail: 'Unknown component.', latencyMs: null };
      }
    } catch (e) {
      return { status: 'down', detail: (e as Error).message, latencyMs: ms() };
    }
  }

  /** Run every probe, persist the results, prune old rows. Returns the report. */
  async runChecks(): Promise<StatusReport> {
    const rows = await Promise.all(
      COMPONENTS.map(async (c) => {
        const r = await this.probe(c.key);
        return { component: c.key, status: r.status, detail: r.detail, latencyMs: r.latencyMs ?? null };
      }),
    );
    await this.prisma.healthCheck.createMany({ data: rows });
    // Prune history beyond the retention window.
    const cutoff = new Date(Date.now() - HISTORY_DAYS * 864e5);
    await this.prisma.healthCheck.deleteMany({ where: { checkedAt: { lt: cutoff } } }).catch(() => undefined);
    return this.getStatus();
  }

  // ---- reporting -------------------------------------------------------------
  async getStatus(): Promise<StatusReport> {
    const since = new Date(Date.now() - HISTORY_DAYS * 864e5);
    const history = await this.prisma.healthCheck.findMany({
      where: { checkedAt: { gte: since } },
      orderBy: { checkedAt: 'asc' },
      select: { component: true, status: true, detail: true, latencyMs: true, checkedAt: true },
    });

    // Pre-build the 90 day buckets (oldest → today).
    const today = new Date();
    const dayList: string[] = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) dayList.push(dayKey(new Date(today.getTime() - i * 864e5)));

    const components: ComponentStatus[] = COMPONENTS.map((c) => {
      const rows = history.filter((h) => h.component === c.key);
      const latest = rows[rows.length - 1];

      // Worst status seen per day → colour.
      const perDay = new Map<string, Health | 'none'>();
      for (const r of rows) {
        const k = dayKey(r.checkedAt);
        const prev = perDay.get(k);
        const rank = (s: Health | 'none') => (s === 'down' ? 3 : s === 'degraded' ? 2 : s === 'up' ? 1 : 0);
        if (!prev || rank(r.status as Health) > rank(prev)) perDay.set(k, r.status as Health);
      }
      const days: DayCell[] = dayList.map((d) => ({ date: d, status: perDay.get(d) ?? 'none' }));

      const withData = rows.length;
      const ups = rows.filter((r) => r.status === 'up').length;
      const uptimePct = withData ? Math.round((ups / withData) * 1000) / 10 : null;

      return {
        key: c.key,
        name: c.name,
        status: (latest?.status as Health) ?? 'degraded',
        detail: latest?.detail ?? 'No health check has run yet.',
        latencyMs: latest?.latencyMs ?? null,
        checkedAt: latest ? latest.checkedAt.toISOString() : null,
        uptimePct,
        days,
      };
    });

    const overall: Health = components.some((c) => c.status === 'down')
      ? 'down'
      : components.some((c) => c.status === 'degraded')
        ? 'degraded'
        : 'up';
    const lastCheckedAt = history.length ? history[history.length - 1].checkedAt.toISOString() : null;

    return { overall, intervalMinutes: await this.getIntervalMinutes(), lastCheckedAt, components };
  }

  // ---- interval setting ------------------------------------------------------
  async getIntervalMinutes(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: INTERVAL_KEY } });
    const n = row ? parseInt(row.value, 10) : DEFAULT_INTERVAL;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTERVAL;
  }

  async setIntervalMinutes(minutes: number): Promise<StatusReport> {
    const n = Math.max(5, Math.min(24 * 60, Math.round(minutes)));
    await this.prisma.appSetting.upsert({
      where: { key: INTERVAL_KEY },
      create: { key: INTERVAL_KEY, value: String(n) },
      update: { value: String(n) },
    });
    this.schedule(n);
    return this.getStatus();
  }
}
