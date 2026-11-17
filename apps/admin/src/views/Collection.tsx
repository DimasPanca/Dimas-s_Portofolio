import { displayLine, type Locale, lintAchievement } from '@portfolio/schema';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Collection, enText, RANKS, TYPE_PRESETS } from '../collections.ts';
import { FieldInput } from '../components/Fields.tsx';
import { slugify, uploadImage } from '../lib/media.ts';
import { must, type Row, supabase } from '../lib/supabase.ts';

const nameOf = (c: Collection, row: Row) => enText(row[c.titleKey]) || String(row.slug ?? '(untitled)');

/* ------------------------------------------------------------------- list */
export function CollectionList({ collection: c, go }: { collection: Collection; go: (hash: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [bulk, setBulk] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(must(await supabase.from(c.table).select('*').order('sort_order').order('created_at')) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, [c.table]);
  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (filter === 'all' || (filter === 'placeholder' ? r.is_placeholder : r.status === filter)) &&
          nameOf(c, r).toLowerCase().includes(query.toLowerCase()),
      ),
    [rows, filter, query, c],
  );

  // Reordering renumbers the whole list so the order is always unambiguous.
  const move = async (row: Row, dir: -1 | 1) => {
    if (!rows) return;
    const list = [...rows];
    const i = list.indexOf(row);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i];
    const b = list[j];
    if (!a || !b) return;
    list[i] = b;
    list[j] = a;
    setRows(list.map((r, k) => ({ ...r, sort_order: k })));
    try {
      await Promise.all(
        list.map((r, k) =>
          r.sort_order === k ? null : supabase.from(c.table).update({ sort_order: k }).eq('id', r.id),
        ),
      );
    } catch {
      void load();
    }
  };

  const setStatus = async (row: Row, status: string) => {
    await supabase.from(c.table).update({ status }).eq('id', row.id);
    void load();
  };

  return (
    <section>
      <header className="head">
        <h1>{c.title}</h1>
        <div className="head__actions">
          {c.table === 'gallery_items' && (
            <button type="button" className="btn btn--ghost" onClick={() => setBulk((v) => !v)}>
              Bulk upload
            </button>
          )}
          <button type="button" className="btn" onClick={() => go(`#/${c.table}/new`)}>
            + New {c.singular}
          </button>
        </div>
      </header>
      {bulk && (
        <BulkUpload
          onDone={() => {
            setBulk(false);
            void load();
          }}
        />
      )}
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="archived">Archived</option>
          <option value="placeholder">Placeholders</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && shown.length === 0 && <p className="muted">Nothing here yet.</p>}
      <ul className="rows">
        {shown.map((r) => (
          <li key={String(r.id)} className="row">
            <div className="row__order">
              <button
                type="button"
                onClick={() => move(r, -1)}
                aria-label="Move up"
                disabled={filter !== 'all' || query !== ''}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(r, 1)}
                aria-label="Move down"
                disabled={filter !== 'all' || query !== ''}
              >
                ↓
              </button>
            </div>
            <a className="row__main" href={`#/${c.table}/${String(r.id)}`}>
              <strong>{nameOf(c, r)}</strong>
              <span className="muted">{c.subtitle(r)}</span>
            </a>
            <div className="row__badges">
              <span className={`badge badge--${String(r.status)}`}>{String(r.status)}</span>
              {Boolean(r.is_placeholder) && <span className="badge badge--warn">placeholder</span>}
              {Boolean(r.needs_review) && <span className="badge">review ID</span>}
              {c.table === 'achievements' && Array.isArray(r.proofs) && r.proofs.length === 0 && (
                <span className="badge badge--warn">no proof</span>
              )}
            </div>
            {r.status === 'published' ? (
              <button type="button" className="link" onClick={() => setStatus(r, 'draft')}>
                Unpublish
              </button>
            ) : (
              <button type="button" className="link" onClick={() => setStatus(r, 'published')}>
                Publish
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Gallery: pick many photos at once; each becomes a draft gallery item in the chosen album. */
function BulkUpload({ onDone }: { onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [album, setAlbum] = useState('');
  const [alt, setAlt] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const run = async () => {
    setError('');
    try {
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}…`);
        const mediaId = await uploadImage(file, { en: `${alt.trim()} (${i + 1})` }, 'gallery');
        must(
          await supabase.from('gallery_items').insert({
            slug: `${slugify(album || 'photo')}-${crypto.randomUUID().slice(0, 6)}`,
            media_id: mediaId,
            album: album || null,
            status: 'draft',
            sort_order: 100 + i,
          }),
        );
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setProgress('');
    }
  };
  return (
    <div className="panel">
      <h2>Bulk upload</h2>
      <p className="muted">
        Photos are resized, stripped of location data and saved as drafts. Edit captions afterwards.
      </p>
      <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
      <input placeholder="Album, e.g. Chiang Mai 2026" value={album} onChange={(e) => setAlbum(e.target.value)} />
      <input
        placeholder="What the photos show (used as alt text) *"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
      />
      <button type="button" className="btn" disabled={!files.length || !alt.trim() || Boolean(progress)} onClick={run}>
        {progress || `Upload ${files.length || ''} photo${files.length === 1 ? '' : 's'}`}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- form */
export function CollectionForm({
  collection: c,
  id,
  go,
}: {
  collection: Collection;
  id: string;
  go: (hash: string) => void;
}) {
  const isNew = id === 'new';
  const [row, setRow] = useState<Row | null>(isNew ? c.defaults() : null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    supabase
      .from(c.table)
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: e }) => (e ? setError(e.message) : setRow((data as Row) ?? null)));
  }, [c.table, id, isNew]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key: string, value: unknown) => {
    setRow((r) => ({ ...(r ?? {}), [key]: value }));
    setDirty(true);
    setMessage('');
  };

  // Writing-standard hints for achievements (PRD §2.5.1): shown live, never blocking.
  const hints = useMemo(() => {
    if (c.table !== 'achievements' || !row) return { lint: [] as string[], preview: '' };
    const draft = {
      rankLabel: { en: enText(row.rank_label) },
      title: { en: enText(row.title) },
      organizer: String(row.organizer ?? ''),
      achievedOn: String(row.achieved_on ?? ''),
    };
    const preview = (locale: Locale) =>
      draft.title.en && draft.achievedOn
        ? displayLine({ ...draft, datePrecision: 'month' } as Parameters<typeof displayLine>[0], locale)
        : '';
    return { lint: draft.title.en ? lintAchievement(draft) : [], preview: preview('en') };
  }, [c.table, row]);

  const save = async (status?: string) => {
    if (!row) return;
    setError('');
    const missing = c.fields.filter(
      (f) => f.required && !(f.type.startsWith('localized') ? enText(row[f.key]) : row[f.key]),
    );
    if (missing.length) return setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
    setSaving(true);
    try {
      const payload: Row = { ...row, ...(status ? { status } : {}) };
      if (!payload.slug)
        payload.slug = `${slugify(enText(payload[c.titleKey]) || c.singular)}-${crypto.randomUUID().slice(0, 4)}`;
      for (const k of ['id', 'created_at', 'updated_at', 'published_at']) delete payload[k];
      if (isNew) {
        const created = must(await supabase.from(c.table).insert(payload).select('id').single()) as { id: string };
        setDirty(false);
        go(`#/${c.table}/${created.id}`);
      } else {
        const saved = must(await supabase.from(c.table).update(payload).eq('id', id).select('*').single()) as Row;
        setRow(saved);
        setDirty(false);
        setMessage(
          status === 'published'
            ? 'Saved and marked as published. Press Publish (top right) to update the site.'
            : 'Saved.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew || !row) return;
    if (
      window.prompt(`Type DELETE to permanently remove "${nameOf(c, row)}". Archiving is usually better.`) !== 'DELETE'
    )
      return;
    const { error: e } = await supabase.from(c.table).delete().eq('id', id);
    if (e) return setError(e.message);
    setDirty(false);
    go(`#/${c.table}`);
  };

  if (!row) return <p className="muted">{error || 'Loading…'}</p>;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <header className="head">
        <div>
          <a href={`#/${c.table}`} className="link">
            ← {c.title}
          </a>
          <h1>{isNew ? `New ${c.singular}` : nameOf(c, row)}</h1>
        </div>
        <div className="head__actions">
          {!isNew && (
            <button type="button" className="link danger" onClick={remove}>
              Delete
            </button>
          )}
          <button type="submit" className="btn btn--ghost" disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" className="btn" disabled={saving} onClick={() => save('published')}>
            Save & mark published
          </button>
        </div>
      </header>

      {c.table === 'achievements' && (
        <div className="panel">
          <p className="muted">Quick presets</p>
          <div className="chips">
            {RANKS.map(([key, label, tier]) => (
              <button
                type="button"
                key={key}
                className="chipbtn"
                onClick={() => {
                  set('rank_label', label);
                  set('rank_tier', tier);
                }}
              >
                {label.en}
              </button>
            ))}
            {[4, 5, 10].map((n) => (
              <button
                type="button"
                key={n}
                className="chipbtn"
                onClick={() => {
                  set('rank_label', { en: `Top ${n} Finalist`, id: `Finalis Top ${n}` });
                  set('rank_tier', n);
                }}
              >
                Top {n} Finalist
              </button>
            ))}
          </div>
          <div className="chips">
            {TYPE_PRESETS.map((t) => (
              <button
                type="button"
                key={t.en}
                className="chipbtn"
                onClick={() => {
                  set('type_label', { en: t.en, id: t.id });
                  set('category', t.category);
                }}
              >
                {t.en}
              </button>
            ))}
          </div>
          {hints.preview && (
            <p className="preview">
              <span className="muted">Shown as:</span> {hints.preview}
            </p>
          )}
          {hints.lint.map((h) => (
            <p key={h} className="hint">
              ⚠ {h}
            </p>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <div className="fields">
        {c.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={row[f.key]} onChange={(v) => set(f.key, v)} />
        ))}
        <div className="field">
          <label className="field__label" htmlFor="slug">
            Slug (web address)
          </label>
          <input
            id="slug"
            value={String(row.slug ?? '')}
            onChange={(e) => set('slug', slugify(e.target.value))}
            placeholder="generated from the title"
          />
          <p className="field__help">Changing the slug of a published item changes its link.</p>
        </div>
      </div>
    </form>
  );
}
