/**
 * Grand Cartographic Engine — generic field generator + reviewer for the chain fields north of the Seam Ridge.
 * Contract (server untouched): every walkable cell keeps the legacy stand height, walkability, water footprint,
 * bridge decks and trail flags exactly; only blocked scenery relief, scenery creeks, biomes and props are generated.
 * Continent coords = the game's own ZONE_ORIGINS (zone-layout.ts), so adjacent bands share one continuous relief field.
 * Usage: tsx scripts/worldgen/generate-field.ts <field_id>   (writes public/zones/<id>_gen.{baz,bap}; legacy files untouched)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { ZONE_FIELDS, ZONE_LINKS, zoneOrigin } from "@bellgrave/config";
import { K, encodeProps, type Prop } from "../bake-props";
import { BIOMES } from "../bake-zones";
import { coilPassProps } from "../zone-props/coil-pass";
import { coilRidgeProps } from "../zone-props/coil-ridge";
import { greenReachProps } from "../zone-props/green-reach";
import { isletFordsProps } from "../zone-props/islet-fords";
import { ringWardProps } from "../zone-props/ring-ward";
import { hollowRoadProps } from "../zone-props/hollow-road";
import { spurRoadProps } from "../zone-props/spur-road";
import { forestBasinProps } from "../bake-props";
import { Noise2, hashSeed, mulberry32 } from "./noise";
import { D8, d8Receivers, accumulate, distanceTo, priorityFill } from "./grid";
import { whittaker } from "./generate";

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync(resolve(HERE, "regions.json"), "utf8"));
const IMG = "/workspace/worldgen-review";
const LEGACY_PROPS: Record<string, () => Prop[]> = { hollow_road: hollowRoadProps, forest_basin: forestBasinProps, spur_road: spurRoadProps, ring_ward: ringWardProps, islet_fords: isletFordsProps, green_reach: greenReachProps, coil_pass: coilPassProps, coil_ridge: coilRidgeProps };
const KEEP_BIOME = new Set(["hub_indoor", "bridge", "crypt", "quarry", "ore_seam", "ash_road", "river", "riverbank", "farm", "terrace", "ashbeam"]);
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segD(px: number, pz: number, ax: number, az: number, bx: number, bz: number) { const dx = bx - ax, dz = bz - az; const L = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)); return Math.hypot(px - ax - t * dx, pz - az - t * dz); }

/** Seam Country continental relief (world metres, game scale) — see regions.json "seamCountry". */
export function continent() {
  const sc = CFG.seamCountry; const n = new Noise2(hashSeed(sc.seed, "continent"));
  const E = (X: number, Z: number) => {
    const wx = X + n.fbm(X / 400, Z / 400, 3) * 60, wz = Z + n.fbm(X / 400 + 9, Z / 400 - 4, 3) * 60;
    let e = 0;
    for (const r of sc.ranges) { let d = Infinity; for (let i = 1; i < r.line.length; i++) d = Math.min(d, segD(wx, wz, r.line[i - 1][0], r.line[i - 1][1], r.line[i][0], r.line[i][1]));
      let hgt = r.height; for (const p of r.passes ?? []) hgt *= 1 - p[2] * Math.exp(-(((wz - p[0]) / p[1]) ** 2));
      e += hgt * Math.exp(-((d / r.width) ** 2)); }
    for (const v of sc.valleys) { let d = Infinity; for (let i = 1; i < v.line.length; i++) d = Math.min(d, segD(wx, wz, v.line[i - 1][0], v.line[i - 1][1], v.line[i][0], v.line[i][1])); e -= v.depth * Math.exp(-((d / v.width) ** 2)); }
    e += sc.northTilt * Math.max(0, Z - sc.tiltFrom);
    return e;
  };
  /** mean annual T (C) and P (mm): westerlies spill through the Coil Gap in the Westwall, river corridor damp, lapse with height. */
  const climate = (X: number, Z: number, e: number) => {
    let P = sc.basePrecip; for (const g of sc.wetBands) P += g[2] * Math.exp(-(((Z - g[0]) / g[1]) ** 2));
    P += sc.orographic * Math.max(0, e) - sc.eastDrying * (X + 200);
    const T = sc.baseTemp - sc.lapse * e - sc.latGrad * (Z - 500);
    return { T, P: Math.max(80, P) };
  };
  return { E, climate };
}

const WHITT_BIOME: Record<string, string> = { tundra: "mountain", boreal: "grass", "desert-shrub": "scrub", grassland: "meadow", woodland: "grass", "temperate-forest": "grass", "temperate-rainforest": "vine_cliff" };

export function generateField(id: string, cell = 0.5) {
  const f = ZONE_FIELDS[id]; if (!f) throw new Error(`no field ${id}`);
  const rc = CFG.fields[id]; const seed = rc.seed; const o = zoneOrigin(id); const { E, climate } = continent();
  const { minX, maxX, minZ, maxZ } = f.bounds; const W = Math.ceil((maxX - minX) / cell) + 1, H = Math.ceil((maxZ - minZ) / cell) + 1, N = W * H;
  const X = (k: number) => minX + (k % W) * cell, Z = (k: number) => minZ + ((k / W) | 0) * cell;
  const walk = new Uint8Array(N), wet = new Uint8Array(N), br = new Uint8Array(N), legacyY = new Float32Array(N), wy = new Float32Array(N), lbio = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const x = X(k), z = Z(k); walk[k] = f.walkable(x, z) ? 1 : 0; const w = f.water(x, z); const ob = f.onBridge(x, z); br[k] = ob ? 1 : 0;
    legacyY[k] = f.stand(x, z); if (w != null && (f.openWater(x, z) || ob)) { wet[k] = 1; wy[k] = w; } lbio[k] = Math.max(0, BIOMES.indexOf(f.biome(x, z) as any)); }
  // ---- scenery relief on blocked dry cells ----
  const nr = new Noise2(hashSeed(seed, "ridge")), nf = new Noise2(hashSeed(seed, "fine")), nd = new Noise2(hashSeed(seed, "dissect"));
  const fixedMask = new Uint8Array(N); for (let k = 0; k < N; k++) if (walk[k] || wet[k]) fixedMask[k] = 1;
  const dWalk = distanceTo(fixedMask, W, H).d; // cells to nearest gameplay cell
  const h = new Float32Array(N); const eAbs = new Float32Array(N);
  const eRef = E(o.x + (minX + maxX) / 2, o.z + (minZ + maxZ) / 2);
  for (let k = 0; k < N; k++) { const x = X(k), z = Z(k), wx = o.x + x, wz = o.z + z; const e = E(wx, wz); eAbs[k] = e;
    if (fixedMask[k]) { h[k] = wet[k] ? wy[k]! : legacyY[k]!; continue; }
    const d = dWalk[k]! * cell; const t = sstep(0, rc.blendM, d);
    const ridged = 1 - Math.abs(nr.fbm(wx / 70, wz / 70, 4)); const fine = nf.fbm(wx / 18, wz / 18, 3);
    const big = Math.max(0, e - eRef + rc.reliefBias) * rc.continentGain;
    let rel = big + rc.ridgeAmp * ridged * ridged + rc.fineAmp * fine;
    // hillslope dissection: inverted ridged noise carves V gullies, stronger on steep relief
    const g = Math.abs(nd.fbm(wx / 26 + 3, wz / 26 - 2, 3)); rel -= rc.dissection * (1 - Math.min(1, g * 3)) * sstep(2, 8, rel);
    // edge undulation so blocked rims never read as a perfect arc/line
    const lip = 0.6 * sstep(0, 2.5, d) * (0.5 + 0.5 * nf.fbm(wx / 6, wz / 6, 2));
    h[k] = legacyY[k]! + lip + t * Math.max(0.3, rel); }
  // hydrologic conditioning of scenery only (gameplay cells fixed)
  const seedM = new Uint8Array(N); for (let k = 0; k < N; k++) if (wet[k]) seedM[k] = 1;
  const raised = priorityFill(h, W, H, seedM, fixedMask, 1e-3);
  // ---- scenery creeks: D8 on blocked relief, kept only when the path drains to legacy water or the map edge ----
  const sink = new Uint8Array(N); for (let k = 0; k < N; k++) if (fixedMask[k]) sink[k] = 1;
  const rec = d8Receivers(h, W, H, sink); const acc = accumulate(h, rec); const thr = rc.creekThreshold / (cell * cell);
  const creek = new Uint8Array(N); const creekSegs: { pts: [number, number][]; end: string; catchM2: number }[] = [];
  const seen = new Uint8Array(N);
  const heads: number[] = []; for (let k = 0; k < N; k++) if (!fixedMask[k] && acc[k]! >= thr) { let up = false; for (const [di, dj] of D8) { const i = (k % W) + di, j = ((k / W) | 0) + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const n = j * W + i; if (rec[n] === k && acc[n]! >= thr) { up = true; break; } } if (!up) heads.push(k); }
  for (const hd of heads) { const path: number[] = []; let c = hd; let end = "pit";
    while (c >= 0) { path.push(c); if (seen[c]) { end = "join"; break; } const r = rec[c]!; if (r < 0) { const i = c % W, j = (c / W) | 0; end = (i === 0 || j === 0 || i === W - 1 || j === H - 1) ? "edge" : "pit"; break; } if (wet[r]) { end = "water"; break; } if (walk[r]) { end = "floor"; break; } c = r; }
    if (end === "floor" || end === "pit") continue; if (path.length < 8) continue;
    for (const p of path) { seen[p] = 1; creek[p] = 1; }
    let pts = path.map((p) => [X(p), Z(p)] as [number, number]);
    for (let it = 0; it < 3; it++) { const q: [number, number][] = [pts[0]!]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!; q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } q.push(pts[pts.length - 1]!); pts = q; }
    creekSegs.push({ pts, end, catchM2: acc[path[path.length - 1]!]! * cell * cell }); }
  // ---- climate + Whittaker biomes ----
  const biome = new Uint8Array(N); const wcls: string[] = new Array(N); const T = new Float32Array(N), P = new Float32Array(N);
  const ne = new Noise2(hashSeed(seed, "ecotone"));
  for (let k = 0; k < N; k++) { const wx = o.x + X(k), wz = o.z + Z(k); const c = climate(wx, wz, eAbs[k]! + (h[k]! - legacyY[k]!) * 0.5);
    const jitter = 1 + 0.18 * ne.fbm(wx / 40, wz / 40, 3); T[k] = c.T; P[k] = c.P * jitter * (wet[k] || creek[k] ? 1.3 : 1);
    const cls = whittaker(T[k]!, P[k]!); wcls[k] = cls; const lb = BIOMES[lbio[k]!]!;
    if (KEEP_BIOME.has(lb) && !(lb === "crypt" && !walk[k])) { biome[k] = lbio[k]!; continue; }
    let b = WHITT_BIOME[cls]!; const i = k % W, j = (k / W) | 0;
    const sl = i > 0 && i < W - 1 && j > 0 && j < H - 1 ? Math.hypot(h[k + 1]! - h[k - 1]!, h[k + W]! - h[k - W]!) / (2 * cell) : 0;
    if (!walk[k] && sl > 1.1) b = "mountain"; else if (!walk[k] && sl > 0.7 && b !== "scrub") b = "vine_cliff";
    biome[k] = BIOMES.indexOf(b as any); }
  // ---- props: legacy kept verbatim; vegetation only on blocked dry scenery, density graded by distance to the floor ----
  const legacy = LEGACY_PROPS[id]!(); const props: Prop[] = [...legacy];
  const rnd = mulberry32(hashSeed(seed, "veg")); const occ = new Map<number, [number, number, number][]>(); const BK = 4; const key = (a: number, b: number) => a * 100003 + b;
  const free = (x: number, z: number, r: number) => { const a = Math.floor(x / BK), b = Math.floor(z / BK); for (let u = a - 1; u <= a + 1; u++) for (let v = b - 1; v <= b + 1; v++) for (const p of occ.get(key(u, v)) ?? []) if (Math.hypot(p[0] - x, p[1] - z) < Math.max(r, p[2])) return false; return true; };
  const put = (x: number, z: number, r: number) => { const kk = key(Math.floor(x / BK), Math.floor(z / BK)); (occ.get(kk) ?? occ.set(kk, []).get(kk)!).push([x, z, r]); };
  for (const p of legacy) put(p.x, p.z, 2);
  const kAt = (x: number, z: number) => Math.max(0, Math.min(H - 1, Math.round((z - minZ) / cell))) * W + Math.max(0, Math.min(W - 1, Math.round((x - minX) / cell)));
  const tries = Math.round((maxX - minX) * (maxZ - minZ) * rc.vegTries); const vstat: Record<string, number> = {};
  for (let t = 0; t < tries; t++) { const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ); const k = kAt(x, z);
    if (fixedMask[k] || creek[k]) continue; const d = dWalk[k]! * cell; if (d < 1.5) continue;
    const cls = wcls[k]!; const bname = BIOMES[biome[k]!]; const edge = sstep(1.5, 14, d);
    let dens = 0, kind: number = K.pine, r = 3, sc = 1;
    if (bname === "mountain") { dens = 0.12; kind = rnd() < 0.6 ? K.rock : K.stone; r = 3; sc = 0.6 + rnd() * 1.2; }
    else if (cls === "boreal") { dens = 0.8 * edge; kind = rnd() < 0.6 ? K.spruce : K.pine; r = 3.2; sc = 0.8 + rnd() * 0.5; }
    else if (cls === "temperate-forest" || cls === "temperate-rainforest") { dens = 0.75 * edge; const q = rnd(); kind = q < 0.35 ? K.ashTall : q < 0.6 ? K.ashMed : q < 0.8 ? K.pine : K.fern; r = kind === K.fern ? 1.5 : 3.5; sc = 0.8 + rnd() * 0.5; }
    else if (cls === "woodland") { dens = 0.4 * edge + 0.1; const q = rnd(); kind = q < 0.4 ? K.ashMed : q < 0.6 ? K.cypress : q < 0.8 ? K.bush : K.tallPatch; r = kind === K.bush || kind === K.tallPatch ? 1.6 : 3.5; sc = 0.7 + rnd() * 0.5; }
    else if (cls === "grassland") { dens = 0.3; const q = rnd(); kind = q < 0.5 ? K.longGrass : q < 0.75 ? K.tuft : q < 0.9 ? K.bloom : K.sapling; r = 1.4; sc = 0.7 + rnd() * 0.5; }
    else { dens = 0.18; kind = rnd() < 0.6 ? K.scrub : K.rock; r = 2; sc = 0.5 + rnd() * 0.6; }
    if (rnd() > dens) continue; if (!free(x, z, r)) continue; put(x, z, r); vstat[kind] = (vstat[kind] ?? 0) + 1;
    props.push({ kind, v: Math.floor(rnd() * 4), x, z, y: h[k]! - (kind === K.rock || kind === K.stone ? 0.15 * sc : 0), yaw: rnd() * Math.PI * 2, s: sc, w: 0, h: 0, d: 0 }); }
  // ---- anchors + Time Mage warp circle (data hook only) ----
  const arrivals = ZONE_LINKS.filter((l: any) => l.to === id).map((l: any) => ({ id: `arrive:${l.id}`, x: l.spawn.x, z: l.spawn.z, from: l.from }));
  const gates = f.gates.map((g) => ({ id: `gate:${g.id}`, x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2, blocked: g.blocked, dest: g.destZone }));
  const anchors = [{ id: "spawn", x: f.spawn.x, z: f.spawn.z }, ...arrivals, ...gates];
  const entry = arrivals.find((a) => a.from === rc.entryFrom) ?? arrivals[0] ?? anchors[0]!;
  const trailPts = f.trails().flatMap((t) => t.points);
  const okDisc = (x: number, z: number, r: number) => { for (let a = 0; a < 16; a++) for (const rr of [r * 0.5, r]) { const k = kAt(x + Math.cos(a * Math.PI / 8) * rr, z + Math.sin(a * Math.PI / 8) * rr); if (!walk[k] || wet[k] || br[k]) return false; } return !wet[kAt(x, z)]; };
  let best: { x: number; z: number; s: number } | null = null;
  for (let z = minZ + 6; z <= maxZ - 6; z += 1) for (let x = minX + 6; x <= maxX - 6; x += 1) {
    if (!okDisc(x, z, 5.5)) continue; if (anchors.some((a) => Math.hypot(a.x - x, a.z - z) < 12)) continue;
    if (legacy.some((p) => Math.hypot(p.x - x, p.z - z) < 6.5)) continue;
    const dE = Math.hypot(entry.x - x, entry.z - z); let dT = Infinity; for (const p of trailPts) dT = Math.min(dT, Math.hypot(p.x - x, p.z - z));
    const s = -Math.abs(dE - rc.warpEntryM) - 0.8 * Math.max(0, dT - 7) + (rc.warpBias ? -Math.hypot(x - rc.warpBias[0], z - rc.warpBias[1]) * 0.5 : 0);
    if (!best || s > best.s) best = { x, z, s }; }
  const warp = best ? { id: `warp-circle-${id}`, kind: "time-mage-warp-circle", x: best.x, z: best.z, y: legacyY[kAt(best.x, best.z)]!, radius: 5, why: rc.warpWhy, hook: rc.warpHook } : null;
  if (warp) { for (let a = 0; a < 7; a++) { const ang = (a + 0.5) * (2 * Math.PI / 8) + Math.atan2(entry.z - warp.z, entry.x - warp.x); const x = warp.x + Math.cos(ang) * 5, z = warp.z + Math.sin(ang) * 5; props.push({ kind: K.stone, v: a % 4, x, z, y: legacyY[kAt(x, z)]! - 0.1, yaw: ang, s: 0.45, w: 0, h: 0, d: 0 }); } }
  return { id, f, W, H, N, cell, minX, minZ, maxX, maxZ, X, Z, kAt, walk, wet, br, legacyY, wy, h, creek, creekSegs, biome, wcls, T, P, props, legacyCount: legacy.length, vstat, anchors, warp, raised, origin: o };
}
export type FieldGen = ReturnType<typeof generateField>;

export function bakeField(g: FieldGen): Buffer {
  const { W, H, f } = g; const buf = Buffer.alloc(24 + W * H * 4);
  buf.write("BAZ1", 0, "ascii"); buf.writeFloatLE(g.minX, 4); buf.writeFloatLE(g.minZ, 8); buf.writeFloatLE(g.cell, 12); buf.writeUInt32LE(W, 16); buf.writeUInt32LE(H, 20);
  const segs = f.trails().flatMap((t) => t.points.slice(1).map((b, i) => ({ a: t.points[i]!, b, stone: t.surface === "stone" }))); const half = f.trailWidth / 2;
  const bio = 24, flg = 24 + W * H, hgt = 24 + W * H * 2;
  for (let k = 0; k < W * H; k++) { const x = g.X(k), z = g.Z(k); let flags = 0; let y = g.h[k]!;
    if (g.br[k]) { if (g.wet[k]) { flags |= 1; y = g.wy[k]!; } else { flags |= 4; y = g.legacyY[k]!; } } else if (g.wet[k]) { flags |= 1; y = g.wy[k]!; }
    if (!g.walk[k]) flags |= 8;
    if (!(flags & 5)) { for (const s of segs) if (segD(x, z, s.a.x, s.a.z, s.b.x, s.b.z) <= half) { flags |= 2 | (s.stone ? 16 : 0); break; } }
    if (!(flags & 5) && !g.walk[k] && g.creek[k]) { flags |= 1; y = g.h[k]! + 0.05; }
    buf.writeUInt8(g.biome[k]!, bio + k); buf.writeUInt8(flags, flg + k); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * 100))), hgt + k * 2); }
  return buf;
}

function readBaz(b: Buffer) { const W = b.readUInt32LE(16), H = b.readUInt32LE(20); return { W, H, bio: b.subarray(24, 24 + W * H), flg: b.subarray(24 + W * H, 24 + 2 * W * H), y: (k: number) => b.readInt16LE(24 + 2 * W * H + 2 * k) / 100 }; }

export async function reviewField(g: FieldGen, baz: Buffer, bap: Buffer) {
  const { W, H, N, walk, wet, br } = g; const R = readBaz(baz); const fails: string[] = []; const warns: string[] = [];
  // 1 server contract
  let blkMis = 0, hMis = 0, wMis = 0; for (let k = 0; k < N; k++) { if (!!(R.flg[k]! & 8) !== !walk[k]) blkMis++; if (walk[k] && !wet[k] && !br[k] && Math.abs(R.y(k) - Math.round(g.legacyY[k]! * 100) / 100) > 0.011) hMis++; if (wet[k] && Math.abs(R.y(k) - Math.round(g.wy[k]! * 100) / 100) > 0.011) wMis++; }
  if (blkMis) fails.push(`blocked-flag mismatches ${blkMis}`); if (hMis) fails.push(`walkable height mismatches ${hMis}`); if (wMis) fails.push(`legacy water surface mismatches ${wMis}`);
  // 2 anchors reachable over walkable cells from spawn (BFS)
  const reach = new Uint8Array(N); const s0 = g.kAt(g.f.spawn.x, g.f.spawn.z); const q = [s0]; reach[s0] = 1;
  while (q.length) { const k = q.pop()!; const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (!reach[n] && walk[n]) { reach[n] = 1; q.push(n); } } }
  const anchorRes = g.anchors.map((a: any) => { const k = g.kAt(a.x, a.z); let ok = !!reach[k]; if (!ok) for (let r = 1; r <= 4 && !ok; r++) for (const [di, dj] of D8) { const n = g.kAt(a.x + di * r * g.cell, a.z + dj * r * g.cell); if (reach[n]) { ok = true; break; } } return { id: a.id, x: a.x, z: a.z, walkable: !!walk[k], reachable: ok, blockedGate: a.blocked ?? false }; });
  const unreach = anchorRes.filter((a) => !a.reachable && !a.blockedGate); if (unreach.length) fails.push(`unreachable anchors: ${unreach.map((a) => a.id).join(",")}`);
  const blockedGatesUnreach = anchorRes.filter((a) => !a.reachable && a.blockedGate).map((a) => a.id);
  // 3 hydrology
  let uphill = 0; const ends: Record<string, number> = {}; for (const c of g.creekSegs) ends[c.end] = (ends[c.end] ?? 0) + 1;
  for (let k = 0; k < N; k++) if (g.creek[k]) { const i = k % W, j = (k / W) | 0; let lower = false, edge = i === 0 || j === 0 || i === W - 1 || j === H - 1; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if ((g.creek[n] || wet[n]) && (wet[n] ? g.wy[n]! : g.h[n]!) <= g.h[k]! + 1e-6 && n !== k) { lower = true; break; } } if (!lower && !edge) uphill++; }
  if (uphill) fails.push(`creek cells without a lower-or-equal downstream neighbour: ${uphill}`);
  let waterPits = 0; for (let k = 0; k < N; k++) if (wet[k]) { const i = k % W, j = (k / W) | 0; let ok = i === 0 || j === 0 || i === W - 1 || j === H - 1; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (wet[n] && g.wy[n]! <= g.wy[k]! + 1e-4) { ok = true; break; } } if (!ok) waterPits++; }
  if (waterPits) warns.push(`legacy water cells strictly lower than all wet neighbours (isolated pools): ${waterPits}`);
  // 4 depth tiers: walkable water = shallow ford (<=0.7 m); unwalkable water = deep; deep never walkable; bridges span deep water and land on both banks
  let ford = 0, deep = 0, deepWalk = 0, fordWade = 0; for (let k = 0; k < N; k++) { if (wet[k] && !br[k]) { if (walk[k]) ford++; else deep++; } else if (!wet[k] && walk[k] && !br[k] && g.f.water(g.X(k), g.Z(k)) != null) fordWade++; }
  const comp = new Int32Array(N).fill(-1); const spans: any[] = []; let nc = 0;
  for (let k0 = 0; k0 < N; k0++) if (br[k0] && comp[k0] < 0) { const st = [k0]; comp[k0] = nc; const cells: number[] = []; const banks = new Set<number>(); let overDeep = 0, overFord = 0;
    while (st.length) { const k = st.pop()!; cells.push(k); const i = k % W, j = (k / W) | 0; for (const [di, dj] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (br[n]) { if (comp[n] < 0) { comp[n] = nc; st.push(n); } } else if (walk[n] && !wet[n]) banks.add(n); else if (wet[n] && !walk[n]) overDeep++; else if (wet[n]) overFord++; } }
    // count distinct bank clusters
    const bl = [...banks]; const lab = new Map<number, number>(); let nb = 0; for (const b of bl) if (!lab.has(b)) { nb++; const s2 = [b]; lab.set(b, nb); while (s2.length) { const c = s2.pop()!; const ci = c % W, cj = (c / W) | 0; for (const [di, dj] of D8) { const n = (cj + dj) * W + ci + di; if (banks.has(n) && !lab.has(n)) { lab.set(n, nb); s2.push(n); } } } }
    spans.push({ id: nc, cells: cells.length, bankClusters: nb, overDeepEdges: overDeep, overFordEdges: overFord, center: [+(g.X(cells[0]!)).toFixed(1), +(g.Z(cells[0]!)).toFixed(1)] }); nc++; }
  for (const s of spans) { if (s.bankClusters < 2) warns.push(`bridge ${s.id} @${s.center} touches only ${s.bankClusters} bank cluster(s) (legacy geometry)`); if (s.overDeepEdges === 0 && s.overFordEdges > 0) warns.push(`legacy bridge ${s.id} @${s.center} spans only ford-depth water (fords preferred; flagged, not moved)`); }
  if (deepWalk) fails.push(`deep walkable ${deepWalk}`);
  // 5 warp circle
  let warpRes: any = null; if (g.warp) { const k = g.kAt(g.warp.x, g.warp.z); warpRes = { ...g.warp, reachable: !!reach[k], minAnchorDist: Math.min(...g.anchors.map((a: any) => Math.hypot(a.x - g.warp!.x, a.z - g.warp!.z))) }; if (!reach[k]) fails.push("warp circle unreachable"); } else fails.push("no warp-circle site");
  // 6 biomes / whittaker
  const share: Record<string, number> = {}; for (let k = 0; k < N; k++) { const b = BIOMES[g.biome[k]!]!; share[b] = (share[b] ?? 0) + 1 / N; }
  const whitt: Record<string, number> = {}; for (let k = 0; k < N; k++) whitt[g.wcls[k]!] = (whitt[g.wcls[k]!] ?? 0) + 1 / N;
  const dom = Object.entries(share).sort((a, b) => b[1] - a[1])[0]!; if (dom[1] > 0.45) warns.push(`dominant biome ${dom[0]} ${(dom[1] * 100).toFixed(0)}%`);
  // 7 audit script (config-level anchors; config untouched)
  let audit: any = null; try { const out = execFileSync("/workspace/ba-worldgen/packages/config/node_modules/.bin/tsx", ["tools/check-anchors.ts", g.id, "--json"], { cwd: "/workspace/ba-worldgen", encoding: "utf8", timeout: 600000 }); const j: any[] = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)); audit = { checked: j.length, pass: j.filter((r) => r.status === "PASS").length, warn: j.filter((r) => r.status === "WARN").map((r) => `${r.id}: ${r.why}`), fail: j.filter((r) => r.status === "FAIL").map((r) => `${r.id}: ${r.why}`) }; if (audit.fail.length) fails.push(`anchor audit FAIL ${audit.fail.length}`); } catch (e: any) { audit = { error: String(e.message ?? e).slice(0, 400), stdout: String(e.stdout ?? "").slice(0, 400) }; }
  // 8 images
  const zones = resolve(HERE, "../../public/zones"); const bin = process.env.MINIMAP_BIN; const imgs: string[] = [];
  if (bin) { for (const [tag, bz, bp] of [["before", `${zones}/${g.id}.baz`, `${zones}/${g.id}.bap`], ["after", `${zones}/${g.id}_gen.baz`, `${zones}/${g.id}_gen.bap`]] as const) { const ppm = `/tmp/mm_${g.id}_${tag}.ppm`; execFileSync(bin, [bz, bp, ppm]); const b = readFileSync(ppm); const m = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(b.toString("latin1", 0, 40))!; const out = `${IMG}/minimap-${g.id}-${tag}.png`; await sharp(b.subarray(m[0].length), { raw: { width: +m[1]!, height: +m[2]!, channels: 3 } }).png().toFile(out); imgs.push(out); }
    const [a, b2] = await Promise.all(imgs.map((p) => sharp(p).metadata())); await sharp({ create: { width: a.width! + b2.width! + 12, height: Math.max(a.height!, b2.height!), channels: 3, background: "#111" } }).composite([{ input: imgs[0]!, left: 0, top: 0 }, { input: imgs[1]!, left: a.width! + 12, top: 0 }]).png().toFile(`${IMG}/${g.id}_compare.png`); }
  const sc = Math.max(1, Math.round(600 / Math.max(W, H)) ); const ov = Buffer.alloc(W * H * 3); const dp = Buffer.alloc(W * H * 3);
  for (let k = 0; k < N; k++) { const i = k % W, j = H - 1 - ((k / W) | 0), p = (j * W + i) * 3; // north up
    const shade = Math.max(0, Math.min(255, 70 + (g.h[k]! - 0) * 12));
    if (walk[k]) { ov[p] = reach[k] ? 70 : 200; ov[p + 1] = reach[k] ? 170 : 40; ov[p + 2] = 70; } else { ov[p] = ov[p + 1] = ov[p + 2] = shade * 0.6; }
    if (wet[k]) { ov[p] = 40; ov[p + 1] = 90; ov[p + 2] = 200; } if (g.creek[k]) { ov[p] = 90; ov[p + 1] = 160; ov[p + 2] = 230; }
    if (br[k]) { dp[p] = 230; dp[p + 1] = 180; dp[p + 2] = 60; } else if (wet[k] && walk[k]) { dp[p] = 120; dp[p + 1] = 220; dp[p + 2] = 230; } else if (wet[k]) { dp[p] = 20; dp[p + 1] = 50; dp[p + 2] = 160; } else if (g.creek[k]) { dp[p] = 90; dp[p + 1] = 150; dp[p + 2] = 220; } else { dp[p] = dp[p + 1] = dp[p + 2] = walk[k] ? 120 : shade * 0.5; } }
  const dot = (buf: Buffer, x: number, z: number, r: number, c: number[]) => { const ci = Math.round((x - g.minX) / g.cell), cj = H - 1 - Math.round((z - g.minZ) / g.cell); const rc = Math.round(r / g.cell); for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const d = Math.hypot(di, dj); if (d > rc || d < rc - 1.6 && r > 3) continue; const p = (j * W + i) * 3; buf[p] = c[0]!; buf[p + 1] = c[1]!; buf[p + 2] = c[2]!; } };
  for (const a of anchorRes) dot(ov, a.x, a.z, 1.8, a.reachable ? [255, 255, 255] : [255, 0, 0]); if (g.warp) { dot(ov, g.warp.x, g.warp.z, 5, [200, 80, 255]); dot(ov, g.warp.x, g.warp.z, 1.2, [200, 80, 255]); dot(dp, g.warp.x, g.warp.z, 5, [200, 80, 255]); }
  await sharp(ov, { raw: { width: W, height: H, channels: 3 } }).resize(W * sc, H * sc, { kernel: "nearest" }).png().toFile(`${IMG}/${g.id}_walk_anchors.png`);
  await sharp(dp, { raw: { width: W, height: H, channels: 3 } }).resize(W * sc, H * sc, { kernel: "nearest" }).png().toFile(`${IMG}/${g.id}_water_depth.png`);
  const res = { field: g.id, origin: g.origin, hardFailures: fails, warnings: warns, contract: { blockedFlagMismatch: blkMis, walkableHeightMismatch: hMis, waterSurfaceMismatch: wMis }, anchors: anchorRes, blockedGatesUnreachable: blockedGatesUnreach,
    hydrology: { creekSegments: g.creekSegs.length, creekCells: g.creek.reduce((a, b) => a + b, 0), creekEnds: ends, creekUphillCells: uphill, legacyWaterIsolatedPools: waterPits, sceneryCellsRaisedByFill: g.raised },
    depth: { fordCells: ford, wadeFordCells: fordWade, deepCells: deep, deepWalkable: deepWalk, bridges: spans }, warpCircle: warpRes, biomeShare: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, +v.toFixed(3)])), whittakerShare: Object.fromEntries(Object.entries(whitt).map(([k, v]) => [k, +v.toFixed(3)])),
    props: { legacyKept: g.legacyCount, added: g.props.length - g.legacyCount, byKind: g.vstat }, audit, images: [...imgs, `${IMG}/${g.id}_compare.png`, `${IMG}/${g.id}_walk_anchors.png`, `${IMG}/${g.id}_water_depth.png`],
    sha: { baz: createHash("sha256").update(baz).digest("hex").slice(0, 16), bap: createHash("sha256").update(bap).digest("hex").slice(0, 16) } };
  writeFileSync(`${IMG}/${g.id}.validation.json`, JSON.stringify(res, null, 2)); return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const id = process.argv[2]!; const t0 = Date.now(); const g = generateField(id); const baz = bakeField(g); const bap = encodeProps(g.props);
  const zones = resolve(HERE, "../../public/zones"); writeFileSync(`${zones}/${id}_gen.baz`, baz); writeFileSync(`${zones}/${id}_gen.bap`, bap);
  mkdirSync(resolve(HERE, "out"), { recursive: true }); writeFileSync(resolve(HERE, `out/${id}.lore.json`), JSON.stringify({ warp: g.warp, lore: CFG.fields[id].lore ?? [] }, null, 2));
  const r = await reviewField(g, baz, bap); const { anchors, ...brief } = r as any; console.log(JSON.stringify({ ...brief, anchorsOk: anchors.filter((a: any) => a.reachable).length + "/" + anchors.length, ms: Date.now() - t0 }, null, 1));
}
