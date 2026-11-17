/**
 * Custom cursor (PRD FR-CURSOR), desktop pointers only.
 *  - a dot that sits exactly under the pointer (no lag, so it never feels imprecise);
 *  - a ring that trails with inertia and stretches in the direction of travel;
 *  - on buttons the ring snaps around the control and the control leans toward the pointer (magnetic);
 *  - over cards it grows into a labelled disc ("VIEW" / "DRAG"); over the portrait it becomes a light;
 *  - a ripple on every click.
 * One ticker callback, transforms only, frame-rate-independent easing.
 */
import { gsap } from 'gsap';

const SNAP = '.btn, .nav__menu, .nav__sound, .works__arrow, .totop, .menu__close, [data-filter], [data-cursor="snap"]';
const LINK = 'a, button, summary, label, [role="button"]';
const ease = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

type Magnet = { el: HTMLElement; x: (v: number) => void; y: (v: number) => void };

export function initCursor(labels: Record<string, string>): void {
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i class="cursor__ring"><b class="cursor__label"></b></i><i class="cursor__dot"></i>';
  document.body.append(cursor);
  const ring = cursor.querySelector<HTMLElement>('.cursor__ring')!;
  const dot = cursor.querySelector<HTMLElement>('.cursor__dot')!;
  const label = cursor.querySelector<HTMLElement>('.cursor__label')!;

  let px = -100;
  let py = -100;
  let rx = -100;
  let ry = -100;
  let w = 36;
  let h = 36;
  let radius = 18;
  let stretch = 0;
  let angle = 0;
  let state = '';
  let snapEl: HTMLElement | null = null;
  let magnet: Magnet | null = null;
  let seen = false;
  let last = performance.now();

  const sizes: Record<string, number> = { '': 36, link: 54, view: 88, drag: 88, light: 72, text: 4 };

  const release = () => {
    if (!magnet) return;
    gsap.to(magnet.el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)', overwrite: true });
    magnet = null;
  };

  const setState = (next: string, text = '') => {
    if (state === next) return;
    state = next;
    cursor.dataset.state = next;
    label.textContent = text;
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!seen) {
        seen = true;
        rx = px;
        ry = py;
        cursor.classList.add('is-on');
        document.documentElement.dataset.cursor = 'on';
      }
      evaluate(e.target as HTMLElement);
    },
    { passive: true },
  );

  /** Decide the cursor state from whatever is under the pointer. */
  function evaluate(target: HTMLElement | null) {
    if (!target?.closest) return;
    const snap = target.closest<HTMLElement>(SNAP);
    if (snap !== snapEl) {
      release();
      snapEl = snap;
      if (snap) {
        magnet = {
          el: snap,
          x: gsap.quickTo(snap, 'x', { duration: 0.35, ease: 'power3.out' }),
          y: gsap.quickTo(snap, 'y', { duration: 0.35, ease: 'power3.out' }),
        };
      }
    }
    if (snap) return setState('snap');
    if (target.closest('input, textarea, select')) return setState('text');
    const kind = target.closest<HTMLElement>('[data-cursor]')?.dataset.cursor;
    const onLink = Boolean(target.closest(LINK));
    // The portrait light is a zone, not a control: links inside it keep the link state.
    if (kind && kind !== 'snap' && !(kind === 'light' && onLink)) return setState(kind, labels[kind] ?? '');
    if (onLink) return setState('link');
    setState('');
  }

  // Scrolling moves the page under a still pointer: re-check on the next frame so nothing stays 'stuck'.
  let scrolled = false;
  window.addEventListener(
    'scroll',
    () => {
      scrolled = true;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    cursor.classList.remove('is-on');
    seen = false;
    release();
    snapEl = null;
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    cursor.classList.add('is-down');
    const ripple = document.createElement('i');
    ripple.className = 'cursor__ripple';
    ripple.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    cursor.append(ripple);
    ripple
      .animate(
        [
          { opacity: 0.7, scale: 0.3 },
          { opacity: 0, scale: 2.6 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
      .finished.finally(() => ripple.remove());
  });
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));

  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!seen) return;
    if (scrolled) {
      scrolled = false;
      evaluate(document.elementFromPoint(px, py) as HTMLElement | null);
    }

    let tx = px;
    let ty = py;
    let tw = sizes[state] ?? 36;
    let th = tw;
    let tr = tw / 2;
    if (snapEl && magnet) {
      // Wrap the control and let it lean toward the pointer.
      const r = snapEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      magnet.x((px - cx) * 0.22);
      magnet.y((py - cy) * 0.3);
      tx = cx;
      ty = cy;
      tw = r.width + 12;
      th = r.height + 12;
      tr = Math.min(Number.parseFloat(getComputedStyle(snapEl).borderRadius) || 12, r.height / 2) + 6;
    }

    const prevX = rx;
    const prevY = ry;
    const follow = snapEl ? 16 : 13;
    rx = ease(rx, tx, follow, dt);
    ry = ease(ry, ty, follow, dt);
    w = ease(w, tw, 14, dt);
    h = ease(h, th, 14, dt);
    radius = ease(radius, tr, 14, dt);

    // Stretch along the direction of travel (only for the free ring).
    const vx = (rx - prevX) / Math.max(dt, 0.001);
    const vy = (ry - prevY) / Math.max(dt, 0.001);
    const speed = Math.hypot(vx, vy);
    const free = state === '' || state === 'link';
    stretch = ease(stretch, free ? Math.min(0.38, speed / 2600) : 0, 12, dt);
    if (speed > 40) angle = Math.atan2(vy, vx);

    dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    ring.style.width = `${w.toFixed(1)}px`;
    ring.style.height = `${h.toFixed(1)}px`;
    ring.style.borderRadius = `${radius.toFixed(1)}px`;
    ring.style.transform = `translate3d(${(rx - w / 2).toFixed(1)}px, ${(ry - h / 2).toFixed(1)}px, 0) rotate(${(free ? angle : 0).toFixed(3)}rad) scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.5).toFixed(3)})`;
    // Labels must stay upright while the ring rotates.
    label.style.transform = `rotate(${(free ? -angle : 0).toFixed(3)}rad)`;
  });
}
