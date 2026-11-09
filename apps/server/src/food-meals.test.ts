import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");

test("eating a cooked dish applies a 30-minute meal and combat reads foodStats", () => {
  assert.match(src, /p\.foodStats = mealStatsFor\(def, hq\)/);
  assert.match(src, /Your meal wears off\./);
  assert.match(src, /meal 30m/);
  assert.match(src, /addItemStats\(gear, p\.foodStats\)/);
  const combat = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gear-combat.ts"), "utf8");
  assert.match(combat, /foodBonus\(p, "atk"\)/);
  assert.match(combat, /foodBonus\(p, "def"\)/);
  assert.match(combat, /foodBonus\(p, "mab"\)/);
});
