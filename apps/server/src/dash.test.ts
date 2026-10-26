import assert from "node:assert/strict";
import test from "node:test";
import {
  DASH_COOLDOWN_MS,
  DASH_DISTANCE,
  DASH_MIN,
  PH_HUB_REAR_WALL,
  PH_HUB_SPAWN,
  dashPos,
  paleHollowClampMove,
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
