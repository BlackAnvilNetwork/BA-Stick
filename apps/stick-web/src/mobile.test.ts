import { test } from "node:test";
import assert from "node:assert/strict";
import { atmosphereFor, initialUiSettings, keylightFor } from "./mobile.ts";

const base = { color: "gold", font: "cinzel", layout: "regular", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 } as const;

test("touch devices default to the arcade layout", () => {
  assert.equal(initialUiSettings(null, base, true, 390).layout, "mobile");
});
test("fine pointers keep regular", () => {
  assert.equal(initialUiSettings(null, base, false, 390).layout, "regular");
});
test("an explicit saved layout wins", () => {
  assert.equal(initialUiSettings('{"layout":"regular"}', base, true, 390).layout, "regular");
});
test("empty saved blob does not trap Regular on a coarse phone", () => {
  assert.equal(initialUiSettings("{}", base, true, 390).layout, "mobile");
});
test("iPad landscape does not auto-force arcade", () => {
  assert.equal(initialUiSettings(null, base, true, 1180).layout, "regular");
});
test("coarse and narrow still defaults to arcade", () => {
  assert.equal(initialUiSettings(null, base, true).layout, "mobile");
});

import { fbFromClient, fbToClient } from "./fit.ts";
test("cover mapping round-trips on a portrait phone", () => {
  const r = { left: 0, top: 0, width: 393, height: 851 };
  const [fx, fy] = fbFromClient(r, 200, 260, true);
  assert.ok(fy > 0 && fy < 360 && fx > 0 && fx < 640);
  const [cx, cy] = fbToClient(393, 851, fx, fy, true);
  assert.ok(Math.abs(cx - 200) < 1e-6 && Math.abs(cy - 260) < 1e-6);
});
test("contain letterbox puts a portrait tap above the image", () => {
  const [, fy] = fbFromClient({ left: 0, top: 0, width: 393, height: 851 }, 200, 260, false);
  assert.ok(fy < 0);
});
test("cover fills a wide desktop window without letterbox hits", () => {
  const r = { left: 0, top: 0, width: 1920, height: 900 };
  const [fx, fy] = fbFromClient(r, 960, 450, true);
  assert.ok(fx >= 0 && fx <= 640 && fy >= 0 && fy <= 360);
  const [cx, cy] = fbToClient(1920, 900, fx, fy, true);
  assert.ok(Math.abs(cx - 960) < 1e-6 && Math.abs(cy - 450) < 1e-6);
});

test("atmosphere off on touch, overridable", () => {
  assert.equal(atmosphereFor(true, ""), false);
  assert.equal(atmosphereFor(false, ""), true);
  assert.equal(atmosphereFor(true, "?atmo=1"), true);
});

test("keylight: on for desktop, off for touch, ?keylight=0 kills it", () => {
  assert.equal(keylightFor(false, ""), true);
  assert.equal(keylightFor(true, ""), false);
  assert.equal(keylightFor(false, "?keylight=0"), false);
  assert.equal(keylightFor(true, "?keylight"), true);
  assert.equal(keylightFor(false, "?atmo=0"), false);
});
