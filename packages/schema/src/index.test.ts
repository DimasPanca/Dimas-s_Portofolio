import { describe, expect, it } from 'vitest';
import {
  Achievement,
  ContactInput,
  deriveStats,
  displayLine,
  lintAchievement,
  rankShort,
  sortAchievements,
  tr,
} from './index.ts';

const base = {
  slug: 'x-2026-1st',
  rankLabel: { en: '1st Place', id: 'Juara 1' },
  rankTier: 1,
  title: { en: 'Agri-Volution' },
  category: 'essay',
  organizer: 'IPB University',
  achievedOn: '2026-10-01',
} as const;

describe('Achievement', () => {
  it('applies defaults', () => {
    const a = Achievement.parse(base);
    expect(a.status).toBe('published');
    expect(a.proofs).toEqual([]);
    expect(a.scope).toBeNull();
  });
  it('rejects a proof without url or media', () => {
    expect(() => Achievement.parse({ ...base, proofs: [{ kind: 'link' }] })).toThrow();
  });
});

describe('helpers', () => {
  it('falls back to English', () => {
    expect(tr({ en: 'Hello' }, 'id')).toBe('Hello');
    expect(tr({ en: 'Hello', id: 'Halo' }, 'id')).toBe('Halo');
  });
  it('formats rank tokens', () => {
    expect([1, 2, 3, 4, 10].map(rankShort)).toEqual(['1ST', '2ND', '3RD', 'TOP 4', 'TOP 10']);
  });
  it('builds the display line', () => {
    expect(displayLine(Achievement.parse(base), 'en')).toBe('1st Place — Agri-Volution · IPB University · Oct 2026');
  });
  it('sorts by sortOrder then rank', () => {
    const a = Achievement.parse({ ...base, slug: 'a', rankTier: 2, sortOrder: 0 });
    const b = Achievement.parse({ ...base, slug: 'b', rankTier: 1, sortOrder: 0 });
    const c = Achievement.parse({ ...base, slug: 'c', rankTier: 1, sortOrder: -1 });
    expect(sortAchievements([a, b, c]).map((x) => x.slug)).toEqual(['c', 'b', 'a']);
  });
  it('lints the writing standard', () => {
    expect(lintAchievement(Achievement.parse(base))).toEqual([]);
    const messy = lintAchievement({
      rankLabel: { en: '1st Place Winner' },
      title: { en: 'BRAWIJAYA SUSTAINABLE STRATEGIC INNOVATION CONTEST (2026)' },
      organizer: '',
      achievedOn: '2026-09-14',
    });
    expect(messy.length).toBe(5);
  });
  it('derives stats from data', () => {
    const s = deriveStats({
      achievements: [Achievement.parse(base), Achievement.parse({ ...base, slug: 'p', isPlaceholder: true })],
      experiences: [],
      education: [],
    });
    expect(s).toMatchObject({ achievements: 1, firstPlaces: 1, podiums: 1, gpa: null });
  });
});

describe('ContactInput', () => {
  it('rejects a filled honeypot', () => {
    const ok = { name: 'Rina', email: 'rina@example.com', message: 'Hello there, Dimas!' };
    expect(ContactInput.safeParse(ok).success).toBe(true);
    expect(ContactInput.safeParse({ ...ok, website: 'http://spam' }).success).toBe(false);
  });
});
