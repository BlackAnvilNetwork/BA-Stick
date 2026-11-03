import { naturalMaskDist } from "./natural-shore";
import { inShoreShallows, inShoreWater, shoreDist, shoreTerrainY } from "./natural-shore";
/**
 * Green Reach — one island between islet_fords and coil_pass.
 *
 * Area sheet
 * 1. Bounds: x -100..120, z -90..110. 44_000 m², about 196 screens.
 *    Grid 441×401 at 0.5 m. Bake 24 + 4×441×401 = 707_388 B.
 * 2. Walkable: union of seven discs, minus two pools and three peak cores
 *    (0.38×r). Outside the mask is blocked mountain. About 40%.
 * 3. Relief: shore 1.3 m, inland 2.4 m, pool surface 1.2, bed 1.2 − 1.35,
 *    caps 7.2–8.5 m. Hard cap 11 m.
 * 4. Widths: claw necks are the disc overlaps. Pools r = 10 and r = 6.
 *    Trail 3.3 m from the claw through the main mass to the north lip.
 * 5. Exits: claw-lip (−90..−78, 2..14) → islet_fords,
 *    north-lip (−16..−4, 78..90) → coil_pass. Soft level 8. Spawn (−70, 8) facing 0.
 * 6. Landmarks: Long Claw, Still Pool, White Caps, South Point.
 *
 * North is +z. Both pools sit east of the dry route from the west claw to the
 * north lip. Gate centres sit inside the authored discs, so those radii stay put.
 */

import { zoneLink } from "./zone-links";

export const GR_BOUNDS = {
  minX: -100,
  maxX: 120,
  minZ: -90,
  maxZ: 110,
} as const;

export const GR_TRAIL_WIDTH = 3.3;

export const GR_SURFACE = 1.2;
export const GR_BED = GR_SURFACE - 1.35;

export const GR_DISCS = [
  { x: 30, z: 10, r: 72 },
  { x: -10, z: 60, r: 36 },
  { x: -55, z: 20, r: 22 },
  { x: -78, z: 8, r: 14 },
  { x: -40, z: -10, r: 18 },
  { x: 20, z: -60, r: 28 },
  { x: 80, z: 20, r: 32 },
] as const;

export const GR_POOLS = [
  { x: 25, z: 25, r: 10, surface: GR_SURFACE, seed: 811 },
  { x: 55, z: -15, r: 6, surface: GR_SURFACE, seed: 812 },
] as const;

export const GR_PEAKS = [
  { x: 40, z: 45, r: 16, h: 8.5 },
  { x: 70, z: 30, r: 12, h: 7.2 },
  { x: -20, z: 70, r: 14, h: 7.8 },
] as const;

const PEAK_CORE = 0.38;

export const GR_SPAWN = { x: -70, z: 8, facing: 0 } as const;

export type GreenReachGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  destZone: string;
};

function destOf(gate: string): string {
  const link = zoneLink("green_reach", gate);
  if (!link) throw new Error(`missing zone link green_reach/${gate}`);
  return link.to;
}

export const GR_GATES: readonly GreenReachGate[] = [
  { id: "claw-lip", minX: -90, maxX: -78, minZ: 2, maxZ: 14, softLevel: 8, blocked: false, destZone: destOf("claw-lip") },
  { id: "north-lip", minX: -16, maxX: -4, minZ: 78, maxZ: 90, softLevel: 8, blocked: false, destZone: destOf("north-lip") },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** Signed distance to the island mask. Negative is inside. */
export function greenReachMaskDist(x: number, z: number): number {
  return naturalMaskDist(greenReachMaskDistRaw, x, z, 904);
}

/** Geometric mask before the natural edge. */
export function greenReachMaskDistRaw(x: number, z: number): number {
  let d = Infinity;
  for (const c of GR_DISCS) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  return d;
}

export function greenReachInOpenWater(x: number, z: number): boolean {
  for (const p of GR_POOLS) {
    if (inShoreWater(p, x, z, 1.5)) return true;
  }
  return false;
}

export function greenReachOnBridge(_x: number, _z: number): boolean {
  return false;
}

function inPeakCore(x: number, z: number): boolean {
  for (const m of GR_PEAKS) {
    if (Math.hypot(x - m.x, z - m.z) < m.r * PEAK_CORE) return true;
  }
  return false;
}

function inRect(x: number, z: number, g: GreenReachGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

/** Wadeable pool fringe (rho >= 0.8, <= 0.5 m deep). */
export function greenReachInPoolShallows(x: number, z: number): boolean {
  return GR_POOLS.some((p) => inShoreShallows(p, x, z, 1.5));
}

export function greenReachWalkable(x: number, z: number): boolean {
  if (x < GR_BOUNDS.minX || x > GR_BOUNDS.maxX) return false;
  if (z < GR_BOUNDS.minZ || z > GR_BOUNDS.maxZ) return false;
  if (greenReachMaskDist(x, z) > 0) return false;
  if (greenReachInPoolShallows(x, z)) return true;
  if (greenReachInOpenWater(x, z)) return false;
  if (inPeakCore(x, z) && !onAscent(x, z)) return false;
  for (const g of GR_GATES) {
    if (g.blocked && inRect(x, z, g)) return false;
  }
  return true;
}

export function greenReachWaterSurfaceY(x: number, z: number): number | null {
  if (!greenReachInOpenWater(x, z)) return null;
  return GR_SURFACE;
}

function baseY(x: number, z: number): number {
  const d = greenReachMaskDist(x, z);
  const inland = d >= 0 ? 0 : smooth(Math.min(-d, 20) / 20);
  return 1.3 + 1.1 * inland;
}

/** Grow-only footprint of a peak massif by polar angle: spurs reach out, saddles sit between them. */
function massifLobe(i: number, a: number): number {
  const p = 1.1 + i * 2.399;
  return 1 + 0.16 * (1 + Math.sin(3 * a + p)) + 0.08 * (1 + Math.sin(5 * a - 1.3 * p)) + 0.04 * (1 + Math.sin(9 * a + p));
}

/**
 * Eroded massif profile (0..1) at normalised radius t: a broad shoulder with ridged spurs radiating out and
 * gullies between them, instead of a smooth cone. Spurs twist slightly with distance so they read as ridges.
 */
function massifShape(i: number, a: number, t: number): number {
  const p = 0.4 + i * 1.913;
  const spur = 1 - Math.abs(Math.sin(2.5 * a + p + t * 1.6)); // 1 on a ridge line, 0 in a gully
  const sub = 1 - Math.abs(Math.sin(6 * a - p - t * 2.4));
  const base = Math.pow(1 - t, 1.7);
  const r0 = 0.62 + 0.28 * spur * spur + 0.1 * sub;
  const rid = r0 + (1 - r0) * Math.pow(1 - t, 6); // summit keeps its full height
  return Math.min(1, base * rid * (1 + 0.35 * (1 - t) * (1 - t)));
}

function terrainY(x: number, z: number): number {
  let y = baseY(x, z);
  for (let i = 0; i < GR_PEAKS.length; i++) {
    const m = GR_PEAKS[i]!;
    const a = Math.atan2(z - m.z, x - m.x);
    const t = Math.hypot(x - m.x, z - m.z) / (m.r * massifLobe(i, a));
    if (t < 1) {
      const k = massifShape(i, a, t);
      y = Math.max(y, m.h * k + baseY(x, z) * (1 - k));
    }
  }
  const d = greenReachMaskDist(x, z);
  if (d > 0) y = Math.max(y, 1.3 + smooth(Math.min(d, 24) / 24) * 6.4);
  for (const p of GR_POOLS) {
    if (shoreDist(p, x, z, 1.5) < p.r + 5) y = Math.min(y, shoreTerrainY(p, x, z, y, 5, 1.5));
  }
  return y;
}

/**
 * Natural ascents into the otherwise unclimbable peak cores. Each is a winding route that spirals up the inside
 * of the core from its rim to a small summit vista: a rock-cut stair on White Caps, a ledge path on the east
 * cap and a cave that loops upward inside the north massif (cave mouth + interior ramp; the ramp is carved
 * below the rock surface, so the heightfield shows it as a deep cut). Grow-only: they only open core cells.
 */
export type GreenReachAscent = { id: string; name: string; kind: "stair" | "ledge" | "cave"; peak: number; pts: { x: number; z: number; y: number }[] };
const ASCENT_DEFS = [
  { id: "white-caps-stair", name: "White Caps Stair", kind: "stair", peak: 0, a0: Math.PI * 1.05, turns: 0.6, half: 0.85, rout: 0.74, rin: 0.3 },
  { id: "east-cap-ledge", name: "East Cap Ledge", kind: "ledge", peak: 1, a0: Math.PI * 0.9, turns: 0.8, half: 0.8, rout: 0.74, rin: 0.3 },
  { id: "north-cave", name: "Hollow Stair Cave", kind: "cave", peak: 2, a0: 0.15, turns: 1.5, half: 0.6, rout: 0.8, rin: 0.2 },
] as const;
const ASCENT_SUMMIT_R = 0.9;
/** Coil radius: winds in from the rim, then a short straight walk-in to the summit so coils never touch it. */
function coilR(rc: number, u: number, rout: number, rin: number): number {
  return u < 0.9 ? rc * (rout - (rout - rin) * (u / 0.9)) : rc * (rin - rin * ((u - 0.9) / 0.1));
}
let ascentCache: GreenReachAscent[] | null = null;
export function greenReachAscents(): GreenReachAscent[] {
  if (ascentCache) return ascentCache;
  ascentCache = ASCENT_DEFS.map((d) => {
    const m = GR_PEAKS[d.peak]!;
    const rc = m.r * PEAK_CORE;
    const raw: { x: number; z: number }[] = [];
    const N = 180;
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      const e = 0.1; // short mouth cut straight into the rim, then the coil stays clear of the rim
      const rho = s < e ? rc * (1.15 - (1.15 - d.rout) * (s / e)) : coilR(rc, (s - e) / (1 - e), d.rout, d.rin) + 0.2 * Math.sin(s * 23 + d.peak) * (1 - s);
      const a = d.a0 + d.turns * 2 * Math.PI * Math.min(1, Math.max(0, (s - 0.1) / 0.81)) + 0.1 * Math.sin(s * 17 + 2 * d.peak) + 0.05 * Math.sin(s * 41);
      raw.push({ x: m.x + rho * Math.cos(a), z: m.z + rho * Math.sin(a) });
    }
    let L = 0;
    const acc = [0];
    for (let k = 1; k < raw.length; k++) acc.push((L += Math.hypot(raw[k]!.x - raw[k - 1]!.x, raw[k]!.z - raw[k - 1]!.z)));
    const y0 = terrainY(raw[0]!.x, raw[0]!.z);
    const y1 = terrainY(m.x, m.z);
    // uneven treads: steeper flights and short landings, but monotonic
    const ease = (u: number) => u + 0.035 * Math.sin(u * Math.PI * 9) / (Math.PI * 9 * 0.035 > 1 ? Math.PI * 9 * 0.035 : 1);
    return { id: d.id, name: d.name, kind: d.kind, peak: d.peak, pts: raw.map((p, k) => ({ ...p, y: y0 + (y1 - y0) * ease(Math.min(1, acc[k]! / (L - 2.2))) })) };
  });
  return ascentCache;
}
function ascentAt(x: number, z: number, mouthOnly = false): number | null {
  for (let i = 0; i < ASCENT_DEFS.length; i++) {
    const d = ASCENT_DEFS[i]!;
    const m = GR_PEAKS[d.peak]!;
    const dc = Math.hypot(x - m.x, z - m.z);
    if (dc > m.r * PEAK_CORE + 2) continue;
    const pts = greenReachAscents()[i]!.pts;
    if (dc < ASCENT_SUMMIT_R * 0.5) return pts[pts.length - 1]!.y;
    let best = Infinity, by = 0, bk = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]!, b = pts[k]!;
      const vx = b.x - a.x, vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
      const dd = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
      if (dd < best) { best = dd; by = a.y + (b.y - a.y) * t; bk = k; }
    }
    const half = d.half * (1 + 0.18 * Math.sin(x * 0.9 + z * 1.3));
    if (best < half) return mouthOnly ? 1 - smooth((bk / pts.length - 0.04) / 0.08) : by;
  }
  return null;
}
function onAscent(x: number, z: number): boolean {
  return ascentAt(x, z) !== null;
}

export function greenReachStandHeight(x: number, z: number): number {
  if (inPeakCore(x, z)) {
    const ay = ascentAt(x, z);
    if (ay !== null) {
      // blend the cut back into the rim at the mouth so its side walls stay steppable
      const mouth = ascentAt(x, z, true) ?? 0;
      let k = 0;
      for (const m of GR_PEAKS) k = Math.max(k, smooth((Math.hypot(x - m.x, z - m.z) - m.r * PEAK_CORE + 1.4) / 1.4));
      k *= mouth;
      return Math.max(-0.5, Math.min(11, ay + (terrainY(x, z) - ay) * k));
    }
  }
  return Math.max(-0.5, Math.min(11, terrainY(x, z)));
}

export function greenReachHeight(x: number, z: number): number {
  return greenReachStandHeight(x, z);
}

export type GreenReachBiome = "river" | "riverbank" | "grass" | "meadow" | "mountain";

export function greenReachBiome(x: number, z: number): GreenReachBiome {
  if (greenReachInOpenWater(x, z)) return "river";
  if (greenReachMaskDist(x, z) > 0) return "mountain";
  for (let i = 0; i < GR_PEAKS.length; i++) {
    const m = GR_PEAKS[i]!;
    if (Math.hypot(x - m.x, z - m.z) < m.r * 0.62 * massifLobe(i, Math.atan2(z - m.z, x - m.x))) return "mountain";
  }
  for (const p of GR_POOLS) {
    if (shoreDist(p, x, z, 1.5) < p.r + 3.5) return "riverbank";
  }
  if (Math.hypot(x - 20, z + 60) < 22) return "meadow";
  if (Math.hypot(x - 80, z - 20) < 18) return "meadow";
  return "grass";
}

export type GreenReachTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

/** Claw, through the west side of the main mass, to the north lip. */
export function greenReachTrails(): GreenReachTrail[] {
  const mouth = (i: number) => ({ x: greenReachAscents()[i]!.pts[0]!.x, z: greenReachAscents()[i]!.pts[0]!.z });
  return [
    {
      id: "claw-path",
      surface: "dirt",
      points: [
        { x: -70, z: 8 },
        { x: -55, z: 20 },
        { x: -36, z: 22 },
        { x: -16, z: 40 },
        { x: -10, z: 58 },
        { x: -10, z: 84 },
      ],
    },
    { id: "caps-spur", surface: "dirt", points: [{ x: -16, z: 40 }, { x: -1, z: 46.5 }, { x: 17, z: 47 }, mouth(0)] },
    { id: "east-cap-spur", surface: "dirt", points: [{ x: 29, z: 43.5 }, { x: 35, z: 33.5 }, { x: 52, z: 29.5 }, mouth(1)] },
    { id: "cave-spur", surface: "dirt", points: [{ x: -10, z: 69 }, mouth(2)] },
    ...greenReachAscents().map((a) => ({
      id: a.id,
      surface: "stone" as const,
      points: a.pts.filter((_, k) => k % 6 === 0 || k === a.pts.length - 1).map((p) => ({ x: p.x, z: p.z })),
    })),
  ];
}

export const GR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "claw-path": "Claw Path",
  "caps-spur": "Caps Spur",
  "east-cap-spur": "East Cap Spur",
  "cave-spur": "Cave Spur",
  "white-caps-stair": "White Caps Stair",
  "east-cap-ledge": "East Cap Ledge",
  "north-cave": "Hollow Stair Cave",
};

export type GreenReachLabelKind = "area" | "camp" | "landmark" | "water";

export const GR_MAP_LABELS: readonly { text: string; x: number; z: number; kind: GreenReachLabelKind }[] = [
  { text: "Long Claw", x: -70, z: 8, kind: "area" },
  { text: "Still Pool", x: 25, z: 25, kind: "water" },
  { text: "White Caps", x: 40, z: 45, kind: "landmark" },
  { text: "South Point", x: 20, z: -60, kind: "area" },
];

export function greenReachGateSoftLevel(x: number, z: number): number | null {
  for (const g of GR_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
