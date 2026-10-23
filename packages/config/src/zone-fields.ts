/**
 * Playable fields that share one travel table. Pale Hollow stays on its own
 * movement code. Forest Basin is included so its southeast lip can leave.
 */

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
import { PH_ASH_ROAD, paleHollowWalkable } from "./pale-hollow";
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

function slide(
  bounds: ZoneField["bounds"],
  walkable: (x: number, z: number) => boolean,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
) {
  const end = boxClamp(bounds, toX, toZ);
  if (!walkable(fromX, fromZ) && walkable(end.x, end.z)) return end;
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / 0.3));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = boxClamp(bounds, fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!walkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

function field(
  spec: Omit<ZoneField, "clamp" | "clampMove"> & { clampMove?: ZoneField["clampMove"]; clamp?: ZoneField["clamp"] },
): ZoneField {
  const clamp = spec.clamp ?? ((x: number, z: number) => boxClamp(spec.bounds, x, z));
  const clampMove = spec.clampMove ?? ((fromX, fromZ, toX, toZ) => slide(spec.bounds, spec.walkable, fromX, fromZ, toX, toZ));
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

export function fieldNav(zoneId: string | undefined): {
  bounds: ZoneField["bounds"];
  walkable: ZoneField["walkable"];
  clamp: ZoneField["clamp"];
} | undefined {
  const field = fieldById(zoneId);
  if (!field) return undefined;
  return { bounds: field.bounds, walkable: field.walkable, clamp: field.clamp };
}

export function fieldGateSoftLevel(zoneId: string | undefined, x: number, z: number): number | null | undefined {
  const field = fieldById(zoneId);
  if (!field) return undefined;
  return field.gateSoftLevel(x, z);
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
