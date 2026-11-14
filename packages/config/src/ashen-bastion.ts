/**
 * Ashen Bastion — courtyard castle on a rocky shelf (heightfield walkability; SDF BAM1 architecture).
 *
 * Area sheet: docs/maps/ashen-bastion-area.md
 * 1. Bounds: x -72..72, z -48..64. 144×112 m = 16 128 m² (~72 screens). Grid 289×225 @ 0.5 m.
 * 2. Walkable: closed curtain footprint, south gate, inner courtyard + street grid, rampart ring,
 *    SE/SW yard→rampart stairs, SDF house floor pads (kit A/B/C/D/H), keep pads, approach,
 *    west Smolder lip, bridges.
 * 3. Relief: yard 2.0, rampart 5.2, keep mid 8.4, keep top 11.0, house 2.0. Cap 12.
 * 4. Widths: approach 4.5, gate 3.6, courtyard streets 3.0, rampart ≥1.8, stair 1.8, door ≥1.2.
 * 5. Exits: south-lip → ring_ward. Spawn (0, -20) south gateyard, facing π.
 * 6. Landmarks: Smolder-Ledge, Sablefolio Ledge, Kettlestone Crown, Hammergate Crown.
 *
 * North is +z. Facing 0 looks toward +z.
 */

import { zoneLink } from "./zone-links";

export const AB_BOUNDS = { minX: -72, maxX: 72, minZ: -48, maxZ: 64 } as const;
export const AB_TRAIL_WIDTH = 3.3;
export const AB_SPAWN = { x: 0, z: -20, facing: Math.PI } as const;

/** Kit pitch — wall props / bay spacing aligned with ba-sdf-gear CastleModule. */
export const AB_KIT_PITCH = 2.64;

export const AB_YARD_Y = 2.0;
export const AB_RAMPART_Y = 5.2;
export const AB_KEEP_MID_Y = 8.4;
export const AB_KEEP_TOP_Y = 11.0;
const AB_CAP = 12;

/** Inner curtain rectangle (yard sits inside rampart band). */
const CURTAIN_WEST = -56;
const CURTAIN_EAST = 56;
const CURTAIN_SOUTH = -14;
const CURTAIN_NORTH = 50;

const RAMPART_CLEAR = 2.0;
const GATE_HALF_W = 1.8;
const APPROACH_HALF = 2.25;
const STREET_HALF = 1.5;
const STAIR_HALF = 0.9;
export type AshenBastionGate = {
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
  const link = zoneLink("ashen_bastion", gate);
  if (!link) throw new Error(`no zone link for ashen_bastion ${gate}`);
  return link.to;
}

export const AB_GATES: readonly AshenBastionGate[] = [
  {
    id: "south-lip",
    minX: -8,
    maxX: 8,
    minZ: -46,
    maxZ: -38,
    softLevel: 6,
    blocked: false,
    destZone: destZone("south-lip"),
  },
];

export const AB_ROAD_NAMES: Readonly<Record<string, string>> = {
  approach: "Approach",
  rampart: "Vigil Walk",
  kingsbridge: "Ash Span",
  spirebridge: "Bellhook Walk",
};

export type AshenBastionLabelKind = "area" | "camp" | "landmark" | "water";

export const AB_MAP_LABELS: readonly {
  text: string;
  x: number;
  z: number;
  kind: AshenBastionLabelKind;
}[] = [
  { text: "Smolder-Ledge", x: -62, z: 26, kind: "landmark" },
  { text: "Sablefolio Ledge", x: -36, z: 22, kind: "landmark" },
  { text: "Kettlestone Crown", x: 0, z: 36, kind: "landmark" },
  { text: "Hammergate Crown", x: 0, z: -8, kind: "landmark" },
  { text: "Ashen Bastion", x: 0, z: 18, kind: "area" },
];

/**
 * Floor pads under SDF courtyard houses (ba-sdf-gear HOUSE_PLACES).
 * Sized for L / tall / workshop / shed footprints; door thresholds stay at yard Y.
 */
const AB_HOUSE_PADS: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  // West curtain row (−48)
  { minX: -54, maxX: -42, minZ: 4, maxZ: 16 },
  { minX: -54, maxX: -42, minZ: 16, maxZ: 28 },
  { minX: -54, maxX: -42, minZ: 28, maxZ: 40 },
  // West mid street (−34 / −28)
  { minX: -40, maxX: -28, minZ: 4, maxZ: 16 },
  { minX: -40, maxX: -28, minZ: 28, maxZ: 40 },
  { minX: -34, maxX: -22, minZ: 16, maxZ: 28 },
  // East mid street (28 / 34)
  { minX: 22, maxX: 34, minZ: 4, maxZ: 16 },
  { minX: 28, maxX: 40, minZ: 16, maxZ: 28 },
  { minX: 28, maxX: 40, minZ: 28, maxZ: 40 },
  // East curtain row (48)
  { minX: 42, maxX: 54, minZ: 6, maxZ: 18 },
  { minX: 42, maxX: 54, minZ: 18, maxZ: 30 },
  { minX: 42, maxX: 54, minZ: 30, maxZ: 42 },
  // North curtain (south of keep)
  { minX: -26, maxX: -14, minZ: 40, maxZ: 48 },
  { minX: 14, maxX: 26, minZ: 40, maxZ: 48 },
  // South yard corners (clear of gate)
  { minX: -46, maxX: -34, minZ: -4, maxZ: 6 },
  { minX: 34, maxX: 46, minZ: -4, maxZ: 6 },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

function inRect(x: number, z: number, minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function insideCurtain(x: number, z: number): boolean {
  return x >= CURTAIN_WEST && x <= CURTAIN_EAST && z >= CURTAIN_SOUTH && z <= CURTAIN_NORTH;
}

function distToCurtainInner(x: number, z: number): number {
  if (!insideCurtain(x, z)) return Infinity;
  return Math.min(
    x - CURTAIN_WEST,
    CURTAIN_EAST - x,
    z - CURTAIN_SOUTH,
    CURTAIN_NORTH - z,
  );
}

/** Rocky shelf under castle + south scrape. */
function onShelf(x: number, z: number): boolean {
  if (inRect(x, z, CURTAIN_WEST - 10, CURTAIN_EAST + 10, CURTAIN_SOUTH - 6, CURTAIN_NORTH + 8)) {
    return true;
  }
  if (inRect(x, z, -66, -50, 10, 40)) return true;
  if (segDist(x, z, 0, -48, 0, CURTAIN_SOUTH) <= 10) return true;
  return false;
}

/** South approach road to Hammergate (center x = 0). */
function onApproach(x: number, z: number): boolean {
  return segDist(x, z, 0, -48, 0, CURTAIN_SOUTH - 0.5) <= APPROACH_HALF;
}

/** Walkable arch through south curtain. */
function onSouthGatePassage(x: number, z: number): boolean {
  return Math.abs(x) <= GATE_HALF_W && z >= CURTAIN_SOUTH - 0.5 && z <= -4;
}

/** Continuous rampart band along inside curtain face (≥1.8 m clear). */
function onRampartWalk(x: number, z: number): boolean {
  if (!insideCurtain(x, z)) return false;
  const d = distToCurtainInner(x, z);
  if (d > RAMPART_CLEAR || d < 0.05) return false;
  if (Math.abs(x) <= GATE_HALF_W + 0.15 && z < CURTAIN_SOUTH + RAMPART_CLEAR + 0.5) {
    return false;
  }
  return true;
}

/** Inner courtyard plate (inside rampart ring). */
function onCourtyardYard(x: number, z: number): boolean {
  if (!insideCurtain(x, z)) return false;
  const d = distToCurtainInner(x, z);
  if (d <= RAMPART_CLEAR + 0.05) return false;
  return true;
}

/** 3 m street grid through the ward. */
function onStreetGrid(x: number, z: number): boolean {
  if (!insideCurtain(x, z)) return false;
  if (Math.abs(x) <= STREET_HALF && z >= CURTAIN_SOUTH && z <= CURTAIN_NORTH - 4) return true;
  for (const streetZ of [8, 22, 36]) {
    if (Math.abs(z - streetZ) <= STREET_HALF && x >= CURTAIN_WEST + 4 && x <= CURTAIN_EAST - 4) {
      return true;
    }
  }
  return false;
}

function onHousePad(x: number, z: number): boolean {
  for (const p of AB_HOUSE_PADS) {
    if (inRect(x, z, p.minX, p.maxX, p.minZ, p.maxZ)) return true;
  }
  return false;
}

/** Smolder-Ledge west terrace (outside main curtain). */
function onSmolderLedge(x: number, z: number): boolean {
  return inRect(x, z, -68, -54, 12, 38);
}

/** Ash Span: Smolder lip ↔ west rampart. */
function onKingsbridge(x: number, z: number): boolean {
  if (segDist(x, z, -58, 26, -52, 26) <= 1.55) return true;
  if (inRect(x, z, -54.5, -51.5, 24, 28)) return true;
  return false;
}

/** Bellhook Walk: east rampart ↔ keep east abutment. */
function onSpireBridge(x: number, z: number): boolean {
  if (segDist(x, z, 52, 30, 44, 34) <= 1.55) return true;
  if (inRect(x, z, 42, 46, 32, 36)) return true;
  return false;
}

/** SW yard → rampart stair. */
function onSouthWestStair(x: number, z: number): boolean {
  return segDist(x, z, -38, 4, -52, -10) <= STAIR_HALF;
}

/** SE yard → rampart stair. */
function onSouthEastStair(x: number, z: number): boolean {
  return segDist(x, z, 38, 4, 52, -10) <= STAIR_HALF;
}

/** Bellhammer Rise: courtyard → keep mid → keep top. */
function onKeepStair(x: number, z: number): boolean {
  return segDist(x, z, 0, 28, 0, 42) <= STAIR_HALF + 0.1;
}

function onKeepMid(x: number, z: number): boolean {
  return inRect(x, z, -6, 6, 30, 38);
}

function onKeepTop(x: number, z: number): boolean {
  return inRect(x, z, -4, 4, 38, 44);
}

/** Sablefolio archive strip on west inner ward. */
function onSablefolioStrip(x: number, z: number): boolean {
  return inRect(x, z, -48, -34, 16, 28);
}

export function ashenBastionWalkable(x: number, z: number): boolean {
  if (x < AB_BOUNDS.minX || x > AB_BOUNDS.maxX || z < AB_BOUNDS.minZ || z > AB_BOUNDS.maxZ) {
    return false;
  }
  for (const g of AB_GATES) {
    if (g.blocked && inRect(x, z, g.minX, g.maxX, g.minZ, g.maxZ)) return false;
  }
  if (onApproach(x, z)) return true;
  if (onSouthGatePassage(x, z)) return true;
  if (onRampartWalk(x, z)) return true;
  if (onSouthWestStair(x, z)) return true;
  if (onSouthEastStair(x, z)) return true;
  if (onKeepStair(x, z)) return true;
  if (onKeepMid(x, z)) return true;
  if (onKeepTop(x, z)) return true;
  if (onKingsbridge(x, z)) return true;
  if (onSpireBridge(x, z)) return true;
  if (onSmolderLedge(x, z)) return true;
  if (onSablefolioStrip(x, z)) return true;
  if (onHousePad(x, z)) return true;
  if (onStreetGrid(x, z)) return true;
  if (onCourtyardYard(x, z)) return true;
  if (onShelf(x, z) && insideCurtain(x, z)) {
    return distToCurtainInner(x, z) <= RAMPART_CLEAR + 0.5;
  }
  return false;
}

function stairBlend(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y0: number,
  y1: number,
): number | null {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = ((x - ax) * dx + (z - az) * dz) / l2;
  if (t < -0.02 || t > 1.02) return null;
  const px = ax + clamp(t, 0, 1) * dx;
  const pz = az + clamp(t, 0, 1) * dz;
  if (Math.hypot(x - px, z - pz) > STAIR_HALF + 0.15) return null;
  return y0 + (y1 - y0) * smooth(clamp(t, 0, 1));
}

function yardLike(x: number, z: number): boolean {
  return (
    onApproach(x, z) ||
    onSouthGatePassage(x, z) ||
    onCourtyardYard(x, z) ||
    onStreetGrid(x, z) ||
    onHousePad(x, z) ||
    onSablefolioStrip(x, z) ||
    onSmolderLedge(x, z)
  );
}

export function ashenBastionStandHeight(x: number, z: number): number {
  let y = 0.4;
  if (onShelf(x, z)) {
    const edge = clamp((z + 36) / 22, 0, 1);
    y = Math.max(y, 0.5 + AB_YARD_Y * smooth(edge) * 0.35);
  }
  if (yardLike(x, z)) {
    y = Math.max(y, AB_YARD_Y);
  }
  if (onRampartWalk(x, z) || onKingsbridge(x, z) || onSpireBridge(x, z)) {
    y = Math.max(y, AB_RAMPART_Y);
  }
  if (onKeepMid(x, z)) y = Math.max(y, AB_KEEP_MID_Y);
  if (onKeepTop(x, z)) y = Math.max(y, AB_KEEP_TOP_Y);

  const sw = stairBlend(x, z, -38, 4, -52, -10, AB_YARD_Y, AB_RAMPART_Y);
  if (sw != null) y = Math.max(y, sw);
  const se = stairBlend(x, z, 38, 4, 52, -10, AB_YARD_Y, AB_RAMPART_Y);
  if (se != null) y = Math.max(y, se);
  const keepLow = stairBlend(x, z, 0, 28, 0, 36, AB_YARD_Y, AB_KEEP_MID_Y);
  if (keepLow != null) y = Math.max(y, keepLow);
  const keepHi = stairBlend(x, z, 0, 36, 0, 42, AB_KEEP_MID_Y, AB_KEEP_TOP_Y);
  if (keepHi != null) y = Math.max(y, keepHi);

  if (!ashenBastionWalkable(x, z) && z < -20) {
    y = Math.min(y, 0.6 + 0.3 * Math.sin(x * 0.4) * Math.cos(z * 0.3));
  }

  return clamp(y, -0.5, AB_CAP);
}

export function ashenBastionHeight(x: number, z: number): number {
  return ashenBastionStandHeight(x, z);
}

export function ashenBastionWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function ashenBastionInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function ashenBastionOnBridge(x: number, z: number): boolean {
  return onKingsbridge(x, z) || onSpireBridge(x, z);
}

export function ashenBastionOnTrail(x: number, z: number): boolean {
  return onApproach(x, z);
}

export type AshenBastionTrail = {
  id: string;
  surface: string;
  points: { x: number; z: number }[];
};

export function ashenBastionTrails(): AshenBastionTrail[] {
  return [
    {
      id: "approach",
      surface: "stone",
      points: [
        { x: 0, z: -48 },
        { x: 0, z: CURTAIN_SOUTH - 0.5 },
      ],
    },
  ];
}

export function ashenBastionBiome(x: number, z: number): string {
  if (!ashenBastionWalkable(x, z)) return "mountain";
  if (onApproach(x, z)) return "ash_road";
  if (
    onSouthGatePassage(x, z) ||
    onCourtyardYard(x, z) ||
    onStreetGrid(x, z) ||
    onHousePad(x, z) ||
    onSablefolioStrip(x, z)
  ) {
    return "hub_indoor";
  }
  if (onRampartWalk(x, z) || onSmolderLedge(x, z) || onKeepMid(x, z) || onKeepTop(x, z)) {
    return "terrace";
  }
  if (ashenBastionOnBridge(x, z)) return "bridge";
  if (z < -22) return "quarry";
  return "scrub";
}

export function ashenBastionGateSoftLevel(x: number, z: number): number | null {
  for (const g of AB_GATES) {
    if (inRect(x, z, g.minX, g.maxX, g.minZ, g.maxZ)) return g.softLevel;
  }
  return null;
}

export function ashenBastionClamp(x: number, z: number): { x: number; z: number } {
  return {
    x: clamp(x, AB_BOUNDS.minX + 0.5, AB_BOUNDS.maxX - 0.5),
    z: clamp(z, AB_BOUNDS.minZ + 0.5, AB_BOUNDS.maxZ - 0.5),
  };
}

/** Exported for tests — west curtain timber-L pad center. */
export const AB_SAMPLE_HOUSE = { x: -48, z: 10 } as const;
