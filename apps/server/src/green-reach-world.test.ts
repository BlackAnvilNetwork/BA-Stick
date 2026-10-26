import assert from "node:assert/strict";
import test from "node:test";
import { GR_SPAWN, greenReachFeet, greenReachSpawnWalkable } from "./green-reach-world";

test("green reach spawn feet match a walkable shore", () => {
  assert.equal(greenReachSpawnWalkable(), true);
  const y = greenReachFeet(GR_SPAWN.x, GR_SPAWN.z);
  assert.ok(y > 1 && y < 4, `feet ${y}`);
});
