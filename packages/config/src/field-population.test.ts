// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import test from "node:test";
import {
  BASELINE_FIELD_PLANS,
  baseline,
  baselineSpotProblem,
  fieldMobDefById,
  fieldMobDefs,
  fieldNpcDefs,
  registerFieldPopulation,
  unregisterFieldPopulation,
} from "./field-population";
import { ZONE_FIELDS } from "./zone-fields";

const FIELDS = Object.keys(ZONE_FIELDS);

test("every field has a baseline plan", () => {
  for (const id of FIELDS) assert.ok(BASELINE_FIELD_PLANS[id], `${id} has no plan`);
});

test("every field serves monsters and an NPC on walkable, reachable ground clear of gates", () => {
  for (const id of FIELDS) {
    const mobs = fieldMobDefs(id);
    const npcs = fieldNpcDefs(id);
    assert.ok(mobs.length >= 1, `${id}: no mobs`);
    assert.ok(npcs.length >= 1, `${id}: no NPCs`);
    for (const u of [...mobs, ...npcs]) {
      assert.equal(u.zoneId, id);
      assert.equal(baselineSpotProblem(id, u), null, `${u.id} at ${u.x},${u.z}: ${baselineSpotProblem(id, u)}`);
    }
  }
});

test("field mob levels respect the field's open-gate soft levels", () => {
  for (const id of FIELDS) {
    const f = ZONE_FIELDS[id]!;
    const soft = f.gates
      .filter((g) => !g.blocked)
      .map((g) => (g as { softLevel?: number }).softLevel)
      .filter((n): n is number => typeof n === "number");
    const floor = soft.length ? Math.min(...soft) : 1;
    for (const m of fieldMobDefs(id)) assert.ok(m.level >= floor, `${m.id} L${m.level} < ${floor}`);
  }
});

test("ids are unique, names are proper names, and lookups find every mob", () => {
  const ids = [...fieldMobDefs(), ...fieldNpcDefs()].map((u) => u.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const u of [...fieldMobDefs(), ...fieldNpcDefs()]) {
    assert.match(u.name, /^[A-Z]/, u.id);
    assert.doesNotMatch(u.name, /[_-]/, `${u.id} name looks like a slug: ${u.name}`);
  }
  for (const m of fieldMobDefs()) assert.equal(fieldMobDefById(m.id)?.id, m.id);
});

test("baseline is deterministic", () => {
  const a = JSON.stringify(baseline("ring_ward"));
  assert.equal(JSON.stringify(baseline("ring_ward")), a);
});

test("a registered content pack replaces the baseline for its zones only", () => {
  const before = fieldMobDefs("spur_road").length;
  const tmpl = fieldMobDefs("hollow_road")[0]!;
  registerFieldPopulation({
    id: "test-pack",
    zones: ["hollow_road"],
    mobs: () => [{ ...tmpl, id: "hr-test-1", name: "Test Hound" }],
    npcs: () => [],
  });
  try {
    assert.deepEqual(fieldMobDefs("hollow_road").map((m) => m.id), ["hr-test-1"]);
    assert.equal(fieldNpcDefs("hollow_road").length, 0);
    assert.equal(fieldMobDefs("spur_road").length, before);
  } finally {
    unregisterFieldPopulation("test-pack");
  }
  assert.ok(fieldMobDefs("hollow_road").length > 1);
});
