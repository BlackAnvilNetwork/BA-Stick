/**
 * Spur Road — the scrub track that climbs from the basin to the ring wards.
 *
 * Area sheet
 * 1. Bounds: x -18..18, z 0..200. 7_200 m², 32 screens.
 *    Grid 73×401 at 0.5 m. Bake 24 + 4×73×401 = 117_116 B.
 * 2. Walkable: |x| <= 8, plus a disc r=14 at (0, 100).
 *    Outside the mask is blocked highland (mountain). Both gate centers
 *    already sit on the road, so the mask is not widened.
 * 3. Relief: road 1.4 m, smooth crest 3.2 m at z=100, north lip 1.6 m.
 *    Hard cap 3.9 m.
 * 4. Widths: road 16 m, mid pad 28 m, trail 3.3 m down the centre.
 * 5. Exits: south-lip to forest_basin, north-lip to ring_ward. Spawn (0, 100).
 * 6. Landmarks: Mid Rise (0, 100) camp.
 *
 * North is +z. No open water. No bridge.
 */

import { zoneLink } from "./zone-links";

export const SR_BOUNDS = { minX: -18, maxX: 18, minZ: 0, maxZ: 200 } as const;

export const SR_TRAIL_WIDTH = 3.3;

export const SR_SPAWN = { x: 0, z: 100, facing: 0 } as const;

const SR_ROAD_HALF = 8;
export const SR_PAD = { x: 0, z: 100, r: 14 } as const;
const SR_CREST = 3.2;
const SR_CAP = 3.9;

export type SpurRoadGate = {
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

export const SR_GATES: readonly SpurRoadGate[] = [
  {
    id: "south-lip",
    minX: -6,
    maxX: 6,
    minZ: 0,
    maxZ: 10,
    softLevel: 8,
    blocked: false,
    destZone: linkedDest("spur_road", "south-lip"),
  },
  {
    id: "north-lip",
    minX: -6,
    maxX: 6,
    minZ: 190,
    maxZ: 200,
    softLevel: 8,
    blocked: false,
    destZone: linkedDest("spur_road", "north-lip"),
  },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** Signed distance to the road mask. Negative is inside. */
export function spurRoadMaskDist(x: number, z: number): number {
  const road = Math.abs(x) - SR_ROAD_HALF;
  const pad = Math.hypot(x - SR_PAD.x, z - SR_PAD.z) - SR_PAD.r;
  return Math.min(road, pad);
}

function inBounds(x: number, z: number): boolean {
  return x >= SR_BOUNDS.minX && x <= SR_BOUNDS.maxX && z >= SR_BOUNDS.minZ && z <= SR_BOUNDS.maxZ;
}

function inRect(x: number, z: number, g: SpurRoadGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

/** Road grade: 1.4 at the south lip, 3.2 on the mid rise, 1.6 at the north lip. */
function roadY(z: number): number {
  if (z <= SR_PAD.z) return 1.4 + (SR_CREST - 1.4) * smooth(z / SR_PAD.z);
  return SR_CREST + (1.6 - SR_CREST) * smooth((z - SR_PAD.z) / (SR_BOUNDS.maxZ - SR_PAD.z));
}

export function spurRoadWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  return spurRoadMaskDist(x, z) <= 0;
}

export function spurRoadInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function spurRoadWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function spurRoadOnBridge(_x: number, _z: number): boolean {
  return false;
}

export function spurRoadStandHeight(x: number, z: number): number {
  const base = roadY(z);
  const d = spurRoadMaskDist(x, z);
  if (d <= 0) return Math.max(-0.5, Math.min(SR_CAP, base));
  const lift = smooth(Math.min(d, 10) / 10) * (SR_CAP - base);
  return Math.max(-0.5, Math.min(SR_CAP, base + Math.max(0, lift)));
}

export function spurRoadHeight(x: number, z: number): number {
  return spurRoadStandHeight(x, z);
}

export type SpurRoadBiome = "hub_indoor" | "ash_road" | "scrub" | "mountain";

export function spurRoadBiome(x: number, z: number): SpurRoadBiome {
  if (spurRoadMaskDist(x, z) > 0) return "mountain";
  if (Math.abs(x) <= 2.4) return "ash_road";
  if (Math.hypot(x - SR_PAD.x, z - SR_PAD.z) <= 11) return "hub_indoor";
  return "scrub";
}

export type SpurRoadTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function spurRoadTrails(): SpurRoadTrail[] {
  return [
    {
      id: "center-road",
      surface: "dirt",
      points: [
        { x: 0, z: 2 },
        { x: 0, z: 100 },
        { x: 0, z: 198 },
      ],
    },
  ];
}

export const SR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "center-road": "Center Road",
};

export type SpurRoadLabelKind = "area" | "camp" | "landmark" | "water";

export const SR_MAP_LABELS: readonly { text: string; x: number; z: number; kind: SpurRoadLabelKind }[] = [
  { text: "Mid Rise", x: 0, z: 100, kind: "camp" },
];

export function spurRoadGateSoftLevel(x: number, z: number): number | null {
  for (const g of SR_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
