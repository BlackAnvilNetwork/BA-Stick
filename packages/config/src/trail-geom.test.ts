import assert from "node:assert/strict";
import test from "node:test";
import { paleHollowOnTrail } from "./pale-hollow";
import { forestBasinOnTrail, forestBasinTrails } from "./forest-basin";
import { nearTrailCorridor } from "./trail-geom";

test("pale hollow blocks tree scatter on a dirt corridor sample", () => {
  assert.equal(paleHollowOnTrail(50, 220), true);
  assert.equal(paleHollowOnTrail(50, 228), false);
});

test("forest basin south run is a trail corridor", () => {
  // The Hollow Way leaves Kettle Hollow northward; sample its line where it
  // crosses z = -90 rather than a fixed x (the road was re-routed east).
  const way = forestBasinTrails().find((t) => t.id === "hollow-way");
  assert.ok(way, "the Hollow Way exists");
  let hit: number | null = null;
  for (let i = 1; i < way.points.length && hit == null; i++) {
    const a = way.points[i - 1]!, b = way.points[i]!;
    if ((a.z - -90) * (b.z - -90) <= 0 && a.z !== b.z) hit = a.x + ((-90 - a.z) / (b.z - a.z)) * (b.x - a.x);
  }
  assert.ok(hit != null, "the Hollow Way crosses z = -90");
  assert.equal(forestBasinOnTrail(hit, -90), true);
  assert.equal(forestBasinOnTrail(hit + 12, -90), false, "and it is a corridor, not the whole run");
});

test("nearTrailCorridor matches half width", () => {
  const trails = [{ points: [{ x: 0, z: 0 }, { x: 0, z: 100 }] }];
  assert.equal(nearTrailCorridor(0, 50, trails, 3.3), true);
  assert.equal(nearTrailCorridor(2, 50, trails, 3.3), false);
});
