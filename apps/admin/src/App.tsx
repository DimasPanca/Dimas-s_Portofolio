import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { collectionOrder, collections } from './collections.ts';
import { configured, supabase } from './lib/supabase.ts';
import { CollectionForm, CollectionList } from './views/Collection.tsx';
import { Dashboard, Inbox, Publish, Settings } from './views/Pages.tsx';

type Gate = 'loading' | 'setup' | 'signin' | 'mfa' | 'forbidden' | 'ready';

/** Sign-in: one-time code by email (no passwords). Sign-ups are disabled, so only the owner gets a code. */
function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    // The same message is shown either way, so the form does not reveal which address is the owner.
    if (err && !/signups? not allowed|not found/i.test(err.message)) setError(err.message);
    setSent(true);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError('That code did not work. Check it or request a new one.');
  };
  return (
    <main className="auth">
      <h1>Portfolio admin</h1>
      {!sent ? (
        <form onSubmit={send}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send sign-in code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="muted">If that address belongs to the owner, a 6-digit code is on its way.</p>
          <label htmlFor="code">Code from the email</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="link" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

/** Second step (TOTP). First visit enrols an authenticator app; afterwards it only asks for the code. */
function Mfa({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) return setError(err.message);
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) return setFactorId(verified.id);
      // Remove half-finished enrolments so a new QR code can be issued.
      for (const f of data.all.filter((x) => x.status !== 'verified'))
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      const enrol = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrol.error) return setError(enrol.error.message);
      setFactorId(enrol.data.id);
      setQr(enrol.data.totp.qr_code);
      setSecret(enrol.data.totp.secret);
    })();
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (err) return setError('That code did not work. Codes change every 30 seconds.');
    onDone();
  };

  return (
    <main className="auth">
      <h1>Two-step verification</h1>
      {qr && (
        <>
          <p className="muted">
            Scan this with an authenticator app (Google Authenticator, Authy, 1Password…). You only do this once.
          </p>
          <img className="qr" src={qr} alt="QR code for the authenticator app" />
          <p className="muted">
            Or type this key: <code>{secret}</code>
          </p>
        </>
      )}
      <form onSubmit={verify}>
        <label htmlFor="totp">6-digit code from the app</label>
        <input
          id="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !factorId}>
          {busy ? 'Checking…' : 'Verify'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  );
}

function Setup() {
  return (
    <main className="auth">
      <h1>Portfolio admin</h1>
      <p>This admin is not connected to a database yet.</p>
      <ol className="steps">
        <li>
          Create a Supabase project and run the migration in <code>supabase/migrations</code>.
        </li>
        <li>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> for this app.
        </li>
        <li>
          Create the owner user, add its id to the <code>owner</code> table, then sign in here.
        </li>
      </ol>
      <p className="muted">Full steps are in docs/RUNBOOK.md.</p>
    </main>
  );
}

const useHash = () => {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export function App() {
  const [gate, setGate] = useState<Gate>(configured ? 'loading' : 'setup');
  const [email, setEmail] = useState('');
  const hash = useHash();
  const go = useCallback((h: string) => {
    window.location.hash = h;
  }, []);

  const check = useCallback(async (session: Session | null) => {
    if (!session) return setGate('signin');
    setEmail(session.user.email ?? '');
    const { data: owner } = await supabase.from('owner').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!owner) return setGate('forbidden');
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setGate(aal?.currentLevel === 'aal2' ? 'ready' : 'mfa');
  }, []);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer: Supabase recommends not awaiting other auth calls inside this callback.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED')
        setTimeout(() => check(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  if (gate === 'setup') return <Setup />;
  if (gate === 'loading') return <main className="auth muted">Loading…</main>;
  if (gate === 'signin') return <SignIn />;
  if (gate === 'mfa') return <Mfa onDone={() => supabase.auth.getSession().then(({ data }) => check(data.session))} />;
  if (gate === 'forbidden')
    return (
      <main className="auth">
        <h1>No access</h1>
        <p>This account is not the owner of this site.</p>
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </main>
    );

  const [, section = '', id] = hash.replace(/^#/, '').split('/');
  const collection = collections[section];
  let view: React.ReactNode;
  if (collection && id) view = <CollectionForm key={`${section}/${id}`} collection={collection} id={id} go={go} />;
  else if (collection) view = <CollectionList key={section} collection={collection} go={go} />;
  else if (section === 'settings') view = <Settings />;
  else if (section === 'inbox') view = <Inbox />;
  else if (section === 'publish') view = <Publish />;
  else view = <Dashboard />;

  const link = (target: string, label: string) => (
    <a href={`#/${target}`} aria-current={section === target ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <div className="shell">
      <nav className="nav" aria-label="Admin">
        <a className="nav__brand" href="#/">
          DP<span>admin</span>
        </a>
        {link('', 'Dashboard')}
        {collectionOrder.map((key) => (
          <span key={key}>{link(key, collections[key]?.title ?? key)}</span>
        ))}
        {link('settings', 'Settings')}
        {link('inbox', 'Inbox')}
        <a className="btn nav__publish" href="#/publish">
          Publish
        </a>
        <button type="button" className="link nav__out" onClick={() => supabase.auth.signOut()} title={email}>
          Sign out
        </button>
      </nav>
      <main className="content">{view}</main>
    </div>
  );
}
