import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

/**
 * Load the monorepo-root `.env` regardless of how the API is launched
 * (`nest start`, `node dist/main.js`, tests) or the current working directory.
 * Skipped gracefully if variables are already present (e.g. `--env-file`).
 */
function loadRootEnv() {
  if (process.env.DATABASE_URL) return;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(here, '../../../.env'), // apps/api/dist/main.js -> repo root
    resolve(here, '../../../../.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      process.loadEnvFile(p);
      return p;
    }
  }
  return null;
}

async function bootstrap() {
  const envPath = loadRootEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Trust exactly one hop of reverse proxy (Caddy, in front of this API in
  // every deployed environment) so req.ip reflects the real client IP from
  // X-Forwarded-For instead of Caddy's own container IP. Without this,
  // every request looks like it comes from the same address, and
  // ThrottlerGuard's per-client rate limits (see app.module.ts) would end
  // up shared across every actual user instead of applying per-client.
  app.set('trust proxy', 1);
  // Standard security headers (X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, etc.). CSP off: this API mostly serves JSON
  // to the mobile app/admin, not HTML, and a default CSP breaks the /docs
  // Swagger UI's inline scripts/styles — not worth fighting for an API.
  app.use(helmet({ contentSecurityPolicy: false }));
  // Larger limit so uploaded map images (base64 data URLs) aren't rejected.
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // CORS: allow the configured production origins PLUS any localhost origin.
  // The admin dev server uses a dynamic port (autoPort), so a fixed allowlist
  // would block it — any http(s)://localhost:<port> / 127.0.0.1 is permitted.
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAll = configured.includes('*');
  const localhostRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.enableCors({
    credentials: true,
    origin: allowAll
      ? true
      : (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          // No Origin header → non-browser client (curl, mobile app): allow.
          if (!origin || localhostRe.test(origin) || configured.includes(origin)) {
            cb(null, true);
          } else {
            cb(null, false);
          }
        },
  });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Kynren Park API')
    .setDescription('Backend for the Kynren – The Storied Lands visitor app and staff dashboard.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Bind the platform-provided PORT (Compute/containers set this) on all
  // interfaces so public ingress can reach it; fall back to API_PORT locally.
  const port = parseInt(process.env.PORT || process.env.API_PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`Env loaded from ${envPath ?? 'process environment'}`);
  log.log(`Kynren API listening on 0.0.0.0:${port} (docs at /docs)`);
}

bootstrap();
