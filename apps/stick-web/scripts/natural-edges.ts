/**
 * Natural edges for baked surfaces (visual only: never changes walkability, water, bridges or heights).
 * Every biome boundary is sampled through a two-scale domain warp plus a per-cell dither, so borders
 * interfinger, feather over ~1-2 m and throw scattered outlier tufts. Built surfaces (hub floors, bridge decks)
 * and water-bound classes keep their exact footprint so the minimap and the water flags agree.
 */
import { Noise2 } from "./worldgen/noise";

const N1 = new Noise2(0x5eed01), N2 = new Noise2(0x5eed02), N3 = new Noise2(0x5eed03), N4 = new Noise2(0x5eed04);
/** Classes that keep their exact edge: built floors, decks, and the water / bank classes tied to the water flags. */
export const EXACT_BIOMES = new Set(["hub_indoor", "bridge", "river"]);

function hash(x: number, z: number): number {
  let h = Math.imul(Math.round(x * 2) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 2) | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

/** Warp offset (m): very broad bends (~12 m over 90 m), broad meanders (~5 m over 30 m), finer lobes (~1.8 m over 7 m), dither (+-0.6 m). */
export function edgeWarp(x: number, z: number, amp = 1): { x: number; z: number } {
  // very broad bends (~12 m over 90 m) so long straight seams between large regions meander too
  const bx = N1.fbm(x / 30, z / 30, 3) * 5 + N2.n(x / 90 - 3, z / 90 + 8) * 12, bz = N2.fbm(x / 30 + 17, z / 30 - 9, 3) * 5 + N1.n(x / 90 + 21, z / 90 - 4) * 12;
  const fx = N3.n(x / 7, z / 7) * 1.8, fz = N4.n(x / 7 + 5, z / 7 + 3) * 1.8;
  const dx = (hash(x, z) - 0.5) * 1.2, dz = (hash(z + 0.25, x - 0.25) - 0.5) * 1.2;
  return { x: x + amp * (bx + fx + dx), z: z + amp * (bz + fz + dz) };
}

/**
 * Wrap a biome function so its borders are natural. `wet(x,z)` is the baked water test: a cell never takes a
 * water class from a neighbour, and a water cell keeps its own class.
 */
export function naturalBiome(
  biome: (x: number, z: number) => string,
  wet: (x: number, z: number) => boolean,
  amp = 1,
): (x: number, z: number) => string {
  return (x, z) => {
    const own = biome(x, z);
    if (EXACT_BIOMES.has(own) || wet(x, z)) return own;
    const p = edgeWarp(x, z, amp);
    const b = biome(p.x, p.z);
    if (EXACT_BIOMES.has(b) || wet(p.x, p.z)) return own;
    // riverbank only spreads along the bank, never far from water: keep it within its own (already warped) band
    if (b === "riverbank" && own !== "riverbank" && !wet(x + (p.x - x) * 0.4, z + (p.z - z) * 0.4)) return own;
    return b;
  };
}

/** Trail verge: core always paved, edge wobbles out to +0.7 m with dithered tufts. */
export function trailVerge(x: number, z: number, half: number): number {
  return half - 0.35 + 0.7 * (0.5 + 0.5 * N3.n(x / 3.5 + 31, z / 3.5)) + (hash(x + 9, z) - 0.5) * 0.5;
}

/** Biome at a warped point for prop scatter, so clusters follow the same natural borders as the ground. */
export function naturalSample<T extends string>(biome: (x: number, z: number) => T, x: number, z: number): T {
  const own = biome(x, z);
  if (EXACT_BIOMES.has(own)) return own;
  const p = edgeWarp(x, z);
  const b = biome(p.x, p.z);
  return EXACT_BIOMES.has(b) || b === "riverbank" || own === "riverbank" ? own : b;
}
