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

  it("Heart Ring has regen + healPotency + atk and is craftable at L12", () => {
    const heart = CATALOG_BY_ID[1063]!;
    assert.equal(heart.rarity, "Rare");
    assert.equal(heart.craftLevel, 12);
    assert.equal(heart.craftSkill, "goldsmithing");
    assert.deepEqual(heart.stats, { regen: 1, healPotency: 5, atk: 6 });
  });

  it("pack crafts grant authored qty; gold scales with level", () => {
    const arrows = CATALOG_BY_ID[10]!;
    assert.equal(craftOutputQty(arrows), 6);
    assert.equal(arrows.recipe?.gold, craftGoldCost(arrows.craftLevel!));
    assert.equal(craftGoldCost(1), 70);
    assert.equal(craftGoldCost(50), 1050);
  });

  it("crafted synth stock lives under materials, not filler", () => {
    const leftover = CATALOG.filter((i) => i.kind === "filler");
    assert.equal(leftover.length, 0, leftover.map((i) => i.slug).join(", "));
    assert.equal(CATALOG_BY_ID[19]!.kind, "base");
    assert.equal(CATALOG_BY_ID[19]!.slug, "ashbeam-peg");
    assert.equal(CATALOG_BY_ID[316]!.slug, "bone-knuckles");
    assert.equal(CATALOG_BY_ID[316]!.kind, "equipment");
    assert.equal(CATALOG_BY_ID[119]!.kind, "equipment");
    assert.ok(CATALOG_BY_ID[119]!.recipe);
    assert.equal(CATALOG_BY_ID[440]!.kind, "base");
    assert.ok(CATALOG_BY_ID[440]!.recipe);
    const gear = CATALOG.filter((i) => i.kind === "equipment");
    assert.ok(gear.every((i) => i.rarity));
    assert.ok(
      gear.every((i) => i.stats && Object.values(i.stats).some((v) => typeof v === "number" && v !== 0)),
    );
  });

  it("promoted synth armor and weapons have rarity, stats, and a slot", () => {
    const ids = [
      110, 119, 133, 145, 163, 170, 175, 178, 181, 189, 199, 210, 218, 244, 263, 274, 292, 295, 303,
      306, 316, 344, 348,
    ];
    for (const id of ids) {
      const def = CATALOG_BY_ID[id]!;
      assert.equal(def.kind, "equipment", def.slug);
      assert.ok(def.rarity, def.slug);
      assert.ok(def.slot, def.slug);
      assert.ok(def.stats && Object.values(def.stats).some((v) => typeof v === "number" && v !== 0), def.slug);
    }
    assert.equal(CATALOG_BY_ID[316]!.weaponFamily, "knuckles");
    assert.equal(CATALOG_BY_ID[119]!.slot, "sub");
    assert.equal(CATALOG_BY_ID[170]!.weaponFamily, "staff");
  });

  it("Rogue Bone Dagger and Cleric Ashbeam Club are Pale Hollow craftable", () => {
    const dagger = CATALOG_BY_ID[317]!;
    assert.match(dagger.recipe!.materialsText, /Bone Chip/);
    const club = CATALOG_BY_ID[183]!;
    assert.equal(club.craftLevel, 12);
    assert.match(club.recipe!.materialsText, /Ashbeam Lumber/);
  });

  it("bows dropped melee atk so they cannot stack into weaponBonus", () => {
    for (const id of [163, 178, 186, 199, 204]) {
      assert.equal(CATALOG_BY_ID[id]!.stats?.atk, undefined, CATALOG_BY_ID[id]!.slug);
    }
  });

  it("job gear-set fills close knight plate, cleric clubs, and druid cloth", () => {
    const breast = CATALOG_BY_ID[1228]!;
    assert.equal(breast.slug, "orichalcum-breastplate");
    assert.equal(breast.rarity, "Epic");
    assert.equal(breast.stats?.def, 52);
    const mace = CATALOG_BY_ID[1232]!;
    assert.equal(mace.weaponFamily, "club");
    assert.deepEqual(mace.jobRestrict, ["cleric"]);
    const robe = CATALOG_BY_ID[1237]!;
    assert.equal(robe.slug, "ringweave-robe");
    assert.deepEqual(robe.jobRestrict, ["druid"]);
    assert.equal(robe.stats?.mnd, 22);
    assert.equal(CATALOG_BY_ID[1241]!.weaponFamily, "sword");
    assert.deepEqual(CATALOG_BY_ID[1241]!.jobRestrict, ["fighter"]);
    assert.equal(CATALOG_BY_ID[1245]!.weaponFamily, "dagger");
  });

  it("every job has at least five items per armor/weapon/shield slot in each iLv band", () => {
    const jobs = ["knight", "rogue", "cleric", "sorcerer", "fighter", "battlemage", "tim", "druid"] as const;
    const slots = ["head", "body", "hands", "legs", "feet", "main", "sub"] as const;
    const bands = [
      [1, 20],
      [21, 40],
      [41, 60],
      [61, 80],
      [81, 100],
    ] as const;
    const wears = (it: (typeof CATALOG)[number], job: string) => {
      const jr = it.jobRestrict as string[] | undefined;
      return !jr || jr.includes(job);
    };
    for (const job of jobs) {
      for (const [lo, hi] of bands) {
        for (const slot of slots) {
          const n = CATALOG.filter(
            (it) =>
              it.kind === "equipment" &&
              it.slot === slot &&
              (it.craftLevel ?? 0) >= lo &&
              (it.craftLevel ?? 0) <= hi &&
              wears(it, job),
          ).length;
          assert.ok(n >= 5, `${job} ${slot} ${lo}-${hi} has ${n}`);
        }
      }
    }
  });

  it("Druid wears shared caster staffs, not job-unique books", () => {
    assert.ok(CATALOG_BY_ID[1]!.jobRestrict?.includes("druid"));
    assert.deepEqual(CATALOG_BY_ID[1075]!.jobRestrict, ["tim"]);
    assert.deepEqual(CATALOG_BY_ID[1074]!.jobRestrict, ["cleric"]);
  });
});
