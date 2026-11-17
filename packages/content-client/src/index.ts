/**
 * Produces the validated ContentSnapshot the public site is built from (PRD §9.5).
 * Sources: the committed seed JSON (local/CI) or Supabase REST with the publishable key (production).
 */
import { readFile } from 'node:fs/promises';
import { ContentSnapshot, type MediaRef } from '@portfolio/schema';

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** snake_case → camelCase for one row (top-level keys only; JSON columns keep their own keys). */
export function camelize(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

/** camelCase → snake_case for one row (top-level keys only). */
export function snakeize(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toSnake(k)] = v;
  return out;
}

/** Database row → snapshot item: camelCase keys, bookkeeping columns and nulls removed (defaults apply). */
export function fromRow(row: Row, rename: Record<string, string> = {}): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(camelize(row))) {
    if (v === null || k === 'createdAt' || k === 'updatedAt' || k === 'publishedAt') continue;
    out[rename[k] ?? k] = v;
  }
  return out;
}

/** Build a snapshot from the seed file. Only `published` rows are kept. */
export async function loadSeed(path: string): Promise<ContentSnapshot> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  const published = (items: unknown) => (items as Row[]).filter((r) => (r.status ?? 'published') === 'published');
  return ContentSnapshot.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'seed',
    settings: raw.settings,
    achievements: published(raw.achievements),
    experiences: published(raw.experiences),
    education: published(raw.education),
    projects: published(raw.projects),
    skills: published(raw.skills),
    gallery: published(raw.gallery),
    media: {},
  });
}

export type SupabaseSource = { url: string; publishableKey: string; fetchImpl?: typeof fetch };

/** Build a snapshot from Supabase. RLS guarantees the anonymous key only sees published rows. */
export async function loadSupabase({
  url,
  publishableKey,
  fetchImpl = fetch,
}: SupabaseSource): Promise<ContentSnapshot> {
  const base = url.replace(/\/$/, '');
  const get = async (table: string, query = 'select=*&order=sort_order.asc'): Promise<Row[]> => {
    const res = await fetchImpl(`${base}/rest/v1/${table}?${query}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
    return (await res.json()) as Row[];
  };

  const [settingsRows, media, projects, achievements, experiences, education, skills, gallery] = await Promise.all([
    get('site_settings', 'select=*&limit=1'),
    get('media', 'select=*'),
    get('projects'),
    get('achievements'),
    get('experiences'),
    get('education'),
    get('skills'),
    get('gallery_items'),
  ]);
  const settings = settingsRows[0];
  if (!settings) throw new Error('Supabase site_settings is empty — run `pnpm db:seed` first.');

  const publicUrl = (bucket: string, path: string) => `${base}/storage/v1/object/public/${bucket}/${path}`;
  const mediaMap: Record<string, MediaRef> = {};
  for (const m of media) {
    mediaMap[m.id as string] = {
      url: publicUrl('media', m.path as string),
      width: m.width as number,
      height: m.height as number,
      ...(m.blurhash ? { blurhash: m.blurhash as string } : {}),
      alt: m.alt as MediaRef['alt'],
    };
  }

  return ContentSnapshot.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'supabase',
    settings: {
      ...((settings.general as Row | null) ?? {}),
      profile: settings.profile,
      hero: settings.hero,
      availability: settings.availability,
      credo: settings.credo ?? undefined,
      socials: settings.socials,
      contact: settings.contact,
      seo: settings.seo,
      cvPath: settings.cv_path ? publicUrl('docs', settings.cv_path as string) : null,
    },
    // rankTier is required-but-nullable, so it is restored after nulls are dropped.
    achievements: achievements.map((r) => ({ rankTier: null, ...fromRow(r) })),
    experiences: experiences.map((r) => fromRow(r)),
    education: education.map((r) => fromRow(r)),
    projects: projects.map((r) => fromRow(r)),
    skills: skills.map((r) => fromRow(r, { groupKey: 'group' })),
    gallery: gallery.map((r) => fromRow(r)),
    media: mediaMap,
  });
}

export type LoadOptions = { source: 'seed' | 'supabase'; seedPath: string; supabase?: SupabaseSource };

export async function loadContent(opts: LoadOptions): Promise<ContentSnapshot> {
  if (opts.source === 'supabase') {
    if (!opts.supabase?.url || !opts.supabase.publishableKey)
      throw new Error('CONTENT_SOURCE=supabase needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
    return loadSupabase(opts.supabase);
  }
  return loadSeed(opts.seedPath);
}

/* -------------------------------------------------------------- seed → database rows */

/** Removes editorial helper keys (`_note`, nested `needsReview`/`note`) that are not part of the model. */
function clean(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Row = {};
    for (const [k, v] of Object.entries(value as Row)) {
      if (k.startsWith('_')) continue;
      if (depth > 0 && (k === 'needsReview' || k === 'note')) continue;
      out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

export type SeedRows = { table: string; rows: Row[] }[];

/** Maps the seed file to database rows (snake_case columns), ready for an upsert on `slug`. */
export function seedToRows(seed: Record<string, unknown>, extras: { whatsappNumber?: string | null } = {}): SeedRows {
  const rows = (items: unknown, rename: Record<string, string> = {}) =>
    (items as Row[]).map((item) => {
      const row = snakeize(clean(item) as Row);
      for (const [from, to] of Object.entries(rename)) {
        if (from in row) {
          row[to] = row[from];
          delete row[from];
        }
      }
      return row;
    });
  const s = clean(seed.settings) as Row;
  const contact = { ...(s.contact as Row) };
  if (extras.whatsappNumber) contact.whatsappNumber = extras.whatsappNumber;
  return [
    {
      table: 'site_settings',
      rows: [
        {
          id: 1,
          general: { defaultLocale: s.defaultLocale ?? 'en', locales: s.locales ?? ['en', 'id'] },
          profile: s.profile,
          hero: s.hero,
          availability: s.availability ?? null,
          credo: s.credo ?? null,
          socials: s.socials ?? [],
          contact,
          seo: s.seo ?? {},
        },
      ],
    },
    { table: 'projects', rows: rows(seed.projects) },
    { table: 'achievements', rows: rows(seed.achievements) },
    { table: 'experiences', rows: rows(seed.experiences) },
    { table: 'education', rows: rows(seed.education) },
    { table: 'skills', rows: rows(seed.skills, { group: 'group_key' }) },
    { table: 'gallery_items', rows: rows(seed.gallery) },
  ];
}
