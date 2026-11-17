// Cookie-less event counter (PRD §12.4). Stores only a per-day total for a short allow-list of names:
// no IP, no user agent, no identifiers.
import { corsHeaders, db, json } from '../_shared/http.ts';

const NAMES = new Set(['cv_download', 'sound_on', 'sound_off', 'contact_click', 'unlock_all']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' ? body.name : '';
  if (!NAMES.has(name)) return json(req, 400, { error: 'unknown_event' });
  await db('rpc/increment_event', { method: 'POST', body: JSON.stringify({ event_name: name }) });
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});
