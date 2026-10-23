/**
 * Coil Ridge — concentric highland, a spiral channel, and a southern tongue.
 *
 * Area sheet
 * 1. Bounds: x -120..120, z -150..110. 62_400 m², about 277 screens.
 *    Grid 481×521 at 0.5 m. Bake 24 + 4×481×521 = 1_002_428 B.
 * 2. Walkable mask: disc (0, 10) r=100, tongue capsule (0, -40)-(0, -130)
 *    half-width 14, tip disc (0, -130) r=18. Spiral channel is open water.
 *    The crown core is blocked. Outside is blocked highland (mountain).
 *    The tongue-lip centre sits in the tip disc, so the gate rect is not padded.
 * 3. Relief: floor 2 m, radial cosine crests up to 9 m, crown 10.5 m,
 *    tongue about 2.4 m, water surface 1.0, bed 1.0−1.35. Hard cap 11.5 m.
 * 4. Widths: tongue 28 m, spiral channel an angular half-width of 0.15 rad
 *    (about 7 m at the inner radius, wider outward), dirt trail 3.3 m.
 * 5. Exits: tongue-lip to coil_pass. Spawn (0, -120).
 * 6. Landmarks: South Tongue, Spiral Water, Crown.
 *
 * North is +z. The spiral is open only for z > -50, so the tongue stays dry
 * and joins the walkable disc. Facing 0 looks toward +z.
 */

import { zoneLink } from "./zone-links";

export const CR_BOUNDS = {
  minX: -120,
  maxX: 120,
  minZ: -150,
  maxZ: 110,
} as const;

export const CR_TRAIL_WIDTH = 3.3;

export const CR_SPAWN = { x: 0, z: -120, facing: 0 } as const;

const CENTER = { x: 0, z: 10 } as const;
const DISC_R = 100;
const TONGUE = { ax: 0, az: -40, bx: 0, bz: -130, r: 14 } as const;
const TIP = { x: 0, z: -130, r: 18 } as const;
const PEAK_R = 12;
const CROWN_H = 10.5;

/** Spiral arm: polar angle equals radius × this, half-width in radians. */
const SPIRAL_K = 0.15;
const SPIRAL_HALF = 0.15;
const SPIRAL_R0 = 24;
const SPIRAL_R1 = 88;
const SPIRAL_Z = -50;

const WATER_SURFACE = 1;
const WATER_BED = WATER_SURFACE - 1.35;

export type CoilRidgeGate = {
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
  const link = zoneLink("coil_ridge", gate);
  if (!link) throw new Error(`no zone link for coil_ridge ${gate}`);
  return link.to;
}

export const CR_GATES: readonly CoilRidgeGate[] = [
  {
    id: "tongue-lip",
    minX: -8,
    maxX: 8,
    minZ: -146,
    maxZ: -134,
    softLevel: 8,
    blocked: false,
    destZone: destZone("tongue-lip"),
  },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function angDiff(a: number, b: number): number {
  const d = a - b;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

function radial(x: number, z: number): number {
  return Math.hypot(x - CENTER.x, z - CENTER.z);
}

/** Signed distance to the land mask. Negative is inside. */
export function coilRidgeMaskDist(x: number, z: number): number {
  const disc = radial(x, z) - DISC_R;
  const tongue = segDist(x, z, TONGUE.ax, TONGUE.az, TONGUE.bx, TONGUE.bz) - TONGUE.r;
  const tip = Math.hypot(x - TIP.x, z - TIP.z) - TIP.r;
  return Math.min(disc, tongue, tip);
}

/**
 * Angular distance to the spiral arm, or null when the point is outside the
 * channel's radius band. The z cut is applied by the caller.
 */
function spiralAng(x: number, z: number): number | null {
  const dx = x - CENTER.x;
  const dz = z - CENTER.z;
  const r = Math.hypot(dx, dz);
  if (r < SPIRAL_R0 || r > SPIRAL_R1) return null;
  return angDiff(Math.atan2(dz, dx), r * SPIRAL_K);
}

export function coilRidgeInOpenWater(x: number, z: number): boolean {
  if (z <= SPIRAL_Z) return false;
  const ang = spiralAng(x, z);
  return ang != null && ang <= SPIRAL_HALF;
}

export function coilRidgeWaterSurfaceY(x: number, z: number): number | null {
  if (!coilRidgeInOpenWater(x, z)) return null;
  return WATER_SURFACE;
}

export function coilRidgeOnBridge(_x: number, _z: number): boolean {
  return false;
}

function inPeakCore(x: number, z: number): boolean {
  return radial(x, z) < PEAK_R;
}

function inBounds(x: number, z: number): boolean {
  return x >= CR_BOUNDS.minX && x <= CR_BOUNDS.maxX && z >= CR_BOUNDS.minZ && z <= CR_BOUNDS.maxZ;
}

export function coilRidgeWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  if (coilRidgeMaskDist(x, z) > 0) return false;
  if (inPeakCore(x, z)) return false;
  if (coilRidgeInOpenWater(x, z)) return false;
  return true;
}

/** Radial cosine on the disc: floor 2 m, crests 9 m. */
function ridgeRing(r: number): number {
  const wave = 0.5 + 0.5 * Math.cos((r * Math.PI * 2) / 24);
  return 2 + 7 * wave;
}

/** Crown dome. The blocked core reaches 10.5 m. */
function crown(r: number): number {
  if (r >= 20) return 0;
  const t = 1 - r / 20;
  return CROWN_H * t * t;
}

/** 0 on the ridged disc, 1 on the southern tongue. */
function tongueBlend(z: number): number {
  return smooth((-20 - z) / 30);
}

/** Feet height. Water cells sit on the bed; the tongue is a dry shelf. */
export function coilRidgeStandHeight(x: number, z: number): number {
  const r = radial(x, z);
  let y = Math.max(ridgeRing(r), crown(r));
  const flat = tongueBlend(z);
  y = y * (1 - flat) + 2.4 * flat;

  if (z > SPIRAL_Z) {
    const ang = spiralAng(x, z);
    if (ang != null && ang < 0.55) {
      if (ang <= SPIRAL_HALF) y = WATER_BED;
      else {
        const u = smooth((ang - SPIRAL_HALF) / (0.55 - SPIRAL_HALF));
        y = WATER_BED + (y - WATER_BED) * u;
      }
    }
  }

  const md = coilRidgeMaskDist(x, z);
  if (md > 0) y = Math.max(y, 4 + smooth(Math.min(md, 24) / 24) * 6);

  return Math.max(-0.5, Math.min(11.5, y));
}

export function coilRidgeHeight(x: number, z: number): number {
  return coilRidgeStandHeight(x, z);
}

export type CoilRidgeBiome = "river" | "riverbank" | "grass" | "meadow" | "mountain";

export function coilRidgeBiome(x: number, z: number): CoilRidgeBiome {
  if (coilRidgeMaskDist(x, z) > 0 || inPeakCore(x, z)) return "mountain";
  if (coilRidgeInOpenWater(x, z)) return "river";
  const ang = spiralAng(x, z);
  if (z > SPIRAL_Z && ang != null && ang < 0.45) return "riverbank";
  if (coilRidgeStandHeight(x, z) < 6) return "meadow";
  return "grass";
}

export type CoilRidgeTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

/** Dirt track up the dry tongue onto the disc, stopping short of the channel. */
export function coilRidgeTrails(): CoilRidgeTrail[] {
  return [
    {
      id: "tongue-track",
      surface: "dirt",
      points: [
        { x: 0, z: -140 },
        { x: 0, z: -80 },
        { x: 0, z: -42 },
      ],
    },
  ];
}

export const CR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "tongue-track": "Tongue Track",
};

export type CoilRidgeLabelKind = "area" | "camp" | "landmark" | "water";

export const CR_MAP_LABELS: readonly { text: string; x: number; z: number; kind: CoilRidgeLabelKind }[] = [
  { text: "South Tongue", x: 0, z: -120, kind: "area" },
  { text: "Spiral Water", x: 40, z: 10, kind: "water" },
  { text: "Crown", x: 0, z: 10, kind: "landmark" },
];

function inRect(x: number, z: number, g: CoilRidgeGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

export function coilRidgeGateSoftLevel(x: number, z: number): number | null {
  for (const g of CR_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
