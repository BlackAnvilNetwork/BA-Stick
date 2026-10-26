// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import { test } from "node:test";
import assert from "node:assert/strict";
import { engageHeadingGoal, headingEase, headingStep, headingTarget, headingToward, shouldResend, DashClock, dashDirection, STOP_LEAD, stopTarget, TURN_RATE, WASD_STEP, wasdIntent, wasdTarget } from "./input";

const none = { w: false, a: false, s: false, d: false };
const free = (_ax: number, _az: number, x: number, z: number) => ({ x, z });
// Fake iso: screen right = +x/-z, screen down = +x/+z.
const pick = (sx: number, sy: number): [number, number] => [(sx / 32 + sy / 16) / 2, (sy / 16 - sx / 32) / 2];

test("iso WASD intent is exactly the screen-relative wasdTarget, whatever the heading", () => {
  const combos = [none, { ...none, w: true }, { ...none, a: true }, { ...none, s: true }, { ...none, d: true }, { ...none, w: true, a: true }, { ...none, s: true, d: true }];
  for (const keys of combos) {
    for (const heading of [0, 1.3, -2.9]) {
      const me = { x: 3, z: 40 };
      assert.deepEqual(wasdIntent({ view: "iso", keys, me, heading, pick, center: [320, 180], clamp: free }), wasdTarget(keys, me, pick, [320, 180], free));
    }
  }
});

test("A/D turn the heading (A = +yaw) and never move", () => {
  assert.ok(Math.abs(headingStep({ ...none, a: true }, 0, 0.5) - TURN_RATE * 0.5) < 1e-9);
  assert.ok(Math.abs(headingStep({ ...none, d: true }, 0, 0.5) + TURN_RATE * 0.5) < 1e-9);
  assert.equal(headingStep({ ...none, a: true, d: true }, 0.7, 1), 0.7);
  const wrapped = headingStep({ ...none, a: true }, Math.PI - 0.01, 0.1);
  assert.ok(wrapped < 0 && wrapped > -Math.PI, "wraps to (-pi, pi]");
  for (const view of ["tp", "fp"] as const) {
    assert.equal(wasdIntent({ view, keys: { ...none, a: true }, me: { x: 0, z: 0 }, heading: 1, pick, center: [320, 180], clamp: free }), null);
  }
});

test("W/S step along / against the heading in 3D, ignoring the screen pick", () => {
  const me = { x: 10, z: -5 };
  const h = 0.9;
  const w = wasdIntent({ view: "tp", keys: { ...none, w: true, d: true }, me, heading: h, pick: () => [999, 999], center: [320, 180], clamp: free })!;
  assert.ok(Math.abs(w.x - (me.x + Math.sin(h) * WASD_STEP)) < 1e-9 && Math.abs(w.z - (me.z + Math.cos(h) * WASD_STEP)) < 1e-9);
  const s = headingTarget({ ...none, s: true }, me, h, free)!;
  assert.ok(Math.abs(s.x - (me.x - Math.sin(h) * WASD_STEP)) < 1e-9 && Math.abs(s.z - (me.z - Math.cos(h) * WASD_STEP)) < 1e-9);
  assert.equal(headingTarget({ ...none, w: true }, me, h, () => me), null, "fully clamped: no send");
});

test("headingToward faces a click target and ignores clicks at the feet", () => {
  assert.ok(Math.abs(headingToward({ x: 0, z: 0 }, 1, 0)! - Math.PI / 2) < 1e-9);
  assert.equal(headingToward({ x: 0, z: 0 }, 0.1, 0.1), null);
});

test("shouldResend throttles held W/S but reacts to changes", () => {
  const prev = { keys: "w", heading: 0, at: 1000, x: 0, z: 4.5 };
  const me = { x: 0, z: 0 };
  assert.equal(shouldResend(null, { keys: "w", heading: 0, at: 0 }, me), true);
  assert.equal(shouldResend(prev, { keys: "w", heading: 0, at: 1100 }, me), false);
  assert.equal(shouldResend(prev, { keys: "wa", heading: 0, at: 1060 }, me), true);
  assert.equal(shouldResend(prev, { keys: "w", heading: 0.1, at: 1060 }, me), true);
  assert.equal(shouldResend(prev, { keys: "w", heading: 0, at: 1060 }, { x: 0, z: 2.5 }), true);
  assert.equal(shouldResend(prev, { keys: "w", heading: 0, at: 1250 }, me), true);
});

test("headingEase turns along the short arc without snapping", () => {
  const one = headingEase(3.0, -3.0, 1 / 60);
  assert.ok(one.heading > 3.0 && !one.done, "crosses +pi, not the long way");
  let h = 0;
  let done = false;
  for (let i = 0; i < 120 && !done; i++) ({ heading: h, done } = headingEase(h, 1.5, 1 / 60));
  assert.equal(done, true);
  assert.equal(h, 1.5);
  assert.ok(headingEase(0, 1.5, 1 / 60).heading < 0.5, "one frame covers part of the turn");
});

test("engageHeadingGoal follows the server facing only while engaged and idle-handed", () => {
  assert.equal(engageHeadingGoal({ facing: 1.2, targetId: "mob-1" }, none), 1.2);
  assert.equal(engageHeadingGoal({ facing: 1.2, targetId: null }, none), null, "tab-selecting alone does not set targetId");
  assert.equal(engageHeadingGoal({ facing: 1.2 }, none), null);
  for (const k of ["w", "a", "s", "d"] as const) assert.equal(engageHeadingGoal({ facing: 1.2, targetId: "mob-1" }, { ...none, [k]: true }), null, `${k} overrides`);
});

test("stopTarget lands just ahead of the server position, never past the step", () => {
  const p = stopTarget({ x: 10, z: 10 }, { x: 10, z: 14.5 });
  assert.ok(Math.abs(p.x - 10) < 1e-9 && Math.abs(p.z - (10 + STOP_LEAD)) < 1e-9);
  const near = stopTarget({ x: 0, z: 0 }, { x: 0.1, z: 0 });
  assert.ok(Math.abs(near.x - 0.1) < 1e-9);
  assert.deepEqual(stopTarget({ x: 3, z: 4 }, { x: 3, z: 4 }), { x: 3, z: 4 });
});

test("iso holds resend only on key change, near the target, or keep-alive", () => {
  const me = { x: 0, z: 0 };
  const prev = { keys: "wd", heading: 0.7, at: 1000, x: 3, z: 3 };
  assert.equal(shouldResend(prev, { keys: "wd", heading: 0.7, at: 1050 }, me), false);
  assert.equal(shouldResend(prev, { keys: "w", heading: 0.7, at: 1050 }, me), true);
  assert.equal(shouldResend(prev, { keys: "wd", heading: 0.7, at: 1300 }, me), true);
});

test("dash direction: heading in 3D (S = back), WASD then cursor then facing in iso", () => {
  const me = { x: 0, z: 0, facing: Math.PI / 2 };
  const none = { w: false, a: false, s: false, d: false };
  const h = dashDirection({ ...none, w: true }, me, 0, null, null);
  assert.ok(Math.abs(h.dx) < 1e-9 && Math.abs(h.dz - 1) < 1e-9);
  const back = dashDirection({ ...none, s: true }, me, 0, null, null);
  assert.ok(Math.abs(back.dz + 1) < 1e-9);
  const turn = dashDirection({ ...none, a: true }, me, 0, null, null);
  assert.ok(Math.abs(turn.dz - 1) < 1e-9, "A/D only turn in 3D");
  const key = dashDirection({ ...none, w: true }, me, null, { x: 3, z: 4 }, [100, 0]);
  assert.ok(Math.abs(key.dx - 0.6) < 1e-9 && Math.abs(key.dz - 0.8) < 1e-9);
  const cur = dashDirection(none, me, null, null, [0, -2]);
  assert.ok(Math.abs(cur.dz + 1) < 1e-9);
  const face = dashDirection(none, me, null, null, [0.01, 0]);
  assert.ok(Math.abs(face.dx - 1) < 1e-9, "cursor on the feet falls back to facing");
});

test("DashClock: local cooldown, confirm, and refusal release", () => {
  const c = new DashClock(3000);
  assert.ok(c.ready(0));
  c.start(1000);
  assert.ok(!c.ready(2000));
  assert.equal(c.refused(1100, true), false, "server confirmed");
  assert.equal(c.refused(2000, false), false);
  assert.ok(c.ready(4000));
  c.start(5000);
  assert.equal(c.refused(5200, false), false);
  assert.equal(c.refused(5500, false), true, "never confirmed: drop the prediction");
  assert.ok(c.ready(5500), "a refused dash does not lock the key");
});
