import assert from "node:assert/strict";
import { test } from "node:test";
import { getItem } from "@bellgrave/items";
import { categoryCount, compareCatalogDefs, matchesCategory, weaponCategoryId } from "./catalog-tree";

test("level sort uses craftLevel then name", () => {
  const a = getItem(103)!;
  const b = getItem(60)!;
  assert.ok((a.craftLevel ?? 0) !== (b.craftLevel ?? 0));
  assert.ok(compareCatalogDefs(a, b, "level") !== 0);
  assert.equal(compareCatalogDefs(a, a, "level"), 0);
});

test("weapon subgroups filter by weaponFamily on main hand", () => {
  const swordId = weaponCategoryId("sword");
  assert.ok(categoryCount(swordId, "") > 0);
  for (const def of [getItem(103), getItem(60)]) {
    if (!def) continue;
    if (def.weaponFamily === "sword") assert.equal(matchesCategory(def, swordId), true);
    if (def.weaponFamily === "staff") assert.equal(matchesCategory(def, swordId), false);
  }
});

test("knuckles subgroup includes bonecraft knuckle synth mats", () => {
  const knId = weaponCategoryId("knuckles");
  // #93 removed the other three unwired knuckle fillers; Bone Knuckles is the one left.
  assert.equal(categoryCount(knId, ""), 1);
  assert.equal(categoryCount(knId, "ash"), 0);
  const boneKnuckles = getItem(316)!;
  assert.equal(boneKnuckles.kind, "filler");
  assert.equal(matchesCategory(boneKnuckles, knId), true);
});

test("ring2 slot lists catalog ring gear", () => {
  const ring = getItem(1063)!;
  assert.equal(ring.slot, "ring");
  assert.equal(matchesCategory(ring, "slot:ring"), true);
  assert.equal(matchesCategory(ring, "slot:ring2"), true);
  assert.equal(categoryCount("slot:ring2", ""), categoryCount("slot:ring", ""));
});

test("ammo slot includes crafted arrow stacks", () => {
  const ammoId = "slot:ammo";
  assert.equal(categoryCount(ammoId, ""), 4);
  const bronze = getItem(18)!;
  assert.equal(bronze.slug, "bronze-arrow");
  assert.equal(bronze.kind, "consumable");
  assert.equal(matchesCategory(bronze, ammoId), true);
  const head = getItem(17)!;
  assert.ok(head.slug.endsWith("arrowhead"));
  assert.equal(matchesCategory(head, ammoId), false);
});
