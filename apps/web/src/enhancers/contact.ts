/** Contact form enhancement (PRD §11). Without JS the form posts natively (function URL or mailto:). */
import { cue, track } from '../lib/bus.ts';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function initContact(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = form.querySelector<HTMLElement>('[data-submit-label]')!;
  const idleLabel = label.textContent ?? '';
  const { endpoint = '', turnstile: siteKey = '' } = form.dataset;
  const openedAt = Date.now();
  let token = '';

  const say = (text: string, state: 'ok' | 'error' | '') => {
    status.textContent = text;
    status.dataset.state = state;
  };

  const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-error]')];
  const validate = (field: HTMLInputElement | HTMLTextAreaElement): boolean => {
    const ok = field.checkValidity() && field.value.trim().length >= (field.minLength > 0 ? field.minLength : 1);
    const err = document.getElementById(`${field.id}-err`);
    field.setAttribute('aria-invalid', String(!ok));
    if (err) {
      err.hidden = ok;
      err.textContent = ok ? '' : (field.dataset.error ?? '');
      if (ok) field.removeAttribute('aria-describedby');
      else field.setAttribute('aria-describedby', err.id);
    }
    return ok;
  };
  for (const f of fields) f.addEventListener('blur', () => f.value && validate(f));

  // Turnstile loads only when the form is first focused (PRD §8.4).
  let turnstileLoaded = false;
  const loadTurnstile = () => {
    if (turnstileLoaded || !siteKey || !endpoint) return;
    turnstileLoaded = true;
    const slot = form.querySelector<HTMLElement>('[data-turnstile-slot]');
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => {
      if (slot && window.turnstile)
        window.turnstile.render(slot, {
          sitekey: siteKey,
          theme: 'dark',
          appearance: 'interaction-only',
          callback: (t: string) => {
            token = t;
          },
        });
    };
    document.head.append(s);
  };
  form.addEventListener('focusin', loadTurnstile, { once: true });

  form.addEventListener('submit', async (e) => {
    const valid = fields.map(validate).every(Boolean);
    if (!valid) {
      e.preventDefault();
      fields.find((f) => f.getAttribute('aria-invalid') === 'true')?.focus();
      cue('error');
      return;
    }
    if (!endpoint) return; // not connected yet: let the native mailto: submit happen
    e.preventDefault();
    submit.disabled = true;
    label.textContent = form.dataset.msgSending ?? idleLabel;
    say('', '');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, turnstileToken: token || undefined, elapsedMs: Date.now() - openedAt }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say(form.dataset.msgSent ?? '', 'ok');
      cue('send_ok');
      track('contact_click');
    } catch {
      say(form.dataset.msgFailed ?? '', 'error');
      cue('error');
      window.turnstile?.reset();
    } finally {
      submit.disabled = false;
      label.textContent = idleLabel;
    }
  });
}
