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

// Depth proxy for the parallax shader: blurred alpha (centre of the figure reads "nearer").
await sharp(cutout)
  .extract(HERO)
  .extractChannel('alpha')
  .resize({ width: 512 })
  .blur(28)
  .webp({ quality: 70 })
  .toFile(resolve(out, 'hero-depth.webp'));

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
