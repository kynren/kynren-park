import { defineComputeConfig } from '@prisma/compute-sdk/config';

/**
 * Prisma Compute deploy config for the Kynren API.
 *
 * The API is a monorepo NestJS app: it depends on the workspace packages
 * @kynren/shared and @kynren/db (Prisma) which must be built and generated
 * before `nest build`. Compute's managed NestJS strategy doesn't do that, so
 * we deploy as a `custom` target whose build command runs the whole pipeline,
 * and stage the repo root (which then contains node_modules + built dist) with
 * the compiled Nest entrypoint.
 */
export default defineComputeConfig({
  apps: {
    api: {
      root: '.',
      framework: 'custom',
      httpPort: 4000,
      build: {
        command:
          'npm install --workspace @kynren/api --workspace @kynren/db --workspace @kynren/shared --include-workspace-root --no-audit --no-fund && npm run build:packages && npx cross-env DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public npm run db:generate && npm run build --workspace @kynren/api',
        outputDirectory: '.',
        entrypoint: 'apps/api/dist/main.js',
      },
      env: {
        file: '.env',
        vars: {
          NODE_ENV: 'production',
          CORS_ORIGINS: '*',
        },
      },
    },
  },
});
