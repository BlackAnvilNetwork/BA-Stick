import assert from "node:assert/strict";
import { test } from "node:test";
import { camModeFromDataset, cameraKey, lookAxes } from "./camera";

test("M is the minimap, not a camera key", () => {
  assert.equal(cameraKey("KeyM"), null);
  assert.equal(cameraKey("KeyV"), "cycle");
  assert.equal(cameraKey("Numpad5"), "cycle");
  assert.equal(cameraKey("NumpadDecimal"), "toggle");
  assert.equal(cameraKey("Digit1"), null);
});

test("numpad look is off in iso and in mouse mode", () => {
  const held = { left: true, right: false, up: true, down: false };
  assert.deepEqual(lookAxes(held, "numpad", "iso"), { yaw: 0, pitch: 0 });
  assert.deepEqual(lookAxes(held, "mouse", "tp"), { yaw: 0, pitch: 0 });
  assert.deepEqual(lookAxes(held, "numpad", "fp"), { yaw: -1, pitch: -1 });
});

test("legacy 3d dataset is third person", () => {
  assert.equal(camModeFromDataset("3d"), "tp");
  assert.equal(camModeFromDataset("fp"), "fp");
  assert.equal(camModeFromDataset(undefined), "iso");
});
