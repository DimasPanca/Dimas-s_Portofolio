/**
 * Sound consent + toggle (PRD §7.2, HR-6). Nothing is fetched or played before an explicit choice:
 * the engine chunk (Howler + sprite) loads only after "Enter with sound" or a click on the toggle.
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

  const load = () => {
    loading ??= import('../lib/audio/engine.ts')
      .then((m) => {
        engine = m.createEngine();
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
    if (!on && !engine) return paint(false);
    const e = await load();
    if (!e) return paint(false);
    e.setEnabled(on);
    paint(on);
    if (on && opts.first) cue(opts.first);
    track(on ? 'sound_on' : 'sound_off');
  }

  paint(false);
  for (const t of toggles) {
    t.addEventListener('click', () => {
      const on = root.dataset.sound !== 'on';
      void setSound(on, { first: 'toggle_on' });
      if (!on) engine?.play('toggle_off');
    });
  }

  // Gate: "Enter with sound" is the consent gesture; the stinger plays once the engine is ready.
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
    const resume = () => void setSound(true, { persist: false });
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
}
