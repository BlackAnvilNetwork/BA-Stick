/**
 * Forest Basin — a branching field north of the hollow's scale.
 *
 * Area sheet
 * 1. Bounds: x -160..160, z -160..160. 102_400 m², about 455 screens.
 *    Grid 641×641 at 0.5 m. Bake 24 + 4×641×641 = 1_643_548 B.
 * 2. Walkable mask: union of expanse discs and corridor capsules.
 *    Outside the mask is blocked highland (mountain). A 4 m sample of the box
 *    is about 30% to 50% walkable; the rest is the highland between the fingers.
 * 3. Relief: valley floor ~1.2 m, lake bed 0.15 m, water surface 1.55 m
 *    falling to ~0.45 m downriver, ridge crests 8–10 m, hard cap 11.5 m.
 * 4. Widths: dry necks 8 m, brook necks 12 m, valley spine ~56 m,
 *    main river 10 m, brooks 2.6 m, trail 3.3 m, bridge deck 3.9 m.
 * 5. Exits: four soft gates on the fingers, one blocked gate on the north shore.
 *    The south lip hands off to hollow_road (back to Pale Hollow). The southeast
 *    lip hands off to spur_road. The other lips are still closed.
 * 6. Landmarks: `FB_MAP_LABELS`.
 *
 * North is +z. The mere sits in a northern bowl. A river leaves its south
 * shore and winds down the central valley. Narrow brooks run the southern fingers.
 * High ground is piled on the north, the west, and the southeast.
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

/** Northern mere. The river leaves the south shore. */
export const FB_LAKE = { x: 0, z: 115, r: 22, surface: 1.55 } as const;

/** Eastern spur camp. Local pad is flat. */
export const FB_CAMP = { x: 128, z: 28, r: 16, floorY: 2.35 } as const;

export const FB_SPAWN = { x: FB_CAMP.x, z: FB_CAMP.z, facing: Math.PI } as const;

type Disc = { x: number; z: number; r: number };
type Cap = { ax: number; az: number; bx: number; bz: number; r: number };

/** Wide country. */
const DISCS: readonly Disc[] = [
  { x: 0, z: 115, r: 34 },
  { x: 0, z: 0, r: 50 },
  { x: -112, z: 22, r: 44 },
  { x: -38, z: 142, r: 22 },
  { x: -96, z: -112, r: 34 },
  { x: 108, z: -104, r: 44 },
  { x: 2, z: -132, r: 20 },
  { x: FB_CAMP.x, z: FB_CAMP.z, r: FB_CAMP.r },
];

/** Necks. The north-south one is the valley; the rest are narrow fingers. */
const CAPS: readonly Cap[] = [
  { ax: 0, az: 82, bx: 0, bz: 44, r: 24 },
  { ax: -44, az: 12, bx: -76, bz: 20, r: 4 },
  { ax: 44, az: 10, bx: 114, bz: 26, r: 4 },
  { ax: -16, az: 40, bx: -32, bz: 122, r: 4 },
  { ax: -28, az: -32, bx: -72, bz: -88, r: 5 },
  { ax: 32, az: -28, bx: 76, bz: -76, r: 5 },
  { ax: 0, az: -44, bx: 2, bz: -114, r: 5 },
];

/** Ridge peaks. The core is blocked; the shoulder is walkable high ground. */
export const FB_MOUNTAINS: readonly { x: number; z: number; r: number; h: number }[] = [
  { x: -70, z: 148, r: 18, h: 9.2 },
  { x: 55, z: 150, r: 16, h: 8.4 },
  { x: -8, z: 156, r: 14, h: 8 },
  { x: -150, z: 28, r: 20, h: 10 },
  { x: -146, z: -28, r: 18, h: 9 },
  { x: -128, z: 88, r: 16, h: 8.2 },
  { x: 146, z: -36, r: 18, h: 9 },
  { x: 142, z: -132, r: 20, h: 10 },
  { x: 52, z: -152, r: 16, h: 8.5 },
];

export type ForestBasinGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  /** Destination zone id, or null when the lip is not open yet. */
  destZone: string | null;
};

export const FB_GATES: readonly ForestBasinGate[] = [
  { id: "north-pass", minX: -28, maxX: -16, minZ: 128, maxZ: 140, softLevel: 15, blocked: true, destZone: null },
  { id: "west-gap", minX: -132, maxX: -120, minZ: 40, maxZ: 52, softLevel: 8, blocked: false, destZone: null },
  { id: "northwest-gap", minX: -48, maxX: -36, minZ: 148, maxZ: 160, softLevel: 10, blocked: false, destZone: null },
  { id: "southwest-gap", minX: -112, maxX: -100, minZ: -128, maxZ: -116, softLevel: 12, blocked: false, destZone: null },
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

const RIVER_A = 12;
const RIVER_K = (Math.PI * 2) / 57;
const RIVER_Z0 = 88;
const RIVER_Z1 = -52;

/** Main stem, metres east of the valley axis. North-south at the crests. */
export function forestBasinRiverX(z: number): number {
  return RIVER_A * Math.sin((z - 89) * RIVER_K);
}

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

/** Signed distance to the land mask. Negative is inside. */
export function forestBasinMaskDist(x: number, z: number): number {
  let d = Infinity;
  for (const c of DISCS) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  for (const c of CAPS) d = Math.min(d, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r);
  return d;
}

function inPeakCore(x: number, z: number): boolean {
  for (const m of FB_MOUNTAINS) {
    if (Math.hypot(x - m.x, z - m.z) < m.r * 0.38) return true;
  }
  return false;
}

const BROOKS: readonly Cap[] = [
  { ax: -28, az: -32, bx: -72, bz: -88, r: 1.3 },
  { ax: 32, az: -28, bx: 76, bz: -76, r: 1.3 },
  { ax: 0, az: -50, bx: 2, bz: -140, r: 1.3 },
];

function riverHalf(z: number): number {
  return z < -40 ? 1.3 : 5;
}

function nearRiver(x: number, z: number): number {
  if (z < RIVER_Z1 - 4 || z > RIVER_Z0 + 4) return Infinity;
  let best = Infinity;
  const z0 = Math.max(RIVER_Z1, z - 8);
  const z1 = Math.min(RIVER_Z0, z + 8);
  const step = 4;
  let pz = z0;
  let px = forestBasinRiverX(pz);
  for (let zz = z0 + step; zz <= z1 + 0.01; zz += step) {
    const nx = forestBasinRiverX(zz);
    best = Math.min(best, segDist(x, z, px, pz, nx, zz));
    px = nx;
    pz = zz;
  }
  return best;
}

export function forestBasinInOpenWater(x: number, z: number): boolean {
  if (forestBasinMaskDist(x, z) > 1) return false;
  if (Math.hypot(x - FB_LAKE.x, z - FB_LAKE.z) < FB_LAKE.r) return true;
  if (z <= RIVER_Z0 && z >= RIVER_Z1 && nearRiver(x, z) < riverHalf(z)) return true;
  for (const b of BROOKS) {
    if (segDist(x, z, b.ax, b.az, b.bx, b.bz) < b.r) return true;
  }
  return false;
}

/** One valley crossing, where the meander runs north-south. */
export const FB_BRIDGE = { id: "valley-cross", z: 75, halfSpan: 9, halfDeck: FB_BRIDGE_DECK_W / 2 } as const;

export function forestBasinBridgeCenter(): { x: number; z: number } {
  return { x: forestBasinRiverX(FB_BRIDGE.z), z: FB_BRIDGE.z };
}

export function forestBasinOnBridge(x: number, z: number): boolean {
  const c = forestBasinBridgeCenter();
  return Math.abs(x - c.x) <= FB_BRIDGE.halfSpan && Math.abs(z - c.z) <= FB_BRIDGE.halfDeck;
}

function inRect(x: number, z: number, g: ForestBasinGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

export function forestBasinWalkable(x: number, z: number): boolean {
  if (x < FOREST_BASIN_BOUNDS.minX || x > FOREST_BASIN_BOUNDS.maxX) return false;
  if (z < FOREST_BASIN_BOUNDS.minZ || z > FOREST_BASIN_BOUNDS.maxZ) return false;
  if (forestBasinOnBridge(x, z)) return true;
  if (forestBasinMaskDist(x, z) > 0) return false;
  if (inPeakCore(x, z)) return false;
  if (forestBasinInOpenWater(x, z)) return false;
  for (const g of FB_GATES) {
    if (g.blocked && inRect(x, z, g)) return false;
  }
  return true;
}

function surfaceAt(z: number): number {
  if (z >= RIVER_Z0) return FB_LAKE.surface;
  const t = (RIVER_Z0 - z) / (RIVER_Z0 - (-140));
  return FB_LAKE.surface + (0.45 - FB_LAKE.surface) * Math.max(0, Math.min(1, t));
}

export function forestBasinWaterSurfaceY(x: number, z: number): number | null {
  if (!forestBasinInOpenWater(x, z)) return null;
  return surfaceAt(z);
}

function terrainY(x: number, z: number): number {
  let y = 1.15;
  for (const m of FB_MOUNTAINS) {
    const t = Math.hypot(x - m.x, z - m.z) / m.r;
    if (t < 1) {
      const k = (1 - t) * (1 - t);
      y = Math.max(y, m.h * k + 1.15 * (1 - k));
    }
  }
  const d = forestBasinMaskDist(x, z);
  if (d > 0) y = Math.max(y, 1.15 + smooth(d / 16) * 8.3);

  const ld = Math.hypot(x - FB_LAKE.x, z - FB_LAKE.z);
  if (ld < FB_LAKE.r + 12) {
    const bowl = 0.15 + (2.4 - 0.15) * smooth(ld / (FB_LAKE.r + 4));
    const rim = ld > FB_LAKE.r ? 4.2 * smooth((ld - FB_LAKE.r) / 10) : 0;
    y = bowl + rim * (1 - smooth(ld / (FB_LAKE.r + 12)));
  }

  const rd = nearRiver(x, z);
  const half = riverHalf(z) + 4;
  if (z <= RIVER_Z0 && z >= RIVER_Z1 && rd < half) {
    const surface = surfaceAt(z);
    const bed = surface - 1.35;
    const bank = y;
    y = bed + (bank - bed) * smooth(rd / half);
  }
  for (const b of BROOKS) {
    const bd = segDist(x, z, b.ax, b.az, b.bx, b.bz);
    if (bd < b.r + 3) {
      const surface = 0.7;
      const bed = surface - 1.1;
      y = Math.min(y, bed + (y - bed) * smooth(bd / (b.r + 3)));
    }
  }

  if (Math.hypot(x - FB_CAMP.x, z - FB_CAMP.z) < 11) y = FB_CAMP.floorY;
  return Math.max(-0.5, Math.min(11.5, y));
}

let deckMemo = NaN;
function deckY(): number {
  if (Number.isFinite(deckMemo)) return deckMemo;
  const c = forestBasinBridgeCenter();
  const left = terrainY(c.x - FB_BRIDGE.halfSpan - 1, c.z);
  const right = terrainY(c.x + FB_BRIDGE.halfSpan + 1, c.z);
  const surface = surfaceAt(c.z);
  deckMemo = Math.max(left, right, surface + 0.45);
  return deckMemo;
}

/** Feet height. The bridge deck is flat; everywhere else matches the mesh. */
export function forestBasinStandHeight(x: number, z: number): number {
  if (forestBasinOnBridge(x, z)) return deckY();
  return terrainY(x, z);
}

export function forestBasinHeight(x: number, z: number): number {
  return forestBasinStandHeight(x, z);
}

export type ForestBasinBiome =
  | "hub_indoor"
  | "river"
  | "riverbank"
  | "bridge"
  | "grass"
  | "meadow"
  | "ashbeam"
  | "scrub"
  | "mountain"
  | "crypt";

export function forestBasinBiome(x: number, z: number): ForestBasinBiome {
  if (Math.hypot(x - FB_CAMP.x, z - FB_CAMP.z) < 11) return "hub_indoor";
  if (forestBasinOnBridge(x, z)) return "bridge";
  if (forestBasinInOpenWater(x, z)) return "river";
  if (Math.hypot(x - FB_LAKE.x, z - FB_LAKE.z) < FB_LAKE.r + 5) return "riverbank";
  if (z <= RIVER_Z0 && z >= RIVER_Z1 && nearRiver(x, z) < riverHalf(z) + 4) return "riverbank";
  const d = forestBasinMaskDist(x, z);
  // Outside the mask is empty on the minimap (blocked crypt). Peak cores stay highland.
  if (inPeakCore(x, z)) return "mountain";
  if (d > 0) return "crypt";
  if (Math.hypot(x + 112, z - 20) < 30) return "meadow";
  if (Math.hypot(x - 20, z + 20) < 22) return "ashbeam";
  if (d > -8) return "scrub";
  return "grass";
}

export type ForestBasinTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function forestBasinTrails(): ForestBasinTrail[] {
  const c = forestBasinBridgeCenter();
  return [
    {
      id: "spur-road",
      surface: "dirt",
      points: [
        { x: 118, z: 30 },
        { x: 70, z: 24 },
        { x: 46, z: 16 },
      ],
    },
    {
      id: "valley-cross",
      surface: "dirt",
      points: [
        { x: 20, z: 64 },
        { x: c.x + 14, z: c.z },
        { x: c.x - 14, z: c.z },
        { x: c.x - 22, z: 96 },
      ],
    },
    {
      id: "west-road",
      surface: "dirt",
      points: [
        { x: -36, z: 8 },
        { x: -70, z: 16 },
        { x: -100, z: 24 },
      ],
    },
    {
      id: "mere-road",
      surface: "dirt",
      points: [
        { x: -36, z: 36 },
        { x: -42, z: 74 },
        { x: -38, z: 108 },
      ],
    },
    {
      id: "south-run",
      surface: "dirt",
      points: [
        { x: 5, z: -58 },
        { x: 5, z: -116 },
      ],
    },
    {
      id: "hollow-road",
      surface: "dirt",
      points: [
        { x: 8, z: -120 },
        { x: 8, z: -146 },
      ],
    },
    {
      id: "southwest-path",
      surface: "dirt",
      points: [
        { x: -38, z: -40 },
        { x: -56, z: -62 },
        { x: -76, z: -88 },
      ],
    },
    {
      id: "southeast-path",
      surface: "dirt",
      points: [
        { x: 36, z: -10 },
        { x: 54, z: -48 },
        { x: 82, z: -74 },
      ],
    },
  ];
}

export const FB_ROAD_NAMES: Readonly<Record<string, string>> = {
  "spur-road": "Spur Road",
  "valley-cross": "Valley Cross",
  "west-road": "West Reach Road",
  "mere-road": "Mere Road",
  "south-run": "South Run",
  "hollow-road": "Hollow Road",
  "southwest-path": "Southwest Path",
  "southeast-path": "Southeast Path",
};

export type ForestBasinLabelKind = "area" | "camp" | "landmark" | "water";

export const FB_MAP_LABELS: readonly { text: string; x: number; z: number; kind: ForestBasinLabelKind }[] = [
  { text: "North Mere", x: FB_LAKE.x, z: FB_LAKE.z, kind: "water" },
  { text: "Spur Camp", x: FB_CAMP.x, z: FB_CAMP.z, kind: "camp" },
  { text: "West Reach", x: -112, z: 18, kind: "area" },
  { text: "South Run", x: 8, z: -100, kind: "area" },
  { text: "Hollow Road", x: 8, z: -144, kind: "landmark" },
  { text: "High Ridge", x: 120, z: -120, kind: "landmark" },
  { text: "Valley Cross", x: -12, z: 75, kind: "landmark" },
];

export function forestBasinClamp(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(FOREST_BASIN_BOUNDS.minX, Math.min(FOREST_BASIN_BOUNDS.maxX, x)),
    z: Math.max(FOREST_BASIN_BOUNDS.minZ, Math.min(FOREST_BASIN_BOUNDS.maxZ, z)),
  };
}

/** Stop at the last walkable sample. Bridges stay passable. */
export function forestBasinClampMove(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const end = forestBasinClamp(toX, toZ);
  if (!forestBasinWalkable(fromX, fromZ) && forestBasinWalkable(end.x, end.z)) return end;
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / 0.3));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = forestBasinClamp(fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!forestBasinWalkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

export function forestBasinGateSoftLevel(x: number, z: number): number | null {
  for (const g of FB_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
