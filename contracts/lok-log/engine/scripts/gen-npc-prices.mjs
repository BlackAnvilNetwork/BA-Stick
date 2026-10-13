#!/usr/bin/env node
/** Regenerate npc_price_data.rs from packages/items/src/catalog.json */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const catalog = JSON.parse(readFileSync(join(root, "packages/items/src/catalog.json"), "utf8"));

function unitOf(i) {
  const gold = i.recipe?.gold ?? 0;
  const craft = i.craftLevel ?? 1;
  switch (i.kind) {
    case "base":
      return 2;
    case "filler":
    case "bait":
      return 1;
    case "intermediate":
      return Math.max(5, 5 + Math.floor(craft / 10));
    case "consumable":
      return Math.max(3, Math.floor((gold || 100) / 50));
    case "equipment":
      return Math.max(15, Math.floor((gold || 1000) / 20) + Math.floor(craft / 5));
    default:
      return Math.max(1, Math.floor((gold || 50) / 25));
  }
}

const rows = catalog.map((i) => [i.id, unitOf(i)]).sort((a, b) => a[0] - b[0]);
const lines = [
  "//! Auto-generated from packages/items/src/catalog.json — do not edit by hand.",
  "//! Regenerate: node contracts/lok-log/engine/scripts/gen-npc-prices.mjs",
  "",
  "/// Sorted (item_id, unit_gold) pairs from the item catalog.",
  "pub const NPC_SELL_UNITS: &[(u64, u64)] = &[",
  ...rows.map(([id, u]) => `    (${id}, ${u}),`),
  "];",
  "",
];
writeFileSync(join(root, "contracts/lok-log/engine/src/npc_price_data.rs"), lines.join("\n"));
console.log("npc_price_data.rs:", rows.length, "items");
