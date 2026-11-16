/**
 * L4 — audio engine (PRD §7.6). Loaded only after the visitor chose sound.
 * Voice: simple, warm and professional — soft glass-bell tones in D major with a touch of room reverb,
 * short UI cues from a CC0 sprite, and an optional, very quiet high pad. Nothing dark, nothing noisy.
 * Tonal cues are synthesised with Web Audio, so they cost no download (PRD §7.4 fallback rule).
 */
import { Howl, Howler } from 'howler';
import data from '../../data/sfx-sprite.json';
import type { CueId } from '../bus.ts';

/** D major, mid-high register only (bright and friendly; no low rumble). */
const N = { D4: 293.66, Fs4: 369.99, A4: 440, E5: 659.25, D5: 587.33, Fs5: 739.99, A5: 880, D6: 1174.66 };
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export type Engine = {
  play: (id: CueId) => void;
  setEnabled: (on: boolean) => void;
  level: () => number;
};

export function createEngine(): Engine {
  const files = [`/audio/sfx.sprite.webm?v=${data.version}`, `/audio/sfx.sprite.m4a?v=${data.version}`];
  const sfx = new Howl({
    src: isSafari ? files.reverse() : files,
    sprite: data.sprite as unknown as Record<string, [number, number]>,
    volume: 0.5,
    preload: true,
  });
  const ctx = Howler.ctx as AudioContext;
  const master = Howler.masterGain as GainNode;

  /* One synth bus: dry + a short, soft room (generated impulse, no file). */
  const synth = ctx.createGain();
  synth.gain.value = 0.55;
  synth.connect(master);
  const room = ctx.createConvolver();
  {
    const seconds = 1.5;
    const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 3.2;
    }
    room.buffer = impulse;
  }
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  room.connect(wet).connect(master);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  master.connect(analyser);
  const bins = new Uint8Array(analyser.frequencyBinCount);

  /* ------------------------------------------------------------ soft pad */
  const bed = ctx.createGain();
  bed.gain.value = 0;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1500;
  lowpass.Q.value = 0.3;
  lowpass.connect(bed);
  bed.connect(synth);
  bed.connect(room);
  let bedStarted = false;
  function startBed() {
    if (bedStarted) return;
    bedStarted = true;
    // A D-major add9 chord of pure sines, each swelling slowly at its own pace.
    const voices: [number, number][] = [
      [N.D4, 0.5],
      [N.A4, 0.34],
      [N.Fs5, 0.2],
      [N.E5, 0.14],
    ];
    for (const [freq, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = gain * 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03 + Math.random() * 0.04;
      const depth = ctx.createGain();
      depth.gain.value = gain * 0.4;
      lfo.connect(depth).connect(g.gain);
      osc.connect(g).connect(lowpass);
      osc.start();
      lfo.start();
    }
  }
  const BED_LEVEL = 0.1;
  const fadeBed = (to: number, seconds: number) => {
    const t = ctx.currentTime;
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(to, t + seconds);
  };
  const duck = () => {
    const t = ctx.currentTime;
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(BED_LEVEL * 0.5, t + 0.1);
    bed.gain.linearRampToValueAtTime(BED_LEVEL, t + 1.2);
  };

  // The pad brightens very slightly with scrolling (kept narrow so it never gets harsh).
  let lastY = scrollY;
  let lastT = performance.now();
  let energy = 0;
  addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const v = Math.abs(scrollY - lastY) / Math.max(16, now - lastT);
      lastY = scrollY;
      lastT = now;
      energy = Math.min(1, energy * 0.8 + v * 0.2);
      lowpass.frequency.setTargetAtTime(1500 + energy * 900, ctx.currentTime, 0.3);
    },
    { passive: true },
  );
  setInterval(() => {
    if (energy < 0.01) return;
    energy *= 0.7;
    lowpass.frequency.setTargetAtTime(1500 + energy * 900, ctx.currentTime, 0.6);
  }, 400);

  /* ------------------------------------------------------ synthesised cues */
  /** A soft bell: sine fundamental + quiet octave and twelfth, quick attack, long smooth decay. */
  function bell(freq: number, at: number, ring: number, gain: number) {
    const t = ctx.currentTime + at;
    const partials: [number, number, number][] = [
      [1, 1, 1],
      [2, 0.26, 0.55],
      [3, 0.08, 0.32],
    ];
    for (const [mult, amp, len] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring * len);
      osc.connect(g);
      g.connect(synth);
      g.connect(room);
      osc.start(t);
      osc.stop(t + ring * len + 0.05);
    }
  }
  const synthCues: Partial<Record<CueId, () => void>> = {
    // A gentle rising D-major arpeggio: "ready".
    boot_stinger() {
      duck();
      bell(N.D5, 0, 1.2, 0.16);
      bell(N.A5, 0.13, 1.3, 0.14);
      bell(N.D6, 0.27, 2.0, 0.14);
    },
    // A tidy two-note "ding".
    unlock() {
      duck();
      bell(N.A5, 0, 0.9, 0.15);
      bell(N.D6, 0.1, 1.5, 0.14);
    },
    // First places: a slightly fuller arpeggio, still understated.
    unlock_gold() {
      duck();
      bell(N.D5, 0, 0.9, 0.14);
      bell(N.Fs5, 0.08, 0.9, 0.13);
      bell(N.A5, 0.16, 1.0, 0.14);
      bell(N.D6, 0.26, 2.0, 0.15);
    },
  };

  /* --------------------------------------------------------------- playback */
  let enabled = false;
  let lastHover = 0;
  const pick = (base: string, n: number) => `${base}_${1 + Math.floor(Math.random() * n)}`;
  function sprite(id: string, rate = 1) {
    const h = sfx.play(id);
    if (rate !== 1) sfx.rate(rate, h);
  }
  function play(id: CueId) {
    if (!enabled || document.hidden) return;
    const s = synthCues[id];
    if (s) return s();
    if (id === 'hover_tick') {
      const now = performance.now();
      if (now - lastHover < 90) return;
      lastHover = now;
      return sprite(pick('hover_tick', 3), 0.98 + Math.random() * 0.06);
    }
    if (id === 'click_soft') return sprite(pick('click_soft', 2));
    if (id === 'rail_tick') return sprite('hover_tick_2');
    // section_enter has no sound on purpose: silence between interactions feels calmer.
    if (id in data.sprite) sprite(id);
  }

  function setEnabled(on: boolean) {
    enabled = on;
    Howler.mute(!on);
    if (on) {
      if (ctx.state === 'suspended') void ctx.resume();
      startBed();
      fadeBed(BED_LEVEL, 3);
    } else fadeBed(0, 0.6);
  }

  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;
    if (document.hidden) fadeBed(0, 0.3);
    else fadeBed(BED_LEVEL, 1.5);
  });

  return {
    play,
    setEnabled,
    level() {
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      for (const b of bins) sum += b;
      return Math.min(1, sum / bins.length / 110);
    },
  };
}
