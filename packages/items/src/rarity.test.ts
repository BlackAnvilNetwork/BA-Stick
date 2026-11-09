import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG } from "./catalog.generated";
import { ITEM_RARITIES, rarityFromName } from "./rarity";

function bandOf(lv: number | undefined): number {
  const n = Math.max(1, Math.floor(lv ?? 1));
  return Math.min(81, Math.floor((n - 1) / 20) * 20 + 1);
}

describe("item rarity follows the name", () => {
  it("plain names are Common; lore names are Legendary", () => {
    assert.equal(rarityFromName("Linen Robe"), "Common");
    assert.equal(rarityFromName("Iron Sword"), "Common");
    assert.equal(rarityFromName("Decayed Sword"), "Legendary");
    assert.equal(rarityFromName("Palace Plate"), "Legendary");
    assert.equal(rarityFromName("Sovereign's Staff"), "Legendary");
    assert.equal(rarityFromName("Heart Ring"), "Rare");
    assert.equal(rarityFromName("Altarweave Coat"), "Rare");
    assert.equal(rarityFromName("Battleweave Coat"), "Rare");
    assert.equal(rarityFromName("Iron Shield"), "Common");
    assert.equal(rarityFromName("Bloodbeam Crozier"), "Uncommon");
    assert.equal(rarityFromName("Ashbeam Tome"), "Common");
    assert.equal(rarityFromName("Bellwood Crozier"), "Uncommon");
    assert.equal(rarityFromName("Battleweave Cuffs"), "Rare");
    assert.equal(rarityFromName("Darksteel Targe"), "Epic");
    assert.equal(rarityFromName("Palace Shield"), "Legendary");
    assert.equal(rarityFromName("Battleweave Slacks"), "Rare");
    assert.equal(rarityFromName("Battleweave Pumps"), "Rare");
    assert.equal(rarityFromName("Altarweave Cuffs"), "Rare");
    assert.equal(rarityFromName("Altarweave Slacks"), "Rare");
    assert.equal(rarityFromName("Altarweave Pumps"), "Rare");
    assert.equal(rarityFromName("Battleweave Raiment"), "Rare");
    assert.equal(rarityFromName("Orichalcum Targe"), "Epic");
    assert.equal(rarityFromName("Throneweave Hat"), "Legendary");
    assert.equal(rarityFromName("Steel Sword"), "Uncommon");
    assert.equal(rarityFromName("Steel Mail"), "Uncommon");
    assert.equal(rarityFromName("Orichalcum Mail"), "Epic");
    assert.equal(rarityFromName("Rogue's Dagger"), "Rare");
    assert.equal(rarityFromName("Altarweave Hat"), "Rare");
    assert.equal(rarityFromName("Battleweave Hat"), "Rare");
    assert.equal(rarityFromName("Battleweave Hood"), "Rare");
    assert.equal(rarityFromName("Battleweave Gloves"), "Rare");
    assert.equal(rarityFromName("Rogue's Trousers"), "Rare");
    assert.equal(rarityFromName("Battleweave Hose"), "Rare");
    assert.equal(rarityFromName("Battleweave Slippers"), "Rare");
    assert.equal(rarityFromName("Orichalcum War Cuisses"), "Epic");
    assert.equal(rarityFromName("Throneweave Cuffs"), "Legendary");
    assert.equal(rarityFromName("Throneweave Slacks"), "Legendary");
    assert.equal(rarityFromName("Throneweave Pumps"), "Legendary");
    assert.equal(rarityFromName("Steel Helm"), "Uncommon");
    assert.equal(rarityFromName("Steel Mittens"), "Uncommon");
    assert.equal(rarityFromName("Steel Shield"), "Uncommon");
    assert.equal(rarityFromName("Steel Subligar"), "Uncommon");
    assert.equal(rarityFromName("Steel Sabatons"), "Uncommon");
    assert.equal(rarityFromName("Mythril Mail"), "Rare");
    assert.equal(rarityFromName("Darksteel Greatsword"), "Epic");
    assert.equal(rarityFromName("Orichalcum Greatsword"), "Epic");
    assert.equal(rarityFromName("Bronze Greatsword"), "Common");
    assert.equal(rarityFromName("Iron Axe"), "Common");
    assert.equal(rarityFromName("Steel Great Axe"), "Uncommon");
    assert.equal(rarityFromName("Mythril Targe"), "Rare");
    assert.equal(rarityFromName("Mythril Great Axe"), "Rare");
    assert.equal(rarityFromName("Mythril Dagger"), "Rare");
    assert.equal(rarityFromName("Darksteel Dagger"), "Epic");
    assert.equal(rarityFromName("Palace Sword"), "Legendary");
    assert.equal(rarityFromName("Bronze Dagger"), "Common");
    assert.equal(rarityFromName("Bronze Great Axe"), "Common");
    assert.equal(rarityFromName("Steel Dagger"), "Uncommon");
    assert.equal(rarityFromName("Steel Axe"), "Uncommon");
    assert.equal(rarityFromName("Mythril Axe"), "Rare");
    assert.equal(rarityFromName("Darksteel Axe"), "Epic");
    assert.equal(rarityFromName("Bone Gloves"), "Common");
    assert.equal(rarityFromName("Bone Boots"), "Common");
    assert.equal(rarityFromName("Bone Bracer"), "Common");
    assert.equal(rarityFromName("Scale Leather Chaps"), "Uncommon");
    assert.equal(rarityFromName("Orichalcum Axe"), "Epic");
    assert.equal(rarityFromName("Orichalcum Great Axe"), "Epic");
    assert.equal(rarityFromName("Orichalcum Shield"), "Epic");
    assert.equal(rarityFromName("Palace Greatsword"), "Legendary");
    assert.equal(rarityFromName("Palace Targe"), "Legendary");
    assert.equal(rarityFromName("Iron Nail×12"), "Common");
    assert.equal(rarityFromName("Slag DEX Elixir"), "Common");
    assert.equal(rarityFromName("Fine Leather Belt"), "Uncommon");
    assert.equal(rarityFromName("Decayed Axe"), "Epic");
    assert.equal(rarityFromName("Ashbeam Fishing Rod"), "Common");
    assert.equal(rarityFromName("Dustweave Cap"), "Uncommon");
    assert.equal(rarityFromName("Duskweave Coat"), "Epic");
    assert.equal(rarityFromName("Skull Harness"), "Legendary");
    assert.equal(rarityFromName("Last-Company Gloves"), "Legendary");
    assert.equal(rarityFromName("Mantle of the Last Company"), "Legendary");
    assert.equal(rarityFromName("Mayflower Ear-Drop"), "Rare");
    assert.equal(rarityFromName("Chalkreed Cuffs"), "Uncommon");
    assert.equal(rarityFromName("Wicklinen Robe"), "Rare");
    assert.equal(rarityFromName("Saltjack Cap"), "Epic");
    assert.equal(rarityFromName("Crownbone Gloves"), "Legendary");
    assert.equal(rarityFromName("Nighweave Pumps"), "Rare");
    assert.equal(rarityFromName("Ringweave Robe"), "Rare");
    assert.equal(rarityFromName("Iron Mace"), "Common");
    assert.equal(rarityFromName("Orichalcum Helm"), "Epic");
    assert.equal(rarityFromName("Palace Cudgel"), "Legendary");
    assert.equal(rarityFromName("Bronze Shortsword"), "Common");
    assert.equal(rarityFromName("Bronze Kris"), "Common");
    assert.equal(rarityFromName("Last-Company Trousers"), "Legendary");
    assert.equal(rarityFromName("Seedcloth Cowl"), "Uncommon");
    assert.equal(rarityFromName("Voidbraid Robe"), "Epic");
    assert.equal(rarityFromName("Crownplate Mail"), "Legendary");
    assert.equal(rarityFromName("Pitiron Sword"), "Uncommon");
  });

  it("catalog rarity matches the name", () => {
    for (const it of CATALOG.filter((i) => i.kind === "equipment")) {
      assert.equal(it.rarity, rarityFromName(it.name), `${it.name} iLv ${it.craftLevel}`);
    }
  });

  it("every 20-iLvl band with 8+ equipment still has multiple rarities", () => {
    const gear = CATALOG.filter((i) => i.kind === "equipment");
    const bands = new Map<number, Set<string>>();
    const sizes = new Map<number, number>();
    for (const it of gear) {
      const b = bandOf(it.craftLevel);
      if (!bands.has(b)) bands.set(b, new Set());
      if (it.rarity) bands.get(b)!.add(it.rarity);
      sizes.set(b, (sizes.get(b) ?? 0) + 1);
    }
    for (const [lo, have] of bands) {
      if ((sizes.get(lo) ?? 0) < 8) continue;
      assert.ok(have.size >= 3, `iLv ${lo}-${lo + 19} only ${[...have]}`);
      assert.ok(have.has("Common"), `iLv ${lo} missing Common`);
    }
    assert.ok(ITEM_RARITIES.length === 5);
  });

  it("low iLvl can be Legendary when the name is lore", () => {
    const decayed = CATALOG.find((i) => i.id === 1064)!;
    assert.equal(decayed.rarity, "Legendary");
    assert.ok((decayed.craftLevel ?? 0) <= 20);
  });
});
