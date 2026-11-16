/**
 * Prebuild step (PRD §9.5): load content → validate → write the snapshot the site is built from.
 * Usage: node scripts/fetch-content.ts [outFile]
 * Env: CONTENT_SOURCE=seed|supabase, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../packages/content-client/src/index.ts';
import { deriveStats, listPlaceholders } from '../packages/schema/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] ?? 'apps/web/src/data/content.generated.json');
const source = process.env.CONTENT_SOURCE === 'supabase' ? 'supabase' : 'seed';

const snapshot = await loadContent({
  source,
  seedPath: resolve(root, 'docs/seed/content.seed.json'),
  supabase: {
    url: process.env.PUBLIC_SUPABASE_URL ?? '',
    publishableKey: process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
});

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

const stats = deriveStats(snapshot);
const placeholders = listPlaceholders(snapshot);
console.log(
  `content: source=${source} achievements=${stats.achievements} (1st×${stats.firstPlaces}) roles=${stats.roles} projects=${snapshot.projects.length} placeholders=${placeholders.length}`,
);
if (process.env.STRICT_PLACEHOLDERS === '1' && placeholders.length > 0) {
  console.error(`STRICT_PLACEHOLDERS=1 and ${placeholders.length} placeholders remain:`);
  for (const p of placeholders) console.error(`  - ${p.collection}/${p.slug}`);
  process.exit(1);
}
