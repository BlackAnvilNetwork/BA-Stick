import assert from "node:assert/strict";
import test from "node:test";
import { paleHollowOnTrail } from "./pale-hollow";
import { forestBasinOnTrail } from "./forest-basin";
import { nearTrailCorridor } from "./trail-geom";

test("pale hollow blocks tree scatter on a dirt corridor sample", () => {
  assert.equal(paleHollowOnTrail(50, 220), true);
  assert.equal(paleHollowOnTrail(50, 228), false);
});

test("forest basin south run is a trail corridor", () => {
  assert.equal(forestBasinOnTrail(5, -90), true);
});

test("nearTrailCorridor matches half width", () => {
  const trails = [{ points: [{ x: 0, z: 0 }, { x: 0, z: 100 }] }];
  assert.equal(nearTrailCorridor(0, 50, trails, 3.3), true);
  assert.equal(nearTrailCorridor(2, 50, trails, 3.3), false);
});
