/**
 * World layout data — districts, gather-node spots, mob spawns, NPC spots, props,
 * exits and one lore hook per zone, for every zone in `ZONES`.
 *
 * Data only. Nothing here is read by apps/server or the zone bake yet:
 * - `pale_hollow` / `shard_dwellings` are *derived* from the live Pale Hollow
 *   tables (`PH_*` in ./pale-hollow) so there is one source of truth.
 * - Every other zone is `status: "needs-server"`: the server only spawns
 *   pale_hollow today, so these layouts wait for zone spawn / NPC support.
 *
 * Ids are reused, never invented: node ids = `AREAS[*].harvestNodes[].id`,
 * mob ids = `AREAS[*].mobs[].id`, NPC ids = `CITIES[*].npcs[].id`.
 * Spot ids are `<ref>#<n>` so several spots can share one def.
 */
import {
  PALE_HOLLOW_BOUNDS,
  PH_ALL_MOBS,
  PH_ALL_NODES,
  PH_ASH_ROAD,
  PH_HUB,
  PH_HUB_NPCS,
  PH_HUB_SPAWN,
  PH_SEGMENT_A,
  PH_SEGMENT_B,
  PH_SEGMENT_C,
  PH_SEGMENT_D,
} from "./pale-hollow";
import { AREAS, CITIES, type AreaId, type CityId, type NpcRole } from "./world";
import type { ZoneId } from "./index";

export type XZRect = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Prop kinds the Stick renderer already draws (names of `K` in apps/stick-web/scripts/bake-props.ts). */
export type LayoutPropKind =
  | "pine" | "spruce" | "cypress" | "ashMed" | "ashTall" | "bush" | "rock" | "reed" | "scrub"
  | "wallBlock" | "moss" | "firePit" | "tent" | "bedroll" | "crate" | "chest" | "leanTo"
  | "trainer" | "stall" | "weaponRack" | "firewood" | "barrel" | "banner" | "stone" | "peak";

export type LayoutDistrict = { id: string; name: string; rect: XZRect; levelBand?: [number, number]; note: string };
export type LayoutNodeSpot = { id: string; nodeId: string; x: number; z: number };
export type LayoutMobSpawn = { id: string; mobId: string; x: number; z: number; level: number; count: number };
export type LayoutNpcSpot = { npcId: string; role: NpcRole; x: number; z: number; facing: number };
export type LayoutProp = { kind: LayoutPropKind; x: number; z: number; yaw?: number; s?: number };
export type LayoutExit = { to: ZoneId; x: number; z: number; note: string };

export type ZoneLayout = {
  zoneId: ZoneId;
  kind: "field" | "city";
  status: "live" | "needs-server";
  bounds: XZRect;
  spawn: { x: number; z: number; facing: number };
  loreHook: string;
  districts: LayoutDistrict[];
  nodes: LayoutNodeSpot[];
  mobs: LayoutMobSpawn[];
  npcs: LayoutNpcSpot[];
  props: LayoutProp[];
  exits: LayoutExit[];
};

const FIELD_BOUNDS: XZRect = { minX: -80, maxX: 80, minZ: -20, maxZ: 240 };
const CITY_BOUNDS: XZRect = { minX: -24, maxX: 24, minZ: -16, maxZ: 24 };
const r = (minX: number, maxX: number, minZ: number, maxZ: number): XZRect => ({ minX, maxX, minZ, maxZ });

/** Standard field: four northbound districts like Pale Hollow (A..D). */
const FIELD_ROWS: [number, number][] = [[0, 60], [55, 120], [115, 180], [175, 235]];
function districts(area: AreaId, names: [string, string, string][]): LayoutDistrict[] {
  const [lo, hi] = AREAS[area].levelBand;
  const step = (hi - lo + 1) / 4;
  return names.map(([id, name, note], i) => ({
    id, name,
    rect: r(-70 - i * 3, 70 + i * 3, FIELD_ROWS[i]![0], FIELD_ROWS[i]![1]),
    levelBand: [Math.round(lo + i * step), Math.round(lo + (i + 1) * step - 1)],
    note,
  }));
}
function nodes(spots: [string, number, number][]): LayoutNodeSpot[] {
  const n: Record<string, number> = {};
  return spots.map(([nodeId, x, z]) => ({ id: `${nodeId}#${(n[nodeId] = (n[nodeId] ?? 0) + 1)}`, nodeId, x, z }));
}
function mobs(spots: [string, number, number, number, number][]): LayoutMobSpawn[] {
  const n: Record<string, number> = {};
  return spots.map(([mobId, x, z, level, count]) => ({ id: `${mobId}#${(n[mobId] = (n[mobId] ?? 0) + 1)}`, mobId, x, z, level, count }));
}
/** Standard hub ring around a fire at (0, 0.5); unique NPCs go north of it. */
function cityNpcs(city: CityId): LayoutNpcSpot[] {
  const ring = [[-2.2, 2.8, Math.PI / 2], [3.5, 2.5, -Math.PI / 2], [-4.4, 3.6, 0.4], [3.8, -0.2, -Math.PI / 2], [-3.8, -0.2, Math.PI / 2]] as const;
  const order: NpcRole[] = ["quest_giver", "job_master", "spell_trainer", "crafter", "vendor"];
  const extra = [[0.4, 5.0, Math.PI], [-1.6, 6.2, Math.PI], [1.8, 6.2, Math.PI]] as const;
  let e = 0;
  return CITIES[city].npcs.map((npc) => {
    const base = npc.id.endsWith("-quest") || npc.id.endsWith("-job-master") || npc.id.endsWith("-trainer") || npc.id.endsWith("-crafter") || npc.id.endsWith("-vendor");
    const [x, z, facing] = base ? ring[order.indexOf(npc.role)]! : extra[e++]!;
    return { npcId: npc.id, role: npc.role, x, z, facing };
  });
}
/** Shared camp kit — same props the Pale Hollow hub already draws. */
const HUB_KIT: LayoutProp[] = [
  { kind: "firePit", x: 0, z: 0.4 }, { kind: "trainer", x: -4.35, z: 3.55, yaw: 0.4 },
  { kind: "stall", x: -3.5, z: -1.35, yaw: 0.15 }, { kind: "leanTo", x: 4.6, z: -0.9, yaw: -0.35 },
  { kind: "weaponRack", x: 4.6, z: 2.85, yaw: -0.55 }, { kind: "chest", x: 3.2, z: -1.5, yaw: -0.35 },
  { kind: "banner", x: 1.05, z: 5.45 },
];

// ---------------------------------------------------------------- Pale Hollow (live, derived)
const PH_FIELD: ZoneLayout = {
  zoneId: "pale_hollow", kind: "field", status: "live",
  bounds: r(PALE_HOLLOW_BOUNDS.minX, PALE_HOLLOW_BOUNDS.maxX, PALE_HOLLOW_BOUNDS.minZ, PALE_HOLLOW_BOUNDS.maxZ),
  spawn: { ...PH_HUB_SPAWN },
  loreHook: "The Shard Crypt under the Pale Marches still sheds pale dust; the Shard Wights that guard it walk the same road the first scouts took north to the Ash Road.",
  districts: [
    { id: "a", name: "Hollow Steps", rect: PH_SEGMENT_A, levelBand: [1, 5], note: "Dustgrain terraces, Chalk Run, meadows." },
    { id: "b", name: "Ashbeam Reach", rect: PH_SEGMENT_B, levelBand: [5, 10], note: "Ashbeam groves in open grassland." },
    { id: "c", name: "Chalkworks", rect: PH_SEGMENT_C, levelBand: [10, 15], note: "Hollow Quarry bowl, vine cliffs." },
    { id: "d", name: "Pale Marches", rect: PH_SEGMENT_D, levelBand: [15, 20], note: "Copper seams, Shard Crypt, Ash Road." },
  ],
  nodes: PH_ALL_NODES.map((n) => ({ id: n.id, nodeId: n.id, x: n.x, z: n.z })),
  mobs: PH_ALL_MOBS.map((m) => ({ id: m.id, mobId: m.id, x: m.x, z: m.z, level: m.level, count: 1 })),
  npcs: [],
  props: [],
  exits: [
    { to: "shard_dwellings", x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z, note: "The encampment pad is the Dwellings hub (PH_HUB)." },
    { to: "ashlands", x: (PH_ASH_ROAD.minX + PH_ASH_ROAD.maxX) / 2, z: PH_ASH_ROAD.maxZ, note: "Ash Road — blocked gate (PH_ASH_ROAD.blocked)." },
  ],
};
const SHARD_DWELLINGS: ZoneLayout = {
  zoneId: "shard_dwellings", kind: "city", status: "live",
  bounds: r(PH_HUB.minX, PH_HUB.maxX, PH_HUB.minZ, PH_HUB.maxZ),
  spawn: { ...PH_HUB_SPAWN },
  loreHook: "The Shard Elder keeps the camp fire lit for scouts coming back from the Hollow; every craft here starts with pale dust carried in from the field.",
  districts: [{ id: "camp", name: "Encampment", rect: r(PH_HUB.minX, PH_HUB.maxX, PH_HUB.minZ, PH_HUB.maxZ), note: "Today this is the PH_HUB pad inside pale_hollow." }],
  nodes: [], mobs: [],
  npcs: PH_HUB_NPCS.map((n) => ({ npcId: n.id, role: n.role, x: n.x, z: n.z, facing: n.facing })),
  props: [], // drawn by bake-props hub()
  exits: [{ to: "pale_hollow", x: 0, z: 14, note: "PH_OUTDOOR_SPAWN — terrace gate." }],
};

// ---------------------------------------------------------------- authored zones (needs-server)
/** Route: previous city -> field <-> own city (docs/world.md chapter pairs). */
function field(zoneId: AreaId & ZoneId, prev: ZoneId, own: CityId & ZoneId, o: Pick<ZoneLayout, "loreHook" | "districts" | "nodes" | "mobs" | "props">): ZoneLayout {
  const exits: LayoutExit[] = [
    { to: prev, x: 0, z: -14, note: "South road back to the previous chapter's city." },
    { to: own, x: 0, z: 236, note: "North gate to this chapter's city." },
  ];
  return { zoneId, kind: "field", status: "needs-server", bounds: FIELD_BOUNDS, spawn: { x: 0, z: 4, facing: 0 }, npcs: [], exits, ...o };
}
function city(zoneId: CityId & ZoneId, area: AreaId & ZoneId, next: ZoneId | null, o: Pick<ZoneLayout, "loreHook" | "districts" | "props">): ZoneLayout {
  return {
    zoneId, kind: "city", status: "needs-server", bounds: CITY_BOUNDS, spawn: { x: 0, z: 2, facing: 0 },
    nodes: [], mobs: [], npcs: cityNpcs(zoneId),
    exits: [
      { to: area, x: 0, z: -14, note: "South gate back into this chapter's field." },
      ...(next ? [{ to: next, x: 0, z: 22, note: "North road to the next chapter's field." }] : []),
    ],
    ...o, props: [...HUB_KIT, ...o.props],
  };
}

const ASHLANDS = field("ashlands", "shard_dwellings", "obsidia", {
  loreHook: "Ash Scholars sift the salt flats for ink-salt to copy what the Ash Colossus once guarded; its remnants still rise where the deadwood is thickest.",
  districts: districts("ashlands", [
    ["cinder-steps", "Cinder Steps", "Scrubland and riverbed below Obsidia's gate."],
    ["salt-flats", "Salt Flats", "Rock-salt and ink-salt pans; Salt Asps."],
    ["deadwood", "Deadwood Grove", "Petrified lumber; Cinder Beasts."],
    ["colossus-field", "Colossus Field", "Iron and lapis veins; elite Colossus remnants."],
  ]),
  nodes: nodes([
    ["as-scrubland", -20, 20], ["as-scrubland", 24, 28], ["as-riverbed", -12, 40], ["as-waters", -16, 46],
    ["as-salt", -30, 80], ["as-salt", 26, 92], ["as-salt", 4, 104],
    ["as-deadwood", -24, 136], ["as-deadwood", 30, 150], ["as-deadwood", -40, 160],
    ["as-ore-vein", 12, 196], ["as-ore-vein", -14, 210], ["as-gem-vein", 30, 222],
  ]),
  mobs: mobs([
    ["as-beast", -30, 24, 21, 3], ["as-beast", 34, 36, 23, 3], ["as-cultist", 0, 50, 24, 2],
    ["as-venom", -34, 86, 26, 3], ["as-cultist", 20, 98, 28, 3],
    ["as-beast", -20, 140, 31, 3], ["as-golem", 26, 156, 33, 2], ["as-venom", -48, 166, 34, 2],
    ["as-golem", 10, 200, 36, 2], ["as-large-undead", -16, 216, 38, 1], ["as-large-undead", 22, 228, 40, 1],
  ]),
  props: [{ kind: "peak", x: -60, z: 200, s: 1.2 }, { kind: "ashTall", x: -28, z: 140 }, { kind: "rock", x: 0, z: 110 }, { kind: "wallBlock", x: 0, z: 232 }],
});
const OBSIDIA = city("obsidia", "ashlands", "slagpits", {
  loreHook: "Obsidia is built from the same black glass its constructs are cut from; the Ash Provost pays for every cultist page brought back from the flats.",
  districts: [{ id: "glass-court", name: "Glass Court", rect: r(-14, 14, -6, 10), note: "Hub ring + Ash Provost." }],
  props: [{ kind: "wallBlock", x: -8, z: 9 }, { kind: "wallBlock", x: 8, z: 9 }, { kind: "stone", x: 0, z: 8 }],
});
const SLAGPITS = field("slagpits", "obsidia", "great_filter", {
  loreHook: "Every ingot the Great Filter passes was smelted in the pits; Filter Wardens are the overseers who never left.",
  districts: districts("slagpits", [
    ["sulfur-terraces", "Sulfur Terraces", "Sulfur vents; Slag Slimes."],
    ["skitter-forest", "Skitter Forest", "Bloodbeam forest; Slag Skitters."],
    ["furnace-row", "Furnace Row", "Furnace Golems; mythril veins."],
    ["warden-pits", "Warden Pits", "Onyx veins; elite Filter Wardens."],
  ]),
  nodes: nodes([
    ["sl-sulfur", -18, 22], ["sl-sulfur", 22, 34], ["sl-scrubland", 0, 46],
    ["sl-forest", -28, 80], ["sl-forest", 30, 96], ["sl-scrubland", -40, 104],
    ["sl-ore-vein", 14, 140], ["sl-ore-vein", -20, 160], ["sl-sulfur", 40, 150],
    ["sl-gem-vein", 10, 204], ["sl-gem-vein", -26, 220], ["sl-ore-vein", 30, 226],
  ]),
  mobs: mobs([
    ["sl-slime", -24, 26, 41, 3], ["sl-slime", 26, 40, 43, 3],
    ["sl-insect", -30, 84, 45, 4], ["sl-venom", 32, 100, 47, 2], ["sl-insect", 0, 110, 48, 3],
    ["sl-golem", 16, 144, 51, 2], ["sl-golem", -22, 164, 53, 2], ["sl-venom", 44, 156, 54, 2],
    ["sl-undead-elite", 8, 206, 57, 1], ["sl-undead-elite", -24, 222, 59, 1], ["sl-golem", 28, 228, 58, 2],
  ]),
  props: [{ kind: "peak", x: 60, z: 140, s: 1.1 }, { kind: "rock", x: -10, z: 150 }, { kind: "pine", x: -28, z: 90 }, { kind: "wallBlock", x: 0, z: 232 }],
});
const GREAT_FILTER = city("great_filter", "slagpits", "bellmarsh", {
  loreHook: "The Great Filter weighs every traveller and every ingot at its gate; the Filter Overseer hands out pit work to those who pass.",
  districts: [{ id: "weigh-gate", name: "Weigh Gate", rect: r(-14, 14, -6, 10), note: "Hub ring + Filter Overseer." }],
  props: [{ kind: "barrel", x: -6, z: -3 }, { kind: "crate", x: 6, z: -3 }, { kind: "wallBlock", x: 0, z: 9 }],
});
const BELLMARSH = field("bellmarsh", "great_filter", "belltower_keep", {
  loreHook: "The marsh still rings with the keep's drowned bells; Echo Wraiths answer every toll, and bell koi only rise in the deep pool when it sounds.",
  districts: districts("bellmarsh", [
    ["reed-shallows", "Reed Shallows", "Waters; Marsh Scalekin."],
    ["bellwood", "Bellwood", "Bellwood forest; Cave Bell Bats."],
    ["bog-works", "Bog Works", "Bog Constructs; darksteel veins."],
    ["deep-pool", "Deep Pool", "Bell koi pool; Echo Wraiths."],
  ]),
  nodes: nodes([
    ["bm-waters", -20, 24], ["bm-waters", 22, 36], ["bm-waters", -6, 50],
    ["bm-forest", -30, 82], ["bm-forest", 26, 94], ["bm-forest", -10, 108],
    ["bm-ore-vein", 16, 142], ["bm-ore-vein", -24, 160], ["bm-gem-vein", 34, 168],
    ["bm-premium-waters", 0, 214], ["bm-gem-vein", -30, 220],
  ]),
  mobs: mobs([
    ["bm-reptile", -26, 28, 61, 3], ["bm-venom", 28, 42, 63, 2], ["bm-reptile", 0, 52, 64, 3],
    ["bm-bat", -26, 88, 66, 4], ["bm-bat", 30, 100, 68, 3],
    ["bm-golem", 14, 146, 71, 2], ["bm-golem", -22, 166, 73, 2], ["bm-venom", 40, 160, 72, 2],
    ["bm-spectral", -10, 208, 77, 2], ["bm-spectral", 14, 222, 79, 2],
  ]),
  props: [{ kind: "reed", x: -18, z: 26 }, { kind: "cypress", x: -30, z: 86 }, { kind: "cypress", x: 28, z: 96 }, { kind: "stone", x: 0, z: 210 }],
});
const BELLTOWER_KEEP = city("belltower_keep", "bellmarsh", "throne_approach", {
  loreHook: "Belltower Keep's one remaining bell is rung at dusk to call the marsh patrols home; the Bell Warden counts who returns.",
  districts: [{ id: "bell-yard", name: "Bell Yard", rect: r(-14, 14, -6, 10), note: "Hub ring + Bell Warden." }],
  props: [{ kind: "wallBlock", x: -9, z: 8 }, { kind: "wallBlock", x: 9, z: 8 }, { kind: "banner", x: -3, z: 7 }],
});
const THRONE_APPROACH = field("throne_approach", "belltower_keep", "citadel_of_kek", {
  loreHook: "The Petrified Guard still hold their posts along the road to the Citadel; the palace ruins they guard are the same marble the throne was cut from.",
  districts: districts("throne_approach", [
    ["approach-wood", "Approach Wood", "Forest; Approach Beasts."],
    ["serpent-steps", "Serpent Steps", "Ruin Serpents; orichalcum veins."],
    ["palace-ruins", "Palace Ruins", "Marble and tile; Petrified Guard."],
    ["throne-gate", "Throne Gate", "Diamond veins; elite guard posts."],
  ]),
  nodes: nodes([
    ["ta-forest", -22, 22], ["ta-forest", 26, 36],
    ["ta-ore-vein", -20, 84], ["ta-ore-vein", 22, 100],
    ["ta-palace-ruins", -16, 140], ["ta-palace-ruins", 18, 156], ["ta-palace-ruins", -34, 166],
    ["ta-gem-vein", 10, 206], ["ta-gem-vein", -20, 222],
  ]),
  mobs: mobs([
    ["ta-beast", -26, 26, 81, 3], ["ta-beast", 28, 40, 83, 3],
    ["ta-venom", -24, 88, 86, 2], ["ta-venom", 26, 104, 88, 2],
    ["ta-guardian", -12, 146, 91, 1], ["ta-guardian", 20, 160, 93, 1],
    ["ta-guardian", 0, 210, 97, 2], ["ta-guardian", -18, 226, 99, 1],
  ]),
  props: [{ kind: "wallBlock", x: -6, z: 150 }, { kind: "stone", x: 18, z: 150 }, { kind: "banner", x: 0, z: 230 }, { kind: "pine", x: -24, z: 28 }],
});
const CITADEL_OF_KEK = city("citadel_of_kek", "throne_approach", null, {
  loreHook: "The Citadel of KEK closes the campaign; the Throne Seneschal opens the hall only to those who cleared the Approach, and after that the road starts again harder.",
  districts: [{ id: "throne-hall", name: "Throne Hall", rect: r(-14, 14, -6, 10), note: "Hub ring + Throne Seneschal + legacy palace-hall Trainer." }],
  props: [{ kind: "banner", x: -3, z: 8 }, { kind: "banner", x: 3, z: 8 }, { kind: "wallBlock", x: 0, z: 9.5 }],
});

/** Every zone in route order (palace_hall is a legacy alias of the Citadel, no layout). */
export const WORLD_LAYOUTS: Partial<Record<ZoneId, ZoneLayout>> = {
  pale_hollow: PH_FIELD,
  shard_dwellings: SHARD_DWELLINGS,
  ashlands: ASHLANDS,
  obsidia: OBSIDIA,
  slagpits: SLAGPITS,
  great_filter: GREAT_FILTER,
  bellmarsh: BELLMARSH,
  belltower_keep: BELLTOWER_KEEP,
  throne_approach: THRONE_APPROACH,
  citadel_of_kek: CITADEL_OF_KEK,
};

export const WORLD_ROUTE: ZoneId[] = [
  "pale_hollow", "shard_dwellings", "ashlands", "obsidia", "slagpits",
  "great_filter", "bellmarsh", "belltower_keep", "throne_approach", "citadel_of_kek",
];
