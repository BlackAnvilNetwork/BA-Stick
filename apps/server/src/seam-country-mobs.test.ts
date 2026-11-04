// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import test from "node:test";
import {
  SEAM_COUNTRY_ZONES,
  paleHollowWalkable,
  seamCountryCamps,
  seamCountryLandmarks,
  seamCountryMobs,
  seamCountryNpcs,
} from "@bellgrave/config";
import { steerMobStep } from "./mob-steer";
import { lookupMobDef } from "./shiny-hq-runtime";
import { PALE_HOLLOW_GROUND, mobGround } from "./zone-ground";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("Pale Hollow ground is unchanged and is the fallback", () => {
  assert.equal(mobGround(undefined), PALE_HOLLOW_GROUND);
  assert.equal(mobGround("pale_hollow"), PALE_HOLLOW_GROUND);
  assert.equal(PALE_HOLLOW_GROUND.walkable, paleHollowWalkable);
});

test("every Seam Country mob spawns on its field's mob ground, outside camp clearings", () => {
  for (const zone of SEAM_COUNTRY_ZONES) {
    const g = mobGround(zone);
    assert.equal(g.zoneId, zone);
    const mobs = seamCountryMobs(zone);
    assert.ok(mobs.length > 0, zone);
    for (const m of mobs) {
      assert.ok(g.walkable(m.x, m.z), `${m.id} not walkable`);
      assert.ok(!g.inClearing(m.x, m.z), `${m.id} inside a camp`);
      assert.equal(lookupMobDef(m.id)?.id, m.id);
      assert.equal(lookupMobDef(`${m.id}-clone-2`)?.id, m.id);
    }
    for (const c of seamCountryCamps(zone)) assert.ok(g.inClearing(c.x, c.z), c.id);
    for (const n of seamCountryNpcs(zone)) assert.ok(g.walkable(n.x, n.z), `${n.id} not walkable`);
    assert.ok(seamCountryLandmarks(zone).length > 0, `${zone} landmarks`);
  }
});

test("field chase steps never end on unwalkable ground", () => {
  const r = rng(7);
  for (const zone of SEAM_COUNTRY_ZONES) {
    const g = mobGround(zone);
    for (const m of seamCountryMobs(zone)) {
      let x = m.x;
      let z = m.z;
      const tx = m.x + (r() - 0.5) * 30;
      const tz = m.z + (r() - 0.5) * 30;
      for (let i = 0; i < 60; i++) {
        const s = steerMobStep(x, z, tx, tz, 0.22, g);
        if (!s.moved) break;
        x = s.x;
        z = s.z;
        assert.ok(g.walkable(x, z), `${m.id} stepped off ground at ${x.toFixed(2)},${z.toFixed(2)}`);
      }
    }
  }
});

test("placeOnDry lands on walkable ground", () => {
  for (const zone of SEAM_COUNTRY_ZONES) {
    const g = mobGround(zone);
    const r = rng(zone.length);
    for (const m of seamCountryMobs(zone).slice(0, 4)) {
      const p = g.placeOnDry(m.x + (r() - 0.5) * 40, m.z + (r() - 0.5) * 40);
      assert.ok(g.walkable(p.x, p.z), `${zone} ${p.x},${p.z}`);
    }
  }
});
