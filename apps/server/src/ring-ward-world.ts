import { RW_SPAWN, ringWardStandHeight, ringWardWalkable } from "../../../packages/config/src/ring-ward";

/**
 * Ring Ward feet and walkability for a future zone hand-off.
 * Live movement still uses the current zone until a character's `zoneId` is `ring_ward`.
 */
export function ringWardFeet(x: number, z: number): number {
  return ringWardStandHeight(x, z);
}

export function ringWardSpawnWalkable(): boolean {
  return ringWardWalkable(RW_SPAWN.x, RW_SPAWN.z);
}

export { RW_SPAWN };
