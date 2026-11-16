/**
 * L1 — core behavior, loaded on every page (PRD §8.1). Plain DOM, no libraries, budget ≤ 28 KB gz.
 * Everything here enhances markup that already works without JavaScript (HR-5).
 */
import {
  cue,
  finePointer,
  getTier,
  idle,
  local,
  reducedMotion,
  root,
  setTier,
  type Tier,
  toast,
  track,
} from '../lib/bus.ts';

const $ = <T extends HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<T>(sel);
const $$ = <T extends HTMLElement>(sel: string, scope: ParentNode = document) => [...scope.querySelectorAll<T>(sel)];

/* ------------------------------------------------------------- quality tier */
function detectTier(): Tier {
  const forced = new URLSearchParams(location.search).get('tier') as Tier | null;
  if (forced && ['static', 'low', 'mid', 'high'].includes(forced)) return forced;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (reducedMotion() || nav.connection?.saveData || local.get('dp:lite') === '1') return 'static';
  const memory = nav.deviceMemory ?? 8;
  if (memory <= 2) return 'static';
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || memory <= 4;
  if (!finePointer()) return weak ? 'low' : 'mid';
  return weak ? 'mid' : 'high';
}
setTier(detectTier());

/* ---------------------------------------------------------------- nav + menu */
const nav = $('[data-nav]');
const menu = $('[data-menu]');
const opener = $('[data-menu-open]');
let lastFocus: HTMLElement | null = null;

function setMenu(open: boolean) {
  if (!menu) return;
  menu.hidden = !open;
  root.style.overflow = open ? 'hidden' : '';
  window.dispatchEvent(new CustomEvent('dp:scroll-lock', { detail: open }));
  cue(open ? 'menu_open' : 'menu_close');
  if (open) {
    lastFocus = document.activeElement as HTMLElement | null;
    $('[data-menu-close]', menu)?.focus();
  } else lastFocus?.focus();
}
opener?.addEventListener('click', (e) => {
  e.preventDefault();
  setMenu(true);
});
opener?.setAttribute('role', 'button');
menu?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-menu-close]') || target.closest('[data-menu-link]')) setMenu(false);
});
menu?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
  if (e.key !== 'Tab') return;
  const focusable = $$('a[href], button', menu);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});

/* Hide on scroll down, show on scroll up; scroll progress bar. */
const progress = $('[data-progress]');
let lastY = scrollY;
let ticking = false;
function onScroll() {
  ticking = false;
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress?.style.setProperty('--p', String(max > 0 ? Math.min(1, y / max) : 0));
  if (nav) {
    const down = y > lastY && y > 240;
    if (Math.abs(y - lastY) > 6) nav.toggleAttribute('data-hidden', down && menu?.hidden !== false);
  }
  lastY = y;
}
addEventListener(
  'scroll',
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true },
);
onScroll();

/* Active section in the nav + "explored" progress + one soft cue per section. */
const links = new Map($$('[data-nav-link]').map((a) => [a.dataset.navLink!, a]));
const sections = $$('main section[id]');
const explored = new Set<string>((local.get('dp:explored') ?? '').split(',').filter(Boolean));
const hud = $('[data-explored]');
const paintHud = () => {
  if (hud) hud.textContent = `${Math.min(explored.size, sections.length)}/${sections.length}`;
};
paintHud();
if (sections.length) {
  const entered = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        for (const [key, a] of links) a.toggleAttribute('aria-current', key === id);
        if (links.has(id)) links.get(id)!.setAttribute('aria-current', 'true');
        if (!entered.has(id)) {
          entered.add(id);
          if (entered.size > 1) cue('section_enter');
        }
        if (!explored.has(id)) {
          explored.add(id);
          local.set('dp:explored', [...explored].join(','));
          paintHud();
          if (explored.size === sections.length && local.get('dp:explorer') !== '1') {
            local.set('dp:explorer', '1');
            const msg = root.dataset.msgExplorer;
            if (msg) toast(msg, 3600);
            cue('unlock');
            track('unlock_all');
          }
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  for (const s of sections) io.observe(s);
}

/* ------------------------------------------------------------------- reveals */
const revealTargets = $$('[data-reveal]');
if (revealTargets.length) {
  if (getTier() === 'static') for (const el of revealTargets) el.classList.add('is-in');
  else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    for (const el of revealTargets) io.observe(el);
  }
}

/* Pause CSS marquees that are off-screen (PRD §6.2). */
const marquees = $$('.marquee');
if (marquees.length) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute('data-paused', !entry.isIntersecting);
  });
  for (const m of marquees) io.observe(m);
}

/* ------------------------------------------------------------- small widgets */
// Count-up: final values are already in the HTML; this only animates them in.
for (const el of $$('[data-count]')) {
  const target = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimals ?? 0);
  if (!Number.isFinite(target) || getTier() === 'static') continue;
  const io = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return;
    io.disconnect();
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      const eased = 1 - 2 ** (-10 * p);
      el.textContent = (target * (p === 1 ? 1 : eased)).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  io.observe(el);
}

// Live clock (Asia/Jakarta), paused while the tab is hidden.
const clock = $('[data-clock]');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const paint = () => {
    if (!document.hidden) clock.textContent = fmt.format(new Date());
  };
  paint();
  setInterval(paint, 1000);
}

// Copy-to-clipboard buttons (email).
for (const btn of $$('[data-copy]')) {
  btn.addEventListener('click', async (e) => {
    const value = btn.dataset.copy!;
    try {
      await navigator.clipboard.writeText(value);
      e.preventDefault();
      toast(btn.dataset.copied ?? 'Copied');
      cue('copy_ok');
      track('contact_click');
    } catch {
      /* clipboard blocked: the element's mailto: href still works */
    }
  });
}

// Lite mode toggle (forces the static tier, persisted).
const lite = $('[data-lite-toggle]');
if (lite) {
  lite.hidden = false;
  const on = () => local.get('dp:lite') === '1';
  lite.setAttribute('aria-pressed', String(on()));
  lite.addEventListener('click', () => {
    local.set('dp:lite', on() ? '0' : '1');
    cue(on() ? 'toggle_on' : 'toggle_off');
    location.reload();
  });
}

// Remember an explicit language choice (no automatic redirects, PRD §12.2).
for (const a of $$('[data-lang-switch]'))
  a.addEventListener('click', () => local.set('dp:lang', a.dataset.langSwitch!));

// Filter chips (achievements archive, journey). Without JS every item is visible.
for (const group of $$('[data-filter-group]')) {
  const scope = document.getElementById(group.dataset.filterGroup!);
  if (!scope) continue;
  group.hidden = false;
  group.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!btn) return;
    const value = btn.dataset.filter!;
    for (const b of $$('[data-filter]', group)) b.setAttribute('aria-pressed', String(b === btn));
    for (const item of $$('[data-kind]', scope)) item.hidden = value !== 'all' && item.dataset.kind !== value;
    cue('click_soft');
  });
}

// Horizontal sliders: arrow buttons + position counter on top of native scroll-snap.
for (const slider of $$('[data-slider]')) {
  const track = $('[data-slider-track]', slider);
  if (!track) continue;
  const counter = $('[data-slider-count]', slider);
  const items = $$(':scope > *', track);
  const stepBy = (dir: number) => {
    const first = items[0];
    const width = first ? first.getBoundingClientRect().width + 20 : track.clientWidth;
    track.scrollBy({ left: dir * width, behavior: reducedMotion() ? 'auto' : 'smooth' });
    cue('rail_tick');
  };
  $('[data-slider-prev]', slider)?.addEventListener('click', () => stepBy(-1));
  $('[data-slider-next]', slider)?.addEventListener('click', () => stepBy(1));
  if (counter && items.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = items.indexOf(entry.target as HTMLElement) + 1;
          counter.textContent = `${String(i).padStart(2, '0')}/${String(items.length).padStart(2, '0')}`;
        }
      },
      { root: track, threshold: 0.6 },
    );
    for (const it of items) io.observe(it);
  }
}

// Tab title when the visitor is away (playful zone, PRD §4.10).
const awayTitle = root.dataset.msgAway;
if (awayTitle) {
  const original = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? awayTitle : original;
  });
}

/* --------------------------------------------- delegated sound cues (PRD §7.6) */
let lastHover: Element | null = null;
document.addEventListener(
  'pointerover',
  (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const el = (e.target as HTMLElement).closest?.('[data-sound~="hover"]');
    if (el && el !== lastHover) cue('hover_tick');
    lastHover = el ?? null;
  },
  { passive: true },
);
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-sound], [data-track]');
  if (!el) return;
  const kinds = el.dataset.sound ?? '';
  if (kinds.includes('nav')) cue('nav_link');
  else if (kinds.includes('click')) cue('click_soft');
  if (el.dataset.track) track(el.dataset.track);
});

/* ------------------------------------------ lazy layers (PRD §8.1: L2, L3, L4) */
const hasHome = root.hasAttribute('data-home');
import('./sound.ts').then((m) => m.initSound()).catch(() => {});
if (hasHome) import('./gate.ts').then((m) => m.initGate()).catch(() => root.removeAttribute('data-gate'));
import('./contact.ts').then((m) => m.initContact()).catch(() => {});
if (getTier() !== 'static') {
  idle(() => {
    import('./motion.ts').then((m) => m.initMotion()).catch(() => {});
  });
}
