import { rollUnit } from "./game-roll";

/** Tape labels for a PvP auto-attack. Blind is skipped when the attacker is not blinded. */
export const PVP_ROLL_BLIND = "combat.pvp.blind";
export const PVP_ROLL_HIT = "combat.pvp.hit";
export const PVP_ROLL_CRIT = "combat.pvp.crit";

export type PvpAutoAttackRoll =
  | { outcome: "blind" }
  | { outcome: "miss" }
  | { outcome: "hit"; crit: boolean };

/**
 * Blind, hit, and crit for one PvP swing. Each check consumes a rollUnit draw
 * only when that check is reached. hitChance stays the hit threshold.
 */
export function rollPvpAutoAttack(opts: {
  blinded: boolean;
  hitChance: number;
  critChance: number;
}): PvpAutoAttackRoll {
  if (opts.blinded && rollUnit(PVP_ROLL_BLIND) < 0.45) {
    return { outcome: "blind" };
  }
  if (rollUnit(PVP_ROLL_HIT) > opts.hitChance) {
    return { outcome: "miss" };
  }
  return { outcome: "hit", crit: rollUnit(PVP_ROLL_CRIT) < opts.critChance };
}
