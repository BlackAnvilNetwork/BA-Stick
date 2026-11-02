import assert from "node:assert/strict";
import test from "node:test";
import {
  applyForestBasinRaise,
  effectiveForestBasinHeight,
  forestBasinCanUndo,
  resetForestBasinOverlay,
  undoForestBasinEdit,
} from "./forest-basin-overlay";

test("forest basin overlay raises height at a brush point", () => {
  resetForestBasinOverlay();
  assert.equal(effectiveForestBasinHeight(0, 0), 2);
  const cells = applyForestBasinRaise(0, 0, 2, 0.5);
  assert.ok(cells.length > 0);
  assert.equal(effectiveForestBasinHeight(0, 0), 2.5);
});

test("forest basin overlay undo restores prior height", () => {
  resetForestBasinOverlay();
  applyForestBasinRaise(0, 0, 2, 0.5);
  assert.equal(effectiveForestBasinHeight(0, 0), 2.5);
  assert.equal(forestBasinCanUndo(), true);
  const back = undoForestBasinEdit();
  assert.ok(back && back.length > 0);
  assert.equal(effectiveForestBasinHeight(0, 0), 2);
  assert.equal(forestBasinCanUndo(), false);
});
