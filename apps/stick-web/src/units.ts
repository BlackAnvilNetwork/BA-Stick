import { gatherInteractMs, gatherMethod } from "./gather";
import type { UnitSnapshot } from "@bellgrave/protocol";

/** Minimal renderer surface the unit bridge needs (lets tests use a fake). */
export interface UnitSink {
  upsertUnit(id: string, x: number, y: number, z: number, facing: number, anim: string, preset: string): void;
  removeUnit(id: string): boolean;
}

/** Rig preset key: "<job|npc:role|mob:archetype>/<gender>". */
export function presetFor(u: UnitSnapshot): string {
  if (u.gatherNode) return `gather:${gatherMethod(u)}`;
  if (u.kind === "npc") return `npc:${u.npcRole ?? "guide"}`;
  if (u.kind === "mob") return `mob:${u.archetype ?? "mob"}`;
  return `${u.job ?? "fighter"}/${u.gender ?? "male"}`;
}

/** Bench craft channels — three hammer strikes (renderer). */
export const LEATHERCRAFT_ANIM_MS = 2700;
export const SMITHING_ANIM_MS = 2700;
export const COOKING_ANIM_MS = 2700;
export const GOLDSMITHING_ANIM_MS = 2700;

export type CraftChannel = "leathercraft" | "smithing" | "cooking" | "goldsmithing";

export type CraftAct = { skill: CraftChannel; since: number; until: number };

export type UnitWithCraft = UnitSnapshot & { craftChannel?: CraftChannel };

const CRAFT_ANIM_MS: Record<CraftChannel, number> = {
  leathercraft: LEATHERCRAFT_ANIM_MS,
  smithing: SMITHING_ANIM_MS,
  cooking: COOKING_ANIM_MS,
  goldsmithing: GOLDSMITHING_ANIM_MS,
};

/** Server anim → renderer clip. Melee/cast hold only until `animUntil`. */
export function animFor(u: UnitWithCraft, now: number): string {
  if (u.craftChannel && now < u.animUntil) return u.craftChannel;
  if (u.gatherTool && now < u.animUntil) return u.gatherTool === "pick" ? "mine" : "harvest";
  if (u.dashTo) return "dash";
  switch (u.anim) {
    case "melee":
    case "cast":
      return now < u.animUntil ? u.anim : "idle";
    case "walk":
      return "walk";
    case "rest":
      return "rest";
    default:
      return "idle"; // dead gets a dedicated pose later
  }
}

/** Local gather channel. The click knows the node; the pose lasts its interact time. */
export type GatherAct = { tool: "shovel" | "pick"; since: number; until: number };

/** Shovel or pick for this node. Fishing keeps the weapon, so it starts no act. */
export function gatherActFor(node: UnitSnapshot, now: number): GatherAct | null {
  const method = gatherMethod(node);
  if (method === "fish") return null;
  return { tool: method === "mine" ? "pick" : "shovel", since: now, until: now + gatherInteractMs(node) };
}

/**
 * Put the tool in the local player's hand for the channel. A walk, swing, or
 * rest after the click has had a moment to land cancels it. The server's own
 * `gatherTool` is left as it arrived.
 */
export function presentGather(
  u: UnitSnapshot,
  act: GatherAct | null,
  now: number,
): { unit: UnitSnapshot; act: GatherAct | null } {
  if (!act) return { unit: u, act: null };
  const interrupted =
    u.anim === "dead" ||
    (now > act.since + 400 && (u.anim === "walk" || u.anim === "melee" || u.anim === "rest"));
  if (now >= act.until || interrupted) return { unit: u, act: null };
  if (u.gatherTool) return { unit: u, act };
  return { unit: { ...u, gatherTool: act.tool, animUntil: Math.max(u.animUntil, act.until) }, act };
}

/** Start a bench craft animation when the player crafts at the Craft Master. */
export function craftActFor(craftSkill: string | undefined, now: number): CraftAct | null {
  if (
    craftSkill !== "leathercraft" &&
    craftSkill !== "smithing" &&
    craftSkill !== "cooking" &&
    craftSkill !== "goldsmithing"
  ) {
    return null;
  }
  const skill = craftSkill;
  return { skill, since: now, until: now + CRAFT_ANIM_MS[skill] };
}

export function presentCraft(
  u: UnitWithCraft,
  act: CraftAct | null,
  now: number,
): { unit: UnitWithCraft; act: CraftAct | null } {
  if (!act) return { unit: u, act: null };
  const interrupted =
    u.anim === "dead" ||
    (now > act.since + 400 && (u.anim === "walk" || u.anim === "melee" || u.anim === "rest"));
  if (now >= act.until || interrupted) return { unit: u, act: null };
  if (u.craftChannel === act.skill) return { unit: u, act };
  return {
    unit: {
      ...u,
      craftChannel: act.skill,
      gatherTool: undefined,
      animUntil: Math.max(u.animUntil, act.until),
    },
    act,
  };
}

/** Push a snapshot's units into the renderer, removing ones that left. */
export function syncUnits(sink: UnitSink, units: readonly UnitWithCraft[], known: Set<string>, now: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    seen.add(u.id);
    sink.upsertUnit(u.id, u.x, u.y, u.z, u.facing, animFor(u, now), presetFor(u));
  }
  for (const id of known) if (!seen.has(id)) sink.removeUnit(id);
  known.clear();
  for (const id of seen) known.add(id);
}
