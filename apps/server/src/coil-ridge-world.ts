import { CR_SPAWN, coilRidgeStandHeight, coilRidgeWalkable } from "../../../packages/config/src/coil-ridge";

/**
 * Coil Ridge feet and walkability for a future zone hand-off.
 * Feet use the same stand height the client bakes.
 */
export function coilRidgeFeet(x: number, z: number): number {
  return coilRidgeStandHeight(x, z);
}

export function coilRidgeSpawnWalkable(): boolean {
  return coilRidgeWalkable(CR_SPAWN.x, CR_SPAWN.z);
}

export { CR_SPAWN };
