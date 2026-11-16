/**
 * Single source of truth for content shapes (PRD §9.1, Appendix B).
 * Used by the web build, the admin app, the seed/lint scripts and the Edge Functions.
 */
import { z } from 'zod';

export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** English is the source language; Indonesian is optional and falls back to English. */
export const Localized = z.object({ en: z.string().min(1), id: z.string().optional() });
export type Localized = z.infer<typeof Localized>;

export const ContentStatus = z.enum(['draft', 'published', 'archived']);
export type ContentStatus = z.infer<typeof ContentStatus>;

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-kebab-case');
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const Precision = z.enum(['year', 'month', 'day']);

const Base = z.object({
  id: z.uuid().optional(),
  slug: Slug,
  status: ContentStatus.default('published'),
  isPlaceholder: z.boolean().default(false),
  needsReview: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const AchievementCategory = z.enum([
  'essay',
  'business',
  'hackathon',
  'ai-ml',
  'research',
  'certification',
  'other',
]);
export type AchievementCategory = z.infer<typeof AchievementCategory>;

export const Proof = z
  .object({
    kind: z.enum(['certificate', 'photo', 'pdf', 'link']),
    label: Localized.optional(),
    url: z.url().optional(),
    mediaId: z.uuid().optional(),
  })
  .refine((p) => Boolean(p.url || p.mediaId), 'url or mediaId is required');
export type Proof = z.infer<typeof Proof>;

export const Achievement = Base.extend({
  rankLabel: Localized,
  rankTier: z.number().int().min(1).max(99).nullable(),
  title: Localized,
  typeLabel: Localized.optional(),
  category: AchievementCategory,
  organizer: z.string().min(1),
  scope: z.enum(['international', 'national', 'regional', 'campus']).nullable().default(null),
  location: z.string().nullable().optional(),
  achievedOn: IsoDate,
  datePrecision: Precision.default('month'),
  entryType: z.enum(['individual', 'team']).nullable().optional(),
  summary: Localized.optional(),
  highlights: z.array(Localized).default([]),
  tags: z.array(z.string()).default([]),
  coverMediaId: z.uuid().nullable().optional(),
  proofs: z.array(Proof).default([]),
  galleryMediaIds: z.array(z.uuid()).default([]),
  projectSlug: z.string().nullable().optional(),
  linkConfirmed: z.boolean().optional(),
  featured: z.boolean().default(false),
});
export type Achievement = z.infer<typeof Achievement>;

export const Experience = Base.extend({
  kind: z.enum(['work', 'organization']),
  organization: z.string().min(1),
  role: Localized,
  location: z.string().nullable().optional(),
  startOn: IsoDate,
  endOn: IsoDate.nullable().optional(),
  isCurrent: z.boolean().default(false),
  datePrecision: Precision.default('month'),
  summary: Localized.nullable().optional(),
  highlights: z.array(Localized).default([]),
  featuredHighlights: z.number().int().default(3),
  projectSlug: z.string().nullable().optional(),
});
export type Experience = z.infer<typeof Experience>;

export const Education = Base.extend({
  institution: z.string().min(1),
  location: z.string().nullable().optional(),
  program: Localized,
  startOn: IsoDate,
  endOn: IsoDate.nullable().optional(),
  isExpected: z.boolean().default(false),
  gpa: z.number().min(0).max(4).nullable().optional(),
  gpaScale: z.number().default(4),
});
export type Education = z.infer<typeof Education>;

export const ProjectLink = z.object({
  label: z.string().min(1),
  url: z.url(),
  kind: z.enum(['demo', 'repo', 'article', 'other']).default('other'),
});

export const Project = Base.extend({
  title: Localized,
  role: Localized.optional(),
  year: z.number().int().optional(),
  summary: Localized.optional(),
  body: Localized.optional(),
  stack: z.array(z.string()).default([]),
  links: z.array(ProjectLink).default([]),
  coverMediaId: z.uuid().nullable().optional(),
  galleryMediaIds: z.array(z.uuid()).default([]),
  featured: z.boolean().default(false),
  linkedAchievementSlug: z.string().nullable().optional(),
  linkConfirmed: z.boolean().optional(),
});
export type Project = z.infer<typeof Project>;

export const SkillGroup = z.enum(['ai', 'web', 'iot', 'tools', 'stack', 'leadership']);
export type SkillGroup = z.infer<typeof SkillGroup>;

export const Skill = Base.extend({
  group: SkillGroup,
  kind: z.enum(['hard', 'soft']),
  label: Localized,
  icon: z.string().optional(),
});
export type Skill = z.infer<typeof Skill>;

export const GalleryItem = Base.extend({
  mediaId: z.uuid().nullable().optional(),
  caption: Localized.optional(),
  album: z.string().optional(),
  achievementSlug: z.string().nullable().optional(),
  event: z.string().optional(),
  takenOn: IsoDate.optional(),
});
export type GalleryItem = z.infer<typeof GalleryItem>;

export const Social = z.object({
  kind: z.enum(['linkedin', 'github', 'instagram', 'email', 'whatsapp', 'other']),
  label: z.string().min(1),
  url: z.string().min(1),
  handle: z.string().optional(),
});
export type Social = z.infer<typeof Social>;

export const SiteSettings = z.object({
  defaultLocale: z.enum(LOCALES).default('en'),
  locales: z.array(z.enum(LOCALES)).default(['en', 'id']),
  profile: z.object({
    name: z.string().min(1),
    location: z.string(),
    email: z.email(),
    headline: Localized,
    summaryVerbatim: Localized.optional(),
    bio: Localized,
    interests: z.array(z.string()).default([]),
    portrait: z.object({ alt: Localized }),
  }),
  hero: z.object({ eyebrow: Localized, pitch: Localized, marquee: z.array(z.string()).default([]) }),
  availability: Localized.extend({ isPlaceholder: z.boolean().default(false) })
    .nullable()
    .optional(),
  credo: z.object({ words: z.array(z.string()), sentence: Localized }).optional(),
  socials: z.array(Social).default([]),
  contact: z.object({
    email: z.email(),
    whatsappNumber: z
      .string()
      .regex(/^\d{8,15}$/, 'digits only, country code first')
      .nullable()
      .default(null),
    whatsappVisible: z.boolean().default(true),
  }),
  seo: z.object({ title: Localized, description: Localized }),
  cvPath: z.string().nullable().default(null),
});
export type SiteSettings = z.infer<typeof SiteSettings>;

export const MediaRef = z.object({
  url: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurhash: z.string().optional(),
  alt: Localized,
});
export type MediaRef = z.infer<typeof MediaRef>;

/** The only shape the public site consumes (PRD §10.4). */
export const ContentSnapshot = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  source: z.enum(['seed', 'supabase']),
  settings: SiteSettings,
  achievements: z.array(Achievement),
  experiences: z.array(Experience),
  education: z.array(Education),
  projects: z.array(Project),
  skills: z.array(Skill),
  gallery: z.array(GalleryItem),
  media: z.record(z.string(), MediaRef).default({}),
});
export type ContentSnapshot = z.infer<typeof ContentSnapshot>;

export const ContactTopic = z.enum(['internship', 'collaboration', 'competition', 'other']);
export const ContactInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  topic: ContactTopic.default('other'),
  message: z.string().trim().min(10).max(2000),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
  /** Time-trap: milliseconds the form was open before submit. */
  elapsedMs: z.coerce.number().int().min(0).optional(),
  turnstileToken: z.string().min(1).optional(),
});
export type ContactInput = z.infer<typeof ContactInput>;

/* ------------------------------------------------------------------ helpers */

/** Localized text with fallback to English. */
export function tr(value: Localized | null | undefined, locale: Locale): string {
  if (!value) return '';
  return (locale === 'id' && value.id) || value.en;
}

/** Short rank token for big numerals: 1ST, 2ND, 3RD, TOP 4. */
export function rankShort(tier: number | null): string {
  if (tier === 1) return '1ST';
  if (tier === 2) return '2ND';
  if (tier === 3) return '3RD';
  if (tier && tier > 3) return `TOP ${tier}`;
  return '★';
}

const SCOPE_WEIGHT = { international: 0, national: 1, regional: 2, campus: 3 } as const;

/** Default order (PRD §2.5): explicit sortOrder, then international first, rank, newest. */
export function sortAchievements<T extends Achievement>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      (a.scope ? SCOPE_WEIGHT[a.scope] : 9) - (b.scope ? SCOPE_WEIGHT[b.scope] : 9) ||
      (a.rankTier ?? 99) - (b.rankTier ?? 99) ||
      b.achievedOn.localeCompare(a.achievedOn),
  );
}

export function formatMonth(iso: string, locale: Locale, precision: 'year' | 'month' | 'day' = 'month'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const tag = locale === 'id' ? 'id-ID' : 'en-US';
  if (precision === 'year') return String(d.getUTCFullYear());
  return new Intl.DateTimeFormat(tag, {
    month: 'short',
    year: 'numeric',
    ...(precision === 'day' ? { day: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(d);
}

/** `{Rank} — {Event} · {Organizer} · {Mon YYYY}` (PRD §2.5.1). */
export function displayLine(a: Achievement, locale: Locale): string {
  return `${tr(a.rankLabel, locale)} — ${tr(a.title, locale)} · ${a.organizer} · ${formatMonth(a.achievedOn, locale, a.datePrecision)}`;
}

export const CANONICAL_RANKS = /^(1st Place|2nd Place|3rd Place|Top \d{1,2} Finalist)$/;

/** Writing-standard hints (PRD §2.5.1). Non-blocking; shown in admin and content:lint. */
export function lintAchievement(a: Pick<Achievement, 'rankLabel' | 'title' | 'organizer' | 'achievedOn'>): string[] {
  const out: string[] = [];
  const title = a.title.en;
  if (!CANONICAL_RANKS.test(a.rankLabel.en))
    out.push('Rank label should be one of: 1st Place, 2nd Place, 3rd Place, Top N Finalist.');
  if (/\b(1st|2nd|3rd|first|second|third|winner|juara|finalist|top \d+)\b/i.test(title))
    out.push('Event title contains placement words; keep the official event name only.');
  if (/\(\s*20\d{2}\s*\)\s*$/.test(title)) out.push('Drop the trailing "(year)" from the event title.');
  const letters = title.replace(/[^A-Za-z]/g, '');
  if (letters.length > 12 && letters === letters.toUpperCase()) out.push('Event title is ALL CAPS; use Title Case.');
  if (/\bby\s+\S+/i.test(title)) out.push('Move "by <organizer>" out of the title into Organizer.');
  if (a.organizer.trim().length < 3) out.push('Organizer (host institution) is missing.');
  if (!/^\d{4}-\d{2}-01$/.test(a.achievedOn)) out.push('Use month precision: store the date as YYYY-MM-01.');
  return out;
}

export type Stats = {
  achievements: number;
  firstPlaces: number;
  secondPlaces: number;
  podiums: number;
  roles: number;
  gpa: number | null;
  gpaScale: number;
};

/** Everything numeric on the site is derived from data, never hard-coded (PRD HR-2). */
export function deriveStats(s: Pick<ContentSnapshot, 'achievements' | 'experiences' | 'education'>): Stats {
  const real = s.achievements.filter((a) => a.status === 'published' && !a.isPlaceholder);
  const edu = s.education.find((e) => e.status === 'published' && e.gpa != null);
  return {
    achievements: real.length,
    firstPlaces: real.filter((a) => a.rankTier === 1).length,
    secondPlaces: real.filter((a) => a.rankTier === 2).length,
    podiums: real.filter((a) => a.rankTier !== null && a.rankTier <= 3).length,
    roles: s.experiences.filter((e) => e.status === 'published' && !e.isPlaceholder).length,
    gpa: edu?.gpa ?? null,
    gpaScale: edu?.gpaScale ?? 4,
  };
}

export type PlaceholderEntry = { collection: string; slug: string };

export function listPlaceholders(s: ContentSnapshot): PlaceholderEntry[] {
  const out: PlaceholderEntry[] = [];
  const scan = (collection: string, items: readonly { slug: string; isPlaceholder: boolean }[]) => {
    for (const it of items) if (it.isPlaceholder) out.push({ collection, slug: it.slug });
  };
  scan('achievements', s.achievements);
  scan('experiences', s.experiences);
  scan('education', s.education);
  scan('projects', s.projects);
  scan('skills', s.skills);
  scan('gallery', s.gallery);
  if (s.settings.availability?.isPlaceholder) out.push({ collection: 'settings', slug: 'availability' });
  if (!s.settings.cvPath) out.push({ collection: 'settings', slug: 'cv-pdf' });
  return out;
}
