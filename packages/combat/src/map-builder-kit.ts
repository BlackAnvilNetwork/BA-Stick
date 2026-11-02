/**
 * Forest Basin map-builder tools — granted to MAP_BUILDER_* accounts on the server.
 * Cast at the ground cursor (spellbook / hotbar like other abilities).
 */

export const MAP_BUILDER_ABILITY_IDS = [
  "map_enter",
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
  map_enter: {
    id: "map_enter",
    label: "Step Into the Basin",
    glyph: "⇲",
    blurb: "Builders only: step straight to the Forest Basin spawn to sculpt.",
    recastMs: 0,
  },
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
      : id === "map_enter"
      ? "instant"
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

/**
 * `g:x,z` from the client cursor. Scripted builders may add `,radius,strength`
 * (`g:x,z,r,s`): radius 1..16 m, strength 0.05..2 (metres for raise/lower,
 * blend for smooth). Missing values fall back to the spell's own brush.
 */
export function parseGroundTarget(
  raw: string | undefined,
): { x: number; z: number; radius?: number; strength?: number } | null {
  if (!raw?.startsWith(GROUND_TARGET_PREFIX)) return null;
  const parts = raw.slice(GROUND_TARGET_PREFIX.length).split(",");
  if (parts.length < 2 || parts.length > 4) return null;
  const [x, z, r, s] = parts.map((v) => Number(v));
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const out: { x: number; z: number; radius?: number; strength?: number } = { x, z };
  if (parts.length >= 3) {
    if (!Number.isFinite(r)) return null;
    out.radius = Math.max(1, Math.min(16, r));
  }
  if (parts.length === 4) {
    if (!Number.isFinite(s)) return null;
    out.strength = Math.max(0.05, Math.min(2, s));
  }
  return out;
}

export function encodeBrushTarget(x: number, z: number, radius: number, strength?: number): string {
  const base = `${GROUND_TARGET_PREFIX}${x.toFixed(2)},${z.toFixed(2)},${radius.toFixed(2)}`;
  return strength == null ? base : `${base},${strength.toFixed(2)}`;
}
