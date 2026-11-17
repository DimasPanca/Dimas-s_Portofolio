/**
 * L2 — motion layer (PRD §6). Loaded on idle, never on the static tier.
 * One clock: gsap.ticker drives Lenis, ScrollTrigger, the cursor and the WebGL hero, so nothing
 * drifts out of step. Only transform/opacity are animated; every effect has a static CSS fallback.
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
  const rich = tier === 'mid' || tier === 'high';
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);
  gsap.defaults({ ease: 'power3.out', duration: 0.6 });

  /* ------------------------------------------------ smooth scroll (desktop) */
  let lenis: Lenis | null = null;
  if (fine && rich) {
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 0.95, anchors: true });
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
  // With Lenis the page position is already eased, so scrubs track it 1:1 (a second smoothing layer
  // is what makes pinned sections feel uneven). Without Lenis a short scrub smooths native scrolling.
  const scrub = lenis ? true : 0.5;

  /* ----------------------------------- velocity-coupled marquees (PRD §5.3) */
  const marquees = $$('[data-velocity-marquee]').map((el) => ({
    el,
    skew: el.classList.contains('hero__marquee'),
    anims: [] as Animation[],
    rate: 1,
  }));
  let lastY = scrollY;
  gsap.ticker.add(() => {
    const raw = lenis ? lenis.velocity : scrollY - lastY;
    lastY = scrollY;
    velocity += (raw - velocity) * 0.1;
    const speed = Math.min(5, 1 + Math.abs(velocity) * 0.08);
    for (const m of marquees) {
      if (m.el.hasAttribute('data-paused')) continue;
      if (!m.anims.length) m.anims = $$('.marquee__track', m.el).flatMap((t) => t.getAnimations());
      // Only touch the animations when the rate really changed (avoids needless style work).
      if (Math.abs(speed - m.rate) > 0.01) {
        m.rate = speed;
        for (const a of m.anims) a.playbackRate = speed;
      }
      if (m.skew) m.el.style.transform = `skewX(${Math.max(-5, Math.min(5, -velocity * 0.1)).toFixed(2)}deg)`;
    }
  });

  /* ----------------------------------------------------- hero scroll parallax */
  const hero = $('[data-hero]');
  if (hero) {
    const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub };
    gsap.to('.hero__name', { yPercent: -10, ease: 'none', scrollTrigger: st });
  }

  /* -------------------------------- about: scroll-scrubbed words (PRD §5.4) */
  const statement = $('[data-scrub-words]');
  if (statement) {
    const words = $$('.w', statement);
    root.dataset.scrub = 'on';
    let lit = -1;
    ScrollTrigger.create({
      trigger: statement,
      start: 'top 80%',
      end: 'bottom 50%',
      onUpdate(self) {
        const n = Math.round(self.progress * words.length);
        if (n === lit) return;
        for (const [i, w] of words.entries()) {
          const on = i < n;
          if (on && !w.classList.contains('is-lit') && w.querySelector('.sticker')) cue('hover_tick');
          w.classList.toggle('is-lit', on);
        }
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
      // Card centres are measured once per refresh, so the scroll handler never reads layout.
      let centres: number[] = [];
      const measure = () => {
        const x = Number(gsap.getProperty(track, 'x')) || 0;
        centres = cards.map((c) => {
          const r = c.getBoundingClientRect();
          return r.left + r.width / 2 - x;
        });
      };
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
          scrub,
          invalidateOnRefresh: true,
          onRefresh: measure,
          onUpdate(self) {
            const x = -distance() * self.progress;
            const edge = window.innerWidth * 0.62;
            for (const [i, c] of centres.entries()) if (c + x < edge) unlock(i);
          },
        },
      });
      measure();
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

    // Tilt on pointer devices (high tier only).
    if (fine && tier === 'high') {
      for (const card of $$('[data-tilt]', track)) {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        let box: DOMRect | null = null;
        card.addEventListener('pointerenter', () => {
          box = card.getBoundingClientRect();
        });
        card.addEventListener('pointermove', (e) => {
          box ??= card.getBoundingClientRect();
          ry(((e.clientX - box.left) / box.width - 0.5) * 9);
          rx(-((e.clientY - box.top) / box.height - 0.5) * 7);
        });
        card.addEventListener('pointerleave', () => {
          box = null;
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
      onUpdate: (self) => timeline.style.setProperty('--fill', self.progress.toFixed(3)),
    });
  }

  /* ---------------------------------------------------- credo words (PRD §5.8) */
  const credo = $('[data-credo]');
  if (credo) {
    const words = $$('[data-credo-word]', credo);
    let active = -1;
    ScrollTrigger.create({
      trigger: credo,
      start: 'top 65%',
      end: 'bottom 55%',
      onUpdate(self) {
        const at = Math.min(words.length - 1, Math.floor(self.progress * words.length));
        if (at === active) return;
        active = at;
        for (const [i, w] of words.entries()) w.classList.toggle('is-active', i === at);
      },
    });
  }

  /* ------------------------ works slider: drag with the mouse (PRD §5.7) */
  const works = $('[data-slider-track]');
  if (works && fine) {
    let down = false;
    let moved = 0;
    let startX = 0;
    let startLeft = 0;
    let v = 0;
    let lastX = 0;
    let raf = 0;
    const glide = () => {
      if (Math.abs(v) < 0.4) {
        works.classList.remove('is-dragging');
        return;
      }
      works.scrollLeft -= v;
      v *= 0.94;
      raf = requestAnimationFrame(glide);
    };
    works.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = 0;
      startX = lastX = e.clientX;
      startLeft = works.scrollLeft;
      v = 0;
      cancelAnimationFrame(raf);
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) works.classList.add('is-dragging');
      works.scrollLeft = startLeft - dx;
      v = e.clientX - lastX;
      lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved > 6) raf = requestAnimationFrame(glide);
    });
    // A drag must not also count as a click on the card underneath.
    works.addEventListener(
      'click',
      (e) => {
        if (moved > 6) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
    works.addEventListener('dragstart', (e) => e.preventDefault());
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
      cx: 0,
      cy: 0,
      x: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' }),
    }));
    const measure = () => {
      for (const p of parts) {
        const r = p.el.getBoundingClientRect();
        p.cx = r.left + r.width / 2 + window.scrollX - (Number(gsap.getProperty(p.el, 'x')) || 0);
        p.cy = r.top + r.height / 2 + window.scrollY - (Number(gsap.getProperty(p.el, 'y')) || 0);
      }
    };
    headline.addEventListener('pointerenter', measure);
    headline.addEventListener('pointermove', (e) => {
      for (const p of parts) {
        const dx = e.pageX - p.cx;
        const dy = e.pageY - p.cy;
        const pull = Math.max(0, 1 - Math.hypot(dx, dy) / 460);
        p.x(-dx * 0.07 * pull);
        p.y(-dy * 0.11 * pull);
      }
    });
    headline.addEventListener('pointerleave', () => {
      for (const p of parts) {
        p.x(0);
        p.y(0);
      }
    });
  }

  /* --------------------------------------------------------- cursor + WebGL */
  if (fine && rich) {
    const id = root.lang === 'id';
    import('../lib/cursor.ts')
      .then((m) => m.initCursor({ view: id ? 'LIHAT' : 'VIEW', drag: id ? 'GESER' : 'DRAG' }))
      .catch(() => {});
  }
  if (rich && $('[data-portrait]')) {
    import('../lib/webgl/hero.ts')
      .then((m) => m.initHeroGL({ tier, velocity: scrollVelocity, ticker: gsap.ticker }))
      .catch(() => {});
  }

  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
