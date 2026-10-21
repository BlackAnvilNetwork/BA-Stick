import { test } from "node:test";
import assert from "node:assert/strict";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { CombatFloaters, FLOAT } from "./floaters";

const u = (id: string, hp: number, extra: Partial<UnitSnapshot> = {}) => ({ id, name: id.toUpperCase(), hp, targetId: null, ...extra }) as UnitSnapshot;

test("hp deltas become damage/heal floaters; first sighting is silent", () => {
  const f = new CombatFloaters();
  const me = u("me", 100, { targetId: "h" });
  assert.deepEqual(f.scan([me, u("h", 30)], me, [], 0), []);
  assert.deepEqual(f.scan([me, u("h", 22)], me, [], 50), []); // held
  assert.deepEqual(f.scan([me, u("h", 22)], me, [], 250), [{ id: "h", kind: FLOAT.damage, value: 8 }]);
  const hurt = u("me", 90, { targetId: "h" });
  f.scan([hurt, u("h", 22)], hurt, [], 300);
  assert.deepEqual(f.scan([hurt, u("h", 22)], hurt, [], 500), [{ id: "me", kind: FLOAT.selfDamage, value: 10 }]);
  const healed = u("me", 95, { targetId: "h" });
  assert.deepEqual(f.scan([healed, u("h", 22)], healed, [], 600), [{ id: "me", kind: FLOAT.heal, value: 5 }]);
});

test("crit lines upgrade the matching hit; misses float over target/self", () => {
  const f = new CombatFloaters();
  const me = u("me", 100, { targetId: "h" });
  f.scan([me, u("h", 50)], me, ["a"], 0);
  f.scan([me, u("h", 30)], me, ["a"], 20);
  const ev = f.scan([me, u("h", 30)], me, ["a", "You hit H for 20 (Critical!)."], 70);
  assert.deepEqual(ev, [{ id: "h", kind: FLOAT.crit, value: 20 }]);
  const ev2 = f.scan([me, u("h", 30)], me, ["a", "You hit H for 20 (Critical!).", "You miss.", "H misses you."], 90);
  assert.deepEqual(ev2, [{ id: "h", kind: FLOAT.miss, value: 0 }, { id: "me", kind: FLOAT.miss, value: 0 }]);
});

test("dead units do not float a revive heal", () => {
  const f = new CombatFloaters();
  f.scan([u("h", 0)], undefined, [], 0);
  assert.deepEqual(f.scan([u("h", 30)], undefined, [], 10), []);
});
