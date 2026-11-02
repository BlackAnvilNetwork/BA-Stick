// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONES } from "./index";
import {
  LIGHT_KIND,
  LIGHT_MOODS,
  ZONE_LIGHT_MOODS,
  ZONE_MAP_LIGHTS,
  ZONE_MOOD_AREAS,
  moodIsBright,
  zoneLightMood,
} from "./zone-lighting";

describe("zone lighting", () => {
  it("every mood is in range", () => {
    for (const [name, m] of Object.entries(LIGHT_MOODS)) {
      for (const a of m.ambient) assert.ok(a > 0 && a <= 1, `${name} ambient ${a}`);
      assert.ok(m.playerRadius >= 0 && m.playerStrength >= 0 && m.glow >= 0, name);
    }
  });

  it("Mayflower is bright and skips the light pass; the darker places do not", () => {
    assert.ok(moodIsBright(LIGHT_MOODS.mayflower));
    assert.ok(moodIsBright(zoneLightMood("pale_hollow")));
    for (const m of [LIGHT_MOODS.emberwatch, LIGHT_MOODS.seamCountry, LIGHT_MOODS.cave, LIGHT_MOODS.citadel]) {
      assert.ok(!moodIsBright(m));
      assert.ok(m.playerStrength > 0, "dark moods carry the player's light");
    }
  });

  it("keys are real zones; the map builder's blank map keeps daylight", () => {
    const ids = new Set(Object.keys(ZONES));
    for (const t of [ZONE_LIGHT_MOODS, ZONE_MOOD_AREAS, ZONE_MAP_LIGHTS]) {
      for (const id of Object.keys(t)) assert.ok(ids.has(id), `unknown zone ${id}`);
    }
    assert.equal(ZONE_LIGHT_MOODS.forest_basin, undefined);
    assert.equal(ZONE_MAP_LIGHTS.forest_basin, undefined);
    assert.deepEqual(zoneLightMood("forest_basin"), LIGHT_MOODS.daylight);
  });

  it("areas and lights are named and well-formed", () => {
    for (const areas of Object.values(ZONE_MOOD_AREAS)) {
      for (const a of areas) {
        assert.ok(a.name && a.r > 0 && a.feather > 0, a.name);
        assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
      }
    }
    for (const lights of Object.values(ZONE_MAP_LIGHTS)) {
      for (const l of lights) {
        assert.ok(l.name && l.kind in LIGHT_KIND && Number.isFinite(l.x) && Number.isFinite(l.z), l.name);
      }
    }
  });
});
