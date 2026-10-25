import assert from "node:assert/strict";
import test from "node:test";
import { SR_SPAWN, spurRoadFeet, spurRoadSpawnWalkable } from "./spur-road-world";

test("spur road spawn feet match a walkable pad", () => {
  assert.equal(spurRoadSpawnWalkable(), true);
  const y = spurRoadFeet(SR_SPAWN.x, SR_SPAWN.z);
  assert.ok(y > 1 && y < 4, `feet ${y}`);
});
