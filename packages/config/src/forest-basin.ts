/**
 * Forest Basin — blank map canvas (terrain reset).
 *
 * Area sheet
 * 1. Bounds: x -160..160, z -160..160. 102_400 m², about 455 screens.
 *    Grid 641×641 at 0.5 m. Bake 24 + 4×641×641 = 1_643_548 B.
 * 2. Walkable mask: flat meadow pad inset 4 m from the box edge.
 *    Outside the pad is blocked highland (mountain). ~100% of the pad is walkable.
 * 3. Relief: flat 2.0 m across the pad. Hard cap 2.0 m.
 * 4. No rivers, trails, or bridges until authored here.
 * 5. Exits: south lip (Hollow Road) and southeast gap (Spur Road) stay wired.
 *    Other lips remain blocked placeholders.
 * 6. Landmarks: `FB_MAP_LABELS` (canvas label only).
 *
 * North is +z.
 */

import { zoneLink } from "./zone-links";

export const FOREST_BASIN_BOUNDS = {
  minX: -160,
  maxX: 160,
  minZ: -160,
  maxZ: 160,
} as const;

export const FB_TRAIL_WIDTH = 3.3;
export const FB_BRIDGE_DECK_W = 3.9;

/** Legacy exports — unused on the blank canvas; kept for importers. */
export const FB_LAKE = { x: 0, z: 115, r: 0, surface: 2.0 } as const;
export const FB_CAMP = { x: 0, z: 0, r: 0, floorY: 2.0 } as const;
export const FB_MOUNTAINS: readonly { x: number; z: number; r: number; h: number }[] = [];
export const FB_BRIDGE = { id: "valley-cross", z: 75, halfSpan: 0, halfDeck: 0 } as const;

export const FB_SPAWN = { x: 0, z: 0, facing: 0 } as const;

const PAD = 4;
const FLOOR_Y = 2.0;

export type ForestBasinGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  destZone: string | null;
};

export const FB_GATES: readonly ForestBasinGate[] = [
  { id: "north-pass", minX: -28, maxX: -16, minZ: 128, maxZ: 140, softLevel: 15, blocked: true, destZone: null },
  { id: "west-gap", minX: -132, maxX: -120, minZ: 40, maxZ: 52, softLevel: 8, blocked: true, destZone: null },
  { id: "northwest-gap", minX: -48, maxX: -36, minZ: 148, maxZ: 160, softLevel: 10, blocked: true, destZone: null },
  { id: "southwest-gap", minX: -112, maxX: -100, minZ: -128, maxZ: -116, softLevel: 12, blocked: true, destZone: null },
  { id: "southeast-gap", minX: 124, maxX: 136, minZ: -120, maxZ: -108, softLevel: 12, blocked: false, destZone: "spur_road" },
  {
    id: "south-lip",
    minX: 2,
    maxX: 14,
    minZ: -150,
    maxZ: -138,
    softLevel: 8,
    blocked: false,
    destZone: zoneLink("forest_basin", "south-lip")?.to ?? null,
  },
];

function inBounds(x: number, z: number): boolean {
  return (
    x >= FOREST_BASIN_BOUNDS.minX &&
    x <= FOREST_BASIN_BOUNDS.maxX &&
    z >= FOREST_BASIN_BOUNDS.minZ &&
    z <= FOREST_BASIN_BOUNDS.maxZ
  );
}

function inPad(x: number, z: number): boolean {
  return (
    x >= FOREST_BASIN_BOUNDS.minX + PAD &&
    x <= FOREST_BASIN_BOUNDS.maxX - PAD &&
    z >= FOREST_BASIN_BOUNDS.minZ + PAD &&
    z <= FOREST_BASIN_BOUNDS.maxZ - PAD
  );
}

function inRect(x: number, z: number, g: ForestBasinGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

/** Signed distance to the walkable pad. Negative is inside. */
export function forestBasinMaskDist(x: number, z: number): number {
  if (!inBounds(x, z)) return 1;
  const dx = Math.max(FOREST_BASIN_BOUNDS.minX + PAD - x, 0, x - (FOREST_BASIN_BOUNDS.maxX - PAD));
  const dz = Math.max(FOREST_BASIN_BOUNDS.minZ + PAD - z, 0, z - (FOREST_BASIN_BOUNDS.maxZ - PAD));
  return Math.hypot(dx, dz);
}

export function forestBasinRiverX(_z: number): number {
  return 0;
}

export function forestBasinInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function forestBasinBridgeCenter(): { x: number; z: number } {
  return { x: 0, z: 0 };
}

export function forestBasinOnBridge(_x: number, _z: number): boolean {
  return false;
}

export function forestBasinWalkable(x: number, z: number): boolean {
  if (!inPad(x, z)) return false;
  for (const g of FB_GATES) {
    if (g.blocked && inRect(x, z, g)) return false;
  }
  return true;
}

export function forestBasinWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function forestBasinStandHeight(_x: number, _z: number): number {
  return FLOOR_Y;
}

export function forestBasinHeight(x: number, z: number): number {
  return forestBasinStandHeight(x, z);
}

export type ForestBasinBiome = "grass" | "meadow" | "mountain";

export function forestBasinBiome(x: number, z: number): ForestBasinBiome {
  if (!inPad(x, z) || !forestBasinWalkable(x, z)) return "mountain";
  return "meadow";
}

export type ForestBasinTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function forestBasinTrails(): ForestBasinTrail[] {
  return [];
}

export function forestBasinOnTrail(_x: number, _z: number): boolean {
  return false;
}

export const FB_ROAD_NAMES: Readonly<Record<string, string>> = {};

export type ForestBasinLabelKind = "area" | "camp" | "landmark" | "water";

export const FB_MAP_LABELS: readonly { text: string; x: number; z: number; kind: ForestBasinLabelKind }[] = [
  { text: "Forest Basin", x: 0, z: 0, kind: "area" },
];

export function forestBasinClamp(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(FOREST_BASIN_BOUNDS.minX, Math.min(FOREST_BASIN_BOUNDS.maxX, x)),
    z: Math.max(FOREST_BASIN_BOUNDS.minZ, Math.min(FOREST_BASIN_BOUNDS.maxZ, z)),
  };
}

export function forestBasinClampMoveUsing(
  walkable: (x: number, z: number) => boolean,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const end = forestBasinClamp(toX, toZ);
  if (!walkable(fromX, fromZ) && walkable(end.x, end.z)) return end;
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / 0.3));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = forestBasinClamp(fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!walkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

export function forestBasinClampMove(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  return forestBasinClampMoveUsing(forestBasinWalkable, fromX, fromZ, toX, toZ);
}

export function forestBasinGateSoftLevel(x: number, z: number): number | null {
  for (const g of FB_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
