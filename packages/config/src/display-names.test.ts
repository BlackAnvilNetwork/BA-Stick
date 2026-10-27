import assert from "node:assert/strict";
import { test } from "node:test";
import { ZONES } from "./index";
import * as world from "./world";

const LEGACY = /\b(kek|bellgrave|coldhearth|legend of kek)\b/i;

test("zone display names carry no legacy names", () => {
  for (const z of Object.values(ZONES) as { name: string }[]) {
    assert.doesNotMatch(z.name, LEGACY, z.name);
  }
});

test("the Citadel is named the Citadel of the Seven Seats", () => {
  const names = (Object.values(ZONES) as { name: string }[]).map((z) => z.name);
  assert.ok(names.some((n) => n === "The Citadel of the Seven Seats"));
});

test("world zone names carry no legacy names", () => {
  const seen = JSON.stringify(world, (k, v) => (typeof v === "function" ? undefined : v));
  for (const m of seen.matchAll(/"name":"([^"]*)"/g)) assert.doesNotMatch(m[1], LEGACY, m[1]);
});
