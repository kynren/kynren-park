import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service.js';

/** Sends Expo push notifications to visitors' devices. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

  constructor(private readonly prisma: PrismaService) {}

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
   */
  async resolveTemplate(action: string, vars: Record<string, string>, fallback: { title: string; body: string }) {
    const t = await this.prisma.notificationTemplate.findFirst({
      where: { action, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!t) return fallback;
    return { title: this.interp(t.title, vars), body: this.interp(t.body, vars) };
  }

  async sendTemplatedToUsers(
    userIds: string[], action: string,
    fallback: { title: string; body: string }, vars: Record<string, string>, data?: Record<string, unknown>,
  ) {
    const { title, body } = await this.resolveTemplate(action, vars, fallback);
    await this.sendToUsers(userIds, title, body, data);
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

    try {
      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch (err) {
      this.logger.error(`Push send failed: ${(err as Error).message}`);
    }
  }
}
