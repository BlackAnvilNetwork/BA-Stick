import type { UnitSnapshot } from "@bellgrave/protocol";
import table from "./content/vfx.json";

/**
 * Ability VFX (#13): `content/vfx.json` maps every AbilityId to a list of
 * particle steps (projectile / line / burst / ring) drawn by the renderer.
 *
 * The server does not say which ability another unit used, so:
 * - our own abilities play the exact table entry (seen on send, fired when
 *   our cast window ends, or at once for instant abilities);
 * - other units get a job-flavoured generic bolt when their cast ends and a
 *   small hit spark when they swing.
 */
export type VfxStep = {
  prim: "projectile" | "line" | "burst" | "ring";
  at: "self" | "target";
  color: string;
  count: number;
  radius?: number;
  rise?: boolean;
  from?: "sky";
};
type Entry = Array<VfxStep | "generic">;
type Table = { colors: Record<string, string>; generic: VfxStep[]; melee: VfxStep[]; abilities: Record<string, Entry> };
export const VFX = table as unknown as Table;

const PRIM = { projectile: 0, line: 1, burst: 2, ring: 3 } as const;

export function stepsFor(abilityId: string): VfxStep[] {
  const e = VFX.abilities[abilityId];
  if (!e) return VFX.generic;
  return e.flatMap((s) => (s === "generic" ? VFX.generic : [s]));
}

export function colorOf(name: string): number {
  return parseInt(VFX.colors[name] ?? name, 16) || 0xffffff;
}

export type VfxSink = {
  spawnVfx(prim: number, from: string, to: string, color: number, count: number, radius: number, flags: number): boolean;
};

/** Spawn every step of an entry. Target-less steps land on the caster. */
export function playSteps(r: VfxSink, steps: readonly VfxStep[], caster: string, target?: string | null): void {
  for (const s of steps) {
    const to = s.at === "target" && target ? target : "";
    const flags = (s.rise ? 1 : 0) | (s.from === "sky" ? 2 : 0);
    r.spawnVfx(PRIM[s.prim], caster, to, colorOf(s.color), s.count, s.radius ?? 0.5, flags);
  }
}

/** Job tint for other players' spells (we only know a cast happened). */
const JOB_SPELL: Record<string, string> = {
  sorcerer: "fire",
  cleric: "holy",
  time_mage: "time",
  battle_mage: "volt",
  knight: "holy",
  rogue: "dark",
  fighter: "physical",
};

/** Instant categories play on send; spells wait for the cast window. */
const SPELL_PREFIX = /^(sc_|cl_|kn_|bm_|cure|haste|slow|gravity|bind|dispel|distract|frazzle|addle|paralyga|silencega|quicken|tempo|allegro)/;

/** Rising burst at the caster when a cast window opens (old client `castBurst`). */
export const CAST_BURST: VfxStep = { prim: "burst", at: "self", color: "physical", count: 16, radius: 0.45, rise: true };

type Pending = { id: string; target?: string | null; at: number; started: boolean };

export class VfxDirector {
  private pending: Pending | null = null;
  private lastAnim = new Map<string, { anim: string; until: number; target: string | null }>();

  /** Our own ability message went out. Returns steps to play now (instant). */
  request(abilityId: string, target: string | null | undefined, now: number): VfxStep[] | null {
    if (SPELL_PREFIX.test(abilityId)) {
      this.pending = { id: abilityId, target, at: now, started: false };
      return null;
    }
    return stepsFor(abilityId);
  }

  /** Per snapshot: returns effects to spawn this frame. */
  scan(units: readonly UnitSnapshot[], myId: string | undefined, now: number): Array<{ steps: VfxStep[]; from: string; to: string | null }> {
    const out: Array<{ steps: VfxStep[]; from: string; to: string | null }> = [];
    const seen = new Set<string>();
    for (const u of units) {
      seen.add(u.id);
      const prev = this.lastAnim.get(u.id);
      const mine = u.id === myId;
      if (mine && this.pending) {
        const p = this.pending;
        if (u.anim === "cast") p.started = true;
        if (p.started && u.anim !== "cast") {
          if (u.anim !== "dead") out.push({ steps: stepsFor(p.id), from: u.id, to: p.target ?? u.targetId });
          this.pending = null;
        } else if (!p.started && now - p.at > 1500) {
          this.pending = null; // refused / never cast
        }
      }
      if (prev && !mine) {
        const castEnded = prev.anim === "cast" && u.anim !== "cast" && u.anim !== "dead";
        if (castEnded) {
          const color = u.kind === "mob" ? "enfeeble" : JOB_SPELL[u.job ?? ""] ?? "physical";
          out.push({ steps: [{ prim: "projectile", at: "target", color, count: 18 }], from: u.id, to: prev.target });
        }
      }
      // Cast burst on the caster at each cast start, players and enemies (old castBurst, F36).
      if (u.anim === "cast" && (!prev || prev.anim !== "cast" || u.animUntil > prev.until + 1)) {
        const color = u.kind === "mob" ? "enfeeble" : JOB_SPELL[u.job ?? ""] ?? "physical";
        out.push({ steps: [{ ...CAST_BURST, color }], from: u.id, to: null });
      }
      if (u.anim === "melee" && (!prev || prev.anim !== "melee" || u.animUntil > prev.until) && u.targetId) {
        out.push({ steps: VFX.melee, from: u.id, to: u.targetId });
      }
      this.lastAnim.set(u.id, { anim: u.anim, until: u.animUntil, target: u.targetId });
    }
    for (const id of this.lastAnim.keys()) if (!seen.has(id)) this.lastAnim.delete(id);
    return out;
  }
}
