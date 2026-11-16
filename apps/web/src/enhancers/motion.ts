/**
 * L2 — motion layer (PRD §6). Loaded on idle, never on the static tier.
 * One clock: gsap.ticker drives Lenis, ScrollTrigger and (through an event) the WebGL hero.
 * Only transform/opacity are animated; every effect has a static fallback in CSS.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { cue, finePointer, getTier, root, session } from '../lib/bus.ts';

const $ = <T extends HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<T>(sel);
const $$ = <T extends HTMLElement>(sel: string, scope: ParentNode = document) => [...scope.querySelectorAll<T>(sel)];

let velocity = 0;
/** Smoothed scroll velocity in px/frame, shared with the WebGL hero. */
export const scrollVelocity = () => velocity;

export function initMotion(): void {
  const tier = getTier();
  if (tier === 'static') return;
  const fine = finePointer();
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);

  /* ------------------------------------------------ smooth scroll (desktop) */
  let lenis: Lenis | null = null;
  if (fine && (tier === 'mid' || tier === 'high')) {
    lenis = new Lenis({ autoRaf: false, lerp: 0.11, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis?.raf(time * 1000));
    window.addEventListener('dp:scroll-lock', (e) =>
      (e as CustomEvent<boolean>).detail ? lenis?.stop() : lenis?.start(),
    );
    if (root.dataset.gate) {
      lenis.stop();
      window.addEventListener('dp:gate-done', () => lenis?.start(), { once: true });
    }
  }

  /* ----------------------------------- velocity-coupled marquees (PRD §5.3) */
  const marquees = $$('[data-velocity-marquee]').map((el) => ({
    el,
    skew: el.classList.contains('hero__marquee'),
    anims: [] as Animation[],
  }));
  let lastY = scrollY;
  gsap.ticker.add(() => {
    const raw = lenis ? lenis.velocity : scrollY - lastY;
    lastY = scrollY;
    velocity += (raw - velocity) * 0.12;
    const speed = Math.min(6, 1 + Math.abs(velocity) * 0.09);
    for (const m of marquees) {
      if (m.el.hasAttribute('data-paused')) continue;
      if (!m.anims.length) m.anims = $$('.marquee__track', m.el).flatMap((t) => t.getAnimations());
      for (const a of m.anims) a.playbackRate = speed;
      if (m.skew) m.el.style.transform = `skewX(${Math.max(-6, Math.min(6, -velocity * 0.12)).toFixed(2)}deg)`;
    }
  });

  /* ----------------------------------------------------- hero scroll parallax */
  const hero = $('[data-hero]');
  if (hero) {
    gsap.to('.hero__name', {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /* -------------------------------- about: scroll-scrubbed words (PRD §5.4) */
  const statement = $('[data-scrub-words]');
  if (statement) {
    const words = $$('.w', statement);
    root.dataset.scrub = 'on';
    let lit = -1;
    ScrollTrigger.create({
      trigger: statement,
      start: 'top 78%',
      end: 'bottom 45%',
      scrub: 0.6,
      onUpdate(self) {
        const n = Math.round(self.progress * words.length);
        if (n === lit) return;
        words.forEach((w, i) => {
          const on = i < n;
          if (on && !w.classList.contains('is-lit') && w.querySelector('.sticker')) cue('hover_tick');
          w.classList.toggle('is-lit', on);
        });
        lit = n;
      },
    });
  }

  /* ----------------------------- achievements rail + unlock (PRD §5.5) */
  const rail = $('[data-rail]');
  const track = rail && $('[data-rail-track]', rail);
  if (rail && track) {
    const cards = $$('[data-unlock]', track);
    const counter = $('[data-unlock-count]');
    const live = $('[data-rail-live]');
    const seen = new Set((session.get('dp:unlocked') ?? '').split(',').filter(Boolean));
    const paint = () => {
      if (counter) counter.textContent = String(Math.min(seen.size, cards.length));
    };
    for (const [i, c] of cards.entries()) if (seen.has(String(i))) c.classList.add('is-unlocked');
    paint();
    const unlock = (i: number) => {
      const card = cards[i];
      if (!card || seen.has(String(i))) return;
      seen.add(String(i));
      session.set('dp:unlocked', [...seen].join(','));
      card.classList.add('is-unlocked');
      cue(card.dataset.tier === '1' ? 'unlock_gold' : 'unlock');
      paint();
      if (live) live.textContent = `${card.dataset.title ?? ''} (${i + 1}/${cards.length})`;
    };

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px) and (hover: hover) and (pointer: fine)', () => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      rail.setAttribute('data-pinned', '');
      rail.scrollLeft = 0;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: rail,
          start: 'center center',
          // Pin length is capped so nobody is trapped in a long pin (PRD §5.5).
          end: () => `+=${Math.min(distance(), window.innerHeight * 3)}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate() {
            const edge = window.innerWidth * 0.6;
            for (const [i, c] of cards.entries()) {
              const r = c.getBoundingClientRect();
              if (r.left + r.width / 2 < edge) unlock(i);
            }
          },
        },
      });
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(track, { clearProps: 'transform' });
        rail.removeAttribute('data-pinned');
      };
    });
    mm.add('not ((min-width: 1024px) and (hover: hover) and (pointer: fine))', () => {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) unlock(cards.indexOf(e.target as HTMLElement));
        },
        { threshold: 0.7 },
      );
      for (const c of cards) io.observe(c);
      return () => io.disconnect();
    });

    // Keyboard: arrow keys move between cards (works in both modes).
    rail.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const links = cards.map((c) => $('a', c));
      const at = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = links[Math.max(0, Math.min(links.length - 1, at + (e.key === 'ArrowRight' ? 1 : -1)))];
      if (!next) return;
      e.preventDefault();
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'center' });
      cue('rail_tick');
    });

    // Tilt + glare on pointer devices (high tier only).
    if (fine && tier === 'high') {
      for (const card of $$('[data-tilt]', track)) {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 10);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
        });
        card.addEventListener('pointerleave', () => {
          rx(0);
          ry(0);
        });
      }
    }
  }

  /* -------------------------------------------- journey line (PRD §5.6) */
  const timeline = $('[data-timeline]');
  if (timeline) {
    timeline.style.setProperty('--fill', '0');
    ScrollTrigger.create({
      trigger: timeline,
      start: 'top 70%',
      end: 'bottom 60%',
      scrub: 1,
      onUpdate: (self) => timeline.style.setProperty('--fill', self.progress.toFixed(3)),
    });
  }

  /* ---------------------------------------------------- credo words (PRD §5.8) */
  const credo = $('[data-credo]');
  if (credo) {
    const words = $$('[data-credo-word]', credo);
    ScrollTrigger.create({
      trigger: credo,
      start: 'top 65%',
      end: 'bottom 55%',
      scrub: true,
      onUpdate(self) {
        const at = Math.min(words.length - 1, Math.floor(self.progress * words.length));
        for (const [i, w] of words.entries()) w.classList.toggle('is-active', i === at);
      },
    });
  }

  /* --------------------- contact headline reacts to the cursor (PRD §5.10) */
  const headline = $('[data-proximity]');
  if (headline && fine) {
    const text = headline.textContent ?? '';
    headline.setAttribute('aria-label', text);
    headline.replaceChildren(
      ...text.split(' ').flatMap((word, i, all) => {
        const span = document.createElement('span');
        span.className = 'ch';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = word;
        return i < all.length - 1 ? [span, document.createTextNode(' ')] : [span];
      }),
    );
    const parts = $$('.ch', headline).map((el) => ({
      el,
      x: gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' }),
    }));
    headline.addEventListener('pointermove', (e) => {
      for (const p of parts) {
        const r = p.el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const pull = Math.max(0, 1 - Math.hypot(dx, dy) / 420);
        p.x(-dx * 0.06 * pull);
        p.y(-dy * 0.1 * pull);
      }
    });
    headline.addEventListener('pointerleave', () => {
      for (const p of parts) {
        p.x(0);
        p.y(0);
      }
    });
  }

  /* --------------------------------------------- custom cursor (PRD FR-CURSOR) */
  if (fine && (tier === 'mid' || tier === 'high')) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<i class="cursor__dot"></i><i class="cursor__ring"><b></b></i>';
    document.body.append(cursor);
    const dot = cursor.firstElementChild as HTMLElement;
    const ring = cursor.lastElementChild as HTMLElement;
    const label = ring.firstElementChild as HTMLElement;
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });
    const labels: Record<string, string> = {
      view: root.lang === 'id' ? 'LIHAT' : 'VIEW',
      drag: root.lang === 'id' ? 'GESER' : 'DRAG',
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        cursor.classList.add('is-on');
        dx(e.clientX);
        dy(e.clientY);
        rx(e.clientX);
        ry(e.clientY);
        const target = e.target as HTMLElement;
        const kind = target.closest<HTMLElement>('[data-cursor]')?.dataset.cursor ?? '';
        const state = kind || (target.closest('a, button, summary, label, [role="button"]') ? 'link' : '');
        const field = Boolean(target.closest('input, textarea, select'));
        if (cursor.dataset.state !== state) {
          cursor.dataset.state = state;
          label.textContent = labels[kind] ?? '';
        }
        cursor.classList.toggle('is-hidden', field);
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }

  /* ------------------------------------------------------------ WebGL hero (L3) */
  if ((tier === 'mid' || tier === 'high') && $('[data-portrait]')) {
    import('../lib/webgl/hero.ts')
      .then((m) => m.initHeroGL({ tier, velocity: scrollVelocity, ticker: gsap.ticker }))
      .catch(() => {});
  }

  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
