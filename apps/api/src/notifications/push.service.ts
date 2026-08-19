import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service.js';

/** Sends Expo push notifications to visitors' devices. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

  constructor(private readonly prisma: PrismaService) {}

  /** Health probe: Expo push has no ping, so report readiness + device count. */
  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      const n = await this.prisma.pushToken.count();
      return { ok: true, detail: `Expo push ready · ${n} device${n === 1 ? '' : 's'} registered.` };
    } catch {
      return { ok: true, detail: 'Expo push ready.' };
    }
  }

  async sendToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
    if (userIds.length === 0) return;
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    await this.sendToTokens(tokens.map((t) => t.token), title, body, data);
  }

  private interp(s: string, vars: Record<string, string>) {
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  /**
   * Resolve the active admin template for an action and interpolate {vars};
   * falls back to the provided default copy when no template is assigned.
   * Also surfaces the template's own configured deepLink (interpolated the
   * same way) — the admin UI collects one per template, but nothing read it
   * back until now, so a tap on one of these pushes went nowhere.
   */
  async resolveTemplate(
    action: string, vars: Record<string, string>, fallback: { title: string; body: string; deepLink?: string },
  ) {
    const t = await this.prisma.notificationTemplate.findFirst({
      where: { action, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!t) return fallback;
    return {
      title: this.interp(t.title, vars),
      body: this.interp(t.body, vars),
      deepLink: t.deepLink ? this.interp(t.deepLink, vars) : fallback.deepLink,
    };
  }

  async sendTemplatedToUsers(
    userIds: string[], action: string,
    fallback: { title: string; body: string; deepLink?: string }, vars: Record<string, string>, data?: Record<string, unknown>,
  ) {
    const { title, body, deepLink } = await this.resolveTemplate(action, vars, fallback);
    await this.sendToUsers(userIds, title, body, deepLink ? { ...data, deepLink } : data);
  }

  async sendToAll(title: string, body: string, data?: Record<string, unknown>) {
    const tokens = await this.prisma.pushToken.findMany({ select: { token: true } });
    await this.sendToTokens(tokens.map((t) => t.token), title, body, data);
  }

  private async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
    const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (valid.length === 0) return;

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      data: data ?? {},
    }));

    const dead: string[] = [];
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'error' && (ticket.details as { error?: string } | undefined)?.error === 'DeviceNotRegistered') {
            dead.push((chunk[i] as ExpoPushMessage).to as string);
          }
        });
      } catch (err) {
        this.logger.error(`Push send failed: ${(err as Error).message}`);
      }
    }

    // Prune tokens Expo reports as uninstalled/unregistered so the list stays clean.
    if (dead.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } }).catch(() => undefined);
      this.logger.log(`Pruned ${dead.length} unregistered push token(s).`);
    }
  }
}
