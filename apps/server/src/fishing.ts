/**
 * Fish nodes spend bait and require a rod. Harvest and mine nodes do not.
 *
 * Every catalog bait says it attracts fossil fish, and Pale Hollow's only fish
 * yield is fossil-minnow, so any bait works. The cheapest stack is spent first.
 */
import { getItem } from "@bellgrave/items";

export type BagStack = { tokenId: number; amount: number };

export type BaitPick = { tokenId: number; label: string; craftLevel: number };

export function isFishingRod(tokenId: number | null | undefined): boolean {
  if (tokenId == null) return false;
  const def = getItem(tokenId);
  return !!def && def.kind === "equipment" && def.slot === "main" && def.slug.endsWith("-fishing-rod");
}

function baitLabel(name: string): string {
  return name.replace(/×\d+\s*$/u, "").trim();
}

/** Lowest craft level bait the bag still holds. */
export function cheapestBait(inventory: readonly BagStack[]): BaitPick | null {
  let best: BaitPick | null = null;
  for (const row of inventory) {
    if (!Number.isFinite(row.amount) || row.amount <= 0) continue;
    const def = getItem(row.tokenId);
    if (!def || def.kind !== "bait") continue;
    const craftLevel = def.craftLevel ?? 0;
    if (best && (craftLevel > best.craftLevel || (craftLevel === best.craftLevel && row.tokenId >= best.tokenId))) {
      continue;
    }
    best = { tokenId: row.tokenId, label: baitLabel(def.name), craftLevel };
  }
  return best;
}

/** Why this gather cannot start or finish. Null when the node is not fish, or the fisher is ready. */
export function fishGatherRefusal(
  nodeKind: string,
  mainTokenId: number | null | undefined,
  inventory: readonly BagStack[],
): string | null {
  if (nodeKind !== "fish") return null;
  if (!isFishingRod(mainTokenId)) return "Equip a fishing rod to fish.";
  if (!cheapestBait(inventory)) return "You need bait to fish.";
  return null;
}
