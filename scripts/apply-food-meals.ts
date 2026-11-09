import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FOOD_DURATION_SEC, foodBiteHeal, foodStatsFor, isFoodItem } from "../packages/items/src/food.ts";
import type { ItemDef } from "../packages/items/src/types.ts";

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../packages/items/src/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as ItemDef[];
let n = 0;
for (const item of catalog) {
  if (!isFoodItem(item)) continue;
  item.stats = foodStatsFor(item);
  item.consume = {
    ...(item.consume ?? {}),
    hp: foodBiteHeal(item),
    foodDurationSec: FOOD_DURATION_SEC,
  };
  n += 1;
}
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`patched ${n} cooked dishes`);
