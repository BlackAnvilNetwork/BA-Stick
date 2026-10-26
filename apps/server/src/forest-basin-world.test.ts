import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_LAKE,
  FB_SPAWN,
  FOREST_BASIN_BOUNDS,
  forestBasinClamp,
  forestBasinClampMove,
  forestBasinWalkable,
} from "@bellgrave/config";
import { parseClientMessage } from "@bellgrave/protocol";
import { paleHollowFindPath } from "./nav-grid";
import { FB_SPAWN as SPAWN, forestBasinFeet, forestBasinSpawnWalkable } from "./forest-basin-world";

test("forest basin spawn feet match a walkable pad", () => {
  assert.equal(forestBasinSpawnWalkable(), true);
  const y = forestBasinFeet(SPAWN.x, SPAWN.z);
  assert.ok(y > 1 && y < 4, `feet ${y}`);
});

test("forest basin clamp stops at open water", () => {
  const shore = forestBasinClampMove(FB_LAKE.x + FB_LAKE.r + 6, FB_LAKE.z, FB_LAKE.x, FB_LAKE.z);
  assert.equal(forestBasinWalkable(shore.x, shore.z), true);
  assert.ok(Math.hypot(shore.x - FB_LAKE.x, shore.z - FB_LAKE.z) > FB_LAKE.r - 1);
});

test("a path from spur camp stays on the basin mask", () => {
  const path = paleHollowFindPath(FB_SPAWN.x, FB_SPAWN.z, 20, 10, {
    bounds: FOREST_BASIN_BOUNDS,
    walkable: forestBasinWalkable,
    clamp: forestBasinClamp,
  });
  assert.ok(path.length > 0);
  for (const step of path) assert.equal(forestBasinWalkable(step.x, step.z), true);
});

test("char/enter keeps a forest basin placement", () => {
  const msg = parseClientMessage({ type: "char/enter", characterId: "c_test", zone: "forest_basin", x: 128, z: 28 });
  assert.ok(msg && msg.type === "char/enter");
  if (msg?.type !== "char/enter") return;
  assert.equal(msg.zone, "forest_basin");
  assert.equal(msg.x, 128);
  assert.equal(msg.z, 28);
});
