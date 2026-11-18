/**
 * Loading screen (PRD §5.2). Progress follows real readiness (fonts + hero portrait) with a short
 * floor so the animation always reads, then one "enter" action reveals the page. That click is also
 * the browser gesture that lets sound start, so entering = sound on (it can be muted from the nav).
 * A tap during loading starts the sound early, so the remaining letters tick in time.
 * Esc enters silently at any point; scrolling enters silently once loading is done.
 */
import { cue, finePointer, getTier, root, session } from '../lib/bus.ts';

/** sound: the visitor entered with a gesture that may start audio. */
export type GateChoice = { sound: boolean };

const MIN_MS = 2600;
const MAX_MS = 7000;
const CLOSE_MS = 1400;

type Lines = { burst: () => void; stop: () => void };

/* --------------------------------------------------------------- line art */
/** Hand-drawn-looking loops that trace themselves in as loading progresses, then burst on exit. */
function drawLines(canvas: HTMLCanvasElement, progress: () => number): Lines {
  const g = canvas.getContext('2d');
  if (!g) return { burst() {}, stop() {} };
  const small = window.innerWidth < 640;
  const count = small ? 7 : 10;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const curves = Array.from({ length: count }, (_, i) => {
    const pts: [number, number][] = [];
    const k2 = rnd(0.15, 0.4);
    const k3 = rnd(0.05, 0.22);
    const p2 = rnd(0, Math.PI * 2);
    const p3 = rnd(0, Math.PI * 2);
    const turns = Math.random() < 0.35 ? 2 : 1; // some loops go round twice, slightly offset
    const steps = 200 * turns;
    for (let s = 0; s <= steps; s++) {
      const th = (s / 200) * Math.PI * 2;
      const drift = 1 + (turns > 1 ? (s / steps) * 0.12 : 0);
      const r = (1 + k2 * Math.sin(2 * th + p2) + k3 * Math.sin(3 * th + p3)) * drift;
      pts.push([Math.cos(th) * r, Math.sin(th) * r]);
    }
    return {
      pts,
      size: rnd(0.22, 0.62),
      sx: rnd(0.7, 1.5),
      sy: rnd(0.5, 1.1),
      rot: rnd(0, Math.PI),
      spin: rnd(-0.12, 0.12),
      ox: rnd(-0.12, 0.12),
      oy: rnd(-0.1, 0.1),
      delay: (i / count) * 0.45,
      volt: i === 2 || (!small && i === 7),
    };
  });

  let w = 0;
  let h = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let burstAt = 0;
  let time = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const b = burstAt ? Math.min(1, (now - burstAt) / 900) : 0;
    const eb = b * b * (3 - 2 * b);
    time += dt * (1 + eb * 9); // the loops whirl faster as they leave
    const p = progress();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const base = Math.min(w, h) * (small ? 0.62 : 0.52);
    for (const c of curves) {
      const f = Math.max(0, Math.min(1, (p * 1.35 - c.delay) / 0.9));
      const shown = burstAt ? 1 : 1 - (1 - f) ** 3;
      if (shown <= 0.002) continue;
      const n = Math.max(2, Math.floor(c.pts.length * shown));
      const scale = base * c.size * (1 + eb * 1.4) * (1 + Math.sin(time * 0.6 + c.rot) * 0.015);
      const a = c.rot + time * c.spin;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const cx = w / 2 + c.ox * w;
      const cy = h / 2 + c.oy * h;
      g.strokeStyle = c.volt ? `rgba(212,255,63,${0.5 * (1 - eb)})` : `rgba(245,245,242,${0.16 * (1 - eb)})`;
      g.beginPath();
      for (let s = 0; s < n; s++) {
        const pt = c.pts[s];
        if (!pt) break;
        const x = pt[0] * c.sx;
        const y = pt[1] * c.sy;
        const px = cx + (x * cos - y * sin) * scale;
        const py = cy + (x * sin + y * cos) * scale;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    if (burstAt && b >= 1) return;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    burst() {
      burstAt ||= performance.now();
    },
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}

/* ------------------------------------------------------------------- gate */
export function initGate(): void {
  if (root.dataset.gate !== 'open') {
    window.dispatchEvent(new CustomEvent<GateChoice | null>('dp:gate-done', { detail: null }));
    return;
  }
  const gate = document.querySelector<HTMLElement>('[data-gate-root]');
  if (!gate) {
    root.dataset.gate = 'done';
    return;
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  for (const el of document.querySelectorAll<HTMLElement>('body > header, body > main, body > footer')) {
    el.inert = true;
    el.setAttribute('data-gate-inert', '');
  }

  const $ = <T extends HTMLElement>(sel: string) => gate.querySelector<T>(sel);
  const counter = $('[data-gate-count]');
  const bar = $('[data-gate-bar]');
  const status = $('[data-gate-status]');
  const button = $<HTMLButtonElement>('[data-gate-enter]');
  const letters = [...gate.querySelectorAll<HTMLElement>('.gate__ch')];
  const statusLines = JSON.parse(gate.dataset.lines ?? '[]') as string[];
  const rich = getTier() !== 'static';

  /* Readiness: fonts + the hero portrait, never longer than MAX_MS. */
  const started = performance.now();
  const img = document.querySelector<HTMLImageElement>('[data-portrait-img]');
  let assetsReady = false;
  Promise.race([
    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      img && !img.complete ? img.decode().catch(() => undefined) : Promise.resolve(),
    ]),
    new Promise((r) => setTimeout(r, MAX_MS)),
  ]).then(() => {
    assetsReady = true;
  });

  let shown = 0;
  let lit = 0;
  let line = 0;
  let ready = false;
  let leaving = false;
  const floor = rich ? MIN_MS : 900;
  const lines = rich && $<HTMLCanvasElement>('[data-gate-lines]');
  const art = lines ? drawLines(lines, () => shown) : null;

  let last = started;
  const tick = (now: number) => {
    if (leaving) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = Math.min(1, (now - started) / floor);
    // Time drives the count; until the assets are in, it eases towards 90% and waits there.
    const target = assetsReady ? time : Math.min(0.9, time * 0.92);
    shown += (target - shown) * (1 - Math.exp(-dt * 7));
    if (assetsReady && time >= 1 && shown > 0.995) shown = 1;

    if (counter) counter.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    bar?.style.setProperty('--p', shown.toFixed(4));
    const nextLit = Math.min(letters.length, Math.floor((shown / 0.97) * letters.length + 0.001));
    while (lit < nextLit) {
      letters[lit]?.classList.add('is-lit');
      lit++;
      cue('load_tick');
    }
    const nextLine = Math.min(statusLines.length - 1, Math.floor(shown * statusLines.length));
    if (nextLine !== line && status) {
      line = nextLine;
      status.textContent = statusLines[line] ?? '';
    }
    if (shown >= 1 && !ready) {
      ready = true;
      root.dataset.gateReady = '';
      cue('load_ready');
      if (button) {
        button.tabIndex = 0;
        button.focus({ preventScroll: true });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* Crosshair follows the pointer (desktop); a stand-in for the custom cursor during loading. */
  const cross = $('[data-gate-cross]');
  const xy = $('[data-gate-xy]');
  if (cross && rich && finePointer()) {
    let tx = window.innerWidth * 0.62;
    let ty = window.innerHeight * 0.4;
    let cx = tx;
    let cy = ty;
    const follow = () => {
      if (leaving) return;
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      cross.style.setProperty('--cx', `${cx.toFixed(1)}px`);
      cross.style.setProperty('--cy', `${cy.toFixed(1)}px`);
      if (xy)
        xy.textContent = `${String(Math.round(cx)).padStart(4, '0')} · ${String(Math.round(cy)).padStart(4, '0')}`;
      requestAnimationFrame(follow);
    };
    gate.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });
    requestAnimationFrame(follow);
  }

  /* Exit. */
  const finish = (choice: GateChoice) => {
    if (leaving) return;
    leaving = true;
    session.set('dp:gate', '1');
    for (const el of document.querySelectorAll<HTMLElement>('[data-gate-inert]')) {
      el.inert = false;
      el.removeAttribute('data-gate-inert');
    }
    for (const l of letters) l.classList.add('is-lit');
    root.dataset.gate = 'closing';
    // Dispatched synchronously so the sound layer runs inside the click/tap gesture.
    window.dispatchEvent(new CustomEvent<GateChoice>('dp:gate-done', { detail: choice }));
    art?.burst();
    window.setTimeout(
      () => {
        art?.stop();
        root.dataset.gate = 'done';
        root.removeAttribute('data-gate-ready');
        if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
        document.getElementById('main')?.focus({ preventScroll: true });
      },
      rich ? CLOSE_MS : 320,
    );
  };

  // Before the end, a tap only starts the sound (so the loading itself is heard); after, it enters.
  // `click` (not pointerdown) because it is the event every browser, iOS included, accepts as the
  // gesture that may start audio.
  let unlocked = false;
  gate.addEventListener('click', () => {
    if (ready) finish({ sound: true });
    else if (!unlocked) {
      unlocked = true;
      window.dispatchEvent(new Event('dp:gate-unlock'));
    }
  });
  gate.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') e.preventDefault(); // the button is the only stop
  });
  const scrollIntent = () => {
    if (ready) finish({ sound: unlocked });
  };
  gate.addEventListener('wheel', scrollIntent, { passive: true });
  gate.addEventListener('touchmove', scrollIntent, { passive: true });
  // Keyboard users: Esc works before the button is focusable.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.dataset.gate === 'open') finish({ sound: unlocked });
  });
}
