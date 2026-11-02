/**
 * Forest Basin: a wooded bowl sculpted with the map-builder Map tab.
 *
 * Area sheet
 * 1. Bounds: x -160..160, z -160..160. Grid 641x641 at 0.5 m when baked.
 * 2. Ground: `forest-basin-terrain.ts`, folded from the builder overlay by
 *    `tools/map-builder/fold.ts`. Never hand-edit; sculpt and fold again.
 * 3. Water, bridges, trails, ascents, warp rings and places:
 *    `forest-basin-features.ts`. The Briarwater and Coldrun fall from the
 *    Graven Fells into the Stillmere; the Sinkwater drains it east to the Swallow.
 *    Water at or under 0.5 m is a ford (wadeable); deeper water needs a bridge.
 * 4. Exits: south lip (Hollow Road) and southeast gap (Spur Road). Other lips stay blocked.
 *
 * North is +z.
 */

import { zoneLink } from "./zone-links";
import {
  FB_BRIDGES,
  FB_PLACES,
  FB_RIVERS,
  FB_STILLMERE,
  FB_TRAIL_DEFS,
  FB_WADE_DEPTH,
  FB_WARP_SITES,
  fbBridgeAt,
  fbDesignWater,
  fbTrailDist,
} from "./forest-basin-features";
import { FB_TERRAIN_B64, FB_TERRAIN_N } from "./forest-basin-terrain";

export const FOREST_BASIN_BOUNDS = {
  minX: -160,
  maxX: 160,
  minZ: -160,
  maxZ: 160,
} as const;

export const FB_TRAIL_WIDTH = 3.3;
export const FB_BRIDGE_DECK_W = 3.9;

/** Kettle Hollow, the camp and hub. */
export const FB_CAMP = { x: 14, z: -100, r: 9, floorY: 3.2 } as const;
/** The Stillmere (legacy single-lake export; the shore is `FB_STILLMERE.outline`). */
export const FB_LAKE = { x: 78, z: 22, r: 0, surface: FB_STILLMERE.surface } as const;

export const FB_SPAWN = { x: 12, z: -100, facing: 0 } as const;

const PAD = 4;

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

let terrain: Uint8Array | null = null;
function grid(): Uint8Array {
  if (!terrain) {
    const bin = atob(FB_TERRAIN_B64);
    terrain = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) terrain[k] = bin.charCodeAt(k);
  }
  return terrain;
}
function cellIndex(x: number, z: number): number {
  const i = Math.max(0, Math.min(FB_TERRAIN_N - 1, Math.round(x - FOREST_BASIN_BOUNDS.minX)));
  const j = Math.max(0, Math.min(FB_TERRAIN_N - 1, Math.round(z - FOREST_BASIN_BOUNDS.minZ)));
  return j * FB_TERRAIN_N + i;
}
function cm(i: number, j: number): number {
  const g = grid();
  const ii = Math.max(0, Math.min(FB_TERRAIN_N - 1, i));
  const jj = Math.max(0, Math.min(FB_TERRAIN_N - 1, j));
  const o = (jj * FB_TERRAIN_N + ii) * 3;
  const v = g[o]! | (g[o + 1]! << 8);
  return v & 0x8000 ? v - 0x10000 : v;
}
function cellFlags(x: number, z: number): number {
  return grid()[cellIndex(x, z) * 3 + 2]!;
}

/** Sculpted ground (bed under water), bilinear over the 1 m grid. */
export function forestBasinGroundY(x: number, z: number): number {
  const fx = x - FOREST_BASIN_BOUNDS.minX;
  const fz = z - FOREST_BASIN_BOUNDS.minZ;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = cm(i, j) + (cm(i + 1, j) - cm(i, j)) * tx;
  const b = cm(i, j + 1) + (cm(i + 1, j + 1) - cm(i, j + 1)) * tx;
  return (a + (b - a) * tz) / 100;
}

/** Legacy: x of the Briarwater nearest z (first river). */
export function forestBasinRiverX(z: number): number {
  const p = FB_RIVERS[0]!.points;
  let best = p[0]!;
  for (const q of p) if (Math.abs(q.z - z) < Math.abs(best.z - z)) best = q;
  return best.x;
}

export function forestBasinOnBridge(x: number, z: number): boolean {
  return fbBridgeAt(x, z) != null;
}

/** Any water not under a bridge, fords included, so wading water still reads as water. */
export function forestBasinInOpenWater(x: number, z: number): boolean {
  return fbDesignWater(x, z) != null && !forestBasinOnBridge(x, z);
}

export function forestBasinBridgeCenter(): { x: number; z: number } {
  const b = FB_BRIDGES[0]!;
  return { x: (b.a.x + b.b.x) / 2, z: (b.a.z + b.b.z) / 2 };
}

export function forestBasinWalkable(x: number, z: number): boolean {
  if (!inPad(x, z)) return false;
  for (const g of FB_GATES) {
    if (g.blocked && inRect(x, z, g)) return false;
  }
  if (forestBasinOnBridge(x, z)) return true;
  const w = fbDesignWater(x, z);
  if (w) return w.depth <= FB_WADE_DEPTH;
  const f = cellFlags(x, z);
  if (f & 8) return true;
  return (f & 4) === 0;
}

export function forestBasinWaterSurfaceY(x: number, z: number): number | null {
  return fbDesignWater(x, z)?.surface ?? null;
}

export function forestBasinStandHeight(x: number, z: number): number {
  const b = fbBridgeAt(x, z);
  if (b) return b.deckY;
  return forestBasinGroundY(x, z);
}

export function forestBasinHeight(x: number, z: number): number {
  return forestBasinStandHeight(x, z);
}

export type ForestBasinBiome = "grass" | "meadow" | "mountain" | "river" | "riverbank" | "bridge";

export function forestBasinBiome(x: number, z: number): ForestBasinBiome {
  if (forestBasinOnBridge(x, z)) return "bridge";
  if (fbDesignWater(x, z)) return "river";
  if (!inPad(x, z)) return "mountain";
  const f = cellFlags(x, z) & 3;
  if (f === 3) return "mountain";
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
    if (fbDesignWater(x + dx, z + dz)) return "riverbank";
  }
  if (f === 2) return "meadow";
  return "grass";
}

export type ForestBasinTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function forestBasinTrails(): ForestBasinTrail[] {
  return FB_TRAIL_DEFS.map((t) => ({ id: t.id, surface: t.surface, points: t.points.map((p) => ({ x: p.x, z: p.z })) }));
}

export function forestBasinOnTrail(x: number, z: number): boolean {
  return fbTrailDist(x, z) <= FB_TRAIL_WIDTH / 2;
}

export const FB_ROAD_NAMES: Readonly<Record<string, string>> = Object.fromEntries(FB_TRAIL_DEFS.map((t) => [t.id, t.name]));

export type ForestBasinLabelKind = "area" | "camp" | "landmark" | "water";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const FB_MAP_LABELS: readonly { text: string; x: number; z: number; kind: ForestBasinLabelKind }[] = [
  { text: "Forest Basin", x: -40, z: -20, kind: "area" },
  ...FB_PLACES.map((p) => ({
    text: cap(p.name),
    x: p.x,
    z: p.z,
    kind: (p.kind === "camp" ? "camp" : p.kind === "water" ? "water" : "landmark") as ForestBasinLabelKind,
  })),
  ...FB_WARP_SITES.map((w) => ({ text: cap(w.name), x: w.x, z: w.z + 4, kind: "landmark" as ForestBasinLabelKind })),
  ...FB_RIVERS.map((r) => {
    const p = r.points[Math.floor(r.points.length / 3)]!;
    return { text: cap(r.name), x: p.x, z: p.z, kind: "water" as ForestBasinLabelKind };
  }),
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
