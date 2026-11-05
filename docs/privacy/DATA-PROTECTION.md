# Data protection record: Kynren park app, API and group-booking app

**Status:** working draft written from the code and the server on **4 November 2026**. It is not legal advice and has not been
reviewed by whoever owns data protection for Kynren. Items marked **[CONFIRM]** are facts only that person can supply.

Controller: **[CONFIRM: legal entity, ICO registration number, data protection contact]**. UK GDPR and the Data Protection Act 2018 apply.

---

## 1. Where personal data lives

| System | Where it runs | Personal data held |
|---|---|---|
| **Park API and database** (`apps/api`, Postgres `kynren-park-postgres`) | Self-hosted server in the office, UK | Guest accounts: email, name, password hash, language, accessibility preferences (may reveal health information, which is special-category data: **[CONFIRM] basis and wording of the consent**), app preferences, last known location, notification tokens, bookings, itineraries, favourites, notifications, links to Smeetz orders |
| **Smeetz order mirror** (same database) | same | For **every ticket buyer**, not only app users: email, name, company, phone, address (`SmeetzBuyer`); order lines with ticket attendee names and QR payloads (`SmeetzOrderLine`) |
| **Admin console** (`apps/admin`) | same server | Staff accounts |
| **Group-booking app** (`Kynren Group Booking`, container `kynren-groups`, SQLite under `/var/lib/kynren`) | same server | Companies and their contacts (names, emails, phones, billing addresses), bookings, payments and instalments, chat and email history, attachments, an activity log including IP addresses |
| **Phone app** (Flutter) | Guest's phone | Favourites, cached bundle, saved parked-car spot and meeting spot, and tickets, all on the device only |

## 2. Who else receives it

| Recipient | What | Needs |
|---|---|---|
| Google (Firebase Cloud Messaging) | Notification token and message text | Transfer mechanism outside the UK **[CONFIRM]**; named in the privacy policy (done) |
| Smeetz (ticketing) | We read orders from it; nothing is written back | Data-processing or data-sharing agreement **[CONFIRM]** |
| Anthropic (group-booking app AI features) | Booking facts and customer messages when a super admin has switched AI on and added a key. Off by default. The enquiry reader masks personal details first | Data-processing terms and transfer mechanism **[CONFIRM]**; decide whether this belongs in the group-booking privacy notice |
| Microsoft (SharePoint workbook) | Group-booking spreadsheet read | Covered by the Microsoft tenant's terms **[CONFIRM]** |
| Email provider (SMTP) | Every email the apps send | Provider's processing terms **[CONFIRM]** |
| Old Hostinger VPS | SSH relay only; formerly the host | Confirm it holds no guest data any more |
| Old Prisma cloud database | A copy of guest and staff data from before the move, "treated as dead" | **Delete it** or confirm it was emptied |

## 3. Retention: what is enforced today

| Data | Kept for | Enforced by |
|---|---|---|
| A guest's last known location and when it was seen | 6 hours | `LocationRetentionService` sweeping every 15 minutes (written 4 Nov, **live once the API is next deployed**) |
| One-off database dumps and snapshots in `/srv/backups` and `/home/kynren/backups` (park and group-booking) | 14 days | `/home/kynren/prune-old-backups.sh`, daily cron for the `kynren` account at 03:30 (installed 4 Nov) |
| Park database, encrypted nightly backup in `/srv/backups` | 14 days | `/home/kynren/backup-park-db.sh` at 02:45 (installed 4 Nov), pruned by `prune-old-backups.sh` |
| Group-booking nightly backups (now encrypted) | 30 days. Older plain ones from before 4 Nov age out within 30 days | `deploy/backup.sh` |
| Group-booking activity log | 365 days (a setting) | Nightly `prune-activity.mjs` |
| Group-booking deleted orders | 30 days (a setting), then purged | Nightly `purge-deleted.mjs` |
| Account deleted by the guest | Anonymised straight away: name, email, password hash, preferences, location, notification tokens, order links | `DELETE /me`. Booking and order rows stay, with no identity |

**Not defined, and needs a decision:**
- **`SmeetzBuyer` and the order mirror** are kept indefinitely, include people who never installed the app, and are **not touched when an app account is deleted**. Deleting the rows is not enough on its own, because the next sync reads the order again and recreates them, so erasure needs a suppression list. A retention rule (for example only buyers with an order in the last N years, or a visit still to come) would also shrink the exposure.
- Notifications and anonymised bookings and orders: **[CONFIRM] period**, matching the accounting retention in the privacy policy.
- Group-booking customer records after the season.

## 4. Security measures (checked on the server, 4 Nov 2026)

In place: HTTPS through Caddy; databases not published to the internet; secrets files mode 600; backup folders mode 700 and files 600; automatic security updates on; the API's port 4000 firewalled to localhost and Docker only; root SSH login limited to keys; the group-booking cleanup jobs (activity log, deleted orders, reminders) present in root's crontab; AI features off by default; guest data export and erasure endpoints.

Also done on 4 Nov: the park and group-booking backups are encrypted to a public key (the private key is not on the server) and the park database now has a nightly backup; the park database and redis moved to a private Docker network only the API can reach (checked: the group-booking container cannot resolve them); the server was rebooted onto the current kernel and everything came back.

Gaps, in order of importance:
1. **Backups exist only on this server's disk.** They are encrypted now, but a second copy somewhere else is still needed. The office NAS is the obvious place; it is on the office network, so a fire or theft still takes both. A UK/EEA off-site destination would cover that. **Prove a restore** with the private key before relying on them.
2. **The disk is not encrypted** (plain ext4 on the root disk). Fixing it means a rebuild, or moving the database to an encrypted volume. Until then, physical security of the room matters.
3. **One account does everything.** `kynren` is in the `docker` group and has passwordless sudo, so a compromise of it is a compromise of the whole server.
4. **Other apps still share a network with the Kynren API and admin** (jarvis, cypher, myarcher, live-wire, enyara, the asset register). The databases are now out of their reach, but the API itself is not.
5. **SSH password login is enabled** (`passwordauthentication yes`). Keys already work, so turn passwords off once everyone who logs in has a key.
6. **The old Hostinger server still runs a complete stale copy of the stack** (nothing uses it: every hostname it served now points at the new server): groups, api, admin, redis, the asset register and its Postgres, kynrenops. It holds old customer, staff and guest data. Stop it, keep a final encrypted archive if wanted, then delete it.
7. Old `.env.bak-*` files hold superseded secrets in `/srv/kynren-park` and `/home/kynren/backups`.

## 5. Location: short impact assessment

- **Purpose:** show a guest where they are on the map, and show staff roughly how many signed-in guests are in the park.
- **Necessity:** the map position is computed on the phone and not sent. Only the position reported once a session by a signed-in guest who has allowed location is stored, and it now expires after 6 hours.
- **Risks:** a stored position ties a named account to a place and time. The admin console's users list returns each guest's presence with their name and email, which is more than "approximate footfall". Children are among the guests.
- **Mitigations in place:** consent through the device permission; 6-hour expiry; no background location. **Recommended:** make the staff view aggregate-only (a count, not named guests), and **[CONFIRM]** that the consent screen explains this before the guest allows location.

## 6. If personal data is lost or exposed

The ICO must be told **within 72 hours** of becoming aware of a breach that risks people's rights, and affected people told without delay if the risk is high.

1. Whoever finds it tells **[CONFIRM: named person and deputy]** immediately and writes down what, when, and how it was found.
2. Contain it: take the affected service down or revoke the key (rotate `.env` secrets, sign everyone out by changing `AUTH_SECRET`).
3. Work out whose data and what kind (the tables in section 1 say what each system holds).
4. The named person decides on reporting to the ICO (ico.org.uk, 0303 123 1113) and to guests, and records the decision either way.
5. Keep the log: server logs, the activity log and `docker logs` are the evidence, so copy them before restarting anything.

## 7. Still to do, and who

| Item | Owner |
|---|---|
| Confirm the bracketed facts in the privacy policy and here | Data protection owner |
| Agreements and transfer mechanisms with each recipient in section 2 | Data protection owner |
| Delete the old Prisma cloud database | Account holder (Prisma console) |
| Stop, archive and delete the old Hostinger stack (gap 6) | Account holder, after a decision |
| Second copy of the backups: NAS login for Kynren, and/or a UK/EEA off-site destination | Decision needed |
| Restore test of an encrypted backup with the private key | Whoever holds the key |
| Turn off SSH password login | Server admin |
| Rebuild with an encrypted disk, or an encrypted data volume | Decision needed (needs a maintenance window) |
| Retention and suppression rule for `SmeetzBuyer` (and the group-booking app's own Smeetz copy) | Decision needed |
| Aggregate-only presence view for staff | Decision needed |
| Deploy the location expiry and the privacy policy changes | Say the word |
