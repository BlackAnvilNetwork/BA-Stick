import type { BuffState, UnitSnapshot } from "@bellgrave/protocol";
import { worldStatusIcons, type WorldStatusIcon } from "@bellgrave/ui/statusIcons";
import table from "./content/buff-vfx.json";

/** Visual kinds; index = bit in engine/ba-stick-render/src/buffvfx.rs (`NAMES`). */
export const VFX_KINDS = [
  "quicken", "flux", "td", "petrify", "resonance", "haste", "slow", "bind", "stun", "sleep", "silence",
  "para", "blind", "protect", "shell", "berserk", "regen", "dot", "ward", "enfeeble", "flash",
] as const;
export type VfxKind = (typeof VFX_KINDS)[number];
export type BuffVfxEntry = { vfx: VfxKind | "none"; why?: string };

export const BUFF_VFX: Record<string, BuffVfxEntry> = (table as { buffs: Record<string, BuffVfxEntry> }).buffs;

export const bit = (k: VfxKind): number => 1 << VFX_KINDS.indexOf(k);

/** Server Temporal Distortion impact window (old client: 1400 ms). */
export const TD_IMPACT_MS = 1400;
/** Quicken cast burst / resonance ring (old client QUICKEN_BURST_MS). */
export const RESONANCE_BURST_MS = 480;

/** True when a BuffState field means the status is up right now. */
function active(key: string, v: unknown, b: BuffState, now: number): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "number" || !key.endsWith("Until")) return false;
  if (key === "healAbsorbUntil") return v > now && b.healAbsorbHp > 0;
  if (key === "moveUntil") return v > now && b.movePct > 0;
  return v > now;
}

/** Visual-kind bit mask for a unit's buffs this frame. */
export function buffMask(b: BuffState | undefined, now: number): number {
  if (!b) return 0;
  let m = 0;
  for (const [k, e] of Object.entries(BUFF_VFX)) {
    if (e.vfx === "none") continue;
    if (active(k, (b as Record<string, unknown>)[k], b, now)) m |= bit(e.vfx);
  }
  return m;
}

/** TD impact life 0..1, or -1 outside the window. */
export function tdLife(b: BuffState | undefined, now: number): number {
  const until = b?.tdImpactUntil ?? 0;
  return until > now ? Math.max(0, Math.min(1, 1 - (until - now) / TD_IMPACT_MS)) : -1;
}

/** Tracks the rising edge of Quicken per unit to play the resonance burst. */
export class ResonanceClock {
  private on = new Map<string, { until: number; at: number }>();
  burst(u: UnitSnapshot, now: number): number {
    const q = u.buffs?.quickenUntil ?? 0;
    const prev = this.on.get(u.id);
    if (q <= now) {
      this.on.delete(u.id);
      return -1;
    }
    if (!prev || q > prev.until + 1500) this.on.set(u.id, { until: q, at: now });
    else prev.until = q;
    const at = this.on.get(u.id)!.at;
    const life = (now - at) / RESONANCE_BURST_MS;
    return life <= 1 ? Math.max(0, life) : -1;
  }
  forget(keep: Set<string>): void {
    for (const id of this.on.keys()) if (!keep.has(id)) this.on.delete(id);
  }
}

export type BuffVfxState = { mask: number; td: number; burst: number };

export function buffVfx(u: UnitSnapshot, now: number, clock: ResonanceClock): BuffVfxState {
  const dead = u.anim === "dead" || u.hp <= 0;
  if (u.gatherNode) return { mask: 0, td: -1, burst: -1 };
  // A killing blow still plays the Temporal Distortion impact (old client).
  if (dead) {
    const td = tdLife(u.buffs, now);
    return { mask: td >= 0 ? bit("td") : 0, td, burst: -1 };
  }
  return { mask: buffMask(u.buffs, now), td: tdLife(u.buffs, now), burst: clock.burst(u, now) };
}

/** Same column as the old client's UnitStatusIcons (buffs on players, debuffs on mobs). */
export function statusIcons(u: UnitSnapshot, now: number): WorldStatusIcon[] {
  if (!u.buffs || u.anim === "dead" || u.hp <= 0) return [];
  return worldStatusIcons(u, now);
}
