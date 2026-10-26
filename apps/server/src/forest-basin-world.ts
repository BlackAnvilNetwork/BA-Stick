import { FB_SPAWN, forestBasinStandHeight, forestBasinWalkable } from "@bellgrave/config";

/**
 * Forest Basin feet and walkability. Live movement follows `zoneId`:
 * `forest_basin` uses this mask, and every other id stays on Pale Hollow.
 */
export function forestBasinFeet(x: number, z: number): number {
  return forestBasinStandHeight(x, z);
}

export function forestBasinSpawnWalkable(): boolean {
  return forestBasinWalkable(FB_SPAWN.x, FB_SPAWN.z);
}

export { FB_SPAWN };
