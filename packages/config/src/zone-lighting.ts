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
import { PH_WARP_CIRCLES } from "./warp-unlocks";
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

/** The mood a zone starts in. Zones not listed have plain daylight. */
export const ZONE_LIGHT_MOODS: Readonly<Record<string, LightMood>> = {
  pale_hollow: LIGHT_MOODS.daylight,
  // The roads east of Pale Hollow share a cold overcast. Forest Basin has its own shade.
  hollow_road: SEAM,
  spur_road: SEAM,
  ring_ward: SEAM,
  islet_fords: SEAM,
  green_reach: SEAM,
  coil_pass: SEAM,
  coil_ridge: SEAM,
  forest_basin: LIGHT_MOODS.forestBasin,
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
export const ZONE_MOOD_AREAS: Readonly<Record<string, readonly MoodArea[]>> = {};

/**
 * Hand-placed lights the baked props do not carry. Fire pits and lanterns among
 * the props light themselves. Pale Hollow's town lights stay with the town
 * data on main; this branch has the Mayflower Ring and the Seam Tunnel.
 */
export const ZONE_MAP_LIGHTS: Readonly<Record<string, readonly MapLight[]>> = {
  pale_hollow: [
    { name: "Seam Tunnel brazier", kind: "brazier", x: (PH_SEAM_TUNNEL.minX + PH_SEAM_TUNNEL.maxX) / 2, z: PH_SEAM_TUNNEL.minZ + 2 },
    ...PH_WARP_CIRCLES.map((c) => ({ name: `${c.name} glow`, kind: "crystal" as const, x: c.x, z: c.z, radius: 4.5 })),
  ],
};

function centre(g: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return { x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2 };
}

/** Travel zones between the fields. Forest Basin names its own lights. */
const TRAVEL_ZONES = ["hollow_road", "spur_road", "ring_ward", "islet_fords", "green_reach", "coil_pass", "coil_ridge"] as const;

/** A brazier on each open gate, so a road reads as a way through at dusk. */
function travelGateLights(zoneId: string): MapLight[] {
  if (!(TRAVEL_ZONES as readonly string[]).includes(zoneId)) return [];
  const out: MapLight[] = [];
  for (const g of ZONE_FIELDS[zoneId]?.gates ?? []) {
    if (g.blocked) continue;
    out.push({ name: "Gate brazier", kind: "brazier", ...centre(g) });
  }
  return out;
}

const lightCache = new Map<string, readonly MapLight[]>();

/**
 * Every map light for a zone: hand-placed lights, travel-gate braziers, and
 * Forest Basin's named lights. Built on first use.
 */
export function zoneMapLights(zoneId: string): readonly MapLight[] {
  let v = lightCache.get(zoneId);
  if (!v) {
    const basin = zoneId === "forest_basin" ? FB_LIGHTS : [];
    v = [...(ZONE_MAP_LIGHTS[zoneId] ?? []), ...travelGateLights(zoneId), ...basin];
    lightCache.set(zoneId, v);
  }
  return v;
}

export function zoneLightMood(zoneId: string | null | undefined): LightMood {
  return (zoneId && ZONE_LIGHT_MOODS[zoneId]) || LIGHT_MOODS.daylight;
}

/** True when the renderer can skip the light pass for this mood. */
export function moodIsBright(m: LightMood): boolean {
  return m.ambient.every((a) => a >= 0.9) && m.playerStrength <= 0;
}
