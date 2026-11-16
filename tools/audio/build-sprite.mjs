/**
 * Builds the UI sound sprite + license ledger (PRD §7.5).
 * Usage: FFMPEG=/path/to/ffmpeg node tools/audio/build-sprite.mjs
 * Input : tools/audio/raw/*.wav  (git-ignored downloads; sources listed in SOURCES below)
 * Output: apps/web/public/audio/sfx.sprite.{webm,m4a}, apps/web/src/data/sfx-sprite.json,
 *         tools/audio/LEDGER.json and apps/web/src/data/audio-ledger.json (rendered on /credits)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const raw = resolve(here, 'raw');
const outDir = resolve(root, 'apps/web/public/audio');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const RATE = 48000;
const GAP_MS = 120;

const PACK = {
  title: 'Interface Sounds',
  author: 'Kenney (kenney.nl)',
  url: 'https://kenney.nl/assets/interface-sounds',
  mirror: 'https://github.com/Calinou/kenney-interface-sounds',
  license: 'CC0-1.0',
};
const ALLOWED = new Set(['CC0-1.0', 'Pixabay-Content-License', 'Mixkit-License']);

/** Sprite id → source file and gain (0–1, PRD §7.3). */
const SOURCES = [
  { id: 'hover_tick_1', file: 'tick_001.wav', gain: 0.35 },
  { id: 'hover_tick_2', file: 'tick_002.wav', gain: 0.35 },
  { id: 'hover_tick_3', file: 'tick_004.wav', gain: 0.35 },
  { id: 'click_soft_1', file: 'click_001.wav', gain: 0.55 },
  { id: 'click_soft_2', file: 'click_003.wav', gain: 0.55 },
  { id: 'nav_link', file: 'select_002.wav', gain: 0.5 },
  { id: 'toggle_on', file: 'toggle_001.wav', gain: 0.55 },
  { id: 'toggle_off', file: 'toggle_002.wav', gain: 0.55 },
  { id: 'menu_open', file: 'open_001.wav', gain: 0.5 },
  { id: 'menu_close', file: 'close_001.wav', gain: 0.5 },
  { id: 'card_open', file: 'maximize_006.wav', gain: 0.45 },
  { id: 'copy_ok', file: 'confirmation_001.wav', gain: 0.55 },
  { id: 'send_ok', file: 'confirmation_003.wav', gain: 0.6 },
  { id: 'error', file: 'error_004.wav', gain: 0.5 },
];

if (!ALLOWED.has(PACK.license)) throw new Error(`License not allowed: ${PACK.license}`);

/** Decode one cue to mono 16-bit PCM: trim silence, high-pass, peak-normalise to -3 dBTP, apply cue gain. */
function decode({ file, gain }) {
  const src = resolve(raw, file);
  if (!existsSync(src)) throw new Error(`Missing ${src} — download it first (see SOURCES).`);
  const pcm = execFileSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-i',
      src,
      '-ac',
      '1',
      '-ar',
      String(RATE),
      '-af',
      'silenceremove=start_periods=1:start_threshold=-50dB,highpass=f=40',
      '-f',
      's16le',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
  let peak = 1;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = ((32767 * 0.708) / peak) * gain; // 0.708 ≈ -3 dB
  const out = new Int16Array(samples.length);
  const fade = Math.min(samples.length, Math.round(RATE * 0.004));
  for (let i = 0; i < samples.length; i++) {
    const tail = samples.length - 1 - i;
    const env = Math.min(1, i / fade, tail / fade); // 4 ms fades prevent clicks at sprite edges
    out[i] = Math.round(samples[i] * scale * env);
  }
  return out;
}

const gap = new Int16Array(Math.round((RATE * GAP_MS) / 1000));
const chunks = [];
const sprite = {};
let cursor = 0;
for (const cue of SOURCES) {
  const data = decode(cue);
  sprite[cue.id] = [Math.round((cursor / RATE) * 1000), Math.ceil((data.length / RATE) * 1000)];
  chunks.push(data, gap);
  cursor += data.length + gap.length;
}
const pcm = new Int16Array(cursor);
let at = 0;
for (const c of chunks) {
  pcm.set(c, at);
  at += c.length;
}

mkdirSync(outDir, { recursive: true });
const tmp = resolve(here, 'raw/_sprite.s16le');
writeFileSync(tmp, Buffer.from(pcm.buffer));
const input = ['-v', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', tmp];
execFileSync(ffmpeg, [
  ...input,
  '-c:a',
  'libopus',
  '-b:a',
  '56k',
  '-application',
  'audio',
  resolve(outDir, 'sfx.sprite.webm'),
]);
execFileSync(ffmpeg, [
  ...input,
  '-c:a',
  'aac',
  '-b:a',
  '72k',
  '-movflags',
  '+faststart',
  resolve(outDir, 'sfx.sprite.m4a'),
]);
rmSync(tmp);

const version = createHash('sha1').update(Buffer.from(pcm.buffer)).digest('hex').slice(0, 8);
writeFileSync(resolve(root, 'apps/web/src/data/sfx-sprite.json'), `${JSON.stringify({ version, sprite }, null, 2)}\n`);

const retrievedAt = new Date().toISOString().slice(0, 10);
const ledger = SOURCES.map((c) => ({
  id: c.id,
  file: c.file,
  title: `${PACK.title} — ${c.file}`,
  author: PACK.author,
  url: PACK.url,
  mirror: PACK.mirror,
  license: PACK.license,
  retrievedAt,
  edits: `mono, ${RATE} Hz, trimmed, high-pass 40 Hz, normalised to -3 dB, gain ${c.gain}`,
}));
writeFileSync(resolve(here, 'LEDGER.json'), `${JSON.stringify(ledger, null, 2)}\n`);
// The credits page lists the pack once rather than every cue.
writeFileSync(
  resolve(root, 'apps/web/src/data/audio-ledger.json'),
  `${JSON.stringify([{ id: 'kenney-interface-sounds', title: PACK.title, author: PACK.author, url: PACK.url, license: 'CC0 1.0 (public domain)' }], null, 2)}\n`,
);

console.log(`sprite: ${SOURCES.length} cues, ${(cursor / RATE).toFixed(2)} s, version ${version}`);
for (const [id, [o, d]] of Object.entries(sprite))
  console.log(`  ${id.padEnd(14)} @${String(o).padStart(5)} ms  ${String(d).padStart(4)} ms`);
