import assert from "node:assert/strict";
import test from "node:test";
import { IF_SPAWN, isletFordsFeet, isletFordsSpawnWalkable } from "./islet-fords-world";

test("islet fords spawn feet match a walkable pad", () => {
  assert.equal(isletFordsSpawnWalkable(), true);
  const y = isletFordsFeet(IF_SPAWN.x, IF_SPAWN.z);
  assert.ok(y > 1 && y < 4, `feet ${y}`);
});
