import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, getItem } from "../../../packages/items/src/index.ts";
import { FAMILY, familyOf, gearArgs, materialOf } from "./gear.ts";

test("every equipment item maps to a look", () => {
  for (const it of CATALOG.filter((i) => i.kind === "equipment")) {
    assert.ok(materialOf(it) >= 1 && materialOf(it) <= 6, it.slug);
    if (it.slot === "main") assert.ok(familyOf(it) >= 1 && familyOf(it) <= 7, it.slug);
  }
});

test("decayed axe uses axe family for in-world pixel draw", () => {
  const decayed = getItem(1065)!;
  assert.equal(decayed.slug, "decayed-axe");
  assert.equal(familyOf(decayed), FAMILY.axe);
  const a = gearArgs({ main: 1065 }, getItem);
  assert.equal(a[0], FAMILY.axe);
  assert.equal(a[2], 1065);
});

test("decayed sword uses sword family for in-world pixel draw", () => {
  const decayed = getItem(1064)!;
  assert.equal(decayed.slug, "decayed-sword");
  assert.equal(familyOf(decayed), FAMILY.sword);
  const a = gearArgs({ main: 1064 }, getItem);
  assert.equal(a[0], FAMILY.sword);
  assert.equal(a[2], 1064);
});

test("gear args from equipment", () => {
  const staff = CATALOG.find((i) => i.slug === "ashbeam-staff")!;
  const robe = CATALOG.find((i) => i.slug === "linen-robe")!;
  const a = gearArgs({ main: staff.id, body: robe.id, head: null }, getItem);
  assert.deepEqual(a, [5, 4, staff.id, 1, robe.id, 0, 0, 0, 0]);
  assert.deepEqual(gearArgs(undefined, getItem), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});
