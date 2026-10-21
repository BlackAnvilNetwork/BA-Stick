import type { UnitSnapshot } from "@bellgrave/protocol";

export type SfxEvent =
  | { kind: "enemySwing"; volume: number }
  | { kind: "jobSwing"; job: UnitSnapshot["job"]; volume: number }
  | { kind: "temporalDistortion"; until: number };

/** Legacy distance falloff: 0.6 near, 0.15 floor, ~28 units out. */
export function swingVolume(dist: number): number {
  return Math.max(0.15, Math.min(0.6, 1.1 - dist / 28));
}

/**
 * Anim-edge detector for combat SFX (#36), same rules as the old WorldScene:
 * a swing plays on each rising edge of `animUntil` while `anim === "melee"`;
 * Temporal Distortion plays while a mob's `tdImpactUntil` is live (the player
 * dedups per impact wave).
 */
export class AnimEdges {
  private melee = new Map<string, number>();
  scan(units: readonly UnitSnapshot[], listener: { x: number; z: number } | undefined, now: number): SfxEvent[] {
    const out: SfxEvent[] = [];
    const seen = new Set<string>();
    for (const u of units) {
      seen.add(u.id);
      const last = this.melee.get(u.id) ?? 0;
      if (u.anim === "melee" && u.animUntil > last) {
        this.melee.set(u.id, u.animUntil);
        const vol = swingVolume(listener ? Math.hypot(listener.x - u.x, listener.z - u.z) : 0);
        if (u.kind === "mob") out.push({ kind: "enemySwing", volume: vol });
        else if (u.kind === "player") out.push({ kind: "jobSwing", job: u.job, volume: vol });
      } else if (u.anim !== "melee") {
        this.melee.delete(u.id);
      }
      const td = u.buffs?.tdImpactUntil ?? 0;
      if (u.kind === "mob" && td > now) out.push({ kind: "temporalDistortion", until: td });
    }
    for (const id of this.melee.keys()) if (!seen.has(id)) this.melee.delete(id);
    return out;
  }
}
