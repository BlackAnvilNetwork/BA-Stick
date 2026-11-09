/**
 * A hostile player seen through the mob-shaped ability resolvers.
 * Field writes (hp, bind, slow, dia) land on the real player.
 */
export type PvpVictimStats = {
  pvpDef: number;
  pvpVit: number;
  pvpMagDef: number;
  pvpTreePhys: number;
  pvpTreeMag: number;
};

export function isPvpVictim(host: object | null | undefined): boolean {
  return !!host && (host as { pvpVictim?: boolean }).pvpVictim === true;
}

export function pvpFoeView<T extends object>(foe: T, stats: PvpVictimStats): T {
  return new Proxy(foe, {
    get(target, prop, recv) {
      if (prop === "pvpVictim") return true;
      if (prop === "id") return (target as { wallet?: string }).wallet;
      if (prop === "alive") return ((target as { hp?: number }).hp ?? 0) > 0;
      if (typeof prop === "string" && Object.hasOwn(stats, prop)) return stats[prop as keyof PvpVictimStats];
      return Reflect.get(target, prop, recv);
    },
    set(target, prop, value, recv) {
      if (prop === "id" || prop === "alive" || prop === "pvpVictim") return true;
      const ok = Reflect.set(target, prop, value, recv);
      const body = target as {
        movePct?: number;
        moveUntil?: number;
        moveTo?: { x: number; z: number } | null;
        movePath?: unknown[];
        dash?: unknown;
      };
      if (prop === "gravityPct" && typeof value === "number") body.movePct = -Math.abs(value);
      if (prop === "gravityUntil" && typeof value === "number") {
        body.moveUntil = Math.max(body.moveUntil ?? 0, value);
      }
      if (
        (prop === "bindUntil" || prop === "sleepUntil" || prop === "stunUntil" || prop === "petrifyUntil") &&
        typeof value === "number" &&
        value > Date.now()
      ) {
        body.moveTo = null;
        body.movePath = [];
        body.dash = null;
      }
      return ok;
    },
  });
}

/** Ghost Step hides the body from aimed spells and weapon skills, not only autos. */
export function veiledByGhostStep(host: unknown, now: number): boolean {
  if (host == null || typeof host !== "object") return false;
  const until = (host as { ghostStepUntil?: number }).ghostStepUntil;
  return typeof until === "number" && now < until;
}
