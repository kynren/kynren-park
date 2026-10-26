#!/usr/bin/env node
/**
 * One-off: copies the groups app's Smeetz order mirror and buyer index into the park's Postgres, so the park's own sync starts
 * from where the groups app got to instead of re-reading about 137,000 orders (hours of Smeetz calls) from scratch.
 *
 *   node scripts/smeetz-copy-from-groups.mjs --sqlite /path/to/groups.db --pg "postgresql://..." [--dry-run]
 *
 * Needs Node 22.5+ (built-in node:sqlite) and the `pg` package. Reads the SQLite file read-only; it never writes to it, and it
 * never talks to Smeetz. Safe to run twice: rows already in Postgres are left as they are (ON CONFLICT DO NOTHING), so a
 * second run only adds what the first missed. Copy the .db file (with its -wal and -shm files) somewhere first rather than
 * pointing this at a database that is being written to.
 *
 * What it copies, and what it deliberately does not:
 *   SmeetzOrder / SmeetzOrderLine - the columns the park keeps. The order form's answers (additionalInfo), the buyer-less
 *     reporting columns, the guest's email and the membership dates are NOT copied.
 *   SmeetzBuyer - email, name, company, phone. Address is left empty: the groups index never kept it; the park reads it on
 *     demand the first time a guest asks for their own details.
 *   ordersSyncedThrough - the groups app's watermark, so the park's sync resumes from it (the earlier of the two if both exist).
 */
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const sqlitePath = flag('sqlite');
const pgUrl = flag('pg') ?? process.env.DATABASE_URL;
const dryRun = args.includes('--dry-run');
if (!sqlitePath || !pgUrl) {
  console.error('Usage: node scripts/smeetz-copy-from-groups.mjs --sqlite <groups.db> --pg <postgres url> [--dry-run]');
  process.exit(2);
}

const BATCH = 500;
// Prisma stores a SQLite DateTime as milliseconds since the epoch. Sent to Postgres as UTC text, which is how Prisma wrote the
// park's own timestamps (timestamp without time zone, UTC clock time).
const iso = (ms) => (ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString());
const text = (v) => (v === null || v === undefined ? null : String(v));

const src = new DatabaseSync(sqlitePath, { readOnly: true });
const pg = new Client({ connectionString: pgUrl });
await pg.connect();

async function copy(name, selectSql, columns, mapRow, conflict) {
  const total = src.prepare(`SELECT count(*) AS n FROM ${name}`).get().n;
  const stmt = src.prepare(selectSql);
  let seen = 0;
  let inserted = 0;
  let batch = [];
  const flush = async () => {
    if (batch.length === 0) return;
    if (!dryRun) {
      const params = [];
      const rows = batch.map((row, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(',')})`);
      for (const row of batch) params.push(...row);
      const res = await pg.query(`INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${rows.join(',')} ON CONFLICT ${conflict} DO NOTHING`, params);
      inserted += res.rowCount ?? 0;
    }
    batch = [];
  };
  for (const row of stmt.iterate()) {
    batch.push(mapRow(row));
    seen += 1;
    if (batch.length >= BATCH) await flush();
    if (seen % 50_000 === 0) console.log(`  ${name}: ${seen}/${total}`);
  }
  await flush();
  console.log(`${name}: ${total} in groups, ${dryRun ? 'would add up to' : 'added'} ${dryRun ? seen : inserted}${dryRun ? '' : `, ${seen - inserted} already there`}`);
}

try {
  // orders first (lines point at them), then lines, then who bought
  await copy(
    'SmeetzOrder',
    'SELECT id, reference, status, currency, customerId, language, smeetzCreatedAt, smeetzUpdatedAt, syncedAt FROM SmeetzOrder',
    ['id', 'reference', 'status', 'currency', 'customerId', 'language', 'smeetzCreatedAt', 'smeetzUpdatedAt', 'syncedAt'],
    (r) => [r.id, r.reference, r.status, r.currency, text(r.customerId), text(r.language), iso(r.smeetzCreatedAt), iso(r.smeetzUpdatedAt), iso(r.syncedAt)],
    '("id")',
  );

  await copy(
    'SmeetzOrderLine',
    `SELECT id, orderId, kind, itemName, priceName, priceValue, quantity, itemStatus, optionId, availabilityId, showDate, unitId, barcode,
            voucherCode, voucherStatus, membershipCode, membershipStatus, guestFirstName, guestLastName FROM SmeetzOrderLine`,
    ['id', 'orderId', 'kind', 'itemName', 'priceName', 'priceValue', 'quantity', 'itemStatus', 'optionId', 'availabilityId', 'showDate', 'unitId', 'barcode', 'voucherCode', 'voucherStatus', 'membershipCode', 'membershipStatus', 'guestFirstName', 'guestLastName'],
    (r) => [r.id, r.orderId, r.kind, r.itemName, text(r.priceName), r.priceValue ?? null, r.quantity ?? 1, text(r.itemStatus), text(r.optionId), text(r.availabilityId), iso(r.showDate), text(r.unitId), text(r.barcode), text(r.voucherCode), text(r.voucherStatus), text(r.membershipCode), text(r.membershipStatus), text(r.guestFirstName), text(r.guestLastName)],
    '("id")',
  );

  await copy(
    'SmeetzBuyer',
    'SELECT orderId, email, name, company, phone, readAt FROM SmeetzBuyer',
    ['orderId', 'email', 'name', 'company', 'phone', 'readAt'],
    (r) => [r.orderId, text(r.email), text(r.name), text(r.company), text(r.phone), iso(r.readAt)],
    '("orderId")',
  );

  // Where the groups app's order sync had got to, so the park's carries on from there.
  const mark = src.prepare("SELECT value FROM Setting WHERE key = 'smeetz.ordersSyncedThrough'").get()?.value;
  if (mark && !dryRun) {
    const have = await pg.query('SELECT value FROM "SmeetzSyncState" WHERE key = $1', ['ordersSyncedThrough']);
    if (have.rowCount === 0 || new Date(have.rows[0].value) > new Date(mark)) {
      await pg.query(
        `INSERT INTO "SmeetzSyncState" (key, value, "updatedAt") VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
        ['ordersSyncedThrough', mark],
      );
    }
  }
  console.log(`ordersSyncedThrough: ${mark ?? '(none in groups)'}`);

  if (!dryRun) {
    const count = async (table) => Number((await pg.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n);
    console.log(`park now holds: ${await count('SmeetzOrder')} orders, ${await count('SmeetzOrderLine')} lines, ${await count('SmeetzBuyer')} buyers`);
  }
} finally {
  await pg.end();
  src.close();
}
