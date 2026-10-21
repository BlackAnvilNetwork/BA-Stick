import test from "node:test";
import assert from "node:assert/strict";
import { emptyBuffs, type UnitSnapshot } from "@bellgrave/protocol";
import { BUFF_VFX, ResonanceClock, VFX_KINDS, bit, buffMask, buffVfx, tdLife } from "./buffs";
import { readFileSync } from "node:fs";

test("every BuffState key has a buff-vfx.json entry, and no stale ones", () => {
  const keys = Object.keys(emptyBuffs()).sort();
  assert.deepEqual(Object.keys(BUFF_VFX).sort(), keys);
  for (const [k, e] of Object.entries(BUFF_VFX)) assert.ok(e.vfx === "none" || VFX_KINDS.includes(e.vfx), k);
});

test("VFX_KINDS matches the renderer's NAMES", () => {
  const rs = readFileSync(new URL("../../../engine/ba-stick-render/src/buffvfx.rs", import.meta.url), "utf8");
  const names = [...rs.match(/pub const NAMES[^=]*=\s*\[([^\]]*)\]/)![1]!.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(names, [...VFX_KINDS]);
});

test("all five bespoke effects are reachable", () => {
  const used = new Set(Object.values(BUFF_VFX).map((e) => e.vfx));
  for (const k of ["quicken", "flux", "td", "petrify", "resonance"] as const) assert.ok(used.has(k), k);
});

test("mask follows server timestamps and flags", () => {
  const now = 10_000;
  const b = emptyBuffs();
  assert.equal(buffMask(b, now), 0);
  b.quickenUntil = now + 500;
  b.flux = true;
  b.slowUntil = now - 1; // expired
  b.movePct = 0;
  b.moveUntil = now + 500; // move with 0% is not haste
  assert.equal(buffMask(b, now), bit("quicken") | bit("flux"));
  b.hastePct = 30; // modifiers alone draw nothing
  b.hasteUntil = now + 1;
  assert.equal(buffMask(b, now) & bit("haste"), bit("haste"));
});

test("TD impact life and resonance burst", () => {
  const b = emptyBuffs();
  assert.equal(tdLife(b, 0), -1);
  b.tdImpactUntil = 1400;
  assert.equal(tdLife(b, 0), 0);
  assert.ok(Math.abs(tdLife(b, 700) - 0.5) < 1e-6);
  const u = { id: "p", kind: "player", hp: 10, maxHp: 10, anim: "idle", buffs: { ...emptyBuffs(), quickenUntil: 5000 } } as unknown as UnitSnapshot;
  const c = new ResonanceClock();
  assert.equal(buffVfx(u, 1000, c).burst, 0);
  assert.ok(buffVfx(u, 1240, c).burst > 0.4);
  assert.equal(buffVfx(u, 2000, c).burst, -1);
  const dead = { ...u, hp: 0 } as UnitSnapshot;
  assert.equal(buffVfx(dead, 1000, c).mask, 0);
  const killed = { ...dead, buffs: { ...dead.buffs, tdImpactUntil: 1500, petrifyUntil: 60_000 } } as UnitSnapshot;
  assert.equal(buffVfx(killed, 1000, c).mask, bit("td"));
});
