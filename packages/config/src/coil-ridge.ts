/**
 * Coil Ridge — "the Broken Stair": a ruin-strewn highland shelf above a broken fault scarp,
 * on the Seam Country's climb toward the Ember Crown. (Zone id kept: `coil_ridge`.)
 *
 * Area sheet
 * 1. Bounds: x -120..120, z -150..110 (unchanged). Grid 481×521 at 0.5 m.
 * 2. Walkable: a warped scree apron below the scarp around the tongue-lip arrival; the
 *    King's Stair, four switchback legs cut up the scarp face (blocked rock between legs);
 *    and the upper shelf, an undulating, warped-outline highland with ruins.
 *    Blocked: scarp face, gorge walls, the Ember Crown flank on the north rim, deep water.
 * 3. Water (all flows downhill): a snow-melt brook enters at the north rim, runs shallow
 *    (wadeable, ford at the Stele Ford) into the Mirror Tarn (irregular shore: shallow walkable
 *    shelf, deep, then a >2 m deep core). The tarn spills SE as a deep outlet race (bridged once,
 *    the Kingsbridge) that drops through the Sundered Gorge and leaves the map at the SE corner.
 * 4. Relief: apron ~2.4 m, scarp to ~9 m, shelf 8–11.5 m rising north. Nowhere flat (fbm undulation).
 * 5. Exits: tongue-lip (unchanged rect) to coil_pass. Spawn (0, -120) unchanged.
 * 6. Lore: the Kings cut the Stair and named the scarp a "ridge"; the gorge is the older road.
 *
 * North is +z. Facing 0 looks toward +z.
 */

import { zoneLink } from "./zone-links";

export const CR_BOUNDS = { minX: -120, maxX: 120, minZ: -150, maxZ: 110 } as const;
export const CR_TRAIL_WIDTH = 3.3;
export const CR_SPAWN = { x: 0, z: -120, facing: 0 } as const;

export type CoilRidgeGate = { id: string; minX: number; maxX: number; minZ: number; maxZ: number; softLevel: number; blocked: boolean; destZone: string };

function destZone(gate: string): string {
  const link = zoneLink("coil_ridge", gate);
  if (!link) throw new Error(`no zone link for coil_ridge ${gate}`);
  return link.to;
}

export const CR_GATES: readonly CoilRidgeGate[] = [
  { id: "tongue-lip", minX: -8, maxX: 8, minZ: -146, maxZ: -134, softLevel: 8, blocked: false, destZone: destZone("tongue-lip") },
];

// ---------- deterministic value noise ----------
function h2(i: number, j: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, z: number): number {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x: number, z: number, oct = 3): number {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { s += a * vnoise(x * f + o * 17.3, z * f - o * 9.1); a *= 0.5; f *= 2.03; }
  return s;
}
function smooth(t: number): number { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); }

// ---------- polylines (Chaikin-smoothed, with arc length) ----------
type Pt = { x: number; z: number };
type Line = { p: Pt[]; s: number[]; len: number };
function chaikin(pts: Pt[], it = 3): Pt[] {
  let q = pts;
  for (let k = 0; k < it; k++) {
    const r: Pt[] = [q[0]!];
    for (let i = 1; i < q.length; i++) { const a = q[i - 1]!, b = q[i]!; r.push({ x: 0.75 * a.x + 0.25 * b.x, z: 0.75 * a.z + 0.25 * b.z }, { x: 0.25 * a.x + 0.75 * b.x, z: 0.25 * a.z + 0.75 * b.z }); }
    r.push(q[q.length - 1]!); q = r;
  }
  return q;
}
function line(pts: Pt[]): Line {
  const p = chaikin(pts); const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1]! + Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.z - p[i - 1]!.z));
  return { p, s, len: s[s.length - 1]! };
}
/** Nearest point on a polyline: distance and arc length. */
function near(L: Line, x: number, z: number): { d: number; s: number } {
  let bd = Infinity, bs = 0;
  for (let i = 1; i < L.p.length; i++) {
    const a = L.p[i - 1]!, b = L.p[i]!; const dx = b.x - a.x, dz = b.z - a.z; const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (d < bd) { bd = d; bs = L.s[i - 1]! + t * Math.sqrt(l2); }
  }
  return { d: bd, s: bs };
}
function at(L: Line, s: number): Pt {
  const ss = Math.max(0, Math.min(L.len, s)); let i = 1; while (i < L.s.length - 1 && L.s[i]! < ss) i++;
  const a = L.p[i - 1]!, b = L.p[i]!; const t = (ss - L.s[i - 1]!) / ((L.s[i]! - L.s[i - 1]!) || 1);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

// ---------- layout ----------
const APRON_Y = 2.4;
const SHELF_Y = 8.8;
/** Lower edge of the walkable shelf (wiggly, never a straight line). */
function shelfEdge(x: number): number { return -50 + 4 * Math.sin(x / 19 + 0.4) + 2.5 * Math.sin(x / 7.3 + 1.1); }
/** Foot of the scarp face. */
function scarpFoot(x: number): number { return -104 + 2.5 * Math.sin(x / 15 + 2.2); }

/** The King's Stair: four switchback legs up the scarp (raw control points, smoothed). */
const STAIR = line([
  { x: 0, z: -142 }, { x: 0, z: -122 }, { x: -3, z: -110 }, { x: -14, z: -102 }, { x: -30, z: -100 }, { x: -37, z: -95 },
  { x: -30, z: -90 }, { x: 0, z: -89 }, { x: 22, z: -86 }, { x: 28, z: -80 }, { x: 20, z: -76 }, { x: -6, z: -77 },
  { x: -28, z: -73 }, { x: -32, z: -67 }, { x: -22, z: -64 }, { x: 4, z: -64 }, { x: 16, z: -59 }, { x: 13, z: -51 }, { x: 6, z: -42 }, { x: 0, z: -32 },
]);
const STAIR_HALF = 3.4;
const STAIR_S0 = near(STAIR, 0, -116).s; // leaves the apron
const STAIR_S1 = near(STAIR, 6, -42).s; // tops out on the shelf

/**
 * Scarp Cave: a rare alternative to the King's Stair. It opens on the west side of the apron, winds west under
 * the scarp in uneven switchback galleries and comes out on the shelf west of Scarp Head. Single-floor
 * heightfield, so it is modelled as a cave mouth plus an interior ramp (a narrow graded gallery cut into the
 * otherwise blocked scarp). Grow-only: it only opens scarp cells that were blocked before.
 */
const CAVE = line([
  { x: -16, z: -125 }, { x: -30, z: -119 }, { x: -47, z: -113 }, { x: -63, z: -107 }, { x: -73, z: -99 }, { x: -67, z: -91 },
  { x: -52, z: -87 }, { x: -48, z: -80 }, { x: -57, z: -74 }, { x: -75, z: -70 }, { x: -81, z: -62 }, { x: -71, z: -55 },
  { x: -61, z: -49 }, { x: -58, z: -40 },
]);
const CAVE_HALF = 1.5;
const CAVE_S0 = near(CAVE, -16, -125).s;
const CAVE_S1 = CAVE.len;
function inCave(x: number, z: number): boolean {
  const n = near(CAVE, x, z); return n.d <= CAVE_HALF * (1 + 0.25 * vnoise(n.s / 4, 21));
}

/** Brook (north rim → Mirror Tarn). */
const BROOK = line([{ x: -62, z: 112 }, { x: -55, z: 92 }, { x: -41, z: 74 }, { x: -46, z: 54 }, { x: -40, z: 38 }, { x: -29, z: 27 }, { x: -22, z: 20 }]);
const BROOK_HALF = 2.1;
/** Outlet race (Mirror Tarn → Sundered Gorge → SE corner). */
const RACE = line([{ x: -6, z: 8 }, { x: 4, z: 0 }, { x: 16, z: -7 }, { x: 26, z: -15 }, { x: 34, z: -26 }, { x: 41, z: -44 }, { x: 52, z: -66 }, { x: 67, z: -92 }, { x: 86, z: -114 }, { x: 105, z: -132 }, { x: 126, z: -152 }]);
const RACE_HALF = 3.0;

export const CR_TARN = { x: -14, z: 14, r: 15, level: 8.2 } as const;
function tarnR(a: number): number {
  return CR_TARN.r * (1 + 0.16 * Math.sin(2 * a + 1.3) + 0.1 * Math.sin(3 * a + 0.2) + 0.06 * Math.sin(5 * a + 2.6) + 0.04 * Math.sin(7 * a + 0.9));
}
/** Normalised tarn radius: 1 on the shoreline. */
function tarnRho(x: number, z: number): number {
  const dx = x - CR_TARN.x, dz = z - CR_TARN.z; return Math.hypot(dx, dz) / tarnR(Math.atan2(dz, dx));
}
const TARN_SHELF = 0.8; // rho beyond this is the wadeable shelf
const WADE_DEPTH = 0.4;

// ---------- ground (before water carving) ----------
/** Soft cap so the shelf rim never passes ~11 m (field relief cap 11.5 m), and stays sloped, never flat. */
function baseGround(x: number, z: number): number {
  const g = baseGroundRaw(x, z);
  return g <= 9 ? g : 9 + 2.2 * Math.tanh((g - 9) / 2.2);
}
function baseGroundRaw(x: number, z: number): number {
  const und = 0.55 * fbm(x / 17, z / 17) + 0.22 * fbm(x / 5.5 + 40, z / 5.5 - 7, 2);
  const foot = scarpFoot(x), edge = shelfEdge(x);
  const rise = smooth((z - foot) / Math.max(10, edge - foot));
  const broken = 1.2 * fbm(x / 9 + 3, z / 9) * smooth((z - foot) / 8) * (1 - smooth((z - edge) / 6));
  const shelf = SHELF_Y + 0.018 * (z - edge) + 2.6 * smooth((z - 60) / 45);
  const apron = APRON_Y + 0.01 * (z + 150) - 0.012 * Math.abs(x);
  return apron + (shelf - apron) * rise + broken + und;
}

const RACE_TOP = CR_TARN.level - 0.15;
const RACE_EXIT = 0.8;
/** Water surface on the brook / race centrelines, monotone downstream. */
function brookSurface(s: number): number {
  const top = baseGround(BROOK.p[0]!.x, BROOK.p[0]!.z) - 0.3;
  return CR_TARN.level + (top - CR_TARN.level) * Math.pow(1 - s / BROOK.len, 1.3);
}
function raceSurface(s: number): number {
  const t = s / RACE.len; // fall concentrated in the gorge (t 0.3..0.75)
  return RACE_TOP + (RACE_EXIT - RACE_TOP) * (0.08 * t + 0.92 * smooth((t - 0.22) / 0.55));
}

type Water = { surf: number; bed: number; kind: "brook" | "tarn" | "race" } | null;
function waterAt(x: number, z: number): Water {
  const rho = tarnRho(x, z);
  if (rho <= 1) {
    const bed = rho >= TARN_SHELF ? CR_TARN.level - WADE_DEPTH * (1 - 0.4 * (rho - TARN_SHELF) / (1 - TARN_SHELF)) : CR_TARN.level - WADE_DEPTH - 2.8 * smooth((TARN_SHELF - rho) / 0.6);
    return { surf: CR_TARN.level, bed, kind: "tarn" };
  }
  const b = near(BROOK, x, z);
  if (b.d <= BROOK_HALF * (1 + 0.15 * vnoise(b.s / 6, 3))) { const surf = brookSurface(b.s); return { surf, bed: surf - WADE_DEPTH * (1 - 0.3 * b.d / BROOK_HALF), kind: "brook" }; }
  const r = near(RACE, x, z);
  if (r.d <= RACE_HALF * (1 + 0.15 * vnoise(r.s / 7, 11))) { const surf = raceSurface(r.s); return { surf, bed: surf - 1.4 + 0.5 * (r.d / RACE_HALF) ** 2, kind: "race" }; }
  return null;
}

/** Ground with water carving and bank shaping (banks always above the adjacent surface). */
function ground(x: number, z: number): number {
  let g = baseGround(x, z);
  const w = waterAt(x, z); if (w) return w.bed;
  const rho = tarnRho(x, z);
  if (rho < 1.5) g = Math.max(g * smooth((rho - 1) / 0.5) + (CR_TARN.level + 0.25 + (rho - 1) * 3) * (1 - smooth((rho - 1) / 0.5)), CR_TARN.level + 0.15);
  const b = near(BROOK, x, z);
  if (b.d < BROOK_HALF + 5) { const bank = brookSurface(b.s) + 0.2 + 0.25 * (b.d - BROOK_HALF); const t = smooth((b.d - BROOK_HALF) / 5); g = Math.max(bank, g * t + bank * (1 - t)); }
  const r = near(RACE, x, z);
  if (r.d < RACE_HALF + 9) {
    const surf = raceSurface(r.s); const t = smooth((r.d - RACE_HALF) / 9);
    // gorge walls: steep, rock-broken, always above the race surface
    const wall = surf + 0.4 + 1.1 * (r.d - RACE_HALF) + 0.6 * fbm(x / 3, z / 3, 2);
    g = Math.max(surf + 0.3, Math.min(g, wall) * (1 - t) + g * t);
  }
  return g;
}

// ---------- bridge (Kingsbridge over the deep race) ----------
const BR_S = near(RACE, 23, -12).s;
const BR_C = at(RACE, BR_S);
const BR_T = (() => { const a = at(RACE, BR_S - 2), b = at(RACE, BR_S + 2); const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; })();
export const CR_BRIDGE_DECK_W = 3.6;
export const CR_BRIDGE = { id: "kingsbridge", x: BR_C.x, z: BR_C.z, span: (RACE_HALF * 1.15 + 4.5) * 2, dir: { x: -BR_T.z, z: BR_T.x } } as const;
const BR_HALF = CR_BRIDGE.span / 2;
const BR_LEFT = { x: CR_BRIDGE.x - CR_BRIDGE.dir.x * BR_HALF, z: CR_BRIDGE.z - CR_BRIDGE.dir.z * BR_HALF };
const BR_RIGHT = { x: CR_BRIDGE.x + CR_BRIDGE.dir.x * BR_HALF, z: CR_BRIDGE.z + CR_BRIDGE.dir.z * BR_HALF };
export const CR_BRIDGE_ENDS = { left: BR_LEFT, right: BR_RIGHT, leftY: ground(BR_LEFT.x, BR_LEFT.z), rightY: ground(BR_RIGHT.x, BR_RIGHT.z) } as const;
function bridgeLocal(x: number, z: number): { a: number; c: number } {
  const dx = x - CR_BRIDGE.x, dz = z - CR_BRIDGE.z; return { a: dx * CR_BRIDGE.dir.x + dz * CR_BRIDGE.dir.z, c: -dx * CR_BRIDGE.dir.z + dz * CR_BRIDGE.dir.x };
}
export function coilRidgeOnBridge(x: number, z: number): boolean {
  const { a, c } = bridgeLocal(x, z); return Math.abs(a) <= BR_HALF && Math.abs(c) <= CR_BRIDGE_DECK_W / 2;
}
export function coilRidgeBridgeDeckY(x: number, z: number): number | null {
  if (!coilRidgeOnBridge(x, z)) return null;
  const t = (bridgeLocal(x, z).a + BR_HALF) / (2 * BR_HALF);
  return CR_BRIDGE_ENDS.leftY + (CR_BRIDGE_ENDS.rightY - CR_BRIDGE_ENDS.leftY) * t + 0.35 * Math.sin(Math.PI * t);
}

// ---------- masks ----------
function inBounds(x: number, z: number): boolean { return x >= CR_BOUNDS.minX && x <= CR_BOUNDS.maxX && z >= CR_BOUNDS.minZ && z <= CR_BOUNDS.maxZ; }
function inApron(x: number, z: number): boolean {
  const warp = 2.2 * fbm(x / 11, z / 11, 2);
  const lobe = Math.hypot((x + 2) / 1.25, z + 128) - 17 - warp;
  const neck = Math.abs(x - 1.5 * Math.sin(z / 9)) - 10.5 - warp; // up the tongue to the lip
  return lobe <= 0 || (neck <= 0 && z <= -112 && z >= -149);
}
function stairInfo(x: number, z: number): { d: number; s: number } { return near(STAIR, x, z); }
function inStair(x: number, z: number): boolean {
  const n = stairInfo(x, z); return n.d <= STAIR_HALF + 0.5 * vnoise(n.s / 5, 2);
}
function inShelf(x: number, z: number): boolean {
  const w = 3 * fbm(x / 13 + 5, z / 13, 2);
  if (z < shelfEdge(x) + w * 0.6) return false;
  if (z > 96 - 6 * Math.abs(fbm(x / 21, 3, 2)) + w) return false; // Ember Crown flank
  if (Math.abs(x) > 110 + w - 4 * smooth((z - 40) / 50)) return false;
  return true;
}
/** Gorge walls beside the race (blocked except the bridge deck). */
function inGorgeWall(x: number, z: number): boolean {
  const r = near(RACE, x, z); return r.d <= RACE_HALF + 2.6 && r.s > 4;
}

export function coilRidgeMaskDist(x: number, z: number): number {
  return inApron(x, z) || inStair(x, z) || inShelf(x, z) ? -1 : 1;
}

export function coilRidgeWaterSurfaceY(x: number, z: number): number | null {
  const w = waterAt(x, z); return w ? w.surf : null;
}
export function coilRidgeInOpenWater(x: number, z: number): boolean {
  if (coilRidgeOnBridge(x, z)) return false; return waterAt(x, z) != null;
}
/** Shallow (wadeable) water: brook fords and the tarn shelf. */
export function coilRidgeInShallows(x: number, z: number): boolean {
  const w = waterAt(x, z); return !!w && w.surf - w.bed <= WADE_DEPTH + 0.05;
}

export function coilRidgeWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  if (coilRidgeOnBridge(x, z)) return true;
  const onLand = inApron(x, z) || inStair(x, z) || inShelf(x, z) || inCave(x, z);
  if (!onLand) return false;
  const w = waterAt(x, z);
  if (w) return w.surf - w.bed <= WADE_DEPTH + 0.05;
  if (inGorgeWall(x, z) && !inApron(x, z)) return false;
  return true;
}

/** Feet height. Bridge deck, then wading bed, the stair grade, then ground. */
export function coilRidgeStandHeight(x: number, z: number): number {
  const deck = coilRidgeBridgeDeckY(x, z); if (deck != null) return deck;
  const g = ground(x, z);
  if (inStair(x, z) && !inApron(x, z) && !inShelf(x, z)) {
    const n = stairInfo(x, z);
    const s = Math.max(STAIR_S0, Math.min(STAIR_S1, n.s));
    const p0 = at(STAIR, STAIR_S0), p1 = at(STAIR, STAIR_S1);
    const y0 = ground(p0.x, p0.z), y1 = ground(p1.x, p1.z);
    const t = (s - STAIR_S0) / (STAIR_S1 - STAIR_S0);
    const y = y0 + (y1 - y0) * t + 0.12 * vnoise(n.s / 3, 7); // graded, slightly uneven
    return Math.max(-0.5, Math.min(11.5, y));
  }
  if (inCave(x, z) && !inApron(x, z) && !inShelf(x, z)) {
    const n = near(CAVE, x, z);
    const p0 = at(CAVE, CAVE_S0), p1 = at(CAVE, CAVE_S1 - 0.01);
    const y0 = ground(p0.x, p0.z), y1 = ground(p1.x, p1.z);
    const t = Math.max(0, Math.min(1, (n.s - CAVE_S0) / (CAVE_S1 - CAVE_S0)));
    // blend the mouth and the exit back into the apron / shelf ground they open onto
    const lip = Math.min(smooth((n.s - CAVE_S0) / 10), smooth((CAVE_S1 - n.s) / 10));
    const y = (y0 + (y1 - y0) * t + 0.1 * vnoise(n.s / 2.5, 23)) * lip + g * (1 - lip);
    return Math.max(-0.5, Math.min(11.5, y));
  }
  return Math.max(-0.5, Math.min(11.5, g));
}
export function coilRidgeHeight(x: number, z: number): number { return coilRidgeStandHeight(x, z); }

export type CoilRidgeBiome = "river" | "riverbank" | "grass" | "meadow" | "mountain" | "scrub" | "quarry";
export const CR_RUINS: readonly { id: string; x: number; z: number; r: number; name: string }[] = [
  { id: "stele-field", x: -72, z: 70, r: 12, name: "Stele Field" },
  { id: "toppled-gatehouse", x: 60, z: 28, r: 10, name: "Toppled Gatehouse" },
  { id: "scarp-head", x: 2, z: -26, r: 7, name: "Scarp Head" },
];
export function coilRidgeBiome(x: number, z: number): CoilRidgeBiome {
  if (coilRidgeOnBridge(x, z)) return "riverbank";
  const w = waterAt(x, z); if (w) return "river";
  if (!coilRidgeWalkable(x, z)) return "mountain";
  for (let i = 0; i < CR_RUINS.length; i++) {
    const r = CR_RUINS[i]!, dx = x - r.x, dz = z - r.z, d = Math.hypot(dx, dz);
    if (d >= r.r * 1.2) continue;
    // broken, overgrown plaza edge (visual only): a ragged rim of tumbled paving and grass pushing through
    const a = Math.atan2(dz, dx), p = i * 2.399;
    const rim = r.r * (0.86 + 0.08 * Math.sin(3 * a + p) + 0.06 * Math.sin(7 * a - 2 * p) + 0.04 * Math.sin(13 * a + p));
    const h = Math.sin(x * 12.9898 + z * 78.233 + i) * 43758.5453, tuft = h - Math.floor(h);
    if (d < rim * 0.7) return tuft < 0.06 ? "meadow" : "quarry";
    if (d < rim) return tuft < 0.25 + 0.5 * ((d / rim - 0.7) / 0.3) ? "meadow" : "quarry";
    if (tuft < 0.18 * (1 - (d - rim) / (r.r * 0.34))) return "quarry"; // scattered stones beyond the rim
  }
  if (tarnRho(x, z) < 1.25 || near(BROOK, x, z).d < BROOK_HALF + 3) return "riverbank";
  if (inCave(x, z) && !inApron(x, z) && !inShelf(x, z)) return "quarry"; // cave gallery floor
  if (inStair(x, z) || inApron(x, z)) return "scrub";
  return coilRidgeStandHeight(x, z) > 10.4 ? "grass" : "meadow";
}

export type CoilRidgeTrail = { id: string; surface: "dirt" | "stone"; points: { x: number; z: number }[] };
export function coilRidgeTrails(): CoilRidgeTrail[] {
  const stair = STAIR.p.filter((_, i) => i % 3 === 0 || i === STAIR.p.length - 1).map((p) => ({ x: p.x, z: p.z }));
  return [
    { id: "kings-stair", surface: "stone", points: stair },
    { id: "stele-way", surface: "dirt", points: chaikin([{ x: 0, z: -32 }, { x: -12, z: -16 }, { x: -34, z: -6 }, { x: -46, z: 16 }, { x: -50, z: 40 }, { x: -58, z: 58 }, { x: -70, z: 66 }], 2) },
    { id: "scarp-cave", surface: "stone", points: CAVE.p.filter((_, i) => i % 3 === 0 || i === CAVE.p.length - 1).map((p) => ({ x: p.x, z: p.z })) },
    { id: "cave-way", surface: "dirt", points: chaikin([{ x: -58, z: -40 }, { x: -50, z: -26 }, { x: -40, z: -14 }, { x: -34, z: -6 }], 2) },
    { id: "gatehouse-way", surface: "dirt", points: chaikin([{ x: 0, z: -32 }, { x: 8, z: -26 }, BR_LEFT, BR_RIGHT, { x: 40, z: 6 }, { x: 54, z: 22 }], 2) },
  ];
}
export const CR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "kings-stair": "King's Stair",
  "stele-way": "Stele Way",
  "gatehouse-way": "Gatehouse Way",
  "scarp-cave": "Scarp Cave",
  "cave-way": "Cave Way",
};

export type CoilRidgeLabelKind = "area" | "camp" | "landmark" | "water";
export const CR_MAP_LABELS: readonly { text: string; x: number; z: number; kind: CoilRidgeLabelKind }[] = [
  { text: "Broken Stair", x: 0, z: -120, kind: "area" },
  { text: "King's Stair", x: -10, z: -82, kind: "landmark" },
  { text: "Mirror Tarn", x: CR_TARN.x, z: CR_TARN.z, kind: "water" },
  { text: "Sundered Gorge", x: 58, z: -76, kind: "water" },
  { text: "Kingsbridge", x: CR_BRIDGE.x, z: CR_BRIDGE.z, kind: "landmark" },
  { text: "Stele Field", x: -72, z: 70, kind: "landmark" },
  { text: "Scarp Cave", x: -62, z: -100, kind: "landmark" },
  { text: "Toppled Gatehouse", x: 60, z: 28, kind: "landmark" },
];

function inRect(x: number, z: number, g: CoilRidgeGate): boolean { return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ; }
export function coilRidgeGateSoftLevel(x: number, z: number): number | null {
  for (const g of CR_GATES) if (inRect(x, z, g)) return g.softLevel;
  return null;
}
