import type { ClientMessage, UnitSnapshot } from "@bellgrave/protocol";
import { sameId } from "./fx";

export type ClickResult = { select?: string | null; send?: ClientMessage };

/**
 * Click routing, matching the legacy client's R3F handlers:
 * mob → select + engage; NPC → npc/interact; player → select (+ engage if it
 * carries a PvP bounty); self → nothing; ground → move (handled by caller).
 */
export function routeUnitClick(u: UnitSnapshot, wallet: string | null): ClickResult {
  if (sameId(u.id, wallet)) return {};
  // Gather node billboard onClick → gather (#30); fishing uses the same message.
  if (u.gatherNode) return u.hp > 0 ? { send: { type: "gather", nodeId: u.id } } : {};
  switch (u.kind) {
    case "npc":
      return { send: { type: "npc/interact", npcId: u.id } };
    case "mob":
      if (u.anim === "dead" || u.hp <= 0) return {};
      return { select: u.id, send: { type: "engage", targetId: u.id } };
    case "player":
      return u.pvpBounty ? { select: u.id, send: { type: "engage", targetId: u.id } } : { select: u.id };
  }
}
