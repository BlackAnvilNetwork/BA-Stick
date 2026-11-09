// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONE_ATMOSPHERE, ZONE_ATMOSPHERE_AREAS, zoneAtmosphere, zoneOrigin } from "@bellgrave/config";
import { applyWorldAtmosphere, applyZoneAtmosphere, type AtmosphereRenderer } from "./atmosphere";

function fake() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec = (fn: string) => (...args: unknown[]) => void calls.push({ fn, args });
  const r: AtmosphereRenderer = {
    setZoneAtmosphere: rec("setZoneAtmosphere"),
    addAtmosphereArea: rec("addAtmosphereArea"),
    clearAtmosphereAreas: rec("clearAtmosphereAreas"),
    setWeatherHaze: rec("setWeatherHaze"),
  };
  return { r, calls };
}

describe("atmosphere wiring", () => {
  it("places aerial areas in world metres then the active zone look", () => {
    const { r, calls } = fake();
    applyWorldAtmosphere(r, "hollow_road");
    assert.equal(calls[0].fn, "clearAtmosphereAreas");
    const areas = Object.values(ZONE_ATMOSPHERE_AREAS).flat().length;
    assert.equal(calls.filter((c) => c.fn === "addAtmosphereArea").length, areas);
    const look = calls.find((c) => c.fn === "setZoneAtmosphere")!;
    assert.deepEqual(look.args.slice(0, 3), [
      ZONE_ATMOSPHERE.hollow_road.hazeBase,
      ZONE_ATMOSPHERE.hollow_road.valleyBeta,
      ZONE_ATMOSPHERE.hollow_road.scaleH,
    ]);
    const haze = calls.find((c) => c.fn === "setWeatherHaze")!;
    assert.equal(haze.args[0], false);
    const lake = ZONE_ATMOSPHERE_AREAS.pale_hollow[0];
    const o = zoneOrigin("pale_hollow");
    const sent = calls.find((c) => c.fn === "addAtmosphereArea")!;
    assert.equal(sent.args[0], lake.x + o.x);
    assert.equal(sent.args[1], lake.z + o.z);
  });

  it("Pale Hollow weather multiplies haze; other zones do not", () => {
    const ph = fake();
    applyZoneAtmosphere(ph.r, "pale_hollow");
    assert.equal(ph.calls.find((c) => c.fn === "setWeatherHaze")!.args[0], true);
    assert.deepEqual(ph.calls[0].args.slice(0, 3), [
      zoneAtmosphere("pale_hollow").hazeBase,
      zoneAtmosphere("pale_hollow").valleyBeta,
      zoneAtmosphere("pale_hollow").scaleH,
    ]);
    const basin = fake();
    applyZoneAtmosphere(basin.r, "forest_basin");
    assert.equal(basin.calls.find((c) => c.fn === "setWeatherHaze")!.args[0], false);
  });
});
