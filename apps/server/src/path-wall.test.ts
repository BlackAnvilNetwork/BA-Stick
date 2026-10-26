import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_HUB,
  PH_HUB_REAR_WALL,
  PH_HUB_SPAWN,
  paleHollowClampMove,
  paleHollowInHubRearWall,
  paleHollowWalkable,
} from "@bellgrave/config";
import { steerMobStep } from "./mob-steer";
import { paleHollowFindPath } from "./nav-grid";

/** Camp props are authored at the origin and shifted with the hub pad. */
const OX = PH_HUB.minX + 14;
const OZ = PH_HUB.minZ + 6;

/** Visual HubRearRockWall block centers in PaleHollowMap (x, z). */
const WALL_CENTERS: readonly (readonly [number, number])[] = [
  [-7.5, 8.6],
  [-5.2, 9.1],
  [-2.4, 9.4],
  [0.3, 9.5],
  [3.0, 9.2],
  [5.6, 8.7],
  [7.8, 8.1],
  [-6.4, 8.2],
  [-3.8, 8.5],
  [-0.8, 8.6],
  [2.0, 8.5],
  [4.5, 8.3],
  [6.8, 7.9],
];

function segmentClear(ax: number, az: number, bx: number, bz: number): boolean {
  const c = paleHollowClampMove(ax, az, bx, bz);
  return Math.hypot(c.x - bx, c.z - bz) < 0.25 && paleHollowWalkable(bx, bz);
}

test("rear rock wall blocks its mesh and leaves side gaps (#121)", () => {
  for (const [x, z] of WALL_CENTERS) {
    const wx = x + OX;
    const wz = z + OZ;
    assert.equal(paleHollowWalkable(wx, wz), false, `wall center ${wx},${wz} should block`);
    assert.equal(paleHollowInHubRearWall(wx, wz), true);
  }
  assert.equal(paleHollowWalkable(PH_HUB_SPAWN.x, PH_HUB_SPAWN.z), true, "camp spawn");
  assert.equal(paleHollowWalkable(OX, 14 + OZ), true, "north of the cliff");
  // West and east of the cliff, still inside the hub pad.
  assert.equal(paleHollowWalkable(-12 + OX, 8.5 + OZ), true, "west gap");
  assert.equal(paleHollowWalkable(12 + OX, 8.5 + OZ), true, "east gap");
  assert.equal(paleHollowWalkable(OX, 6 + OZ), true, "camp interior in front of the cliff");
});

test("a straight-line slide cannot cross the rear wall (#120)", () => {
  const blocked = paleHollowClampMove(OX, 2 + OZ, OX, 20 + OZ);
  assert.ok(paleHollowWalkable(blocked.x, blocked.z));
  assert.ok(blocked.z < PH_HUB_REAR_WALL.minZ + 0.05, `slid to z=${blocked.z}`);
  assert.ok(!paleHollowInHubRearWall(blocked.x, blocked.z));

  let x = OX;
  let z = 2 + OZ;
  for (let i = 0; i < 100; i++) {
    const dx = OX - x;
    const dz = 20 + OZ - z;
    const d = Math.hypot(dx, dz) || 1;
    const n = paleHollowClampMove(x, z, x + (dx / d) * 0.25, z + (dz / d) * 0.25);
    assert.ok(!paleHollowInHubRearWall(n.x, n.z));
    assert.ok(paleHollowWalkable(n.x, n.z));
    if (Math.hypot(n.x - x, n.z - z) < 1e-4) break;
    x = n.x;
    z = n.z;
  }
  assert.ok(z < PH_HUB_REAR_WALL.minZ + 0.05, `stepped through to z=${z}`);
});

test("click path goes around the rear wall (#120)", () => {
  const path = paleHollowFindPath(OX, 2 + OZ, OX, 16 + OZ);
  assert.ok(path.length >= 2, "expected a detour, not a single blocked slide");
  const end = path[path.length - 1]!;
  assert.ok(Math.hypot(end.x - OX, end.z - (16 + OZ)) < 1.25, `ended at ${end.x},${end.z}`);
  assert.ok(
    path.some((p) => p.x < PH_HUB_REAR_WALL.minX + 0.05 || p.x > PH_HUB_REAR_WALL.maxX - 0.05),
    "path should use a side gap",
  );

  let x = OX;
  let z = 2 + OZ;
  for (let i = 0; i < path.length; i++) {
    const g = path[i]!;
    assert.ok(segmentClear(x, z, g.x, g.z), `segment ${i} clips collision`);
    const dist = Math.hypot(g.x - x, g.z - z);
    const steps = Math.max(1, Math.ceil(dist / 0.3));
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const sx = x + (g.x - x) * u;
      const sz = z + (g.z - z) * u;
      assert.ok(!paleHollowInHubRearWall(sx, sz), `sample entered the wall at ${sx},${sz}`);
      assert.ok(paleHollowWalkable(sx, sz));
    }
    x = g.x;
    z = g.z;
  }
});

test("unreachable click stops at the closest reachable cell (#120)", () => {
  // Inside the cliff. The pathfinder must not append this point or walk through.
  const path = paleHollowFindPath(OX, 2 + OZ, OX, 9 + OZ);
  assert.ok(path.length >= 1);
  const end = path[path.length - 1]!;
  assert.ok(paleHollowWalkable(end.x, end.z));
  assert.ok(!paleHollowInHubRearWall(end.x, end.z));
  assert.ok(end.z < PH_HUB_REAR_WALL.minZ, `went past the wall to z=${end.z}`);
  const dist = Math.hypot(end.x - OX, end.z - (9 + OZ));
  assert.ok(dist < 2.6, `not the near face (dist ${dist})`);
  assert.ok(dist < Math.hypot(12, 0), "side gap is farther than the near face");
  for (const p of path) assert.ok(!paleHollowInHubRearWall(p.x, p.z));
});

test("the camp stays enterable around the cliff (#121)", () => {
  const into = paleHollowFindPath(OX, 16 + OZ, PH_HUB_SPAWN.x, PH_HUB_SPAWN.z);
  const end = into[into.length - 1];
  assert.ok(end, "no path back into camp");
  assert.ok(Math.hypot(end.x - PH_HUB_SPAWN.x, end.z - PH_HUB_SPAWN.z) < 1.25);
  let x = OX;
  let z = 16 + OZ;
  for (const g of into) {
    assert.ok(segmentClear(x, z, g.x, g.z));
    x = g.x;
    z = g.z;
  }
});

test("mob chase steps do not tunnel the rear wall (#120)", () => {
  let x = OX;
  let z = 5 + OZ;
  for (let i = 0; i < 250; i++) {
    const s = steerMobStep(x, z, OX, 18 + OZ, 0.2);
    if (s.moved) {
      assert.ok(paleHollowWalkable(s.x, s.z), `mob entered ${s.x},${s.z}`);
      assert.ok(!paleHollowInHubRearWall(s.x, s.z));
      x = s.x;
      z = s.z;
    }
  }
  const tunneled = z > PH_HUB_REAR_WALL.maxZ && x >= PH_HUB_REAR_WALL.minX && x <= PH_HUB_REAR_WALL.maxX;
  assert.equal(tunneled, false, `mob crossed the cliff center to ${x},${z}`);
});
