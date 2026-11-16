/**
 * L3 — WebGL hero portrait (PRD §5.3, §8.5). One canvas, one program, rendered on demand.
 * Adds: pointer-following volt rim light, depth parallax, film grain, scroll-velocity RGB split.
 * The <img> stays as the LCP element and as the fallback; the canvas only takes over after its first frame.
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
precision mediump float;
uniform sampler2D tMap;
uniform sampler2D tDepth;
uniform vec2 uMouse;
uniform vec2 uRes;
uniform float uTime;
uniform float uVel;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float d = texture2D(tDepth, vUv).r;
  vec2 uv = vUv + uMouse * d * 0.011 + vec2(0.0, sin(uTime * 0.7) * 0.0012 * d);

  float split = clamp(uVel, -1.0, 1.0) * 0.004;
  vec4 c = texture2D(tMap, uv);
  c.r = texture2D(tMap, uv + vec2(split, 0.0)).r;
  c.b = texture2D(tMap, uv - vec2(split, 0.0)).b;

  // The depth map is a blurred silhouette, so its gradient points inward: -gradient is the outward normal.
  float e = 0.014;
  vec2 g = vec2(
    texture2D(tDepth, uv + vec2(e, 0.0)).r - texture2D(tDepth, uv - vec2(e, 0.0)).r,
    texture2D(tDepth, uv + vec2(0.0, e)).r - texture2D(tDepth, uv - vec2(0.0, e)).r
  );
  vec2 n = -normalize(g + vec2(0.00001));
  vec2 l = normalize(uMouse * 1.4 - (uv * 2.0 - 1.0) + vec2(0.00001));
  float edge = smoothstep(0.02, 0.16, length(g)) * (1.0 - smoothstep(0.45, 0.92, d));
  float rim = pow(max(dot(n, l), 0.0), 2.0) * edge;
  c.rgb += vec3(0.83, 1.0, 0.25) * rim * 0.42 * c.a;

  float grain = hash(vUv * uRes + floor(uTime * 12.0)) - 0.5;
  c.rgb += grain * 0.045 * c.a;
  gl_FragColor = c;
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

export async function initHeroGL({ tier, velocity, ticker }: Options): Promise<void> {
  const host = document.querySelector<HTMLElement>('[data-portrait]');
  const found = host?.querySelector<HTMLImageElement>('[data-portrait-img]');
  const depthSrc = host?.dataset.depth;
  if (!host || !found || !depthSrc) return;
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

  const [mapImg, depthImg] = await Promise.all([loadImage(img.currentSrc || img.src), loadImage(depthSrc)]);
  const tMap = new Texture(gl, { image: mapImg, generateMipmaps: false, premultiplyAlpha: true });
  const tDepth = new Texture(gl, { image: depthImg, generateMipmaps: false });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: tMap },
      tDepth: { value: tDepth },
      uMouse: { value: [0, 0] },
      uRes: { value: [1, 1] },
      uTime: { value: 0 },
      uVel: { value: 0 },
    },
    transparent: true,
    depthTest: false,
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.dpr = dpr;
    renderer.setSize(w, h);
    program.uniforms.uRes.value = [w, h];
    dirty = true;
  };

  let visible = true;
  let disposed = false;
  let dirty = true;
  let lastMove = performance.now();
  let lastFrame = 0;
  let lastIdle = 0;
  let shown = false;
  const target: [number, number] = [0, 0];
  const mouse: [number, number] = [0, 0];
  let ema = 16.7;
  let slow = 0;

  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    target[0] = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5)));
    target[1] = Math.max(-1, Math.min(1, -(e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5)));
    lastMove = performance.now();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ticker.remove(frame);
    window.removeEventListener('pointermove', onMove);
    ro.disconnect();
    io.disconnect();
    img.style.visibility = '';
    canvas.remove();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  function frame() {
    if (disposed || !visible || document.hidden) return;
    const now = performance.now();
    const vel = velocity();
    const active = now - lastMove < 2000 || Math.abs(vel) > 0.05;
    // Idle "breathing" is capped at 30 fps; nothing renders at all when off-screen (PRD §8.5 rule 3).
    if (!active && !dirty && now - lastIdle < 33) return;
    lastIdle = now;
    dirty = false;

    mouse[0] += (target[0] - mouse[0]) * 0.08;
    mouse[1] += (target[1] - mouse[1]) * 0.08;
    program.uniforms.uMouse.value = mouse;
    program.uniforms.uTime.value = now / 1000;
    program.uniforms.uVel.value = vel * 0.04;
    renderer.render({ scene: mesh });

    if (!shown) {
      shown = true;
      img.style.visibility = 'hidden';
    }

    // Governor: sustained slow frames while active → lower the resolution once, then give up on WebGL.
    if (active && lastFrame) {
      ema = ema * 0.9 + (now - lastFrame) * 0.1;
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
    lastFrame = active ? now : 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    dispose();
  });
  const ro = new ResizeObserver(resize);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    dirty = true;
  });

  host.append(canvas);
  resize();
  ro.observe(host);
  io.observe(host);
  window.addEventListener('pointermove', onMove, { passive: true });
  ticker.add(frame);
}
