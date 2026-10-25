import { GR_SPAWN, greenReachStandHeight, greenReachWalkable } from "../../../packages/config/src/green-reach";

/**
 * Green Reach feet and walkability for a future zone hand-off.
 * Live movement still uses Pale Hollow until a character's `zoneId` is
 * `green_reach`. The client already loads that bake when the id arrives.
 */
export function greenReachFeet(x: number, z: number): number {
  return greenReachStandHeight(x, z);
}

export function greenReachSpawnWalkable(): boolean {
  return greenReachWalkable(GR_SPAWN.x, GR_SPAWN.z);
}

export { GR_SPAWN };
