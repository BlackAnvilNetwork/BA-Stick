/**
 * Procedural worldgen (dev/build pipeline only). Usage:
 *   tsx scripts/worldgen/generate.ts pale_hollow [--out <dir>]
 * Stages: landforms -> erosion -> gameplay constraints -> hydrology -> climate -> biomes
 *         -> vegetation/rocks -> civilization (roads, farms, ruin hooks) -> bake BAZ1/BAP1.
 * Output goes to public/zones/<id>_gen.{baz,bap}: the legacy <id>.baz is never touched.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PALE_HOLLOW_BOUNDS, paleHollowBridgeDeckY, paleHollowGroundHeight, paleHollowInOpenWater,
  paleHollowOnBridge, paleHollowStandHeight, paleHollowLakeDist, paleHollowRiverCenterX, paleHollowTributaryCenterX, paleHollowWalkable, paleHollowWaterSurfaceY,
  MAYFLOWER_BBOX, MAYFLOWER_SCREEN,
} from "@bellgrave/config";
// PH_LAKE is not re-exported by the package index; read it from source (read-only).
import { PH_LAKE } from "../../../../packages/config/src/pale-hollow";
import { WORLD_POIS } from "../../../../packages/config/src/world-pois";
import { encodeProps, paleHollowProps, K, type Prop } from "../bake-props";
import { BIOMES } from "../bake-zones";
import { Noise2, hashSeed, mulberry32 } from "./noise";
import { MinHeap, accumulate, astar, d8Receivers, distanceTo, priorityFill } from "./grid";
import { paleHollowAnchors, padWeight } from "./anchors-pale-hollow";

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync(resolve(HERE, "regions.json"), "utf8"));
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const B = (n: (typeof BIOMES)[number]) => BIOMES.indexOf(n);

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const cx = ax + t * dx, cz = az + t * dz;
  const side = Math.sign(dx * (pz - az) - dz * (px - ax));
  return { d: Math.hypot(px - cx, pz - cz), t, side, len: Math.sqrt(l2) };
}

/** Whittaker (1975) biome class for the temperate-to-boreal band, from mean annual temperature (C) and precipitation (mm). */
export function whittaker(T: number, P: number): string {
  if (T < -2) return "tundra"; if (T < 4) return P > 300 ? "boreal" : "tundra";
  if (P < 250) return "desert-shrub"; if (P < 550) return T > 14 && P < 400 ? "desert-shrub" : "grassland";
  if (P < 850) return "woodland"; if (P < 1600) return "temperate-forest"; return "temperate-rainforest";
}

export function generatePaleHollow() {
  const R = CFG.regions.pale_hollow; const seed = R.seed >>> 0;
  const nz = new Noise2(hashSeed(seed, "landform")), nw = new Noise2(hashSeed(seed, "warp")), nr = new Noise2(hashSeed(seed, "ridge"));
  const { minX, maxX, minZ, maxZ } = PALE_HOLLOW_BOUNDS; const cell = R.cell;
  const W = Math.round((maxX - minX) / cell) + 1, H = Math.round((maxZ - minZ) / cell) + 1, N = W * H;
  const X = (k: number) => minX + (k % W) * cell, Z = (k: number) => minZ + ((k / W) | 0) * cell;
  const A = paleHollowAnchors();
  const bw = Object.fromEntries(A.bridges.map((b) => [b.river, b]));

  // ---- River profiles (water surface, monotone downstream). Fixed exactly at bridge decks' waterY.
  // Endorheic basin: both rivers rise on the Southern Scarp and end in the Ash Pit lake (no outlet).
  const LAKE_Y = paleHollowWaterSurfaceY(PH_LAKE.x, PH_LAKE.z)!;
  const pw = (pts: [number, number][], z: number) => {
    if (z <= pts[0]![0]) return pts[0]![1] + (pts[0]![0] - z) * 0.045;
    for (let i = 1; i < pts.length; i++) if (z <= pts[i]![0]) { const [z0, y0] = pts[i - 1]!, [z1, y1] = pts[i]!; return lerp(y0, y1, (z - z0) / (z1 - z0)); }
    return pts[pts.length - 1]![1];
  };
  const mainPts: [number, number][] = [[40, 3.9], [bw.main!.z, bw.main!.waterY], [308, LAKE_Y + 0.05]];
  const tribPts: [number, number][] = [[40, 4.4], [bw.tributary!.z, bw.tributary!.waterY], [200, pw(mainPts, 200) + 0.12]];
  const mainY = (z: number) => pw(mainPts, z), tribY = (z: number) => pw(tribPts, z);

  // ---- Stage 1: landforms (continental function; also sampled upwind outside the region for climate).
  const rg = R.regional;
  const natural = (x: number, z: number) => {
    const wx = x + nw.fbm(x / 160, z / 160, 3) * rg.warp, wz = z + nw.fbm(x / 160 + 7, z / 160 - 3, 3) * rg.warp;
    let h = 1.6 + nz.fbm(wx / rg.fbmScale, wz / rg.fbmScale, 5) * rg.fbmAmp + (nr.ridged(wx / 60, wz / 60, 4) - 0.5) * rg.ridgedAmp;
    // continental tilt: land rises gently to the north (toward the campaign's highlands)
    h += (z - minZ) * 0.004;
    for (const r of R.ranges) {
      let best = { d: 1e9, t: 0, side: 0, along: 0 }; let acc = 0;
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i]; const s = segDist(wx, wz, ax, az, bx, bz);
        if (s.d < best.d) best = { d: s.d, t: s.t, side: s.side, along: acc + s.t * s.len }; acc += s.len;
      }
      const w = r.width * (1 + 0.25 * nw.n(best.along / 90, 3.1)) * (1 + r.asym * best.side);
      const core = Math.exp(-((best.d / w) ** 2));
      const foot = 0.3 * Math.exp(-((best.d / (w * 2.6)) ** 2));
      // crest varies along strike: saddles and summits, so ranges are connected but not uniform
      const crest = 0.45 + 0.55 * nr.ridged(best.along / 70, best.d / 40 + r.height, 4);
      // spur ridges perpendicular to strike (ridged in strike-normal coordinates)
      const spurs = 0.25 * (nr.ridged(best.along / 22, best.d / 55, 3) - 0.4) * Math.exp(-((best.d / (w * 1.8)) ** 2));
      // passes: structural saddles where the range is breached (river gaps / the Ash Road notch)
      let gap = 1; for (const [px, pz, pr, pd] of r.passes ?? []) gap = Math.min(gap, 1 - pd * Math.exp(-((Math.hypot(x - px, z - pz) / pr) ** 2)));
      h += r.height * (core * crest + foot + spurs) * gap;
    }
    const bz = R.basin; const be = Math.hypot((x - bz.x) / bz.rx, (z - bz.z) / bz.rz);
    h -= bz.depth * (1 - smooth(be));
    // valley prior: the master streams follow the basin's fault-guided axial valleys
    const vp = R.valleyPrior; let wv = 0, fy = 0;
    const chan = [
      { cx: paleHollowRiverCenterX(Math.max(40, Math.min(308, z))), y: mainY(z), z0: -80, z1: 320 },
      { cx: paleHollowTributaryCenterX(Math.max(40, Math.min(200, z))), y: tribY(z), z0: -80, z1: 205 },
    ];
    for (const c of chan) {
      if (z < c.z0 || z > c.z1) continue;
      const t = Math.exp(-(((x - c.cx) / vp.width) ** 2));
      if (t > wv) { wv = t; fy = c.y + 0.7; }
    }
    if (wv > 0) h = lerp(h, Math.min(h, fy + Math.abs(x) * 0), wv * 0.9);
    return h;
  };
  const h = new Float32Array(N);
  for (let k = 0; k < N; k++) h[k] = natural(X(k), Z(k));
  // Hillslope dissection: warped ridged noise inverted into V-valleys, scaled by local landform slope, so overland flow
  // converges into branching gullies (dendritic) instead of running in parallel D8 lines down planar slopes.
  { const nd = new Noise2(hashSeed(seed, "dissect")); const c = h.slice();
    for (let k = 0; k < N; k++) { const i = k % W, j = (k / W) | 0; const x = X(k), z = Z(k);
      const sx = (c[Math.min(W - 1, i + 1) + j * W]! - c[Math.max(0, i - 1) + j * W]!) / (2 * cell), sz = (c[i + Math.min(H - 1, j + 1) * W]! - c[i + Math.max(0, j - 1) * W]!) / (2 * cell);
      const sl = Math.hypot(sx, sz); if (sl < 0.02) continue;
      const wx = x + nd.fbm(x / 70, z / 70, 3) * 30, wz = z + nd.fbm(x / 70 + 9, z / 70 - 5, 3) * 30;
      const v = nd.ridged(wx / 42, wz / 42, 3) * 0.7 + nd.ridged(wx / 17 + 3, wz / 17, 2) * 0.3;
      h[k] -= (R.dissection ?? 2.2) * Math.min(1, sl / 0.2) * v; } }
  const landformOnly = h.slice();

  // ---- Legacy water footprint (gameplay contract: server walkability). River id + surface per cell.
  const water = new Uint8Array(N), wy = new Float32Array(N), lake = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const x = X(k), z = Z(k); const lw = paleHollowWaterSurfaceY(x, z);
    const wet = lw != null && (paleHollowInOpenWater(x, z) || paleHollowOnBridge(x, z));
    if (!wet) continue; water[k] = 1;
    if (Math.abs(lw! - LAKE_Y) < 1e-6 || Math.hypot(x - PH_LAKE.x, z - PH_LAKE.z) < PH_LAKE.r) { lake[k] = 1; wy[k] = LAKE_Y; continue; }
    const dm = Math.abs(x - paleHollowRiverCenterX(z)), dt = z <= 205 ? Math.abs(x - paleHollowTributaryCenterX(z)) : 1e9;
    wy[k] = dm <= dt ? mainY(z) : tribY(z);
  }

  // Water-surface drainage guarantee (priority-flood on the water mask from the terminal lake / map edge): every river
  // cell gets a downstream water neighbour at <= its surface, so no channel cell is a local pit (fixes confluence pits).
  { const seen = new Uint8Array(N); const q = new MinHeap();
    for (let k = 0; k < N; k++) if (water[k] && (lake[k] || k % W === 0 || k % W === W - 1 || k < W || k >= N - W)) { seen[k] = 1; q.push(wy[k]!, k); }
    while (q.size) { const [, k] = q.pop(); const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni;
        if (!water[n] || seen[n]) continue; seen[n] = 1; if (wy[n]! < wy[k]!) wy[n] = wy[k]!; q.push(wy[n]!, n); } } }

  const legWalk = new Uint8Array(N), legBridge = new Uint8Array(N);
  for (let k = 0; k < N; k++) { legWalk[k] = paleHollowWalkable(X(k), Z(k)) ? 1 : 0; legBridge[k] = paleHollowOnBridge(X(k), Z(k)) ? 1 : 0; }
  // per-cell jitter so flat-floor routing meanders instead of drawing straight D8 diagonals
  const jit = new Float32Array(N); { const nj = new Noise2(hashSeed(seed, "jitter")); for (let k = 0; k < N; k++) jit[k] = nj.n(X(k) / 3.7, Z(k) / 3.7) * 0.03 + nj.n(X(k) / 11, Z(k) / 11) * 0.05; }
  for (let k = 0; k < N; k++) h[k] += jit[k]!;
  // ---- Stage 2: erosion (stream power, implicit) + talus relaxation + alluvial smoothing.
  const E = R.erosion; const sinkSeed = lake;
  for (let it = 0; it < E.iterations; it++) {
    priorityFill(h, W, H, sinkSeed, null, 1e-3);
    const rec = d8Receivers(h, W, H, sinkSeed); const a = accumulate(h, rec);
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => h[p]! - h[q]!);
    for (const k of order) { const r = rec[k]!; if (r < 0) continue;
      const dl = Math.hypot(X(k) - X(r), Z(k) - Z(r)); const F = E.k * Math.pow(a[k]! * cell * cell, E.m) / dl * 4;
      h[k] = (h[k]! + F * h[r]!) / (1 + F); }
    for (let k = 0; k < N; k++) { const i = k % W, j = (k / W) | 0; if (!i || !j || i === W - 1 || j === H - 1) continue;
      for (const n of [k + 1, k - 1, k + W, k - W]) { const dh = h[k]! - h[n]!; if (dh > E.talus) { const m = (dh - E.talus) * 0.25; h[k] -= m; h[n] += m; } } }
  }
  // deposition proxy: diffuse low-gradient floors (floodplains / alluvial fans), keep slopes
  for (let pass = 0; pass < 4; pass++) { const c = h.slice();
    for (let k = W; k < N - W; k++) { const i = k % W; if (!i || i === W - 1) continue;
      const avg = (c[k + 1]! + c[k - 1]! + c[k + W]! + c[k - W]!) / 4; const s = Math.abs(c[k + 1]! - c[k - 1]!) + Math.abs(c[k + W]! - c[k - W]!);
      if (s < 0.5) h[k] = lerp(c[k]!, avg, E.deposit); } }
  const eroded = h.slice();

  // ---- Stage 3: gameplay constraints. Channels to the legacy footprint, banks soft, pads at legacy height.
  const { d: dWet, src: wSrc } = distanceTo(water, W, H);
  const dry = new Uint8Array(N); for (let k = 0; k < N; k++) dry[k] = water[k] ? 0 : 1;
  const { d: dDry } = distanceTo(dry, W, H);
  // Hard height anchors (hub floor, bridge banks): the server's bridge decks and hub floor are computed from
  // legacy heights, so the land is WARPED to meet them with a broad offset field (no cut platforms).
  // Soft pads (yards, gates, arena) only need level, walkable ground: flatten to the local mean.
  const padW = new Float32Array(N), fixed = new Uint8Array(N), hardCore = new Uint8Array(N);
  const hardPads = A.pads.filter((p) => p.id === "hub-apron" || p.id.startsWith("bridge:") || p.id.startsWith("mayflower"));
  const softPads = A.pads.filter((p) => !hardPads.includes(p));
  for (let k = 0; k < N; k++) for (const p of hardPads) { const w = padWeight({ ...p, soft: 1e-3 }, X(k), Z(k)); if (w > 0) { hardCore[k] = 1; break; } }
  const delta = new Float32Array(N); for (let k = 0; k < N; k++) if (hardCore[k]) delta[k] = paleHollowGroundHeight(X(k), Z(k)) - h[k]!;
  { const { d, src } = distanceTo(hardCore, W, H); const FALL = R.anchorPad.offsetRadius ?? 70;
    for (let k = 0; k < N; k++) { if (hardCore[k]) { h[k] += delta[k]!; fixed[k] = 1; padW[k] = 1; continue; }
      const dist = d[k]! * cell; if (dist >= FALL) continue; const t = smooth(1 - dist / FALL); h[k] += delta[src[k]!]! * t; padW[k] = Math.max(padW[k]!, dist < 6 ? 1 - dist / 6 : 0); } }
  { const box = (r: number) => { const o = new Float32Array(N); const tmp = new Float32Array(N);
      for (let j = 0; j < H; j++) { let s = 0; for (let i = -r; i < W + r; i++) { const a = Math.min(W - 1, Math.max(0, i + r)), b = Math.min(W - 1, Math.max(0, i - r - 1)); s += h[j * W + a]! - (i - r - 1 >= -r ? h[j * W + b]! : 0); if (i >= 0 && i < W) tmp[j * W + i] = s / (2 * r + 1); } }
      for (let i = 0; i < W; i++) { let s = 0; for (let j = -r; j < H + r; j++) { const a = Math.min(H - 1, Math.max(0, j + r)), b = Math.min(H - 1, Math.max(0, j - r - 1)); s += tmp[a * W + i]! - (j - r - 1 >= -r ? tmp[b * W + i]! : 0); if (j >= 0 && j < H) o[j * W + i] = s / (2 * r + 1); } }
      return o; };
    const mean = box(12);
    for (let k = 0; k < N; k++) { if (hardCore[k] || water[k]) continue; const x = X(k), z = Z(k);
      // organic pad outline: domain-warp the footprint edge so yards/gates never read as squares or perfect discs
      const wx = x + nw.fbm(x / 23, z / 23, 3) * 7, wz = z + nw.fbm(x / 23 + 31, z / 23 - 17, 3) * 7;
      let w = 0; for (const p of softPads) w = Math.max(w, padWeight(p, wx, wz));
      // never perfectly flat: keep a gentle ~0.3 m swell inside the levelled footprint
      if (w > 0) { h[k] = lerp(h[k]!, mean[k]! + 0.3 * nz.fbm(x / 11, z / 11, 2), w * 0.72); padW[k] = Math.max(padW[k]!, w); } } }
  // Channels last (except where hard anchors hold legacy bridge banks): bed under water, soft banks above it.
  for (let k = 0; k < N; k++) {
    if (hardCore[k]) continue;
    if (water[k]) { h[k] = wy[k]! - (lake[k] ? Math.min(3.2, 0.6 + dDry[k]! * 0.08) : Math.min(1.6, 0.45 + dDry[k]! * 0.3));
      // server lets you walk here (legacy shore/edge) -> it must render as a wadeable shallow, not a deep channel
      if (legWalk[k] && !legBridge[k]) h[k] = Math.max(h[k]!, wy[k]! - 0.5); continue; }
    const dw = dWet[k]! * cell; if (dw > 40) continue; const sy = wy[wSrc[k]!]!;
    const lo = sy + 0.28 + dw * 0.02, hi = sy + 0.45 + dw * 0.55;
    const t = dw < 6 ? 1 : smooth(1 - (dw - 6) / 34); h[k] = lerp(h[k]!, Math.max(lo, Math.min(hi, h[k]!)), t);
  }

  // ---- Stage 3b: access grading. Anchors that gameplay must reach (Ash Road gate, Ash Pit lip) get their
  // surroundings slope-limited (a worn approach), never moved. Config: region.access = [[x, z, radius, maxSlope]].
  for (const [ax, az, ar, ms] of (R as any).access ?? []) {
    const lim = ms * cell; for (let it = 0; it < 80; it++) for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i; const x = minX + i * cell, z = minZ + j * cell; if (hardCore[k] || water[k] || Math.hypot(x - ax, z - az) > ar) continue;
      for (const n of [k + 1, k - 1, k + W, k - W]) { if (hardCore[n] || water[n]) continue; const dh = h[k]! - h[n]!; if (dh > lim) { const m = (dh - lim) * 0.5; h[k] -= m; h[n] += m; } } } }
  // ---- Stage 4: final hydrology on the constrained DEM. Water drains to rivers -> lake (endorheic) or off-map.
  const seeds = new Uint8Array(N); for (let k = 0; k < N; k++) seeds[k] = water[k]!;
  const raised = priorityFill(h, W, H, seeds, fixed, 2e-4);
  const rec = d8Receivers(h, W, H, water); const acc = accumulate(h, rec);
  const creek = new Uint8Array(N); for (let k = 0; k < N; k++) if (!water[k] && acc[k]! * cell * cell >= R.creekThreshold && padW[k]! < 0.3) creek[k] = 1;
  // ---- Water depth tiers. 0 dry, 1 shallow (ford: walkable, no bridge needed), 2 deep channel (impassable, bridge
  // required), 3 lake-deep (>2 m). Creeks: depth from flow (Leopold hydraulic geometry d ~ a*Q^0.4), always shallow
  // here. Legacy rivers: depth = surface - carved bed. SHALLOW_MAX is the wading limit.
  // Deep water is never walkable: any water cell the server lets you walk on at BAZ resolution (0.5 m sub-cells),
  // off a bridge deck, is shoaled to a wadeable bed so render depth and walkability agree.
  for (let k = 0; k < N; k++) { if (!water[k]) continue; const x = X(k), z = Z(k);
    for (const [ox, oz] of [[-0.5, -0.5], [0, -0.5], [-0.5, 0], [0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]]) { const sx = x + ox!, sz = z + oz!;
      if (paleHollowWalkable(sx, sz) && !paleHollowOnBridge(sx, sz)) { h[k] = Math.max(h[k]!, wy[k]! - 0.5); break; } } }
  const SHALLOW_MAX = 0.7; const depth = new Float32Array(N), depthClass = new Uint8Array(N);
  for (let k = 0; k < N; k++) { if (water[k]) { depth[k] = wy[k]! - h[k]!; depthClass[k] = lake[k] && depth[k]! > 2 ? 3 : depth[k]! <= SHALLOW_MAX ? 1 : 2; }
    else if (creek[k]) { depth[k] = Math.min(SHALLOW_MAX, 0.08 * Math.pow(acc[k]! * cell * cell / 1000, 0.4)); depthClass[k] = 1; } }
  // Creek centrelines: trace each head down its receivers, add gentle meander (normal offset, zero at the ends) and
  // Chaikin-smooth, so the bake draws curving channels instead of stair-stepped 1 m D8 cells. Width ~ catchment^0.3.
  const creekSegs: { ax: number; az: number; bx: number; bz: number; w: number }[] = [];
  { const up = new Uint8Array(N); for (let k = 0; k < N; k++) if (creek[k] && rec[k]! >= 0 && creek[rec[k]!]) up[rec[k]!] = 1;
    const done = new Uint8Array(N); const nm = new Noise2(hashSeed(seed, "meander"));
    for (let k0 = 0; k0 < N; k0++) { if (!creek[k0] || up[k0]) continue; const pts: { x: number; z: number; a: number }[] = []; let k = k0;
      while (k >= 0) { pts.push({ x: X(k), z: Z(k), a: acc[k]! }); if (!creek[k] || done[k]) break; done[k] = 1; k = rec[k]!; if (k >= 0 && water[k]) { pts.push({ x: X(k), z: Z(k), a: acc[k]! }); break; } }
      if (pts.length < 3) continue;
      let q = pts.map((p, i) => { if (i === 0 || i === pts.length - 1) return p; const a = pts[i - 1]!, b = pts[i + 1]!; const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
        const off = nm.n(p.x / 13, p.z / 13) * 1.4 * Math.min(1, i / 4, (pts.length - 1 - i) / 4); return { x: p.x - (tz / l) * off, z: p.z + (tx / l) * off, a: p.a }; });
      for (let it = 0; it < 3; it++) { const o = [q[0]!]; for (let i = 0; i < q.length - 1; i++) { const a = q[i]!, b = q[i + 1]!;
          o.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25, a: a.a }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75, a: b.a }); } o.push(q[q.length - 1]!); q = o; }
      for (let i = 1; i < q.length; i++) { const a = q[i - 1]!, b = q[i]!; creekSegs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, w: Math.min(2.4, 0.5 + 0.12 * Math.pow(b.a * cell * cell / 100, 0.3)) }); } } }
  const slope = new Float32Array(N);
  for (let k = 0; k < N; k++) { const i = k % W, j = (k / W) | 0; const a = h[Math.min(W - 1, i + 1) + j * W]! - h[Math.max(0, i - 1) + j * W]!;
    const b = h[i + Math.min(H - 1, j + 1) * W]! - h[i + Math.max(0, j - 1) * W]!; slope[k] = Math.hypot(a, b) / (2 * cell); }

  // ---- Stage 5: climate. Westerlies march across the Spine: orographic lift wrings moisture out (rain shadow).
  const C = R.climate; const precip = new Float32Array(N), temp = new Float32Array(N);
  for (let j = 0; j < H; j++) { const z = minZ + j * cell; let M = C.oceanMoisture; let prev = natural(-640, z);
    for (let x = -640; x < minX; x += 4) { const y = natural(x, z); M -= M * (0.0015 * 4 + C.orographicRate * Math.max(0, y - prev)); prev = y; }
    for (let i = 0; i < W; i++) { const k = j * W + i; const dy = Math.max(0, h[k]! - prev); prev = h[k]!;
      const p = M * (0.0015 * cell + C.orographicRate * dy); M = Math.max(0.02, M - p + (water[k] ? C.evapRecovery * 40 : C.evapRecovery * 0.1)); precip[k] = M; }
  }
  { const c = precip.slice(); for (let k = 0; k < N; k++) { let s = 0, n = 0; const i = k % W, j = (k / W) | 0;
      for (let dj = -6; dj <= 6; dj += 2) for (let di = -6; di <= 6; di += 2) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; s += c[nj * W + ni]!; n++; }
      precip[k] = s / n; } }
  let pMax = 0, pMin = 1e9; for (let k = 0; k < N; k++) { pMax = Math.max(pMax, precip[k]!); pMin = Math.min(pMin, precip[k]!); }
  const lat = R.latitude; for (let k = 0; k < N; k++) temp[k] = C.baseTempC - (lat - 38) * 0.7 - (Z(k) - minZ) * 0.002 - C.lapsePerM * 100 * Math.max(0, h[k]!);
  // soil moisture: rainfall + topographic wetness (upslope area / slope) + groundwater near channels
  const moist = new Float32Array(N);
  for (let k = 0; k < N; k++) { const twi = Math.log((acc[k]! + 1) / (Math.tan(Math.atan(slope[k]!)) + 0.02));
    const gw = Math.exp(-(dWet[k]! * cell) / 18) + (creek[k] ? 0.4 : 0);
    moist[k] = Math.min(1.4, 0.2 + 0.45 * ((precip[k]! - pMin) / (pMax - pMin + 1e-9)) + 0.05 * Math.max(0, twi - 4) + 0.6 * gw); }

  // ---- Stage 6: biomes (continuous fields -> renderer biome ids). Playa = evaporite flats around the terminal lake.
  // Annual precipitation proxy (mm): orographic rainfall field + groundwater bonus; Whittaker classes for temperate band.
  const pmm = (k: number) => 180 + 900 * ((precip[k]! - pMin) / (pMax - pMin + 1e-9)) + 260 * Math.exp(-(dWet[k]! * cell) / 25) + Math.min(250, acc[k]! * cell * cell / 40);
  const whitt: string[] = new Array(N);
  const biome = new Uint8Array(N); const eco = new Uint8Array(N); // eco: 0 none 1 conifer 2 woodland 3 riparian 4 grass 5 steppe/scrub 6 rock 7 playa 8 wetland
  const lakeD = (k: number) => paleHollowLakeDist(X(k) + ne.n(X(k) / 11, Z(k) / 11) * 4, Z(k) + ne.n(X(k) / 11 + 7, Z(k) / 11) * 4) - PH_LAKE.r; // irregular playa ring, follows the shoreline
  const ne = new Noise2(hashSeed(seed, "ecotone"));
  for (let k = 0; k < N; k++) {
    if (water[k]) { biome[k] = B("river"); continue; }
    // ecotones interfinger: two noise scales jitter the moisture used for classification (no straight biome borders)
    const m = moist[k]! + ne.fbm(X(k) / 35, Z(k) / 35, 3) * 0.12 + ne.n(X(k) / 9, Z(k) / 9) * 0.05, s = slope[k]!, e = h[k]!, ld = lakeD(k);
    const wc = whittaker(temp[k]!, pmm(k) + (m - moist[k]!) * 900); whitt[k] = wc;
    let b: number, c: number;
    if (s > 0.75 || e > 22 + ne.n(X(k) / 50, Z(k) / 50) * 4) { b = B("mountain"); c = 6; }
    else if (ld < 12 + 16 * (0.5 + 0.5 * ne.n(X(k) / 30 + 3, Z(k) / 30 - 8)) && e < LAKE_Y + 1.6 + ne.n(X(k) / 13, Z(k) / 13) * 0.5 && m < 0.95) {
      // varied shore: rock on steep banks, gravel on wave-exposed slopes, reeds/mud in sheltered wet bays,
      // patchy sand (chalk playa) with dune-grass tufts on the open flats
      const ax = X(k) - PH_LAKE.x, az = Z(k) - PH_LAKE.z, al = Math.hypot(ax, az) || 1;
      const expo = 0.5 + 0.5 * ((ax / al) * 0.8 + (az / al) * 0.6); // prevailing wind from the SW drives waves onto the NE shore
      const pn = ne.fbm(X(k) / 14 + 21, Z(k) / 14 - 4, 3), tn = ne.n(X(k) / 4.5, Z(k) / 4.5);
      if (s > 0.32 + pn * 0.08) { b = B("mountain"); c = 6; }
      else if (s > 0.16 + pn * 0.06 || (expo > 0.7 && pn > 0.1 && ld < 10)) { b = B("quarry"); c = 6; }
      else if ((expo < 0.42 && ld < 14 && pn > -0.25) || (m > 0.6 && pn > 0.2)) { b = tn > 0.45 ? B("meadow") : B("riverbank"); c = 8; }
      else if (pn < -0.3 || tn > 0.55) { b = B("scrub"); c = 5; }
      else { b = B("terrace"); c = 7; }
    }
    else if (dWet[k]! * cell < 3.5 || (creek[k] && s < 0.15)) { b = B("riverbank"); c = 8; }
    else if (m > 0.85 && s < 0.25) { b = B("ashbeam"); c = 3; }
    // zonal vegetation from the Whittaker class (temperature x annual precipitation)
    else if (wc === "boreal" || wc === "tundra") { b = B("vine_cliff"); c = 1; }
    else if (wc === "temperate-rainforest" || wc === "temperate-forest") { b = e > 11 ? B("vine_cliff") : B("meadow"); c = e > 11 ? 1 : 2; }
    else if (wc === "woodland") { b = B("grass"); c = 2; }
    else if (wc === "grassland") { b = B("grass"); c = 4; }
    else { b = B("scrub"); c = 5; }
    biome[k] = b; eco[k] = c;
  }

  // ---- Stage 7: civilization. Roads by least-cost routing (slope, water only at bridges), then farms, ruins.
  const RC = 2; const RW = Math.floor((W - 1) / RC) + 1, RH = Math.floor((H - 1) / RC) + 1;
  const toR = (x: number, z: number) => Math.round((z - minZ) / cell / RC) * RW + Math.round((x - minX) / cell / RC);
  const fromR = (r: number) => ({ x: minX + (r % RW) * RC * cell, z: minZ + ((r / RW) | 0) * RC * cell });
  const kAt = (x: number, z: number) => Math.max(0, Math.min(H - 1, Math.round((z - minZ) / cell))) * W + Math.max(0, Math.min(W - 1, Math.round((x - minX) / cell)));
  const onBr = (x: number, z: number) => paleHollowOnBridge(x, z);
  const road = new Uint8Array(N);
  const roadCost = (a: number, b: number, dl: number) => {
    const pa = fromR(a), pb = fromR(b); const ka = kAt(pa.x, pa.z), kb = kAt(pb.x, pb.z);
    if ((water[kb] || !legWalk[kb]) && !legBridge[kb]) return Infinity;
    const g = Math.abs(h[kb]! - h[ka]!) / (dl * RC * cell); if (g > 0.3) return Infinity;
    return dl * (1 + 60 * g * g + (creek[kb] ? 3 : 0) + (road[kb] ? -0.4 : 0) + (eco[kb] === 1 || eco[kb] === 3 ? 0.4 : 0));
  };
  const P = (id: string) => { const p = A.points.find((q) => q.id === id); if (!p) throw new Error(id); return p; };
  const yard = (id: string) => { const y = A.yards.find((q) => q.id === id)!; return { id: `yard:${id}`, kind: "yard", x: y.x + 3, z: y.z - 6 }; };
  const destinations = {
    hub: P("spawn-outdoor"), hubSouth: P("spawn-hub"), span: yard("span"), terrace: yard("terrace"), clay: yard("clay"), grove: yard("grove"), hunter: yard("hunter"),
    cut: yard("cut"), rim: yard("rim"), seam: yard("seam"), watch: yard("watch"), cairn: yard("cairn"), ashroad: P("link:hollow-to-pale"), pit: P("ash-pit-spawn"),
  };
  const roadEdges: [keyof typeof destinations, keyof typeof destinations, string][] = [
    ["hub", "span", "Terrace Way"], ["span", "clay", "Clay Bank Path"], ["clay", "grove", "Hollow Steps Road"], ["grove", "terrace", "Hollow Steps Road"],
    ["terrace", "pit", "Pit Track"], ["hubSouth", "hunter", "East Grove Path"], ["hunter", "cut", "Quarry Road"], ["cut", "rim", "Rim Track"],
    ["cut", "grove", "Chalkworks Ford Road"], ["span", "seam", "Seam Road"], ["seam", "watch", "Seam Road"], ["watch", "cairn", "Ash Road"], ["cairn", "ashroad", "Ash Road"],
  ];
  const roads: { from: string; to: string; name: string; ok: boolean; pts: { x: number; z: number }[]; maxGrade: number; fords: number; bridgeCells: number }[] = [];
  for (const [a, b, name] of roadEdges) {
    const pa = destinations[a], pb = destinations[b];
    const path = astar(RW, RH, toR(pa.x, pa.z), toR(pb.x, pb.z), roadCost, 1);
    const pts = (path ?? []).map(fromR); let maxGrade = 0, fords = 0, bridgeCells = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i]!; const k = kAt(p.x, p.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const q = kAt(p.x + dx, p.z + dz); if (!water[q] || legBridge[q]) road[q] = 1; }
      if (creek[k]) fords++; if (legBridge[k]) bridgeCells++;
      if (i) { const q = pts[i - 1]!; maxGrade = Math.max(maxGrade, Math.abs(h[k]! - h[kAt(q.x, q.z)]!) / Math.hypot(p.x - q.x, p.z - q.z)); } }
    roads.push({ from: a, to: b, name, ok: !!path, pts, maxGrade, fords, bridgeCells });
  }
  // farms: flat, moist-enough, close to water and to a road, within reach of a settlement (hub / terrace / clay yards)
  const farmSeats = [destinations.terrace, destinations.clay, destinations.hub];
  for (let k = 0; k < N; k++) { if (water[k] || road[k] || padW[k]! > 0.2) continue; const x = X(k), z = Z(k);
    const near = Math.min(...farmSeats.map((s) => Math.hypot(x - s.x, z - s.z)));
    // ragged, terrain-following parcels: warped reach, slope limit and moisture window; hedge gaps from a fine noise
    const fn = ne.fbm(x / 28 + 40, z / 28, 3), hedge = Math.abs(ne.n(x / 6.5 + 11, z / 6.5 - 4)) < 0.05;
    if (!hedge && near < 52 + fn * 22 && slope[k]! < 0.07 + fn * 0.03 && moist[k]! > 0.42 + fn * 0.06 && moist[k]! < 1.1 && dWet[k]! * cell < 70 + fn * 20 && eco[k] !== 7) { biome[k] = B("farm"); eco[k] = 9; } }

  // Ruin / lore hooks (data only). Placed where geography explains them.
  const lore: { id: string; kind: string; x: number; z: number; why: string; hook: string }[] = [];
  // (a) Old Shore: a paleo-shoreline terrace ~5 m above today's lake — the lake was larger before the Kings diverted inflow.
  { const target = LAKE_Y + 5; const cand: number[] = [];
    for (let k = 0; k < N; k++) if (!water[k] && padW[k] === 0 && Math.abs(h[k]! - target) < 0.35 && slope[k]! < 0.08 && lakeD(k) < 90) cand.push(k);
    const r = mulberry32(hashSeed(seed, "ruins")); const picked: number[] = [];
    for (let t = 0; t < 4000 && picked.length < 5; t++) { const k = cand[Math.floor(r() * cand.length)]; if (k == null) break;
      if (picked.every((q) => Math.hypot(X(q) - X(k), Z(q) - Z(k)) > 60)) picked.push(k); }
    picked.forEach((k, i) => lore.push({ id: `old-shore-${i + 1}`, kind: "drowned-quay", x: X(k), z: Z(k), why: `flat bench at ${h[k]!.toFixed(1)} m, ${(h[k]! - LAKE_Y).toFixed(1)} m above the lake: a former shoreline`, hook: "Mooring stones far from any water. The Kings' charts say the Ash Pit was always this small." })); }
  // (b) The Old Pass road: least-cost route over the Seam Ridge's lowest saddle, abandoned for the gated Ash Road.
  { let best = -1; for (let i = 0; i < W; i++) { let mx = -1e9, mk = -1; for (let j = Math.round((440 - minZ) / cell); j < Math.round((480 - minZ) / cell); j++) { const k = j * W + i; if (h[k]! > mx) { mx = h[k]!; mk = k; } }
      if (X(mk) < -60 || X(mk) > 140) continue; if (best < 0 || h[mk]! < h[best]!) best = mk; }
    if (best >= 0) lore.push({ id: "old-pass-saddle", kind: "abandoned-road", x: X(best), z: Z(best), why: `lowest crest of the Seam Ridge (${h[best]!.toFixed(1)} m): the natural route north before the Ash Road cut`, hook: "Wheel ruts over the saddle, older than the Ash Road toll gate. The old songs say no road ever ran here." }); }
  // (c) Defaced monument: the most visible knoll overlooking both river crossings (high, dry, view to bridges).
  { let best = -1, bs = -1e9; for (let k = 0; k < N; k += 3) { if (water[k] || padW[k]! > 0 || slope[k]! > 0.5) continue; const x = X(k), z = Z(k);
      const dist = Math.min(...A.bridges.map((b) => Math.hypot(x - b.x, z - b.z))); if (dist > 120 || dist < 30) continue;
      const s = h[k]! - dist * 0.02; if (s > bs) { bs = s; best = k; } }
    if (best >= 0) lore.push({ id: "defaced-stele", kind: "defaced-monument", x: X(best), z: Z(best), why: "highest knoll in sight of both river crossings: where the Crown would raise a stone over the old makers", hook: "A stele with its name chiselled off and a New King's crest cut over it." }); }
  // (d) Dry mill-race: a creek that the generator routes into the main stem, mouth near the hub bridge (canal diverted by the Kings).
  { let best = -1; for (let k = 0; k < N; k++) if (creek[k] && acc[k]! > (best < 0 ? 0 : acc[best]!) && Z(k) > 150 && Z(k) < 300) best = k;
    if (best >= 0) lore.push({ id: "dry-millrace", kind: "abandoned-works", x: X(best), z: Z(best), why: `largest side-creek mouth (${Math.round(acc[best]!)} m² catchment) on the main stem`, hook: "Cut stone lining a stream bed. A mill stood here; the only hearth-ash and a chiselled-out name remain." }); }

  // (e) Time Mage warp circle (data hook only, no mechanic): a sheltered, gently sloping knoll beside an old crossroads —
  // many road cells within 25 m (routes converge), dry, off every pad, >= 18 m from any gameplay anchor, above the floodplain.
  { let best = -1, bs = -1e9; for (let k = 0; k < N; k += 2) { if (water[k] || road[k] || padW[k]! > 0 || slope[k]! > 0.15 || dWet[k]! * cell < 25) continue; const x = X(k), z = Z(k);
      if (A.points.some((p) => Math.hypot(p.x - x, p.z - z) < 18)) continue;
      let rc = 0; for (let dz = -25; dz <= 25; dz += 2) for (let dx = -25; dx <= 25; dx += 2) if (road[kAt(x + dx, z + dz)]) rc++;
      let flat = 0; for (let dz = -6; dz <= 6; dz += 2) for (let dx = -6; dx <= 6; dx += 2) { const q = kAt(x + dx, z + dz); if (!water[q] && slope[q]! < 0.2 && padW[q] === 0) flat++; }
      if (flat < 49) continue; const sc = Math.min(rc, 60) + (h[k]! - LAKE_Y) * 0.3; if (sc > bs) { bs = sc; best = k; } }
    // The Sheepfold's listed place (world-pois.ts) is canon; the search above only confirms the knoll exists.
    const fold = WORLD_POIS.find((p) => p.id === "ph-sheepfold-ring");
    if (best >= 0 && fold) best = kAt(fold.x, fold.z);
    if (best >= 0) lore.push({ id: "warp-circle-pale", kind: "time-mage-warp-circle", x: fold?.x ?? X(best), z: fold?.z ?? Z(best), why: `old crossroads knoll (${h[best]!.toFixed(1)} m, ${Math.round(dWet[best]! * cell)} m from water): routes converge, footprint r6 walkable, clear of all anchors`, hook: "Rune stones ring a sunken floor. The New Kings' maps mark it as a sheepfold. Dormant until a Time Mage unlocks it (mechanic not implemented)." }); }

  // ---- Stage 8: vegetation & rocks by ecology. Poisson-disk darts with density from eco/moisture/slope.
  const props: Prop[] = [];
  const legacy = paleHollowProps();
  const civic = new Set<number>([K.wallBlock, K.firePit, K.tent, K.bedroll, K.crate, K.chest, K.leanTo, K.trainer, K.stall, K.weaponRack, K.firewood, K.barrel, K.banner, K.riverWall, K.bridge, K.shack, K.cairn]);
  let civicKept = 0;
  const groundAt = (x: number, z: number) => { const fx = (x - minX) / cell, fz = (z - minZ) / cell; const i = Math.max(0, Math.min(W - 2, Math.floor(fx))), j = Math.max(0, Math.min(H - 2, Math.floor(fz)));
    const u = fx - i, v = fz - j; const a = h[j * W + i]!, b = h[j * W + i + 1]!, c = h[(j + 1) * W + i]!, d = h[(j + 1) * W + i + 1]!; return lerp(lerp(a, b, u), lerp(c, d, u), v); };
  const inMayflower = (x: number, z: number) => (x >= MAYFLOWER_BBOX.minX - 12 && x <= MAYFLOWER_BBOX.maxX + 12 && z >= MAYFLOWER_BBOX.minZ - 12 && z <= MAYFLOWER_BBOX.maxZ + 12)
    || Math.hypot(x - MAYFLOWER_SCREEN.x, z - MAYFLOWER_SCREEN.z) < MAYFLOWER_SCREEN.r;
  for (const p of legacy) if (civic.has(p.kind) || inMayflower(p.x, p.z)) { const dy = groundAt(p.x, p.z) - paleHollowGroundHeight(p.x, p.z); props.push({ ...p, y: p.y + (p.kind === K.bridge ? 0 : dy) }); civicKept++; }
  const rnd = mulberry32(hashSeed(seed, "veg")); const occ = new Map<number, { x: number; z: number; r: number }[]>();
  const okSpace = (x: number, z: number, r: number) => { const ci = Math.floor(x / 8), cj = Math.floor(z / 8);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of occ.get((ci + a) * 100003 + cj + b) ?? []) if (Math.hypot(o.x - x, o.z - z) < Math.max(r, o.r)) return false; return true; };
  const take = (x: number, z: number, r: number) => { const key = Math.floor(x / 8) * 100003 + Math.floor(z / 8); (occ.get(key) ?? occ.set(key, []).get(key)!).push({ x, z, r }); };
  const nc = new Noise2(hashSeed(seed, "canopy"));
  const vegRejects = { water: 0, slope: 0, pad: 0, road: 0 };
  const darts = Math.round((maxX - minX) * (maxZ - minZ) * 0.09);
  for (let t = 0; t < darts; t++) {
    const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ); const k = kAt(x, z);
    if (water[k] || dWet[k]! * cell < 1.6) { vegRejects.water++; continue; }
    if (padW[k]! > 0.05 || A.points.some((p) => (p.kind !== "mob") && Math.abs(p.x - x) < 4 && Math.abs(p.z - z) < 4)) { vegRejects.pad++; continue; }
    if (road[k]) { vegRejects.road++; continue; }
    const e = eco[k]!, s = slope[k]!, m = moist[k]!;
    // patchiness: canopy noise gives stands, glades and soft edges
    const patch = smooth((nc.fbm(x / 45, z / 45, 4) + 0.15) * 2.2);
    let kind = -1, dens = 0, r = 2, sc = 1;
    if (e === 1) { dens = 0.55 * patch + 0.1; kind = rnd() < 0.55 ? K.pine : K.spruce; r = 3.2; sc = 0.8 + rnd() * 0.6; }
    else if (e === 3) { dens = 0.5 * patch + 0.15; kind = rnd() < 0.6 ? K.ashTall : K.ashMed; r = 3.4; sc = 0.75 + rnd() * 0.5; }
    else if (e === 2) { dens = 0.22 * patch; kind = rnd() < 0.5 ? K.ashMed : rnd() < 0.5 ? K.bush : K.cypress; r = 3.6; sc = 0.7 + rnd() * 0.5; }
    else if (e === 4) { dens = 0.12; kind = rnd() < 0.7 ? K.tuft : rnd() < 0.5 ? K.longGrass : K.bloom; r = 1.6; sc = 0.8 + rnd() * 0.4; }
    else if (e === 5) { dens = 0.1 + 0.08 * patch; kind = rnd() < 0.6 ? K.scrub : K.bush; r = 2.4; sc = 0.6 + rnd() * 0.5; }
    else if (e === 8) { dens = 0.35; kind = rnd() < 0.7 ? K.reed : K.tallPatch; r = 1.2; sc = 0.8 + rnd() * 0.4; }
    else if (e === 7) { dens = 0.015; kind = K.pebble; r = 2; }
    else if (e === 9) { dens = 0.02; kind = K.stalk; r = 2; }
    else if (e === 6) { dens = 0.12; kind = K.rock; r = 3; sc = 0.6 + rnd() * 0.9; }
    // rocks on exposed slopes in any biome
    if (s > 0.35 && e !== 6 && rnd() < 0.25) { kind = rnd() < 0.5 ? K.rock : K.stone; dens = 0.3; r = 2.5; sc = 0.5 + rnd() * 0.8; }
    if (kind !== K.rock && kind !== K.stone && s > 0.65) { vegRejects.slope++; continue; }
    if (rnd() > dens || !okSpace(x, z, r)) continue;
    take(x, z, r);
    props.push({ kind, v: Math.floor(rnd() * 4), x, z, y: groundAt(x, z) - (kind === K.rock || kind === K.stone ? 0.15 * sc : 0), yaw: rnd() * Math.PI * 2, s: sc, w: 0, h: 0, d: 0 });
  }
  // ruin markers as visible props (stones + cairn) at the lore sites — decoration only
  for (const l of lore) { props.push({ kind: K.cairn, v: 0, x: l.x, z: l.z, y: groundAt(l.x, l.z), yaw: 0, s: 1, w: 0, h: 0, d: 0 });
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, d = 2 + rnd() * 4; const x = l.x + Math.cos(a) * d, z = l.z + Math.sin(a) * d; props.push({ kind: K.wallBlock, v: 0, x, z, y: groundAt(x, z) - 0.3, yaw: rnd() * 3, s: 0.5 + rnd() * 0.4, w: 0.8, h: 0.6 + rnd() * 0.8, d: 0.5 }); } }

  return { creekSegs, whitt, depth, depthClass, SHALLOW_MAX, W, H, cell, minX, minZ, maxX, maxZ, X, Z, kAt, h, landformOnly, eroded, water, wy, lake, creek, acc, rec, slope, precip, temp, moist, biome, eco, road, roads, padW, fixed, raised, props, civicKept, vegRejects, lore, anchors: A, mainY, tribY, LAKE_Y, groundAt };
}
export type Gen = ReturnType<typeof generatePaleHollow>;

/** Bake to the existing BAZ1 format (same layout/flags as bake-zones.ts). Blocked flag = legacy walkability contract. */
export function bakeGenerated(g: Gen, cellOut = 0.5): Buffer {
  const { minX, minZ, maxX, maxZ } = g; const w = Math.ceil((maxX - minX) / cellOut) + 1, hh = Math.ceil((maxZ - minZ) / cellOut) + 1;
  const header = 24; const buf = Buffer.alloc(header + w * hh * 4);
  buf.write("BAZ1", 0, "ascii"); buf.writeFloatLE(minX, 4); buf.writeFloatLE(minZ, 8); buf.writeFloatLE(cellOut, 12); buf.writeUInt32LE(w, 16); buf.writeUInt32LE(hh, 20);
  const bio = header, flg = header + w * hh, hgt = header + w * hh * 2;
  const bucket = new Map<number, typeof g.creekSegs>(); const BK = 4; const key = (a: number, b: number) => a * 100003 + b;
  for (const sg of g.creekSegs) { const r = sg.w / 2 + 0.5; for (let a = Math.floor((Math.min(sg.ax, sg.bx) - r) / BK); a <= Math.floor((Math.max(sg.ax, sg.bx) + r) / BK); a++) for (let b = Math.floor((Math.min(sg.az, sg.bz) - r) / BK); b <= Math.floor((Math.max(sg.az, sg.bz) + r) / BK); b++) { const kk = key(a, b); (bucket.get(kk) ?? bucket.set(kk, []).get(kk)!).push(sg); } }
  const inCreek = (x: number, z: number) => { for (const sg of bucket.get(key(Math.floor(x / BK), Math.floor(z / BK))) ?? []) if (segDist(x, z, sg.ax, sg.az, sg.bx, sg.bz).d <= sg.w / 2) return true; return false; };
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) { const x = minX + i * cellOut, z = minZ + j * cellOut, k = j * w + i, gk = g.kAt(x, z);
    let flags = 0; let y = g.groundAt(x, z); const onBr = paleHollowOnBridge(x, z);
    if (g.water[gk]) { flags |= 1; y = g.wy[gk]!; } else if (onBr) { flags |= 4; y = paleHollowBridgeDeckY(x, z) ?? y; }
    if (!paleHollowWalkable(x, z)) flags |= 8;
    else if (!(flags & 5)) y = paleHollowStandHeight(x, z); // contract: walkable ground = server stand height; relief only on blocked scenery
    if (!(flags & 5) && g.road[gk]) flags |= 2;
    if (!(flags & 5) && !g.road[gk] && inCreek(x, z)) flags |= 1, (y = g.groundAt(x, z) + 0.05); // creek: fordable (not blocked)
    buf.writeUInt8(g.biome[gk]!, bio + k); buf.writeUInt8(flags, flg + k); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * 100))), hgt + k * 2); }
  return buf;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const region = process.argv[2] ?? "pale_hollow"; if (region !== "pale_hollow") throw new Error(`region ${region}: only pale_hollow is implemented in this PoC`);
  const t0 = Date.now(); const g = generatePaleHollow(); const baz = bakeGenerated(g); const bap = encodeProps(g.props);
  const zones = resolve(HERE, "../../public/zones"); mkdirSync(zones, { recursive: true });
  const outDir = resolve(HERE, "out"); mkdirSync(outDir, { recursive: true });
  const prevPath = resolve(outDir, `${region}.summary.json`); const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
  writeFileSync(resolve(zones, `${region}_gen.baz`), baz); writeFileSync(resolve(zones, `${region}_gen.bap`), bap);
  writeFileSync(resolve(outDir, `${region}.lore.json`), JSON.stringify(g.lore, null, 2));
  writeFileSync(resolve(outDir, `${region}.roads.json`), JSON.stringify(g.roads.map((r) => ({ ...r, pts: r.pts.filter((_, i) => i % 4 === 0) })), null, 1));
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const summary = { region, generatorVersion: CFG.generatorVersion, seed: CFG.regions[region].seed, configSha: sha(Buffer.from(JSON.stringify(CFG.regions[region]))), bazSha: sha(baz), bapSha: sha(bap), props: g.props.length, ms: Date.now() - t0 };
  writeFileSync(prevPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary)); if (prev && prev.bazSha !== summary.bazSha) console.log(`changed vs previous run (baz ${prev.bazSha.slice(0, 8)} -> ${summary.bazSha.slice(0, 8)}); run review.ts --diff for cell-level changes`);
}
