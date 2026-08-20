import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

// Prisma v7 no longer auto-loads .env for CLI commands (generate/migrate/
// studio/seed) — mirrors apps/api/src/main.ts's loader so the same
// monorepo-root .env keeps working regardless of cwd. Skipped when
// DATABASE_URL is already set (e.g. the Docker build passes it inline).
if (!process.env.DATABASE_URL) {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, '../../.env'); // packages/db -> repo root
  if (existsSync(p)) process.loadEnvFile(p);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
