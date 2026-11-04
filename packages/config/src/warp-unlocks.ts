import { FB_WARP_SITES } from "./forest-basin-features";
import { PH_HUB, PH_HUB_SPAWN, PH_OUTDOOR_SPAWN } from "./pale-hollow";

/** New characters. East of the lake, facing east. The Scout Gate spawn stays put. */
export const PH_START_SPAWN = { x: -53, z: 297, facing: Math.PI / 2 } as const;

/** Rings a character may open by walking into them. */
export const PH_WARP_CIRCLES = [
  { id: "warp-mayflower", name: "Mayflower Ring", x: 174, z: 191.5, r: 2.6 },
] as const;

export type WarpCircle = (typeof PH_WARP_CIRCLES)[number];
export type WarpCircleId = WarpCircle["id"];

/** A ring a character can open by walking into it, in the zone it belongs to. */
export type WarpRing = {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number;
  zoneId: "pale_hollow" | "forest_basin";
};

function ringName(name: string): string {
  return name.replace(/^the /i, "");
}

export const WARP_RINGS: readonly WarpRing[] = [
  ...PH_WARP_CIRCLES.map((circle) => ({ ...circle, zoneId: "pale_hollow" as const })),
  ...FB_WARP_SITES.map((site) => ({
    id: site.id,
    name: ringName(site.name),
    x: site.x,
    z: site.z,
    r: site.r,
    zoneId: "forest_basin" as const,
  })),
];

/**
 * The Mayflower Ring sits inside the Scout Gate room on purpose: it is Mayflower's
 * own ring, and the room is where returning travellers arrive.
 * `PH_HUB` is that room's interact rectangle, not a warp exclusion.
 * The Scout Gate spawn (PH_HUB_SPAWN) is back on the hub pad and is used for zone
 * entry, recall and returning characters, so the floor is not empty. The exception
 * holds because the ring stays clear of it: the spawn stands about 6.2 m from the
 * ring's centre (beyond r + 1.5 m), the whole disc is walkable and reachable, and no
 * other point anchor is within r + 1.5 m. warp-unlocks.test.ts checks the clearance.
 * New characters start at Emberwatch (PH_START_SPAWN), not here.
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

export function warpCircleById(id: string): WarpRing | undefined {
  return WARP_RINGS.find((circle) => circle.id === id);
}

/** Rings are zone-local. A stand in Pale Hollow never opens a Forest Basin ring. */
export function warpCircleAt(x: number, z: number, zoneId = "pale_hollow"): WarpRing | undefined {
  return WARP_RINGS.find(
    (circle) => circle.zoneId === zoneId && Math.hypot(circle.x - x, circle.z - z) <= circle.r,
  );
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
  zoneId = "pale_hollow",
): { unlocked: string[]; added: string | null } {
  const hit = warpCircleAt(x, z, zoneId);
  if (!hit || unlocked.includes(hit.id)) return { unlocked: [...unlocked], added: null };
  return { unlocked: unlockWarp(unlocked, hit.id), added: hit.id };
}
