import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DASH_COOLDOWN_MS,
  DASH_DISTANCE,
  DASH_MIN,
  DASH_MS,
  PH_HUB,
  PH_HUB_REAR_WALL,
  PH_HUB_SPAWN,
  dashDurationMs,
  dashPos,
  paleHollowClampMove,
  paleHollowMoveMul,
  paleHollowRiverCenterX,
  paleHollowWalkable,
  planDash,
} from "@bellgrave/config";

const open = (_fx: number, _fz: number, tx: number, tz: number) => ({ x: tx, z: tz });

test("dash covers DASH_DISTANCE on open ground and eases to the end", () => {
  const p = planDash({ x: 0, z: 0 }, { dx: 1, dz: 0 }, open, 1000, undefined);
  assert.ok(p.ok);
  assert.ok(Math.abs(p.run.tx - DASH_DISTANCE) < 1e-6 && Math.abs(p.run.tz) < 1e-6);
  assert.ok(Math.abs(p.facing - Math.PI / 2) < 1e-6);
  const mid = dashPos(p.run, (p.run.start + p.run.end) / 2);
  assert.ok(mid.x > DASH_DISTANCE / 2 && !mid.done, "ease-out: past halfway at half time");
  assert.deepEqual(dashPos(p.run, p.run.end + 5), { x: p.run.tx, z: p.run.tz, done: true });
});

test("anti-cheat: a forged huge direction never exceeds the cap", () => {
  const p = planDash({ x: 5, z: 5 }, { dx: 1e6, dz: 1e6 }, open, 0, undefined);
  assert.ok(p.ok);
  assert.ok(Math.hypot(p.run.tx - 5, p.run.tz - 5) <= DASH_DISTANCE + 1e-6);
  assert.equal(planDash({ x: 0, z: 0 }, { dx: 0, dz: 0 }, open, 0, undefined).ok, false);
  assert.equal(planDash({ x: 0, z: 0 }, { dx: NaN, dz: 1 }, open, 0, undefined).ok, false);
});

test("cooldown refuses a second dash until it elapses", () => {
  const t0 = 10_000;
  const again = planDash({ x: 0, z: 0 }, { dx: 0, dz: 1 }, open, t0 + DASH_COOLDOWN_MS - 1, t0);
  assert.equal(again.ok, false);
  assert.equal(!again.ok && again.reason, "cooldown");
  assert.ok(planDash({ x: 0, z: 0 }, { dx: 0, dz: 1 }, open, t0 + DASH_COOLDOWN_MS, t0).ok);
});

test("dash stops short of the hub rear wall and never lands inside it", () => {
  const x = PH_HUB_SPAWN.x;
  const z = PH_HUB_REAR_WALL.minZ - 1.5;
  assert.ok(paleHollowWalkable(x, z));
  const p = planDash({ x, z }, { dx: 0, dz: 1 }, paleHollowClampMove, 0, undefined);
  assert.ok(p.ok);
  assert.ok(p.run.tz < PH_HUB_REAR_WALL.minZ, `ended at z=${p.run.tz}`);
  assert.ok(Math.hypot(p.run.tx - x, p.run.tz - z) < DASH_DISTANCE);
  assert.ok(paleHollowWalkable(p.run.tx, p.run.tz));
  // Flush against the wall there is no room at all.
  const flush = planDash({ x: p.run.tx, z: p.run.tz }, { dx: 0, dz: 1 }, paleHollowClampMove, 0, undefined);
  assert.ok(!flush.ok || Math.hypot(flush.run.tx - p.run.tx, flush.run.tz - p.run.tz) >= DASH_MIN);
});

test("dash from inside the rear wall does not land north of the cliff", () => {
  const x = PH_HUB.minX + 14;
  const z = PH_HUB.minZ + 6 + 8.5;
  assert.equal(paleHollowWalkable(x, z), false);
  const p = planDash({ x, z }, { dx: 0, dz: 1 }, paleHollowClampMove, 0, undefined);
  if (p.ok) {
    assert.ok(paleHollowWalkable(p.run.tx, p.run.tz));
    assert.ok(p.run.tz < PH_HUB_REAR_WALL.maxZ + 0.2, `dashed through to z=${p.run.tz}`);
  }
});

test("zone bounds: a clamp that holds the edge ends the dash at the edge", () => {
  const edge = (_fx: number, _fz: number, tx: number, tz: number) => ({ x: Math.min(tx, 10), z: tz });
  const p = planDash({ x: 8, z: 0 }, { dx: 1, dz: 0 }, edge, 0, undefined);
  assert.ok(p.ok && p.run.tx <= 10 && p.run.tx > 9.5);
  assert.equal(planDash({ x: 10, z: 0 }, { dx: 1, dz: 0 }, edge, 0, undefined).ok, false);
  // Sliding along an edge is refused too: the dash does not turn corners.
  const slide = (_fx: number, _fz: number, tx: number, tz: number) => ({ x: tx, z: Math.min(tz, 0) });
  const s = planDash({ x: 0, z: -1 }, { dx: 1, dz: 1 }, slide, 0, undefined);
  assert.ok(s.ok && s.run.tz <= 0);
});

test("dash duration scales with travelled distance (local pred and server agree)", () => {
  assert.equal(dashDurationMs(DASH_DISTANCE), DASH_MS);
  assert.equal(dashDurationMs(DASH_DISTANCE / 2), DASH_MS / 2);
  const p = planDash({ x: 0, z: 0 }, { dx: 1, dz: 0 }, open, 0, undefined);
  assert.ok(p.ok);
  assert.ok(Math.abs(p.run.end - p.run.start - dashDurationMs(DASH_DISTANCE)) < 1e-6);
});

test("water move mul shortens a planned dash the same way walk slows", () => {
  const z = 80;
  const x = paleHollowRiverCenterX(z);
  const mul = paleHollowMoveMul(x, z);
  assert.ok(mul < 1, "expected a river/bank cell");
  const full = planDash({ x, z }, { dx: 0, dz: 1 }, open, 0, undefined);
  const slow = planDash({ x, z }, { dx: 0, dz: 1 }, open, 0, undefined, DASH_DISTANCE * mul);
  assert.ok(full.ok && slow.ok);
  const fullD = Math.hypot(full.run.tx - x, full.run.tz - z);
  const slowD = Math.hypot(slow.run.tx - x, slow.run.tz - z);
  assert.ok(Math.abs(slowD - fullD * mul) < 0.05);
});

test("ability dash uses kit range instead of DASH_DISTANCE", () => {
  const p = planDash({ x: 0, z: 0 }, { dx: 1, dz: 0 }, open, 0, undefined, 8);
  assert.ok(p.ok);
  assert.ok(Math.abs(p.run.tx - 8) < 1e-6);
  const short = planDash({ x: 0, z: 0 }, { dx: 1, dz: 0 }, open, 0, undefined, 6);
  assert.ok(short.ok);
  assert.ok(Math.abs(short.run.tx - 6) < 1e-6);
});

test("handleDash refuses bind the same as stun", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");
  assert.match(src, /if \(now < p\.bindUntil\)/);
  assert.match(src, /You are bound\./);
  assert.match(src, /p\.gathering && now < p\.animUntil/);
  assert.match(src, /resumeNav \? \(routeLive \? p\.navGoal : null\) : null/);
  assert.match(src, /const routeLive = p\.moveTo != null/);
  assert.match(src, /const selfSpeed = playerMoveSpeed\(p, nowUnits\)/);
  assert.match(src, /pl\.wallet === p\.wallet \? \{ speed: selfSpeed \}/);
  assert.match(src, /playerMoveSpeed\(p, nowUnits\)/);
  assert.doesNotMatch(src, /speed: playerMoveSpeed\(pl,/);
  assert.match(src, /Math\.min\(0\.2, Math\.max\(TICK_MS \/ 1000, wall\)\)/);
  assert.match(src, /const step = speed \* simDt/);
  assert.match(src, /function armWorldTick\(/);
  assert.match(src, /if \(tickDue < now\) tickDue = now \+ TICK_MS/);
  assert.match(src, /pulse1s/);
  assert.match(src, /x\.toFixed\(2\) \+ ":" \+ z\.toFixed\(2\)/);
  assert.match(src, /const idle = flushed\.ok && committed\.length === 0 && guildEvents\.length === 0;/);
  assert.match(src, /bodyMs < 20 \|\| sealStale/);
  assert.match(src, /short \|\| Math\.hypot\(hit\.x - x, hit\.z - z\) < 0\.2/);
});
