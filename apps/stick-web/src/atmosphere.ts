// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Hands ZONE_ATMOSPHERE and aerial areas from @bellgrave/config to the renderer.
 */
import {
  WORLD_ZONE_IDS,
  ZONE_ATMOSPHERE_AREAS,
  zoneAtmosphere,
  zoneOrigin,
} from "@bellgrave/config";

export type AtmosphereRenderer = {
  setZoneAtmosphere(hazeBase: number, valleyBeta: number, scaleH: number, horizon: number): void;
  addAtmosphereArea(
    x: number,
    z: number,
    radius: number,
    feather: number,
    hazeBase: number,
    valleyBeta: number,
    scaleH: number,
    horizon: number,
    density: number,
  ): void;
  clearAtmosphereAreas(): void;
  setWeatherHaze(on: boolean): void;
};

export function applyZoneAtmosphere(r: AtmosphereRenderer, zoneId: string | null | undefined): void {
  const a = zoneAtmosphere(zoneId);
  r.setZoneAtmosphere(a.hazeBase, a.valleyBeta, a.scaleH, a.horizonRgb);
  r.setWeatherHaze(zoneId === "pale_hollow");
}

export function applyWorldAtmosphere(r: AtmosphereRenderer, activeZone: string | null | undefined): void {
  r.clearAtmosphereAreas();
  for (const id of WORLD_ZONE_IDS) {
    const o = zoneOrigin(id);
    for (const a of ZONE_ATMOSPHERE_AREAS[id] ?? []) {
      r.addAtmosphereArea(
        a.x + o.x,
        a.z + o.z,
        a.r,
        a.feather,
        a.hazeBase,
        a.valleyBeta,
        a.scaleH,
        a.horizonRgb,
        a.density,
      );
    }
  }
  applyZoneAtmosphere(r, activeZone);
}
