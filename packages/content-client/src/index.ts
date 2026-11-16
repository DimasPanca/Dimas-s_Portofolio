/**
 * Produces the validated ContentSnapshot the public site is built from (PRD §9.5).
 * Sources: the committed seed JSON (local/CI) or Supabase REST with the publishable key (production).
 */
import { readFile } from 'node:fs/promises';
import { ContentSnapshot, type MediaRef } from '@portfolio/schema';

type Row = Record<string, unknown>;

/** snake_case → camelCase for one row. */
export function camelize(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out;
}

const strip = (row: Row, ...keys: string[]): Row => {
  const copy = { ...row };
  for (const k of keys) delete copy[k];
  return copy;
};

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

/** Build a snapshot from Supabase. RLS guarantees anon only sees published rows. */
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
  const settingsRow = settingsRows[0];
  if (!settingsRow) throw new Error('Supabase site_settings is empty — run `pnpm db:seed` first.');

  const projectSlugById = new Map(projects.map((p) => [p.id as string, p.slug as string]));
  const achievementSlugById = new Map(achievements.map((a) => [a.id as string, a.slug as string]));
  const dropNulls = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

  const mediaMap: Record<string, MediaRef> = {};
  for (const m of media) {
    mediaMap[m.id as string] = {
      url: `${base}/storage/v1/object/public/media/${m.path as string}`,
      width: m.width as number,
      height: m.height as number,
      ...(m.blurhash ? { blurhash: m.blurhash as string } : {}),
      alt: m.alt as MediaRef['alt'],
    };
  }

  const meta = ['createdAt', 'updatedAt', 'publishedAt'];
  const s = camelize(settingsRow);
  return ContentSnapshot.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'supabase',
    settings: {
      ...(s.general as Row),
      profile: s.profile,
      hero: s.hero,
      availability: s.availability,
      credo: s.credo ?? undefined,
      socials: s.socials,
      contact: s.contact,
      seo: s.seo,
      cvPath: s.cvPath ?? null,
    },
    achievements: achievements
      .map((r) => {
        const c = camelize(r);
        return dropNulls({
          ...strip(c, 'projectId', ...meta),
          rankTier: c.rankTier ?? null,
          scope: c.scope ?? null,
          projectSlug: c.projectId ? projectSlugById.get(c.projectId as string) : undefined,
        });
      })
      .map((r) => ({ rankTier: null, ...r })),
    experiences: experiences.map((r) => {
      const c = camelize(r);
      return dropNulls({
        ...strip(c, 'projectId', ...meta),
        projectSlug: c.projectId ? projectSlugById.get(c.projectId as string) : undefined,
      });
    }),
    education: education.map((r) => dropNulls(strip(camelize(r), ...meta))),
    projects: projects.map((r) => dropNulls(strip(camelize(r), ...meta))),
    skills: skills.map((r) => {
      const c = camelize(r);
      return dropNulls({ ...strip(c, 'groupKey', ...meta), group: c.groupKey });
    }),
    gallery: gallery.map((r) => {
      const c = camelize(r);
      return dropNulls({
        ...strip(c, 'achievementId', ...meta),
        achievementSlug: c.achievementId ? achievementSlugById.get(c.achievementId as string) : undefined,
      });
    }),
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
