/**
 * L4 — audio engine (PRD §7). Pure Web Audio, no files: everything is synthesised, so it costs no
 * download and every sound shares one key (D major pentatonic) and one room.
 *
 * Voice: calm and tactile.
 *  - Music: sparse, soft "felt" notes that wander slowly through the pentatonic scale with long
 *    silences and a warm reverb (generative, never loops, no drones or tremolo).
 *  - UI: rounded pops and small glass notes with slight random variation, so nothing sounds mechanical.
 *  - Air: gentle filtered-noise whooshes for section changes, menus and page moves.
 * A soft limiter and conservative levels keep it comfortable; frequent sounds are the quietest.
 */
import type { CueId } from '../bus.ts';

export type Engine = {
  play: (id: CueId) => void;
  setEnabled: (on: boolean) => void;
  level: () => number;
};

/** D major pentatonic, A3–F#5: no semitones, so any two notes sound good together. */
const SCALE = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99];
const ROOT = 146.83; // D3
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

export function createEngine(ctx: AudioContext): Engine {
  /* ------------------------------------------------------------------ routing */
  // Phone speakers: almost nothing below ~150 Hz and a dip in the presence range, so on touch
  // devices the lows are trimmed (no wasted headroom, no rattle) and the 2-3 kHz body is lifted.
  const phone = matchMedia('(pointer: coarse)').matches;
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 12;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;
  if (phone) {
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 140;
    low.Q.value = 0.6;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2600;
    presence.Q.value = 0.8;
    presence.gain.value = 3.5;
    master.connect(low).connect(presence).connect(limiter);
  } else master.connect(limiter);
  limiter.connect(ctx.destination);
  const LEVEL = phone ? 1.05 : 0.9;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  master.connect(analyser);
  const bins = new Uint8Array(analyser.frequencyBinCount);

  // One shared room. The impulse is generated: decaying noise, darkened so the tail is warm, not hissy.
  const room = ctx.createConvolver();
  {
    const seconds = phone ? 2.4 : 3.2; // a shorter room is lighter on phone CPUs
    const length = Math.ceil(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const white = Math.random() * 2 - 1;
        lp += (white - lp) * (0.5 - 0.42 * t); // the filter closes as the tail decays
        ch[i] = lp * (1 - t) ** 2.6;
      }
    }
    room.buffer = impulse;
  }
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  room.connect(wet).connect(master);

  const bus = (dry: number, send: number) => {
    const input = ctx.createGain();
    const d = ctx.createGain();
    d.gain.value = dry;
    const s = ctx.createGain();
    s.gain.value = send;
    input.connect(d).connect(master);
    input.connect(s).connect(room);
    return input;
  };
  const ui = bus(0.9, 0.12);
  const air = bus(2.4, 0.5);
  const music = bus(0.95, 0.75);

  // Pink-ish noise (soft, like wind) for the whooshes.
  const noise = (() => {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const ch = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      ch[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
    return buffer;
  })();

  /* ---------------------------------------------------------------- voices */
  /** Soft tone: sine + quiet overtones, gentle attack, smooth exponential tail. */
  function tone(
    out: AudioNode,
    freq: number,
    at: number,
    opts: { gain: number; ring: number; attack?: number; pan?: number; bright?: number },
  ) {
    const t = ctx.currentTime + at;
    const { gain, ring, attack = 0.012, pan = 0, bright = 0.2 } = opts;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    const partials: [number, number, number][] = [
      [1, 1, 1],
      [2, bright, 0.5],
      [3, bright * 0.3, 0.28],
    ];
    for (const [mult, amp, len] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      osc.detune.value = rnd(-4, 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * amp), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + ring * len);
      osc.connect(g).connect(panner);
      osc.start(t);
      osc.stop(t + attack + ring * len + 0.05);
    }
  }

  /** Rounded "pop": a sine that drops in pitch — the tactile part of a click. */
  function pop(from: number, to: number, dur: number, gain: number, at = 0) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from * rnd(0.97, 1.03), t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.004); // pops sit below the music
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ui);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  /** Wind: band-passed noise that swells and glides, drifting across the stereo field. */
  function whoosh(opts: {
    dur: number;
    gain: number;
    from: number;
    to: number;
    q?: number;
    at?: number;
    pan?: [number, number];
  }) {
    const { dur, gain, from, to, q = 0.9, at = 0, pan = [rnd(-0.5, -0.2), rnd(0.2, 0.5)] } = opts;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = q;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const panner = ctx.createStereoPanner();
    const flip = Math.random() < 0.5 ? 1 : -1;
    panner.pan.setValueAtTime(pan[0] * flip, t);
    panner.pan.linearRampToValueAtTime(pan[1] * flip, t + dur);
    src.connect(band).connect(g).connect(panner).connect(air);
    src.start(t, rnd(0, 1.5));
    src.stop(t + dur + 0.05);
  }

  /* ----------------------------------------------------------------- music */
  let enabled = false;
  let musicTimer = 0;
  let step = 4;
  let count = 0;
  function playMusicNote() {
    // A slow random walk through the scale: mostly steps, sometimes a small leap, never a jump.
    const moves = [-2, -1, -1, 1, 1, 2, 3, -3];
    step = Math.max(0, Math.min(SCALE.length - 1, step + (moves[Math.floor(Math.random() * moves.length)] ?? 1)));
    const freq = SCALE[step] ?? 440;
    const pan = rnd(-0.35, 0.35);
    tone(music, freq, 0, { gain: rnd(0.05, 0.075), ring: rnd(3.6, 5.2), attack: 0.03, pan, bright: 0.14 });
    // Sometimes a second voice a third or fifth above, softer and a little late (a "broken" interval).
    if (Math.random() < 0.3) {
      const upper = SCALE[Math.min(SCALE.length - 1, step + (Math.random() < 0.5 ? 2 : 3))] ?? freq;
      tone(music, upper, rnd(0.12, 0.3), { gain: 0.035, ring: 4, attack: 0.04, pan: -pan, bright: 0.1 });
    }
    // Every few notes, a very soft root underneath for warmth.
    if (++count % 5 === 0) tone(music, ROOT, rnd(0, 0.2), { gain: 0.04, ring: 6.5, attack: 0.08, bright: 0.05 });
  }
  function scheduleMusic(first = false) {
    window.clearTimeout(musicTimer);
    if (!enabled) return;
    musicTimer = window.setTimeout(
      () => {
        if (enabled && !document.hidden) playMusicNote();
        scheduleMusic();
      },
      first ? 1400 : rnd(2600, 5200),
    );
  }

  /* ------------------------------------------------------------------ cues */
  let loadStep = 0;
  /** Loading ticks climb D4 → D5, one note per letter of the wordmark. */
  const LOAD_NOTES = [293.66, 329.63, 369.99, 440, 493.88, 587.33];
  let hoverStep = 5;
  let lastHover = 0;
  let lastAir = 0;
  const cues: Record<CueId, () => void> = {
    // Hovers walk up the scale while you sweep across items, then settle back: small glass notes.
    hover_tick() {
      const now = performance.now();
      if (now - lastHover < 60) return;
      hoverStep = now - lastHover < 900 ? (hoverStep + 1) % SCALE.length : Math.floor(rnd(4, 8));
      lastHover = now;
      tone(ui, (SCALE[hoverStep] ?? 440) * 2, 0, {
        gain: 0.036,
        ring: 0.22,
        attack: 0.005,
        pan: rnd(-0.2, 0.2),
        bright: 0.08,
      });
    },
    click_soft() {
      pop(420, 150, 0.1, 0.16);
    },
    nav_link() {
      pop(480, 170, 0.1, 0.14);
      tone(ui, 880, 0.02, { gain: 0.035, ring: 0.5, bright: 0.1 });
    },
    toggle_on() {
      pop(360, 200, 0.07, 0.1);
      tone(ui, 880, 0.01, { gain: 0.045, ring: 0.45 });
      tone(ui, 1174.66, 0.09, { gain: 0.045, ring: 0.7 });
    },
    toggle_off() {
      pop(300, 140, 0.08, 0.1);
      tone(ui, 1174.66, 0.01, { gain: 0.04, ring: 0.4 });
      tone(ui, 880, 0.09, { gain: 0.04, ring: 0.6 });
    },
    menu_open() {
      whoosh({ dur: 0.45, gain: 0.07, from: 420, to: 2200 });
      pop(300, 180, 0.08, 0.08);
    },
    menu_close() {
      whoosh({ dur: 0.4, gain: 0.06, from: 2000, to: 380 });
    },
    // A soft breath of wind when a new section arrives (rate-limited so fast scrolling stays quiet).
    section_enter() {
      const now = performance.now();
      if (now - lastAir < 1400) return;
      lastAir = now;
      whoosh({ dur: 1.15, gain: 0.05, from: rnd(320, 420), to: rnd(900, 1300), q: 0.7 });
    },
    rail_tick() {
      pop(980, 620, 0.045, 0.06);
    },
    card_open() {
      whoosh({ dur: 0.55, gain: 0.075, from: 380, to: 1900 });
      pop(360, 160, 0.1, 0.1, 0.05);
    },
    unlock() {
      tone(ui, 880, 0, { gain: 0.07, ring: 1.0, pan: -0.15 });
      tone(ui, 1174.66, rnd(0.08, 0.11), { gain: 0.065, ring: 1.6, pan: 0.15 });
    },
    unlock_gold() {
      whoosh({ dur: 0.7, gain: 0.035, from: 900, to: 3200, q: 1.2 });
      const notes = [587.33, 739.99, 880, 1174.66];
      notes.forEach((f, i) => {
        tone(ui, f, i * rnd(0.07, 0.09), { gain: 0.06, ring: i === 3 ? 2.2 : 1.1, pan: -0.3 + i * 0.2 });
      });
    },
    copy_ok() {
      pop(420, 190, 0.08, 0.12);
      tone(ui, 1174.66, 0.05, { gain: 0.05, ring: 0.9 });
    },
    send_ok() {
      whoosh({ dur: 0.6, gain: 0.05, from: 500, to: 2600 });
      [880, 1174.66, 1479.98].forEach((f, i) => {
        tone(ui, f, 0.1 + i * 0.09, { gain: 0.055, ring: 1.3, pan: -0.2 + i * 0.2 });
      });
    },
    // Errors stay gentle: two soft low taps, no buzz.
    error() {
      pop(230, 170, 0.1, 0.14);
      pop(210, 150, 0.12, 0.12, 0.13);
    },
    // Loading begins (only heard when the visitor tapped during it): a slow breath and a warm fifth.
    load_start() {
      loadStep = 0;
      whoosh({ dur: 2.4, gain: 0.04, from: 220, to: 900, q: 0.6, pan: [-0.4, 0.4] });
      tone(music, 146.83 * 2, 0, { gain: 0.035, ring: 3.2, attack: 0.5, bright: 0.06, pan: -0.15 });
      tone(music, 220, 0.25, { gain: 0.03, ring: 3.2, attack: 0.5, bright: 0.06, pan: 0.15 });
    },
    // Each letter that fills: a small glass note, one step higher every time.
    load_tick() {
      const f = LOAD_NOTES[Math.min(loadStep, LOAD_NOTES.length - 1)] ?? 440;
      loadStep++;
      tone(ui, f * 2, 0, { gain: 0.05, ring: 0.9, attack: 0.006, pan: -0.3 + loadStep * 0.1, bright: 0.16 });
      pop(1100, 700, 0.04, 0.05);
    },
    // 100%: a soft two-note bell says "ready" without demanding attention.
    load_ready() {
      whoosh({ dur: 0.9, gain: 0.025, from: 1400, to: 4200, q: 1.4 });
      tone(ui, 880, 0, { gain: 0.05, ring: 1.6, pan: -0.15, bright: 0.12 });
      tone(ui, 1174.66, 0.12, { gain: 0.045, ring: 2.2, pan: 0.15, bright: 0.12 });
    },
    // Enter: timed with the curtain. A felt "press" on the click, the wind of the curtain lifting
    // (starts at 0.26 s, lasts 1 s), then a rising chord that hands over to the music.
    boot_stinger() {
      loadStep = 0;
      pop(150, 52, 0.4, 0.22);
      pop(1300, 800, 0.03, 0.06);
      whoosh({ dur: 1.35, gain: 0.1, from: 200, to: 2600, q: 0.55, at: 0.12, pan: [-0.7, 0.7] });
      whoosh({ dur: 1.1, gain: 0.035, from: 900, to: 5200, q: 1.1, at: 0.4, pan: [0.5, -0.5] });
      [146.83, 293.66, 440, 587.33, 739.99, 880].forEach((f, i) => {
        tone(music, f, 0.78 + i * 0.13, {
          gain: i === 0 ? 0.05 : 0.065,
          ring: i === 0 ? 5 : 3.4,
          attack: 0.03,
          pan: -0.35 + i * 0.14,
          bright: 0.14,
        });
      });
    },
  };

  function play(id: CueId) {
    if (!enabled || document.hidden) return;
    cues[id]?.();
  }

  function setEnabled(on: boolean) {
    enabled = on;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(on ? LEVEL : 0, t + (on ? 0.25 : 0.4));
    if (on) {
      if (ctx.state === 'suspended') void ctx.resume();
      scheduleMusic(true);
    } else window.clearTimeout(musicTimer);
  }

  return {
    play,
    setEnabled,
    level() {
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      for (const b of bins) sum += b;
      return Math.min(1, sum / bins.length / 90);
    },
  };
}
