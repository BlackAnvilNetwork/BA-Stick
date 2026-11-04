/** Auto-attack swing cycle for one-handed swords and greatswords. */

export type SwordSwingKind = "slash" | "overhead" | "spin";

const CYCLE: SwordSwingKind[] = ["slash", "overhead", "spin"];

export function isSwordSwingFamily(weaponFamily: string | undefined): boolean {
  return weaponFamily === "sword" || weaponFamily === "greatsword";
}

export function nextSwordSwing(comboStep: number): { kind: SwordSwingKind; nextStep: number } {
  const i = ((comboStep % CYCLE.length) + CYCLE.length) % CYCLE.length;
  return { kind: CYCLE[i]!, nextStep: (i + 1) % CYCLE.length };
}

/** Stick Engine / ba-stick-render anim token while `anim === "melee"`. */
export function swordSwingRendererAnim(kind: SwordSwingKind): string {
  switch (kind) {
    case "overhead":
      return "melee_overhead";
    case "spin":
      return "melee_spin";
    default:
      return "melee_slash";
  }
}

/** Melee reach multiplier vs base `MELEE_RANGE`. */
export function swordSwingReachMul(kind: SwordSwingKind): number {
  switch (kind) {
    case "overhead":
      return 1.16;
    case "spin":
      return 1.08;
    default:
      return 1;
  }
}

/** Spinning slash splash on non-primary targets in range. */
export const SWORD_SPIN_SPLASH_DAMAGE_MUL = 0.7;
export const SWORD_SPIN_SPLASH_RADIUS_MUL = 1.05;
