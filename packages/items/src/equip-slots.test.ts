import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateEquipmentStats, canEquipAnotherCopy, emptyEquipment } from "./index";

test("ring gear counts in ring and ring2 slots", () => {
  const one = { ...emptyEquipment(), ring: 1063 };
  const two = { ...emptyEquipment(), ring: 1063, ring2: 1063 };
  assert.equal(aggregateEquipmentStats(one).regen, 1);
  assert.equal(aggregateEquipmentStats(two).regen, 2);
});

test("second ring slot needs another bag copy", () => {
  const equip = { ...emptyEquipment(), ring: 1063 };
  assert.equal(canEquipAnotherCopy(1, equip, {}, 1063, false, ["ring", "ring2"], "ring2"), false);
  assert.equal(canEquipAnotherCopy(2, equip, {}, 1063, false, ["ring", "ring2"], "ring2"), true);
});
