import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_HUB,
  PH_HUB_REAR_WALL,
  ZONE_FIELDS,
  fieldClampMove,
  fieldGateAt,
  fieldNav,
  forestBasinWalkable,
  paleHollowBiome,
  paleHollowClampMove,
  paleHollowInHubRearWall,
  paleHollowInOpenWater,
  paleHollowOnBridge,
  paleHollowRiverCenterX,
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
  let deep: { x: number; z: number } | null = null;
  for (let x = 60; x <= 100 && !deep; x += 1) {
    for (let z = 5; z <= 40 && !deep; z += 1) {
      if (!forestBasinWalkable(x, z)) deep = { x, z };
    }
  }
  assert.ok(deep, "Stillmere has a blocked cell");
  let dest: { x: number; z: number } | null = null;
  for (let z = deep.z + 40; z <= deep.z + 80 && !dest; z += 1) {
    if (forestBasinWalkable(deep.x, z)) dest = { x: deep.x, z };
  }
  assert.ok(dest, "far shore is land");
  const jumped = fieldClampMove("forest_basin", deep.x, deep.z, dest.x, dest.z);
  assert.ok(jumped);
  assert.ok(Math.hypot(jumped.x - dest.x, jumped.z - dest.z) > 15, "must not teleport across the mere");
  assert.ok(Math.hypot(jumped.x - deep.x, jumped.z - deep.z) < 8, "unstuck stays on the near bank");
});

test("islet_fords clampMove does not teleport across the channel", () => {
  let deep: { x: number; z: number } | null = null;
  for (let x = 40; x <= 80 && !deep; x += 1) {
    for (let z = 12; z <= 24 && !deep; z += 1) {
      if (!ZONE_FIELDS.islet_fords!.walkable(x, z)) deep = { x, z };
    }
  }
  assert.ok(deep, "channel has a blocked cell");
  let dest: { x: number; z: number } | null = null;
  for (let z = -6; z <= 6 && !dest; z += 1) {
    if (ZONE_FIELDS.islet_fords!.walkable(deep.x, z)) dest = { x: deep.x, z };
  }
  assert.ok(dest, "islet is land");
  const jumped = fieldClampMove("islet_fords", deep.x, deep.z, dest.x, dest.z);
  assert.ok(jumped);
  assert.ok(Math.hypot(jumped.x - dest.x, jumped.z - dest.z) > 4, "must not teleport across the channel");
  assert.ok(Math.hypot(jumped.x - deep.x, jumped.z - deep.z) < 8, "unstuck stays on the near bank");
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
      const hit = fieldGateAt(field.id, x, z);
      assert.ok(hit && (hit.blocked || !hit.destZone), `${field.id}:${g.id} is a closed lip`);
      checked += 1;
    }
  }
  assert.ok(checked >= 4, "forest basin still has closed lips");
});

test("paleHollowWalkable does not punch a biome-river hole through dry grass", () => {
  let found = false;
  for (let z = 60; z <= 200 && !found; z += 2) {
    const cx = paleHollowRiverCenterX(z);
    for (const x of [cx + 10, cx - 10, cx + 14, cx - 14]) {
      if (paleHollowOnBridge(x, z) || paleHollowInOpenWater(x, z)) continue;
      if (paleHollowBiome(x, z) === "river") continue;
      assert.equal(paleHollowWalkable(x, z), true, `dry strip ${x},${z}`);
      found = true;
      break;
    }
  }
  assert.ok(found, "found a dry grass strip beside the meander");
});

test("fieldNav last metre keeps side clearance when the start is open", () => {
  const nav = fieldNav("pale_hollow");
  assert.ok(nav);
  const from = { x: PH_HUB.minX + 14, z: PH_HUB.minZ + 8 };
  const wallZ = PH_HUB_REAR_WALL.minZ + 0.2;
  const step = nav.clampMove(from.x, from.z, from.x, wallZ + 8);
  assert.ok(nav.walkable(step.x, step.z) || paleHollowWalkable(step.x, step.z));
  assert.ok(step.z < PH_HUB_REAR_WALL.minZ + 0.4, `last-metre slipped into the wall z=${step.z}`);
});
