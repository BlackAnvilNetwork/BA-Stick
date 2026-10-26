import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_ASH_ROAD,
  ZONE_FIELDS,
  ZONE_LINKS,
  applyTravel,
  fieldById,
  paleHollowInOpenWater,
  paleHollowWalkable,
  travelAt,
} from "@bellgrave/config";
import { BIOMES } from "../scripts/bake-zones";

test("every travel link arrives on dry ground and does not bounce", () => {
  for (const link of ZONE_LINKS) {
    if (link.to === "pale_hollow") {
      assert.equal(paleHollowWalkable(link.spawn.x, link.spawn.z), true, link.id);
      assert.equal(paleHollowInOpenWater(link.spawn.x, link.spawn.z), false, link.id);
    } else {
      const dest = fieldById(link.to);
      assert.ok(dest, link.id);
      assert.equal(dest.walkable(link.spawn.x, link.spawn.z), true, link.id);
      assert.equal(dest.openWater(link.spawn.x, link.spawn.z), false, link.id);
    }
    assert.equal(travelAt(link.to, link.spawn.x, link.spawn.z), null, `${link.id} bounce`);
    const src = ZONE_FIELDS[link.from];
    const gate = link.from === "pale_hollow"
      ? PH_ASH_ROAD
      : src?.gates.find((g) => g.id === link.gate);
    assert.ok(gate, link.id);
    const x = (gate.minX + gate.maxX) / 2;
    const z = (gate.minZ + gate.maxZ) / 2;
    const walk = src ? src.walkable(x, z) : paleHollowWalkable(x, z);
    assert.equal(walk, true, `${link.id} gate`);
    const body = { zoneId: link.from, x, z, facing: 0 };
    assert.equal(applyTravel(body), true, link.id);
    assert.equal(body.zoneId, link.to);
    assert.equal(body.x, link.spawn.x);
    assert.equal(body.z, link.spawn.z);
    assert.equal(applyTravel(body), false, `${link.id} return`);
  }
});

test("field biomes stay inside the shared palette", () => {
  for (const field of Object.values(ZONE_FIELDS)) {
    const name = field.biome(field.spawn.x, field.spawn.z);
    assert.ok((BIOMES as readonly string[]).includes(name), `${field.id} ${name}`);
  }
});
