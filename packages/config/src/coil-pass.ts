/**
 * Coil Pass — a climbing switchback between the green reach and the ridge.
 *
 * Area sheet
 * 1. Bounds: x -22..22, z 0..180. 7_920 m², about 35 screens.
 *    Grid 89×361 at 0.5 m. Bake 24 + 4×89×361 = 128_540 B.
 * 2. Walkable mask: capsule half-width 6 m on the switchback polyline.
 *    Outside is blocked highland (mountain). Gate centers sit inside the
 *    capsule, so the gate rects are not padded.
 * 3. Relief: road y = 2 + 6×(z/180). South lip 2 m, north lip 8 m.
 *    Banks beside the road rise about 3 m and stay under 10 m. No water.
 * 4. Widths: road 12 m, dirt trail 3.3 m along the polyline.
 * 5. Exits: south-lip to green_reach, north-lip to coil_ridge. Spawn (0, 22).
 * 6. Landmarks: Switchback (0, 90).
 *
 * North is +z. Facing 0 looks toward +z.
 */

import { zoneLink } from "./zone-links";

export const CP_BOUNDS = {
  minX: -22,
  maxX: 22,
  minZ: 0,
  maxZ: 180,
} as const;

export const CP_TRAIL_WIDTH = 3.3;

export const CP_SPAWN = { x: 0, z: 22, facing: 0 } as const;

/** Switchback centreline. The last vertex is the north lip of the road. */
const CP_POLYLINE: readonly { x: number; z: number }[] = [
  { x: 0, z: 8 },
  { x: 10, z: 40 },
  { x: -10, z: 80 },
  { x: 10, z: 120 },
  { x: 0, z: 168 },
];

const ROAD_HALF = 6;

export type CoilPassGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  destZone: string;
};

function destZone(gate: string): string {
  const link = zoneLink("coil_pass", gate);
  if (!link) throw new Error(`no zone link for coil_pass ${gate}`);
  return link.to;
}

export const CP_GATES: readonly CoilPassGate[] = [
  {
    id: "south-lip",
    minX: -8,
    maxX: 8,
    minZ: 0,
    maxZ: 12,
    softLevel: 8,
    blocked: false,
    destZone: destZone("south-lip"),
  },
  {
    id: "north-lip",
    minX: -8,
    maxX: 8,
    minZ: 168,
    maxZ: 180,
    softLevel: 8,
    blocked: false,
    destZone: destZone("north-lip"),
  },
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

/** Metres to the switchback centreline. */
export function coilPassPathDist(x: number, z: number): number {
  let d = Infinity;
  for (let i = 1; i < CP_POLYLINE.length; i++) {
    const a = CP_POLYLINE[i - 1]!;
    const b = CP_POLYLINE[i]!;
    d = Math.min(d, segDist(x, z, a.x, a.z, b.x, b.z));
  }
  return d;
}

function inBounds(x: number, z: number): boolean {
  return x >= CP_BOUNDS.minX && x <= CP_BOUNDS.maxX && z >= CP_BOUNDS.minZ && z <= CP_BOUNDS.maxZ;
}

export function coilPassWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  return coilPassPathDist(x, z) <= ROAD_HALF;
}

export function coilPassInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function coilPassWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function coilPassOnBridge(_x: number, _z: number): boolean {
  return false;
}

/** Road grade. South is 2 m, north is 8 m. */
function roadY(z: number): number {
  return 2 + 6 * (z / 180);
}

/** Feet height. The road follows the grade; banks beside it rise about 3 m. */
export function coilPassStandHeight(x: number, z: number): number {
  const base = roadY(z);
  const d = coilPassPathDist(x, z);
  let y = base;
  if (d > ROAD_HALF) y = base + 3 * smooth((d - ROAD_HALF) / 8);
  return Math.max(-0.5, Math.min(9.85, y));
}

export function coilPassHeight(x: number, z: number): number {
  return coilPassStandHeight(x, z);
}

export type CoilPassBiome = "grass" | "scrub" | "mountain";

export function coilPassBiome(x: number, z: number): CoilPassBiome {
  const d = coilPassPathDist(x, z);
  if (d > ROAD_HALF) return "mountain";
  if (d > 4) return "scrub";
  return "grass";
}

export type CoilPassTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function coilPassTrails(): CoilPassTrail[] {
  return [
    {
      id: "switchback",
      surface: "dirt",
      points: CP_POLYLINE.map((p) => ({ x: p.x, z: p.z })),
    },
  ];
}

export const CP_ROAD_NAMES: Readonly<Record<string, string>> = {
  switchback: "Switchback",
};

export type CoilPassLabelKind = "area" | "camp" | "landmark" | "water";

export const CP_MAP_LABELS: readonly { text: string; x: number; z: number; kind: CoilPassLabelKind }[] = [
  { text: "Switchback", x: 0, z: 90, kind: "landmark" },
];

function inRect(x: number, z: number, g: CoilPassGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

export function coilPassGateSoftLevel(x: number, z: number): number | null {
  for (const g of CP_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
