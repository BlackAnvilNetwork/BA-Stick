import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateEquipmentStatsScaled, getItem } from "./index";
import { hqAmount, hqCraftChance, hqStats } from "./types";

describe("hqCraftChance", () => {
  it("stays off for mats and under-level synth", () => {
    assert.equal(hqCraftChance("base", 50, 1), 0);
    assert.equal(hqCraftChance("bait", 50, 1), 0);
    assert.equal(hqCraftChance("intermediate", 50, 1), 0);
    assert.equal(hqCraftChance("equipment", 4, 5), 0);
  });

  it("is 2% at the recipe level and caps at 25%", () => {
    assert.equal(hqCraftChance("equipment", 15, 15), 0.02);
    assert.equal(hqCraftChance("consumable", 16, 15), 0.03);
    assert.equal(hqCraftChance("equipment", 100, 1), 0.25);
  });
});

describe("hq gear stats", () => {
  it("ceils catalog stats by 1.25 before level scaling", () => {
    const mail = getItem(5);
    assert.ok(mail?.stats?.def);
    const hq = hqStats(mail.stats);
    assert.equal(hq.def, hqAmount(mail.stats.def!));
    const worn = aggregateEquipmentStatsScaled({ body: 5 }, 99, { body: true });
    assert.equal(worn.def, hq.def);
    const normal = aggregateEquipmentStatsScaled({ body: 5 }, 99);
    assert.equal(normal.def, mail.stats.def);
    assert.ok((worn.def ?? 0) > (normal.def ?? 0));
  });
});
