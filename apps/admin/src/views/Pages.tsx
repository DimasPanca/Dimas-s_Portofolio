import { useCallback, useEffect, useState } from 'react';
import { collectionOrder, collections } from '../collections.ts';
import { FieldInput } from '../components/Fields.tsx';
import { uploadPdf } from '../lib/media.ts';
import { must, publicUrl, type Row, siteUrl, supabase } from '../lib/supabase.ts';

type Counts = Record<string, { published: number; draft: number; archived: number; placeholder: number }>;

async function loadCounts(): Promise<Counts> {
  const out: Counts = {};
  await Promise.all(
    collectionOrder.map(async (key) => {
      const rows =
        (must(await supabase.from(collections[key]?.table ?? key).select('status, is_placeholder')) as Row[]) ?? [];
      out[key] = {
        published: rows.filter((r) => r.status === 'published').length,
        draft: rows.filter((r) => r.status === 'draft').length,
        archived: rows.filter((r) => r.status === 'archived').length,
        placeholder: rows.filter((r) => r.is_placeholder && r.status !== 'archived').length,
      };
    }),
  );
  return out;
}

/* -------------------------------------------------------------- dashboard */
export function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [extra, setExtra] = useState<{
    noProof: Row[];
    review: number;
    unread: number;
    last: Row | null;
    events: Row[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCounts(await loadCounts());
        const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const [ach, messages, runs, events] = await Promise.all([
          supabase.from('achievements').select('id, title, proofs, needs_review, status'),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
          supabase.from('publish_runs').select('*').order('triggered_at', { ascending: false }).limit(1),
          supabase.from('events').select('name, hits').gte('day', since),
        ]);
        const achievements = (ach.data ?? []) as Row[];
        const totals = new Map<string, number>();
        for (const e of (events.data ?? []) as Row[])
          totals.set(String(e.name), (totals.get(String(e.name)) ?? 0) + Number(e.hits));
        setExtra({
          noProof: achievements.filter(
            (a) => a.status !== 'archived' && Array.isArray(a.proofs) && a.proofs.length === 0,
          ),
          review: achievements.filter((a) => a.needs_review).length,
          unread: messages.count ?? 0,
          last: ((runs.data ?? [])[0] as Row | undefined) ?? null,
          events: [...totals].map(([name, hits]) => ({ name, hits })),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the dashboard.');
      }
    })();
  }, []);

  const placeholders = counts ? Object.values(counts).reduce((n, c) => n + c.placeholder, 0) : 0;
  return (
    <section>
      <header className="head">
        <h1>Dashboard</h1>
        <a className="btn" href="#/achievements/new">
          + Quick add achievement
        </a>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="cards">
        {collectionOrder.map((key) => (
          <a key={key} className="card" href={`#/${key}`}>
            <span className="muted">{collections[key]?.title}</span>
            <strong>{counts ? counts[key]?.published : '…'}</strong>
            <span className="muted">
              published · {counts?.[key]?.draft ?? 0} draft
              {counts?.[key]?.placeholder ? ` · ${counts[key]?.placeholder} placeholder` : ''}
            </span>
          </a>
        ))}
      </div>
      <div className="grid2 gap">
        <div className="panel">
          <h2>To do</h2>
          <ul className="todo">
            <li>
              <a href="#/inbox">{extra?.unread ?? '…'} unread message(s)</a>
            </li>
            <li>{placeholders} placeholder item(s) still on the site</li>
            <li>{extra?.review ?? '…'} achievement(s) with Indonesian text to review</li>
            <li>
              {extra?.noProof.length ?? '…'} achievement(s) without proof
              <ul>
                {extra?.noProof.slice(0, 9).map((a) => (
                  <li key={String(a.id)}>
                    <a href={`#/achievements/${String(a.id)}`}>
                      {String((a.title as { en?: string } | null)?.en ?? '')}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
        <div className="panel">
          <h2>Site</h2>
          <p className="muted">
            Last publish:{' '}
            {extra?.last
              ? `${new Date(String(extra.last.triggered_at)).toLocaleString()} (${String(extra.last.status)})`
              : 'never'}
          </p>
          <h3>Last 30 days</h3>
          {extra?.events.length ? (
            <ul className="todo">
              {extra.events.map((e) => (
                <li key={String(e.name)}>
                  {String(e.name).replace(/_/g, ' ')}: <strong>{String(e.hits)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No events recorded yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- publish */
export function Publish() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [runs, setRuns] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setCounts(await loadCounts().catch(() => null));
    const { data } = await supabase
      .from('publish_runs')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(8);
    setRuns((data ?? []) as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const placeholders = counts ? Object.values(counts).reduce((n, c) => n + c.placeholder, 0) : 0;
  const publish = async () => {
    if (
      placeholders > 0 &&
      !window.confirm(`${placeholders} placeholder item(s) will still be visible. Publish anyway?`)
    )
      return;
    setBusy(true);
    setResult(null);
    const { error } = await supabase.functions.invoke('trigger-deploy', {
      body: { note, placeholders, summary: counts },
    });
    setBusy(false);
    setResult(
      error
        ? {
            ok: false,
            text: 'Publishing failed. Check that the deploy hook is set (VERCEL_DEPLOY_HOOK_URL) and that you completed the MFA step.',
          }
        : { ok: true, text: 'Publish started. The site usually updates in about 1–2 minutes.' },
    );
    void load();
  };

  return (
    <section>
      <header className="head">
        <h1>Publish</h1>
      </header>
      <div className="panel">
        <p>Publishing rebuilds the public site from everything marked “published”. Drafts stay hidden.</p>
        <ul className="todo">
          {collectionOrder.map((key) => (
            <li key={key}>
              {collections[key]?.title}: <strong>{counts?.[key]?.published ?? '…'}</strong> published,{' '}
              {counts?.[key]?.draft ?? 0} draft
            </li>
          ))}
        </ul>
        {placeholders > 0 && <p className="hint">⚠ {placeholders} placeholder item(s) are still published.</p>}
        <input
          placeholder="Note (optional), e.g. “added Agridata win”"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className="btn" disabled={busy} onClick={publish}>
          {busy ? 'Publishing…' : 'Publish site'}
        </button>
        {result && <p className={result.ok ? 'ok' : 'error'}>{result.text}</p>}
        {siteUrl && (
          <p>
            <a className="link" href={siteUrl} target="_blank" rel="noreferrer">
              Open the site ↗
            </a>
          </p>
        )}
      </div>
      <h2>History</h2>
      <ul className="rows">
        {runs.map((r) => (
          <li key={String(r.id)} className="row">
            <span className="row__main">
              <strong>{new Date(String(r.triggered_at)).toLocaleString()}</strong>
              <span className="muted">{String(r.note ?? '')}</span>
            </span>
            <span className={`badge badge--${r.status === 'triggered' ? 'published' : 'warn'}`}>
              {String(r.status)}
            </span>
          </li>
        ))}
        {runs.length === 0 && <li className="muted">No publishes yet.</li>}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ inbox */
export function Inbox() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (e) setError(e.message);
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const mark = async (id: unknown, status: string) => {
    await supabase.from('messages').update({ status }).eq('id', id);
    void load();
  };
  const remove = async (id: unknown) => {
    if (!window.confirm('Delete this message permanently?')) return;
    await supabase.from('messages').delete().eq('id', id);
    void load();
  };
  return (
    <section>
      <header className="head">
        <h1>Inbox</h1>
      </header>
      <p className="muted">Messages from the contact form. They are removed automatically after 90 days.</p>
      {error && <p className="error">{error}</p>}
      {rows?.length === 0 && <p className="muted">No messages yet.</p>}
      <ul className="rows">
        {rows?.map((m) => (
          <li key={String(m.id)} className={`msg ${m.status === 'new' ? 'msg--new' : ''}`}>
            <p className="msg__meta">
              <strong>{String(m.name)}</strong> · <a href={`mailto:${String(m.email)}`}>{String(m.email)}</a> ·{' '}
              {String(m.topic)} · {new Date(String(m.created_at)).toLocaleString()}{' '}
              <span className={`badge badge--${String(m.status)}`}>{String(m.status)}</span>
            </p>
            <p className="msg__body">{String(m.message)}</p>
            <p className="msg__actions">
              <a className="link" href={`mailto:${String(m.email)}?subject=${encodeURIComponent('Re: your message')}`}>
                Reply
              </a>
              {m.status !== 'read' && (
                <button type="button" className="link" onClick={() => mark(m.id, 'read')}>
                  Mark read
                </button>
              )}
              <button type="button" className="link" onClick={() => mark(m.id, 'archived')}>
                Archive
              </button>
              <button type="button" className="link" onClick={() => mark(m.id, 'spam')}>
                Spam
              </button>
              <button type="button" className="link danger" onClick={() => remove(m.id)}>
                Delete
              </button>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- settings */
const get = (obj: Row, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Row)[k] : undefined), obj);
const setPath = (obj: Row, path: string, value: unknown): Row => {
  const [head, ...rest] = path.split('.');
  if (!head) return obj;
  if (rest.length === 0) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(((obj[head] as Row | null) ?? {}) as Row, rest.join('.'), value) };
};

const SETTINGS: {
  title: string;
  fields: {
    path: string;
    label: string;
    type: 'text' | 'localized' | 'localizedArea' | 'tags' | 'bool';
    help?: string;
  }[];
}[] = [
  {
    title: 'Profile',
    fields: [
      { path: 'profile.name', label: 'Name', type: 'text' },
      { path: 'profile.location', label: 'Location', type: 'text' },
      { path: 'profile.email', label: 'Email', type: 'text' },
      { path: 'profile.headline', label: 'Headline', type: 'localized' },
      {
        path: 'profile.bio',
        label: 'About statement',
        type: 'localizedArea',
        help: 'The big paragraph in the About section.',
      },
      { path: 'profile.interests', label: 'Focus areas', type: 'tags' },
    ],
  },
  {
    title: 'Hero',
    fields: [
      { path: 'hero.eyebrow', label: 'Small line above the name', type: 'localized' },
      { path: 'hero.pitch', label: 'Pitch', type: 'localized' },
      { path: 'hero.marquee', label: 'Background words', type: 'tags' },
      {
        path: 'availability',
        label: 'Availability line (ticker)',
        type: 'localized',
        help: 'e.g. “Open to internships & collaborations”.',
      },
      { path: 'availability.isPlaceholder', label: 'Availability is still a placeholder', type: 'bool' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { path: 'contact.email', label: 'Contact email', type: 'text' },
      {
        path: 'contact.whatsappNumber',
        label: 'WhatsApp number',
        type: 'text',
        help: 'Digits only with country code, e.g. 6281234567890. Leave empty to hide WhatsApp.',
      },
      { path: 'contact.whatsappVisible', label: 'Show WhatsApp on the site', type: 'bool' },
    ],
  },
  {
    title: 'Search & sharing',
    fields: [
      { path: 'seo.title', label: 'Page title', type: 'localized' },
      { path: 'seo.description', label: 'Description', type: 'localizedArea' },
    ],
  },
];

export function Settings() {
  const [row, setRow] = useState<Row | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) =>
        error
          ? setStatus({ ok: false, text: error.message })
          : setRow((data as Row) ?? { id: 1, profile: {}, hero: {}, contact: {}, seo: {}, socials: [] }),
      );
  }, []);
  if (!row) return <p className="muted">{status?.text ?? 'Loading…'}</p>;

  const save = async () => {
    setBusy(true);
    setStatus(null);
    const contact = { ...((row.contact as Row | null) ?? {}) };
    const digits = String(contact.whatsappNumber ?? '').replace(/\D/g, '');
    contact.whatsappNumber = digits || null;
    const payload = { ...row, contact, id: 1 };
    delete (payload as Row).updated_at;
    const { error } = await supabase.from('site_settings').upsert(payload);
    setBusy(false);
    setStatus(
      error ? { ok: false, text: error.message } : { ok: true, text: 'Saved. Press Publish to update the site.' },
    );
  };

  const uploadCv = async (file: File | undefined) => {
    if (!file) return;
    try {
      const path = await uploadPdf(file);
      setRow((r) => ({ ...(r ?? {}), cv_path: path }));
      setStatus({ ok: true, text: 'CV uploaded. Press Save, then Publish.' });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' });
    }
  };

  type Social = { kind: string; label: string; url: string; handle?: string };
  const socials = (Array.isArray(row.socials) ? row.socials : []) as Social[];
  const setSocials = (next: Social[]) => setRow((r) => ({ ...(r ?? {}), socials: next }));

  return (
    <section className="form">
      <header className="head">
        <h1>Settings</h1>
        <button type="button" className="btn" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </header>
      {status && <p className={status.ok ? 'ok' : 'error'}>{status.text}</p>}
      {SETTINGS.map((group) => (
        <div className="panel" key={group.title}>
          <h2>{group.title}</h2>
          <div className="fields">
            {group.fields.map((f) => (
              <FieldInput
                key={f.path}
                field={{ key: f.path, label: f.label, type: f.type, help: f.help }}
                value={get(row, f.path)}
                onChange={(v) =>
                  setRow((r) => {
                    // Localized values replace only en/id so sibling flags (e.g. availability.isPlaceholder) survive.
                    const prev = get(r ?? {}, f.path);
                    const merged =
                      f.type.startsWith('localized') && prev && typeof prev === 'object' && v && typeof v === 'object'
                        ? { ...(prev as Row), ...(v as Row) }
                        : v;
                    return setPath(r ?? {}, f.path, merged);
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}
      <div className="panel">
        <h2>Social links</h2>
        {socials.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: order is the identity of these rows
          <div className="grid2" key={i}>
            <select
              value={s.kind}
              onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
              aria-label="Network"
            >
              {['linkedin', 'github', 'instagram', 'email', 'other'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input
              placeholder="Label"
              value={s.label}
              onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <input
              placeholder="https://… or mailto:…"
              value={s.url}
              onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            />
            <input
              placeholder="@handle (optional)"
              value={s.handle ?? ''}
              onChange={(e) =>
                setSocials(socials.map((x, j) => (j === i ? { ...x, handle: e.target.value || undefined } : x)))
              }
            />
            <button type="button" className="link danger" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => setSocials([...socials, { kind: 'other', label: '', url: '' }])}
        >
          + Add link
        </button>
      </div>
      <div className="panel">
        <h2>CV (PDF)</h2>
        {row.cv_path ? (
          <p>
            <a className="link" href={publicUrl('docs', String(row.cv_path))} target="_blank" rel="noreferrer">
              Current CV ↗
            </a>{' '}
            <button
              type="button"
              className="link danger"
              onClick={() => setRow((r) => ({ ...(r ?? {}), cv_path: null }))}
            >
              Remove
            </button>
          </p>
        ) : (
          <p className="muted">No PDF uploaded. The site still offers the generated CV page.</p>
        )}
        <input type="file" accept="application/pdf" onChange={(e) => uploadCv(e.target.files?.[0])} />
      </div>
    </section>
  );
}
