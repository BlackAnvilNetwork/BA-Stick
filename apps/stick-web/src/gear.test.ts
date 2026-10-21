import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, getItem } from "../../../packages/items/src/index.ts";
import { familyOf, gearArgs, materialOf } from "./gear.ts";

test("every equipment item maps to a look", () => {
  for (const it of CATALOG.filter((i) => i.kind === "equipment")) {
    assert.ok(materialOf(it) >= 1 && materialOf(it) <= 6, it.slug);
    if (it.slot === "main") assert.ok(familyOf(it) >= 1 && familyOf(it) <= 7, it.slug);
  }
});

test("gear args from equipment", () => {
  const staff = CATALOG.find((i) => i.slug === "ashbeam-staff")!;
  const robe = CATALOG.find((i) => i.slug === "linen-robe")!;
  const a = gearArgs({ main: staff.id, body: robe.id, head: null }, getItem);
  assert.deepEqual(a, [5, 4, staff.id, 1, robe.id, 0, 0, 0, 0]);
  assert.deepEqual(gearArgs(undefined, getItem), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});
