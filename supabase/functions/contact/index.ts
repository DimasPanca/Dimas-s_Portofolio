// Contact form endpoint (PRD §11). Public. Layers: validation → honeypot → time-trap → Turnstile →
// rate limit (5/hour per hashed IP) → store → notify the owner by email.
// Bots are answered with a normal success so they learn nothing about which check stopped them.
import { allowedOrigins, corsHeaders, db, json, sha256 } from '../_shared/http.ts';

const TOPICS = new Set(['internship', 'collaboration', 'competition', 'other']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Input = Record<string, string>;

async function readInput(req: Request): Promise<{ input: Input; wantsJson: boolean }> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const raw = (await req.json()) as Record<string, unknown>;
    const input: Input = {};
    for (const [k, v] of Object.entries(raw)) if (v != null) input[k] = String(v);
    return { input, wantsJson: true };
  }
  const form = await req.formData();
  const input: Input = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') input[k] = v;
  return { input, wantsJson: false };
}

function done(req: Request, wantsJson: boolean, redirect: string | undefined): Response {
  if (wantsJson) return json(req, 200, { ok: true });
  // No-JS path: send the visitor to the static thank-you page (only on an allowed origin).
  const safe =
    redirect && allowedOrigins.some((o) => redirect.startsWith(`${o}/`))
      ? redirect
      : `${allowedOrigins[0] ?? ''}/thanks`;
  return new Response(null, { status: 303, headers: { ...corsHeaders(req), Location: safe } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  let parsed: { input: Input; wantsJson: boolean };
  try {
    parsed = await readInput(req);
  } catch {
    return json(req, 400, { error: 'invalid_body' });
  }
  const { input, wantsJson } = parsed;

  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim();
  const message = (input.message ?? '').trim();
  const topic = TOPICS.has(input.topic ?? '') ? input.topic : 'other';
  const locale = input.locale === 'id' ? 'id' : 'en';
  if (
    name.length < 2 ||
    name.length > 80 ||
    !EMAIL.test(email) ||
    email.length > 200 ||
    message.length < 10 ||
    message.length > 2000
  )
    return json(req, 400, { error: 'validation' });

  // Honeypot and time-trap: pretend success.
  if ((input.website ?? '') !== '') return done(req, wantsJson, input.redirect);
  const elapsed = Number(input.elapsedMs ?? Number.NaN);
  if (Number.isFinite(elapsed) && elapsed < 2500) return done(req, wantsJson, input.redirect);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';

  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (turnstileSecret) {
    const token = input.turnstileToken ?? input['cf-turnstile-response'] ?? '';
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip }),
    });
    const result = (await check.json().catch(() => ({ success: false }))) as { success?: boolean };
    if (!result.success) return json(req, 400, { error: 'verification' });
  }

  // The IP is never stored: only a salted hash that changes every day.
  const salt = Deno.env.get('IP_HASH_SALT') ?? 'portfolio';
  const ipHash = await sha256(`${salt}:${new Date().toISOString().slice(0, 10)}:${ip}`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db(`messages?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}`, {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  const total = Number((recent.headers.get('content-range') ?? '*/0').split('/')[1] ?? 0);
  if (total >= 5) return json(req, 429, { error: 'rate_limited' });

  const insert = await db('messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      name,
      email,
      topic,
      message,
      locale,
      ip_hash: ipHash,
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 160),
    }),
  });
  if (!insert.ok) return json(req, 500, { error: 'storage' });

  // Email is a notification only: if it fails, the message is still in the admin inbox.
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('CONTACT_TO_EMAIL');
  if (resendKey && to) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('CONTACT_FROM_EMAIL') ?? 'Portfolio <onboarding@resend.dev>',
        to: [to],
        reply_to: email,
        subject: `[Portfolio] ${topic} — ${name}`,
        text: `From: ${name} <${email}>\nTopic: ${topic}\nLanguage: ${locale}\n\n${message}`,
      }),
    }).catch(() => undefined);
  }

  return done(req, wantsJson, input.redirect);
});
