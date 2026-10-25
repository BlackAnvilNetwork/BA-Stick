import assert from "node:assert/strict";
import test from "node:test";
import { CP_SPAWN, coilPassFeet, coilPassSpawnWalkable } from "./coil-pass-world";

test("coil pass spawn feet sit on the climbing road", () => {
  assert.equal(coilPassSpawnWalkable(), true);
  const y = coilPassFeet(CP_SPAWN.x, CP_SPAWN.z);
  const road = 2 + 6 * (CP_SPAWN.z / 180);
  assert.ok(Math.abs(y - road) < 1e-9, `feet ${y} road ${road}`);
  assert.ok(y > 2 && y < 4, `feet ${y}`);
});
