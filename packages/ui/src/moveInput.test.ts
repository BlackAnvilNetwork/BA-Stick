import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  clearKeyboardMove,
  clearVirtualStick,
  getKeyboardMoveKeys,
  getMoveKeys,
  getStickAxes,
  setKeyboardMoveKey,
  setVirtualStick,
  setVirtualStickCaptured,
  virtualStickHeld,
  virtualStickReleasedRecently,
  markVirtualStickReleased,
} from "./moveInput";

afterEach(() => {
  clearKeyboardMove();
  clearVirtualStick();
});

test("iso stick-right sets D, not A (do not flip setVirtualStick)", () => {
  setVirtualStick(1, 0);
  const keys = getMoveKeys();
  assert.equal(keys.d, true);
  assert.equal(keys.a, false);
  assert.equal(keys.w, false);
  assert.equal(keys.s, false);
});

test("iso stick-up sets W", () => {
  setVirtualStick(0, 1);
  const keys = getMoveKeys();
  assert.equal(keys.w, true);
  assert.equal(keys.s, false);
});

test("keyboard W then stick S cancels W and keeps reverse", () => {
  setKeyboardMoveKey("w", true);
  setVirtualStick(0, -1);
  const keys = getMoveKeys();
  assert.equal(keys.w, false);
  assert.equal(keys.s, true);
});

test("opposing keyboard W+S cancel when the stick is idle", () => {
  setKeyboardMoveKey("w", true);
  setKeyboardMoveKey("s", true);
  const keys = getMoveKeys();
  assert.equal(keys.w, false);
  assert.equal(keys.s, false);
});

test("keyboard WASD is unchanged without a stick", () => {
  setKeyboardMoveKey("w", true);
  setKeyboardMoveKey("d", true);
  const keys = getMoveKeys();
  assert.deepEqual(keys, { w: true, a: false, s: false, d: true });
  assert.deepEqual(getKeyboardMoveKeys(), { w: true, a: false, s: false, d: true });
});

test("clickHoldKeys source is keyboard-only: stick D is not a leftover key", () => {
  setVirtualStick(1, 0);
  const k = getKeyboardMoveKeys();
  assert.deepEqual(k, { w: false, a: false, s: false, d: false });
  assert.equal(getMoveKeys().d, true);
});

test("virtualStickHeld is true while captured even in the deadzone", () => {
  setVirtualStickCaptured(true);
  setVirtualStick(0, 0);
  assert.equal(getStickAxes(), null);
  assert.equal(virtualStickHeld(), true);
  setVirtualStickCaptured(false);
  assert.equal(virtualStickHeld(), false);
});

test("markVirtualStickReleased is live until clearVirtualStick", () => {
  assert.equal(virtualStickReleasedRecently(), false);
  markVirtualStickReleased();
  assert.equal(virtualStickReleasedRecently(), true);
});
