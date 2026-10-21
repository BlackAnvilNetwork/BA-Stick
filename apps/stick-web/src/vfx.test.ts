import { test } from "node:test";
import assert from "node:assert/strict";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { KNIGHT_ABILITY_IDS } from "../../../packages/combat/src/knight-kit.ts";
import * as kits from "../../../packages/combat/src/abilities.ts";
import { VFX, VfxDirector, colorOf, playSteps, stepsFor } from "./vfx.ts";

const allIds = (): string[] => {
  const ids = new Set<string>();
  for (const [name, v] of Object.entries(kits)) {
    if (/_ABILITY_IDS$/.test(name) && Array.isArray(v)) for (const id of v) ids.add(id as string);
  }
  return [...ids];
};

test("every ability in the kits has a VFX entry", () => {
  const ids = allIds();
  assert.ok(ids.length > 250, `found ${ids.length} ids`);
  assert.ok(KNIGHT_ABILITY_IDS.length > 0);
  const missing = ids.filter((id) => !(id in VFX.abilities));
  assert.deepEqual(missing, []);
  for (const [id, steps] of Object.entries(VFX.abilities)) {
    for (const s of steps) {
      if (s === "generic") continue;
      assert.ok(["projectile", "line", "burst", "ring"].includes(s.prim), id);
      assert.ok(s.color in VFX.colors, `${id} colour ${s.color}`);
    }
  }
});

test("table resolves steps, generics and colours", () => {
  assert.deepEqual(stepsFor("rest"), []);
  assert.equal(stepsFor("sc_ember_lance")[0].prim, "projectile");
  assert.equal(stepsFor("sc_ember_rain")[1].prim, "ring");
  assert.equal(stepsFor("nope")[0].prim, "burst");
  assert.equal(colorOf("fire"), 0xff8a2a);
  const calls: unknown[][] = [];
  playSteps({ spawnVfx: (...a) => (calls.push(a), true) }, stepsFor("cl_holy"), "me", "foe");
  assert.deepEqual(calls[0], [1, "me", "foe", 0xfff2b0, 46, 0.5, 2]);
});

const u = (id: string, anim: UnitSnapshot["anim"], animUntil: number, extra: Partial<UnitSnapshot> = {}): UnitSnapshot =>
  ({ id, kind: "player", name: id, x: 0, y: 0, z: 0, facing: 0, hp: 1, maxHp: 1, mp: 0, maxMp: 0, tp: 0, anim, animUntil, targetId: "foe", buffs: {} as UnitSnapshot["buffs"], ...extra });

test("own spells fire when the cast ends; instants fire at once", () => {
  const d = new VfxDirector();
  assert.ok(d.request("provoke", "foe", 0)?.length);
  assert.equal(d.request("sc_ember_lance", "foe", 0), null);
  assert.equal(d.scan([u("me", "cast", 900)], "me", 100).length, 0);
  const fx = d.scan([u("me", "idle", 900)], "me", 1000);
  assert.equal(fx.length, 1);
  assert.equal(fx[0].steps[0].color, "fire");
  // refused spell is dropped
  d.request("sc_ember_lance", "foe", 2000);
  assert.equal(d.scan([u("me", "idle", 0)], "me", 4000).length, 0);
});

test("others: generic bolt on cast end, spark on each swing", () => {
  const d = new VfxDirector();
  d.scan([u("cl", "cast", 500, { job: "cleric" })], "me", 0);
  const a = d.scan([u("cl", "idle", 500, { job: "cleric" })], "me", 600);
  assert.equal(a[0].steps[0].color, "holy");
  const b = d.scan([u("mob", "melee", 800, { kind: "mob" })], "me", 700);
  assert.equal(b[0].steps, VFX.melee);
  assert.equal(d.scan([u("mob", "melee", 800, { kind: "mob" })], "me", 750).length, 0);
  assert.equal(d.scan([u("mob", "melee", 1600, { kind: "mob" })], "me", 900).length, 1);
});
