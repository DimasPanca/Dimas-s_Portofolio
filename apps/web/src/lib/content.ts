/**
 * Build-time content access. Everything shown on the site comes from this snapshot (PRD HR-2):
 * the templates never hard-code facts or numbers.
 */
import {
  type Achievement,
  ContentSnapshot,
  deriveStats,
  type Experience,
  formatMonth,
  type Locale,
  sortAchievements,
} from '@portfolio/schema';
import raw from '../data/content.generated.json';

export const content = ContentSnapshot.parse(raw);
export const settings = content.settings;
export const stats = deriveStats(content);

export const achievements = sortAchievements(content.achievements);
/** Rail = featured items (max 6); falls back to the first 6 (PRD §5.5). */
export const railAchievements = (() => {
  const featured = achievements.filter((a) => a.featured);
  return (featured.length ? featured : achievements).slice(0, 6);
})();

export const experiences = [...content.experiences].sort(
  (a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.startOn.localeCompare(a.startOn),
);
export const education = [...content.education].sort((a, b) => a.sortOrder - b.sortOrder);
export const projects = [...content.projects].sort((a, b) => a.sortOrder - b.sortOrder);
export const skills = [...content.skills].sort((a, b) => a.sortOrder - b.sortOrder);
export const gallery = [...content.gallery].sort((a, b) => a.sortOrder - b.sortOrder);

export const achievementBySlug = new Map(achievements.map((a) => [a.slug, a]));
export const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

/** The highest-ranked international achievement feeds the hero ticker (PRD §5.3). */
export const headlineAchievement: Achievement | undefined =
  achievements.find((a) => a.scope === 'international' && a.rankTier === 1) ?? achievements[0];

export function period(e: Pick<Experience, 'startOn' | 'endOn' | 'isCurrent'>, locale: Locale, present: string) {
  const start = formatMonth(e.startOn, locale);
  if (e.isCurrent) return `${start} — ${present}`;
  if (!e.endOn) return start;
  return `${start} — ${formatMonth(e.endOn, locale)}`;
}

export const whatsappHref =
  settings.contact.whatsappVisible && settings.contact.whatsappNumber
    ? `https://wa.me/${settings.contact.whatsappNumber}`
    : null;

export const env = {
  siteUrl: (import.meta.env.PUBLIC_SITE_URL as string | undefined) || 'https://dimas-portofolio.my.id',
  contactUrl: (import.meta.env.PUBLIC_CONTACT_FUNCTION_URL as string | undefined) || '',
  trackUrl: (import.meta.env.PUBLIC_TRACK_FUNCTION_URL as string | undefined) || '',
  turnstileKey: (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) || '',
  isPreview: import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_PLACEHOLDER_RIBBON === '1',
};
