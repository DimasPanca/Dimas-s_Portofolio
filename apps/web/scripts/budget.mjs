/**
 * Size budgets (PRD §8.2) checked against the built site. Fails the process when a budget is exceeded.
 * Usage (from apps/web, after `pnpm build`): node scripts/budget.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const KB = 1024;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const br = (buf) => brotliCompressSync(buf).length;
const read = (p) => readFileSync(join(dist, p));
const walk = (dir) =>
  readdirSync(join(dist, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name).replaceAll('\\', '/')],
  );

const html = read('index.html');
const page = html.toString('utf8');
const assets = walk('_astro');
const refs = (re) => [...page.matchAll(re)].map((m) => m[1].replace(/^\//, ''));

// Everything index.html pulls in before any interaction.
const initialJs = new Set(
  refs(/<script[^>]+src="([^"]+\.js)"/g).concat(refs(/rel="modulepreload"[^>]+href="([^"]+\.js)"/g)),
);
const css = refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g);
const inlineCss = [...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].reduce(
  (n, m) => n + Buffer.byteLength(m[1]),
  0,
);
const fonts = refs(/rel="preload"[^>]+href="([^"]+\.woff2)"/g);
const named = (name) => assets.filter((f) => f.endsWith('.js') && f.split('/').pop().startsWith(`${name}.`));
const sum = (files, fn) => files.reduce((n, f) => n + fn(read(f)), 0);
const raw = (files) => files.reduce((n, f) => n + statSync(join(dist, f)).size, 0);

// Largest AVIF candidate of the hero portrait that a 1× desktop would pick (≤ 1100w).
const lcp = assets
  .filter((f) => /hero\.[^/]*\.avif$/.test(f))
  .map((f) => statSync(join(dist, f)).size)
  .sort((a, b) => a - b);
const lcpTypical = lcp[Math.min(3, lcp.length - 1)] ?? 0;

const rows = [
  ['HTML (br)', br(html), 35 * KB],
  ['CSS total (br)', sum(css, br) + inlineCss / 4, 30 * KB],
  ['L1 core JS (gz)', sum([...initialJs], gz), 28 * KB],
  ['L2 motion chunk (gz)', sum(named('motion'), gz), 80 * KB],
  ['L3 webgl chunk (gz)', sum(named('webgl'), gz), 35 * KB],
  ['L4 audio chunk (gz)', sum(named('audio'), gz), 20 * KB],
  ['Preloaded fonts', raw(fonts), 90 * KB],
  ['LCP image (typical AVIF)', lcpTypical, 80 * KB],
];
const initial = br(html) + sum(css, br) + sum([...initialJs], gz) + raw(fonts) + lcpTypical;
rows.push(['Initial transfer', initial, 450 * KB]);

let failed = false;
for (const [label, size, limit] of rows) {
  const ok = size <= limit;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(26)} ${(size / KB).toFixed(1).padStart(7)} KB / ${(limit / KB).toFixed(0)} KB`,
  );
}
if (failed) {
  console.error('\nSize budget exceeded (PRD §8.2).');
  process.exit(1);
}
