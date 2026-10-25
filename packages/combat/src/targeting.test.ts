import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UnitSnapshot } from "@bellgrave/protocol";
import {
  canEngageSelected,
  cycleTabTarget,
  listFriendlyTabTargets,
  listHostileTabTargets,
  resolveAbilityTargetId,
} from "./targeting";

const me: UnitSnapshot = {
  id: "0xme",
  kind: "player",
  name: "Me",
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  anim: "idle",
  facing: 0,
  targetId: null,
  buffs: {} as UnitSnapshot["buffs"],
};

const mob = (id: string, x: number, z: number): UnitSnapshot => ({
  ...me,
  id,
  kind: "mob",
  name: id,
  x,
  z,
});

const ally = (id: string, x: number, z: number): UnitSnapshot => ({
  ...me,
  id,
  kind: "player",
  name: id,
  x,
  z,
});

describe("tab targeting", () => {
  it("lists hostiles by distance", () => {
    const units = [me, mob("far", 25, 0), mob("near", 5, 0)];
    const list = listHostileTabTargets(units, me, "0xme");
    assert.deepEqual(list.map((u) => u.id), ["near", "far"]);
  });

  it("cycles hostiles forward and back", () => {
    const units = [me, mob("a", 5, 0), mob("b", 10, 0)];
    const list = listHostileTabTargets(units, me, "0xme");
    assert.equal(cycleTabTarget(null, list, 1), "a");
    assert.equal(cycleTabTarget("a", list, 1), "b");
    assert.equal(cycleTabTarget("b", list, -1), "a");
  });

  it("lists self first then nearby allies", () => {
    const units = [me, ally("0xally", 8, 0)];
    const list = listFriendlyTabTargets(units, me, "0xme");
    assert.deepEqual(list.map((u) => u.id), ["0xme", "0xally"]);
  });

  it("engage only on hostile selection", () => {
    const units = [me, mob("m1", 4, 0), ally("0xally", 4, 0)];
    assert.equal(canEngageSelected(units, "m1", "0xme"), true);
    assert.equal(canEngageSelected(units, "0xally", "0xme"), false);
  });

  it("resolveAbilityTargetId picks ally heals and enemy nukes", () => {
    const units = [me, mob("m1", 4, 0), ally("0xally", 4, 0)];
    assert.equal(
      resolveAbilityTargetId("bm_cure", "0xally", "0xme", null, units),
      "0xally",
    );
    assert.equal(resolveAbilityTargetId("bm_cure", null, "0xme", null, units), "0xme");
    assert.equal(
      resolveAbilityTargetId("bm_fire", "m1", "0xme", null, units),
      "m1",
    );
    assert.equal(resolveAbilityTargetId("bm_flame_edge", "m1", "0xme", null, units), undefined);
  });
});
