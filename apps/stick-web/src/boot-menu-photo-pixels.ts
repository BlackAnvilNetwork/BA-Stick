/**
 * Native-res forge — living heat haze + dense drifting embers.
 *
 * Layers (overlay-only, transparent canvas):
 *  1. Haze   — stacked layers of hot-surface motes lift off, sway, cool and fade on a
 *              slow loop. Per-mote phase => smooth fade in/out, no per-frame random.
 *              Re-rendered at ~30 Hz into a cached canvas (it's slow-moving anyway).
 *  2. Embers — tens of thousands of real particles in a struct-of-arrays pool, plotted
 *              straight into a pixel buffer every frame (no per-particle canvas calls).
 *              Wind gusts, heat-cooling color ramp, twinkle, periodic big bursts.
 *  3. Breath — slow regional swell on the haze so the lava pulses.
 *
 * Tune everything in CFG. If it chugs: lower hazeLayers, then emberRate.
 */

export type PhotoField = {
  w: number;
  h: number;
  data: Uint8ClampedArray;
};

type EmberPool = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  age: Float32Array;
  life: Float32Array;
  phase: Float32Array;
  size: Uint8Array;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
};

type ForgeCache = {
  field: PhotoField;
  s: number; // resolution scale
  // haze motes (built once)
  n: number;
  xs: Uint16Array;
  ys: Uint16Array;
  rgb: Uint8Array;
  phase: Float32Array;
  alpha: Float32Array;
  hot: Int32Array; // indices of bright motes, ember spawn points
  // smooth flow grid
  gcell: number;
  gw: number;
  gh: number;
  flow: Float32Array; // dx, dy, breath per node
  // haze render target (cached between updates)
  img: ImageData;
  off: HTMLCanvasElement;
  offCtx: CanvasRenderingContext2D;
  // ember render target (every frame)
  eimg: ImageData;
  eoff: HTMLCanvasElement;
  eoffCtx: CanvasRenderingContext2D;
  // soft 0..255 mask of hot-colored (red/orange/yellow) areas; embers only show where it's high
  mask: Uint8Array;
};

export type PixelPassState = {
  primed: boolean;
  clock: number;
  cache: ForgeCache | null;
  hazeAcc: number;
  hazeReady: boolean;
  spawnAcc: number;
  nextBurst: number;
  ep: EmberPool;
  // light swirling gusts (small local vortices that drift with the breeze)
  nextGust: number;
  gusts: Gust[];
};

type Gust = {
  x: number;
  y: number;
  age: number;
  dur: number;
  r: number; // radius, px
  spin: number; // -1 or 1
  swirl: number; // tangential speed at peak, px/s
  push: number; // sideways shove at peak, px/s
};

const PATCH = 7;
const MIN_HEAT = 0.06;

const CFG = {
  // haze
  densityWarm: 0.85,
  densityHot: 1.0,
  hazeLayers: 3, // independent mote layers on the same pixels. 1 = cheapest
  hazeHz: 30, // haze redraw rate
  alphaWarm: 0.3,
  alphaHot: 0.46,
  cycle: 8, // seconds per mote lifetime
  rise: 28, // px lifted per cycle (at ~940px tall)
  flowCell: 24,
  // embers
  emberRate: 3400, // per second at ~1920x940
  emberMax: 40000,
  emberLife: [3, 9] as [number, number],
  emberRise: [10, 36] as [number, number], // px/s at ~940px tall
  burstEvery: [1, 3] as [number, number], // seconds
  burstCount: [0, 0] as [number, number], // 0 = no bursts (they made a column of sparks)
  bigChance: 0.16, // fraction of embers drawn 2x2
  // steady light breeze
  breeze: 9, // px/s sideways drift at ~940px tall
  // slight random gusts: small vortices that make nearby embers swirl
  gustEvery: [1.2, 3.5] as [number, number], // seconds between new gusts
  gustMax: 3, // concurrent
  gustDuration: [2.2, 4.5] as [number, number],
  gustRadius: [0.06, 0.12] as [number, number], // fraction of width
  gustSwirl: [28, 58] as [number, number], // tangential px/s at peak (~940px tall)
  gustPush: [-8, 22] as [number, number], // sideways shove px/s (positive = along the breeze)
};

/* ---------- helpers ---------- */

/** Integer hash. (The old sin-hash has lattice structure that reads as a maze texture.) */
function ihash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function lum(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function isHeat(r: number, g: number, b: number): boolean {
  return r > 82 && g > 28 && b < 118 && r >= g * 0.82;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function sampleRgb(field: PhotoField, px: number, py: number): [number, number, number] {
  const x = Math.min(field.w - 1, Math.max(0, Math.round(px)));
  const y = Math.min(field.h - 1, Math.max(0, Math.round(py)));
  const i = (y * field.w + x) * 4;
  return [field.data[i], field.data[i + 1], field.data[i + 2]];
}

function neighborRadius(field: PhotoField): number {
  return Math.max(3, Math.round(field.w / 28));
}

function sampleSmoothColor(field: PhotoField, px: number, py: number): [number, number, number] {
  const r = neighborRadius(field);
  let tr = 0;
  let tg = 0;
  let tb = 0;
  let tw = 0;
  const taps: [number, number, number][] = [
    [0, 0, 0.45],
    [r, 0, 0.14],
    [-r, 0, 0.14],
    [0, r, 0.14],
    [0, -r, 0.14],
  ];
  for (const [dx, dy, w] of taps) {
    const [cr, cg, cb] = sampleRgb(field, px + dx, py + dy);
    tr += cr * w;
    tg += cg * w;
    tb += cb * w;
    tw += w;
  }
  return [tr / tw, tg / tw, tb / tw];
}

export function heatWeight(field: PhotoField, px: number, py: number): number {
  const d = neighborRadius(field);
  let h = 0;
  for (const [dx, dy] of [
    [0, 0],
    [d, 0],
    [-d, 0],
    [0, d],
    [0, -d],
  ]) {
    const [r, g, b] = sampleRgb(field, px + dx, py + dy);
    if (isHeat(r, g, b)) h += lum(r, g, b) / 255;
  }
  return h / 5;
}

function patchHeat(field: PhotoField, cx: number, cy: number): number {
  return heatWeight(field, cx * PATCH + PATCH * 0.5, cy * PATCH + PATCH * 0.5);
}

/* ---------- public setup ---------- */

function createEmberPool(max: number): EmberPool {
  return {
    n: 0,
    x: new Float32Array(max),
    y: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    age: new Float32Array(max),
    life: new Float32Array(max),
    phase: new Float32Array(max),
    size: new Uint8Array(max),
    r: new Uint8Array(max),
    g: new Uint8Array(max),
    b: new Uint8Array(max),
  };
}

export function createPixelPassState(): PixelPassState {
  return {
    primed: false,
    clock: 0,
    cache: null,
    hazeAcc: 0,
    hazeReady: false,
    spawnAcc: 0,
    nextBurst: 2,
    ep: createEmberPool(CFG.emberMax),
    nextGust: rand(1, 2.5),
    gusts: [],
  };
}

export function rasterizeNative(img: HTMLImageElement): PhotoField {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { w, h, data };
}

/* ---------- one-time analysis of the photo ---------- */

/** Separable box blur on a w*h byte plane. */
function boxBlur(src: Uint8Array, w: number, h: number, R: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const d = 2 * R + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -R; x <= R; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = (sum / d) | 0;
      sum += src[row + Math.min(w - 1, x + R + 1)] - src[row + Math.max(0, x - R)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -R; y <= R; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = (sum / d) | 0;
      sum += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x];
    }
  }
  return out;
}

/**
 * Where the photo is genuinely hot: bright, saturated red / orange / yellow.
 * Dull brown rock, smoke and pale beams are excluded. Blurred so edges fade.
 */
function buildHeatMask(
  field: PhotoField,
  rMin: number, // minimum red to count at all
  rRange: number, // red ramp width above rMin
  satMin: number, // minimum saturation
  satRange: number, // saturation ramp width
  erodeR: number, // how far the mask pulls back from cold objects, px
): Uint8Array {
  const { w, h, data } = field;
  const raw = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (r < rMin || g > r / 0.97) continue; // not red-dominant
    const sat = (r - b) / (r + 1);
    const wr = Math.min(1, (r - rMin) / rRange); // bright enough
    const ws = Math.max(0, Math.min(1, (sat - satMin) / satRange)); // saturated enough
    raw[i] = (wr * ws * 255) | 0;
  }
  // Erode first: the mask pulls back from the edge of cold objects (anvil, pillars) and
  // small hot slivers on them vanish entirely. Then a small blur for a soft boundary.
  const a = erodeR >> 1;
  const eroded = boxMin(boxMin(raw, w, h, a), w, h, erodeR - a);
  return boxBlur(eroded, w, h, Math.max(1, erodeR >> 2));
}

/** Separable min filter (erosion) on a w*h byte plane. */
function boxMin(src: Uint8Array, w: number, h: number, R: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 255;
      const x0 = Math.max(0, x - R);
      const x1 = Math.min(w - 1, x + R);
      for (let k = x0; k <= x1; k++) {
        const v = src[row + k];
        if (v < m) m = v;
        if (m === 0) break;
      }
      tmp[row + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R);
    const y1 = Math.min(h - 1, y + R);
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let k = y0; k <= y1; k++) {
        const v = tmp[k * w + x];
        if (v < m) m = v;
        if (m === 0) break;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

function buildCache(field: PhotoField): ForgeCache {
  const { w, h } = field;
  const s = Math.max(0.6, Math.min(2.2, h / 940));

  // Two hot-area masks. Both erode well away from cold objects, so neither the haze nor
  // the embers touch the anvil. Haze uses looser colors (broad warm glow), embers stricter.
  const hazeMask = buildHeatMask(field, 90, 50, 0.33, 0.2, Math.max(4, Math.round(w / 190)));
  const emberMask = buildHeatMask(field, 125, 50, 0.45, 0.15, Math.max(4, Math.round(w / 120)));

  // patch heat grid, then bilinear lookup => no block seams in density
  const pw = Math.ceil(w / PATCH);
  const ph = Math.ceil(h / PATCH);
  const heat = new Float32Array(pw * ph);
  for (let cy = 0; cy < ph; cy++) {
    for (let cx = 0; cx < pw; cx++) heat[cy * pw + cx] = patchHeat(field, cx, cy);
  }
  const hwAt = (x: number, y: number): number => {
    const fx = Math.min(pw - 1.001, Math.max(0, x / PATCH - 0.5));
    const fy = Math.min(ph - 1.001, Math.max(0, y / PATCH - 0.5));
    const ix = fx | 0;
    const iy = fy | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const a = heat[iy * pw + ix];
    const b = heat[iy * pw + ix + 1];
    const c = heat[(iy + 1) * pw + ix];
    const d = heat[(iy + 1) * pw + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  };

  const xs: number[] = [];
  const ys: number[] = [];
  const rgb: number[] = [];
  const phase: number[] = [];
  const alpha: number[] = [];
  const hot: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hw = hwAt(x, y);
      if (hw < MIN_HEAT) continue;
      const hm = hazeMask[y * w + x];
      if (hm < 50) continue; // cold area (anvil, pillars, dark rock): no haze
      const fade = Math.min(1, (hm - 50) / 80); // soft edge
      const k = smooth01((hw - 0.12) / 0.22);
      const dens = lerp(CFG.densityWarm, CFG.densityHot, k);
      let col: [number, number, number] | null = null;
      for (let L = 0; L < CFG.hazeLayers; L++) {
        if (ihash(x, y, 1 + L * 7) > dens) continue;
        if (!col) {
          col = sampleSmoothColor(field, x + 0.5, y + 0.5);
          if (!isHeat(col[0], col[1], col[2])) break;
        }
        const idx = xs.length;
        xs.push(x);
        ys.push(y);
        rgb.push(col[0], col[1], col[2]);
        phase.push(ihash(x, y, 2 + L * 7));
        alpha.push(lerp(CFG.alphaWarm, CFG.alphaHot, k) * fade);
        if (L === 0 && hw > 0.28 && lum(col[0], col[1], col[2]) > 150) hot.push(idx);
      }
    }
  }

  const n = xs.length;
  if (hot.length === 0) for (let i = 0; i < n; i += 7) hot.push(i);

  const gcell = Math.max(8, Math.round(CFG.flowCell * s));
  const gw = Math.ceil(w / gcell) + 2;
  const gh = Math.ceil(h / gcell) + 2;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d");
  if (!offCtx) throw new Error("2d context unavailable");

  const eoff = document.createElement("canvas");
  eoff.width = w;
  eoff.height = h;
  const eoffCtx = eoff.getContext("2d");
  if (!eoffCtx) throw new Error("2d context unavailable");

  return {
    field,
    s,
    n,
    xs: Uint16Array.from(xs),
    ys: Uint16Array.from(ys),
    rgb: Uint8Array.from(rgb),
    phase: Float32Array.from(phase),
    alpha: Float32Array.from(alpha),
    hot: Int32Array.from(hot),
    gcell,
    gw,
    gh,
    flow: new Float32Array(gw * gh * 3),
    img: offCtx.createImageData(w, h),
    off,
    offCtx,
    eimg: eoffCtx.createImageData(w, h),
    eoff,
    eoffCtx,
    mask: emberMask,
  };
}

/* ---------- flow field (continuous in space and time) ---------- */

function updateFlow(c: ForgeCache, t: number): void {
  const { gw, gh, flow, s } = c;
  let k = 0;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      flow[k++] = (Math.sin(t * 0.55 + gx * 0.33 + gy * 0.19) * 1.5 + Math.sin(t * 0.31 - gy * 0.27 + 1.7)) * s;
      flow[k++] = Math.cos(t * 0.47 + gx * 0.23 - gy * 0.37) * 0.8 * s;
      // breath: regional swell
      flow[k++] = 0.92 + 0.08 * Math.sin(t * 0.6 + gx * 0.29 + gy * 0.43) + 0.04 * Math.sin(t * 0.23 - gx * 0.17);
    }
  }
}

/* ---------- layer 1: haze (cached canvas) ---------- */

function renderHaze(c: ForgeCache, t: number): void {
  const { w, h } = c.field;
  const data = c.img.data;
  data.fill(0);

  const { flow, gw, gcell, xs, ys, rgb, phase, alpha } = c;
  const inv = 1 / CFG.cycle;
  const R = CFG.rise * c.s;
  const invCell = 1 / gcell;
  const stride = gw * 3;

  for (let i = 0; i < c.n; i++) {
    let u = t * inv + phase[i];
    u -= Math.floor(u);
    const e = 1 - Math.abs(2 * u - 1);
    const env = e * e * (3 - 2 * e); // smooth in, smooth out
    if (env < 0.02) continue;

    const x = xs[i];
    const y = ys[i];
    const fx = x * invCell;
    const fy = y * invCell;
    const gx = fx | 0;
    const gy = fy | 0;
    const tx = fx - gx;
    const ty = fy - gy;
    const k00 = gy * stride + gx * 3;
    const k10 = k00 + 3;
    const k01 = k00 + stride;
    const k11 = k01 + 3;
    const w00 = (1 - tx) * (1 - ty);
    const w10 = tx * (1 - ty);
    const w01 = (1 - tx) * ty;
    const w11 = tx * ty;
    const dx = flow[k00] * w00 + flow[k10] * w10 + flow[k01] * w01 + flow[k11] * w11;
    const dy = flow[k00 + 1] * w00 + flow[k10 + 1] * w10 + flow[k01 + 1] * w01 + flow[k11 + 1] * w11;
    const br = flow[k00 + 2] * w00 + flow[k10 + 2] * w10 + flow[k01 + 2] * w01 + flow[k11 + 2] * w11;

    const px = Math.round(x + dx * (0.35 + u));
    const py = Math.round(y - u * R + dy * 0.6);
    if (px < 0 || py < 0 || px >= w || py >= h) continue;

    const A = (env * alpha[i] * br * 255) | 0;
    if (A < 4) continue;
    const o = (py * w + px) * 4;
    const j = i * 3;
    const cr = rgb[j] * (1.1 - 0.16 * u); // cools as it climbs
    const cg = rgb[j + 1] * (1.06 - 0.3 * u);
    const cb = rgb[j + 2] * (1 - 0.5 * u);
    const a0 = data[o + 3];
    if (a0 === 0) {
      data[o] = cr;
      data[o + 1] = cg;
      data[o + 2] = cb;
      data[o + 3] = A;
    } else {
      // stacked layers accumulate alpha, keep the brighter color
      const na = a0 + A * 0.75;
      data[o + 3] = na > 255 ? 255 : na;
      if (cr > data[o]) data[o] = cr;
      if (cg > data[o + 1]) data[o + 1] = cg;
      if (cb > data[o + 2]) data[o + 2] = cb;
    }
  }

  c.offCtx.putImageData(c.img, 0, 0);
}

/* ---------- layer 2: embers (struct-of-arrays, plotted into a pixel buffer) ---------- */

function plot(
  ed: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  A: number,
): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const o = (y * w + x) * 4;
  const a0 = ed[o + 3];
  const na = a0 + A;
  ed[o + 3] = na > 255 ? 255 : na;
  if (r > ed[o]) ed[o] = r;
  if (g > ed[o + 1]) ed[o + 1] = g;
  if (b > ed[o + 2]) ed[o + 2] = b;
}

function removeEmber(P: EmberPool, i: number): void {
  const l = P.n - 1;
  if (i !== l) {
    P.x[i] = P.x[l];
    P.y[i] = P.y[l];
    P.vx[i] = P.vx[l];
    P.vy[i] = P.vy[l];
    P.age[i] = P.age[l];
    P.life[i] = P.life[l];
    P.phase[i] = P.phase[l];
    P.size[i] = P.size[l];
    P.r[i] = P.r[l];
    P.g[i] = P.g[l];
    P.b[i] = P.b[l];
  }
  P.n = l;
}

function spawnEmber(c: ForgeCache, P: EmberPool, burst: boolean, cx?: number, cy?: number): void {
  if (P.n >= CFG.emberMax || c.n === 0) return;
  const s = c.s;
  let x: number;
  let y: number;
  let r: number;
  let g: number;
  let b: number;
  if (cx === undefined || cy === undefined) {
    // uniform over every haze mote, not just the brightest spots, so no single column forms
    // (a few retries to land on a mote that's actually in a hot area)
    let i = (Math.random() * c.n) | 0;
    for (let tries = 0; tries < 6 && c.mask[c.ys[i] * c.field.w + c.xs[i]] < 180; tries++) {
      i = (Math.random() * c.n) | 0;
    }
    x = c.xs[i] + rand(-2, 2);
    y = c.ys[i];
    r = c.rgb[i * 3];
    g = c.rgb[i * 3 + 1];
    b = c.rgb[i * 3 + 2];
  } else {
    x = cx + rand(-1, 1) * 34 * s;
    y = cy + rand(-1, 1) * 18 * s;
    r = 255;
    g = 190;
    b = 90;
  }
  const k = P.n++;
  P.x[k] = x;
  P.y[k] = y;
  P.vx[k] = rand(-3, 3) * s;
  P.vy[k] = -rand(CFG.emberRise[0], CFG.emberRise[1]) * s * (burst ? 1.35 : 1);
  P.age[k] = 0;
  P.life[k] = rand(CFG.emberLife[0], CFG.emberLife[1]);
  P.phase[k] = rand(0, 6.283);
  P.size[k] = Math.random() < CFG.bigChance ? 2 : 1;
  // start near white-gold, tinted by the source pixel
  P.r[k] = lerp(r, 255, 0.55);
  P.g[k] = lerp(g, 236, 0.55);
  P.b[k] = lerp(b, 176, 0.55);
}

function stepEmbers(c: ForgeCache, state: PixelPassState, dt: number): void {
  const { w, h } = c.field;
  const s = c.s;
  const t = state.clock;
  const P = state.ep;

  // steady stream + frequent bursts
  const areaScale = Math.max(0.5, Math.min(2.5, (w * h) / (1920 * 940)));
  state.spawnAcc += dt * CFG.emberRate * areaScale;
  while (state.spawnAcc >= 1) {
    state.spawnAcc -= 1;
    spawnEmber(c, P, false);
  }
  if (CFG.burstCount[1] > 0 && t >= state.nextBurst) {
    state.nextBurst = t + rand(CFG.burstEvery[0], CFG.burstEvery[1]);
    const i = c.hot[(Math.random() * c.hot.length) | 0];
    const count = Math.round(rand(CFG.burstCount[0], CFG.burstCount[1]));
    for (let k = 0; k < count; k++) spawnEmber(c, P, true, c.xs[i], c.ys[i]);
  }

  // steady light breeze: slow swell, slightly different from place to place
  const wind = CFG.breeze * s * (1 + Math.sin(t * 0.23) * 0.4 + Math.sin(t * 0.071 + 1.3) * 0.25);
  const steer = Math.min(1, dt * 1.2);
  const drag = 1 - 0.12 * dt;

  // gusts: spawn small vortices now and then, let them drift with the breeze and fade
  const gusts = state.gusts;
  if (t >= state.nextGust) {
    state.nextGust = t + rand(CFG.gustEvery[0], CFG.gustEvery[1]);
    if (gusts.length < CFG.gustMax) {
      gusts.push({
        x: rand(0.08, 0.92) * w,
        y: rand(0.25, 0.95) * h,
        age: 0,
        dur: rand(CFG.gustDuration[0], CFG.gustDuration[1]),
        r: rand(CFG.gustRadius[0], CFG.gustRadius[1]) * w,
        spin: Math.random() < 0.5 ? -1 : 1,
        swirl: rand(CFG.gustSwirl[0], CFG.gustSwirl[1]) * s,
        push: rand(CFG.gustPush[0], CFG.gustPush[1]) * s,
      });
    }
  }
  for (let gi = gusts.length - 1; gi >= 0; gi--) {
    const g = gusts[gi];
    g.age += dt;
    if (g.age >= g.dur) {
      gusts.splice(gi, 1);
      continue;
    }
    g.x += (wind + g.push * 0.3) * dt; // gusts ride the breeze
  }
  const steerGust = Math.min(1, dt * 2.2);
  const minRise = 7 * s; // px/s floor on the base rise

  const ed = c.eimg.data;
  ed.fill(0);

  for (let i = 0; i < P.n; ) {
    const age = P.age[i] + dt;
    const p = age / P.life[i];
    if (p >= 1) {
      removeEmber(P, i);
      continue;
    }
    P.age[i] = age;

    const phase = P.phase[i];
    let vx = P.vx[i];
    // base rise: slows a little with drag but never stalls
    let vyBase = P.vy[i] * drag;
    if (vyBase > -minRise) vyBase = -minRise;
    let swy = 0; // swirl's vertical offset this frame (not stored, so it can't accumulate)
    const ex = P.x[i];
    const ey = P.y[i];
    for (let gi = 0; gi < gusts.length; gi++) {
      const g = gusts[gi];
      const dx = ex - g.x;
      const dy = ey - g.y;
      const inv = 1 / g.r;
      const fall = Math.exp(-(dx * dx + dy * dy) * inv * inv);
      if (fall < 0.02) continue;
      const wgt = fall * Math.sin((Math.PI * g.age) / g.dur); // eases in and out
      // tangential flow around the gust center = swirl, plus a light shove
      const tx = -dy * inv * g.spin * g.swirl + g.push;
      const ty = dx * inv * g.spin * g.swirl;
      vx += (tx - vx) * steerGust * wgt;
      swy += ty * wgt * 0.6;
    }
    // swirl can speed the rise or slow it, but never reverse it: always at least 30% of base rise
    let vy = vyBase + swy;
    const vyCap = vyBase * 0.3;
    if (vy > vyCap) vy = vyCap;
    // gentle spatial variation in the breeze so it doesn't move as one sheet
    const local = wind + Math.sin(ex * 0.006 + t * 0.35) * 3 * s;
    vx += (local + Math.sin(age * 1.7 + phase) * 5 * s - vx) * steer;
    P.vx[i] = vx;
    P.vy[i] = vyBase;
    const x = P.x[i] + vx * dt;
    const y = P.y[i] + vy * dt;
    if (y < -4 || x < -4 || x > w + 4 || y > h + 4) {
      removeEmber(P, i);
      continue;
    }
    P.x[i] = x;
    P.y[i] = y;

    // heat ramp: white-gold -> orange -> dark red
    let r: number;
    let g: number;
    let b: number;
    if (p < 0.35) {
      const k = p / 0.35;
      r = lerp(P.r[i], 255, k);
      g = lerp(P.g[i], 150, k);
      b = lerp(P.b[i], 45, k);
    } else {
      const k = (p - 0.35) / 0.65;
      r = lerp(255, 150, k);
      g = lerp(150, 38, k);
      b = lerp(45, 18, k);
    }

    const fadeIn = age < 0.35 ? age / 0.35 : 1;
    const fo = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1;
    const a = 0.9 * fadeIn * fo * fo * (0.88 + 0.12 * Math.sin(age * 7 + phase));
    if (a < 0.02) {
      i++;
      continue;
    }

    const px = Math.round(x);
    const py = Math.round(y);
    // embers only show over hot-colored parts of the image; they fade out smoothly at its edges
    const m = c.mask[Math.min(h - 1, Math.max(0, py)) * w + Math.min(w - 1, Math.max(0, px))];
    const gate = (m - 110) * (1 / 60); // hard-ish cutoff: nothing shows over cold areas
    if (gate <= 0) {
      i++;
      continue;
    }
    const A = (a * 255 * (gate > 1 ? 1 : gate)) | 0;
    // one-dot trail behind the motion
    plot(ed, w, h, Math.round(x - vx * 0.05), Math.round(y - vy * 0.05), r, g, b, (A * 0.35) | 0);
    // head
    plot(ed, w, h, px, py, r, g, b, A);
    if (P.size[i] > 1) {
      plot(ed, w, h, px + 1, py, r, g, b, A);
      plot(ed, w, h, px, py + 1, r, g, b, A);
      plot(ed, w, h, px + 1, py + 1, r, g, b, A);
      // faint glow around the big ones
      const gl = (A * 0.14) | 0;
      plot(ed, w, h, px - 1, py, r, g, b, gl);
      plot(ed, w, h, px + 2, py, r, g, b, gl);
      plot(ed, w, h, px, py - 1, r, g, b, gl);
      plot(ed, w, h, px, py + 2, r, g, b, gl);
    }
    i++;
  }

  c.eoffCtx.putImageData(c.eimg, 0, 0);
}

/* ---------- entry point (same signature as before) ---------- */

/**
 * `t` is ignored; the pass keeps its own clock from `dt`, so tab switches and
 * long frames can't make motion jump. `dt` may be seconds or milliseconds.
 */
export function paintContentAwarePixels(
  ctx: CanvasRenderingContext2D,
  field: PhotoField,
  _t: number,
  dt: number,
  state: PixelPassState,
): void {
  let d = dt > 1 ? dt / 1000 : dt;
  if (!(d > 0)) d = 1 / 60;
  d = Math.min(d, 0.05);

  if (!state.cache || state.cache.field !== field) {
    state.cache = buildCache(field);
    state.ep.n = 0;
    state.spawnAcc = 0;
    state.hazeReady = false;
  }
  state.primed = true;
  state.clock += d;
  state.hazeAcc += d;

  const c = state.cache;
  ctx.imageSmoothingEnabled = false;

  if (!state.hazeReady || state.hazeAcc >= 1 / CFG.hazeHz) {
    state.hazeAcc = 0;
    state.hazeReady = true;
    updateFlow(c, state.clock);
    renderHaze(c, state.clock);
  }
  stepEmbers(c, state, d);

  ctx.clearRect(0, 0, field.w, field.h);
  ctx.drawImage(c.off, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c.eoff, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}