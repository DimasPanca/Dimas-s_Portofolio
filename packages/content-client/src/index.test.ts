import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ContentSnapshot, deriveStats, lintAchievement, listPlaceholders } from '@portfolio/schema';
import { describe, expect, it } from 'vitest';
import { camelize, fromRow, loadSeed, seedToRows } from './index.ts';

const seedPath = fileURLToPath(new URL('../../../docs/seed/content.seed.json', import.meta.url));

describe('seed', () => {
  it('validates and matches the PRD facts', async () => {
    const s = await loadSeed(seedPath);
    expect(s.settings.profile.name).toBe('Dimas Panca Pamungkas');
    expect(s.settings.defaultLocale).toBe('en');
    expect(deriveStats(s)).toMatchObject({
      achievements: 9,
      firstPlaces: 4,
      secondPlaces: 2,
      podiums: 7,
      roles: 4,
      gpa: 3.89,
    });
    expect(s.settings.contact.whatsappNumber).toBeNull();
  });
  it('follows the achievement writing standard', async () => {
    const s = await loadSeed(seedPath);
    for (const a of s.achievements) expect(lintAchievement(a), a.slug).toEqual([]);
  });
  it('reports placeholders', async () => {
    const s = await loadSeed(seedPath);
    const p = listPlaceholders(s);
    expect(p.some((x) => x.slug === 'availability')).toBe(true);
    expect(p.filter((x) => x.collection === 'projects').length).toBe(3);
  });
});

describe('camelize', () => {
  it('converts snake_case keys', () => {
    expect(camelize({ rank_tier: 1, date_precision: 'month' })).toEqual({ rankTier: 1, datePrecision: 'month' });
  });
});

describe('seed → database rows → snapshot', () => {
  it('round-trips without losing facts', async () => {
    const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, unknown>;
    const batches = Object.fromEntries(
      seedToRows(seed, { whatsappNumber: '6281200000000' }).map((b) => [b.table, b.rows]),
    );
    const settings = batches.site_settings?.[0] as Record<string, unknown>;
    expect((settings.contact as { whatsappNumber: string }).whatsappNumber).toBe('6281200000000');
    // Simulate what PostgREST returns (snake_case rows) and what the client builds from it.
    const snapshot = ContentSnapshot.parse({
      version: 1,
      generatedAt: new Date().toISOString(),
      source: 'supabase',
      settings: { ...(settings.general as object), ...settings, cvPath: null },
      achievements: (batches.achievements ?? []).map((r) => ({ rankTier: null, ...fromRow(r) })),
      experiences: (batches.experiences ?? []).map((r) => fromRow(r)),
      education: (batches.education ?? []).map((r) => fromRow(r)),
      projects: (batches.projects ?? []).map((r) => fromRow(r)),
      skills: (batches.skills ?? []).map((r) => fromRow(r, { groupKey: 'group' })),
      gallery: (batches.gallery_items ?? []).map((r) => fromRow(r)),
    });
    const direct = await loadSeed(seedPath);
    expect(deriveStats(snapshot)).toEqual(deriveStats(direct));
    expect(snapshot.achievements.map((a) => a.slug)).toEqual(direct.achievements.map((a) => a.slug));
    expect(snapshot.achievements[0]?.location).toBe('Chiang Mai, Thailand');
    expect(snapshot.skills.filter((x) => x.group === 'stack').length).toBe(6);
    for (const row of batches.achievements ?? []) expect(Object.keys(row).some((k) => k.startsWith('_'))).toBe(false);
  });
});
