/**
 * Islet Fords — travel chain of three islets between ring_ward and green_reach.
 *
 * Area sheet
 * 1. Bounds: x -20..200, z -36..36. 15_840 m², about 70 screens.
 *    Grid 441×145 at 0.5 m. Bake 24 + 4×441×145 = 255_804 B.
 * 2. Walkable: three discs and two ford capsules. Channel |z| < 28 outside
 *    that mask is open water. |z| >= 28 is blocked mountain. About 25%.
 * 3. Relief: islet pads 1.6 m, ford crests 0.9 m, water surface 0.3,
 *    bed 0.3 − 1.35. Max under 3 m.
 * 4. Widths: islets r = 16, 18, 16. Fords 7 m (half-width 3.5). Trail 3.3 m.
 *    The channel off the fords is wider than 1.5 m, so it can wade.
 * 5. Exits: west-lip (2..14, −6..6) → ring_ward, east-lip (180..192, −8..4) → green_reach.
 *    Soft level 8. Neither gate is blocked. Spawn (24, 0) facing 0.
 * 6. Landmarks: West Islet, Mid Islet, East Islet.
 *
 * North is +z. Gate centres sit inside the end discs, so those radii stay put.
 */

import { zoneLink } from "./zone-links";

export const IF_BOUNDS = {
  minX: -20,
  maxX: 200,
  minZ: -36,
  maxZ: 36,
} as const;

export const IF_TRAIL_WIDTH = 3.3;

export const IF_SURFACE = 0.3;
export const IF_BED = IF_SURFACE - 1.35;
const IF_PAD = 1.6;
const IF_CREST = 0.9;
const IF_CHANNEL = 28;

export const IF_ISLETS = [
  { x: 16, z: 0, r: 16 },
  { x: 100, z: 4, r: 18 },
  { x: 176, z: -2, r: 16 },
] as const;

/** Capsules between islet centres. Half-width 3.5 m. */
export const IF_FORDS = [
  {
    ax: IF_ISLETS[0].x, az: IF_ISLETS[0].z, ar: IF_ISLETS[0].r,
    bx: IF_ISLETS[1].x, bz: IF_ISLETS[1].z, br: IF_ISLETS[1].r,
    r: 3.5,
  },
  {
    ax: IF_ISLETS[1].x, az: IF_ISLETS[1].z, ar: IF_ISLETS[1].r,
    bx: IF_ISLETS[2].x, bz: IF_ISLETS[2].z, br: IF_ISLETS[2].r,
    r: 3.5,
  },
] as const;

export const IF_SPAWN = { x: 24, z: 0, facing: 0 } as const;

export type IsletFordsGate = {
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
  const link = zoneLink("islet_fords", gate);
  if (!link) throw new Error(`missing zone link islet_fords/${gate}`);
  return link.to;
}

export const IF_GATES: readonly IsletFordsGate[] = [
  { id: "west-lip", minX: 2, maxX: 14, minZ: -6, maxZ: 6, softLevel: 8, blocked: false, destZone: destOf("west-lip") },
  { id: "east-lip", minX: 180, maxX: 192, minZ: -8, maxZ: 4, softLevel: 8, blocked: false, destZone: destOf("east-lip") },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

/** Signed distance to the islet-and-ford mask. Negative is inside. */
export function isletFordsMaskDist(x: number, z: number): number {
  let d = Infinity;
  for (const c of IF_ISLETS) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  for (const f of IF_FORDS) d = Math.min(d, segDist(x, z, f.ax, f.az, f.bx, f.bz) - f.r);
  return d;
}

function inIslet(x: number, z: number): boolean {
  for (const c of IF_ISLETS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.r) return true;
  }
  return false;
}

/** Ford deck: inside a capsule and outside both end islets. */
export function isletFordsOnFord(x: number, z: number): boolean {
  if (inIslet(x, z)) return false;
  for (const f of IF_FORDS) {
    if (segDist(x, z, f.ax, f.az, f.bx, f.bz) <= f.r) return true;
  }
  return false;
}

export function isletFordsInOpenWater(x: number, z: number): boolean {
  if (x < IF_BOUNDS.minX || x > IF_BOUNDS.maxX) return false;
  if (z < IF_BOUNDS.minZ || z > IF_BOUNDS.maxZ) return false;
  if (Math.abs(z) >= IF_CHANNEL) return false;
  return isletFordsMaskDist(x, z) > 0;
}

export function isletFordsOnBridge(_x: number, _z: number): boolean {
  return false;
}

function inRect(x: number, z: number, g: IsletFordsGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

export function isletFordsWalkable(x: number, z: number): boolean {
  if (x < IF_BOUNDS.minX || x > IF_BOUNDS.maxX) return false;
  if (z < IF_BOUNDS.minZ || z > IF_BOUNDS.maxZ) return false;
  if (Math.abs(z) >= IF_CHANNEL) return false;
  if (isletFordsMaskDist(x, z) > 0) return false;
  if (isletFordsInOpenWater(x, z)) return false;
  for (const g of IF_GATES) {
    if (g.blocked && inRect(x, z, g)) return false;
  }
  return true;
}

export function isletFordsWaterSurfaceY(x: number, z: number): number | null {
  if (!isletFordsInOpenWater(x, z)) return null;
  return IF_SURFACE;
}

/** Pad on the islets, crest on the gap, bed under the channel. */
function terrainY(x: number, z: number): number {
  if (Math.abs(z) >= IF_CHANNEL) {
    const t = (Math.abs(z) - IF_CHANNEL) / 8;
    return 2.2 + smooth(t) * 0.55;
  }
  if (isletFordsMaskDist(x, z) > 0) return IF_BED;
  let y = IF_PAD;
  for (const f of IF_FORDS) {
    if (segDist(x, z, f.ax, f.az, f.bx, f.bz) > f.r) continue;
    const da = Math.hypot(x - f.ax, z - f.az) - f.ar;
    const db = Math.hypot(x - f.bx, z - f.bz) - f.br;
    const gap = Math.min(da, db);
    if (gap <= 0) continue;
    const k = smooth(Math.min(gap, 10) / 10);
    y = Math.min(y, IF_PAD + (IF_CREST - IF_PAD) * k);
  }
  return y;
}

export function isletFordsStandHeight(x: number, z: number): number {
  return Math.max(-1.35, Math.min(2.95, terrainY(x, z)));
}

export function isletFordsHeight(x: number, z: number): number {
  return isletFordsStandHeight(x, z);
}

export type IsletFordsBiome = "river" | "riverbank" | "grass" | "mountain";

export function isletFordsBiome(x: number, z: number): IsletFordsBiome {
  if (Math.abs(z) >= IF_CHANNEL) return "mountain";
  if (isletFordsMaskDist(x, z) > 0) return "river";
  if (isletFordsOnFord(x, z)) return "riverbank";
  if (isletFordsMaskDist(x, z) > -2.2) return "riverbank";
  return "grass";
}

export type IsletFordsTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function isletFordsTrails(): IsletFordsTrail[] {
  return [
    {
      id: "ford-path",
      surface: "dirt",
      points: [
        { x: 8, z: 0 },
        { x: 16, z: 0 },
        { x: 58, z: 2 },
        { x: 100, z: 4 },
        { x: 138, z: 1 },
        { x: 176, z: -2 },
        { x: 186, z: -2 },
      ],
    },
  ];
}

export const IF_ROAD_NAMES: Readonly<Record<string, string>> = {
  "ford-path": "Ford Path",
};

export type IsletFordsLabelKind = "area" | "camp" | "landmark" | "water";

export const IF_MAP_LABELS: readonly { text: string; x: number; z: number; kind: IsletFordsLabelKind }[] = [
  { text: "West Islet", x: 16, z: 0, kind: "area" },
  { text: "Mid Islet", x: 100, z: 4, kind: "area" },
  { text: "East Islet", x: 176, z: -2, kind: "area" },
];

export function isletFordsGateSoftLevel(x: number, z: number): number | null {
  for (const g of IF_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
