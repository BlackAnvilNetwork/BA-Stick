import {
  reachWarp,
  respawnStand,
  warpCircleAt,
  warpCircleById,
  type RespawnHome,
} from "@bellgrave/config";

export function normalizeWarpUnlocked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && warpCircleById(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function normalizeRespawnHome(raw: unknown): RespawnHome {
  if (raw === "emberwatch" || raw === "mayflower" || raw === "hub") return raw;
  return "hub";
}

/** Bind Mayflower only while standing in the open ring. Emberwatch can be set anywhere. */
export function trySetRespawn(
  home: RespawnHome,
  unlocked: readonly string[],
  x: number,
  z: number,
): { ok: true; home: RespawnHome } | { ok: false; reason: string } {
  if (home === "mayflower") {
    if (!unlocked.includes("warp-mayflower")) return { ok: false, reason: "The Mayflower Ring is still shut." };
    if (!warpCircleAt(x, z) || warpCircleAt(x, z)!.id !== "warp-mayflower") {
      return { ok: false, reason: "Stand in the Mayflower Ring to bind there." };
    }
    return { ok: true, home: "mayflower" };
  }
  if (home === "emberwatch") return { ok: true, home: "emberwatch" };
  return { ok: true, home: "hub" };
}

/** Travel only to a ring this character has already opened. */
export function tryUseWarp(
  id: string,
  unlocked: readonly string[],
): { ok: true; x: number; z: number; facing: number } | { ok: false; reason: string } {
  const circle = warpCircleById(id);
  if (!circle) return { ok: false, reason: "There is no such ring." };
  if (!unlocked.includes(circle.id)) return { ok: false, reason: "That ring has not opened for you." };
  return { ok: true, x: circle.x, z: circle.z, facing: respawnStand("hub", unlocked).facing };
}

export { reachWarp };
