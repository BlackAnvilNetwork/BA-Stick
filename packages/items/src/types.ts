export type JobId =
  | "knight"
  | "rogue"
  | "cleric"
  | "sorcerer"
  | "fighter"
  | "battlemage"
  | "tim";

export const EQUIP_SLOTS = [
  "head",
  "body",
  "hands",
  "legs",
  "feet",
  "ring",
  "earring",
  "main",
  "sub",
  "grip",
  "ranged",
  "ammo",
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export type Equipment = Record<EquipSlot, number | null>;

export type CraftSkill =
  | "smithing"
  | "woodworking"
  | "leathercraft"
  | "clothcraft"
  | "bonecraft"
  | "goldsmithing"
  | "alchemy"
  | "cooking";

export type ItemKind =
  | "base"
  | "intermediate"
  | "equipment"
  | "consumable"
  | "filler"
  | "bait";

export type WeaponFamily =
  | "sword"
  | "greatsword"
  | "dagger"
  | "axe"
  | "staff"
  | "club"
  | "knuckles";

/** Derived from craft level (or drop rarity). */
export type ItemRarity = "Common" | "Uncommon" | "Rare" | "Epic";

export type ItemStats = {
  str?: number;
  dex?: number;
  vit?: number;
  agi?: number;
  int?: number;
  mnd?: number;
  atk?: number;
  def?: number;
  acc?: number;
  eva?: number;
  mab?: number;
  mdb?: number;
  hp?: number;
  mp?: number;
  /** Flat HP restored once per second while equipped. */
  regen?: number;
  /** Percent bonus to healing spells (Cleric healPower). */
  healPotency?: number;
};

export type ConsumeEffect = {
  hp?: number;
  mp?: number;
  statusClear?: string;
  foodDurationSec?: number;
  scrollSpellId?: string;
};

export type ItemDef = {
  id: number;
  name: string;
  description: string;
  icon: string;
  slug: string;
  kind: ItemKind;
  craftLevel?: number;
  craftSkill?: CraftSkill;
  slot?: EquipSlot;
  jobRestrict?: JobId[] | "all";
  twoHand?: boolean;
  delayMs?: number;
  stats?: ItemStats;
  rarity?: ItemRarity;
  consume?: ConsumeEffect;
  recipe?: {
    gold: number;
    materialsText: string;
    /** Structured materials when available (preferred over parsing materialsText). */
    materials?: { slug: string; qty: number }[];
  };
  /** When name is "Foo×N", craft grants this many (default 1). */
  craftOutputQty?: number;
  /** Zone / method text for base mats (from manifest Obtained From). */
  obtainedFrom?: string;
  /** Main-hand family for weapon skills (TP) and signature ability gates. */
  weaponFamily?: WeaponFamily;
};

/** Craft fee: 50 + 20×craftLevel (audit MED-8). */
export function craftGoldCost(craftLevel: number): number {
  return 50 + 20 * Math.max(0, Math.floor(craftLevel));
}

/** Pack yield from authored craftOutputQty or ×N in the name. */
export function craftOutputQty(def: Pick<ItemDef, "name" | "craftOutputQty">): number {
  if (def.craftOutputQty != null && def.craftOutputQty > 0) return Math.floor(def.craftOutputQty);
  const m = /×(\d+)\s*$/u.exec(def.name);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/** HQ = NQ × 1.25 (ceil) for numeric combat fields. */
export function hqStats(nq: ItemStats | undefined): ItemStats {
  if (!nq) return {};
  const out: ItemStats = {};
  for (const [k, v] of Object.entries(nq) as [keyof ItemStats, number | undefined][]) {
    if (typeof v === "number") out[k] = Math.ceil(v * 1.25);
  }
  return out;
}

export function budgetPoints(craftLevel: number): number {
  return Math.max(1, Math.floor(craftLevel / 5) + 1);
}
