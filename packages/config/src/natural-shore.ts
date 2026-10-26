/**
 * Natural lake shorelines with depth tiers, shared by the hand-authored zones.
 * shoreDist returns the polar-warped distance d * r / R(theta): `< r` means inside the irregular shore.
 * Tiers by rho = shoreDist / r:  rho >= SHALLOW_RHO is the wadeable fringe (walkable, bed <= WADE_MAX below the
 * surface); below it the bed drops to deep (~1.35 m), and the inner core (rho < CORE_RHO) is deeper (~2.6 m).
 */
export type NaturalLake = { x: number; z: number; r: number; surface: number; seed: number; cap?: (a: number) => number };

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
  const dx = x - l.x, dz = z - l.z, a = Math.atan2(dz, dx);
  let R = l.r * shoreRadiusScale(l.seed, a, amp);
  if (l.cap) R = Math.min(R, l.cap(a)); // keeps the shore inside its land basin, so the basin never clips it straight
  return (Math.hypot(dx, dz) * l.r) / R;
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

// ---------- natural land masks ----------
function latt(i: number, j: number, s: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
/** Smooth value noise in [-1, 1]. */
export function valueNoise(x: number, z: number, seed: number): number {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = latt(i, j, seed), b = latt(i + 1, j, seed), c = latt(i, j + 1, seed), d = latt(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Natural land edge: the signed mask distance sampled through a two-scale domain warp, then unioned with the
 * raw mask (min). Edges only ever bulge outward (0..~amp m), so every cell that was walkable stays walkable,
 * while circles and straight corridor sides become lobed, interfingered rims.
 */
export function naturalMaskDist(raw: (x: number, z: number) => number, x: number, z: number, seed: number, amp = 5): number {
  const wx = valueNoise(x / 24, z / 24, seed) * amp * 0.75 + valueNoise(x / 7, z / 7, seed + 1) * amp * 0.3;
  const wz = valueNoise(x / 24 + 13, z / 24, seed + 2) * amp * 0.75 + valueNoise(x / 7 + 5, z / 7, seed + 3) * amp * 0.3;
  const r = raw(x, z);
  if (r > amp * 1.2) return r; // far from any rim: unchanged (cheap)
  return Math.min(r, raw(x + wx, z + wz) + 0.6 * valueNoise(x / 11, z / 11, seed + 4) - 0.6);
}
