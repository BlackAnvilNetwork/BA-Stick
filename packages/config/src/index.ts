export { characterNameKey, normalizeCharacterName } from "./character-name";

export {
  SETTLEMENT_BY_CHAIN,
  isSettlementChain,
  settlementCurrency,
  settlementCurrencyView,
  type SettlementCurrency,
} from "./settlement";

export {
  NETWORK_PROFILES,
  applyNetworkProfileEnv,
  explorerAddressUrl,
  explorerTxUrl,
  isNetworkName,
  networkProfile,
  networkProfileByChainId,
  resolveNetworkName,
  settlementRpcUrls,
  type NetworkName,
  type NetworkProfile,
} from "./network-profile";

/** @deprecated Prefer settlement chain ids (100 / 10200 / 31337). Kept for legacy imports. */
export const CHAIN_ID = 4663;
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;

/** @deprecated Prefer `@bellgrave/items` — kept for existing imports. */
export const ITEM = {
  STAFF_ASHBEAM: 1,
  ROBE_LINEN: 2,
  POTION: 3,
  SWORD_IRON: 4,
  MAIL_IRON: 5,
  DAGGER_IRON: 6,
  LEATHER_VEST: 7,
  GREATSWORD_IRON: 8,
  SCALE_HARNESS: 9,
} as const;

export const KEK_TOKEN = "0x5a3544a0328afD50A9979e03404F35c555B88c00" as const;
export const CRAFT_KEK_COST = 1000 as const;

export const HALL = {
  width: 40,
  depth: 80,
  halfWidth: 20,
  halfDepth: 40,
} as const;

export const PLAYER_SPEED = 6;
/** Flux stance move bonus — readable in play (design floor was +5%). */
export const PLAYER_SPEED_FLUX = 6 * 1.12;
export const MELEE_RANGE = 2.2;
export const ABILITY_RANGE = 12;

/** Mob corpse visible while fading out after death. */
export const MOB_DEATH_FADE_MS = 2_500;
/** After the corpse vanishes, wait this long before the mob returns. */
export const MOB_RESPAWN_MS = 8 * 60 * 1000;

export {
  AREA_IDS,
  AREAS,
  CAMPAIGN,
  CAMPAIGN_ORDER,
  CITIES,
  CITY_IDS,
  areaForCity,
  cityForArea,
  replayEnemyScale,
  type AreaDef,
  type AreaId,
  type CityDef,
  type CityId,
  type CityNpcDef,
  type GatherMethod,
  type HarvestNodeDef,
  type MobArchetypeDef,
  type NpcRole,
} from "./world";

export {
  PALE_HOLLOW_BOUNDS,
  PH_CAMP_SHIFT_X,
  PH_CAMP_SHIFT_Z,
  PH_HUB,
  PH_HUB_REAR_WALL,
  PH_SEGMENT_A,
  PH_SEGMENT_B,
  PH_SEGMENT_C,
  PH_SEGMENT_D,
  PH_TIMBER_BRIDGE,
  PH_QUARRY_CUT,
  PH_SEAM_TUNNEL,
  PH_ASH_ROAD,
  PH_HUB_SPAWN,
  PH_OUTDOOR_SPAWN,
  PH_SEGMENT_A_NODES,
  PH_SEGMENT_B_NODES,
  PH_SEGMENT_C_NODES,
  PH_SEGMENT_D_NODES,
  PH_ALL_NODES,
  PH_ACTIVE_GATHER_COUNT,
  PH_GATHER_RELOCATE_CHANCE,
  paleHollowNodeSpawnPoints,
  PH_HUB_NPCS,
  PH_STORAGE_CHEST,
  PH_MOUNTAINS,
  PH_BRIDGE_SITES,
  PH_RIVER_MAIN,
  PH_RIVER_TRIB,
  PH_RIVER_WALL,
  PH_BRIDGE_DECK_W,
  PH_BRIDGE_WALK_PAD,
  PH_BRIDGE_SPAN_LANDING,
  PH_BRIDGE_DECK_CLEARANCE,
  PH_BRIDGE_WALL_CLEAR,
  PH_BRIDGE_DECK_HALF_T,
  paleHollowBiome,
  paleHollowGroundHeight,
  paleHollowHeight,
  paleHollowStandHeight,
  paleHollowTerrainMeshY,
  PALE_HOLLOW_TERRAIN_SEG_X,
  PALE_HOLLOW_TERRAIN_SEG_Z,
  paleHollowSegment,
  paleHollowGateSoftLevel,
  paleHollowMoveMul,
  paleHollowRiverCenterX,
  paleHollowTributaryCenterX,
  paleHollowBankBlend,
  paleHollowTerrainWeights,
  paleHollowWaterSurfaceY,
  paleHollowInOpenWater,
  paleHollowInRiverWall,
  paleHollowOnBridge,
  paleHollowBakedOnBridge,
  paleHollowInBridgeWaterGap,
  paleHollowInBridgeWallVisualGap,
  paleHollowBridgeDeckY,
  paleHollowComputeBridgeDeckY,
  paleHollowBridgeCurveY,
  paleHollowBridgeProfile,
  PH_BRIDGE_RAMP,
  paleHollowBridgeGeom,
  paleHollowTrails,
  paleHollowOnTrail,
  PH_ROAD_NAMES,
  PH_MAP_LABELS,
  type PaleHollowMapLabelKind,
  PH_TRAIL_WIDTH,
  PH_TRAIL_STONE_WIDTH,
  paleHollowWalkable,
  paleHollowInHubRearWall,
  paleHollowClampMove,
  paleHollowBridgeCrossings,
  paleHollowBankPoint,
  paleHollowInBuildingClearing,
  paleHollowInHubApron,
  paleHollowHubApronDistance,
  paleHollowHubApronRect,
  paleHollowPlaceOnDryLand,
  PH_BUILDING_CLEARINGS,
  PH_YARDS,
  PH_HUB_APRON,
  PALE_HOLLOW_WATER_CLEARANCE,
  clampPaleHollow,
  type PaleHollowBiome,
  type PaleHollowNodeDef,
  type PaleHollowMobDef,
  type PaleHollowMobJob,
  type PaleHollowRareDrop,
  type PaleHollowFixedDrop,
  type PaleHollowArchetype,
  type PaleHollowAggro,
  PH_ARCHETYPE_DEFAULT_JOB,
  paleHollowMobJob,
  type PaleHollowSegmentId,
  type PaleHollowBridgeSite,
  type PaleHollowBridgeGeom,
  type PaleHollowTrail,
  type PaleHollowRiverKind,
  type GatherNodeKind,
} from "./pale-hollow";

export {
  PH_ALL_MOBS,
  PH_SEGMENT_A_MOBS,
  PH_SEGMENT_B_MOBS,
  PH_SEGMENT_C_MOBS,
  PH_SEGMENT_D_MOBS,
  PH_FIELD_NPCS,
  PH_QUESTS,
  emptyPaleHollowQuests,
  normalizePaleHollowQuestState,
  paleHollowQuestById,
  paleHollowQuestByNpc,
  paleHollowQuestCredit,
  paleHollowQuestLogEntries,
  paleHollowQuestTalk,
  type PaleHollowFieldNpc,
  type PaleHollowQuestDef,
  type PaleHollowQuestLogEntry,
  type PaleHollowQuestProgress,
  type PaleHollowQuestState,
} from "./pale-hollow-field";

export {
  PH_SNOW_ACCUM_SEC,
  PH_SNOW_MELT_SEC,
  PH_WEATHER_CYCLE_MS,
  PH_WEATHER_KIND_ID,
  PH_WEATHER_SEED_XOR,
  PH_WEATHER_WEIGHTS,
  PH_DAY_CYCLE_MS,
  paleHollowDayPhaseAt,
  paleHollowWeatherCycleIndex,
  paleHollowWeatherKindAt,
  rollPaleHollowWeather,
  type PaleHollowWeatherKind,
  type PaleHollowWeatherSnapshot,
} from "./pale-hollow-weather";

export {
  FOREST_BASIN_BOUNDS,
  FB_TRAIL_WIDTH,
  FB_BRIDGE_DECK_W,
  FB_LAKE,
  FB_CAMP,
  FB_SPAWN,
  FB_MOUNTAINS,
  FB_GATES,
  FB_BRIDGE,
  FB_ROAD_NAMES,
  FB_MAP_LABELS,
  forestBasinMaskDist,
  forestBasinRiverX,
  forestBasinInOpenWater,
  forestBasinBridgeCenter,
  forestBasinOnBridge,
  forestBasinWalkable,
  forestBasinClamp,
  forestBasinClampMove,
  forestBasinWaterSurfaceY,
  forestBasinStandHeight,
  forestBasinHeight,
  forestBasinBiome,
  forestBasinTrails,
  forestBasinOnTrail,
  forestBasinGateSoftLevel,
  type ForestBasinGate,
  type ForestBasinBiome,
  type ForestBasinTrail,
  type ForestBasinLabelKind,
} from "./forest-basin";

export {
  HR_BOUNDS,
  HR_TRAIL_WIDTH,
  HR_SPAWN,
  HR_GATES,
  HR_ROAD_NAMES,
  HR_MAP_LABELS,
  hollowRoadMaskDist,
  hollowRoadWalkable,
  hollowRoadInOpenWater,
  hollowRoadWaterSurfaceY,
  hollowRoadOnBridge,
  hollowRoadStandHeight,
  hollowRoadHeight,
  hollowRoadClamp,
  hollowRoadClampMove,
  hollowRoadBiome,
  hollowRoadTrails,
  hollowRoadGateSoftLevel,
  type HollowRoadGate,
  type HollowRoadBiome,
  type HollowRoadTrail,
  type HollowRoadLabelKind,
} from "./hollow-road";

export { ZONE_LINKS, zoneLink, linksFrom, linkUnder, type ZoneLink, type GateHit } from "./zone-links";

export {
  BASELINE_CLEAR,
  BASELINE_FIELD_PLANS,
  baseline as baselineFieldPopulation,
  baselineHp,
  baselineSpotProblem,
  fieldMobDefById,
  fieldMobDefs,
  fieldNpcById,
  fieldNpcDefs,
  fieldReachable,
  registerFieldPopulation,
  unregisterFieldPopulation,
  type FieldMobDef,
  type FieldNpcDef,
  type FieldNpcRole,
  type FieldPopulationSource,
} from "./field-population";

export { ZONE_ORIGINS, WORLD_ZONE_IDS, zoneOrigin, zoneWorldBounds, type ZoneOrigin } from "./zone-layout";

export {
  ZONE_FIELDS,
  fieldById,
  fieldStandHeight,
  fieldClampMove,
  fieldNav,
  fieldGateSoftLevel,
  travelAt,
  applyTravel,
  type ZoneField,
  type ZoneGate,
  type TravelStep,
} from "./zone-fields";

export {
  BOOT_FORGE_MENU_BOUNDS,
  BOOT_FORGE_MENU_HERO,
  BOOT_FORGE_MENU_ID,
  bootForgeMenuBiome,
  bootForgeMenuInOpenWater,
  bootForgeMenuOnBridge,
  bootForgeMenuStandHeight,
  bootForgeMenuTrails,
  bootForgeMenuWalkable,
  bootForgeMenuWaterSurfaceY,
} from "./boot-forge-menu";

export { paleHollowLandmarks, type PaleHollowLandmark } from "./pale-hollow-landmarks";

export {
  PVP_BOUNTY_WEI,
  ASH_PIT,
  PVP_AREAS,
  pvpAreaById,
  pvpAreaAt,
  inPvpArea,
  cappedMainLevel,
  cappedSubjobLevel,
  type PvpAreaBounds,
  type PvpAreaDef,
} from "./pvp-areas";

export {
  SHINY_HQ_CHANCE_DEFAULT,
  SHINY_LEVEL_BONUS,
  SHINY_CLONE_COUNT,
  SHINY_MAT_DROP_CHANCE,
  SHINY_FLEE_RELOCATE_MS,
  SHINY_LOOT_BY_ARCHETYPE,
  shinyHqChance,
  shinyLootTable,
  shinyScaledHp,
  shinyDisplayName,
} from "./shiny-hq";

/**
 * Zone catalog — music URL loops; omit / undefined music = keep previous track.
 * Field zones = areas; hub zones = cities. `palace_hall` aliases the Citadel of the Seven Seats (MVP slice).
 */
export const ZONE_IDS = [
  "palace_hall",
  "pale_hollow",
  "hollow_road",
  "forest_basin",
  "spur_road",
  "ring_ward",
  "islet_fords",
  "green_reach",
  "coil_pass",
  "coil_ridge",
  "shard_dwellings",
  "ashlands",
  "obsidia",
  "slagpits",
  "great_filter",
  "bellmarsh",
  "belltower_keep",
  "throne_approach",
  "citadel_of_kek",
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Boot / wallet / character screens (loops until play). */
export const MENU_MUSIC = "/audio/main-theme.mp3";
/** Pale Hollow area field loop when a zone has no explicit track. */
export const PALE_HOLLOW_MUSIC = "/audio/pale-hollow.mp3";

export type ZoneDef = {
  id: ZoneId;
  name: string;
  kind: "field" | "city" | "legacy";
  /** Parent area when this is a city or field. */
  areaId?: import("./world").AreaId;
  cityId?: import("./world").CityId;
  /** Looping BGM. If missing on a future zone, current track keeps playing. */
  music?: string;
};

export const ZONES: Record<ZoneId, ZoneDef> = {
  palace_hall: {
    id: "palace_hall",
    name: "The Citadel of the Seven Seats (Hall)",
    kind: "legacy",
    areaId: "throne_approach",
    cityId: "citadel_of_kek",
    music: "/audio/royal-march.mp3",
  },
  pale_hollow: {
    id: "pale_hollow",
    name: "Pale Hollow",
    kind: "field",
    areaId: "pale_hollow",
    music: PALE_HOLLOW_MUSIC,
  },
  hollow_road: {
    id: "hollow_road",
    name: "Hollow Road",
    kind: "field",
    areaId: "pale_hollow",
    music: PALE_HOLLOW_MUSIC,
  },
  forest_basin: {
    id: "forest_basin",
    name: "Forest Basin",
    kind: "field",
    areaId: "pale_hollow",
    music: PALE_HOLLOW_MUSIC,
  },
  spur_road: {
    id: "spur_road",
    name: "Spur Road",
    kind: "field",
    areaId: "pale_hollow",
  },
  ring_ward: {
    id: "ring_ward",
    name: "Ring Ward",
    kind: "field",
    areaId: "pale_hollow",
  },
  islet_fords: {
    id: "islet_fords",
    name: "Islet Fords",
    kind: "field",
    areaId: "pale_hollow",
  },
  green_reach: {
    id: "green_reach",
    name: "Green Reach",
    kind: "field",
    areaId: "pale_hollow",
  },
  coil_pass: {
    id: "coil_pass",
    name: "Coil Pass",
    kind: "field",
    areaId: "pale_hollow",
  },
  coil_ridge: {
    id: "coil_ridge",
    name: "Coil Ridge",
    kind: "field",
    areaId: "pale_hollow",
  },
  shard_dwellings: {
    id: "shard_dwellings",
    name: "The Shard Dwellings",
    kind: "city",
    areaId: "pale_hollow",
    cityId: "shard_dwellings",
  },
  ashlands: {
    id: "ashlands",
    name: "Ashlands",
    kind: "field",
    areaId: "ashlands",
  },
  obsidia: {
    id: "obsidia",
    name: "Obsidia",
    kind: "city",
    areaId: "ashlands",
    cityId: "obsidia",
  },
  slagpits: {
    id: "slagpits",
    name: "Slagpits",
    kind: "field",
    areaId: "slagpits",
  },
  great_filter: {
    id: "great_filter",
    name: "The Great Filter",
    kind: "city",
    areaId: "slagpits",
    cityId: "great_filter",
  },
  bellmarsh: {
    id: "bellmarsh",
    name: "Bellmarsh",
    kind: "field",
    areaId: "bellmarsh",
  },
  belltower_keep: {
    id: "belltower_keep",
    name: "Belltower Keep",
    kind: "city",
    areaId: "bellmarsh",
    cityId: "belltower_keep",
  },
  throne_approach: {
    id: "throne_approach",
    name: "Throne Approach",
    kind: "field",
    areaId: "throne_approach",
  },
  citadel_of_kek: {
    id: "citadel_of_kek",
    name: "The Citadel of the Seven Seats",
    kind: "city",
    areaId: "throne_approach",
    cityId: "citadel_of_kek",
    music: "/audio/royal-march.mp3",
  },
};

/** Resolve looping BGM for a zone id (area defaults, e.g. all of Pale Hollow). */
export function musicForZone(zoneId: string | undefined): string | undefined {
  const id = (zoneId && (ZONE_IDS as readonly string[]).includes(zoneId) ? zoneId : "pale_hollow") as ZoneId;
  const def = ZONES[id];
  if (def.music) return def.music;
  if (def.areaId === "pale_hollow") return PALE_HOLLOW_MUSIC;
  return undefined;
}
export * from "./dash";

export {
  PH_START_SPAWN,
  PH_WARP_CIRCLES,
  PH_WARP_HUB_EXCEPTIONS,
  reachWarp,
  respawnStand,
  unlockWarp,
  warpCircleAt,
  warpCircleById,
  warpCircleHitsHub,
  type RespawnHome,
  type RespawnStand,
  type WarpCircle,
  type WarpCircleId,
} from "./warp-unlocks";
