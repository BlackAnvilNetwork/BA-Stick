import {
  CATALOG,
  EQUIP_SLOTS,
  itemFitsEquipSlot,
  type EquipSlot,
  type ItemDef,
  type ItemKind,
  type WeaponFamily,
} from "@bellgrave/items";

export const KIND_TREE: { kind: ItemKind; label: string; slots: boolean }[] = [
  { kind: "base", label: "Materials", slots: false },
  { kind: "intermediate", label: "Components", slots: false },
  { kind: "consumable", label: "Consumables", slots: false },
  { kind: "bait", label: "Bait", slots: false },
  { kind: "filler", label: "Filler", slots: false },
  { kind: "equipment", label: "Equipment", slots: true },
];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  head: "Head",
  body: "Body",
  hands: "Hands",
  legs: "Legs",
  feet: "Feet",
  ring: "Ring",
  ring2: "Ring 2",
  earring: "Earring",
  main: "Main hand",
  sub: "Off hand",
  grip: "Grip",
  ranged: "Ranged",
  ammo: "Ammo",
};

/** Main-hand weapon families for AH / wiki subgroups (stable order). */
export const WEAPON_FAMILIES: readonly WeaponFamily[] = [
  "sword",
  "greatsword",
  "dagger",
  "axe",
  "staff",
  "club",
  "knuckles",
] as const;

export const WEAPON_FAMILY_LABEL: Record<WeaponFamily, string> = {
  sword: "Swords",
  greatsword: "Greatswords",
  dagger: "Daggers",
  axe: "Axes",
  staff: "Staves",
  club: "Clubs",
  knuckles: "Knuckles",
};

export function weaponCategoryId(family: WeaponFamily): string {
  return "weapon:" + family;
}

/** Synth mats named like `*-knuckles` (bonecraft blanks), not equippable weapons yet. */
export function weaponCraftComponentFamily(def: ItemDef): WeaponFamily | null {
  if (def.kind === "equipment") return null;
  if (def.slug.endsWith("-knuckles") || def.slug === "knuckles") return "knuckles";
  return null;
}

/** Crafted arrow stacks (catalog consumables today); excludes `*-arrowhead` synth mats. */
export function isAmmoCatalogItem(def: ItemDef): boolean {
  if (def.kind === "equipment" && def.slot === "ammo") return true;
  const slug = def.slug;
  return slug.endsWith("-arrow") && !slug.endsWith("-arrowhead");
}

export function matchesCategory(def: ItemDef, selected: string): boolean {
  if (selected.startsWith("weapon:")) {
    const family = selected.slice(7) as WeaponFamily;
    if (def.kind === "equipment" && def.slot === "main" && def.weaponFamily === family) {
      return true;
    }
    return weaponCraftComponentFamily(def) === family;
  }
  if (selected.startsWith("slot:")) {
    const slot = selected.slice(5) as EquipSlot;
    if (slot === "ammo") return isAmmoCatalogItem(def);
    return def.kind === "equipment" && !!def.slot && itemFitsEquipSlot(def.slot, slot);
  }
  if (selected.startsWith("kind:")) return def.kind === selected.slice(5);
  return false;
}

export type CatalogSort = "name" | "level";

export function compareCatalogDefs(a: ItemDef, b: ItemDef, sort: CatalogSort): number {
  if (sort === "level") {
    const la = a.craftLevel ?? Number.POSITIVE_INFINITY;
    const lb = b.craftLevel ?? Number.POSITIVE_INFINITY;
    if (la !== lb) return la - lb;
  }
  return a.name.localeCompare(b.name) || a.id - b.id;
}

export function categoryCount(selected: string, query: string): number {
  const q = query.trim().toLowerCase();
  let count = 0;
  for (const def of CATALOG) {
    if (!matchesCategory(def, selected)) continue;
    if (q && !def.name.toLowerCase().includes(q) && !def.slug.includes(q)) continue;
    count += 1;
  }
  return count;
}

export { EQUIP_SLOTS };
