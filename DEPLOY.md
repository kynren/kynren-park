# Deployment

The backend (`api`) and staff dashboard (`admin`) ship as Docker images. The Expo app is
distributed through the app stores (see `apps/mobile/STORE-SUBMISSION.md`).

## Option A — full self-hosted stack (Docker Compose)

Brings up Postgres, Redis, the API and the admin dashboard together.

```bash
# 1. Set secrets (used by the api service)
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export TICKET_QR_SECRET=$(openssl rand -hex 32)
# Public URL browsers use to reach the API (inlined into the admin build):
export NEXT_PUBLIC_API_URL=http://localhost:4000

# 2. Build & start
docker compose up -d --build

# 3. Run migrations + seed once (against the compose Postgres)
docker compose exec api npm run db:migrate:deploy
docker compose exec api npx tsx packages/db/prisma/seed.ts
```

- API → http://localhost:4000 (Swagger at `/docs`)
- Admin → http://localhost:3000 (login `admin@kynren.com` / `kynren-admin`)

## Option B — managed database (Prisma Postgres / Neon / RDS)

Drop the `postgres` service and point the API at the managed URL. Set `DATABASE_URL` in the
`api` service environment (or an `.env`), then:

```bash
docker compose up -d --build api admin
npm run db:migrate:deploy      # from a machine with DATABASE_URL set
```

## Building images individually

Build context is always the **repo root**:

```bash
docker build -f apps/api/Dockerfile   -t kynren-api   .
docker build -f apps/admin/Dockerfile -t kynren-admin --build-arg NEXT_PUBLIC_API_URL=https://api.kynren.com .
```

## Production notes

- **Secrets**: generate strong `JWT_*` and `TICKET_QR_SECRET`; never reuse the dev values.
- **Migrations**: run `db:migrate:deploy` on every release *before* rolling the API (it applies
  committed migrations only; it never generates or resets).
- **CORS**: set `CORS_ORIGINS` on the API to the admin origin(s), not `*`, in production.
- **NEXT_PUBLIC_API_URL** is baked into the admin image at build time — rebuild the admin image
  when the API URL changes.
- **Redis** is provisioned for future caching/queues; the current API runs without it.
- **TLS**: terminate HTTPS at a reverse proxy (Caddy/Nginx/managed LB) in front of both services.
- **Health check**: the API exposes `GET /api/health` → `{ status, db, time }` for load balancers.
