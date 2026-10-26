import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_ZONE_IDS, zoneOrigin, zoneWorldBounds } from "@bellgrave/config";

test("every zone has a world origin and the dwellings stay put", () => {
  assert.deepEqual(zoneOrigin("pale_hollow"), { x: 0, z: 0 });
  assert.deepEqual(zoneOrigin("hollow_road"), { x: 0, z: 500 });
  assert.equal(WORLD_ZONE_IDS.length, 9);
  for (const id of WORLD_ZONE_IDS) {
    const b = zoneWorldBounds(id);
    assert.ok(b, id);
    assert.ok(b.maxX > b.minX && b.maxZ > b.minZ, id);
  }
});

test("zone worlds touch along north and do not cover each other", () => {
  const boxes = WORLD_ZONE_IDS.map((id) => zoneWorldBounds(id)!);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
      assert.equal(overlap, false, `${a.id} covers ${b.id}`);
    }
  }
  for (let i = 1; i < boxes.length; i++) {
    assert.equal(boxes[i].minZ, boxes[i - 1].maxZ, boxes[i].id);
  }
});
