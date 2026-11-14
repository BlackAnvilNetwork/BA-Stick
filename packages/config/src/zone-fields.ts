/**
 * Playable fields that share one travel table. Pale Hollow stays on its own
 * movement code. Forest Basin is included so its southeast lip can leave.
 */

import {
  AB_BOUNDS,
  AB_GATES,
  AB_MAP_LABELS,
  AB_ROAD_NAMES,
  AB_SPAWN,
  AB_TRAIL_WIDTH,
  ashenBastionBiome,
  ashenBastionGateSoftLevel,
  ashenBastionInOpenWater,
  ashenBastionOnBridge,
  ashenBastionStandHeight,
  ashenBastionTrails,
  ashenBastionWalkable,
  ashenBastionWaterSurfaceY,
} from "./ashen-bastion";
import {
  CR_BOUNDS,
  CR_GATES,
  CR_MAP_LABELS,
  CR_ROAD_NAMES,
  CR_SPAWN,
  CR_TRAIL_WIDTH,
  coilRidgeBiome,
  coilRidgeGateSoftLevel,
  coilRidgeInOpenWater,
  coilRidgeOnBridge,
  coilRidgeStandHeight,
  coilRidgeTrails,
  coilRidgeWalkable,
  coilRidgeWaterSurfaceY,
} from "./coil-ridge";
import {
  CP_BOUNDS,
  CP_GATES,
  CP_MAP_LABELS,
  CP_ROAD_NAMES,
  CP_SPAWN,
  CP_TRAIL_WIDTH,
  coilPassBiome,
  coilPassGateSoftLevel,
  coilPassInOpenWater,
  coilPassOnBridge,
  coilPassStandHeight,
  coilPassTrails,
  coilPassWalkable,
  coilPassWaterSurfaceY,
} from "./coil-pass";
import {
  FB_GATES,
  FB_MAP_LABELS,
  FB_ROAD_NAMES,
  FB_SPAWN,
  FB_TRAIL_WIDTH,
  FOREST_BASIN_BOUNDS,
  forestBasinBiome,
  forestBasinClamp,
  forestBasinClampMove,
  forestBasinGateSoftLevel,
  forestBasinInOpenWater,
  forestBasinOnBridge,
  forestBasinStandHeight,
  forestBasinTrails,
  forestBasinWalkable,
  forestBasinWaterSurfaceY,
} from "./forest-basin";
import { nearTrailCorridor, type TrailPolyline } from "./trail-geom";
import {
  GR_BOUNDS,
  GR_GATES,
  GR_MAP_LABELS,
  GR_ROAD_NAMES,
  GR_SPAWN,
  GR_TRAIL_WIDTH,
  greenReachBiome,
  greenReachGateSoftLevel,
  greenReachInOpenWater,
  greenReachOnBridge,
  greenReachStandHeight,
  greenReachTrails,
  greenReachWalkable,
  greenReachWaterSurfaceY,
} from "./green-reach";
import {
  IF_BOUNDS,
  IF_GATES,
  IF_MAP_LABELS,
  IF_ROAD_NAMES,
  IF_SPAWN,
  IF_TRAIL_WIDTH,
  isletFordsBiome,
  isletFordsGateSoftLevel,
  isletFordsInOpenWater,
  isletFordsOnBridge,
  isletFordsStandHeight,
  isletFordsTrails,
  isletFordsWalkable,
  isletFordsWaterSurfaceY,
} from "./islet-fords";
import {
  RW_BOUNDS,
  RW_GATES,
  RW_MAP_LABELS,
  RW_ROAD_NAMES,
  RW_SPAWN,
  RW_TRAIL_WIDTH,
  ringWardBiome,
  ringWardGateSoftLevel,
  ringWardInOpenWater,
  ringWardOnBridge,
  ringWardStandHeight,
  ringWardTrails,
  ringWardWalkable,
  ringWardWaterSurfaceY,
} from "./ring-ward";
import {
  SR_BOUNDS,
  SR_GATES,
  SR_MAP_LABELS,
  SR_ROAD_NAMES,
  SR_SPAWN,
  SR_TRAIL_WIDTH,
  spurRoadBiome,
  spurRoadGateSoftLevel,
  spurRoadInOpenWater,
  spurRoadOnBridge,
  spurRoadStandHeight,
  spurRoadTrails,
  spurRoadWalkable,
  spurRoadWaterSurfaceY,
} from "./spur-road";
import {
  HR_BOUNDS,
  HR_GATES,
  HR_MAP_LABELS,
  HR_ROAD_NAMES,
  HR_SPAWN,
  HR_TRAIL_WIDTH,
  hollowRoadBiome,
  hollowRoadClamp,
  hollowRoadClampMove,
  hollowRoadGateSoftLevel,
  hollowRoadInOpenWater,
  hollowRoadOnBridge,
  hollowRoadStandHeight,
  hollowRoadTrails,
  hollowRoadWalkable,
  hollowRoadWaterSurfaceY,
} from "./hollow-road";
import {
  PALE_HOLLOW_BOUNDS,
  PH_ASH_ROAD,
  PH_QUARRY_CUT,
  PH_SEAM_TUNNEL,
  PH_TIMBER_BRIDGE,
  PH_TRAIL_STONE_WIDTH,
  PH_TRAIL_WIDTH,
  clampPaleHollow,
  paleHollowOnBridge,
  paleHollowMoveMul,
  paleHollowTrails,
  paleHollowWalkable,
} from "./pale-hollow";
import { slideMove } from "./slide-move";
import { zoneLink } from "./zone-links";

export type ZoneGate = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  blocked: boolean;
  destZone: string | null;
};

export type ZoneField = {
  id: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  trailWidth: number;
  spawn: { x: number; z: number; facing: number };
  walkable: (x: number, z: number) => boolean;
  stand: (x: number, z: number) => number;
  water: (x: number, z: number) => number | null;
  openWater: (x: number, z: number) => boolean;
  onBridge: (x: number, z: number) => boolean;
  biome: (x: number, z: number) => string;
  trails: () => { id: string; surface: string; points: { x: number; z: number }[] }[];
  roadNames: Readonly<Record<string, string>>;
  labels: readonly { text: string; x: number; z: number; kind: string }[];
  gates: readonly ZoneGate[];
  gateSoftLevel: (x: number, z: number) => number | null;
  clamp: (x: number, z: number) => { x: number; z: number };
  clampMove: (fromX: number, fromZ: number, toX: number, toZ: number) => { x: number; z: number };
};

function boxClamp(bounds: ZoneField["bounds"], x: number, z: number) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, z)),
  };
}

function field(
  spec: Omit<ZoneField, "clamp" | "clampMove"> & { clampMove?: ZoneField["clampMove"]; clamp?: ZoneField["clamp"] },
): ZoneField {
  const clamp = spec.clamp ?? ((x: number, z: number) => boxClamp(spec.bounds, x, z));
  const clampMove =
    spec.clampMove ??
    ((fromX, fromZ, toX, toZ) => slideMove(clamp, spec.walkable, fromX, fromZ, toX, toZ, spec.openWater));
  return { ...spec, clamp, clampMove };
}

export const ZONE_FIELDS: Readonly<Record<string, ZoneField>> = {
  hollow_road: field({
    id: "hollow_road",
    bounds: HR_BOUNDS,
    trailWidth: HR_TRAIL_WIDTH,
    spawn: HR_SPAWN,
    walkable: hollowRoadWalkable,
    stand: hollowRoadStandHeight,
    water: hollowRoadWaterSurfaceY,
    openWater: hollowRoadInOpenWater,
    onBridge: hollowRoadOnBridge,
    biome: hollowRoadBiome,
    trails: hollowRoadTrails,
    roadNames: HR_ROAD_NAMES,
    labels: HR_MAP_LABELS,
    gates: HR_GATES,
    gateSoftLevel: hollowRoadGateSoftLevel,
    clamp: hollowRoadClamp,
    clampMove: hollowRoadClampMove,
  }),
  forest_basin: field({
    id: "forest_basin",
    bounds: FOREST_BASIN_BOUNDS,
    trailWidth: FB_TRAIL_WIDTH,
    spawn: FB_SPAWN,
    walkable: forestBasinWalkable,
    stand: forestBasinStandHeight,
    water: forestBasinWaterSurfaceY,
    openWater: forestBasinInOpenWater,
    onBridge: forestBasinOnBridge,
    biome: forestBasinBiome,
    trails: forestBasinTrails,
    roadNames: FB_ROAD_NAMES,
    labels: FB_MAP_LABELS,
    gates: FB_GATES,
    gateSoftLevel: forestBasinGateSoftLevel,
    clamp: forestBasinClamp,
    clampMove: forestBasinClampMove,
  }),
  spur_road: field({
    id: "spur_road",
    bounds: SR_BOUNDS,
    trailWidth: SR_TRAIL_WIDTH,
    spawn: SR_SPAWN,
    walkable: spurRoadWalkable,
    stand: spurRoadStandHeight,
    water: spurRoadWaterSurfaceY,
    openWater: spurRoadInOpenWater,
    onBridge: spurRoadOnBridge,
    biome: spurRoadBiome,
    trails: spurRoadTrails,
    roadNames: SR_ROAD_NAMES,
    labels: SR_MAP_LABELS,
    gates: SR_GATES,
    gateSoftLevel: spurRoadGateSoftLevel,
  }),
  ring_ward: field({
    id: "ring_ward",
    bounds: RW_BOUNDS,
    trailWidth: RW_TRAIL_WIDTH,
    spawn: RW_SPAWN,
    walkable: ringWardWalkable,
    stand: ringWardStandHeight,
    water: ringWardWaterSurfaceY,
    openWater: ringWardInOpenWater,
    onBridge: ringWardOnBridge,
    biome: ringWardBiome,
    trails: ringWardTrails,
    roadNames: RW_ROAD_NAMES,
    labels: RW_MAP_LABELS,
    gates: RW_GATES,
    gateSoftLevel: ringWardGateSoftLevel,
  }),
  islet_fords: field({
    id: "islet_fords",
    bounds: IF_BOUNDS,
    trailWidth: IF_TRAIL_WIDTH,
    spawn: IF_SPAWN,
    walkable: isletFordsWalkable,
    stand: isletFordsStandHeight,
    water: isletFordsWaterSurfaceY,
    openWater: isletFordsInOpenWater,
    onBridge: isletFordsOnBridge,
    biome: isletFordsBiome,
    trails: isletFordsTrails,
    roadNames: IF_ROAD_NAMES,
    labels: IF_MAP_LABELS,
    gates: IF_GATES,
    gateSoftLevel: isletFordsGateSoftLevel,
  }),
  green_reach: field({
    id: "green_reach",
    bounds: GR_BOUNDS,
    trailWidth: GR_TRAIL_WIDTH,
    spawn: GR_SPAWN,
    walkable: greenReachWalkable,
    stand: greenReachStandHeight,
    water: greenReachWaterSurfaceY,
    openWater: greenReachInOpenWater,
    onBridge: greenReachOnBridge,
    biome: greenReachBiome,
    trails: greenReachTrails,
    roadNames: GR_ROAD_NAMES,
    labels: GR_MAP_LABELS,
    gates: GR_GATES,
    gateSoftLevel: greenReachGateSoftLevel,
  }),
  coil_pass: field({
    id: "coil_pass",
    bounds: CP_BOUNDS,
    trailWidth: CP_TRAIL_WIDTH,
    spawn: CP_SPAWN,
    walkable: coilPassWalkable,
    stand: coilPassStandHeight,
    water: coilPassWaterSurfaceY,
    openWater: coilPassInOpenWater,
    onBridge: coilPassOnBridge,
    biome: coilPassBiome,
    trails: coilPassTrails,
    roadNames: CP_ROAD_NAMES,
    labels: CP_MAP_LABELS,
    gates: CP_GATES,
    gateSoftLevel: coilPassGateSoftLevel,
  }),
  coil_ridge: field({
    id: "coil_ridge",
    bounds: CR_BOUNDS,
    trailWidth: CR_TRAIL_WIDTH,
    spawn: CR_SPAWN,
    walkable: coilRidgeWalkable,
    stand: coilRidgeStandHeight,
    water: coilRidgeWaterSurfaceY,
    openWater: coilRidgeInOpenWater,
    onBridge: coilRidgeOnBridge,
    biome: coilRidgeBiome,
    trails: coilRidgeTrails,
    roadNames: CR_ROAD_NAMES,
    labels: CR_MAP_LABELS,
    gates: CR_GATES,
    gateSoftLevel: coilRidgeGateSoftLevel,
  }),
  ashen_bastion: field({
    id: "ashen_bastion",
    bounds: AB_BOUNDS,
    trailWidth: AB_TRAIL_WIDTH,
    spawn: AB_SPAWN,
    walkable: ashenBastionWalkable,
    stand: ashenBastionStandHeight,
    water: ashenBastionWaterSurfaceY,
    openWater: ashenBastionInOpenWater,
    onBridge: ashenBastionOnBridge,
    biome: ashenBastionBiome,
    trails: ashenBastionTrails,
    roadNames: AB_ROAD_NAMES,
    labels: AB_MAP_LABELS,
    gates: AB_GATES,
    gateSoftLevel: ashenBastionGateSoftLevel,
  }),
};

export function fieldById(id: string | null | undefined): ZoneField | undefined {
  if (!id) return undefined;
  return ZONE_FIELDS[id];
}

export function fieldStandHeight(zoneId: string | undefined, x: number, z: number): number | null {
  const field = fieldById(zoneId);
  return field ? field.stand(x, z) : null;
}

export function fieldClampMove(
  zoneId: string | undefined,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } | null {
  const field = fieldById(zoneId);
  return field ? field.clampMove(fromX, fromZ, toX, toZ) : null;
}

type FieldNav = {
  bounds: ZoneField["bounds"];
  walkable: ZoneField["walkable"];
  clamp: ZoneField["clamp"];
  /** Straight walk with no sliding: every sample on the segment is walkable. */
  clampMove: ZoneField["clampMove"];
};

function buildFieldNav(spec: {
  bounds: ZoneField["bounds"];
  walkable: ZoneField["walkable"];
  clamp: ZoneField["clamp"];
  onBridge: (x: number, z: number) => boolean;
  trails: TrailPolyline[] | ReturnType<ZoneField["trails"]>;
  trailWidth: number;
  widthForTrail?: (t: TrailPolyline) => number;
}): FieldNav {
  const onCorridor = (x: number, z: number) =>
    spec.onBridge(x, z) || nearTrailCorridor(x, z, spec.trails, spec.trailWidth, spec.widthForTrail);
  // Paths must keep a little clearance: a line that grazes a wall corner passes this check by a hair,
  // but a player stepping along it lands a hair the other way and stops against the wall.
  // Roads and decks are the exception — side samples fall in water and used to shove the route off the path.
  const CLEAR = 0.35;
  const straight = (fx: number, fz: number, tx: number, tz: number) => {
    const dist = Math.hypot(tx - fx, tz - fz);
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    const px = dist > 0 ? (-(tz - fz) / dist) * CLEAR : 0;
    const pz = dist > 0 ? ((tx - fx) / dist) * CLEAR : 0;
    const startOpen = spec.walkable(fx + px, fz + pz) && spec.walkable(fx - px, fz - pz);
    let last = { x: fx, z: fz };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const c = { x: fx + (tx - fx) * t, z: fz + (tz - fz) * t };
      if (!spec.walkable(c.x, c.z)) return last;
      // Skip side clearance only when the start is already tight and this sample is
      // still in the first/last metre. `&&` binds before `||`, so the old order
      // treated every last metre as open and pinned click paths at doors and fords.
      const nearEnd = !startOpen && (t * dist < 1 || (1 - t) * dist < 1);
      if (!nearEnd && !onCorridor(c.x, c.z) && (!spec.walkable(c.x + px, c.z + pz) || !spec.walkable(c.x - px, c.z - pz))) return last;
      last = c;
    }
    return last;
  };
  // Route cells keep the same clearance, so grid corners never cut a wall the walk would stop on.
  const roomy = (x: number, z: number) =>
    spec.walkable(x, z) &&
    (onCorridor(x, z) ||
      (spec.walkable(x + 0.5, z) &&
        spec.walkable(x - 0.5, z) &&
        spec.walkable(x, z + 0.5) &&
        spec.walkable(x, z - 0.5)));
  return { bounds: spec.bounds, walkable: roomy, clamp: spec.clamp, clampMove: straight };
}

export function fieldNav(zoneId: string | undefined): FieldNav | undefined {
  if (zoneId === "pale_hollow") {
    return buildFieldNav({
      bounds: PALE_HOLLOW_BOUNDS,
      walkable: paleHollowWalkable,
      clamp: clampPaleHollow,
      onBridge: paleHollowOnBridge,
      trails: paleHollowTrails(),
      trailWidth: PH_TRAIL_WIDTH,
      widthForTrail: (t) => (t.surface === "stone" ? PH_TRAIL_STONE_WIDTH : PH_TRAIL_WIDTH),
    });
  }
  const field = fieldById(zoneId);
  if (!field) return undefined;
  return buildFieldNav({
    bounds: field.bounds,
    walkable: field.walkable,
    clamp: field.clamp,
    onBridge: field.onBridge,
    trails: field.trails(),
    trailWidth: field.trailWidth,
    widthForTrail: (t) => (t.surface === "stone" ? PH_TRAIL_STONE_WIDTH : field.trailWidth),
  });
}

export function fieldGateSoftLevel(zoneId: string | undefined, x: number, z: number): number | null | undefined {
  if (!zoneId || zoneId === "pale_hollow") {
    const gate = fieldGateAt("pale_hollow", x, z);
    if (!gate) return null;
    if (gate.id === PH_ASH_ROAD.id) return PH_ASH_ROAD.softLevel;
    if (gate.id === "timber-bridge") return PH_TIMBER_BRIDGE.softLevel;
    if (gate.id === "quarry-cut") return PH_QUARRY_CUT.softLevel;
    if (gate.id === "seam-tunnel") return PH_SEAM_TUNNEL.softLevel;
    return null;
  }
  const field = fieldById(zoneId);
  if (!field) return undefined;
  return field.gateSoftLevel(x, z);
}

const PH_SOFT_GATES: readonly ZoneGate[] = [
  { id: PH_ASH_ROAD.id, minX: PH_ASH_ROAD.minX, maxX: PH_ASH_ROAD.maxX, minZ: PH_ASH_ROAD.minZ, maxZ: PH_ASH_ROAD.maxZ, blocked: PH_ASH_ROAD.blocked, destZone: zoneLink("pale_hollow", PH_ASH_ROAD.id)?.to ?? "hollow_road" },
  { id: "timber-bridge", minX: PH_TIMBER_BRIDGE.minX, maxX: PH_TIMBER_BRIDGE.maxX, minZ: PH_TIMBER_BRIDGE.minZ, maxZ: PH_TIMBER_BRIDGE.maxZ, blocked: PH_TIMBER_BRIDGE.blocked, destZone: null },
  { id: "quarry-cut", minX: PH_QUARRY_CUT.minX, maxX: PH_QUARRY_CUT.maxX, minZ: PH_QUARRY_CUT.minZ, maxZ: PH_QUARRY_CUT.maxZ, blocked: PH_QUARRY_CUT.blocked, destZone: null },
  { id: "seam-tunnel", minX: PH_SEAM_TUNNEL.minX, maxX: PH_SEAM_TUNNEL.maxX, minZ: PH_SEAM_TUNNEL.minZ, maxZ: PH_SEAM_TUNNEL.maxZ, blocked: PH_SEAM_TUNNEL.blocked, destZone: null },
];

/** Gate rect containing (x, z), including blocked / dest-less lips. */
export function fieldGateAt(zoneId: string | undefined, x: number, z: number): ZoneGate | null {
  if (!zoneId || zoneId === "pale_hollow") {
    for (const gate of PH_SOFT_GATES) {
      if (x >= gate.minX && x <= gate.maxX && z >= gate.minZ && z <= gate.maxZ) return gate;
    }
    return null;
  }
  const field = fieldById(zoneId);
  if (!field) return null;
  for (const gate of field.gates) {
    if (x >= gate.minX && x <= gate.maxX && z >= gate.minZ && z <= gate.maxZ) return gate;
  }
  return null;
}

/** Walk / dash speed scale. Pale Hollow keeps its river muls; other fields slow on water. */
export function zoneMoveMul(zoneId: string | undefined, x: number, z: number): number {
  if (!zoneId || zoneId === "pale_hollow") return paleHollowMoveMul(x, z);
  const field = fieldById(zoneId);
  if (!field || field.onBridge(x, z)) return 1;
  if (nearTrailCorridor(x, z, field.trails(), field.trailWidth)) return 1;
  if (field.water(x, z) != null) return 0.55;
  return 1;
}

export type TravelStep = { zoneId: string; x: number; z: number; facing: number };

function arrivalWalkable(zoneId: string, x: number, z: number): boolean {
  if (zoneId === "pale_hollow") return paleHollowWalkable(x, z);
  const dest = fieldById(zoneId);
  return !!dest && dest.walkable(x, z);
}

/** Gate rect to the next zone. The arrival stands outside the return gate. */
export function travelAt(zoneId: string | undefined, x: number, z: number): TravelStep | null {
  if (!zoneId || zoneId === "pale_hollow") {
    const gate = PH_ASH_ROAD;
    if (gate.blocked || x < gate.minX || x > gate.maxX || z < gate.minZ || z > gate.maxZ) return null;
    const link = zoneLink("pale_hollow", gate.id);
    if (!link || !arrivalWalkable(link.to, link.spawn.x, link.spawn.z)) return null;
    return { zoneId: link.to, x: link.spawn.x, z: link.spawn.z, facing: link.spawn.facing };
  }
  const field = fieldById(zoneId);
  if (!field) return null;
  for (const gate of field.gates) {
    if (gate.blocked || !gate.destZone) continue;
    if (x < gate.minX || x > gate.maxX || z < gate.minZ || z > gate.maxZ) continue;
    const link = zoneLink(field.id, gate.id);
    if (!link || !arrivalWalkable(link.to, link.spawn.x, link.spawn.z)) return null;
    return { zoneId: link.to, x: link.spawn.x, z: link.spawn.z, facing: link.spawn.facing };
  }
  return null;
}

export function applyTravel(body: { zoneId: string; x: number; z: number; facing: number }): boolean {
  const next = travelAt(body.zoneId, body.x, body.z);
  if (!next) return false;
  body.zoneId = next.zoneId;
  body.x = next.x;
  body.z = next.z;
  body.facing = next.facing;
  return true;
}
