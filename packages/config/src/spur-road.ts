import { naturalMaskDist } from "./natural-shore";
/**
 * Spur Road — the scrub track that climbs from the basin to the ring wards.
 *
 * Area sheet
 * 1. Bounds: x -18..18, z 0..200. 7_200 m², 32 screens.
 *    Grid 73×401 at 0.5 m. Bake 24 + 4×73×401 = 117_116 B.
 * 2. Walkable: |x| <= 8, plus a disc r=14 at (0, 100).
 *    Outside the mask is blocked highland (mountain). Both gate centers
 *    already sit on the road, so the mask is not widened.
 * 3. Relief: one smooth hump — 1.4 m at the south lip, 3.2 m crest at z=100,
 *    1.6 m at the north lip. The mid pad is a level camp shelf on that crest.
 *    Banks rise off the 16 m road (about 4 m / 0.5 m strokes). Hard cap 3.9 m.
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
const SR_SOUTH = 1.4;
const SR_NORTH = 1.6;
const SR_CREST = 3.2;
const SR_CAP = 3.9;
/** Camp shelf on the mid pad. Camp props all sit inside this radius. */
const SR_SHELF_R = 8;
/** Map-builder stroke: 4 m across, 0.5 m of height. Finer than this will not read in iso. */
const SR_STROKE = 4;
const SR_STROKE_H = 0.5;

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
  return naturalMaskDist(spurRoadMaskDistRaw, x, z, 902, 8);
}

/** Geometric mask before the natural edge. */
export function spurRoadMaskDistRaw(x: number, z: number): number {
  // grow-only, side-specific bays so the valley floor reads as worn ground, not a ruled strip
  const side = x >= 0 ? 1 : -1;
  const ph = 1.3 + (side > 0 ? 0 : 2.1);
  const bay = 1 + 0.12 * (1 + Math.sin(z / 23 + ph)) + 0.07 * (1 + Math.sin(z / 9.7 + 1.9 * ph)) + 0.04 * (1 + Math.sin(z / 4.1 - ph));
  const road = Math.abs(x) - SR_ROAD_HALF * bay;
  const a = Math.atan2(z - SR_PAD.z, x - SR_PAD.x);
  const pad = Math.hypot(x - SR_PAD.x, z - SR_PAD.z) - SR_PAD.r * (1 + 0.12 * (1 + Math.sin(3 * a + ph)) + 0.06 * (1 + Math.sin(5 * a - ph)));
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
  if (z <= SR_PAD.z) return SR_SOUTH + (SR_CREST - SR_SOUTH) * smooth(z / SR_PAD.z);
  return SR_CREST + (SR_NORTH - SR_CREST) * smooth((z - SR_PAD.z) / (SR_BOUNDS.maxZ - SR_PAD.z));
}

/**
 * Bank above the road. The first brush spends up to two strokes (1 m) so a
 * rise finishes inside 4 m — the crest only has 0.7 m of room under the cap,
 * and a change under about 0.5 m does not show. Later strokes are 0.5 m / 4 m.
 */
function bankRise(dist: number, room: number): number {
  if (dist <= 0 || room <= 0) return 0;
  const first = Math.min(room, SR_STROKE_H * 2);
  const head = smooth(Math.min(dist, SR_STROKE) / SR_STROKE) * first;
  if (dist <= SR_STROKE || room <= first) return head;
  const more = Math.min(room - first, ((dist - SR_STROKE) / SR_STROKE) * SR_STROKE_H);
  return head + more;
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
  const grade = roadY(z);
  const padDist = Math.hypot(x - SR_PAD.x, z - SR_PAD.z);
  // Level camp shelf on the crest. Far from the pad (the south lip included)
  // this weight is 0, so the grade that meets Forest Basin stays put.
  const shelfT = 1 - smooth(Math.max(0, padDist - SR_SHELF_R) / SR_STROKE);
  const floor = grade + (SR_CREST - grade) * shelfT;
  // Banks start outside the 16 m road. The shelf and both gate rects sit inside it.
  const offRoad = Math.max(0, Math.abs(x) - SR_ROAD_HALF);
  const y = floor + bankRise(offRoad, SR_CAP - floor);
  return Math.max(-0.5, Math.min(SR_CAP, y));
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
