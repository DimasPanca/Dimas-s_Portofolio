import { must, supabase } from './supabase.ts';

const MAX_EDGE = 1600;

/**
 * Re-encodes an image in the browser before upload (PRD FR-ADM-06): resized to ≤ 1600 px and drawn through a
 * canvas, which drops all EXIF metadata (including GPS). Returns WebP.
 */
export async function reencode(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
  if (!blob) throw new Error('Could not encode the image.');
  return { blob, width, height };
}

/** Uploads one image and records it in the media table. Alt text is required (accessibility, PRD §13). */
export async function uploadImage(file: File, alt: { en: string; id?: string }, folder = 'uploads'): Promise<string> {
  if (!alt.en.trim()) throw new Error('Alt text (English) is required.');
  const { blob, width, height } = await reencode(file);
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.webp`;
  must(
    await supabase.storage.from('media').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' }),
  );
  const row = must(
    await supabase
      .from('media')
      .insert({
        path,
        width,
        height,
        alt: { en: alt.en.trim(), ...(alt.id?.trim() ? { id: alt.id.trim() } : {}) },
        mime: 'image/webp',
        bytes: blob.size,
      })
      .select('id')
      .single(),
  ) as { id: string };
  return row.id;
}

export async function uploadPdf(file: File): Promise<string> {
  if (file.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
  const path = `cv/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.pdf`;
  must(await supabase.storage.from('docs').upload(path, file, { contentType: 'application/pdf' }));
  return path;
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
