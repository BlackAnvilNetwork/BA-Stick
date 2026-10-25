import assert from "node:assert/strict";
import test from "node:test";
import { RW_SPAWN, ringWardFeet, ringWardSpawnWalkable } from "./ring-ward-world";

test("ring ward spawn feet match a walkable street", () => {
  assert.equal(ringWardSpawnWalkable(), true);
  const y = ringWardFeet(RW_SPAWN.x, RW_SPAWN.z);
  assert.ok(y > 1 && y < 4, `feet ${y}`);
});
