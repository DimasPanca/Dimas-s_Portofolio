/**
 * Loads docs/seed/content.seed.json into Supabase (PRD AC-ADM-6). Idempotent: rows are upserted on `slug`,
 * so running it again creates no duplicates. Existing media, proofs and photos are not touched unless the
 * seed sets those columns.
 *
 * Usage: node --env-file=.env scripts/seed-db.ts [--dry-run]
 * Env  : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-side only, never in the browser),
 *        SEED_WHATSAPP_NUMBER (optional, digits with country code, e.g. 62812…; never committed)
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedToRows } from '../packages/content-client/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(await readFile(resolve(root, 'docs/seed/content.seed.json'), 'utf8')) as Record<
  string,
  unknown
>;
const dryRun = process.argv.includes('--dry-run');
const whatsapp = (process.env.SEED_WHATSAPP_NUMBER ?? '').replace(/\D/g, '') || null;
const batches = seedToRows(seed, { whatsappNumber: whatsapp });

if (dryRun) {
  for (const b of batches) console.log(`${b.table.padEnd(14)} ${b.rows.length} rows`);
  console.log(`whatsapp number: ${whatsapp ? 'provided' : 'not provided (WhatsApp link stays hidden)'}`);
  process.exit(0);
}

const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example), or pass --dry-run.');
  process.exit(1);
}

// Rows are sent one at a time: PostgREST requires identical keys within one bulk request, and seed rows
// legitimately differ (optional fields), so per-row upserts let column defaults apply.
for (const { table, rows } of batches) {
  const conflict = table === 'site_settings' ? 'id' : 'slug';
  for (const row of rows) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error(`${table}/${String(row.slug ?? row.id)}: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
  }
  console.log(`${table.padEnd(14)} upserted ${rows.length}`);
}
console.log('Seed complete.');
