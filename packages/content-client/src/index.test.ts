import { fileURLToPath } from 'node:url';
import { deriveStats, lintAchievement, listPlaceholders } from '@portfolio/schema';
import { describe, expect, it } from 'vitest';
import { camelize, loadSeed } from './index.ts';

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
