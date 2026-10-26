import { pathToFileURL } from 'node:url';
import { PrismaClient, createAdapter } from '@kynren/db';
import { hostEmbedded, mediaId, mediaUrl } from './media.logic.js';

/**
 * Moves every picture already embedded in the database (as a `data:` URL in a text, text-array or JSON column) into
 * hosted files, replacing it with its URL: the same thing the API now does as pictures are uploaded.
 *
 *   node dist/media/backfill.js --base https://app-park.kynren.com            (a dry run: reports, changes nothing)
 *   node dist/media/backfill.js --base https://app-park.kynren.com --apply
 *
 * Safe to run twice: once a column holds URLs there is nothing left to move. Plain text columns are only touched when the
 * whole value is a picture; JSON and array columns are searched all the way down.
 */

interface Column {
  table: string;
  column: string;
  kind: 'text' | 'json' | 'array';
}

export interface BackfillLine {
  table: string;
  column: string;
  rows: number;
  bytesBefore: number;
  bytesAfter: number;
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function columnsToScan(prisma: any): Promise<Column[]> {
  const rows: { table_name: string; column_name: string; data_type: string; udt_name: string }[] = await prisma.$queryRawUnsafe(
    `select table_name, column_name, data_type, udt_name from information_schema.columns
      where table_schema = 'public' and table_name not in ('MediaFile', '_prisma_migrations')
        and (data_type in ('text', 'character varying', 'json', 'jsonb') or (data_type = 'ARRAY' and udt_name in ('_text', '_varchar')))`,
  );
  return rows.map((r) => ({
    table: r.table_name,
    column: r.column_name,
    kind: r.data_type === 'json' || r.data_type === 'jsonb' ? 'json' : r.data_type === 'ARRAY' ? 'array' : 'text',
  }));
}

async function primaryKey(prisma: any, table: string): Promise<string | null> {
  const rows: { attname: string }[] = await prisma.$queryRawUnsafe(
    `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = $1::regclass and i.indisprimary`,
    q(table),
  );
  return rows.length === 1 ? rows[0]!.attname : null; // a table with no single-column key is left for a person to look at
}

export async function backfillMedia(
  prisma: any,
  opts: { apply: boolean; base: string; log?: (line: string) => void },
): Promise<BackfillLine[]> {
  const log = opts.log ?? (() => undefined);
  const out: BackfillLine[] = [];
  for (const col of await columnsToScan(prisma)) {
    const filter = col.kind === 'text' ? `${q(col.column)} like 'data:%'` : `${q(col.column)}::text like '%data:%'`;
    const pk = await primaryKey(prisma, col.table);
    const hits: { id: unknown }[] = pk
      ? await prisma.$queryRawUnsafe(`select ${q(pk)} as id from ${q(col.table)} where ${filter}`)
      : [];
    if (!pk) {
      const n: { n: bigint }[] = await prisma.$queryRawUnsafe(`select count(*) as n from ${q(col.table)} where ${filter}`);
      if (Number(n[0]?.n ?? 0) > 0) log(`SKIPPED ${col.table}.${col.column}: ${n[0]!.n} row(s) with pictures but no single-column key`);
      continue;
    }
    const line: BackfillLine = { table: col.table, column: col.column, rows: 0, bytesBefore: 0, bytesAfter: 0 };
    for (const hit of hits) {
      const [row]: { v: unknown }[] = await prisma.$queryRawUnsafe(`select ${q(col.column)} as v from ${q(col.table)} where ${q(pk)} = $1`, hit.id);
      if (!row) continue;
      const before = JSON.stringify(row.v).length;
      const [next, changed] = await hostEmbedded(row.v, async (file) => {
        const id = mediaId(file.bytes);
        if (opts.apply) {
          await prisma.mediaFile.upsert({
            where: { id },
            create: { id, mime: file.mime, data: new Uint8Array(file.bytes), size: file.bytes.length },
            update: {},
          });
        }
        return mediaUrl(opts.base, id);
      });
      if (!changed) continue;
      if (opts.apply) {
        const set = col.kind === 'json' ? `${q(col.column)} = $1::jsonb` : col.kind === 'array' ? `${q(col.column)} = $1::text[]` : `${q(col.column)} = $1`;
        await prisma.$executeRawUnsafe(`update ${q(col.table)} set ${set} where ${q(pk)} = $2`, col.kind === 'json' ? JSON.stringify(next) : next, hit.id);
      }
      line.rows++;
      line.bytesBefore += before;
      line.bytesAfter += JSON.stringify(next).length;
    }
    if (line.rows > 0) {
      out.push(line);
      log(`${opts.apply ? 'moved' : 'would move'} ${col.table}.${col.column}: ${line.rows} row(s), ${(line.bytesBefore / 1e6).toFixed(2)} MB -> ${(line.bytesAfter / 1e3).toFixed(1)} KB`);
    }
  }
  return out;
}

// Run directly: node dist/media/backfill.js [--apply] --base <public URL of the API's site>
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const base = args[args.indexOf('--base') + 1];
  if (!base || !/^https?:\/\//.test(base)) {
    console.error('Usage: node dist/media/backfill.js --base https://app-park.kynren.com [--apply]');
    process.exit(2);
  }
  const prisma = new PrismaClient({ adapter: createAdapter() });
  backfillMedia(prisma, { apply, base, log: (l) => console.log(l) })
    .then((lines) => {
      const total = lines.reduce((n, l) => n + l.bytesBefore - l.bytesAfter, 0);
      console.log(`${apply ? 'Done' : 'Dry run'}: ${lines.length} column(s), ${(total / 1e6).toFixed(2)} MB ${apply ? 'moved out of the database rows' : 'would move'}.${apply ? '' : ' Re-run with --apply.'}`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
