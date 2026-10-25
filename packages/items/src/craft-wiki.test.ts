import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allCraftableRecipes,
  craftablesForSkill,
  getCraftableItem,
  maxCraftLevelForSkill,
  recipeMaterialGroups,
  recipeMaterialsComplete,
} from "./craft";
import { CATALOG_BY_ID } from "./catalog.generated";

test("craftablesForSkill lists recipes in ascending craft level", () => {
  const smith = craftablesForSkill("smithing");
  assert.ok(smith.length > 0);
  let prev = 0;
  for (const def of smith) {
    assert.equal(getCraftableItem(def.id), def);
    const lv = def.craftLevel ?? 0;
    assert.ok(lv >= prev, `${def.name} L${lv} after L${prev}`);
    prev = lv;
  }
  assert.equal(maxCraftLevelForSkill("smithing"), prev);
});

test("decayed sword recipe resolves dustgrain from catalog materialsText", () => {
  const def = CATALOG_BY_ID[1064];
  assert.ok(def);
  assert.equal(def!.craftSkill, "bonecraft");
  assert.equal(def!.craftLevel, 2);
  assert.ok(recipeMaterialsComplete(def!));
  const groups = recipeMaterialGroups(def!);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.options[0]!.slug, "dustgrain");
  assert.equal(groups[0]!.options[0]!.qty, 5);
  assert.ok(craftablesForSkill("bonecraft").some((i) => i.id === 1064));
});

test("decayed axe recipe resolves dustgrain and bonecraft level", () => {
  const def = CATALOG_BY_ID[1065];
  assert.ok(def);
  assert.equal(def!.craftSkill, "bonecraft");
  assert.equal(def!.craftLevel, 5);
  assert.equal(def!.stats?.atk, 6);
  assert.ok(recipeMaterialsComplete(def!));
  const groups = recipeMaterialGroups(def!);
  assert.equal(groups[0]!.options[0]!.slug, "dustgrain");
  assert.equal(groups[0]!.options[0]!.qty, 10);
});

test("smithing has craft recipes at levels 2 and 4", () => {
  const smith = craftablesForSkill("smithing");
  assert.ok(smith.some((i) => i.id === 1066 && i.craftLevel === 2));
  assert.ok(smith.some((i) => i.id === 1067 && i.craftLevel === 4));
  assert.ok(recipeMaterialsComplete(getCraftableItem(1066)!));
  assert.ok(recipeMaterialsComplete(getCraftableItem(1067)!));
});

test("allCraftableRecipes is sorted by level then name", () => {
  const all = allCraftableRecipes();
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!;
    const b = all[i]!;
    const dl = (a.craftLevel ?? 0) - (b.craftLevel ?? 0);
    assert.ok(dl <= 0, `${a.name} vs ${b.name}`);
    if (dl === 0) assert.ok(a.name.localeCompare(b.name) <= 0);
  }
});
