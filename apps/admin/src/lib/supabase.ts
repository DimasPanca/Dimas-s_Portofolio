import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False until the two public env vars are set (see .env.example). The UI then shows setup steps. */
export const configured = Boolean(url && key);

// Only the publishable (anon) key ever reaches the browser; row-level security does the real gating.
export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const siteUrl = ((import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || '').replace(/\/$/, '');

export type Row = Record<string, unknown>;

export function publicUrl(bucket: 'media' | 'docs', path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Throws a readable error when a Supabase call fails. */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
