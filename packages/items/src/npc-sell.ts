/**
 * NPC Provisioner buyback unit prices (gold).
 * Same formula as `contracts/lok-log/engine/scripts/gen-npc-prices.mjs`
 * / `npc_price_data.rs` — derived from catalog kind, craftLevel, recipe.gold.
 */
import { CATALOG_BY_ID } from "./catalog.generated";
import type { ItemDef } from "./types";

function getItem(id: number): ItemDef | undefined {
  return CATALOG_BY_ID[id];
}

export function npcSellUnitFromDef(def: ItemDef): number {
  const gold = def.recipe?.gold ?? 0;
  const craft = def.craftLevel ?? 1;
  switch (def.kind) {
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

export function npcSellUnitGold(itemId: number): number | null {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return null;
  const def = getItem(itemId);
  if (!def) return null;
  return Math.max(1, npcSellUnitFromDef(def));
}

export function npcSellTotalGold(itemId: number, qty: number): number | null {
  const unit = npcSellUnitGold(itemId);
  if (unit == null || !Number.isSafeInteger(qty) || qty < 1) return null;
  const total = unit * qty;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
