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
 * the moods and the lights the props do not carry (forges, braziers).
 *
 * Coordinates are zone-local metres; the client adds the zone origin.
 * Forest Basin has no entry on purpose: it is the map builder's blank map and
 * keeps plain daylight until its maker gives it a mood.
 */
import { PH_START_CAMP } from "./pale-hollow-camp";
import { MAYFLOWER_BBOX, MAYFLOWER_DISTRICTS } from "./pale-hollow-town";

export type LightMood = {
  /** Ambient multiplier, 0..1 per channel (1 = unlit scene colour). */
  ambient: readonly [number, number, number];
  /** Player spotlight radius in metres (0 = none). */
  playerRadius: number;
  /** Player spotlight strength (0 = none). */
  playerStrength: number;
  /** Additive glow over fires, lava and spell flashes (0 = off). */
  glow: number;
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
  /** Open sky at midday: no light pass. */
  daylight: { ambient: [1, 1, 1], playerRadius: 0, playerStrength: 0, glow: 0 },
  /** Mayflower: warm, bright streets; no light pass. */
  mayflower: { ambient: [1.0, 0.97, 0.9], playerRadius: 0, playerStrength: 0, glow: 0 },
  /** Emberwatch: the scouts' camp under the ridge's shadow, lit by its fire. */
  emberwatch: { ambient: [0.62, 0.55, 0.6], playerRadius: 5, playerStrength: 0.55, glow: 0.6 },
  /** Seam Country: cold overcast fields east of the Hollow. */
  seamCountry: { ambient: [0.6, 0.64, 0.74], playerRadius: 6, playerStrength: 0.5, glow: 0.5 },
  /** Caves and deep places: near-black, the player's light carries the scene. */
  cave: { ambient: [0.18, 0.17, 0.22], playerRadius: 7, playerStrength: 1.0, glow: 0.9 },
  /** The Citadel: cold stone halls, braziers burning. */
  citadel: { ambient: [0.34, 0.3, 0.4], playerRadius: 6, playerStrength: 0.7, glow: 0.8 },
  /** Ash and slag country: red-brown murk over forge pits. */
  slag: { ambient: [0.5, 0.36, 0.3], playerRadius: 5, playerStrength: 0.5, glow: 0.9 },
} as const satisfies Record<string, LightMood>;

const SEAM = LIGHT_MOODS.seamCountry;

/** The mood a zone starts in. Zones not listed have plain daylight. */
export const ZONE_LIGHT_MOODS: Readonly<Record<string, LightMood>> = {
  pale_hollow: LIGHT_MOODS.daylight,
  // Seam Country: the seven fields east of Pale Hollow (Forest Basin excepted, see above).
  hollow_road: SEAM,
  spur_road: SEAM,
  ring_ward: SEAM,
  islet_fords: SEAM,
  green_reach: SEAM,
  coil_pass: SEAM,
  coil_ridge: SEAM,
  // The Citadel of the Seven Seats and its hall.
  palace_hall: LIGHT_MOODS.citadel,
  citadel_of_kek: LIGHT_MOODS.citadel,
  belltower_keep: LIGHT_MOODS.citadel,
  // Forge country.
  slagpits: LIGHT_MOODS.slag,
  ashlands: LIGHT_MOODS.slag,
  obsidia: LIGHT_MOODS.cave,
};

/** Places with their own mood inside a zone. */
export const ZONE_MOOD_AREAS: Readonly<Record<string, readonly MoodArea[]>> = {
  pale_hollow: [
    { name: "Emberwatch", x: PH_START_CAMP.x, z: PH_START_CAMP.z, r: 22, feather: 18, mood: LIGHT_MOODS.emberwatch },
    {
      name: "Mayflower",
      x: (MAYFLOWER_BBOX.minX + MAYFLOWER_BBOX.maxX) / 2,
      z: (MAYFLOWER_BBOX.minZ + MAYFLOWER_BBOX.maxZ) / 2,
      r: 60,
      feather: 20,
      mood: LIGHT_MOODS.mayflower,
    },
  ],
};

const EIGHTFOLD = MAYFLOWER_DISTRICTS.find((d) => d.id === "eightfold")!;

/** Lights the baked props do not carry. Fire pits and lanterns are not repeated here. */
export const ZONE_MAP_LIGHTS: Readonly<Record<string, readonly MapLight[]>> = {
  pale_hollow: [
    // The Great Forge Hall's hearth (pale-hollow-town.ts places the hall at the Eightfold).
    { name: "Great Forge Hall hearth", kind: "forge", x: EIGHTFOLD.x + 4.5, z: EIGHTFOLD.z + 0.5 },
  ],
};

export function zoneLightMood(zoneId: string | null | undefined): LightMood {
  return (zoneId && ZONE_LIGHT_MOODS[zoneId]) || LIGHT_MOODS.daylight;
}

/** True when the renderer can skip the light pass for this mood. */
export function moodIsBright(m: LightMood): boolean {
  return m.ambient.every((a) => a >= 0.9) && m.playerStrength <= 0;
}
