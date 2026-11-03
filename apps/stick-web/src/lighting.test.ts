// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIGHT_MOODS, WORLD_ZONE_IDS, ZONE_MAP_LIGHTS, ZONE_MOOD_AREAS, zoneMapLights, zoneOrigin } from "@bellgrave/config";
import { applyWorldLighting, applyZoneMood, lightsFor, type LightingRenderer } from "./lighting";

function fake() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec = (fn: string) => (...args: unknown[]) => void calls.push({ fn, args });
  const r: LightingRenderer = {
    setLightMood: rec("setLightMood"),
    addMoodArea: rec("addMoodArea"),
    addLight: rec("addLight"),
    clearLighting: rec("clearLighting"),
  };
  return { r, calls };
}

describe("lighting wiring", () => {
  it("sends every area and map light in world metres, then the zone mood", () => {
    const { r, calls } = fake();
    applyWorldLighting(r, "hollow_road");
    assert.equal(calls[0].fn, "clearLighting");
    const areas = Object.values(ZONE_MOOD_AREAS).flat().length;
    const lights = WORLD_ZONE_IDS.reduce((n, id) => n + zoneMapLights(id).length, 0);
    assert.equal(calls.filter((c) => c.fn === "addMoodArea").length, areas);
    assert.equal(calls.filter((c) => c.fn === "addLight").length, lights);
    const last = calls.at(-1)!;
    assert.equal(last.fn, "setLightMood");
    assert.deepEqual(last.args.slice(0, 3), [...LIGHT_MOODS.seamCountry.ambient]);
    assert.equal(last.args[6], LIGHT_MOODS.seamCountry.night);
    assert.equal(last.args[7], true);
    const forge = ZONE_MAP_LIGHTS.pale_hollow[0];
    const o = zoneOrigin("pale_hollow");
    const sent = calls.find((c) => c.fn === "addLight")!.args;
    assert.equal(sent[0], forge.x + o.x);
    assert.equal(sent[2], forge.z + o.z);
  });

  it("an unknown zone or the blank map gets daylight", () => {
    const { r, calls } = fake();
    applyZoneMood(r, "forest_basin", false);
    applyZoneMood(r, undefined, false);
    for (const c of calls) assert.deepEqual(c.args.slice(0, 5), [1, 1, 1, 0, 0]);
  });

  it("?lights=0 turns the pass off", () => {
    assert.equal(lightsFor(""), true);
    assert.equal(lightsFor("?lights=0"), false);
  });
});
