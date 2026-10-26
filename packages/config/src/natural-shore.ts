/**
 * Natural lake shorelines with depth tiers, shared by the hand-authored zones.
 * shoreDist returns the polar-warped distance d * r / R(theta): `< r` means inside the irregular shore.
 * Tiers by rho = shoreDist / r:  rho >= SHALLOW_RHO is the wadeable fringe (walkable, bed <= WADE_MAX below the
 * surface); below it the bed drops to deep (~1.35 m), and the inner core (rho < CORE_RHO) is deeper (~2.6 m).
 */
export type NaturalLake = { x: number; z: number; r: number; surface: number; seed: number };

export const SHORE_SHALLOW_RHO = 0.8;
export const SHORE_CORE_RHO = 0.45;
export const SHORE_WADE_MAX = 0.5;

function frac(n: number): number {
  return n - Math.floor(n);
}

export function shoreRadiusScale(seed: number, a: number, amp = 1): number {
  const ph = (k: number) => frac(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) * Math.PI * 2;
  return 1 + amp * (0.12 * Math.sin(2 * a + ph(1)) + 0.07 * Math.sin(3 * a + ph(2)) + 0.045 * Math.sin(5 * a + ph(3)) + 0.025 * Math.sin(8 * a + ph(4)));
}

export function shoreDist(l: NaturalLake, x: number, z: number, amp = 1): number {
  const dx = x - l.x, dz = z - l.z;
  return Math.hypot(dx, dz) / shoreRadiusScale(l.seed, Math.atan2(dz, dx), amp);
}

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** Bed height inside the shore (rho < 1). */
export function shoreBedY(l: NaturalLake, rho: number): number {
  if (rho >= SHORE_SHALLOW_RHO) return l.surface - 0.12 - (SHORE_WADE_MAX - 0.12) * (1 - (rho - SHORE_SHALLOW_RHO) / (1 - SHORE_SHALLOW_RHO));
  if (rho >= SHORE_CORE_RHO) return l.surface - SHORE_WADE_MAX - (1.35 - SHORE_WADE_MAX) * smooth((SHORE_SHALLOW_RHO - rho) / 0.12);
  return l.surface - 1.35 - 1.25 * smooth((SHORE_CORE_RHO - rho) / 0.2);
}

/** Terrain shaped for a lake: bed inside, bank easing back to `bank` over `reach` metres outside. */
export function shoreTerrainY(l: NaturalLake, x: number, z: number, bank: number, reach = 4, amp = 1): number {
  const d = shoreDist(l, x, z, amp);
  if (d < l.r) return shoreBedY(l, d / l.r);
  if (d < l.r + reach) {
    const lip = l.surface + 0.08;
    return lip + (bank - lip) * smooth((d - l.r) / reach);
  }
  return bank;
}

export function inShoreWater(l: NaturalLake, x: number, z: number, amp = 1): boolean {
  return shoreDist(l, x, z, amp) < l.r;
}

export function inShoreShallows(l: NaturalLake, x: number, z: number, amp = 1): boolean {
  const rho = shoreDist(l, x, z, amp) / l.r;
  return rho < 1 && rho >= SHORE_SHALLOW_RHO;
}
