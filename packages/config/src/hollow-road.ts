/**
 * Hollow Road — the scrub track from Pale Hollow's north lip to Forest Basin.
 *
 * Area sheet
 * 1. Bounds: x -18..18, z 0..160. 5_760 m², about 26 screens.
 *    Grid 73×321 at 0.5 m. Bake 24 + 4×73×321 = 93_756 B.
 * 2. Walkable: |x| <= 8, plus a disc r=12 at (0, 80).
 *    Outside the mask is blocked highland (mountain). About 48%.
 * 3. Relief: south lip 0.9 m, mid rise 2.2 m, north lip 1.3 m. Hard cap 3.2 m.
 * 4. Widths: road 16 m, mid pad 24 m, trail 3.3 m down the centre.
 * 5. Exits: south-lip to pale_hollow, north-lip to forest_basin. Spawn (0, 80).
 * 6. Landmarks: Mid Camp (0, 80) camp.
 *
 * North is +z. No open water. No bridge.
 */

import { zoneLink } from "./zone-links";

export const HR_BOUNDS = { minX: -18, maxX: 18, minZ: 0, maxZ: 160 } as const;

export const HR_TRAIL_WIDTH = 3.3;

export const HR_SPAWN = { x: 0, z: 80, facing: 0 } as const;

const HR_ROAD_HALF = 8;
const HR_PAD = { x: 0, z: 80, r: 12 } as const;
const HR_CREST = 2.2;
const HR_CAP = 3.2;

export type HollowRoadGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  softLevel: number;
  blocked: boolean;
  destZone: string;
};

function linkedDest(gate: string): string {
  const link = zoneLink("hollow_road", gate);
  if (!link) throw new Error(`missing zone link hollow_road ${gate}`);
  return link.to;
}

export const HR_GATES: readonly HollowRoadGate[] = [
  {
    id: "south-lip",
    minX: -6,
    maxX: 6,
    minZ: 0,
    maxZ: 10,
    softLevel: 8,
    blocked: false,
    destZone: linkedDest("south-lip"),
  },
  {
    id: "north-lip",
    minX: -6,
    maxX: 6,
    minZ: 150,
    maxZ: 160,
    softLevel: 8,
    blocked: false,
    destZone: linkedDest("north-lip"),
  },
];

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** Signed distance to the road mask. Negative is inside. */
export function hollowRoadMaskDist(x: number, z: number): number {
  const road = Math.abs(x) - HR_ROAD_HALF;
  const pad = Math.hypot(x - HR_PAD.x, z - HR_PAD.z) - HR_PAD.r;
  return Math.min(road, pad);
}

function inBounds(x: number, z: number): boolean {
  return x >= HR_BOUNDS.minX && x <= HR_BOUNDS.maxX && z >= HR_BOUNDS.minZ && z <= HR_BOUNDS.maxZ;
}

function inRect(x: number, z: number, g: HollowRoadGate): boolean {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ;
}

/** Road grade: 0.9 at the hollow, 2.2 on the mid rise, 1.3 at the basin. */
function roadY(z: number): number {
  if (z <= HR_PAD.z) return 0.9 + (HR_CREST - 0.9) * smooth(z / HR_PAD.z);
  return HR_CREST + (1.3 - HR_CREST) * smooth((z - HR_PAD.z) / (HR_BOUNDS.maxZ - HR_PAD.z));
}

export function hollowRoadWalkable(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  return hollowRoadMaskDist(x, z) <= 0;
}

export function hollowRoadInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function hollowRoadWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function hollowRoadOnBridge(_x: number, _z: number): boolean {
  return false;
}

export function hollowRoadStandHeight(x: number, z: number): number {
  const base = roadY(Math.max(HR_BOUNDS.minZ, Math.min(HR_BOUNDS.maxZ, z)));
  const d = hollowRoadMaskDist(x, z);
  if (d <= 0) return Math.max(-0.5, Math.min(HR_CAP, base));
  const lift = smooth(Math.min(d, 10) / 10) * (HR_CAP - base);
  return Math.max(-0.5, Math.min(HR_CAP, base + Math.max(0, lift)));
}

export function hollowRoadHeight(x: number, z: number): number {
  return hollowRoadStandHeight(x, z);
}

export function hollowRoadClamp(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(HR_BOUNDS.minX, Math.min(HR_BOUNDS.maxX, x)),
    z: Math.max(HR_BOUNDS.minZ, Math.min(HR_BOUNDS.maxZ, z)),
  };
}

export function hollowRoadClampMove(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const end = hollowRoadClamp(toX, toZ);
  if (!hollowRoadWalkable(fromX, fromZ) && hollowRoadWalkable(end.x, end.z)) return end;
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / 0.3));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = hollowRoadClamp(fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!hollowRoadWalkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

export type HollowRoadBiome = "hub_indoor" | "ash_road" | "scrub" | "mountain";

export function hollowRoadBiome(x: number, z: number): HollowRoadBiome {
  if (hollowRoadMaskDist(x, z) > 0) return "mountain";
  if (Math.abs(x) <= 2.4) return "ash_road";
  if (Math.hypot(x - HR_PAD.x, z - HR_PAD.z) <= 9) return "hub_indoor";
  return "scrub";
}

export type HollowRoadTrail = {
  id: string;
  surface: "dirt" | "stone";
  points: { x: number; z: number }[];
};

export function hollowRoadTrails(): HollowRoadTrail[] {
  return [
    {
      id: "center-road",
      surface: "dirt",
      points: [
        { x: 0, z: 2 },
        { x: 0, z: 80 },
        { x: 0, z: 158 },
      ],
    },
  ];
}

export const HR_ROAD_NAMES: Readonly<Record<string, string>> = {
  "center-road": "Hollow Road",
};

export type HollowRoadLabelKind = "area" | "camp" | "landmark" | "water";

export const HR_MAP_LABELS: readonly { text: string; x: number; z: number; kind: HollowRoadLabelKind }[] = [
  { text: "Mid Camp", x: 0, z: 80, kind: "camp" },
  { text: "Pale Hollow", x: 0, z: 8, kind: "landmark" },
  { text: "Forest Basin", x: 0, z: 152, kind: "landmark" },
];

export function hollowRoadGateSoftLevel(x: number, z: number): number | null {
  for (const g of HR_GATES) {
    if (inRect(x, z, g)) return g.softLevel;
  }
  return null;
}
