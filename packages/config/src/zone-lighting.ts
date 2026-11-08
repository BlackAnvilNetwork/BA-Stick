// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Light moods and map lights (lighting overhaul). The renderer multiplies a
 * light layer over the scene: the mood's ambient everywhere, brightened by
 * each light's pool. Bright moods (ambient 0.9 or more, no player light) skip
 * that pass entirely.
 *
 * Fire pits and lanterns light themselves from the baked props. This file adds
 * the moods and light-only entries for what the props do not carry: forges,
 * braziers at gates, torches at friendly posts, crystal glow over warp circles.
 * Each mood also says how far night reaches it (`night`): open country dims
 * with the sky clock, caves do not.
 *
 * Coordinates are zone-local metres; the client adds the zone origin.
 * Forest Basin uses the woodland shade and the lights named in its features.
 */
import { FB_LIGHTS, FB_LIGHT_MOOD } from "./forest-basin-features";
import { PH_SEAM_TUNNEL } from "./pale-hollow";
import { PH_START_CAMP, PH_WARP_CIRCLES } from "./pale-hollow-camp";
import { MAYFLOWER_BBOX, MAYFLOWER_DISTRICTS } from "./pale-hollow-town";
import { SEAM_COUNTRY_WARPS, SEAM_COUNTRY_ZONES, seamCountryCamps, type SeamCountryZone } from "./seam-country-field";
import { ZONE_FIELDS } from "./zone-fields";

export type LightMood = {
  /** Ambient multiplier, 0..1 per channel (1 = unlit scene colour). */
  ambient: readonly [number, number, number];
  /** Player spotlight radius in metres (0 = none). */
  playerRadius: number;
  /** Player spotlight strength (0 = none). */
  playerStrength: number;
  /** Additive glow over fires, lava and spell flashes (0 = off). */
  glow: number;
  /** How far the time of day reaches it, 0..1 (1 open sky, 0 underground). */
  night: number;
};

/** Light kinds, numbered as the renderer's addLight expects. */
export const LIGHT_KIND = { fire: 0, lantern: 1, forge: 2, brazier: 3, lava: 4, crystal: 5, torch: 6 } as const;
export type LightKind = keyof typeof LIGHT_KIND;

export type MapLight = {
  name: string;
  kind: LightKind;
  x: number;
  z: number;
  /** Metres; omitted = the kind's default. */
  radius?: number;
};

export type MoodArea = {
  name: string;
  x: number;
  z: number;
  /** Full mood inside this radius (m). */
  r: number;
  /** Fades back to the zone mood over this many metres. */
  feather: number;
  mood: LightMood;
};

export const LIGHT_MOODS = {
  /** Open sky at midday: no light pass by day; dims with the sky at night. */
  daylight: { ambient: [1, 1, 1], playerRadius: 0, playerStrength: 0, glow: 0, night: 1 },
  /** Mayflower: warm, bright streets; no light pass by day. */
  mayflower: { ambient: [1.0, 0.97, 0.9], playerRadius: 0, playerStrength: 0, glow: 0, night: 1 },
  /** Emberwatch: the scouts' camp in the ridge's cool shadow, warmed by its fire. */
  emberwatch: { ambient: [0.62, 0.64, 0.76], playerRadius: 5, playerStrength: 0.35, glow: 0.45, night: 1 },
  /** Seam Country: cold overcast fields east of the Hollow, still easy to read. */
  seamCountry: { ambient: [0.72, 0.76, 0.86], playerRadius: 5, playerStrength: 0.3, glow: 0.4, night: 1 },
  /** Caves and deep places: very dark and blue; the player's light carries the scene. */
  cave: { ambient: [0.26, 0.27, 0.36], playerRadius: 7, playerStrength: 0.85, glow: 0.6, night: 0 },
  /** The Citadel: cold stone halls, braziers burning. */
  citadel: { ambient: [0.42, 0.42, 0.54], playerRadius: 6, playerStrength: 0.55, glow: 0.5, night: 0.4 },
  /** Ash and slag country: red-brown murk over forge pits. */
  slag: { ambient: [0.56, 0.44, 0.42], playerRadius: 5, playerStrength: 0.4, glow: 0.6, night: 0.6 },
  /** Forest Basin: green-grey shade under the replanted wood. */
  forestBasin: FB_LIGHT_MOOD,
} as const satisfies Record<string, LightMood>;

const SEAM = LIGHT_MOODS.seamCountry;

/** The mood a zone starts in. Unlisted ids fall back to citadel/slag, not meadow daylight. */
export const ZONE_LIGHT_MOODS: Readonly<Record<string, LightMood>> = {
  pale_hollow: LIGHT_MOODS.daylight,
  // Seam Country: the seven fields east of Pale Hollow. Forest Basin has its own shade.
  hollow_road: SEAM,
  spur_road: SEAM,
  ring_ward: SEAM,
  islet_fords: SEAM,
  green_reach: SEAM,
  coil_pass: SEAM,
  coil_ridge: SEAM,
  forest_basin: LIGHT_MOODS.forestBasin,
};

/** Places with their own mood inside a zone. */
export const ZONE_MOOD_AREAS: Readonly<Record<string, readonly MoodArea[]>> = {
  pale_hollow: [
    { name: "Emberwatch", x: PH_START_CAMP.x, z: PH_START_CAMP.z, r: 22, feather: 18, mood: LIGHT_MOODS.emberwatch },
    {
      name: "Mayflower",
      x: (MAYFLOWER_BBOX.minX + MAYFLOWER_BBOX.maxX) / 2,
      z: (MAYFLOWER_BBOX.minZ + MAYFLOWER_BBOX.maxZ) / 2,
      r: Math.hypot((MAYFLOWER_BBOX.maxX - MAYFLOWER_BBOX.minX) / 2, (MAYFLOWER_BBOX.maxZ - MAYFLOWER_BBOX.minZ) / 2),
      feather: 20,
      mood: LIGHT_MOODS.mayflower,
    },
  ],
};

const EIGHTFOLD = MAYFLOWER_DISTRICTS.find((d) => d.id === "eightfold")!;

const district = (id: string) => MAYFLOWER_DISTRICTS.find((d) => d.id === id)!;
const CAMP = PH_START_CAMP;

/**
 * Hand-placed lights the baked props do not carry. Fire pits and lanterns are
 * not repeated here. Mayflower's lights only show once dusk turns its light
 * pass on; by day the town stays on the bright, free path.
 */
export const ZONE_MAP_LIGHTS: Readonly<Record<string, readonly MapLight[]>> = {
  pale_hollow: [
    // The Great Forge Hall's hearth glow, spilling out of its doors toward the
    // anvil-stone (the hall stands at the Eightfold + (4.5, 0.5), 7 m wide).
    // A light inside the hall would only wash its roof.
    { name: "Great Forge Hall hearth", kind: "forge", x: EIGHTFOLD.x + 0.6, z: EIGHTFOLD.z - 0.6, radius: 7 },
    { name: "Eightfold anvil-stone brazier", kind: "brazier", x: EIGHTFOLD.x - 2.5, z: EIGHTFOLD.z - 2.5 },
    { name: "Scout Gate watch-fire", kind: "brazier", x: 181, z: 196 },
    { name: "Scout Gate watch-fire", kind: "brazier", x: 181, z: 184 },
    { name: "Tally Row torch", kind: "torch", x: district("tally_row").x - 3, z: district("tally_row").z - 3 },
    { name: "Turning Yard torch", kind: "torch", x: district("turning_yard").x + 4, z: district("turning_yard").z + 3 },
    { name: "Strongroom door torch", kind: "torch", x: district("strongroom").x - 2, z: district("strongroom").z - 1 },
    { name: "Jobhouse yard torch", kind: "torch", x: district("jobhouse").x + 1, z: district("jobhouse").z - 3.5 },
    { name: "Elder's Stair torch", kind: "torch", x: district("elders_stair").x - 1.5, z: district("elders_stair").z - 4 },
    { name: "Emberwatch lookout torch", kind: "torch", x: CAMP.x + 7.5, z: CAMP.z - 5.5 },
    { name: "Emberwatch trail torch", kind: "torch", x: CAMP.x + 5, z: CAMP.z + 4.5 },
    { name: "Seam Tunnel brazier", kind: "brazier", x: (PH_SEAM_TUNNEL.minX + PH_SEAM_TUNNEL.maxX) / 2, z: PH_SEAM_TUNNEL.minZ + 2 },
    ...PH_WARP_CIRCLES.map((c) => ({ name: `${c.name} glow`, kind: "crystal" as const, x: c.x, z: c.z, radius: 4.5 })),
  ],
};

function centre(g: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return { x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2 };
}

/** Seam Country lights from its own data: gates, warp circles and friendly posts. */
function seamCountryLights(zone: SeamCountryZone): MapLight[] {
  const out: MapLight[] = [];
  for (const g of ZONE_FIELDS[zone]?.gates ?? []) {
    if (g.blocked) continue;
    out.push({ name: "Gate brazier", kind: "brazier", ...centre(g) });
  }
  const w = SEAM_COUNTRY_WARPS[zone];
  out.push({ name: "Warp circle glow", kind: "crystal", x: w.x, z: w.z, radius: 4.5 });
  for (const c of seamCountryCamps(zone)) {
    if (c.side !== "friendly") continue;
    out.push({ name: `${c.name} torch`, kind: "torch", x: c.x + Math.cos(c.yaw) * 2.5, z: c.z - Math.sin(c.yaw) * 2.5 });
  }
  return out;
}

const lightCache = new Map<string, readonly MapLight[]>();

/**
 * Every map light for a zone: hand-placed lights, Seam Country derived lights,
 * and Forest Basin's named lights. Built on first use.
 */
export function zoneMapLights(zoneId: string): readonly MapLight[] {
  let v = lightCache.get(zoneId);
  if (!v) {
    const seam = (SEAM_COUNTRY_ZONES as readonly string[]).includes(zoneId);
    const basin = zoneId === "forest_basin" ? FB_LIGHTS : [];
    v = [
      ...(ZONE_MAP_LIGHTS[zoneId] ?? []),
      ...(seam ? seamCountryLights(zoneId as SeamCountryZone) : []),
      ...basin,
    ];
    lightCache.set(zoneId, v);
  }
  return v;
}

export function zoneLightMood(zoneId: string | null | undefined): LightMood {
  if (!zoneId) return LIGHT_MOODS.daylight;
  if (ZONE_LIGHT_MOODS[zoneId]) return ZONE_LIGHT_MOODS[zoneId];
  if (zoneId === "slagpits" || zoneId === "ashlands" || zoneId === "obsidia" || zoneId === "great_filter") {
    return LIGHT_MOODS.slag;
  }
  return LIGHT_MOODS.citadel;
}

/** Outdoor / night:1 (and partial-night indoor) share the wall clock. Freeze only night:0 caves. */
export function zoneUsesDayClock(zoneId: string | null | undefined): boolean {
  return zoneLightMood(zoneId).night > 0;
}

/** True when the renderer can skip the light pass for this mood. */
export function moodIsBright(m: LightMood): boolean {
  return m.ambient.every((a) => a >= 0.9) && m.playerStrength <= 0;
}
