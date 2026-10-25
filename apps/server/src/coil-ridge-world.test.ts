import assert from "node:assert/strict";
import test from "node:test";
import { CR_SPAWN, coilRidgeFeet, coilRidgeSpawnWalkable } from "./coil-ridge-world";

test("coil ridge spawn feet sit on the dry tongue", () => {
  assert.equal(coilRidgeSpawnWalkable(), true);
  const y = coilRidgeFeet(CR_SPAWN.x, CR_SPAWN.z);
  assert.ok(Math.abs(y - 2.4) < 0.05, `feet ${y}`);
});
