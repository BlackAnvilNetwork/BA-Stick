// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Aerial haze per place. Horizon colour is mood × biome (palette BIOME_BASE),
 * not a new colour river. The renderer mixes toward `horizonRgb` with
 * τ = β·s + βh·s·exp(−h/H). Player atmosphere scales β; weather (PH only)
 * multiplies hazeBase.
 */
import { LIGHT_MOODS } from "./zone-lighting";
import { PH_LAKE } from "./pale-hollow";
import { PH_START_CAMP } from "./pale-hollow-camp";
import { MAYFLOWER_BBOX } from "./pale-hollow-town";
import { ASH_PIT } from "./pvp-areas";

/** Same hexes as `BIOME_BASE` in engine/ba-stick-render/src/palette.rs. */
const BIOME = {
  terrace: 0xb3ab92,
  river: 0x2f5f7a,
  riverbank: 0x6e6650,
  ashRoad: 0x5a534a,
  grass: 0x4f6b38,
  mountain: 0x6a6560,
  meadow: 0x6d8a46,
} as const;

/** 3D FAR at Draw distance 1.00 — keep in step with engine `far_m(1)`. */
export const DRAW_FAR_MAX_M = 90;
/** Iso prop reach at Draw distance 1.00 — keep in step with engine `iso_prop_m(1)`. */
export const DRAW_ISO_PROP_MAX_M = 80;
/** Extra metres on unit skip so a hare or flax stand at the FAR disc does not flicker. */
export const DRAW_UNIT_SLACK_M = 4;
/**
 * Server snapshot bubble for players, mobs, NPCs, and harvest nodes.
 * Must cover Clear vistas (FAR 90 + slack) so enemies and flax pop with the trees,
 * not at a shorter 72 m wall.
 */
export const SNAPSHOT_INTEREST_M = DRAW_FAR_MAX_M + DRAW_UNIT_SLACK_M + 2;

/** Live Pale Hollow haze (lavender-grey). Other zones use biome grey, not this. */
const PH_HAZE = 0x6e6a7c;

/** Neutral grey from a biome albedo — haze pigment without PH violet. */
function pigment(biome: number): number {
  const [r, g, b] = unpack(biome);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return pack([lum, lum, lum]);
}

export type AtmosphereLook = {
  hazeBase: number;
  valleyBeta: number;
  scaleH: number;
  horizonRgb: number;
};

export type AtmosphereArea = {
  name: string;
  x: number;
  z: number;
  r: number;
  feather: number;
  /** 0 = keep the zone hazeBase and only apply `density`. */
  hazeBase: number;
  valleyBeta: number;
  scaleH: number;
  /** 0 = keep the zone horizon. */
  horizonRgb: number;
  density: number;
};

function unpack(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function pack(rgb: readonly [number, number, number]): number {
  return (Math.round(rgb[0]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[2]);
}

function mix(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function tint(rgb: readonly [number, number, number], ambient: readonly [number, number, number]): [number, number, number] {
  return [rgb[0] * ambient[0], rgb[1] * ambient[1], rgb[2] * ambient[2]];
}

function horizon(biome: number, haze: number, ambient: readonly [number, number, number], hazeW = 0.5): number {
  return pack(tint(mix(unpack(biome), unpack(haze), hazeW), ambient));
}

const DAY = LIGHT_MOODS.daylight.ambient;
const SEAM = LIGHT_MOODS.seamCountry.ambient;
const FOREST = LIGHT_MOODS.forestBasin.ambient;

export const PH_HORIZON = horizon(BIOME.terrace, PH_HAZE, DAY, 0.5);
const LAKE_HORIZON = pack(mix(unpack(PH_HORIZON), unpack(BIOME.river), 0.15));
const CITADEL_LOOK: AtmosphereLook = {
  hazeBase: 0.004,
  valleyBeta: 0,
  scaleH: 14,
  horizonRgb: horizon(BIOME.mountain, pigment(BIOME.mountain), LIGHT_MOODS.citadel.ambient, 0.35),
};
const SLAG_LOOK: AtmosphereLook = {
  hazeBase: 0.008,
  valleyBeta: 0.006,
  scaleH: 12,
  horizonRgb: horizon(BIOME.ashRoad, pigment(BIOME.ashRoad), LIGHT_MOODS.slag.ambient, 0.4),
};

export const ZONE_ATMOSPHERE: Readonly<Record<string, AtmosphereLook>> = {
  pale_hollow: { hazeBase: 0.012, valleyBeta: 0.018, scaleH: 10, horizonRgb: PH_HORIZON },
  forest_basin: {
    hazeBase: 0.016,
    valleyBeta: 0.022,
    scaleH: 8,
    horizonRgb: horizon(pack(mix(unpack(BIOME.grass), unpack(BIOME.meadow), 0.5)), pigment(BIOME.grass), FOREST, 0.35),
  },
  hollow_road: { hazeBase: 0.006, valleyBeta: 0.004, scaleH: 14, horizonRgb: horizon(BIOME.ashRoad, pigment(BIOME.ashRoad), SEAM, 0.4) },
  spur_road: { hazeBase: 0.006, valleyBeta: 0.004, scaleH: 14, horizonRgb: horizon(BIOME.ashRoad, pigment(BIOME.ashRoad), SEAM, 0.4) },
  coil_pass: { hazeBase: 0.006, valleyBeta: 0.004, scaleH: 14, horizonRgb: horizon(BIOME.ashRoad, pigment(BIOME.ashRoad), SEAM, 0.4) },
  ring_ward: {
    hazeBase: 0.009,
    valleyBeta: 0.008,
    scaleH: 12,
    horizonRgb: horizon(pack(mix(unpack(BIOME.grass), unpack(BIOME.mountain), 0.5)), pigment(BIOME.mountain), SEAM, 0.4),
  },
  green_reach: {
    hazeBase: 0.009,
    valleyBeta: 0.008,
    scaleH: 12,
    horizonRgb: horizon(pack(mix(unpack(BIOME.grass), unpack(BIOME.mountain), 0.5)), pigment(BIOME.mountain), SEAM, 0.4),
  },
  coil_ridge: {
    hazeBase: 0.009,
    valleyBeta: 0.008,
    scaleH: 12,
    horizonRgb: horizon(pack(mix(unpack(BIOME.grass), unpack(BIOME.mountain), 0.5)), pigment(BIOME.mountain), SEAM, 0.4),
  },
  ashen_bastion: {
    hazeBase: 0.01,
    valleyBeta: 0.012,
    scaleH: 11,
    horizonRgb: horizon(pack(mix(unpack(BIOME.mountain), unpack(BIOME.quarry), 0.45)), pigment(BIOME.mountain), SEAM, 0.35),
  },
  islet_fords: { hazeBase: 0.014, valleyBeta: 0.02, scaleH: 7, horizonRgb: horizon(BIOME.riverbank, pigment(BIOME.riverbank), SEAM, 0.4) },
};

function slagZone(id: string): boolean {
  return id === "slagpits" || id === "ashlands" || id === "obsidia" || id === "great_filter";
}

export function zoneAtmosphere(zoneId: string | null | undefined): AtmosphereLook {
  if (!zoneId) return ZONE_ATMOSPHERE.pale_hollow;
  if (ZONE_ATMOSPHERE[zoneId]) return ZONE_ATMOSPHERE[zoneId];
  return slagZone(zoneId) ? SLAG_LOOK : CITADEL_LOOK;
}

const MAYFLOWER = {
  x: (MAYFLOWER_BBOX.minX + MAYFLOWER_BBOX.maxX) / 2,
  z: (MAYFLOWER_BBOX.minZ + MAYFLOWER_BBOX.maxZ) / 2,
};
const MAYFLOWER_R = Math.hypot(
  (MAYFLOWER_BBOX.maxX - MAYFLOWER_BBOX.minX) / 2,
  (MAYFLOWER_BBOX.maxZ - MAYFLOWER_BBOX.minZ) / 2,
);

/** Places that retune aerial look. The PvP pad is intentionally absent. */
export const ZONE_ATMOSPHERE_AREAS: Readonly<Record<string, readonly AtmosphereArea[]>> = {
  pale_hollow: [
    {
      name: "Ash Pit lake",
      x: PH_LAKE.x,
      z: PH_LAKE.z,
      r: PH_LAKE.r,
      feather: 8,
      hazeBase: 0.018,
      valleyBeta: 0.028,
      scaleH: 8,
      horizonRgb: LAKE_HORIZON,
      density: 1,
    },
    {
      name: "Mayflower",
      x: MAYFLOWER.x,
      z: MAYFLOWER.z,
      r: MAYFLOWER_R,
      feather: 20,
      hazeBase: 0,
      valleyBeta: 0,
      scaleH: 0,
      horizonRgb: 0,
      density: 0.85,
    },
    {
      name: "Emberwatch",
      x: PH_START_CAMP.x,
      z: PH_START_CAMP.z,
      r: 22,
      feather: 18,
      hazeBase: 0,
      valleyBeta: 0,
      scaleH: 0,
      horizonRgb: 0,
      density: 1.1,
    },
  ],
};

export function weatherHazeMul(kind: "clear" | "rain" | "fog" | "snow"): number {
  if (kind === "clear") return 0.65;
  if (kind === "rain") return 1.25;
  if (kind === "fog") return 1.7;
  return 1.1;
}

/** Guard: the Ash Pit PvP pad must not appear as an atmosphere area. */
export function atmosphereAreasTouchPvpPad(): boolean {
  const areas = ZONE_ATMOSPHERE_AREAS.pale_hollow ?? [];
  const b = ASH_PIT.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  return areas.some((a) => Math.hypot(a.x - cx, a.z - cz) < a.r);
}
