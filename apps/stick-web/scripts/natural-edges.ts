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

/** Region classes that read as open country: they warp far and break into mosaics. */
export const SOFT_BIOMES = new Set(["grass", "meadow", "scrub", "farm", "quarry", "ashbeam", "mountain", "ore_seam", "terrace", "vine_cliff", "crypt"]);

export type EcoCtx = {
  /** Rise over run of the stand surface around the cell (0 flat, 1 = 45 deg). */
  slope: number;
  /** 0 = lowest land in the zone, 1 = highest. */
  elev: number;
  /** Metres to the nearest trail centreline (Infinity if none). */
  trailD: number;
  /** Trail half width used by the bake. */
  trailHalf: number;
  /** Cell is unwalkable land (outside a land mask, cliff, wall). */
  blocked: boolean;
};

/**
 * Ecology pass (visual only). Takes the edge-warped class and turns big uniform blocks into a mosaic:
 * far-warped region borders (discs become blobs and lobes), moisture/elevation gradients (wet lowland meadow,
 * dry upland scrub), groves and clearings, scree on steep ground, and worn dirt beside trails.
 */
export function ecoMosaic(own: string, warped: string, biome: (x: number, z: number) => string, x: number, z: number, c: EcoCtx): string {
  if (EXACT_BIOMES.has(own) || own === "river" || own === "riverbank" || own === "ash_road" || own === "hub_indoor") return warped;
  if (own === "crypt" && c.blocked) return warped; // parchment / scenery outside irregular land masks stays as chosen
  let b = warped;
  if (SOFT_BIOMES.has(own) && SOFT_BIOMES.has(b)) {
    // far warp: region blobs instead of discs and rectangles
    const p = edgeWarp(x * 0.6 + 400, z * 0.6 - 250, 1);
    const q = biome(x + (p.x - (x * 0.6 + 400)) * 2.4, z + (p.z - (z * 0.6 - 250)) * 2.4);
    if (SOFT_BIOMES.has(q) && q !== "crypt") b = q;
  }
  const n1 = N1.fbm(x / 22 + 7, z / 22 - 3, 3); // patches
  const n2 = N2.fbm(x / 70 - 11, z / 70 + 5, 2); // moisture field
  const n3 = N3.fbm(x / 9 + 2, z / 9 + 13, 2); // small clumps
  const moist = n2 * 0.8 - (c.elev - 0.45) * 0.9;
  const t = hash(x * 1.7 + 3, z * 1.3 - 7) - 0.5; // dither
  if (!c.blocked && c.trailD < c.trailHalf + 1.2 + 1.6 * (0.5 + 0.5 * n3) + t) {
    if (b === "grass" || b === "meadow" || b === "scrub" || b === "farm") return "ash_road"; // worn verge
  }
  const steep = c.slope + n3 * 0.15 + t * 0.1;
  if (steep > 1.1 && b !== "terrace") return n1 > 0 ? "mountain" : "quarry"; // scree
  switch (b) {
    case "grass":
      if (steep > 0.6) return "scrub";
      if (moist > 0.28 + t * 0.1) return "meadow";
      if (moist < -0.3 && n1 > 0.15) return "scrub";
      if (n1 < -0.5 + t * 0.08) return "ashbeam"; // grove
      if (n3 > 0.62) return "meadow";
      return b;
    case "ashbeam":
      if (n1 > 0.2 + t * 0.1) return "meadow"; // clearing
      if (n1 > 0.02 || n3 > 0.45) return "grass"; // open glade fringe
      return b;
    case "meadow":
      if (n1 < -0.42 + t * 0.1) return "grass";
      if (n1 > 0.58 && n3 > 0) return "ashbeam"; // copse
      if (moist < -0.35) return "scrub";
      return b;
    case "farm":
      if (N4.n(x / 34 + 9, z / 34) > 0.5 + t * 0.1) return "grass"; // fallow/hedgerow
      if (n3 > 0.66) return "meadow";
      return b;
    case "scrub":
      if (moist > 0.3) return "grass";
      if (n1 > 0.55) return "mountain"; // rock outcrop
      if (n3 > 0.6) return "quarry";
      return b;
    case "quarry":
      if (n1 > 0.45) return "scrub";
      if (n3 < -0.6) return "mountain";
      return b;
    case "mountain":
      if (n1 < -0.1 + t * 0.1) return "quarry"; // scree apron
      if (steep < 0.5 && n3 > 0.15) return "scrub";
      return b;
    default:
      return b;
  }
}
