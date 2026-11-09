import type { ClientMessage, UnitSnapshot } from "@bellgrave/protocol";
import { sameId } from "./fx";

export type ClickResult = { select?: string | null; send?: ClientMessage; ground?: true };

/**
 * Click routing, matching the legacy client's R3F handlers:
 * mob → select + engage; NPC → npc/interact; player → select (+ engage if it
 * carries a PvP bounty); self → nothing; ground → move (handled by caller).
 */
export function routeUnitClick(u: UnitSnapshot, wallet: string | null): ClickResult {
  if (sameId(u.id, wallet)) return { select: u.id };
  // Gather node billboard onClick → gather (#30); fishing uses the same message.
  // A depleted node falls through to ground move.
  if (u.gatherNode) return u.hp > 0 ? { send: { type: "gather", nodeId: u.id } } : { ground: true };
  switch (u.kind) {
    case "npc":
      return { send: { type: "npc/interact", npcId: u.id } };
    case "mob":
      if (u.anim === "dead" || u.hp <= 0) return { ground: true };
      return { select: u.id, send: { type: "engage", targetId: u.id } };
    case "player": {
      const targetId = u.characterId ?? u.id;
      return u.pvpBounty ? { select: u.id, send: { type: "engage", targetId } } : { select: u.id };
    }
  }
}
