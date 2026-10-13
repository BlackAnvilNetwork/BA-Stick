import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG, CATALOG_BY_ID } from "./catalog.generated";
import { craftGoldCost, craftOutputQty } from "./types";

describe("items audit catalog patches", () => {
  it("applies copper collar as earring utility", () => {
    const collar = CATALOG_BY_ID[304]!;
    assert.equal(collar.slot, "earring");
    assert.deepEqual(collar.stats, { str: 2, vit: 2, hp: 10 });
    assert.equal(collar.rarity, "Common");
  });

  it("caster books use MAB not ATK/STR", () => {
    assert.equal(CATALOG_BY_ID[59]!.stats?.mab, 17);
    assert.equal(CATALOG_BY_ID[59]!.stats?.atk, undefined);
    assert.equal(CATALOG_BY_ID[60]!.stats?.mab, 37);
    assert.equal(CATALOG_BY_ID[60]!.weaponFamily, "staff");
  });

  it("fishing rods are utility (no staff family, no MAB)", () => {
    for (const id of [39, 40, 41]) {
      const rod = CATALOG_BY_ID[id]!;
      assert.equal(rod.weaponFamily, undefined);
      assert.equal(rod.stats?.mab, undefined);
    }
  });

  it("Heart Ring has regen + healPotency + atk", () => {
    const heart = CATALOG_BY_ID[1063]!;
    assert.equal(heart.rarity, "Rare");
    assert.deepEqual(heart.stats, { regen: 1, healPotency: 5, atk: 6 });
  });

  it("pack crafts grant authored qty; gold scales with level", () => {
    const arrows = CATALOG_BY_ID[10]!;
    assert.equal(craftOutputQty(arrows), 6);
    assert.equal(arrows.recipe?.gold, craftGoldCost(arrows.craftLevel!));
    assert.equal(craftGoldCost(1), 70);
    assert.equal(craftGoldCost(50), 1050);
  });

  it("dead-end fillers lost recipes; equipment has rarity", () => {
    const deadFillerRecipes = CATALOG.filter((i) => i.kind === "filler" && i.recipe).length;
    assert.ok(deadFillerRecipes <= 15);
    const gear = CATALOG.filter((i) => i.kind === "equipment");
    assert.ok(gear.every((i) => i.rarity));
  });

  it("Rogue Bone Dagger and Cleric Ashbeam Club are Pale Hollow craftable", () => {
    const dagger = CATALOG_BY_ID[317]!;
    assert.match(dagger.recipe!.materialsText, /Bone Chip/);
    const club = CATALOG_BY_ID[183]!;
    assert.equal(club.craftLevel, 12);
    assert.match(club.recipe!.materialsText, /Ashbeam Lumber/);
  });

  it("bows dropped melee atk so they cannot stack into weaponBonus", () => {
    assert.equal(CATALOG_BY_ID[186]!.stats?.atk, undefined);
    assert.equal(CATALOG_BY_ID[204]!.stats?.atk, undefined);
  });
});
