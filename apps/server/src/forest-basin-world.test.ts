import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FB_CAMP,
  FB_SPAWN,
  forestBasinClampMove,
  forestBasinWalkable,
} from "@bellgrave/config";
import { parseClientMessage } from "@bellgrave/protocol";
import { paleHollowFindPath } from "./nav-grid";
import { FB_SPAWN as SPAWN, forestBasinFeet, forestBasinSpawnWalkable } from "./forest-basin-world";

describe("forest basin world", () => {
  it("spawn is walkable on the Kettle Hollow camp floor", () => {
    assert.equal(forestBasinSpawnWalkable(), true);
    const y = forestBasinFeet(SPAWN.x, SPAWN.z);
    assert.ok(Math.abs(y - FB_CAMP.floorY) < 0.2, `spawn y ${y} vs camp ${FB_CAMP.floorY}`);
  });

  it("clamp stops at the pad edge", () => {
    const blocked = forestBasinClampMove(-150, 0, -200, 0);
    assert.ok(blocked.x > -160);
    assert.equal(forestBasinWalkable(blocked.x, blocked.z), true);
  });

  it("pathfinds across the blank pad", () => {
    const path = paleHollowFindPath(FB_SPAWN.x, FB_SPAWN.z, 20, 10, {
      bounds: { minX: -160, maxX: 160, minZ: -160, maxZ: 160 },
      walkable: forestBasinWalkable,
      clamp: (x, z) => ({ x, z }),
      clampMove: forestBasinClampMove,
    });
    assert.ok(path.length > 0);
    for (const step of path) assert.equal(forestBasinWalkable(step.x, step.z), true);
  });

  it("accepts char/enter forest_basin", () => {
    const msg = parseClientMessage({ type: "char/enter", characterId: "c_test", zone: "forest_basin", x: 128, z: 28 });
    assert.ok(msg);
    assert.equal(msg.type, "char/enter");
    assert.equal(msg.zone, "forest_basin");
  });
});
