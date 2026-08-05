# Kynren – The Storied Lands: Visitor App, Backend & Admin Dashboard

## Context

Kynren – **The Storied Lands** is the UK's first live-action *show park*, opening **18 July 2026**
(Tue–Sun, through 12 Sep) in Bishop Auckland, produced by Eleven Arches. Every ticket includes five
attractions — *The Lost Feather* (birds of prey), a medieval horsemanship tale, *Legend of the Wear*
(Lambton Worm on a lake), *Land of the Vikings*, and *Victorian Imaginariums* (a maze) — plus the
separate evening show *Kynren – An Epic Tale of England*.

We are building a **companion visitor platform** that deliberately beats the Puy du Fou app, whose
2.6★ rating stems from concrete, fixable failures. Their app is **fatally dependent on flaky in‑park
Wi‑Fi**: live schedules, translation and even pass purchases break when the network drops; its live
translation/subtitles are unreliable and were reportedly cut back. Our thesis: an **offline‑first**
app with a **smart itinerary planner**, **reliable live schedule with graceful degradation**,
**digital tickets**, **Click & Collect**, and **first‑class accessibility** — backed by a staff
dashboard that pushes real‑time updates — is a categorically better product.

**Deliverables:** (1) Node/TypeScript backend API + PostgreSQL, (2) Expo React Native visitor app,
(3) Next.js staff/admin dashboard, in one monorepo with shared types.

---

## How we elevate over Puy du Fou (design principles)

| Puy du Fou pain point | Our fix |
|---|---|
| Everything dies when in‑park Wi‑Fi drops | **Offline‑first**: map, schedule, attractions, tickets all cached on device; app is fully usable with zero signal, syncs opportunistically |
| Live schedule unreliable | Last‑synced schedule always shown; realtime deltas via WebSocket + push when connected; clear "last updated" timestamps |
| Manual, error‑prone show planning | **Smart itinerary planner**: auto‑builds a conflict‑free route from ticket date + preferences + show durations + walk distances, with reminders |
| Translation/subtitles broken | English‑first (UK audience), but bundle **on‑device i18n** + accessibility info (captioned/relaxed/BSL/sensory) as a differentiator, not a network‑dependent feature |
| No proactive guidance | **Push reminders** ("Vikings starts in 20 min, 5 min walk away") and staff‑pushed alerts |
| Pass/ticket flows fragile | **Digital tickets** with offline QR + Apple/Google Wallet passes |

---

## Architecture

Monorepo via **pnpm workspaces + Turborepo**:

```
kynren-park/
  apps/
    api/         NestJS + Prisma backend (REST + WebSocket gateway)
    mobile/      Expo (React Native, Expo Router) visitor app
    admin/       Next.js (App Router) staff dashboard
  packages/
    db/          Prisma schema, client, migrations, seed
    shared/      Shared TS types + Zod schemas (DTOs) used by all apps
    config/       Shared eslint/tsconfig/tailwind presets
  docker-compose.yml   Postgres + Redis for local dev
  turbo.json
```

**Stack**
- **API:** NestJS (modular DI suits full feature set) · Prisma ORM · PostgreSQL · Redis (cache +
  pub/sub + BullMQ job queue) · Socket.IO gateway for realtime · JWT access/refresh auth · Zod/DTO
  validation · Swagger/OpenAPI docs.
- **Mobile:** Expo + Expo Router · TypeScript · TanStack Query with persisted cache · MMKV +
  `expo-sqlite` for offline store · Zustand for UI state · `expo-notifications` (Expo Push) ·
  MapLibre/`react-native-maps` with offline tiles · Reanimated · NativeWind styling.
- **Admin:** Next.js App Router · shadcn/ui + Tailwind · TanStack Query · Auth.js (staff) ·
  role‑based access.
- **Shared:** Zod schemas define request/response contracts once; types flow to app + admin.
- **DB provisioning:** local Postgres via Docker for dev; Prisma Postgres (Console/Management API)
  or managed Postgres for staging/prod. (Prisma MCP server needs authorizing in an interactive
  session before its tools can be used — noted, not a blocker for scaffolding.)

---

## Data model (Prisma — representative, not exhaustive)

Core entities in `packages/db/prisma/schema.prisma`:

- **User** (visitor: id, email, name, authProviders, pushTokens[], locale, accessibilityPrefs)
- **StaffUser** + **Role** (ADMIN, OPS, FNB, CONTENT) for the dashboard
- **Attraction** (slug, name, category `BIRDS|HORSE|LAKE|VIKINGS|MAZE|EVENING_SHOW|OTHER`,
  synopsis, media[], durationMins, capacity, defaultLat/Lng or map coords, accessibility flags)
- **ShowSession** (attractionId, date, startTime, endTime, status
  `SCHEDULED|DELAYED|CANCELLED|FULL|FINISHED`, capacity, updatedAt) — the live‑schedule unit
- **PointOfInterest** (type `ATTRACTION|RESTAURANT|RESTROOM|SHOP|FIRST_AID|ENTRANCE|PARKING|
  ACCESSIBILITY`, name, lat, lng, mapZone)
- **Restaurant** (name, cuisine, priceRange, openingHours, poiId) + **MenuItem** (name, price,
  dietaryTags[], available)
- **Order** + **OrderItem** (Click & Collect: user, restaurant, pickupSlot, status
  `PENDING|PREPARING|READY|COLLECTED|CANCELLED`, total)
- **TicketType** (name e.g. "Advance Saver Adult", price, category adult/child) + **Ticket/Booking**
  (user, ticketTypeId, visitDate, partySize, qrToken, status)
- **Itinerary** (user, date) + **ItineraryItem** (showSessionId, order, reminderMins)
- **Favorite** and **AttractionSeen** (tracking what's been experienced)
- **Announcement/Notification** (title, body, audience, deepLink, scheduledAt, sentAt)
- **ContentPage** (FAQ, park info, safety, accessibility guide — CMS‑lite)

Migrations managed with `prisma migrate`; a **seed script** loads the real Kynren opening season:
the 5 attractions, POIs, ticket types (£30 adult / £20 child Advance Saver), and a sample schedule.

---

## Backend API (NestJS modules)

- **auth** — visitor register/login (email OTP or password), JWT + refresh rotation, staff login.
- **attractions** — list/detail, media, categories.
- **schedule** — sessions by date; `PATCH` status (staff) emits WebSocket event + queues push.
- **map** — POIs, zones, offline map bundle endpoint (`/sync/bundle?date=` returns everything the
  app needs for offline use in one payload + an ETag for delta sync).
- **itinerary** — CRUD + `POST /itinerary/optimize` (greedy/interval‑scheduling over selected
  attractions honoring durations, walk distances between POIs, and session times).
- **tickets** — ticket types, bookings, QR issuance/validation (staff scan endpoint).
- **food** — restaurants, menus, orders; order status transitions (staff fulfillment).
- **notifications** — Expo push dispatch (BullMQ scheduled jobs for reminders + announcements).
- **content** — FAQ/park info pages.
- **realtime** (gateway) — rooms per visit date; broadcasts schedule/announcement deltas.
- **admin** — guarded by role; content + schedule + orders + analytics aggregations.

Cross‑cutting: global validation pipe (Zod), rate limiting, structured logging, OpenAPI at `/docs`,
health checks. Redis caches the sync bundle and backs pub/sub so multiple API instances stay in sync.

---

## Mobile app (Expo, offline‑first)

Screens/flows (Expo Router):
- **Onboarding + Auth** — quick email OTP; guest mode allowed (planning works without an account).
- **Home / "Today at Kynren"** — next shows, your itinerary, live alerts, "last synced" chip.
- **Map** — offline tiles, POI filters, my‑location, tap‑to‑route; works with no signal.
- **Attractions** — list + rich detail (media, times, accessibility), "Add to my day".
- **Itinerary planner** — pick shows → **Optimize** → conflict‑free timed route + reminders.
- **Tickets & Wallet** — digital tickets, offline QR, Add to Apple/Google Wallet.
- **Food & Click‑and‑Collect** — browse menus, order, choose pickup slot, track status.
- **Notifications inbox** — reminders + staff announcements (deep links).
- **Park info & Accessibility** — FAQ, safety, accessibility guide, opening hours.
- **Profile** — favorites, "seen" tracking, prefs.

Offline strategy: on launch/login fetch the **sync bundle**, persist to SQLite/MMKV; TanStack Query
reads cache‑first; a background sync reconciles deltas + shows a "last updated" indicator; realtime
socket applies live patches when connected; reminders scheduled locally so they fire without network.

---

## Admin dashboard (Next.js)

- **Staff auth** with roles.
- **Live schedule board** — the key ops screen: grid of today's sessions, one‑tap
  DELAYED/CANCELLED/FULL → instantly pushed to every app via WebSocket + optional push.
- **Content management** — attractions, POIs, FAQ/info pages, media.
- **Announcements** — compose + target + schedule push notifications.
- **Food ops** — incoming Click & Collect orders, mark PREPARING/READY/COLLECTED.
- **Tickets** — ticket types, and a scan/validation view.
- **Analytics** — attendance, popular attractions, order volume, notification performance.

---

## Build sequence (full set, sequenced so it always runs)

- **M0 — Foundation:** monorepo scaffold, Docker Postgres/Redis, Prisma schema + migrations +
  Kynren seed, shared Zod package, auth (visitor + staff), CI, OpenAPI. *Runnable API + empty apps.*
- **M1 — Core visitor loop:** attractions, map + offline sync bundle, live schedule, itinerary
  planner/optimizer in the app; admin content + **live schedule board**. *The headline experience.*
- **M2 — Tickets & engagement:** ticket types/bookings, offline QR + Wallet passes, notifications +
  announcements, favorites/"seen".
- **M3 — Food:** restaurants/menus, Click & Collect ordering, admin order fulfillment.
- **M4 — Inclusion & polish:** accessibility features + i18n, analytics dashboard, hardening,
  performance, app‑store/Play‑store prep.

---

## Verification

- **API:** Jest unit + e2e (supertest) against a disposable test Postgres; run `prisma migrate` +
  seed; `pnpm --filter api test`. OpenAPI/Swagger reachable at `/docs`.
- **Mobile:** run via Expo dev client; Maestro flows for auth → plan a day → optimize → offline
  (airplane‑mode) still shows schedule/map/tickets.
- **Admin:** Playwright e2e for login → change a session to DELAYED.
- **End‑to‑end demo (the proof):** in admin, mark *Land of the Vikings* DELAYED → the mobile app
  receives the live update over WebSocket and fires a push notification, **and** the change is still
  visible after killing the network (served from offline cache).

## First implementation steps (on approval)

1. Scaffold monorepo (pnpm + Turbo), `docker-compose.yml` (Postgres + Redis), shared tsconfig/eslint.
2. `packages/db`: Prisma schema above + first migration + Kynren seed data.
3. `packages/shared`: Zod DTOs.
4. `apps/api`: NestJS bootstrap, auth + attractions + schedule + sync modules, OpenAPI.
5. `apps/admin`: Next.js login + live schedule board.
6. `apps/mobile`: Expo scaffold, sync bundle + offline store, Home/Map/Attractions/Planner.
