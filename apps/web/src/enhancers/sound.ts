/**
 * Sound consent + toggle (PRD §7.2, HR-6). Nothing is created or played before an explicit choice.
 * The AudioContext is created inside the user's gesture (required by iOS/Safari); the synth engine
 * itself is a lazy chunk and needs no audio files.
 */

import type { Engine } from '../lib/audio/engine.ts';
import { type CueId, cue, local, root, setPlayer, toast, track } from '../lib/bus.ts';
import type { GateChoice } from './gate.ts';

type Pref = { v: 1; enabled: boolean; remember: boolean };

function readPref(): Pref | null {
  try {
    const p = JSON.parse(local.get('dp:audio') ?? 'null') as Pref | null;
    return p && typeof p.enabled === 'boolean' ? p : null;
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

  const paint = (on: boolean) => {
    root.dataset.sound = on ? 'on' : 'off';
    for (const t of toggles) t.setAttribute('aria-pressed', String(on));
    window.clearInterval(meter);
    if (on && engine) {
      const e = engine;
      meter = window.setInterval(() => {
        if (document.hidden) return;
        const lvl = e.level().toFixed(2);
        for (const t of toggles) t.style.setProperty('--lvl', lvl);
      }, 110);
    }
  };

  /** Must run synchronously inside a click/tap handler. */
  const unlock = (): AudioContext | null => {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
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

  async function setSound(on: boolean, opts: { persist?: boolean; first?: CueId } = {}) {
    const prev = readPref();
    if (opts.persist !== false)
      local.set('dp:audio', JSON.stringify({ v: 1, enabled: on, remember: prev?.remember ?? false }));
    if (!on) {
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
      const on = root.dataset.sound !== 'on';
      if (!on) {
        engine?.play('toggle_off');
        track('sound_off');
      }
      void setSound(on, { first: 'toggle_on' });
    });
  }

  // Gate: "Enter with sound" is the consent gesture (this listener runs inside that click).
  window.addEventListener('dp:gate-done', (e) => {
    const choice = (e as CustomEvent<GateChoice | null>).detail;
    if (choice?.sound) void setSound(true, { first: 'boot_stinger' });
  });

  // Returning visitor who asked to be remembered with sound on: browsers still need a gesture,
  // so sound resumes on the first tap/click and a small chip says so.
  const pref = readPref();
  if (pref?.enabled && pref.remember && !root.dataset.gate) {
    const hint = root.dataset.msgTapSound;
    if (hint) toast(hint, 4200);
    const resume = () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      void setSound(true, { persist: false });
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }
}
