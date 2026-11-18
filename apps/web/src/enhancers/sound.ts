/**
 * Sound (PRD §7.2, HR-6). Nothing plays before a gesture: entering from the loading screen (or
 * tapping during it) is that gesture and turns sound on, unless the visitor muted it before.
 * The AudioContext is created inside the gesture (required by iOS/Safari); the synth engine is a
 * lazy chunk and needs no audio files.
 *
 * State: `dp:audio` (localStorage) only records an explicit nav toggle; `dp:sound` (sessionStorage)
 * carries the current on/off across pages of the same visit.
 */

import type { Engine } from '../lib/audio/engine.ts';
import { type CueId, cue, local, root, session, setPlayer, toast, track } from '../lib/bus.ts';
import type { GateChoice } from './gate.ts';

type Pref = { v: 2; enabled: boolean };

function readPref(): Pref | null {
  try {
    const p = JSON.parse(local.get('dp:audio') ?? 'null') as Pref | null;
    return p && p.v === 2 && typeof p.enabled === 'boolean' ? p : null;
  } catch {
    return null;
  }
}

export function initSound(): void {
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')];
  let ctx: AudioContext | null = null;
  let engine: Engine | null = null;
  let loading: Promise<Engine | null> | null = null;
  let meter = 0;
  let on = false;

  const paint = (value: boolean) => {
    on = value;
    root.dataset.sound = value ? 'on' : 'off';
    for (const t of toggles) t.setAttribute('aria-pressed', String(value));
    window.clearInterval(meter);
    if (value && engine) {
      const e = engine;
      meter = window.setInterval(() => {
        if (document.hidden) return;
        const lvl = e.level().toFixed(2);
        for (const t of toggles) t.style.setProperty('--lvl', lvl);
      }, 110);
    }
  };

  /** Must run synchronously inside a click/tap/key handler. */
  const unlock = (): AudioContext | null => {
    if (ctx) {
      if (ctx.state !== 'running') void ctx.resume();
      return ctx;
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
      void ctx.resume();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const load = (context: AudioContext) => {
    loading ??= import('../lib/audio/engine.ts')
      .then((m) => {
        engine = m.createEngine(context);
        setPlayer((id: CueId) => engine?.play(id));
        return engine;
      })
      .catch(() => null);
    return loading;
  };

  async function setSound(value: boolean, opts: { explicit?: boolean; first?: CueId } = {}) {
    if (opts.explicit) local.set('dp:audio', JSON.stringify({ v: 2, enabled: value }));
    session.set('dp:sound', value ? '1' : '0');
    if (!value) {
      engine?.setEnabled(false);
      return paint(false);
    }
    const context = unlock();
    const e = context ? await load(context) : null;
    if (!e) return paint(false);
    e.setEnabled(true);
    paint(true);
    if (opts.first) cue(opts.first);
    track('sound_on');
  }

  paint(false);
  for (const t of toggles) {
    t.addEventListener('click', () => {
      const next = !on;
      if (!next) {
        engine?.play('toggle_off');
        track('sound_off');
      }
      void setSound(next, { explicit: true, first: 'toggle_on' });
    });
  }

  const mutedByChoice = () => readPref()?.enabled === false;

  // Loading screen: a tap while it loads starts the sound early; entering starts it otherwise.
  window.addEventListener('dp:gate-unlock', () => {
    if (!mutedByChoice()) void setSound(true, { first: 'load_start' });
  });
  window.addEventListener('dp:gate-done', (e) => {
    const choice = (e as CustomEvent<GateChoice | null>).detail;
    if (!choice?.sound || mutedByChoice()) return;
    if (on) cue('boot_stinger');
    else void setSound(true, { first: 'boot_stinger' });
  });

  // Mobile browsers suspend (iOS: "interrupted") the context on lock, calls or tab switches.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && on && ctx && ctx.state !== 'running') void ctx.resume();
  });

  // Other pages of the same visit (and later visits with sound left on): pick the sound back up.
  // Most browsers allow it right away after an earlier gesture on this site; otherwise the first
  // tap or key press resumes it.
  if (root.dataset.gate === 'open') return;
  const sessionSound = session.get('dp:sound');
  const want = sessionSound ? sessionSound === '1' : readPref()?.enabled === true;
  if (!want) return;
  const resume = () => {
    window.removeEventListener('click', resume, true);
    window.removeEventListener('keydown', resume, true);
    if (!on) void setSound(true);
  };
  window.addEventListener('click', resume, true);
  window.addEventListener('keydown', resume, true);
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    // Kept either way: if the browser blocks it now, the first gesture resumes this same context.
    const probe = new Ctor({ latencyHint: 'interactive' });
    ctx = probe;
    const allowed = new Promise<boolean>((r) => {
      probe.resume().then(
        () => r(probe.state === 'running'),
        () => r(false),
      );
      window.setTimeout(() => r(probe.state === 'running'), 400);
    });
    void allowed.then((ok) => {
      if (ok) resume();
      else if (session.get('dp:sound-hint') !== '1') {
        session.set('dp:sound-hint', '1');
        const hint = root.dataset.msgTapSound;
        if (hint) toast(hint, 3600);
      }
    });
  } catch {
    /* no audio */
  }
}
