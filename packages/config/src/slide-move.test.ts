import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_LAKE,
  PH_HUB,
  PH_HUB_REAR_WALL,
  ZONE_FIELDS,
  fieldClampMove,
  forestBasinWalkable,
  paleHollowClampMove,
  paleHollowInHubRearWall,
  paleHollowWalkable,
  slideMove,
} from "./index";

/** Camp props are authored at the origin and shifted with the hub pad. */
const OX = PH_HUB.minX + 14;
const OZ = PH_HUB.minZ + 6;

test("clamp does not teleport through the hub rear wall", () => {
  const inside = { x: OX, z: 8.4 + OZ };
  assert.equal(paleHollowWalkable(inside.x, inside.z), false);
  assert.equal(paleHollowInHubRearWall(inside.x, inside.z), true);
  const far = paleHollowClampMove(inside.x, inside.z, OX, 16 + OZ);
  assert.ok(paleHollowWalkable(far.x, far.z), "unstuck lands on walkable ground");
  assert.ok(!paleHollowInHubRearWall(far.x, far.z));
  assert.ok(far.z < PH_HUB_REAR_WALL.maxZ + 0.2, `tunneled to z=${far.z}`);
  assert.ok(Math.hypot(far.x - inside.x, far.z - (16 + OZ)) > 2, "must not snap to the far click");
});

test("field clampMove does not teleport across the mere", () => {
  const { x, z } = FB_LAKE;
  assert.equal(forestBasinWalkable(x, z), false);
  const destZ = z + 40;
  const jumped = fieldClampMove("forest_basin", x, z, x, destZ);
  assert.ok(jumped);
  assert.ok(Math.hypot(jumped.x - x, jumped.z - destZ) > 20, "must not teleport across the mere");
  assert.ok(Math.hypot(jumped.x - x, jumped.z - z) < 0.5, "no near bank: stay put");
});

test("axis slide follows a corridor wall instead of pinning", () => {
  const walkable = (x: number, z: number) => Math.abs(x) <= 1 && z >= 0 && z <= 20;
  const clamp = (x: number, z: number) => ({
    x: Math.max(-2, Math.min(2, x)),
    z: Math.max(0, Math.min(20, z)),
  });
  const pinned = slideMove(clamp, walkable, 0.8, 5, 3, 10);
  assert.ok(pinned.z > 8.5, `expected Z slide, got z=${pinned.z}`);
  assert.ok(pinned.x <= 1 + 1e-6, `must not push into the wall (x=${pinned.x})`);
});

test("blocked field gates stay unwalkable so they cannot strand a body", () => {
  let checked = 0;
  for (const field of Object.values(ZONE_FIELDS)) {
    for (const g of field.gates) {
      if (!g.blocked) continue;
      const x = (g.minX + g.maxX) / 2;
      const z = (g.minZ + g.maxZ) / 2;
      assert.equal(field.walkable(x, z), false, `${field.id}:${g.id} center must block`);
      checked += 1;
    }
  }
  assert.ok(checked >= 4, "forest basin still has closed lips");
});
