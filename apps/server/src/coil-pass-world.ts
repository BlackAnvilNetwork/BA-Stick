import { CP_SPAWN, coilPassStandHeight, coilPassWalkable } from "../../../packages/config/src/coil-pass";

/**
 * Coil Pass feet and walkability for a future zone hand-off.
 * Feet use the same stand height the client bakes.
 */
export function coilPassFeet(x: number, z: number): number {
  return coilPassStandHeight(x, z);
}

export function coilPassSpawnWalkable(): boolean {
  return coilPassWalkable(CP_SPAWN.x, CP_SPAWN.z);
}

export { CP_SPAWN };
