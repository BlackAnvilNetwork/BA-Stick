/**
 * Visual review + automated validation for a generated region.
 *   tsx scripts/worldgen/review.ts pale_hollow [--img <dir>] [--diff <old.baz>]
 * Writes before/after diagnostic PNGs and <region>.validation.json; exits 1 if a hard check fails.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { encodeProps } from "../bake-props";
import { paleHollowBridgeGeom, PH_BRIDGE_SITES, paleHollowGroundHeight, paleHollowInOpenWater, paleHollowOnBridge, paleHollowWalkable, paleHollowStandHeight } from "@bellgrave/config";
import { bakePaleHollow } from "../bake-zones";
import { D8, accumulate, d8Receivers, priorityFill } from "./grid";
import { generatePaleHollow, bakeGenerated, type Gen } from "./generate";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const IMG = resolve(arg("--img") ?? "/workspace/worldgen-review"); mkdirSync(IMG, { recursive: true });
const PAL = [0x6b5a45, 0xb3ab92, 0x8a7a3c, 0x2f5f7a, 0x6e6650, 0x7a5a3a, 0x4b4a3a, 0x6f6a45, 0x8b8478, 0x4f5a3f, 0x5c5560, 0x3c3846, 0x5a534a, 0x4f6b38, 0x6a6560, 0x6d8a46];

type Baz = { w: number; h: number; cell: number; minX: number; minZ: number; biome: Uint8Array; flags: Uint8Array; y: Float32Array };
function decode(b: Buffer): Baz {
  const w = b.readUInt32LE(16), h = b.readUInt32LE(20), n = w * h; const y = new Float32Array(n);
  for (let k = 0; k < n; k++) y[k] = b.readInt16LE(24 + 2 * n + 2 * k) / 100;
  return { w, h, cell: b.readFloatLE(12), minX: b.readFloatLE(4), minZ: b.readFloatLE(8), biome: new Uint8Array(b.subarray(24, 24 + n)), flags: new Uint8Array(b.subarray(24 + n, 24 + 2 * n)), y };
}
/** Downsample BAZ to 1 m for analysis. */
function to1m(z: Baz) { const s = Math.round(1 / z.cell); const W = Math.floor((z.w - 1) / s) + 1, H = Math.floor((z.h - 1) / s) + 1;
  const pick = <T extends Uint8Array | Float32Array>(a: T, C: new (n: number) => T) => { const o = new C(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) o[j * W + i] = a[j * s * z.w + i * s]!; return o; };
  return { W, H, biome: pick(z.biome, Uint8Array), flags: pick(z.flags, Uint8Array), y: pick(z.y, Float32Array) }; }

async function png(name: string, W: number, H: number, px: (i: number, j: number) => [number, number, number], scale = 2, draw?: (put: (x: number, y: number, c: [number, number, number]) => void) => void) {
  const buf = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = px(i, j); const o = ((H - 1 - j) * W + i) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; }
  if (draw) draw((x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = ((H - 1 - y) * W + x) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; });
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize(W * scale, H * scale, { kernel: "nearest" }).png().toFile(resolve(IMG, name));
  return resolve(IMG, name);
}
const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number];
function hypso(e: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [[-2, [60, 90, 60]], [2, [96, 128, 72]], [5, [150, 150, 90]], [10, [160, 130, 90]], [20, [130, 110, 100]], [35, [220, 220, 220]]];
  for (let i = 1; i < stops.length; i++) if (e <= stops[i]![0]) return mix(stops[i - 1]![1], stops[i]![1], (e - stops[i - 1]![0]) / (stops[i]![0] - stops[i - 1]![0]));
  return stops[stops.length - 1]![1];
}
function shade(y: Float32Array, W: number, H: number, i: number, j: number, z = 3) {
  const a = y[Math.min(W - 1, i + 1) + j * W]! - y[Math.max(0, i - 1) + j * W]!, b = y[i + Math.min(H - 1, j + 1) * W]! - y[i + Math.max(0, j - 1) * W]!;
  const nx = -a * z, nz = -b * z; const l = (nx * -0.6 + nz * 0.6 + 2) / Math.hypot(nx, nz, 2) / 1.2; return Math.max(0.35, Math.min(1.25, l));
}

async function main() {
  const region = process.argv[2] ?? "pale_hollow";
  const t0 = Date.now(); const g: Gen = generatePaleHollow(); const gen = to1m(decode(bakeGenerated(g)));
  const leg = to1m(decode(bakePaleHollow()));
  const W = gen.W, H = gen.H; const X = (i: number) => g.minX + i, Zf = (j: number) => g.minZ + j;
  const out: string[] = [];
  const report: Record<string, unknown> = { region, generatedAt: new Date().toISOString(), genMs: Date.now() - t0 };
  const fails: string[] = [];

  // ---------- Elevation (hillshaded hypsometric)
  for (const [tag, z] of [["before", leg], ["after", gen]] as const) {
    out.push(await png(`${region}_elevation_${tag}.png`, W, H, (i, j) => { const k = j * W + i; if (z.flags[k]! & 1) return [47, 95, 122];
      return hypso(z.y[k]!).map((v) => Math.min(255, v * shade(z.y, W, H, i, j))) as [number, number, number]; }));
  }
  // ---------- Drainage: D8 accumulation on each DEM (legacy DEM shows where water would really go)
  const drain = async (tag: string, z: typeof gen) => {
    const y = Float32Array.from(z.y); const wat = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) wat[k] = z.flags[k]! & 1 && !(tag === "after" && g.creek[k]) ? 1 : 0;
    const raw = d8Receivers(y, W, H, wat); let pits = 0; for (let k = 0; k < W * H; k++) { const i = k % W, j = (k / W) | 0; if (!wat[k] && raw[k]! < 0 && i && j && i < W - 1 && j < H - 1) pits++; }
    const f = Float32Array.from(y); priorityFill(f, W, H, wat, null, 1e-4); const rec = d8Receivers(f, W, H, wat); const a = accumulate(f, rec);
    let fillVol = 0; for (let k = 0; k < W * H; k++) fillVol += f[k]! - y[k]!;
    out.push(await png(`${region}_drainage_${tag}.png`, W, H, (i, j) => { const k = j * W + i; if (wat[k]) return [30, 90, 200];
      const v = Math.min(1, Math.log10(a[k]!) / 4); const s = shade(y, W, H, i, j) * 70; return v > 0.72 ? [80, 170, 255] : [s + v * 60, s + v * 90, s + v * 150].map((q) => Math.min(255, q)) as [number, number, number]; }));
    return { rawSinkCells: pits, depressionFillVolumeM3: Math.round(fillVol) };
  };
  report.drainageBefore = await drain("before", leg); report.drainageAfter = await drain("after", gen);
  // ---------- Biomes
  for (const [tag, z] of [["before", leg], ["after", gen]] as const)
    out.push(await png(`${region}_biome_${tag}.png`, W, H, (i, j) => { const k = j * W + i; if (z.flags[k]! & 1) return [47, 95, 160]; if (z.flags[k]! & 2) return [196, 170, 110];
      return rgb(PAL[z.biome[k]!]!).map((v) => Math.min(255, v * (0.7 + 0.4 * shade(z.y, W, H, i, j)))) as [number, number, number]; }));
  // ---------- Climate (precip / moisture) — after only
  let pM = 0; for (const v of g.precip) pM = Math.max(pM, v);
  out.push(await png(`${region}_climate_moisture_after.png`, W, H, (i, j) => { const k = j * W + i; if (g.water[k]) return [30, 60, 160]; const p = g.precip[k]! / pM, m = Math.min(1, g.moist[k]! / 1.2);
    return [Math.round(200 - 160 * m), Math.round(150 + 60 * m * (1 - p * 0.3)), Math.round(80 + 140 * p)]; }));

  // ---------- Validation
  const N = W * H; const walk = new Uint8Array(N); const steepLimit = 1.0; // 45 deg
  for (let k = 0; k < N; k++) walk[k] = !(gen.flags[k]! & 8) && (g.slope[k]! < steepLimit || paleHollowOnBridge(X(k % W), Zf((k / W) | 0))) ? 1 : 0;
  // (1) server/client agreement: BAZ blocked flag must equal the server's paleHollowWalkable on the same 0.5 m cells
  { const z = decode(bakeGenerated(g)); let dis = 0, waterDis = 0;
    for (let j = 0; j < z.h; j++) for (let i = 0; i < z.w; i++) { const x = z.minX + i * z.cell, zz = z.minZ + j * z.cell, k = j * z.w + i;
      if (!!(z.flags[k]! & 8) !== !paleHollowWalkable(x, zz)) dis++;
      if ((z.flags[k]! & 1) && !g.creek[g.kAt(x, zz)] && !(paleHollowInOpenWater(x, zz) || paleHollowOnBridge(x, zz))) waterDis++; }
    report.serverClientWalkDisagreeCells = dis; report.blockingWaterOutsideServerWaterCells = waterDis; if (dis) fails.push(`walkability disagreement ${dis} cells`); }
  // (2) anchors: height delta vs legacy stand (server) + reachability from the hub spawn (BFS, slope-limited)
  const reach = new Uint8Array(N); { const s = g.kAt(g.anchors.points[1]!.x, g.anchors.points[1]!.z); const q = [s]; reach[s] = 1;
    while (q.length) { const k = q.pop()!; const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (!reach[n] && walk[n]) { reach[n] = 1; q.push(n); } } } }
  const nearReach = (x: number, z: number, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (reach[g.kAt(x + dx, z + dz)]) return true; return false; };
  const warns: string[] = []; const unreachable: string[] = []; const heightDelta: Record<string, { max: number; n: number }> = {};
  for (const p of g.anchors.points) { const r = p.kind === "fish" ? 4 : 1; if (!nearReach(p.x, p.z, r)) unreachable.push(`${p.kind}:${p.id}`);
    const d = Math.abs(g.groundAt(p.x, p.z) - paleHollowGroundHeight(p.x, p.z)); const e = (heightDelta[p.kind] ??= { max: 0, n: 0 }); e.max = Math.max(e.max, +d.toFixed(2)); e.n++; }
  report.anchorsChecked = g.anchors.points.length; report.unreachableAnchors = unreachable; report.anchorHeightDeltaVsLegacy = heightDelta;
  if (unreachable.length) fails.push(`${unreachable.length} unreachable anchors`);
  // (3) rivers: water surface monotone downstream; creeks route downhill and terminate in river/lake (or leave the map)
  { const prof = (f: (z: number) => number, z0: number, z1: number) => { let up = 0; for (let z = z0; z < z1; z += 1) if (f(z + 1) > f(z) + 1e-6) up++; return up; };
    report.riverUphillSteps = { main: prof(g.mainY, 40, 308), tributary: prof(g.tribY, 40, 200) };
    let uphill = 0, endsOk = 0, endsBad = 0, endsOff = 0; const badEnds: { x: number; z: number }[] = [];
    for (let k = 0; k < N; k++) if (g.creek[k]) { const r = g.rec[k]!; if (r >= 0 && g.h[r]! > g.h[k]! + 1e-6) uphill++;
      // only trace from heads (no creek upstream)
      let head = true; const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const n = (j + dj) * W + i + di; if (n >= 0 && n < N && g.creek[n] && g.rec[n] === k) { head = false; break; } } if (!head) continue;
      let c = k, steps = 0; while (c >= 0 && !g.water[c] && steps++ < 5000) { const nx = g.rec[c]!; if (nx < 0) break; c = nx; }
      if (c >= 0 && g.water[c]) endsOk++; else { const ci = c % W, cj = (c / W) | 0; if (!ci || !cj || ci === W - 1 || cj === H - 1) endsOff++; else { endsBad++; badEnds.push({ x: X(ci), z: Zf(cj) }); } } }
    // rivers flow downhill: every river (non-lake) water cell must have a downstream water neighbour with surface <= its own,
    // and its D8 receiver on the final (depression-filled) DEM must be lower or equal. Lake cells are the terminal sink.
    { let surfViol = 0, bedViol = 0, isolated = 0; const sv: { x: number; z: number }[] = [];
      // water cells not 8-connected to the lake / map edge are resampling specks of the legacy footprint, not channels
      const conn = new Uint8Array(N); { const st: number[] = []; for (let k = 0; k < N; k++) if (g.water[k] && (g.lake[k] || k % W === 0 || k % W === W - 1 || k < W || k >= N - W)) { conn[k] = 1; st.push(k); }
        while (st.length) { const k = st.pop()!; const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (g.water[n] && !conn[n]) { conn[n] = 1; st.push(n); } } } }
      for (let k = 0; k < N; k++) { if (!g.water[k] || g.lake[k]) continue; if (!conn[k]) { isolated++; continue; } const i = k % W, j = (k / W) | 0; let ok = false;
        for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) { ok = true; continue; } const n = nj * W + ni;
          if (g.water[n] && (g.lake[n] || g.wy[n]! <= g.wy[k]! + 1e-6) && n !== k) ok = true; }
        if (!ok && g.fixed[k]) { report.riverFlowAnchorConflictCells = (report.riverFlowAnchorConflictCells ?? 0) + 1; continue; } if (!ok) { surfViol++; if (sv.length < 10) sv.push({ x: g.X(k), z: g.Z(k) }); }
        const r = g.rec[k]!; if (r >= 0 && g.h[r]! > g.h[k]! + 1e-6) bedViol++; }
      report.riverFlow = { isolatedLegacyWaterSpecks: isolated, surfaceLocalMinimaOutsideLake: surfViol, bedUphillReceivers: bedViol, examples: sv };
      if (surfViol) fails.push(`${surfViol} river surface cells with no downstream`); if (bedViol) fails.push(`${bedViol} river bed uphill receivers`); }
    // water depth tiers: roads over deep water need a bridge; bridges must span deep water; render vs walk classes
    { const dc = g.depthClass; let deepNoBridge = 0, fords = 0; const dnbEx: any[] = [], dwEx: any[] = []; const cls = [0, 0, 0, 0];
      for (let k = 0; k < N; k++) { cls[dc[k]!]++; if (!g.road[k]) continue; const onBr = paleHollowOnBridge(g.X(k), g.Z(k));
        if (dc[k]! >= 2 && !onBr) { deepNoBridge++; if (dnbEx.length < 6) dnbEx.push({ x: g.X(k), z: g.Z(k), depth: +g.depth[k]!.toFixed(2) }); } if (dc[k] === 1 && !onBr) fords++; }
      const bridgeSpans = PH_BRIDGE_SITES.map((s) => { const b = paleHollowBridgeGeom(s); let deep = 0, n = 0; for (let t = -b.spanHalf; t <= b.spanHalf; t += 0.5) { const k = g.kAt(b.x + b.spanDir.x * t, b.zWorld + b.spanDir.z * t); if (g.water[k]) { n++; if (g.depthClass[k]! >= 2) deep++; } } return { id: s.id, waterCells: n, deepCells: deep, ok: deep > 0 }; });
      // render/walk agreement on the baked grid: deep => blocked flag, creek ford => water flag without blocked
      const z = decode(bakeGenerated(g)); let anchorConflictDeepWalk = 0, deepWalkable = 0, fordBlocked = 0, shallowBlockedByLegacy = 0;
      for (let j = 0; j < z.h; j++) for (let i = 0; i < z.w; i++) { const x = z.minX + i * z.cell, zz = z.minZ + j * z.cell, q = j * z.w + i, k = g.kAt(x, zz); const f = z.flags[q]!;
        if (!(f & 1) || (f & 4)) continue; const c = g.depthClass[k]!; if (c >= 2 && !(f & 8) && g.fixed[k]) { anchorConflictDeepWalk++; continue; } if (c >= 2 && !(f & 8)) { deepWalkable++; if (dwEx.length < 8 && deepWalkable % 40 === 1) dwEx.push({ x, z: zz, depth: +g.depth[k]!.toFixed(2), lake: g.lake[k] }); } if (g.creek[k] && (f & 8) && paleHollowWalkable(x, zz)) fordBlocked++; if (c === 1 && g.water[k] && (f & 8)) shallowBlockedByLegacy++; }
      report.waterDepth = { shallowMaxM: g.SHALLOW_MAX, cellsByClass: { dry: cls[0], shallow: cls[1], deep: cls[2], lakeDeep: cls[3] }, roadCellsOnDeepWithoutBridge: deepNoBridge, deepNoBridgeExamples: dnbEx, deepWalkableExamples: dwEx, roadFordCells: fords, bridgeSpans, deepWalkableBazCells: deepWalkable, legacyBridgeBankBelowWaterConflictCells: anchorConflictDeepWalk, creekFordsBlockedCells: fordBlocked,
        shallowRiverEdgeBlockedByServerContract: shallowBlockedByLegacy };
      if (deepNoBridge) fails.push(`${deepNoBridge} road cells on deep water without bridge`); for (const b of bridgeSpans) if (!b.ok) fails.push(`bridge ${b.id} spans only shallow water`);
      if (deepWalkable) fails.push(`${deepWalkable} deep cells walkable in BAZ`); if (fordBlocked) fails.push(`${fordBlocked} ford cells blocked`); }
    report.creeks = { cells: g.creek.reduce((s, v) => s + v, 0), uphillLinks: uphill, headsEndingInRiverOrLake: endsOk, headsLeavingMap: endsOff, headsEndingInPit: endsBad, pitEnds: badEnds.slice(0, 10) };
    if (uphill) fails.push(`${uphill} uphill creek links`);
    // lake: terminal (endorheic) — no dry cell bordering the lake lower than its surface
    let leak = 0, minRim = 1e9; for (let k = 0; k < N; k++) if (g.lake[k]) { const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const n = (j + dj) * W + i + di; if (n < 0 || n >= N || g.water[n]) continue; minRim = Math.min(minRim, g.h[n]!); if (g.h[n]! < g.LAKE_Y) leak++; } }
    report.lake = { surface: +g.LAKE_Y.toFixed(3), minDryRim: +minRim.toFixed(3), rimCellsBelowSurface: leak, type: "endorheic (terminal) — rivers end here" };
    if (leak) fails.push(`lake rim below surface at ${leak} cells`); }
  // (4) bridges span water, both ends dry + walkable + reachable
  report.bridges = PH_BRIDGE_SITES.map((s) => { const b = paleHollowBridgeGeom(s); const mid = g.water[g.kAt(b.x, b.zWorld)] === 1;
    const ends = [-1, 1].map((k) => { const x = b.x + b.spanDir.x * (b.spanHalf + 1.5) * k, z = b.zWorld + b.spanDir.z * (b.spanHalf + 1.5) * k; return { dry: !g.water[g.kAt(x, z)], reach: nearReach(x, z, 1) }; });
    const ok = mid && ends.every((e) => e.dry && e.reach); if (!ok) fails.push(`bridge ${s.id}`); return { id: s.id, overWater: mid, ends, ok }; });
  // (5) roads
  report.roads = g.roads.map((r) => ({ from: r.from, to: r.to, name: r.name, connected: r.ok, lengthM: r.pts.length * 2, maxGrade: +r.maxGrade.toFixed(3), fords: r.fords, bridgeCells: r.bridgeCells }));
  for (const r of g.roads) if (!r.ok) fails.push(`road ${r.from}->${r.to} not connected`);
  // (6) props: none in blocking water, none floating/buried, trees not on steep slopes
  { let wet = 0, steep = 0, floatBur = 0, tooClose = 0; const veg = g.props.filter((p) => p.kind < 30 || p.kind === 44 || p.kind === 45);
    for (const p of veg) { const k = g.kAt(p.x, p.z); if (g.water[k]) wet++; if (p.kind < 10 && g.slope[k]! > 0.65) steep++; if (Math.abs(p.y - g.groundAt(p.x, p.z)) > 0.6) floatBur++; }
    const trees = veg.filter((p) => p.kind < 10); const cellMap = new Map<string, typeof trees>(); for (const t of trees) { const key = `${Math.floor(t.x / 4)},${Math.floor(t.z / 4)}`; (cellMap.get(key) ?? cellMap.set(key, []).get(key)!).push(t); }
    for (const t of trees) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of cellMap.get(`${Math.floor(t.x / 4) + a},${Math.floor(t.z / 4) + b}`) ?? []) if (o !== t && Math.hypot(o.x - t.x, o.z - t.z) < 1.5) tooClose++;
    // spacing regularity: nearest-neighbour coefficient of variation (grid scatter -> ~0; natural clustering -> >0.4)
    const nn = trees.slice(0, 1500).map((t) => { let m = 1e9; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const o of cellMap.get(`${Math.floor(t.x / 4) + a},${Math.floor(t.z / 4) + b}`) ?? []) if (o !== t) m = Math.min(m, Math.hypot(o.x - t.x, o.z - t.z)); return m; }).filter((v) => v < 1e8);
    const mean = nn.reduce((s, v) => s + v, 0) / nn.length, cv = Math.sqrt(nn.reduce((s, v) => s + (v - mean) ** 2, 0) / nn.length) / mean;
    report.props = { total: g.props.length, vegetationAndRocks: veg.length, trees: trees.length, civicKeptFromLegacy: g.civicKept, inWater: wet, treesOnSteep: steep, floatingOrBuried: floatBur, treePairsCloserThan1_5m: tooClose / 2, treeNearestNeighbourCV: +cv.toFixed(2), rejects: g.vegRejects };
    if (wet || steep || floatBur) fails.push("prop placement"); }
  // (7) terrain realism stats
  { const sl = Array.from(g.slope).sort((a, b) => a - b); const q = (p: number) => +sl[Math.floor(p * (sl.length - 1))]!.toFixed(3);
    let hMin = 1e9, hMax = -1e9; for (const v of g.h) { hMin = Math.min(hMin, v); hMax = Math.max(hMax, v); }
    let lmin = 1e9, lmax = -1e9; for (const v of leg.y) { lmin = Math.min(lmin, v); lmax = Math.max(lmax, v); }
    const steepCells = g.slope.reduce((s, v) => s + (v > steepLimit ? 1 : 0), 0);
    const counts: Record<string, number> = {}; for (const b of gen.biome) counts[b] = (counts[b] ?? 0) + 1;
    report.terrain = { reliefAfter: [+hMin.toFixed(1), +hMax.toFixed(1)], reliefBefore: [+lmin.toFixed(1), +lmax.toFixed(1)], slopeP50: q(0.5), slopeP90: q(0.9), slopeP99: q(0.99), cellsSteeperThan45deg: steepCells, biomeCellShare: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / N).toFixed(3)])) }; }
  report.lore = g.lore;
  // Whittaker sanity: zonal eco vs the temperature/precipitation class (azonal riparian/wetland/playa/rock/farm exempt)
  { const want: Record<string, number[]> = { tundra: [1, 6], boreal: [1], "temperate-rainforest": [1, 2], "temperate-forest": [1, 2], woodland: [2, 4], grassland: [4, 2, 5], "desert-shrub": [5, 4] };
    let zonal = 0, ok = 0; const cls: Record<string, number> = {}; for (let k = 0; k < N; k++) { const e = g.eco[k]!; const w = g.whitt[k]; if (!w || [0, 3, 6, 7, 8, 9].includes(e)) continue; zonal++; cls[w] = (cls[w] ?? 0) + 1; if (want[w]!.includes(e)) ok++; }
    const share: Record<string, number> = {}; let land = 0; for (let k = 0; k < N; k++) if (!g.water[k]) { land++; share[g.biome[k]!] = (share[g.biome[k]!] ?? 0) + 1; }
    const top = Math.max(...Object.values(share)) / land;
    report.whittaker = { zonalCells: zonal, consistent: +(ok / Math.max(1, zonal)).toFixed(3), classes: cls, dominantBiomeShare: +top.toFixed(3) };
    if (ok / Math.max(1, zonal) < 0.95) fails.push("Whittaker consistency < 95%"); if (top > 0.45) warns.push(`one biome covers ${(top * 100).toFixed(0)}% of land`); }

  { const wc = g.lore.find((l) => l.kind === "time-mage-warp-circle"); report.warpCircle = wc ? { ...wc, reachable: nearReach(wc.x, wc.z, 1) } : null;
    if (!wc || !nearReach(wc.x, wc.z, 1)) fails.push("warp-circle site missing or unreachable"); }
  // ---------- Walkability + anchors overlay
  const color: Record<string, [number, number, number]> = { spawn: [255, 255, 255], npc: [255, 220, 0], node: [0, 255, 120], fish: [0, 220, 255], mob: [255, 120, 0], gate: [255, 0, 255], link: [255, 0, 255], pvp: [255, 60, 60], "bridge-end": [255, 255, 255] };
  // water depth tiers + roads: shallow fords cyan, deep channel navy, lake-deep black-blue, roads tan, bridges orange
  out.push(await png(`${region}_water_depth_after.png`, W, H, (i, j) => { const k = j * W + i; const s = shade(gen.y, W, H, i, j); const c = g.depthClass[k]!;
    if (c === 1) return [90, 220, 230]; if (c === 2) return [20, 50, 150]; if (c === 3) return [5, 15, 60];
    if (paleHollowOnBridge(X(i), Zf(j))) return [240, 140, 30]; if (g.road[k]) return [210, 180, 120]; return [90 * s, 95 * s, 85 * s] as [number, number, number]; }, 2));
  out.push(await png(`${region}_walkability_anchors_after.png`, W, H, (i, j) => { const k = j * W + i; const s = shade(gen.y, W, H, i, j);
    if (gen.flags[k]! & 8) return [150, 30, 30]; if (gen.flags[k]! & 1) return [40, 90, 170]; if (gen.flags[k]! & 4) return [200, 160, 100]; if (gen.flags[k]! & 2) return [210, 200, 120];
    if (!walk[k]) return [110, 40, 110]; if (!reach[k]) return [90, 0, 0]; if (g.padW[k]! > 0.5) return [90 * s, 110 * s, 140 * s] as [number, number, number]; return [70 * s, 85 * s, 70 * s] as [number, number, number]; }, 2,
    (put) => { for (const p of g.anchors.points) { const i = Math.round(p.x - g.minX), j = Math.round(p.z - g.minZ); const c = color[p.kind] ?? [255, 255, 255]; const r = p.kind === "mob" ? 0 : 1;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) put(i + a, j + b, c); }
      for (const l of g.lore) { const i = Math.round(l.x - g.minX), j = Math.round(l.z - g.minZ); for (let a = -3; a <= 3; a++) { put(i + a, j + a, [255, 0, 200]); put(i + a, j - a, [255, 0, 200]); } }
      for (const u of unreachable) { const p = g.anchors.points.find((q) => `${q.kind}:${q.id}` === u)!; const i = Math.round(p.x - g.minX), j = Math.round(p.z - g.minZ); for (let a = -5; a <= 5; a++) { put(i + a, j, [255, 0, 0]); put(i, j + a, [255, 0, 0]); } } }));
  // ---------- Before|after composite
  { const files = [`${region}_elevation_before.png`, `${region}_elevation_after.png`, `${region}_biome_before.png`, `${region}_biome_after.png`].map((f) => resolve(IMG, f));
    const w2 = W * 2, h2 = H * 2; await sharp({ create: { width: w2 * 4 + 30, height: h2, channels: 3, background: "#111" } }).composite(files.map((f, i) => ({ input: f, left: i * (w2 + 10), top: 0 }))).png().toFile(resolve(IMG, `${region}_compare_before_after.png`));
    out.push(resolve(IMG, `${region}_compare_before_after.png`)); }
  // ---------- Optional cell diff vs an older generated BAZ
  const diffPath = arg("--diff"); if (diffPath && existsSync(diffPath)) { const a = decode(readFileSync(diffPath)), b = decode(bakeGenerated(g)); let dh = 0, db = 0, df = 0; let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (let k = 0; k < a.biome.length; k++) { const ch = Math.abs(a.y[k]! - b.y[k]!) > 0.05 || a.biome[k] !== b.biome[k] || a.flags[k] !== b.flags[k]; if (Math.abs(a.y[k]! - b.y[k]!) > 0.05) dh++; if (a.biome[k] !== b.biome[k]) db++; if (a.flags[k] !== b.flags[k]) df++;
      if (ch) { const x = a.minX + (k % a.w) * a.cell, z = a.minZ + Math.floor(k / a.w) * a.cell; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); } }
    report.diff = { against: diffPath, heightCells: dh, biomeCells: db, flagCells: df, bbox: dh + db + df ? [bx0, bz0, bx1, bz1] : null }; }
  // Bake this exact run next to the legacy zone and render both through the game's own minimap code (engine
  // Minimap::bake via examples/minimap_png.rs). Set MINIMAP_BIN to the built example to enable.
  { const zones = resolve(HERE, "../../public/zones"); writeFileSync(resolve(zones, `${region}_gen.baz`), bakeGenerated(g)); writeFileSync(resolve(zones, `${region}_gen.bap`), encodeProps(g.props));
    const bin = process.env.MINIMAP_BIN; if (bin && existsSync(bin)) for (const [zid, tag] of [[region, "before"], [`${region}_gen`, "after"]] as const) {
      const ppm = `/tmp/mm_${tag}.ppm`; execFileSync(bin, [resolve(zones, `${zid}.baz`), resolve(zones, `${zid}.bap`), ppm]);
      const f = `${IMG}/minimap-${tag}.png`; const buf = readFileSync(ppm); const m = /^P6\n(\d+) (\d+)\n255\n/.exec(buf.subarray(0, 32).toString("latin1"))!;
      await sharp(buf.subarray(m[0].length), { raw: { width: +m[1]!, height: +m[2]!, channels: 3 } }).png().toFile(f); out.push(f); } }
  report.warnings = warns; report.hardFailures = fails; report.images = out;
  writeFileSync(resolve(HERE, "out", `${region}.validation.json`), JSON.stringify(report, null, 2));
  writeFileSync(resolve(IMG, `${region}.validation.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, lore: undefined, roads: undefined, images: out.length }, null, 1));
  if (fails.length) process.exitCode = 1;
}
void main();
void paleHollowStandHeight;
