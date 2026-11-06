/**
 * BAZ1 biome byte indices — keep in sync with `BIOMES` in apps/stick-web/scripts/bake-zones.ts.
 */
export const BAZ_BIOME = {
  grass: 13,
  // Indices follow BIOMES in bake-zones.ts: 14 is mountain, 15 is meadow.
  // (They were swapped, so a painted meadow patched in as mountain.)
  mountain: 14,
  meadow: 15,
} as const;

/** BAZ1 flag bits (engine/ba-stick-render/src/zone.rs). */
export const BAZ_FLAG = {
  water: 1,
  trail: 2,
  bridge: 4,
  blocked: 8,
  stone: 16,
} as const;
