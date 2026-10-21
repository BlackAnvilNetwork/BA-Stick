import { test } from "node:test";
import assert from "node:assert/strict";
import { atmosphereFor, initialUiSettings } from "./mobile.ts";

const base = { color: "gold", font: "cinzel", layout: "regular", view: "iso", pixel: "crisp" } as const;

test("touch devices default to the arcade layout", () => {
  assert.equal(initialUiSettings(null, base, true).layout, "mobile");
});
test("fine pointers keep regular", () => {
  assert.equal(initialUiSettings(null, base, false).layout, "regular");
});
test("a saved choice wins", () => {
  assert.equal(initialUiSettings("{}", base, true).layout, "regular");
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

test("atmosphere off on touch, overridable", () => {
  assert.equal(atmosphereFor(true, ""), false);
  assert.equal(atmosphereFor(false, ""), true);
  assert.equal(atmosphereFor(true, "?atmo=1"), true);
});
