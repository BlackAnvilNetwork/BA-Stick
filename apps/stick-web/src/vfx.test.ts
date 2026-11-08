import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { KNIGHT_ABILITY_IDS } from "../../../packages/combat/src/knight-kit.ts";
import * as kits from "../../../packages/combat/src/abilities.ts";
import { VFX, VfxDirector, colorOf, playSteps, stepsFor, waitsCastPose } from "./vfx.ts";

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
  const missing = ids.filter((id) => !id.startsWith("map_") && !(id in VFX.abilities));
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
  assert.equal(stepsFor("quest_accept")[0].prim, "ring");
  assert.equal(stepsFor("quest_complete")[0].prim, "ring");
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
  // cast start: only the caster burst (F36); the spell itself waits for the cast end
  const start = d.scan([u("me", "cast", 900)], "me", 100);
  assert.equal(start.length, 1);
  assert.equal(start[0].steps[0].prim, "burst");
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

test("cast burst on the caster at every cast start (F36)", () => {
  const d = new VfxDirector();
  const a = d.scan([u("sc", "cast", 900, { job: "sorcerer" })], "me", 0);
  assert.equal(a.length, 1);
  assert.equal(a[0].from, "sc");
  assert.equal(a[0].to, null);
  assert.equal(a[0].steps[0].prim, "burst");
  assert.equal(a[0].steps[0].color, "fire");
  assert.equal(d.scan([u("sc", "cast", 900, { job: "sorcerer" })], "me", 100).length, 0, "same window: no repeat");
  const m = d.scan([u("boss", "cast", 700, { kind: "mob" })], "me", 200);
  assert.equal(m[0].steps[0].color, "enfeeble");
  assert.equal(d.scan([u("sc", "cast", 2500, { job: "sorcerer" })], "me", 1200).length, 1, "next cast bursts again");
});

test("signature abilities use distinct job motifs", () => {
  const sig: Record<string, string[]> = {
    bulwark: ["silver", "crimson"],
    shield_bash: ["silver", "crimson"],
    ghost_step: ["dark", "dark"],
    backblade: ["dark", "dark"],
    sacred_mercy: ["holy", "protect", "holy"],
    cl_cure: ["protect", "holy"],
    arcane_flood: ["dark", "water"],
    killing_storm: ["iron", "oxblood"],
    berserk: ["oxblood", "iron"],
    spellblade: ["teal", "bronze"],
    bm_flame_edge: ["bronze", "fire", "teal"],
    temporal_distortion: ["time", "ash", "time"],
    quicken: ["time", "ash", "holy"],
  };
  for (const name of ["silver", "crimson", "iron", "oxblood", "teal", "bronze", "ash"]) {
    assert.match(VFX.colors[name], /^[0-9a-f]{6}$/);
  }
  for (const [id, colors] of Object.entries(sig)) {
    const steps = stepsFor(id);
    assert.ok(steps.length >= 2, id);
    assert.deepEqual(steps.map((s) => s.color), colors, id);
    assert.notDeepEqual(steps, VFX.generic, id);
    if (id !== "temporal_distortion" && id !== "quicken") {
      for (const s of steps) assert.notEqual(s.color, "time", id);
    }
  }
  // Ghost Step hide is snapshot omission — dark rings are caster motif, not hide.
  for (const s of stepsFor("ghost_step")) assert.ok((s.radius ?? 0.5) < 1.2);
  for (const s of stepsFor("killing_storm")) assert.ok((s.radius ?? 0) < 3);
  assert.equal(stepsFor("sc_ember_lance")[1].prim, "burst");
  assert.equal(stepsFor("sc_rime_needle")[0].prim, "line");
  assert.equal(stepsFor("sc_volt_arc")[1].rise, true);
  assert.equal(stepsFor("sc_tidebreak")[1].prim, "ring");
  assert.equal(stepsFor("sc_gravel_shard")[0].prim, "line");
  assert.equal(stepsFor("sc_gale_cut")[1].rise, true);
  assert.ok((stepsFor("sc_gale_cut")[1].radius ?? 0) > (stepsFor("sc_tidebreak")[1].radius ?? 0));
});

test("kit spells wait for the cast pose; other players tint from job motif", () => {
  assert.equal(waitsCastPose("dr_ash_brace"), true);
  assert.equal(waitsCastPose("sacred_mercy"), true);
  assert.equal(waitsCastPose("berserk"), true);
  assert.equal(waitsCastPose("ghost_step"), true);
  assert.equal(waitsCastPose("temporal_distortion"), true);
  assert.equal(waitsCastPose("provoke"), false);
  const d = new VfxDirector();
  d.scan([u("kn", "cast", 500, { job: "knight" })], "me", 0);
  assert.equal(d.scan([u("kn", "idle", 500, { job: "knight" })], "me", 600)[0].steps[0].color, "silver");
  d.scan([u("ft", "cast", 500, { job: "fighter" })], "me", 0);
  assert.equal(d.scan([u("ft", "idle", 500, { job: "fighter" })], "me", 600)[0].steps[0].color, "iron");
  d.scan([u("bm", "cast", 500, { job: "battle_mage" })], "me", 0);
  assert.equal(d.scan([u("bm", "idle", 500, { job: "battle_mage" })], "me", 600)[0].steps[0].color, "teal");
});

test("Ghost Step hide is snapshot omission, not dark rings", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../server/src/index.ts"), "utf8");
  assert.match(src, /nowUnits < pl\.ghostStepUntil/);
});
