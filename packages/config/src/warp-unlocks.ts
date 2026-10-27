import { PH_HUB, PH_HUB_SPAWN, PH_OUTDOOR_SPAWN } from "./pale-hollow";

/** New characters. East of the lake, facing east. The Scout Gate spawn stays put. */
export const PH_START_SPAWN = { x: -53, z: 297, facing: Math.PI / 2 } as const;

/** Rings a character may open by walking into them. */
export const PH_WARP_CIRCLES = [
  { id: "warp-mayflower", name: "Mayflower Ring", x: 174, z: 191.5, r: 2.6 },
] as const;

export type WarpCircle = (typeof PH_WARP_CIRCLES)[number];
export type WarpCircleId = WarpCircle["id"];

/**
 * The Mayflower Ring sits inside the Scout Gate room on purpose.
 * `PH_HUB` is that room's interact rectangle, not a warp exclusion.
 * Any other ring that touches the room fails the overlap check.
 */
export const PH_WARP_HUB_EXCEPTIONS = ["warp-mayflower"] as const;

export function warpCircleHitsHub(circle: { x: number; z: number; r: number }): boolean {
  const x = Math.max(PH_HUB.minX, Math.min(circle.x, PH_HUB.maxX));
  const z = Math.max(PH_HUB.minZ, Math.min(circle.z, PH_HUB.maxZ));
  return Math.hypot(circle.x - x, circle.z - z) <= circle.r;
}
/** `hub` is the Scout Gate, for characters saved before Emberwatch. */
export type RespawnHome = "emberwatch" | "mayflower" | "hub";

export type RespawnStand = { x: number; z: number; facing: number; home: RespawnHome };

export function warpCircleById(id: string): WarpCircle | undefined {
  return PH_WARP_CIRCLES.find((circle) => circle.id === id);
}

export function warpCircleAt(x: number, z: number): WarpCircle | undefined {
  return PH_WARP_CIRCLES.find((circle) => Math.hypot(circle.x - x, circle.z - z) <= circle.r);
}

export function unlockWarp(unlocked: readonly string[], id: string): string[] {
  if (!warpCircleById(id) || unlocked.includes(id)) return [...unlocked];
  return [...unlocked, id];
}

/** Mayflower only after that ring is open. Anything else falls back. */
export function respawnStand(home: RespawnHome, unlocked: readonly string[]): RespawnStand {
  if (home === "mayflower" && unlocked.includes("warp-mayflower")) {
    const ring = warpCircleById("warp-mayflower")!;
    return { x: ring.x, z: ring.z, facing: PH_OUTDOOR_SPAWN.facing, home: "mayflower" };
  }
  if (home === "emberwatch") {
    return { x: PH_START_SPAWN.x, z: PH_START_SPAWN.z, facing: PH_START_SPAWN.facing, home: "emberwatch" };
  }
  return { x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z, facing: PH_HUB_SPAWN.facing, home: "hub" };
}

export function reachWarp(
  unlocked: readonly string[],
  x: number,
  z: number,
): { unlocked: string[]; added: string | null } {
  const hit = warpCircleAt(x, z);
  if (!hit || unlocked.includes(hit.id)) return { unlocked: [...unlocked], added: null };
  return { unlocked: unlockWarp(unlocked, hit.id), added: hit.id };
}
