import type { JobId } from "@bellgrave/combat";
import { getItem, ITEM, type WeaponFamily } from "@bellgrave/items";

export type ItemStack = { tokenId: number; amount: number; starter?: boolean };

/**
 * Create-time weapon per combat job.
 * Catalog has no ilvl. craftLevel is the only level-like field, and nothing
 * of these families is craft level 1, so each job gets the lowest main-hand
 * weapon of the requested family.
 *
 * Names: time mage ? time_mage, battlemage ? battle_mage. There is no
 * chronomancer job.
 */
export const STARTER_WEAPON: Record<JobId, { tokenId: number; name: string; craftLevel: number }> = {
  time_mage: { tokenId: ITEM.STAFF_ASHBEAM, name: "Ashbeam Staff", craftLevel: 6 },
  fighter: { tokenId: ITEM.GREATSWORD_IRON, name: "Iron Greatsword", craftLevel: 34 },
  rogue: { tokenId: 317, name: "Bone Dagger", craftLevel: 8 },
  sorcerer: { tokenId: ITEM.STAFF_ASHBEAM, name: "Ashbeam Staff", craftLevel: 6 },
  cleric: { tokenId: 183, name: "Ashbeam Club", craftLevel: 12 },
  battle_mage: { tokenId: 102, name: "Bronze Sword", craftLevel: 5 },
  knight: { tokenId: 102, name: "Bronze Sword", craftLevel: 5 },
};

export const STARTER_POTION_ID = ITEM.POTION;
export const STARTER_POTION_AMOUNT = 3;

/**
 * Signature abilities gate on weapon **family**, not a single catalog id.
 * Crafted upgrades (Ashbeam Rod, Mythril Sword, …) keep the job kit online.
 */
export const SIGNATURE_WEAPON_FAMILIES: Record<JobId, readonly WeaponFamily[]> = {
  time_mage: ["staff"],
  sorcerer: ["staff"],
  fighter: ["greatsword", "axe"],
  rogue: ["dagger"],
  cleric: ["staff", "club"],
  knight: ["sword"],
  // Ashbeam Rod is staff; bronze/iron swords stay valid.
  battle_mage: ["sword", "staff"],
};

export function signatureWeaponEquipped(
  p: { equip: { main: number | null }; inventory: ItemStack[] },
  job: JobId,
): boolean {
  const id = p.equip.main;
  if (id == null) return false;
  if (!p.inventory.some((row) => row.tokenId === id && row.amount > 0)) return false;
  const families = SIGNATURE_WEAPON_FAMILIES[job];
  const family = getItem(id)?.weaponFamily;
  return family != null && families.includes(family);
}

export function stackAmount(inv: ItemStack[], tokenId: number): number {
  let n = 0;
  for (const row of inv) if (row.tokenId === tokenId) n += row.amount;
  return n;
}

export function starterAmount(inv: ItemStack[], tokenId: number): number {
  let n = 0;
  for (const row of inv) if (row.tokenId === tokenId && row.starter) n += row.amount;
  return n;
}

/** Starter stacks never merge with a later drop of the same item id. */
export function addStack(inv: ItemStack[], tokenId: number, amount: number, starter = false): void {
  if (amount <= 0) return;
  const row = inv.find((i) => i.tokenId === tokenId && !!i.starter === starter);
  if (row) row.amount += amount;
  else if (starter) inv.push({ tokenId, amount, starter: true });
  else inv.push({ tokenId, amount });
}

/**
 * Spend a normal stack before a starter stack so crafting cannot turn
 * starter gear into a sellable result.
 */
export function takeStack(inv: ItemStack[], tokenId: number, amount: number): boolean {
  if (amount <= 0) return false;
  if (stackAmount(inv, tokenId) < amount) return false;
  const rows = inv
    .filter((row) => row.tokenId === tokenId)
    .sort((a, b) => Number(!!a.starter) - Number(!!b.starter));
  let need = amount;
  for (const row of rows) {
    if (need <= 0) break;
    const use = Math.min(row.amount, need);
    row.amount -= use;
    need -= use;
  }
  for (let i = inv.length - 1; i >= 0; i--) {
    if (inv[i]!.amount <= 0) inv.splice(i, 1);
  }
  return true;
}

/** Delete one flagged stack. Returns how many were removed. Not a sale. */
export function discardStack(inv: ItemStack[], tokenId: number, starter: boolean): number {
  const idx = inv.findIndex((row) => row.tokenId === tokenId && !!row.starter === starter);
  if (idx < 0) return 0;
  const removed = inv[idx]!.amount;
  inv.splice(idx, 1);
  return removed;
}

export function starterWeaponName(tokenId: number): string {
  return getItem(tokenId)?.name ?? "weapon";
}
