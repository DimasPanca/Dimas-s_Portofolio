/**
 * Boot gate (PRD §5.2): asks for sound consent, never blocks for long, dismissible in one action.
 * The page underneath is real HTML; it is only made inert while the gate is open.
 */
import { cue, local, root, session } from '../lib/bus.ts';

export type GateChoice = { sound: boolean };

function finish(choice: GateChoice, origin?: HTMLElement): void {
  if (root.dataset.gate !== 'open') return;
  session.set('dp:gate', '1');
  const gate = document.querySelector<HTMLElement>('[data-gate-root]');
  if (origin && gate) {
    const r = origin.getBoundingClientRect();
    gate.style.setProperty('--gx', `${r.left + r.width / 2}px`);
    gate.style.setProperty('--gy', `${r.top + r.height / 2}px`);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-gate-inert]')) {
    el.inert = false;
    el.removeAttribute('data-gate-inert');
  }
  root.dataset.gate = 'closing';
  window.dispatchEvent(new CustomEvent<GateChoice>('dp:gate-done', { detail: choice }));
  if (choice.sound) cue('boot_stinger');
  window.setTimeout(() => {
    root.removeAttribute('data-gate');
    root.removeAttribute('data-gate-ready');
    document.getElementById('main')?.focus({ preventScroll: true });
  }, 820);
}

export function initGate(): void {
  if (root.dataset.gate !== 'open') {
    window.dispatchEvent(new CustomEvent<GateChoice | null>('dp:gate-done', { detail: null }));
    return;
  }
  const gate = document.querySelector<HTMLElement>('[data-gate-root]');
  if (!gate) {
    root.removeAttribute('data-gate');
    return;
  }
  for (const el of document.querySelectorAll<HTMLElement>('body > header, body > main, body > footer')) {
    el.inert = true;
    el.setAttribute('data-gate-inert', '');
  }
  const remember = gate.querySelector<HTMLInputElement>('[data-gate-remember]');
  const counter = gate.querySelector<HTMLElement>('[data-gate-count]');
  const buttons = [...gate.querySelectorAll<HTMLButtonElement>('[data-gate-enter]')];
  buttons[0]?.focus({ preventScroll: true });

  // The counter follows real readiness (fonts + hero image), with a 900 ms floor so it never flickers.
  const started = performance.now();
  const img = document.querySelector<HTMLImageElement>('[data-portrait-img]');
  const ready = Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    img && !img.complete ? img.decode().catch(() => undefined) : Promise.resolve(),
    new Promise((r) => setTimeout(r, 900)),
  ]);
  let done = false;
  ready.then(() => {
    done = true;
  });
  const tick = (now: number) => {
    if (!counter || root.dataset.gate !== 'open') return;
    const t = Math.min(1, (now - started) / 1100);
    const value = done ? 100 : Math.min(92, Math.round(t * 92));
    counter.textContent = String(value).padStart(3, '0');
    if (value < 100) requestAnimationFrame(tick);
    else root.dataset.gateReady = '';
  };
  requestAnimationFrame(tick);

  const choose = (sound: boolean, origin?: HTMLElement) => {
    local.set('dp:audio', JSON.stringify({ v: 1, enabled: sound, remember: Boolean(remember?.checked) }));
    finish({ sound }, origin);
  };
  for (const b of buttons) b.addEventListener('click', () => choose(b.dataset.gateEnter === 'sound', b));

  // Any scroll intent or Esc = "enter without sound" (recruiter-friendly, PRD §5.2).
  const skip = () => choose(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === ' ') {
      if (e.key === ' ' && document.activeElement instanceof HTMLButtonElement) return;
      e.preventDefault();
      skip();
    }
    if (e.key === 'Tab') {
      const focusable = [...buttons, ...(remember ? [remember] : [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };
  gate.addEventListener('keydown', onKey);
  gate.addEventListener('wheel', skip, { passive: true, once: true });
  gate.addEventListener('touchmove', skip, { passive: true, once: true });
}
