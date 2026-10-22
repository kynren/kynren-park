import { Injectable, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

/** Whether a token is an Expo push token (`ExponentPushToken[…]`) rather than a native device token. */
export const isExpoToken = (t: string) => /^(Exponent|Expo)PushToken\[.+\]$/.test(t);

/** A native FCM registration token (what the Flutter app registers): long, URL-safe, with a colon. */
export const isFcmToken = (t: string) => t.length >= 100 && t.length <= 4096 && /^[\w:.-]+$/.test(t) && !isExpoToken(t);

const DEAD_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

/**
 * Sends to native devices through Firebase Cloud Messaging (the Flutter app registers FCM tokens on both Android and
 * iOS; FCM relays to Apple for iOS). Switched on by `FIREBASE_SERVICE_ACCOUNT_JSON`, the service-account key as JSON
 * (or base64 of it); with it unset the service is simply disabled and Expo tokens carry on as before.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private messaging: Messaging | null = null;
  private tried = false;

  /** Whether native sends are configured. */
  get enabled(): boolean {
    return this.init() !== null;
  }

  private init(): Messaging | null {
    if (this.tried) return this.messaging;
    this.tried = true;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) return null;
    try {
      const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const app: App = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(json)) });
      this.messaging = getMessaging(app);
      this.logger.log('Firebase Cloud Messaging is on for native devices.');
    } catch (err) {
      this.logger.error(`FIREBASE_SERVICE_ACCOUNT_JSON could not be read: ${(err as Error).message}`);
    }
    return this.messaging;
  }

  /** Send to native tokens. Returns the tokens FCM says are gone, so the caller can prune them. */
  async send(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<string[]> {
    const messaging = this.init();
    if (!messaging || tokens.length === 0) return [];

    // FCM data values must all be strings.
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {})) if (v != null) flat[k] = typeof v === 'string' ? v : JSON.stringify(v);

    const dead: string[] = [];
    // FCM takes up to 500 tokens per call.
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      try {
        const res = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: flat,
          android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        res.responses.forEach((r, idx) => {
          if (!r.success && r.error && DEAD_CODES.has(r.error.code)) dead.push(chunk[idx]!);
        });
      } catch (err) {
        this.logger.error(`FCM send failed: ${(err as Error).message}`);
      }
    }
    return dead;
  }
}
