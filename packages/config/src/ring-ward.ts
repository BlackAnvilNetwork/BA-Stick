/**
 * Ring Ward — concentric wards, a west canal, and a south-east wharf.
 *
 * Area sheet
 * 1. Bounds: x -100..100, z -100..100. 40_000 m², 178 screens.
 *    Grid 401×401 at 0.5 m. Bake 24 + 4×401×401 = 643_228 B.
 * 2. Walkable disc r=86. Building annuli 18..28, 40..58, and 72..82 are
 *    blocked terrace except the 8 m axis streets and the two gate rects.
 *    Mountain is only the blocked ground outside the disc.
 *    Mask widen: the wharf-gap center is outside r=86 and inside the wharf
 *    water. The rect is not moved. It is forced dry and walkable, and a
 *    12 m corridor (half-width 6) is opened from the ring street through
 *    the outer annulus so a 4 m flood can reach the center.
 * 3. Relief: streets 2.2 m, keep pad 4.2 m inside r=14, canal surface 0.6
 *    with a 1.35 m carve, wharf surface 0.35. Hard cap 6 m. Beds clamp at -0.5.
 * 4. Widths: radial streets 8 m, ring streets 8 m, canal 12 m
 *    (centre x=-62, z=-40..70), bridge deck 3.9 m at z=20, wharf disc (70, -70) r=18.
 * 5. Exits: north-gap to spur_road, wharf-gap to islet_fords. Spawn (0, 68).
 * 6. Landmarks: Inner Keep, Outer Ring, West Canal, South Wharf.
 *
 * North is +z. A south cut joins the canal to the wharf without entering the gate.
 */

import { zoneLink } from "./zone-links";
import { nearTrailCorridor } from "./trail-geom";

export const RW_BOUNDS = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } as const;

export const RW_TRAIL_WIDTH = 3.3;

export const RW_SPAWN = { x: 0, z: 68, facing: 0 } as const;

export const RW_WALK_R = 86;
export const RW_KEEP_R = 14;
export const RW_STREET_Y = 2.2;
export const RW_KEEP_Y = 4.2;
const RW_CAP = 6;
const RW_CARVE = 1.35;

export const RW_CANAL = { x: -62, z0: -40, z1: 70, halfWidth: 6, surface: 0.6 } as const;

export const RW_BRIDGE = { x: -62, z: 20, halfSpan: 12, halfDeck: 1.95 } as const;

export const RW_WHARF = { x: 70, z: -70, r: 18, surface: 0.35 } as const;

const BUILDING_RINGS: readonly [number, number][] = [
  [18, 28],
  [40, 58],
  [72, 82],
];

export type RingWardGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  destZone: string;
};

function linkedDest(zone: string, gate: string): string {
  const link = zoneLink(zone, gate);
  if (!link) throw new Error(`missing zone link ${zone} ${gate}`);
  return link.to;
}

export const RW_GATES: readonly RingWardGate[] = [
  {
    id: "north-gap",
    minX: -8,
    maxX: 8,
    minZ: 78,
    maxZ: 90,
    softLevel: 6,
    blocked: false,
    destZone: linkedDest("ring_ward", "north-gap"),
  },
  {
    id: "wharf-gap",
    minX: 52,
    maxX: 64,
    minZ: -78,
    maxZ: -66,
    softLevel: 6,
    blocked: false,
    destZone: linkedDest("ring_ward", "wharf-gap"),
  },
];

const WHARF_GATE = RW_GATES[1]!;
const WHARF_CX = (WHARF_GATE.minX + WHARF_GATE.maxX) / 2;
const WHARF_CZ = (WHARF_GATE.minZ + WHARF_GATE.maxZ) / 2;
const WHARF_AIM = Math.hypot(WHARF_CX, WHARF_CZ);

/** Corridor from the outer ring street to the wharf gate. The only mask widen. */
export const RW_APPROACH = {
  ax: (WHARF_CX / WHARF_AIM) * 66,
  az: (WHARF_CZ / WHARF_AIM) * 66,
  bx: WHARF_CX,
  bz: WHARF_CZ,
  half: 6,
} as const;

/** South of the wards, clear of the wharf gate. Joins the canal mouth to the wharf disc. */
const SOUTH_CUT: readonly { ax: number; az: number; bx: number; bz: number; r: number }[] = [
  { ax: RW_CANAL.x, az: RW_CANAL.z0, bx: -78, bz: -64, r: 4.5 },
  { ax: -78, az: -64, bx: -24, bz: -96, r: 4.5 },
  { ax: -24, az: -96, bx: 66, bz: -84, r: 4.5 },
];

const SOUTH_CUT_SURFACE = 0.48;

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

function inBounds(x: number, z: number): boolean {
  return x >= RW_BOUNDS.minX && x <= RW_BOUNDS.maxX && z >= RW_BOUNDS.minZ && z <= RW_BOUNDS.maxZ;
}

function inRect(x: number, z: number, g: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

function inAnyGate(x: number, z: number): boolean {
  for (const g of RW_GATES) {
    if (inRect(x, z, g)) return true;
  }
  return false;
}

/** 8 m streets: open when the nearer axis is within 4 m. */
export function ringWardAxisStreet(x: number, z: number): boolean {
  return Math.min(Math.abs(x), Math.abs(z)) <= 4;
}

export function ringWardOnApproach(x: number, z: number): boolean {
  return segDist(x, z, RW_APPROACH.ax, RW_APPROACH.az, RW_APPROACH.bx, RW_APPROACH.bz) <= RW_APPROACH.half;
}

function onQuay(x: number, z: number): boolean {
  return inAnyGate(x, z) || ringWardOnApproach(x, z);
}

function inAnnulus(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  for (const [a, b] of BUILDING_RINGS) {
    if (r >= a && r <= b) return true;
  }
  return false;
}

function buildingBlocked(x: number, z: number): boolean {
  if (!inAnnulus(x, z)) return false;
  if (ringWardAxisStreet(x, z)) return false;
  if (onQuay(x, z)) return false;
  return true;
}

export function ringWardOnBridge(x: number, z: number): boolean {
  return Math.abs(x - RW_BRIDGE.x) <= RW_BRIDGE.halfSpan && Math.abs(z - RW_BRIDGE.z) <= RW_BRIDGE.halfDeck;
}

function inCanal(x: number, z: number): boolean {
  return z >= RW_CANAL.z0 && z <= RW_CANAL.z1 && Math.abs(x - RW_CANAL.x) <= RW_CANAL.halfWidth;
}

function inWharfDisc(x: number, z: number): boolean {
  return Math.hypot(x - RW_WHARF.x, z - RW_WHARF.z) <= RW_WHARF.r;
}

function inSouthCut(x: number, z: number): boolean {
  for (const s of SOUTH_CUT) {
    if (segDist(x, z, s.ax, s.az, s.bx, s.bz) <= s.r) return true;
  }
  return false;
}

export function ringWardInOpenWater(x: number, z: number): boolean {
  if (ringWardOnBridge(x, z)) return false;
  if (onQuay(x, z)) return false;
  if (inCanal(x, z)) return true;
  if (inWharfDisc(x, z)) return true;
  if (inSouthCut(x, z)) return true;
  return false;
}

export function ringWardWaterSurfaceY(x: number, z: number): number | null {
  if (!ringWardInOpenWater(x, z)) return null;
  if (inWharfDisc(x, z)) return RW_WHARF.surface;
  if (inCanal(x, z)) return RW_CANAL.surface;
  return SOUTH_CUT_SURFACE;
}

export function ringWardWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  if (ringWardOnBridge(x, z)) return true;
  if (ringWardInOpenWater(x, z)) return false;
  if (onQuay(x, z)) return true;
  if (Math.hypot(x, z) > RW_WALK_R) return false;
  if (buildingBlocked(x, z)) return false;
  return true;
}

function carve(dist: number, reach: number, surface: number, bank: number): number {
  if (!(dist < reach)) return bank;
  const bed = surface - RW_CARVE;
  const t = smooth(dist / reach);
  return bed + (bank - bed) * t;
}

function carveCanal(x: number, z: number, y: number): number {
  const past = z < RW_CANAL.z0 ? RW_CANAL.z0 - z : z > RW_CANAL.z1 ? z - RW_CANAL.z1 : 0;
  const dist = Math.hypot(Math.abs(x - RW_CANAL.x), past);
  return carve(dist, RW_CANAL.halfWidth + 4, RW_CANAL.surface, y);
}

function carveWharf(x: number, z: number, y: number): number {
  const dist = Math.hypot(x - RW_WHARF.x, z - RW_WHARF.z);
  return carve(dist, RW_WHARF.r + 4, RW_WHARF.surface, y);
}

function carveSouthCut(x: number, z: number, y: number): number {
  let best = y;
  for (const s of SOUTH_CUT) {
    const dist = segDist(x, z, s.ax, s.az, s.bx, s.bz);
    best = Math.min(best, carve(dist, s.r + 3, SOUTH_CUT_SURFACE, y));
  }
  return best;
}

function terrainY(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (onQuay(x, z)) return RW_STREET_Y;
  let y = RW_STREET_Y;
  if (r < RW_KEEP_R) y = RW_KEEP_Y;
  else if (r < 18) y = RW_KEEP_Y + (RW_STREET_Y - RW_KEEP_Y) * smooth((r - RW_KEEP_R) / (18 - RW_KEEP_R));
  if (buildingBlocked(x, z)) y = Math.max(y, 3.5);
  if (r > RW_WALK_R) y = Math.max(y, RW_STREET_Y + smooth(Math.min(r - RW_WALK_R, 24) / 24) * 3.4);
  y = Math.min(y, carveCanal(x, z, y));
  y = Math.min(y, carveWharf(x, z, y));
  y = Math.min(y, carveSouthCut(x, z, y));
  return Math.max(-0.5, Math.min(RW_CAP, y));
}

let deckMemo = NaN;
function deckY(): number {
  if (Number.isFinite(deckMemo)) return deckMemo;
  const z = RW_BRIDGE.z;
  const east = terrainY(RW_CANAL.x + RW_CANAL.halfWidth + 0.8, z);
  const west = terrainY(RW_CANAL.x - RW_CANAL.halfWidth - 0.8, z);
  deckMemo = Math.max(east, west, RW_CANAL.surface + 0.45, RW_STREET_Y);
  return deckMemo;
}

export function ringWardStandHeight(x: number, z: number): number {
  if (ringWardOnBridge(x, z)) return deckY();
  return terrainY(x, z);
}

export function ringWardHeight(x: number, z: number): number {
  return ringWardStandHeight(x, z);
}

export type RingWardBiome =
  | "hub_indoor"
  | "terrace"
  | "river"
  | "riverbank"
  | "bridge"
  | "ash_road"
  | "mountain"
  | "meadow";

function ringStreetBand(r: number): boolean {
  return (r >= 14 && r < 18) || (r >= 30 && r <= 38) || (r >= 61 && r <= 69);
}

function nearWaterBank(x: number, z: number): boolean {
  if (z >= RW_CANAL.z0 - 2 && z <= RW_CANAL.z1 + 2) {
    const d = Math.abs(x - RW_CANAL.x);
    if (d > RW_CANAL.halfWidth && d < RW_CANAL.halfWidth + 3.5) return true;
  }
  const w = Math.hypot(x - RW_WHARF.x, z - RW_WHARF.z);
  return w > RW_WHARF.r && w < RW_WHARF.r + 4;
}

export function ringWardBiome(x: number, z: number): RingWardBiome {
  if (ringWardOnBridge(x, z)) return "bridge";
  if (ringWardInOpenWater(x, z)) return "river";
  const r = Math.hypot(x, z);
  if (r < RW_KEEP_R) return "hub_indoor";
  if (buildingBlocked(x, z)) return "terrace";
  if (r > RW_WALK_R && !onQuay(x, z)) return "mountain";
  if (onQuay(x, z) || ringWardAxisStreet(x, z) || ringStreetBand(r)) return "ash_road";
  if (nearWaterBank(x, z)) return "riverbank";
  return "meadow";
}

export type RingWardTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

/** Dry arc of the outer ring street. The west of that circle sits in the canal. */
function dryRingStreet(): { x: number; z: number }[] {
  const radius = 65;
  const n = 36;
  const samples: { x: number; z: number; wet: boolean }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    samples.push({ x, z, wet: ringWardInOpenWater(x, z) });
  }
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    if (!samples[i]!.wet) continue;
    if (first < 0) first = i;
    last = i;
  }
  const pts: { x: number; z: number }[] = [];
  const push = (s: { x: number; z: number }) => {
    const prev = pts[pts.length - 1];
    if (prev && prev.x === s.x && prev.z === s.z) return;
    pts.push({ x: s.x, z: s.z });
  };
  if (first < 0) {
    for (const s of samples) push(s);
    return pts;
  }
  for (let i = last + 1; i < samples.length; i++) push(samples[i]!);
  for (let i = 0; i < first; i++) push(samples[i]!);
  return pts;
}

export function ringWardTrails(): RingWardTrail[] {
  return [
    {
      id: "north-street",
      surface: "stone",
      points: [
        { x: 0, z: -80 },
        { x: 0, z: 80 },
      ],
    },
    {
      id: "east-street",
      surface: "stone",
      points: [
        { x: -46, z: 0 },
        { x: 80, z: 0 },
      ],
    },
    {
      id: "west-street",
      surface: "stone",
      points: [
        { x: -84, z: 0 },
        { x: -74, z: 0 },
      ],
    },
    {
      id: "ring-street",
      surface: "stone",
      points: dryRingStreet(),
    },
    {
      id: "west-bridge",
      surface: "stone",
      points: [
        { x: RW_BRIDGE.x - RW_BRIDGE.halfSpan, z: RW_BRIDGE.z },
        { x: RW_BRIDGE.x + RW_BRIDGE.halfSpan, z: RW_BRIDGE.z },
      ],
    },
  ];
}

/** Streets, quay approach, and minimap trail polylines (matches BAZ1 trails). */
export function ringWardOnTrail(x: number, z: number): boolean {
  if (ringWardBiome(x, z) === "ash_road") return true;
  if (ringWardOnApproach(x, z)) return true;
  return nearTrailCorridor(x, z, ringWardTrails(), RW_TRAIL_WIDTH);
}

export const RW_ROAD_NAMES: Readonly<Record<string, string>> = {
  "north-street": "North Street",
  "east-street": "East Street",
  "west-street": "West Street",
  "ring-street": "Ring Street",
  "west-bridge": "West Bridge",
};

export type RingWardLabelKind = "area" | "camp" | "landmark" | "water";

export const RW_MAP_LABELS: readonly { text: string; x: number; z: number; kind: RingWardLabelKind }[] = [
  { text: "Inner Keep", x: 0, z: 0, kind: "landmark" },
  { text: "Outer Ring", x: 0, z: 74, kind: "area" },
  { text: "West Canal", x: RW_CANAL.x, z: RW_BRIDGE.z, kind: "water" },
  { text: "South Wharf", x: RW_WHARF.x, z: RW_WHARF.z, kind: "water" },
];

export function ringWardGateSoftLevel(x: number, z: number): number | null {
  for (const g of RW_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
