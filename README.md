# Kynren – The Storied Lands · Visitor Platform

An **offline-first** companion platform for **Kynren – The Storied Lands** (Bishop Auckland),
deliberately engineered to beat the pain points of comparable park apps (e.g. Puy du Fou's, whose
low rating stems from total dependence on flaky in-park Wi-Fi).

Three parts, one monorepo:

| App | Stack | What it is |
|-----|-------|------------|
| `apps/api` | NestJS · Prisma · PostgreSQL · Socket.IO | REST API, realtime gateway, push, itinerary optimiser |
| `apps/mobile` | Expo · React Native · Expo Router | Offline-first visitor app (map, planner, tickets, food) |
| `apps/admin` | Next.js (App Router) | Staff dashboard — **live schedule board**, announcements, analytics |
| `packages/db` | Prisma | Schema, migrations, Kynren season seed |
| `packages/shared` | Zod | Shared DTOs, the itinerary optimiser, password hashing |

## Why it's better

- **Works with zero signal.** The app boots from a cached *sync bundle* (map, schedule, attractions,
  tickets). A dead network never breaks the visit; it just shows a "last updated" chip.
- **Smart itinerary planner.** Pick shows → get a walkable, clash-free timetable with reminders.
- **Truly live schedule.** Staff flip a show to Delayed/Cancelled and every phone updates instantly
  (WebSocket) plus a push to guests who have it planned.
- **Offline QR tickets** — entry isn't hostage to Wi-Fi.
- **Accessibility first** — step-free / audio-described / captioned / BSL / sensory notes surfaced everywhere.

---

## Prerequisites

- Node ≥ 20 (tested on Node 24)
- A PostgreSQL database. Either:
  - local Postgres, or
  - a hosted one (e.g. Prisma Postgres / Neon / Supabase) — just paste its URL.
- (Optional) Redis, for future caching/queues. Not required to run the core today.

## 1. Install & configure

```bash
npm install
npm run setup             # builds the shared/db packages + generates the Prisma client
cp .env.example .env      # then edit DATABASE_URL etc.
```

> `npm run setup` builds `packages/shared` and `packages/db` to JS. Re-run `npm run build:packages`
> after editing either package so the apps pick up the changes.

## 2. Database

```bash
npm run db:generate       # generate Prisma client
npm run db:migrate        # create the schema (prompts for a migration name)
npm run db:seed           # load the real Kynren 2026 season + a staff login
```

Seed staff login: **admin@kynren.com / kynren-admin**

## 3. Run

```bash
npm run dev:api           # http://localhost:4000  (Swagger at /docs)
npm run dev:admin         # http://localhost:3000  (staff dashboard)
npm run dev:mobile        # Expo — scan the QR with Expo Go, or press w for web
```

> On a physical phone, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (e.g.
> `http://192.168.1.20:4000`) so the device can reach the API.

---

## The end-to-end proof

1. Open the **admin dashboard** → *Live Schedule* (date `2026-07-18`).
2. Open the **mobile app** → *Today* tab.
3. In admin, mark **Land of the Vikings** as *Delayed*.
4. The mobile app's *Today* screen updates **instantly** over WebSocket, and guests with it planned
   get a push.
5. Put the phone in **airplane mode** and reopen — the schedule, map and tickets are **still there**,
   served from the offline cache with an "Offline · updated N min ago" chip.

## Verification / tests

```bash
npm run typecheck                    # type-check every workspace
npm run test --workspace @kynren/api # API e2e (boots Nest against the DB) + optimiser unit tests
```

The API test suite boots the real Nest app on an ephemeral port and asserts the core flows
(health, catalogue, itinerary optimise, register→book→offline-QR→single-use validation, auth guards).

## Production readiness

- **Deployment** — Dockerfiles for `api` and `admin`, plus `docker-compose.yml` (Postgres + Redis +
  both apps). See [DEPLOY.md](DEPLOY.md).
- **CI** — [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push/PR: install,
  build packages, migrate + seed a Postgres service, typecheck all, build API + admin, run API tests,
  type-check mobile.
- **App store** — EAS build/submit config and a full checklist in
  [apps/mobile/STORE-SUBMISSION.md](apps/mobile/STORE-SUBMISSION.md).

## Roadmap (milestones)

- **M2 ✅ Tickets & engagement** — mobile auth (login/register), booking flow → offline QR tickets,
  notification inbox + Expo push registration, favourites/"seen". (Wallet passes stubbed — need
  Apple/Google signing certs.)
- **M3 ✅ Click & Collect** — mobile Food tab + restaurant menus + cart + pickup slots + My Orders
  (live status), and an admin **Kitchen** board (live queue, advance PREPARING→READY→COLLECTED).
- **M4 ✅ Analytics & i18n** — enriched analytics API + charted admin dashboard (revenue, status
  breakdowns, most-engaging attractions), and on-device **i18n** in the mobile app (English + FR/ES/DE/NL,
  fully offline, with a language switcher) — directly answering Puy du Fou's broken live translation.
  Also: an upgraded **offline park map** (drawn zones, path connectors, drag-pan + zoom — no tile
  server, works with no signal), branded icons/splash, and full **app-store submission prep** (EAS
  build/submit profiles + `STORE-SUBMISSION.md`). The Expo app fully bundles (`expo export` green).

**All five milestones (M0–M4) are complete.**

See `.claude/plans/` for the full architecture plan.
