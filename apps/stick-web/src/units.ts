import type { UnitSnapshot } from "@bellgrave/protocol";

/** Minimal renderer surface the unit bridge needs (lets tests use a fake). */
export interface UnitSink {
  upsertUnit(id: string, x: number, y: number, z: number, facing: number, anim: string, preset: string): void;
  removeUnit(id: string): boolean;
}

/** Rig preset key: "<job|npc:role|mob:archetype>/<gender>". */
export function presetFor(u: UnitSnapshot): string {
  if (u.kind === "npc") return `npc:${u.npcRole ?? "guide"}`;
  if (u.kind === "mob") return `mob:${u.archetype ?? "mob"}`;
  return `${u.job ?? "fighter"}/${u.gender ?? "male"}`;
}

/** Server anim → renderer clip. Melee/cast hold only until `animUntil`. */
export function animFor(u: UnitSnapshot, now: number): string {
  switch (u.anim) {
    case "melee":
    case "cast":
      return now < u.animUntil ? u.anim : "idle";
    case "walk":
      return "walk";
    default:
      return "idle"; // rest/dead get dedicated poses later (#32)
  }
}

/** Push a snapshot's units into the renderer, removing ones that left. */
export function syncUnits(sink: UnitSink, units: readonly UnitSnapshot[], known: Set<string>, now: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    if (u.gatherNode) continue; // gather nodes are props (#30)
    seen.add(u.id);
    sink.upsertUnit(u.id, u.x, u.y, u.z, u.facing, animFor(u, now), presetFor(u));
  }
  for (const id of known) if (!seen.has(id)) sink.removeUnit(id);
  known.clear();
  for (const id of seen) known.add(id);
}
