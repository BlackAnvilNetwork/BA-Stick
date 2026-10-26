import { test } from "node:test";
import assert from "node:assert/strict";
import type { UnitSnapshot } from "@bellgrave/protocol";
import type { UnitWithCraft } from "./units";
import {
  animFor,
  craftActFor,
  gatherActFor,
  LEATHERCRAFT_ANIM_MS,
  presentCraft,
  presentGather,
  presetFor,
  syncUnits,
  type UnitSink,
} from "./units";
import { moveKeyFromCode, wasdTarget } from "./input";

const unit = (o: Partial<UnitWithCraft>): UnitWithCraft => ({
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
  assert.equal(animFor(unit({ anim: "rest" }), 0), "rest");
  assert.equal(animFor(unit({ anim: "dead" }), 0), "idle");
  assert.equal(animFor(unit({ anim: "cast", animUntil: 2000, gatherTool: "shovel" }), 1000), "harvest");
  assert.equal(animFor(unit({ anim: "cast", animUntil: 2000, gatherTool: "pick" }), 1000), "mine");
  assert.equal(animFor(unit({ anim: "cast", animUntil: 2000, gatherTool: "shovel" }), 3000), "idle");
  assert.equal(
    animFor(unit({ anim: "idle", animUntil: 5000, craftChannel: "leathercraft" }), 1000),
    "leathercraft",
  );
});

test("leathercraft craft shows hammer animation for three strikes", () => {
  const act = craftActFor("leathercraft", 1000);
  assert.ok(act);
  assert.equal(act!.until - act!.since, LEATHERCRAFT_ANIM_MS);
  const me = unit({ id: "me", anim: "idle", animUntil: 0 });
  const shown = presentCraft(me, act, 1500);
  assert.equal(animFor(shown.unit, 1500), "leathercraft");
  assert.equal(shown.unit.craftChannel, "leathercraft");
  assert.equal(presentCraft(me, act, act!.until + 1).act, null);
});

test("smithing craft summons anvil animation for three strikes", () => {
  const act = craftActFor("smithing", 1000);
  assert.ok(act);
  assert.equal(act!.skill, "smithing");
  const me = unit({ id: "me", anim: "idle", animUntil: 0 });
  const shown = presentCraft(me, act, 1500);
  assert.equal(animFor(shown.unit, 1500), "smithing");
  assert.equal(shown.unit.craftChannel, "smithing");
});

test("cooking craft shows pot stir animation for three pulses", () => {
  const act = craftActFor("cooking", 1000);
  assert.ok(act);
  assert.equal(act!.skill, "cooking");
  const me = unit({ id: "me", anim: "idle", animUntil: 0 });
  const shown = presentCraft(me, act, 1500);
  assert.equal(animFor(shown.unit, 1500), "cooking");
  assert.equal(shown.unit.craftChannel, "cooking");
});

test("goldsmithing craft shows stake tap animation for three strikes", () => {
  const act = craftActFor("goldsmithing", 1000);
  assert.ok(act);
  assert.equal(act!.skill, "goldsmithing");
  const me = unit({ id: "me", anim: "idle", animUntil: 0 });
  const shown = presentCraft(me, act, 1500);
  assert.equal(animFor(shown.unit, 1500), "goldsmithing");
  assert.equal(shown.unit.craftChannel, "goldsmithing");
});

test("a gather click puts the tool in hand until the channel ends", () => {
  const flax = unit({ id: "ph-live-1", kind: "npc", name: "Pale Flax Stand", gatherNode: true, gatherYield: "pale-flax" });
  const vein = unit({ id: "ph-live-2", kind: "npc", name: "Copper Nugget Vein", gatherNode: true, gatherYield: "copper-ore" });
  const pool = unit({ id: "ph-live-3", kind: "npc", name: "Chalk Pool", gatherNode: true, gatherYield: "fossil-minnow" });
  const dig = gatherActFor(flax, 1000);
  assert.equal(dig?.tool, "shovel");
  assert.ok(dig && dig.until - dig.since >= 2500);
  assert.equal(gatherActFor(vein, 1000)?.tool, "pick");
  assert.equal(gatherActFor(pool, 1000), null);
  const me = unit({ id: "me", anim: "idle", animUntil: 0 });
  const shown = presentGather(me, dig, 1200);
  assert.equal(animFor(shown.unit, 1200), "harvest");
  assert.equal(presentGather(me, gatherActFor(vein, 1000), 1200).unit.gatherTool, "pick");
  assert.equal(presentGather(unit({ anim: "walk" }), dig, 2000).act, null);
  assert.equal(animFor(presentGather(me, dig, (dig?.until ?? 0) + 1).unit, (dig?.until ?? 0) + 1), "idle");
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
  assert.deepEqual(calls, ["+a", "+b", "+g", "+b", "-a", "-g"]);
  assert.deepEqual([...known], ["b"]);
});

test("move keys are WASD and the arrows", () => {
  assert.equal(moveKeyFromCode("KeyW"), "w");
  assert.equal(moveKeyFromCode("ArrowUp"), "w");
  assert.equal(moveKeyFromCode("KeyA"), "a");
  assert.equal(moveKeyFromCode("ArrowLeft"), "a");
  assert.equal(moveKeyFromCode("KeyS"), "s");
  assert.equal(moveKeyFromCode("ArrowDown"), "s");
  assert.equal(moveKeyFromCode("KeyD"), "d");
  assert.equal(moveKeyFromCode("ArrowRight"), "d");
  assert.equal(moveKeyFromCode("KeyM"), null);
  assert.equal(moveKeyFromCode("Numpad8"), null);
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

import { CastClock, FX, LEVEL_UP_MS, unitFx } from "./fx";
import { MOB_DEATH_FADE_MS } from "@bellgrave/config";

const ctx = { now: 10_000, wallet: "0xME", selected: null, hovered: null, cast: -1 };

test("unitFx: mob corpse fades over MOB_DEATH_FADE_MS and hides HP", () => {
  const m = unit({ id: "m", kind: "mob", anim: "dead", hp: 0, deathAt: 10_000 - MOB_DEATH_FADE_MS / 2 });
  const fx = unitFx(m, ctx);
  assert.equal(fx.hp, -1);
  assert.ok(Math.abs(fx.fade - 0.5) < 1e-6);
  assert.equal(unitFx({ ...m, deathAt: 0 }, ctx).fade, 0);
});

test("unitFx: flags for self, selection, hostility, shiny", () => {
  const me = unitFx(unit({ id: "0xme" }), { ...ctx, selected: "0xme" });
  assert.equal(me.flags & (FX.SELF | FX.SELECTED | FX.HOSTILE), FX.SELF | FX.SELECTED);
  const mob = unitFx(unit({ id: "m", kind: "mob", shiny: true }), { ...ctx, hovered: "m" });
  assert.equal(
    mob.flags & (FX.MOB | FX.SHINY | FX.HOVERED | FX.PLAYER_CAST),
    FX.MOB | FX.SHINY | FX.HOVERED,
  );
  assert.equal(mob.flags & FX.HOSTILE, 0);
  const mobSel = unitFx(unit({ id: "m", kind: "mob" }), { ...ctx, selected: "m" });
  assert.ok(mobSel.flags & (FX.MOB | FX.SELECTED));
  assert.equal(mobSel.flags & FX.HOSTILE, 0);
  const mobAggro = unitFx(unit({ id: "m", kind: "mob", targetId: "0xme" }), {
    ...ctx,
    selected: "m",
    wallet: "0xme",
  });
  assert.ok(mobAggro.flags & FX.HOSTILE);
  const bounty = unitFx(unit({ id: "p2", pvpBounty: true }), ctx);
  assert.ok(bounty.flags & FX.HOSTILE);
});

test("unitFx: level-up progress over the server window", () => {
  const u = unit({ buffs: { levelUpUntil: 10_000 + LEVEL_UP_MS / 4 } as UnitSnapshot["buffs"] });
  assert.ok(Math.abs(unitFx(u, ctx).levelUp - 0.75) < 1e-6);
  assert.equal(unitFx(unit({}), ctx).levelUp, -1);
});

test("CastClock: progress from the rising edge of animUntil; aoe passes through", () => {
  const c = new CastClock();
  const m = unit({ id: "m", kind: "mob", anim: "cast", animUntil: 2000, castAoe: 3 });
  assert.equal(c.progress(m, 1000), 0);
  assert.equal(c.progress(m, 1500), 0.5);
  // Recast bumps animUntil → new window.
  assert.equal(c.progress({ ...m, animUntil: 3500 }, 2500), 0);
  assert.equal(c.progress({ ...m, anim: "idle" }, 2600), -1);
  assert.equal(unitFx(m, { ...ctx, cast: 0.5 }).aoe, 3);
});

import { routeUnitClick } from "./clicks";

test("routeUnitClick matches the legacy click rules", () => {
  assert.deepEqual(routeUnitClick(unit({ id: "n", kind: "npc" }), "0xme"), { send: { type: "npc/interact", npcId: "n" } });
  assert.deepEqual(routeUnitClick(unit({ id: "m", kind: "mob" }), "0xme"), { select: "m", send: { type: "engage", targetId: "m" } });
  assert.deepEqual(routeUnitClick(unit({ id: "m", kind: "mob", anim: "dead", hp: 0 }), "0xme"), {});
  assert.deepEqual(routeUnitClick(unit({ id: "p" }), "0xme"), { select: "p" });
  assert.deepEqual(routeUnitClick(unit({ id: "p", pvpBounty: true }), "0xme"), { select: "p", send: { type: "engage", targetId: "p" } });
  assert.deepEqual(routeUnitClick(unit({ id: "0xME" }), "0xme"), { select: "0xME" });
});

import { labelFor } from "./labels";

test("labelFor follows legacy nameplate visibility", () => {
  const c = { wallet: "0xme", selected: null, hovered: null };
  assert.deepEqual(labelFor(unit({ id: "n", kind: "npc", name: "Job Master" }), c), { text: "Job Master", cls: "npc" });
  assert.equal(labelFor(unit({ id: "m", kind: "mob", name: "Dust Hare", level: 2 }), c), null);
  assert.deepEqual(labelFor(unit({ id: "m", kind: "mob", name: "Dust Hare", level: 2 }), { ...c, selected: "m" }), { text: "Dust Hare Lv2", cls: "mob" });
  assert.equal(labelFor(unit({ id: "0xME", name: "Me" }), { ...c, selected: "0xME" }), null);
  assert.equal(labelFor(unit({ id: "p", name: "Bob", pvpBounty: true }), c)?.cls, "player bounty");
});

import { AnimEdges, swingVolume } from "./sfx";

test("AnimEdges: one swing per animUntil bump, by kind, with legacy falloff", () => {
  const e = new AnimEdges();
  const me = { x: 0, z: 0 };
  const mob = unit({ id: "m", kind: "mob", anim: "melee", animUntil: 100, x: 14 });
  assert.deepEqual(e.scan([mob], me, 0), [{ kind: "enemySwing", volume: swingVolume(14) }]);
  assert.deepEqual(e.scan([mob], me, 0), []);
  assert.equal(e.scan([{ ...mob, animUntil: 200 }], me, 0).length, 1);
  const p = unit({ id: "p", anim: "melee", animUntil: 50, job: "knight" } as Partial<UnitSnapshot>);
  assert.deepEqual(e.scan([p], me, 0), [{ kind: "jobSwing", job: "knight", volume: 0.6 }]);
  const td = unit({ id: "m2", kind: "mob", buffs: { tdImpactUntil: 500 } as UnitSnapshot["buffs"] });
  assert.deepEqual(e.scan([td], me, 100), [{ kind: "temporalDistortion", until: 500 }]);
  assert.equal(swingVolume(100), 0.15);
});

import { zoneRender } from "./zones";
import { ZONE_IDS } from "@bellgrave/config";

test("zoneRender resolves every ZoneId; only served zones are baked", () => {
  for (const z of ZONE_IDS) {
    const r = zoneRender(z);
    assert.equal(r.id, z);
    assert.ok(r.name.length > 0);
  }
  assert.equal(zoneRender("pale_hollow").baked, "pale_hollow");
  assert.equal(zoneRender("palace_hall").baked, null);
  assert.equal(zoneRender(undefined).id, "pale_hollow");
});

import { ZoneTracker } from "./zones";

test("ZoneTracker: first zone, unchanged, then a real change", () => {
  const t = new ZoneTracker();
  assert.deepEqual(t.update(undefined), { changed: false, first: false });
  assert.deepEqual(t.update("pale_hollow"), { changed: true, first: true });
  assert.deepEqual(t.update("pale_hollow"), { changed: false, first: false });
  assert.deepEqual(t.update("palace_hall"), { changed: true, first: false });
});

import { staticAt } from "./statics";
import { PH_STORAGE_CHEST } from "@bellgrave/config";

test("staticAt hits the storage chest only in its zone and footprint", () => {
  const toScreen = (x: number, _y: number, z: number): [number, number] => [100 + x * 10, 100 + z * 10];
  const h = () => 0;
  // chest feet at (100 + x*10, 100 + z*10); click 10 px above them
  const [cx, cy] = toScreen(PH_STORAGE_CHEST.x, 0, PH_STORAGE_CHEST.z);
  const hit = staticAt("pale_hollow", cx, cy - 10, toScreen, h);
  assert.equal(hit?.send.type, "npc/interact");
  assert.equal(staticAt("palace_hall", cx, cy - 10, toScreen, h), undefined);
  assert.equal(staticAt("pale_hollow", 300, 75, toScreen, h), undefined);
});

import { gatherMethod, iconCell } from "./gather";

test("gather nodes: method from authored defs, click sends gather, depleted is inert", () => {
  const defs = [{ name: "Ore Seam", kind: "mine", yields: ["copper-ore"] }, { name: "Pool", kind: "fish", yields: ["ash-bait"] }];
  assert.equal(gatherMethod({ name: "Ore Seam", gatherYield: "x" }, defs), "mine");
  assert.equal(gatherMethod({ name: "?", gatherYield: "ash-bait" }, defs), "fish");
  assert.equal(gatherMethod({ name: "?", gatherYield: "?" }, defs), "harvest");
  const n = unit({ id: "ph-live-0", kind: "npc", gatherNode: true, hp: 1 });
  assert.deepEqual(routeUnitClick(n, null), { send: { type: "gather", nodeId: "ph-live-0" } });
  assert.deepEqual(routeUnitClick({ ...n, hp: 0 }, null), {});
  const atlas = { size: 16, cols: 32, index: { dustgrain: 3, "copper-ore": 40 } };
  assert.deepEqual(iconCell(atlas, "copper-ore"), { x: 128, y: 16 });
  assert.deepEqual(iconCell(atlas, "nope"), { x: 48, y: 0 });
});
