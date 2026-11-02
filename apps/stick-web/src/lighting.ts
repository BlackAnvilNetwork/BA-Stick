// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Lighting overhaul, client side: hands the zone moods, mood areas and map
 * lights from @bellgrave/config to the renderer. The engine does the rest
 * (light layer, flicker, effect flashes from ability VFX).
 */
import {
  LIGHT_KIND,
  WORLD_ZONE_IDS,
  ZONE_MAP_LIGHTS,
  ZONE_MOOD_AREAS,
  zoneLightMood,
  zoneOrigin,
} from "@bellgrave/config";

export type LightingRenderer = {
  setLightMood(r: number, g: number, b: number, playerR: number, playerK: number, glow: number, snap: boolean): void;
  addMoodArea(x: number, z: number, radius: number, feather: number, r: number, g: number, b: number, playerR: number, playerK: number, glow: number): void;
  addLight(x: number, y: number, z: number, kind: number, radius: number, color: number): void;
  clearLighting(): void;
};

/** Set the mood of the zone the player stands in. `snap` skips the easing (first load). */
export function applyZoneMood(r: LightingRenderer, zoneId: string | null | undefined, snap: boolean): void {
  const m = zoneLightMood(zoneId);
  r.setLightMood(m.ambient[0], m.ambient[1], m.ambient[2], m.playerRadius, m.playerStrength, m.glow, snap);
}

/**
 * Mood areas and map lights for every placed zone, in world metres. Call once
 * the zones are placed (lights sit on the terrain), then the zone mood again.
 */
export function applyWorldLighting(r: LightingRenderer, activeZone: string | null | undefined): void {
  r.clearLighting();
  for (const id of WORLD_ZONE_IDS) {
    const o = zoneOrigin(id);
    for (const a of ZONE_MOOD_AREAS[id] ?? []) {
      const m = a.mood;
      r.addMoodArea(a.x + o.x, a.z + o.z, a.r, a.feather, m.ambient[0], m.ambient[1], m.ambient[2], m.playerRadius, m.playerStrength, m.glow);
    }
    for (const l of ZONE_MAP_LIGHTS[id] ?? []) {
      r.addLight(l.x + o.x, Number.NaN, l.z + o.z, LIGHT_KIND[l.kind], l.radius ?? 0, 0);
    }
  }
  applyZoneMood(r, activeZone, true);
}

/** `?lights=0` turns the light pass off (moods keep their ambient tint). */
export function lightsFor(search: string): boolean {
  return new URLSearchParams(search).get("lights") !== "0";
}
