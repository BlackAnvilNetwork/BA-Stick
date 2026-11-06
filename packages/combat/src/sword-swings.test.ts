import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSwordSwingFamily,
  nextSwordSwing,
  swordSwingReachMul,
  swordSwingRendererAnim,
} from "./sword-swings";

test("sword combo cycles slash → overhead → spin", () => {
  assert.equal(nextSwordSwing(0).kind, "slash");
  assert.equal(nextSwordSwing(0).nextStep, 1);
  assert.equal(nextSwordSwing(1).kind, "overhead");
  assert.equal(nextSwordSwing(2).kind, "spin");
  assert.equal(nextSwordSwing(3).kind, "slash");
});

test("renderer anim tokens", () => {
  assert.equal(swordSwingRendererAnim("slash"), "melee_slash");
  assert.equal(swordSwingRendererAnim("overhead"), "melee_overhead");
  assert.equal(swordSwingRendererAnim("spin"), "melee_spin");
});

test("weapon families and reach", () => {
  assert.equal(isSwordSwingFamily("sword"), true);
  assert.equal(isSwordSwingFamily("greatsword"), true);
  assert.equal(isSwordSwingFamily("staff"), false);
  assert.ok(swordSwingReachMul("overhead") > swordSwingReachMul("slash"));
});
