# Deploying the Kynren Admin (+ API) to a Hostinger VPS

This hosts the **admin console** with Docker + Nginx + free TLS. Because the admin
calls the API **from the browser**, the API must also be publicly reachable over
HTTPS — so this guide brings up the API (and its database) on the same VPS.

```
Browser ──HTTPS──▶ Nginx (host) ──┬─▶ app-park.kynren.com → admin container :3000
                                  └─▶ api.kynren.com      → api   container :4000
                                             api ─▶ postgres + redis (compose network, loopback only)
```

**Key gotcha:** `NEXT_PUBLIC_API_URL` is baked into the admin at **build time**.
Decide the API's public URL *before* building. Change it later ⇒ rebuild the admin.

---

## 0. Prerequisites

- The Hostinger VPS (Ubuntu 22.04/24.04). Yours: **168.231.115.199**.
- DNS **A records** → `168.231.115.199`:
  - `app-park.kynren.com` ✅ already pointed.
  - `api.kynren.com` — **add this** (admin + mobile both call it). Do it in your
    Hostinger/DNS panel now; propagation can take a few minutes.
- SSH access: `ssh root@168.231.115.199`.

---

## 1. Install Docker, Nginx, Certbot (on the VPS)

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
# Nginx + Certbot
apt update && apt install -y nginx certbot python3-certbot-nginx git
```

## 2. Get the code

Private repo → use a GitHub deploy key or a personal access token.

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/kynren/kynren-park.git
cd kynren-park
git checkout feature/admin-console-and-mobile-revamp   # or master once merged
```

## 3. Configure environment

```bash
cp .env.production.example .env
# generate three secrets:
for k in JWT_ACCESS_SECRET JWT_REFRESH_SECRET TICKET_QR_SECRET; do echo "$k=$(openssl rand -hex 32)"; done
nano .env
```

Set in `.env`:
- `NEXT_PUBLIC_API_URL=https://api.kynren.com`
- `CORS_ORIGINS=https://app-park.kynren.com`
- the three `JWT_*` / `TICKET_QR_SECRET` values you generated
- **Database — pick one:**
  - **Managed (recommended, already seeded):** set `DATABASE_URL=` to your Prisma
    Postgres URL. You can then stop the built-in DB: `docker compose stop postgres`.
  - **Built-in Postgres container:** leave `DATABASE_URL` commented. The DB starts
    empty — you'll push the schema + seed in step 5.

## 4. Build & start the stack

```bash
docker compose build          # builds api + admin images (~3–5 min)
docker compose up -d
docker compose ps             # api, admin, postgres, redis should be "Up"
```

## 5. (Built-in DB only) create schema + seed

Skip if you used a managed `DATABASE_URL` that's already seeded.

The schema is applied with `prisma db push` (this project keeps no migration
files), then the season data is seeded:

```bash
docker compose exec api npx prisma db push --schema packages/db/prisma/schema.prisma --skip-generate
docker compose exec api npm run seed --workspace @kynren/db
```

Quick check the API answers locally (public endpoint):

```bash
curl -s localhost:4000/api/announcements
```

## 6. Nginx reverse proxy

```bash
cp deploy/nginx/app-park.kynren.com.conf /etc/nginx/sites-available/
cp deploy/nginx/api.kynren.com.conf      /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/app-park.kynren.com.conf /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api.kynren.com.conf      /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 7. TLS certificates (you run this — it accepts Let's Encrypt's terms)

```bash
certbot --nginx -d app-park.kynren.com -d api.kynren.com
```

Choose **redirect HTTP→HTTPS** when asked. Certbot rewrites both Nginx blocks to
add the `:443` servers and auto-renews via a systemd timer.

## 8. Verify

- Visit **https://app-park.kynren.com** → the staff login loads.
- Log in (staff account). If data loads and there are no CORS errors in the
  browser console, the admin ↔ API path is working end-to-end.

---

## Firewall (recommended)

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Postgres/Redis are bound to `127.0.0.1` in `docker-compose.yml`, so they are not
reachable from the internet even with the firewall off — but enable it anyway.

## Updating after new commits

```bash
cd /opt/kynren-park && git pull
docker compose build && docker compose up -d      # rebuild changed images
```

## Notes

- **CORS:** the API allows the origins in `CORS_ORIGINS` (plus localhost). If you
  serve the admin on a different domain, add it there and restart the api.
- **Mobile app:** it's compiled to call `https://api.kynren.com` (see
  `apps/mobile/app.json`). Hosting the API there makes the mobile app work too.
- **Secrets:** the real `.env` and any DB dumps must never be committed — the repo
  only tracks `.env.production.example`.
