import { test } from "node:test";
import assert from "node:assert/strict";
import { PALE_HOLLOW_BOUNDS, PH_ROAD_NAMES, paleHollowTrails } from "@bellgrave/config";
import { mapDataFor } from "./minimap";

test("named Pale Hollow roads appear on the minimap", () => {
  const d = mapDataFor("pale_hollow")!;
  const namedInConfig = new Set(Object.keys(PH_ROAD_NAMES));
  assert.equal(d.roads.length, paleHollowTrails().length);
  const named = paleHollowTrails().filter((t, i) => d.roads[i]!.name !== "").map((t) => t.id);
  assert.deepEqual(new Set(named), namedInConfig);
});

test("minimap labels sit inside the playable bounds", () => {
  const d = mapDataFor("pale_hollow")!;
  assert.ok(d.labels.length >= 10);
  for (const l of d.labels) {
    assert.ok(l.x >= PALE_HOLLOW_BOUNDS.minX && l.x <= PALE_HOLLOW_BOUNDS.maxX && l.z >= PALE_HOLLOW_BOUNDS.minZ && l.z <= PALE_HOLLOW_BOUNDS.maxZ, l.text);
  }
  assert.equal(mapDataFor(null), null);
});
