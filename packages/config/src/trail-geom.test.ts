import assert from "node:assert/strict";
import test from "node:test";
import { paleHollowOnTrail } from "./pale-hollow";
import { forestBasinOnTrail } from "./forest-basin";
import { nearTrailCorridor } from "./trail-geom";

test("pale hollow blocks tree scatter on a dirt corridor sample", () => {
  assert.equal(paleHollowOnTrail(50, 220), true);
  assert.equal(paleHollowOnTrail(50, 228), false);
});

test("the Hollow Way is the south run; the old sample sits off the meander", () => {
  // The generated South Run was a straight finger through (5, -90).
  // The walked Hollow Way bends east of that, between the south lip and the Ninefold Ring.
  assert.equal(forestBasinOnTrail(10.5, -93.5), true);
  assert.equal(forestBasinOnTrail(8, -86), true);
  assert.equal(forestBasinOnTrail(5, -90), false);
});

test("nearTrailCorridor matches half width", () => {
  const trails = [{ points: [{ x: 0, z: 0 }, { x: 0, z: 100 }] }];
  assert.equal(nearTrailCorridor(0, 50, trails, 3.3), true);
  assert.equal(nearTrailCorridor(2, 50, trails, 3.3), false);
});
