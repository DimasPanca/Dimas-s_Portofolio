import type { Locale } from '@portfolio/schema';
import en from './en.json';
import id from './id.json';

export type UI = typeof en;
const dictionaries: Record<Locale, UI> = { en, id: id as UI };

export const LOCALES: readonly Locale[] = ['en', 'id'];

/** UI strings for a locale (English is the default, PRD HR-12). */
export function ui(locale: Locale): UI {
  return dictionaries[locale];
}

/** Locale from the `[...lang]` rest param: undefined → en, 'id' → id. */
export function localeFromParam(lang: string | undefined): Locale {
  return lang === 'id' ? 'id' : 'en';
}

/** Static paths for pages available in both languages. */
export function localePaths() {
  return [{ params: { lang: undefined } }, { params: { lang: 'id' } }];
}

/** Site-relative href for a locale: href('id', '/works/x') → '/id/works/x'. */
export function href(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return clean;
  return clean === '/' ? '/id/' : `/id${clean}`;
}

export const htmlLang: Record<Locale, string> = { en: 'en', id: 'id' };
export const ogLocale: Record<Locale, string> = { en: 'en_US', id: 'id_ID' };
