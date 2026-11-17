/**
 * Declarative description of every editable collection. The list and form screens are generated from
 * this, so adding a field is a one-line change. Keys are database column names.
 */
import type { Row } from './lib/supabase.ts';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'localized'
  | 'localizedArea'
  | 'localizedList'
  | 'select'
  | 'number'
  | 'month'
  | 'date'
  | 'bool'
  | 'tags'
  | 'url'
  | 'media'
  | 'mediaList'
  | 'proofs'
  | 'links';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly (readonly [string, string])[];
  help?: string;
  placeholder?: string;
};

export type Collection = {
  table: string;
  title: string;
  singular: string;
  /** Column whose English text names the row in lists and builds the slug. */
  titleKey: string;
  subtitle: (row: Row) => string;
  fields: Field[];
  defaults: () => Row;
  quickAdd?: boolean;
};

const en = (v: unknown): string =>
  v && typeof v === 'object' ? String((v as { en?: unknown }).en ?? '') : String(v ?? '');
const month = (v: unknown) => String(v ?? '').slice(0, 7);

export const RANKS: readonly (readonly [string, { en: string; id: string }, number])[] = [
  ['1st', { en: '1st Place', id: 'Juara 1' }, 1],
  ['2nd', { en: '2nd Place', id: 'Juara 2' }, 2],
  ['3rd', { en: '3rd Place', id: 'Juara 3' }, 3],
];

export const TYPE_PRESETS: readonly { en: string; id: string; category: string }[] = [
  { en: 'Essay Competition', id: 'Lomba Esai', category: 'essay' },
  { en: 'Business Plan Competition', id: 'Lomba Rencana Bisnis', category: 'business' },
  { en: 'Business Model Canvas Competition', id: 'Kompetisi Business Model Canvas', category: 'business' },
  { en: 'Hackathon', id: 'Hackathon', category: 'hackathon' },
  { en: 'Machine Learning Competition', id: 'Kompetisi Machine Learning', category: 'ai-ml' },
  { en: 'Research Competition', id: 'Lomba Riset', category: 'research' },
  { en: 'Certification', id: 'Sertifikasi', category: 'certification' },
];

const STATUS: Field[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      ['draft', 'Draft (hidden)'],
      ['published', 'Published'],
      ['archived', 'Archived'],
    ],
    help: 'Only published items appear on the site after you press Publish.',
  },
  { key: 'is_placeholder', label: 'Placeholder', type: 'bool', help: 'Tick while this is dummy content.' },
  { key: 'needs_review', label: 'Indonesian text needs review', type: 'bool' },
];

export const collections: Record<string, Collection> = {
  achievements: {
    table: 'achievements',
    title: 'Achievements',
    singular: 'achievement',
    titleKey: 'title',
    quickAdd: true,
    subtitle: (r) => `${en(r.rank_label)} · ${String(r.organizer ?? '')} · ${month(r.achieved_on)}`,
    defaults: () => ({
      rank_label: { en: '1st Place', id: 'Juara 1' },
      rank_tier: 1,
      title: { en: '' },
      category: 'essay',
      organizer: '',
      achieved_on: `${new Date().toISOString().slice(0, 7)}-01`,
      date_precision: 'month',
      highlights: [],
      tags: [],
      proofs: [],
      gallery_media_ids: [],
      featured: false,
      status: 'draft',
    }),
    fields: [
      {
        key: 'title',
        label: 'Event title',
        type: 'localized',
        required: true,
        help: 'Official event name only — no placement, no "by …", no trailing (year).',
      },
      {
        key: 'rank_label',
        label: 'Placement label',
        type: 'localized',
        required: true,
        help: 'Use the presets: 1st / 2nd / 3rd Place, or Top N Finalist.',
      },
      {
        key: 'rank_tier',
        label: 'Placement number',
        type: 'number',
        help: '1, 2, 3 for the podium; N for "Top N"; empty for other.',
      },
      { key: 'type_label', label: 'Type', type: 'localized', help: 'e.g. Essay Competition, Hackathon.' },
      {
        key: 'category',
        label: 'Category (filter)',
        type: 'select',
        required: true,
        options: [
          ['essay', 'Essay'],
          ['business', 'Business'],
          ['hackathon', 'Hackathon'],
          ['ai-ml', 'AI / ML'],
          ['research', 'Research'],
          ['certification', 'Certification'],
          ['other', 'Other'],
        ],
      },
      {
        key: 'organizer',
        label: 'Organizer (host institution)',
        type: 'text',
        required: true,
        help: 'Full official name.',
      },
      { key: 'achieved_on', label: 'Month', type: 'month', required: true },
      {
        key: 'scope',
        label: 'Scope',
        type: 'select',
        options: [
          ['', '— not stated —'],
          ['international', 'International'],
          ['national', 'National'],
          ['regional', 'Regional'],
          ['campus', 'Campus'],
        ],
        help: 'Leave empty if you are not sure. Never guess.',
      },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Chiang Mai, Thailand' },
      {
        key: 'entry_type',
        label: 'Entry',
        type: 'select',
        options: [
          ['', '— not stated —'],
          ['individual', 'Individual'],
          ['team', 'Team'],
        ],
      },
      {
        key: 'summary',
        label: 'Summary (shown on the card)',
        type: 'localizedArea',
        help: 'One or two factual sentences, up to 280 characters.',
      },
      { key: 'highlights', label: 'Highlights', type: 'localizedList' },
      {
        key: 'proofs',
        label: 'Proofs (certificate, photo, PDF or link)',
        type: 'proofs',
        help: 'Add these whenever you have them. "View proof" appears on the site once one exists.',
      },
      { key: 'cover_media_id', label: 'Cover image', type: 'media' },
      { key: 'gallery_media_ids', label: 'Event photos', type: 'mediaList' },
      { key: 'project_slug', label: 'Linked project (slug)', type: 'text', placeholder: 'edge-ai-oyster-mushroom' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'featured', label: 'Featured (shown in the big rail, max 6)', type: 'bool' },
      ...STATUS,
    ],
  },
  projects: {
    table: 'projects',
    title: 'Projects',
    singular: 'project',
    titleKey: 'title',
    subtitle: (r) => `${en(r.role)} · ${String(r.year ?? '')}`,
    defaults: () => ({
      title: { en: '' },
      stack: [],
      links: [],
      gallery_media_ids: [],
      featured: false,
      status: 'draft',
      year: new Date().getFullYear(),
    }),
    fields: [
      { key: 'title', label: 'Title', type: 'localized', required: true },
      { key: 'role', label: 'Your role', type: 'localized' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'summary', label: 'Summary', type: 'localizedArea' },
      { key: 'body', label: 'Case study (plain text, blank line = new paragraph)', type: 'localizedArea' },
      { key: 'stack', label: 'Tech stack', type: 'tags' },
      { key: 'links', label: 'Links', type: 'links' },
      { key: 'cover_media_id', label: 'Cover image', type: 'media' },
      { key: 'gallery_media_ids', label: 'Screenshots', type: 'mediaList' },
      { key: 'linked_achievement_slug', label: 'Award (achievement slug)', type: 'text' },
      { key: 'featured', label: 'Featured', type: 'bool' },
      ...STATUS,
    ],
  },
  experiences: {
    table: 'experiences',
    title: 'Experience',
    singular: 'experience',
    titleKey: 'role',
    subtitle: (r) =>
      `${String(r.organization ?? '')} · ${month(r.start_on)}${r.is_current ? ' → now' : r.end_on ? ` → ${month(r.end_on)}` : ''}`,
    defaults: () => ({
      kind: 'work',
      organization: '',
      role: { en: '' },
      start_on: `${new Date().toISOString().slice(0, 7)}-01`,
      is_current: false,
      highlights: [],
      featured_highlights: 3,
      status: 'draft',
    }),
    fields: [
      { key: 'role', label: 'Role', type: 'localized', required: true },
      { key: 'organization', label: 'Organization', type: 'text', required: true },
      {
        key: 'kind',
        label: 'Kind',
        type: 'select',
        required: true,
        options: [
          ['work', 'Work'],
          ['organization', 'Organization'],
        ],
      },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'start_on', label: 'Start', type: 'month', required: true },
      { key: 'end_on', label: 'End', type: 'month' },
      { key: 'is_current', label: 'Current role', type: 'bool' },
      { key: 'summary', label: 'Summary', type: 'localizedArea' },
      { key: 'highlights', label: 'Highlights', type: 'localizedList' },
      { key: 'featured_highlights', label: 'Highlights shown before "Show all"', type: 'number' },
      ...STATUS,
    ],
  },
  education: {
    table: 'education',
    title: 'Education',
    singular: 'education entry',
    titleKey: 'program',
    subtitle: (r) => `${String(r.institution ?? '')} · GPA ${String(r.gpa ?? '—')}`,
    defaults: () => ({
      institution: '',
      program: { en: '' },
      start_on: `${new Date().getFullYear()}-07-01`,
      is_expected: false,
      gpa_scale: 4,
      status: 'draft',
    }),
    fields: [
      { key: 'program', label: 'Program', type: 'localized', required: true },
      { key: 'institution', label: 'Institution', type: 'text', required: true },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'start_on', label: 'Start', type: 'month', required: true },
      { key: 'end_on', label: 'End', type: 'month' },
      { key: 'is_expected', label: 'End date is expected', type: 'bool' },
      { key: 'gpa', label: 'GPA', type: 'number' },
      { key: 'gpa_scale', label: 'GPA scale', type: 'number' },
      ...STATUS,
    ],
  },
  skills: {
    table: 'skills',
    title: 'Skills',
    singular: 'skill',
    titleKey: 'label',
    subtitle: (r) => `${String(r.group_key ?? '')} · ${String(r.kind ?? '')}`,
    defaults: () => ({ label: { en: '' }, group_key: 'stack', kind: 'hard', status: 'published' }),
    fields: [
      { key: 'label', label: 'Label', type: 'localized', required: true },
      {
        key: 'group_key',
        label: 'Group',
        type: 'select',
        required: true,
        options: [
          ['stack', 'Languages & Frameworks'],
          ['ai', 'AI & Data'],
          ['web', 'Web & Backend'],
          ['iot', 'IoT & Embedded'],
          ['tools', 'Tools & Design'],
          ['leadership', 'Leadership'],
        ],
      },
      {
        key: 'kind',
        label: 'Kind',
        type: 'select',
        required: true,
        options: [
          ['hard', 'Hard skill'],
          ['soft', 'Soft skill'],
        ],
      },
      ...STATUS,
    ],
  },
  gallery_items: {
    table: 'gallery_items',
    title: 'Gallery',
    singular: 'photo',
    titleKey: 'caption',
    subtitle: (r) => `${String(r.album ?? 'no album')}${r.media_id ? '' : ' · no photo yet'}`,
    defaults: () => ({ status: 'draft' }),
    fields: [
      { key: 'media_id', label: 'Photo', type: 'media', required: true },
      { key: 'caption', label: 'Caption', type: 'localized' },
      { key: 'album', label: 'Album', type: 'text', placeholder: 'Chiang Mai 2026' },
      { key: 'achievement_slug', label: 'Linked achievement (slug)', type: 'text' },
      { key: 'taken_on', label: 'Date taken', type: 'date' },
      ...STATUS,
    ],
  },
};

export const collectionOrder = [
  'achievements',
  'projects',
  'experiences',
  'education',
  'skills',
  'gallery_items',
] as const;
export { en as enText };
