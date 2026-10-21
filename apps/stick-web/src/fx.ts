import type { UnitSnapshot } from "@bellgrave/protocol";
import { MOB_DEATH_FADE_MS } from "@bellgrave/config";

/** Mirrors the FX bit flags in engine/ba-stick-render/src/scene.rs. */
export const FX = {
  SELECTED: 1,
  HOVERED: 2,
  SHINY: 4,
  HOSTILE: 8,
  SELF: 16,
  PLAYER_CAST: 32,
  PETRIFIED: 64,
} as const;

/** Server level-up window (apps/server: `levelUpUntil = now + 2400`). */
export const LEVEL_UP_MS = 2400;

export type UnitFxState = {
  hp: number;
  cast: number;
  aoe: number;
  flags: number;
  fade: number;
  levelUp: number;
};

/**
 * Remembers when each cast window opened. A cast starts on the rising edge of
 * `animUntil` (so a late snapshot still shows the whole bar), like the old client.
 */
export class CastClock {
  private starts = new Map<string, { until: number; start: number }>();
  progress(u: UnitSnapshot, now: number): number {
    if (u.anim !== "cast" || u.animUntil <= now) {
      this.starts.delete(u.id);
      return -1;
    }
    let s = this.starts.get(u.id);
    if (!s || u.animUntil > s.until + 1) {
      s = { until: u.animUntil, start: now };
      this.starts.set(u.id, s);
    }
    const dur = Math.max(1, s.until - s.start);
    return Math.max(0, Math.min(1, (now - s.start) / dur));
  }
  forget(keep: Set<string>): void {
    for (const id of this.starts.keys()) if (!keep.has(id)) this.starts.delete(id);
  }
}

export function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Effect state for one unit this frame. */
export function unitFx(
  u: UnitSnapshot,
  ctx: { now: number; wallet: string | null; selected: string | null; hovered: string | null; cast: number },
): UnitFxState {
  const isSelf = sameId(u.id, ctx.wallet);
  const hostile = u.kind === "mob" || (u.kind === "player" && !!u.pvpBounty && !isSelf);
  let flags = 0;
  if (ctx.selected === u.id) flags |= FX.SELECTED;
  if (ctx.hovered === u.id) flags |= FX.HOVERED;
  if (u.shiny) flags |= FX.SHINY;
  if (hostile) flags |= FX.HOSTILE;
  if (isSelf) flags |= FX.SELF;
  if (u.kind !== "mob") flags |= FX.PLAYER_CAST;
  if (u.buffs?.petrifyUntil > ctx.now) flags |= FX.PETRIFIED;

  let fade = 1;
  const dead = u.anim === "dead" || u.hp <= 0;
  if (u.kind === "mob" && dead) {
    const deathAt = u.deathAt ?? ctx.now;
    fade = Math.max(0, 1 - (ctx.now - deathAt) / MOB_DEATH_FADE_MS);
  }
  const hp = u.kind === "npc" || dead ? -1 : Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
  const lvl = u.buffs?.levelUpUntil ?? 0;
  const levelUp = lvl > ctx.now ? Math.max(0, Math.min(1, 1 - (lvl - ctx.now) / LEVEL_UP_MS)) : -1;
  return { hp, cast: ctx.cast, aoe: ctx.cast >= 0 ? u.castAoe ?? 0 : 0, flags, fade, levelUp };
}
