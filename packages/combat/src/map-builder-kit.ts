/**
 * Forest Basin map-builder tools — granted to MAP_BUILDER_* accounts on the server.
 * Cast at the ground cursor (spellbook / hotbar like other abilities).
 */

export const MAP_BUILDER_ABILITY_IDS = [
  "map_undo",
  "map_raise",
  "map_lower",
  "map_flat",
  "map_smooth",
  "map_biome_grass",
  "map_biome_meadow",
  "map_biome_mountain",
  "map_walk",
  "map_block",
] as const;

export type MapBuilderAbilityId = (typeof MAP_BUILDER_ABILITY_IDS)[number];

export const MAP_BUILDER_CATEGORY_TAB = { id: "map", label: "Map" } as const;

export type MapBuilderAbilityDef = {
  id: MapBuilderAbilityId;
  label: string;
  glyph: string;
  blurb: string;
  recastMs: number;
  brush?: number;
};

export const MAP_BUILDER_ABILITIES: Record<MapBuilderAbilityId, MapBuilderAbilityDef> = {
  map_undo: {
    id: "map_undo",
    label: "Undo",
    glyph: "↶",
    blurb: "Revert the last terrain stroke (height, biome, or walkability).",
    recastMs: 0,
  },
  map_raise: {
    id: "map_raise",
    label: "Raise Ground",
    glyph: "▲",
    blurb: "Raise terrain by 0.5 m in a 4 m brush at your cursor.",
    recastMs: 250,
    brush: 4,
  },
  map_lower: {
    id: "map_lower",
    label: "Lower Ground",
    glyph: "▼",
    blurb: "Lower terrain by 0.5 m in a 4 m brush at your cursor.",
    recastMs: 250,
    brush: 4,
  },
  map_flat: {
    id: "map_flat",
    label: "Flatten",
    glyph: "═",
    blurb: "Set terrain to your current footing height in a 5 m brush.",
    recastMs: 400,
    brush: 5,
  },
  map_smooth: {
    id: "map_smooth",
    label: "Smooth",
    glyph: "≈",
    blurb: "Average neighbouring heights in a 4 m brush.",
    recastMs: 400,
    brush: 4,
  },
  map_biome_grass: {
    id: "map_biome_grass",
    label: "Paint Grass",
    glyph: "草",
    blurb: "Paint grass biome on walkable ground.",
    recastMs: 200,
    brush: 4,
  },
  map_biome_meadow: {
    id: "map_biome_meadow",
    label: "Paint Meadow",
    glyph: "原",
    blurb: "Paint meadow biome on walkable ground.",
    recastMs: 200,
    brush: 4,
  },
  map_biome_mountain: {
    id: "map_biome_mountain",
    label: "Paint Mountain",
    glyph: "山",
    blurb: "Paint mountain biome and block movement.",
    recastMs: 200,
    brush: 4,
  },
  map_walk: {
    id: "map_walk",
    label: "Make Walkable",
    glyph: "路",
    blurb: "Clear blocked flags so players can walk here.",
    recastMs: 200,
    brush: 4,
  },
  map_block: {
    id: "map_block",
    label: "Block Ground",
    glyph: "×",
    blurb: "Mark ground blocked (cliff / wall).",
    recastMs: 200,
    brush: 4,
  },
};

export function isMapBuilderAbilityId(id: string): id is MapBuilderAbilityId {
  return Object.prototype.hasOwnProperty.call(MAP_BUILDER_ABILITIES, id);
}

export function mapBuilderAbilityTooltip(id: MapBuilderAbilityId): {
  title: string;
  body: string;
  meta: string;
} {
  const def = MAP_BUILDER_ABILITIES[id];
  const meta =
    id === "map_undo"
      ? "Ctrl+Z · instant"
      : `${def.brush ?? 0} m brush · ${(def.recastMs / 1000).toFixed(1)}s recast`;
  return {
    title: def.label,
    body: def.blurb,
    meta,
  };
}

/** Ground target sent as ability targetId. */
export const GROUND_TARGET_PREFIX = "g:";

export function encodeGroundTarget(x: number, z: number): string {
  return `${GROUND_TARGET_PREFIX}${x.toFixed(2)},${z.toFixed(2)}`;
}

export function parseGroundTarget(raw: string | undefined): { x: number; z: number } | null {
  if (!raw?.startsWith(GROUND_TARGET_PREFIX)) return null;
  const body = raw.slice(GROUND_TARGET_PREFIX.length);
  const comma = body.indexOf(",");
  if (comma <= 0) return null;
  const x = Number(body.slice(0, comma));
  const z = Number(body.slice(comma + 1));
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}
