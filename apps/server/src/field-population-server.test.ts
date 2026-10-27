// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import test from "node:test";
import { PH_HUB_SPAWN, ZONE_FIELDS, fieldMobDefs, fieldNpcDefs, paleHollowWalkable } from "@bellgrave/config";
import { steerMobStep } from "./mob-steer";
import { lookupMobDef } from "./shiny-hq-runtime";
import { chooseEntryPoint } from "./zone-entry";
import { PALE_HOLLOW_GROUND, inZone, mobGround, mobZoneKey } from "./zone-ground";

const FIELDS = Object.keys(ZONE_FIELDS);

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
  assert.equal(mobZoneKey(undefined), "pale_hollow");
  assert.equal(mobZoneKey("nowhere"), "pale_hollow");
  assert.equal(mobZoneKey("forest_basin"), "forest_basin");
});

test("every field mob spawns on its field's mob ground, outside NPC clearings, and respawns from its def", () => {
  for (const zone of FIELDS) {
    const g = mobGround(zone);
    assert.equal(g.zoneId, zone);
    for (const m of fieldMobDefs(zone)) {
      assert.ok(g.walkable(m.x, m.z), `${m.id} not walkable`);
      assert.ok(!g.inClearing(m.x, m.z), `${m.id} inside an NPC clearing`);
      assert.equal(lookupMobDef(m.id)?.id, m.id);
      assert.equal((lookupMobDef(m.id) as { zoneId?: string }).zoneId, zone);
    }
    for (const n of fieldNpcDefs(zone)) {
      assert.ok(g.walkable(n.x, n.z), `${n.id} not walkable`);
      assert.ok(g.inClearing(n.x, n.z), `${n.id} has no clearing`);
    }
  }
});

test("a player in one field sees no units from another field or Pale Hollow", () => {
  const units = [
    { id: "ph", zoneId: "pale_hollow" },
    ...FIELDS.map((z) => ({ id: z, zoneId: z })),
  ];
  for (const z of FIELDS) assert.deepEqual(inZone(units, z).map((u) => u.id), [z]);
  assert.deepEqual(inZone(units, "pale_hollow").map((u) => u.id), ["ph"]);
  assert.deepEqual(inZone(units, undefined).map((u) => u.id), ["ph"]);
});

test("field chase steps never end on unwalkable ground (no mob drift)", () => {
  const r = rng(7);
  for (const zone of FIELDS) {
    const g = mobGround(zone);
    for (const m of fieldMobDefs(zone)) {
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
        const b = ZONE_FIELDS[zone]!.bounds;
        assert.ok(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ, `${m.id} left bounds`);
      }
    }
  }
});

test("placeOnDry lands on walkable ground", () => {
  for (const zone of FIELDS) {
    const g = mobGround(zone);
    const r = rng(zone.length);
    for (const m of fieldMobDefs(zone).slice(0, 4)) {
      const p = g.placeOnDry(m.x + (r() - 0.5) * 40, m.z + (r() - 0.5) * 40);
      assert.ok(g.walkable(p.x, p.z), `${zone} ${p.x},${p.z}`);
    }
  }
});

test("char/enter: the server picks the entry point, never the client", () => {
  const fb = ZONE_FIELDS.forest_basin!;
  // Coming from elsewhere: the zone spawn, whatever the client asked for.
  const fresh = chooseEntryPoint({ zoneId: "pale_hollow", x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z, facing: 0 }, "forest_basin");
  assert.deepEqual(fresh, { zoneId: "forest_basin", x: fb.spawn.x, z: fb.spawn.z, facing: fb.spawn.facing });
  // Already there on walkable ground: stay at the saved spot.
  const saved = { zoneId: "forest_basin", x: fb.spawn.x, z: fb.spawn.z - 4, facing: 1 };
  assert.ok(fb.walkable(saved.x, saved.z));
  assert.deepEqual(chooseEntryPoint(saved, "forest_basin"), saved);
  // Saved spot not walkable: back to spawn.
  const bad = chooseEntryPoint({ zoneId: "forest_basin", x: 9999, z: 9999, facing: 0 }, "forest_basin");
  assert.equal(bad?.x, fb.spawn.x);
  // Pale Hollow from a field: the hub spawn.
  const home = chooseEntryPoint(saved, "pale_hollow");
  assert.deepEqual(home, { zoneId: "pale_hollow", x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z, facing: PH_HUB_SPAWN.facing });
  // Unknown zone: stay put.
  assert.equal(chooseEntryPoint(saved, "nowhere"), null);
  assert.equal(chooseEntryPoint(saved, undefined), null);
});
