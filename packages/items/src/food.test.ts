import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG } from "./catalog.generated";
import {
  FOOD_DURATION_SEC,
  foodKindOf,
  foodRank,
  foodStatsFor,
  formatFoodUseLine,
  isFoodItem,
  mealStatsFor,
} from "./food";

test("cooking consumables are 30-minute meals whose stats follow the dish and recipe level", () => {
  const foods = CATALOG.filter(isFoodItem);
  assert.ok(foods.length >= 12, `expected cooked dishes, got ${foods.length}`);
  for (const def of foods) {
    assert.equal(def.consume?.foodDurationSec, FOOD_DURATION_SEC, def.slug);
    assert.deepEqual(def.stats, foodStatsFor(def), def.slug);
    assert.ok(Object.values(def.stats ?? {}).some((n) => typeof n === "number" && n > 0), def.slug);
    assert.ok((def.consume?.hp ?? 0) > 0, `${def.slug} still has a bite heal`);
  }
  assert.equal(foodKindOf("Dustbread"), "grain");
  assert.equal(foodKindOf("Fossil Grill"), "meat");
  assert.equal(foodKindOf("Carp Steak"), "meat");
  assert.equal(foodKindOf("Claycrab Stew"), "stew");
  assert.equal(foodKindOf("Mage Biscuits"), "mage");
  assert.equal(foodKindOf("Rogue Jerky"), "rogue");
  assert.equal(foodKindOf("Eel Skewer"), "fish");
  assert.equal(foodKindOf("Koi Sashimi"), "fish");
  assert.equal(foodKindOf("Glass Eel Noodles"), "noodles");
  assert.equal(foodKindOf("Throne Feast"), "feast");
  assert.equal(foodKindOf("Coronation Banquet"), "feast");
  const steak = foodStatsFor({ name: "Carp Steak", craftLevel: 40 });
  const bread = foodStatsFor({ name: "Dried Ration", craftLevel: 1 });
  const feast = foodStatsFor({ name: "Coronation Banquet", craftLevel: 100 });
  assert.ok((steak.str ?? 0) > (bread.vit ?? 0) || (steak.atk ?? 0) > (bread.def ?? 0));
  assert.equal(steak.str, foodRank(40).major);
  assert.equal(feast.str, foodRank(100).all);
  assert.equal(feast.int, feast.str);
  assert.ok((mealStatsFor({ name: "Dustbread", craftLevel: 5, kind: "consumable", craftSkill: "cooking" }, true).vit ?? 0) >
    (mealStatsFor({ name: "Dustbread", craftLevel: 5, kind: "consumable", craftSkill: "cooking" }).vit ?? 0));
  assert.equal(CATALOG.find((i) => i.slug === "potion")?.consume?.foodDurationSec, undefined);
  assert.ok(CATALOG.some((i) => i.kind === "bait" && i.craftSkill === "cooking"));
  assert.match(formatFoodUseLine(foods[0]!), /^Meal 30m · /);
});
