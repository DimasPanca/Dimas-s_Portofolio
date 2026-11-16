/**
 * Content report (PRD HR-11, §2.5.1): placeholders, writing-standard hints, missing proofs, unreviewed translations.
 * Exits non-zero only on schema errors or when STRICT_PLACEHOLDERS=1 and placeholders remain.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed } from '../packages/content-client/src/index.ts';
import { lintAchievement, listPlaceholders } from '../packages/schema/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = resolve(root, 'docs/seed/content.seed.json');
const snapshot = await loadSeed(seedPath);
const raw = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, { slug?: string; needsReview?: boolean }[]>;

const placeholders = listPlaceholders(snapshot);
console.log(`\nPlaceholders (${placeholders.length})`);
for (const p of placeholders) console.log(`  - ${p.collection}/${p.slug}`);

let hints = 0;
console.log('\nAchievement writing standard');
for (const a of snapshot.achievements) {
  const issues = lintAchievement(a);
  hints += issues.length;
  for (const i of issues) console.log(`  - ${a.slug}: ${i}`);
}
if (hints === 0) console.log('  all achievements follow the standard');

const noProof = snapshot.achievements.filter((a) => a.proofs.length === 0);
console.log(`\nAchievements without proof (${noProof.length}) — add them in the admin Proofs panel`);
for (const a of noProof) console.log(`  - ${a.slug}`);

const review = ['education', 'experiences', 'achievements', 'projects'].flatMap((k) =>
  (raw[k] ?? []).filter((r) => r.needsReview).map((r) => `${k}/${r.slug}`),
);
console.log(`\nIndonesian text awaiting review (${review.length} records)`);

if (process.env.STRICT_PLACEHOLDERS === '1' && placeholders.length > 0) {
  console.error('\nSTRICT_PLACEHOLDERS=1: placeholders remain.');
  process.exit(1);
}
