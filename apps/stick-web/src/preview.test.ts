import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPreset } from "./gear.ts";

test("preview preset follows job and gender", () => {
  assert.equal(previewPreset("cleric", "female"), "cleric/female");
  assert.equal(previewPreset("knight", undefined), "knight/male");
});

test("preview preset uses Druid form keys, gender only on Ring-Walker", () => {
  assert.equal(previewPreset("druid", "female"), "druid/female");
  assert.equal(previewPreset("druid", "male", 0), "druid/male");
  assert.equal(previewPreset("druid", "male", 1), "druid:stickbear");
  assert.equal(previewPreset("druid", "female", 2), "druid:stickdeer");
  assert.equal(previewPreset("druid", "pepeka", 3), "druid:sticklion");
  assert.equal(previewPreset("druid", "male", 4), "druid:racerunner");
});
