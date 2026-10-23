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
  { x: 25, z: 25, r: 10, surface: GR_SURFACE },
  { x: 55, z: -15, r: 6, surface: GR_SURFACE },
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
  let d = Infinity;
  for (const c of GR_DISCS) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  return d;
}

export function greenReachInOpenWater(x: number, z: number): boolean {
  for (const p of GR_POOLS) {
    if (Math.hypot(x - p.x, z - p.z) <= p.r) return true;
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

export function greenReachWalkable(x: number, z: number): boolean {
  if (x < GR_BOUNDS.minX || x > GR_BOUNDS.maxX) return false;
  if (z < GR_BOUNDS.minZ || z > GR_BOUNDS.maxZ) return false;
  if (greenReachMaskDist(x, z) > 0) return false;
  if (greenReachInOpenWater(x, z)) return false;
  if (inPeakCore(x, z)) return false;
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

function terrainY(x: number, z: number): number {
  let y = baseY(x, z);
  for (const m of GR_PEAKS) {
    const t = Math.hypot(x - m.x, z - m.z) / m.r;
    if (t < 1) {
      const k = (1 - t) * (1 - t);
      y = Math.max(y, m.h * k + baseY(x, z) * (1 - k));
    }
  }
  const d = greenReachMaskDist(x, z);
  if (d > 0) y = Math.max(y, 1.3 + smooth(Math.min(d, 24) / 24) * 6.4);
  for (const p of GR_POOLS) {
    const pd = Math.hypot(x - p.x, z - p.z);
    const reach = p.r + 4;
    if (pd < reach) {
      const bed = p.surface - 1.35;
      y = bed + (y - bed) * smooth(pd / reach);
    }
  }
  return y;
}

export function greenReachStandHeight(x: number, z: number): number {
  return Math.max(-0.5, Math.min(11, terrainY(x, z)));
}

export function greenReachHeight(x: number, z: number): number {
  return greenReachStandHeight(x, z);
}

export type GreenReachBiome = "river" | "riverbank" | "grass" | "meadow" | "mountain";

export function greenReachBiome(x: number, z: number): GreenReachBiome {
  if (greenReachInOpenWater(x, z)) return "river";
  if (greenReachMaskDist(x, z) > 0) return "mountain";
  for (const m of GR_PEAKS) {
    if (Math.hypot(x - m.x, z - m.z) < m.r * 0.62) return "mountain";
  }
  for (const p of GR_POOLS) {
    if (Math.hypot(x - p.x, z - p.z) < p.r + 3.5) return "riverbank";
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
  ];
}

export const GR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "claw-path": "Claw Path",
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
