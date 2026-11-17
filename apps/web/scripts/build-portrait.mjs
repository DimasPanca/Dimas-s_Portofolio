/**
 * Portrait crops from the matted cut-out (PRD §4.7 step 5). One-off; outputs are committed.
 * Usage (from apps/web): node scripts/build-portrait.mjs [previewDir]
 * Input: ../../tools/images/raw/portrait-cutout.png (git-ignored, made by tools/images/cutout.py)
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const cutout = resolve(root, 'tools/images/raw/portrait-cutout.png');
const source = resolve(root, 'design/source/Dimas.jpg');
const out = resolve(here, '../src/assets/portrait');
const pub = resolve(here, '../public');
await mkdir(out, { recursive: true });

// Crop boxes in source pixels (1792×2400). Hero = head to mid-thigh (4:5); full = whole figure.
const HERO = { left: 330, top: 90, width: 1120, height: 1400 };
const FULL = { left: 300, top: 90, width: 1200, height: 2240 };

// Slight contrast lift + cool-neutral grade so the cut-out sits on ink (colour only, no retouching).
const grade = (img) => img.modulate({ saturation: 0.92, brightness: 1.03 }).linear(1.06, -6);

await grade(sharp(cutout).extract(HERO))
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(resolve(out, 'hero.webp'));
await grade(sharp(cutout).extract(FULL).resize({ height: 1600 }))
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(resolve(out, 'full.webp'));

// Edge map for the rim-light shader: a signed distance field of the silhouette plus its outward normal.
//   R,G = outward normal (image space, 0.5-centred) · B = signed distance (0.5 at the edge, >0.5 inside, ±RANGE px)
// A uniform-width band along the whole outline makes the light behave the same everywhere (hair, ears, shoulders).
{
  const W = 512;
  const H = 640;
  const RANGE = 48;
  const { data } = await sharp(cutout)
    .extract(HERO)
    .resize(W, H)
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const inside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inside[i] = data[i] > 127 ? 1 : 0;
  // Two-pass chamfer distance transform: distance (px) to the nearest pixel where the mask is set.
  const distanceTo = (zero) => {
    const d = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) d[i] = zero[i] ? 0 : 1e6;
    const D1 = 1;
    const D2 = Math.SQRT2;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + D1);
        if (y > 0) {
          v = Math.min(v, d[i - W] + D1);
          if (x > 0) v = Math.min(v, d[i - W - 1] + D2);
          if (x < W - 1) v = Math.min(v, d[i - W + 1] + D2);
        }
        d[i] = v;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let v = d[i];
        if (x < W - 1) v = Math.min(v, d[i + 1] + D1);
        if (y < H - 1) {
          v = Math.min(v, d[i + W] + D1);
          if (x < W - 1) v = Math.min(v, d[i + W + 1] + D2);
          if (x > 0) v = Math.min(v, d[i + W - 1] + D2);
        }
        d[i] = v;
      }
    return d;
  };
  const outside = inside.map((v) => 1 - v);
  const dIn = distanceTo(outside);
  const dOut = distanceTo(inside);
  let sdf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sdf[i] = Math.max(-RANGE, Math.min(RANGE, inside[i] ? dIn[i] - 0.5 : 0.5 - dOut[i]));
  // Three box-blur passes (radius 4) smooth the field so the normals turn gently around corners.
  const blur = (src) => {
    const R = 4;
    const tmp = new Float32Array(W * H);
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += src[y * W + Math.max(0, Math.min(W - 1, x + k))];
        tmp[y * W + x] = sum / (2 * R + 1);
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += tmp[Math.max(0, Math.min(H - 1, y + k)) * W + x];
        out[y * W + x] = sum / (2 * R + 1);
      }
    return out;
  };
  const smooth = blur(blur(blur(sdf)));
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const gx = smooth[y * W + Math.min(W - 1, x + 2)] - smooth[y * W + Math.max(0, x - 2)];
      const gy = smooth[Math.min(H - 1, y + 2) * W + x] - smooth[Math.max(0, y - 2) * W + x];
      const len = Math.hypot(gx, gy) || 1;
      rgb[i * 3] = Math.round((-gx / len) * 127 + 128); // outward = toward decreasing distance
      rgb[i * 3 + 1] = Math.round((-gy / len) * 127 + 128);
      rgb[i * 3 + 2] = Math.round((sdf[i] / RANGE) * 127 + 128);
    }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 90, effort: 6 })
    .toFile(resolve(out, 'hero-edge.webp'));
  sdf = null;
}

// Editorial variant keeps the studio backdrop.
await sharp(source)
  .resize({ width: 1400 })
  .modulate({ saturation: 0.9 })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(resolve(out, 'editorial.jpg'));

// Square portrait for JSON-LD / social.
await sharp(source)
  .extract({ left: 446, top: 60, width: 900, height: 900 })
  .resize(800, 800)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(resolve(pub, 'og-portrait.jpg'));

const previewDir = process.argv[2];
if (previewDir) {
  for (const [name, bg] of [
    ['dark', '#0a0a0b'],
    ['paper', '#f3f1ea'],
  ]) {
    await sharp(resolve(out, 'hero.webp'))
      .resize({ height: 1200 })
      .flatten({ background: bg })
      .jpeg({ quality: 88 })
      .toFile(resolve(previewDir, `hero-on-${name}.jpg`));
  }
  await sharp(resolve(out, 'full.webp'))
    .resize({ height: 1200 })
    .flatten({ background: '#0a0a0b' })
    .jpeg({ quality: 85 })
    .toFile(resolve(previewDir, 'full-on-dark.jpg'));
}
console.log('portrait assets written to', out);
