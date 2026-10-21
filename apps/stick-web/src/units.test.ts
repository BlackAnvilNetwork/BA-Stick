import { test } from "node:test";
import assert from "node:assert/strict";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { animFor, presetFor, syncUnits, type UnitSink } from "./units";
import { wasdTarget } from "./input";

const unit = (o: Partial<UnitSnapshot>): UnitSnapshot => ({
  id: "a", kind: "player", name: "A", x: 0, y: 0, z: 0, facing: 0, hp: 1, maxHp: 1, mp: 0, maxMp: 0, tp: 0,
  anim: "idle", animUntil: 0, targetId: null, buffs: {} as UnitSnapshot["buffs"], ...o,
});

test("presetFor maps job/gender, npc role and mob archetype", () => {
  assert.equal(presetFor(unit({ job: "time_mage", gender: "pepeka" } as Partial<UnitSnapshot>)), "time_mage/pepeka");
  assert.equal(presetFor(unit({ kind: "npc", npcRole: "vendor" })), "npc:vendor");
  assert.equal(presetFor(unit({ kind: "mob", archetype: "wolf" })), "mob:wolf");
});

test("animFor holds melee/cast only until animUntil", () => {
  assert.equal(animFor(unit({ anim: "melee", animUntil: 2000 }), 1000), "melee");
  assert.equal(animFor(unit({ anim: "melee", animUntil: 2000 }), 3000), "idle");
  assert.equal(animFor(unit({ anim: "walk" }), 0), "walk");
  assert.equal(animFor(unit({ anim: "dead" }), 0), "idle");
});

test("syncUnits upserts present units and removes departed ones", () => {
  const calls: string[] = [];
  const sink: UnitSink = {
    upsertUnit: (id) => void calls.push(`+${id}`),
    removeUnit: (id) => (calls.push(`-${id}`), true),
  };
  const known = new Set<string>();
  syncUnits(sink, [unit({ id: "a" }), unit({ id: "b" }), unit({ id: "g", gatherNode: true })], known, 0);
  syncUnits(sink, [unit({ id: "b" })], known, 0);
  assert.deepEqual(calls, ["+a", "+b", "+b", "-a"]);
  assert.deepEqual([...known], ["b"]);
});

test("wasdTarget follows the screen projection and steps 4.5 units", () => {
  // Fake iso: screen right = +x/-z, screen down = +x/+z.
  const pick = (sx: number, sy: number): [number, number] => [(sx / 32 + sy / 16) / 2, (sy / 16 - sx / 32) / 2];
  const none = { w: false, a: false, s: false, d: false };
  assert.equal(wasdTarget(none, { x: 0, z: 0 }, pick, [320, 180]), null);
  const t = wasdTarget({ ...none, w: true }, { x: 0, z: 40 }, pick, [320, 180])!;
  assert.ok(t.x < 0 && t.z < 40, `w moves screen-up: ${JSON.stringify(t)}`);
  assert.ok(Math.abs(Math.hypot(t.x, t.z - 40) - 4.5) < 0.2);
});
