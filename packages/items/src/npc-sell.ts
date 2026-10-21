/**
 * NPC Provisioner buyback unit prices (gold).
 * Units are pinned in `npc-sell-units.generated.ts` / engine `npc_price_data.rs`
 * so craft-fee edits cannot rewrite committed GoldSell amounts.
 */
import { CATALOG_BY_ID } from "./catalog.generated";
import { NPC_SELL_UNITS } from "./npc-sell-units.generated";
import type { ItemDef } from "./types";

/** Pre-audit flat craft fee — basis for pricing *new* catalog ids only. */
export const NPC_SELL_GOLD_BASIS = 1000;

function getItem(id: number): ItemDef | undefined {
  return CATALOG_BY_ID[id];
}

/** Fallback for ids missing from the pin (should not happen after gen). */
export function npcSellUnitFromDef(def: ItemDef): number {
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
      return Math.max(3, Math.floor(NPC_SELL_GOLD_BASIS / 50));
    case "equipment":
      return Math.max(15, Math.floor(NPC_SELL_GOLD_BASIS / 20) + Math.floor(craft / 5));
    default:
      return Math.max(1, Math.floor(NPC_SELL_GOLD_BASIS / 25));
  }
}

export function npcSellUnitGold(itemId: number): number | null {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return null;
  const pinned = NPC_SELL_UNITS[itemId];
  if (typeof pinned === "number" && pinned > 0) return pinned;
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
