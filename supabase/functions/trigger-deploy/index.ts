// Publish endpoint (PRD §9.6). Only the owner with a completed MFA challenge may trigger a rebuild.
// The deploy hook URL is a server secret and never reaches the browser.
import { corsHeaders, db, env, json } from '../_shared/http.ts';

function claims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(req, 401, { error: 'unauthenticated' });

  // Let the Auth server validate the token (signature + expiry), then check owner + assurance level.
  const who = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SERVICE_KEY },
  });
  if (!who.ok) return json(req, 401, { error: 'unauthenticated' });
  const user = (await who.json()) as { id?: string };
  if (!user.id) return json(req, 401, { error: 'unauthenticated' });
  if (claims(token).aal !== 'aal2') return json(req, 403, { error: 'mfa_required' });

  const owner = await db(`owner?select=user_id&user_id=eq.${user.id}`);
  const rows = (await owner.json().catch(() => [])) as unknown[];
  if (!owner.ok || rows.length !== 1) return json(req, 403, { error: 'forbidden' });

  const body = (await req.json().catch(() => ({}))) as { note?: string; placeholders?: number; summary?: unknown };
  const hook = Deno.env.get('VERCEL_DEPLOY_HOOK_URL');
  let status = 'triggered';
  if (!hook) status = 'not_configured';
  else {
    const res = await fetch(hook, { method: 'POST' }).catch(() => null);
    if (!res?.ok) status = 'hook_failed';
  }

  await db('publish_runs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      triggered_by: user.id,
      note: typeof body.note === 'string' ? body.note.slice(0, 280) : null,
      status,
      placeholders_count: Number.isFinite(body.placeholders) ? body.placeholders : 0,
      summary: body.summary ?? null,
    }),
  });

  if (status !== 'triggered') return json(req, 502, { error: status });
  return json(req, 200, { ok: true, status });
});
