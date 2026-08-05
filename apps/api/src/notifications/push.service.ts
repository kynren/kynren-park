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
