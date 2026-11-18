/** Tiny shared runtime: safe storage, sound-cue bus, toasts, quality tier. No dependencies. */

export type Tier = 'static' | 'low' | 'mid' | 'high';
export type CueId =
  | 'load_start'
  | 'load_tick'
  | 'load_ready'
  | 'boot_stinger'
  | 'hover_tick'
  | 'click_soft'
  | 'nav_link'
  | 'toggle_on'
  | 'toggle_off'
  | 'menu_open'
  | 'menu_close'
  | 'section_enter'
  | 'rail_tick'
  | 'unlock'
  | 'unlock_gold'
  | 'card_open'
  | 'copy_ok'
  | 'send_ok'
  | 'error';

const safe = (storage: () => Storage) => ({
  get(key: string): string | null {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      storage().setItem(key, value);
    } catch {
      /* storage unavailable (private mode / blocked): preferences simply do not persist */
    }
  },
});
export const local = safe(() => localStorage);
export const session = safe(() => sessionStorage);

/* The audio engine registers itself here once loaded; until then cues are no-ops (PRD HR-6). */
type Player = (id: CueId) => void;
let player: Player | null = null;
export function setPlayer(p: Player | null): void {
  player = p;
}
export function cue(id: CueId): void {
  try {
    player?.(id);
  } catch {
    /* audio must never break the page */
  }
}

export function toast(message: string, ms = 2600): void {
  const host = document.querySelector<HTMLElement>('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  host.replaceChildren(el);
  window.setTimeout(() => {
    el.classList.add('is-out');
    window.setTimeout(() => el.remove(), 400);
  }, ms);
}

export const root = document.documentElement;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function getTier(): Tier {
  return (root.dataset.tier as Tier | undefined) ?? 'low';
}
export function setTier(tier: Tier): void {
  root.dataset.tier = tier;
  window.dispatchEvent(new CustomEvent<Tier>('dp:tier', { detail: tier }));
}

/** Runs a callback when the browser is idle (with a timeout fallback for Safari). */
export function idle(fn: () => void, timeout = 1500): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 200);
}

/** Cookie-less first-party event counter (PRD §12.4). Fire-and-forget. */
export function track(name: string): void {
  const url = root.dataset.trackUrl;
  if (!url) return;
  try {
    navigator.sendBeacon?.(url, new Blob([JSON.stringify({ name })], { type: 'application/json' }));
  } catch {
    /* ignore */
  }
}
