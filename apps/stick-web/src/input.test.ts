// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { clearKeyboardMove, clearVirtualStick, getMoveKeys, setKeyboardMoveKey, setVirtualStick } from "@bellgrave/ui/moveInput";
import { analogScreenTarget, blendToward, engageHeadingGoal, headingEase, headingStep, headingTarget, headingToward, isoScreenPick, shouldResend, DashClock, dashDirection, DASH_PRED_HOLD, RECONCILE_SNAP, STOP_LEAD, stopTarget, TURN_RATE, WASD_STEP, wasdIntent, wasdTarget } from "./input";

const none = { w: false, a: false, s: false, d: false };
const free = (_ax: number, _az: number, x: number, z: number) => ({ x, z });

afterEach(() => {
  clearKeyboardMove();
  clearVirtualStick();
});
// Fake iso: screen right = +x/-z, screen down = +x/+z.
const pick = (sx: number, sy: number): [number, number] => [(sx / 32 + sy / 16) / 2, (sy / 16 - sx / 32) / 2];

test("isoScreenPick is the flat iso inverse (no relief veer)", () => {
  assert.deepEqual(isoScreenPick(320, 180), [0, 0]);
  const origin = pick(320, 180);
  for (const [sx, sy] of [[320, 116], [384, 180], [256, 244]] as const) {
    const a = isoScreenPick(sx, sy);
    const b = pick(sx, sy);
    assert.ok(Math.abs(a[0] - (b[0] - origin[0])) < 1e-9 && Math.abs(a[1] - (b[1] - origin[1])) < 1e-9, `${sx},${sy}`);
  }
  const me = { x: 0, z: 40 };
  const keys = { ...none, w: true };
  const viaPick = wasdTarget(keys, me, pick, [320, 180], free)!;
  const viaIso = wasdTarget(keys, me, isoScreenPick, [320, 180], free)!;
  assert.ok(Math.abs(viaPick.x - viaIso.x) < 1e-9 && Math.abs(viaPick.z - viaIso.z) < 1e-9);
});

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
  assert.equal(shouldResend(prev, { keys: "w", heading: 0.4, at: 1060 }, me), true);
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
  const analogFwd = dashDirection(none, me, 0, null, null, { nx: 0, ny: 1 });
  assert.ok(Math.abs(analogFwd.dx) < 1e-9 && Math.abs(analogFwd.dz - 1) < 1e-9, "3D analog up dashes along heading");
  const analogBack = dashDirection(none, me, 0, null, null, { nx: 0, ny: -1 });
  assert.ok(Math.abs(analogBack.dz + 1) < 1e-9, "3D analog down dashes back");
});

test("analog stick up matches iso W, not facing", () => {
  const me = { x: 3, z: 40 };
  const analog = analogScreenTarget({ nx: 0, ny: 1 }, me, pick, [320, 180], free)!;
  const keyW = wasdTarget({ ...none, w: true }, me, pick, [320, 180], free)!;
  assert.ok(Math.abs(analog.x - keyW.x) < 1e-9 && Math.abs(analog.z - keyW.z) < 1e-9);
});

test("iso stick-right is screen-right (+x −z); 3D +nx strafe is screen-right after negate", () => {
  const me = { x: 0, z: 0 };
  setVirtualStick(1, 0);
  const isoKeys = getMoveKeys();
  assert.equal(isoKeys.d, true);
  assert.equal(isoKeys.a, false);
  const iso = wasdTarget(isoKeys, me, pick, [320, 180], free)!;
  assert.ok(iso.x > 0 && iso.z < 0, "iso D is screen-right (+x −z)");
  const h = 0;
  const right = headingTarget(isoKeys, me, h, free, -1)!;
  assert.ok(right.x < 0 && Math.abs(right.z) < 1e-9, "negated +nx is −X = View.basis screen-right at yaw 0");
  const unflipped = headingTarget(isoKeys, me, h, free, 1)!;
  assert.ok(unflipped.x > 0, "un-negated +nx is heading-right / screen-left");
  clearVirtualStick();
});

test("W then S reverses instead of coasting on lastWasd", () => {
  setKeyboardMoveKey("w", true);
  setVirtualStick(0, -1);
  const keys = getMoveKeys();
  assert.equal(keys.w, false);
  assert.equal(keys.s, true);
  const me = { x: 0, z: 0 };
  const t = headingTarget(keys, me, 0, free)!;
  assert.ok(t.z < 0, "S against heading 0 is −Z");
  assert.equal(headingTarget({ w: true, a: false, s: true, d: false }, me, 0, free), null, "uncancelled W+S is idle");
  clearKeyboardMove();
  clearVirtualStick();
});

test("keyboard WASD is unchanged without a stick", () => {
  clearVirtualStick();
  setKeyboardMoveKey("w", true);
  setKeyboardMoveKey("d", true);
  assert.deepEqual(getMoveKeys(), { w: true, a: false, s: false, d: true });
  const me = { x: 3, z: 40 };
  assert.deepEqual(
    wasdIntent({ view: "iso", keys: getMoveKeys(), me, heading: 0, pick, center: [320, 180], clamp: free }),
    wasdTarget({ w: true, a: false, s: false, d: true }, me, pick, [320, 180], free),
  );
  clearKeyboardMove();
});

test("zone change and overlay dash gates are wired in StickWorld", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./StickWorld.tsx", import.meta.url), "utf8");
  assert.match(src, /localDash = null/);
  assert.match(src, /cancelDash/);
  assert.match(src, /playOverlayBlocksDash/);
  assert.match(src, /clickHoldKeys/);
  assert.match(src, /getKeyboardMoveKeys/);
  assert.match(src, /arcadeBlocksGroundClick/);
  assert.match(src, /virtualStickHeld/);
  assert.match(src, /DASH_PRED_HOLD/);
  assert.match(src, /stick \? -stick\.nx : 0/);
  assert.match(src, /minimapEngineDock/);
  assert.match(src, /clickHoldKeys = null/);
  assert.match(src, /resume: !\(virtualStickHeld\(\) \|\| analog\) && !hudClick/);
  assert.match(src, /analogScreenTarget/);
  assert.match(src, /virtualStickReleasedRecently/);
  assert.match(src, /stopTarget\(feet, lastWasd\)/);
  assert.match(src, /shouldResend\(lastWasd, \{ keys: keyStr, heading: dir, at \}, feet\)/);
  assert.doesNotMatch(src, /analogDest/);
  assert.doesNotMatch(src, /clickHoldKeys !== null/);
  assert.doesNotMatch(src, /err > 2\.5/);
  assert.doesNotMatch(src, /\[8, 248, 148, 104\]/);
});

test("DASH_PRED_HOLD outlasts one snapshot", () => {
  assert.equal(DASH_PRED_HOLD, 400);
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

test("blendToward eases a predicted pose onto the snapshot without a teleport", () => {
  const a = blendToward({ x: 0, z: 0 }, { x: 3, z: 0 }, 1);
  assert.equal(a.done, false);
  assert.ok(Math.abs(a.x - 1) < 1e-9 && Math.abs(a.z) < 1e-9);
  const b = blendToward({ x: 0, z: 0 }, { x: RECONCILE_SNAP / 2, z: 0 }, 1);
  assert.equal(b.done, true);
  assert.equal(b.x, RECONCILE_SNAP / 2);
});

test("shouldResend: a wall-clipped step is not topped up every tick", () => {
  const me = { x: 0, z: 0 };
  const clipped = { keys: "w", heading: 0, at: 1000, x: 0, z: 1.2, full: false };
  assert.equal(shouldResend(clipped, { keys: "w", heading: 0, at: 1050 }, me), false, "no 20 Hz spam against a wall");
  assert.equal(shouldResend(clipped, { keys: "w", heading: 0, at: 1250 }, me), true, "keep-alive still fires");
  assert.equal(shouldResend({ ...clipped, full: true }, { keys: "w", heading: 0, at: 1050 }, me), true, "a full step is still topped up");
});

test("StickWorld: walk and dash share one yaw, and modifier chords are not movement", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./StickWorld.tsx", import.meta.url), "utf8");
  assert.match(src, /const moveYaw = \(\): number =>/);
  assert.match(src, /dashDirection\(keys, me, heading === null \? null : moveYaw\(\)/);
  assert.match(src, /!e\.ctrlKey && !e\.metaKey && !e\.altKey/);
  assert.match(src, /clearVirtualStick\(\);/);
  assert.match(src, /blendToward\(walkAhead, me, pace\)/);
});
