import type { ItemRarity } from "./types";

export const ITEM_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
] as const satisfies readonly ItemRarity[];

/** Name tokens → rarity. Plain material names stay common; lore names go legendary. */
const NAME_TIERS: readonly [ItemRarity, readonly string[]][] = [
  [
    "Legendary",
    [
      "palace",
      "throneweave",
      "throne",
      "sovereign",
      "royal",
      "chrono",
      "mana staff",
      "decayed sword",
      "grimoire of throne",
      "last company",
      "first pit",
    ],
  ],
  [
    "Epic",
    [
      "darksteel",
      "orichalcum",
      "scale mail",
      "cleric's",
      "mercenary",
      "fang dagger",
      "decayed axe",
      "diamond earring",
      "jadeite earring",
      "bellwood ice",
      "bellwood wind",
    ],
  ],
  [
    "Rare",
    [
      "mythril",
      "velvet",
      "battleweave",
      "altarweave",
      "spellbound",
      "neolithic",
      "scarabrace",
      "heart",
      "skull",
      "diamond ring",
      "composite",
      "decayed greaves",
      "fang earring",
      "silk coat",
      "rogue's",
    ],
  ],
  [
    "Uncommon",
    [
      "steel",
      "shade",
      "fine",
      "silk",
      "bloodbeam",
      "bellwood",
      "scale harness",
      "circlet",
      "onyx",
      "lapis",
      "turtle",
      "horn",
      "shell",
      "bell ring",
      "bell torque",
    ],
  ],
  [
    "Common",
    [
      "bronze",
      "iron",
      "linen",
      "leather",
      "bone",
      "ashbeam",
      "copper",
      "buckler",
      "chainmail",
      "grip wrap",
      "war bow",
      "fishing",
    ],
  ],
];

/** Rarity from the item's name, not its iLvl. */
export function rarityFromName(name: string): ItemRarity {
  const n = name.trim().toLowerCase();
  if (n.includes("fishing rod")) return "Common";
  for (const [rarity, tokens] of NAME_TIERS) {
    if (tokens.some((t) => n.includes(t))) return rarity;
  }
  return "Common";
}

/** @deprecated use rarityFromName — kept so old call sites compile. */
export function pepperRarity(id: number, name?: string): ItemRarity {
  if (name) return rarityFromName(name);
  return "Common";
}

export function rarityClass(rarity: string | undefined): string {
  if (!rarity) return "";
  return `item-rarity-${rarity.toLowerCase()}`;
}

export function hashId(id: number): number {
  let x = (Math.imul(id, 0x9e3779b9) >>> 0) ^ 0x5bd1e995;
  x ^= x >> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  return (x ^ (x >>> 12)) >>> 0;
}
