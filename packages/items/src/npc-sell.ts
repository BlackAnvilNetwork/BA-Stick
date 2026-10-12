/**
 * NPC Provisioner buyback unit prices (gold). Keep in sync with
 * `contracts/lok-log/engine/src/npc_price.rs`.
 */
export function npcSellUnitGold(itemId: number): number | null {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return null;
  const unit = (() => {
    if (itemId <= 99) return 40 + (itemId % 20);
    if (itemId <= 299) return 25 + (itemId % 15);
    if (itemId <= 485) return 35 + (itemId % 25);
    if (itemId <= 1061) return 2 + (itemId % 5);
    return 10 + (itemId % 30);
  })();
  return Math.max(1, unit);
}

export function npcSellTotalGold(itemId: number, qty: number): number | null {
  const unit = npcSellUnitGold(itemId);
  if (unit == null || !Number.isSafeInteger(qty) || qty < 1) return null;
  const total = unit * qty;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
