// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WORLD_ZONE_IDS, ZONES } from "./index";
import {
  DRAW_FAR_MAX_M,
  DRAW_ISO_PROP_MAX_M,
  DRAW_UNIT_SLACK_M,
  SNAPSHOT_INTEREST_M,
  ZONE_ATMOSPHERE,
  ZONE_ATMOSPHERE_AREAS,
  atmosphereAreasTouchPvpPad,
  weatherHazeMul,
  zoneAtmosphere,
} from "./zone-atmosphere";

describe("zone atmosphere", () => {
  it("every listed zone is real and placed", () => {
    const ids = new Set(Object.keys(ZONES));
    const placed = new Set(WORLD_ZONE_IDS);
    for (const t of [ZONE_ATMOSPHERE, ZONE_ATMOSPHERE_AREAS]) {
      for (const id of Object.keys(t)) {
        assert.ok(ids.has(id), `unknown zone ${id}`);
        assert.ok(placed.has(id), `unbaked atmosphere ${id}`);
      }
    }
  });

  it("uses the design hazeBase / valley / H knots", () => {
    assert.deepEqual(zoneAtmosphere("pale_hollow"), {
      hazeBase: 0.012,
      valleyBeta: 0.018,
      scaleH: 10,
      horizonRgb: zoneAtmosphere("pale_hollow").horizonRgb,
    });
    assert.equal(ZONE_ATMOSPHERE.forest_basin.hazeBase, 0.016);
    assert.equal(ZONE_ATMOSPHERE.hollow_road.hazeBase, 0.006);
    assert.equal(ZONE_ATMOSPHERE.spur_road.valleyBeta, 0.004);
    assert.equal(ZONE_ATMOSPHERE.coil_pass.scaleH, 14);
    assert.equal(ZONE_ATMOSPHERE.ring_ward.hazeBase, 0.009);
    assert.equal(ZONE_ATMOSPHERE.green_reach.valleyBeta, 0.008);
    assert.equal(ZONE_ATMOSPHERE.coil_ridge.scaleH, 12);
    assert.equal(ZONE_ATMOSPHERE.islet_fords.hazeBase, 0.014);
    assert.equal(zoneAtmosphere("palace_hall").hazeBase, 0.004);
    assert.equal(zoneAtmosphere("slagpits").hazeBase, 0.008);
    assert.notEqual(zoneAtmosphere("palace_hall").horizonRgb, zoneAtmosphere("pale_hollow").horizonRgb);
  });

  it("Ash Pit lake retunes; the PvP pad does not", () => {
    const lake = ZONE_ATMOSPHERE_AREAS.pale_hollow.find((a) => a.name === "Ash Pit lake")!;
    assert.equal(lake.hazeBase, 0.018);
    assert.equal(lake.valleyBeta, 0.028);
    assert.equal(lake.scaleH, 8);
    assert.equal(lake.r, 52);
    assert.equal(lake.feather, 8);
    const may = ZONE_ATMOSPHERE_AREAS.pale_hollow.find((a) => a.name === "Mayflower")!;
    const ember = ZONE_ATMOSPHERE_AREAS.pale_hollow.find((a) => a.name === "Emberwatch")!;
    const emberD = Math.hypot(ember.x - lake.x, ember.z - lake.z);
    assert.ok(emberD > lake.r + lake.feather, "Emberwatch sits outside the lake disc");
    assert.ok(may.r > 80, `Mayflower r ${may.r} should cover bbox corners`);
    assert.equal(may.density, 0.85);
    assert.equal(ember.density, 1.1);
    assert.equal(atmosphereAreasTouchPvpPad(), false);
  });

  it("weather is a density multiplier", () => {
    assert.equal(weatherHazeMul("clear"), 0.65);
    assert.equal(weatherHazeMul("rain"), 1.25);
    assert.equal(weatherHazeMul("fog"), 1.7);
    assert.equal(weatherHazeMul("snow"), 1.1);
  });

  it("snapshot interest covers Clear vistas so enemies and harvest match trees", () => {
    assert.equal(DRAW_FAR_MAX_M, 90);
    assert.equal(DRAW_ISO_PROP_MAX_M, 80);
    assert.equal(DRAW_UNIT_SLACK_M, 4);
    assert.ok(SNAPSHOT_INTEREST_M >= DRAW_FAR_MAX_M + DRAW_UNIT_SLACK_M);
    assert.ok(SNAPSHOT_INTEREST_M >= DRAW_ISO_PROP_MAX_M + DRAW_UNIT_SLACK_M);
  });

  it("horizon comes from biome × mood, not a new river stroke", () => {
    for (const look of Object.values(ZONE_ATMOSPHERE)) {
      assert.ok(look.horizonRgb > 0 && look.horizonRgb <= 0xffffff);
      assert.ok(look.hazeBase > 0 && look.hazeBase < 0.05);
    }
    assert.notEqual(ZONE_ATMOSPHERE.pale_hollow.horizonRgb, ZONE_ATMOSPHERE.forest_basin.horizonRgb);
    assert.notEqual(ZONE_ATMOSPHERE.hollow_road.horizonRgb, ZONE_ATMOSPHERE.islet_fords.horizonRgb);
  });
});
