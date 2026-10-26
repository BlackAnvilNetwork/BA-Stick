import { IF_SPAWN, isletFordsStandHeight, isletFordsWalkable } from "../../../packages/config/src/islet-fords";

/**
 * Islet Fords feet and walkability for a future zone hand-off.
 * Live movement still uses Pale Hollow until a character's `zoneId` is
 * `islet_fords`. The client already loads that bake when the id arrives.
 */
export function isletFordsFeet(x: number, z: number): number {
  return isletFordsStandHeight(x, z);
}

export function isletFordsSpawnWalkable(): boolean {
  return isletFordsWalkable(IF_SPAWN.x, IF_SPAWN.z);
}

export { IF_SPAWN };
