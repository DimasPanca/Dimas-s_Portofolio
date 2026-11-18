/**
 * L3 — WebGL hero portrait (PRD §5.3, §8.5). One canvas, one program.
 *
 * Lighting model (kept deliberately simple so it behaves the same everywhere on the outline):
 *  - an edge map gives, per pixel, the signed distance to the silhouette and the outward normal;
 *  - a single point light lives in the portrait's own coordinate space. It follows the cursor while the
 *    pointer is over the hero and otherwise drifts on a slow orbit, so the rim never switches off;
 *  - rim = uniform-width band along the outline × wrapped N·L × smooth distance falloff, plus a soft
 *    spill of the same light just outside the silhouette and a very light relight of the figure.
 * Every input is eased with frame-rate-independent smoothing, so nothing pops.
 *
 * The <img> stays as the LCP element and as the fallback; the canvas takes over after its first frame.
 */
import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { setTier, type Tier } from '../bus.ts';

type Ticker = { add: (fn: () => void) => void; remove: (fn: () => void) => void };
type Options = { tier: Tier; velocity: () => number; ticker: Ticker };

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform sampler2D tEdge;
uniform vec2 uLight;      // light position in portrait uv space (y up); may lie outside 0..1
uniform vec2 uParallax;   // eased pointer offset, -1..1
uniform vec2 uRes;
uniform float uAspect;    // plane width / height
uniform float uPower;     // 0.45 idle orbit .. 1.0 pointer engaged
uniform float uTime;
uniform float uVel;
varying vec2 vUv;

const vec3 VOLT = vec3(0.83, 1.0, 0.25);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Parallax is weighted by distance from the outline, so the silhouette itself stays put.
  float inner = smoothstep(0.5, 1.0, texture2D(tEdge, vUv).b);
  vec2 uv = vUv + uParallax * inner * 0.010 + vec2(0.0, sin(uTime * 0.6) * 0.0010 * inner);

  float split = clamp(uVel, -1.0, 1.0) * 0.0035;
  vec4 c = texture2D(tMap, uv);
  c.r = texture2D(tMap, uv + vec2(split, 0.0)).r;
  c.b = texture2D(tMap, uv - vec2(split, 0.0)).b;

  vec4 e = texture2D(tEdge, uv);
  float sd = (e.b - 0.5) * 2.0;                                  // -1 outside .. 0 edge .. +1 inside
  vec2 n = normalize(vec2(e.r - 0.5, 0.5 - e.g) + vec2(1e-4));   // outward normal in uv space

  vec2 toLight = (uLight - uv) * vec2(uAspect, 1.0);
  float dist = length(toLight);
  vec2 l = toLight / max(dist, 1e-3);
  float facing = smoothstep(-0.25, 0.9, dot(n, l));              // wrapped: no hard terminator
  float falloff = 1.0 / (1.0 + dist * dist * 2.6);               // smooth, never reaches zero

  // Rim: a band of constant width along the whole outline.
  float band = 1.0 - smoothstep(0.0, 0.34, sd);
  band *= band;
  float rim = band * facing * (0.25 + 0.75 * falloff) * uPower;
  c.rgb += VOLT * rim * 0.62 * c.a;

  // A gentle relight of the figure on the lit side (keeps the edge light from looking pasted on).
  c.rgb *= 1.0 + 0.10 * falloff * uPower * facing;

  float grain = hash(vUv * uRes + floor(uTime * 12.0)) - 0.5;
  c.rgb += grain * 0.04 * c.a;

  // Light spill just outside the silhouette (premultiplied, additive).
  float halo = smoothstep(-0.62, 0.0, sd) * (1.0 - c.a) * facing * falloff * uPower;
  halo *= halo;
  vec4 outColor = c + vec4(VOLT * halo * 0.5, halo * 0.5);
  gl_FragColor = min(outColor, vec4(1.0));
}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Exponential smoothing that behaves the same at 30, 60 or 144 fps. */
const ease = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export async function initHeroGL({ tier, velocity, ticker }: Options): Promise<void> {
  const host = document.querySelector<HTMLElement>('[data-portrait]');
  const found = host?.querySelector<HTMLImageElement>('[data-portrait-img]');
  const edgeSrc = host?.dataset.edge;
  const zone = document.querySelector<HTMLElement>('[data-hero]');
  if (!host || !found || !edgeSrc || !zone) return;
  const img: HTMLImageElement = found;
  if (!img.complete) await img.decode().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let dpr = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.5 : 1.25);
  let renderer: Renderer;
  try {
    renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      dpr,
      depth: false,
      powerPreference: 'low-power',
    });
  } catch {
    return; // WebGL unavailable: the <img> simply stays
  }
  const gl = renderer.gl;

  const [mapImg, edgeImg] = await Promise.all([loadImage(img.currentSrc || img.src), loadImage(edgeSrc)]);
  const tMap = new Texture(gl, { image: mapImg, generateMipmaps: false, premultiplyAlpha: true });
  const tEdge = new Texture(gl, { image: edgeImg, generateMipmaps: false });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: tMap },
      tEdge: { value: tEdge },
      uLight: { value: [1.2, 0.8] },
      uParallax: { value: [0, 0] },
      uRes: { value: [1, 1] },
      uAspect: { value: 0.8 },
      uPower: { value: 0.45 },
      uTime: { value: 0 },
      uVel: { value: 0 },
    },
    transparent: true,
    depthTest: false,
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  let rect = host.getBoundingClientRect();
  const measure = () => {
    rect = host.getBoundingClientRect();
  };
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.dpr = dpr;
    renderer.setSize(w, h);
    program.uniforms.uRes.value = [w, h];
    program.uniforms.uAspect.value = w / h;
    measure();
  };

  let visible = true;
  let disposed = false;
  let shown = false;
  let engaged = false; // pointer is over the hero
  let px = 0;
  let py = 0;
  const light: [number, number] = [1.2, 0.8];
  const parallax: [number, number] = [0, 0];
  let power = 0.45;
  let last = performance.now();
  let lastRender = 0;
  let lastScrollY = window.scrollY;
  let ema = 16.7;
  let slow = 0;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX;
    py = e.clientY;
    const z = zone.getBoundingClientRect();
    engaged = py >= z.top && py <= z.bottom && px >= z.left && px <= z.right;
  };
  const onLeave = () => {
    engaged = false;
  };
  // Touch: the rim light follows the finger while it is on the hero (also while scrolling), then
  // drifts back to its orbit when the finger lifts.
  const onTouch = (e: TouchEvent) => {
    const p = e.touches[0];
    if (!p) return;
    px = p.clientX;
    py = p.clientY;
    const z = zone.getBoundingClientRect();
    engaged = py >= z.top && py <= z.bottom;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ticker.remove(frame);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('touchstart', onTouch);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('touchend', onLeave);
    window.removeEventListener('touchcancel', onLeave);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    ro.disconnect();
    io.disconnect();
    img.style.visibility = '';
    canvas.remove();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  function frame() {
    if (disposed || !visible || document.hidden) {
      last = performance.now();
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const vel = velocity();
    if (window.scrollY !== lastScrollY) {
      lastScrollY = window.scrollY;
      measure();
    }

    // Idle: the light drifts on a slow orbit around the head and shoulders.
    const t = now / 1000;
    let tx = 0.5 + Math.cos(t * 0.32) * 0.85;
    let ty = 0.66 + Math.sin(t * 0.32) * 0.42;
    let tParX = 0;
    let tParY = 0;
    if (engaged) {
      tx = (px - rect.left) / rect.width;
      ty = 1 - (py - rect.top) / rect.height;
      tParX = Math.max(-1, Math.min(1, (px - (rect.left + rect.width / 2)) / (window.innerWidth * 0.5)));
      tParY = Math.max(-1, Math.min(1, -(py - (rect.top + rect.height / 2)) / (window.innerHeight * 0.5)));
    }
    light[0] = ease(light[0], tx, engaged ? 7 : 1.6, dt);
    light[1] = ease(light[1], ty, engaged ? 7 : 1.6, dt);
    parallax[0] = ease(parallax[0], tParX, 4, dt);
    parallax[1] = ease(parallax[1], tParY, 4, dt);
    power = ease(power, engaged ? 1 : 0.45, 2.5, dt);

    // Engaged or scrolling → every frame; idle drift → 30 fps is plenty.
    const active = engaged || Math.abs(vel) > 0.05 || Math.abs(power - 0.45) > 0.01;
    if (!active && now - lastRender < 33) return;
    const frameMs = now - lastRender;
    lastRender = now;

    program.uniforms.uLight.value = light;
    program.uniforms.uParallax.value = parallax;
    program.uniforms.uPower.value = power;
    program.uniforms.uTime.value = t;
    program.uniforms.uVel.value = vel * 0.04;
    renderer.render({ scene: mesh });

    if (!shown) {
      shown = true;
      img.style.visibility = 'hidden';
    }

    // Governor: sustained slow frames while active → lower the resolution once, then give up on WebGL.
    if (active && frameMs < 200) {
      ema = ema * 0.9 + frameMs * 0.1;
      slow = ema > 22 ? slow + 1 : 0;
      if (slow >= 45) {
        slow = 0;
        ema = 16.7;
        if (dpr > 1) {
          dpr = 1;
          resize();
        } else {
          dispose();
          setTier('low');
        }
      }
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    dispose();
  });
  const ro = new ResizeObserver(resize);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });

  host.append(canvas);
  resize();
  ro.observe(host);
  io.observe(host);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', onLeave, { passive: true });
  window.addEventListener('touchcancel', onLeave, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  ticker.add(frame);
}
