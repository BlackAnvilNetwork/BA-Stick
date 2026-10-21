import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPreset } from "./gear.ts";

test("preview preset follows job and gender", () => {
  assert.equal(previewPreset("cleric", "female"), "cleric/female");
  assert.equal(previewPreset("knight", undefined), "knight/male");
});
