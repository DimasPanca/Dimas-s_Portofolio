import { useEffect, useId, useState } from 'react';
import type { Field } from '../collections.ts';
import { uploadImage } from '../lib/media.ts';
import { publicUrl, supabase } from '../lib/supabase.ts';

type Loc = { en: string; id?: string };
const asLoc = (v: unknown): Loc =>
  v && typeof v === 'object' ? { ...(v as Loc), en: (v as Loc).en ?? '' } : { en: '' };
const cleanLoc = (v: Loc): Loc | null => {
  const en = v.en.trim();
  const id = v.id?.trim();
  if (!en && !id) return null;
  return id ? { en, id } : { en };
};

function LocalizedInput({
  value,
  onChange,
  area,
}: {
  value: unknown;
  onChange: (v: Loc | null) => void;
  area?: boolean;
}) {
  const v = asLoc(value);
  const base = useId();
  const set = (patch: Partial<Loc>) => onChange(cleanLoc({ ...v, ...patch }) ?? { en: '' });
  const control = (lang: 'en' | 'id') => {
    const props = {
      id: `${base}-${lang}`,
      value: (lang === 'en' ? v.en : v.id) ?? '',
      placeholder: lang === 'id' ? 'optional — falls back to English' : undefined,
    };
    return area ? (
      <textarea {...props} rows={3} onChange={(e) => set({ [lang]: e.target.value })} />
    ) : (
      <input {...props} onChange={(e) => set({ [lang]: e.target.value })} />
    );
  };
  return (
    <div className="loc">
      {(['en', 'id'] as const).map((lang) => (
        <div className="loc__row" key={lang}>
          <label className="tagc" htmlFor={`${base}-${lang}`}>
            {lang.toUpperCase()}
          </label>
          {control(lang)}
        </div>
      ))}
      {v.en && !v.id && (
        <button type="button" className="link" onClick={() => set({ id: v.en })}>
          Copy EN → ID
        </button>
      )}
    </div>
  );
}

/** Shows an uploaded image and lets the owner upload a new one (re-encoded, EXIF stripped, alt required). */
export function MediaInput({ value, onChange }: { value: unknown; onChange: (id: string | null) => void }) {
  const id = typeof value === 'string' && value ? value : null;
  const [thumb, setThumb] = useState<{ url: string; alt: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState<Loc>({ en: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setThumb(null);
    if (!id) return;
    let live = true;
    supabase
      .from('media')
      .select('path, alt')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (live && data) setThumb({ url: publicUrl('media', data.path as string), alt: (data.alt as Loc).en });
      });
    return () => {
      live = false;
    };
  }, [id]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadImage(file, alt));
      setFile(null);
      setAlt({ en: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="media">
      {thumb && <img src={thumb.url} alt={thumb.alt} className="media__thumb" />}
      {id && (
        <button type="button" className="link" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file && (
        <div className="media__alt">
          <input
            placeholder="Alt text (EN) — describe the photo"
            value={alt.en}
            onChange={(e) => setAlt({ ...alt, en: e.target.value })}
          />
          <input
            placeholder="Alt text (ID) — optional"
            value={alt.id ?? ''}
            onChange={(e) => setAlt({ ...alt, id: e.target.value })}
          />
          <button type="button" className="btn btn--small" disabled={busy || !alt.en.trim()} onClick={upload}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ListEditor<T>({
  items,
  onChange,
  empty,
  render,
  add,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  empty: () => T;
  render: (item: T, set: (v: T) => void) => React.ReactNode;
  add: string;
}) {
  return (
    <div className="list">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items have no stable id; order is the identity here
        <div className="list__row" key={i}>
          <div className="list__body">{render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
          <button
            type="button"
            className="link danger"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--small btn--ghost" onClick={() => onChange([...items, empty()])}>
        + {add}
      </button>
    </div>
  );
}

type Proof = { kind: string; label?: Loc; url?: string; mediaId?: string };
type LinkItem = { label: string; url: string; kind: string };

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const htmlId = useId();
  const common = { id: htmlId, required: field.required, placeholder: field.placeholder };
  let control: React.ReactNode;
  switch (field.type) {
    case 'text':
    case 'url':
      control = (
        <input
          {...common}
          type={field.type === 'url' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
      break;
    case 'textarea':
      control = (
        <textarea {...common} rows={4} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
      );
      break;
    case 'number':
      control = (
        <input
          {...common}
          type="number"
          step="any"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
      break;
    case 'month':
      control = (
        <input
          {...common}
          type="month"
          value={String(value ?? '').slice(0, 7)}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}-01` : null)}
        />
      );
      break;
    case 'date':
      control = (
        <input {...common} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
      );
      break;
    case 'bool':
      control = (
        <input id={htmlId} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      );
      break;
    case 'select':
      control = (
        <select {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
          {field.options?.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      );
      break;
    case 'tags':
      control = (
        <input
          {...common}
          value={Array.isArray(value) ? value.join(', ') : ''}
          placeholder="comma, separated"
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
        />
      );
      break;
    case 'localized':
      control = <LocalizedInput value={value} onChange={onChange} />;
      break;
    case 'localizedArea':
      control = <LocalizedInput value={value} onChange={onChange} area />;
      break;
    case 'localizedList':
      control = (
        <ListEditor<Loc>
          items={Array.isArray(value) ? (value as Loc[]) : []}
          onChange={onChange}
          empty={() => ({ en: '' })}
          add="Add highlight"
          render={(item, set) => <LocalizedInput value={item} onChange={(v) => set(v ?? { en: '' })} />}
        />
      );
      break;
    case 'media':
      control = <MediaInput value={value} onChange={onChange} />;
      break;
    case 'mediaList':
      control = (
        <ListEditor<string | null>
          items={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v.filter(Boolean))}
          empty={() => null}
          add="Add photo"
          render={(item, set) => <MediaInput value={item} onChange={(id) => set(id)} />}
        />
      );
      break;
    case 'proofs':
      control = (
        <ListEditor<Proof>
          items={Array.isArray(value) ? (value as Proof[]) : []}
          onChange={onChange}
          empty={() => ({ kind: 'link' })}
          add="Add proof"
          render={(item, set) => (
            <div className="grid2">
              <select
                value={item.kind}
                onChange={(e) => set({ ...item, kind: e.target.value })}
                aria-label="Proof type"
              >
                <option value="certificate">Certificate (image)</option>
                <option value="photo">Photo</option>
                <option value="pdf">PDF link</option>
                <option value="link">Link (e.g. Google Drive)</option>
              </select>
              <input
                placeholder="Label (optional)"
                value={item.label?.en ?? ''}
                onChange={(e) => set({ ...item, label: e.target.value ? { en: e.target.value } : undefined })}
              />
              {item.kind === 'certificate' || item.kind === 'photo' ? (
                <MediaInput value={item.mediaId} onChange={(id) => set({ ...item, mediaId: id ?? undefined })} />
              ) : (
                <input
                  type="url"
                  placeholder="https://…"
                  value={item.url ?? ''}
                  onChange={(e) => set({ ...item, url: e.target.value || undefined })}
                />
              )}
            </div>
          )}
        />
      );
      break;
    case 'links':
      control = (
        <ListEditor<LinkItem>
          items={Array.isArray(value) ? (value as LinkItem[]) : []}
          onChange={onChange}
          empty={() => ({ label: '', url: '', kind: 'other' })}
          add="Add link"
          render={(item, set) => (
            <div className="grid2">
              <input placeholder="Label" value={item.label} onChange={(e) => set({ ...item, label: e.target.value })} />
              <input
                type="url"
                placeholder="https://…"
                value={item.url}
                onChange={(e) => set({ ...item, url: e.target.value })}
              />
              <select value={item.kind} onChange={(e) => set({ ...item, kind: e.target.value })} aria-label="Link type">
                <option value="demo">Demo</option>
                <option value="repo">Repository</option>
                <option value="article">Article</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        />
      );
      break;
  }
  return (
    <div className={`field field--${field.type}`}>
      <label htmlFor={htmlId} className="field__label">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {field.help && <p className="field__help">{field.help}</p>}
    </div>
  );
}
