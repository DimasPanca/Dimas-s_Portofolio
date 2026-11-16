/**
 * L4 — audio engine (PRD §7.6). Loaded only after the visitor chose sound.
 * UI cues come from one CC0 sprite (Howler); tonal cues and the ambient bed are synthesised with
 * Web Audio in the key of D, so they cost no download and always sit together (PRD §7.4 fallback rule).
 */
import { Howl, Howler } from 'howler';
import data from '../../data/sfx-sprite.json';
import type { CueId } from '../bus.ts';

const D = {
  D2: 73.42,
  A2: 110,
  D3: 146.83,
  F3: 174.61,
  A3: 220,
  D5: 587.33,
  Fs5: 739.99,
  A5: 880,
  D6: 1174.66,
  Fs6: 1479.98,
};
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
    volume: 0.6,
    preload: true,
  });
  const ctx = Howler.ctx as AudioContext;
  const master = Howler.masterGain as GainNode;

  // Everything synthesised goes through one bus so the mute switch and the analyser see it.
  const synth = ctx.createGain();
  synth.gain.value = 0.5;
  synth.connect(master);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  master.connect(analyser);
  const bins = new Uint8Array(analyser.frequencyBinCount);

  /* ---------------------------------------------------------- ambient bed */
  const bed = ctx.createGain();
  bed.gain.value = 0;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 520;
  lowpass.Q.value = 0.6;
  lowpass.connect(bed).connect(synth);
  let bedStarted = false;
  function startBed() {
    if (bedStarted) return;
    bedStarted = true;
    const voices: [number, OscillatorType, number, number][] = [
      [D.D2, 'sawtooth', 0.22, -4],
      [D.A2, 'sawtooth', 0.14, 5],
      [D.D3, 'triangle', 0.2, 3],
      [D.F3, 'sine', 0.12, -6],
      [D.A3, 'sine', 0.07, 7],
    ];
    for (const [freq, type, gain, detune] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      // A slow, per-voice tremolo keeps the pad alive without any rhythm.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + Math.random() * 0.07;
      const depth = ctx.createGain();
      depth.gain.value = gain * 0.45;
      lfo.connect(depth).connect(g.gain);
      osc.connect(g).connect(lowpass);
      osc.start();
      lfo.start();
    }
  }
  const BED_LEVEL = 0.2;
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
    bed.gain.linearRampToValueAtTime(BED_LEVEL * 0.6, t + 0.08);
    bed.gain.linearRampToValueAtTime(BED_LEVEL, t + 0.9);
  };

  // The bed "breathes" with scrolling: faster scroll opens the filter (PRD §7.2).
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
      energy = Math.min(1, energy * 0.8 + v * 0.25);
      lowpass.frequency.setTargetAtTime(520 + energy * 2600, ctx.currentTime, 0.25);
    },
    { passive: true },
  );
  setInterval(() => {
    if (energy < 0.01) return;
    energy *= 0.7;
    lowpass.frequency.setTargetAtTime(520 + energy * 2600, ctx.currentTime, 0.6);
  }, 400);

  /* ------------------------------------------------------- synthesised cues */
  function note(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(synth);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function noiseSwell(dur: number, gain: number, from: number, to: number) {
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band).connect(g).connect(synth);
    src.start(t);
  }
  const synthCues: Partial<Record<CueId, () => void>> = {
    boot_stinger() {
      duck();
      noiseSwell(1.1, 0.16, 180, 4200);
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(D.D2, t);
      osc.frequency.exponentialRampToValueAtTime(D.D3, t + 0.9);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(200, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      osc.connect(f).connect(g).connect(synth);
      osc.start(t);
      osc.stop(t + 1.6);
      note(D.D5, 0.92, 1.3, 0.2);
      note(D.A5, 0.98, 1.2, 0.12, 'sine');
      note(D.D6, 1.04, 1.1, 0.08, 'sine');
    },
    unlock() {
      duck();
      note(D.D5, 0, 0.5, 0.2);
      note(D.Fs5, 0.09, 0.5, 0.18);
      note(D.A5, 0.18, 0.75, 0.2);
    },
    unlock_gold() {
      duck();
      note(D.D5, 0, 0.5, 0.2);
      note(D.Fs5, 0.08, 0.5, 0.18);
      note(D.A5, 0.16, 0.6, 0.2);
      note(D.D6, 0.26, 1.1, 0.2);
      note(D.Fs6, 0.36, 1.0, 0.07, 'sine');
      noiseSwell(0.7, 0.05, 5000, 9000);
    },
    section_enter() {
      noiseSwell(0.55, 0.035, 500, 1600);
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
      if (now - lastHover < 70) return;
      lastHover = now;
      return sprite(pick('hover_tick', 3), 0.96 + Math.random() * 0.08);
    }
    if (id === 'click_soft') return sprite(pick('click_soft', 2));
    if (id === 'rail_tick') return sprite('hover_tick_2', 0.8);
    if (id in data.sprite) sprite(id);
  }

  function setEnabled(on: boolean) {
    enabled = on;
    Howler.mute(!on);
    if (on) {
      if (ctx.state === 'suspended') void ctx.resume();
      startBed();
      fadeBed(BED_LEVEL, 2.5);
    } else fadeBed(0, 0.6);
  }

  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;
    if (document.hidden) fadeBed(0, 0.3);
    else fadeBed(BED_LEVEL, 1.2);
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
