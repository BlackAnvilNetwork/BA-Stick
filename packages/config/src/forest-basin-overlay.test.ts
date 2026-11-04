import assert from "node:assert/strict";
import test from "node:test";
import { forestBasinStandHeight } from "./forest-basin";
import {
  applyForestBasinRaise,
  effectiveForestBasinHeight,
  forestBasinCanUndo,
  resetForestBasinOverlay,
  undoForestBasinEdit,
} from "./forest-basin-overlay";

// Kettle Hollow camp floor: dry, sculpted ground.
const X = 12;
const Z = -100;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.011, `${a} vs ${b}`);

test("forest basin overlay raises height at a brush point", () => {
  resetForestBasinOverlay();
  const base = forestBasinStandHeight(X, Z);
  near(effectiveForestBasinHeight(X, Z), base);
  const cells = applyForestBasinRaise(X, Z, 2, 0.5);
  assert.ok(cells.length > 0);
  near(effectiveForestBasinHeight(X, Z), base + 0.5);
});

test("forest basin overlay undo restores prior height", () => {
  resetForestBasinOverlay();
  const base = forestBasinStandHeight(X, Z);
  applyForestBasinRaise(X, Z, 2, 0.5);
  near(effectiveForestBasinHeight(X, Z), base + 0.5);
  assert.equal(forestBasinCanUndo(), true);
  const back = undoForestBasinEdit();
  assert.ok(back && back.length > 0);
  near(effectiveForestBasinHeight(X, Z), base);
  assert.equal(forestBasinCanUndo(), false);
});
