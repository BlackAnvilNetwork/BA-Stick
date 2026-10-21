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
  assert.equal(mob.flags & (FX.HOSTILE | FX.SHINY | FX.HOVERED | FX.PLAYER_CAST), FX.HOSTILE | FX.SHINY | FX.HOVERED);
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
  assert.deepEqual(routeUnitClick(unit({ id: "0xME" }), "0xme"), {});
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
