import { SR_SPAWN, spurRoadStandHeight, spurRoadWalkable } from "../../../packages/config/src/spur-road";

/**
 * Spur Road feet and walkability for a future zone hand-off.
 * Live movement still uses the current zone until a character's `zoneId` is `spur_road`.
 */
export function spurRoadFeet(x: number, z: number): number {
  return spurRoadStandHeight(x, z);
}

export function spurRoadSpawnWalkable(): boolean {
  return spurRoadWalkable(SR_SPAWN.x, SR_SPAWN.z);
}

export { SR_SPAWN };
