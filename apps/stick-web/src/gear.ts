import { DRUID_FORM_PRESET, isDruidForm } from "@bellgrave/combat";
import type { Equipment, ItemDef } from "@bellgrave/items";

/**
 * Gear visuals (#14): equipped catalog items → renderer `setGear` args.
 * Weapon family, material (craft skill) and the catalog id as a look seed,
 * so each item has a stable, distinct appearance. Cosmetic only.
 * Tier head helms map catalog id → matching `ba_*_helm` plate in the renderer.
 */
export const FAMILY: Record<string, number> = { sword: 1, greatsword: 2, dagger: 3, axe: 4, staff: 5, club: 6, knuckles: 7 };
export const MAT: Record<string, number> = { clothcraft: 1, leathercraft: 2, smithing: 3, woodworking: 4, bonecraft: 5, goldsmithing: 6 };

export function materialOf(item: ItemDef | undefined): number {
  if (!item) return 0;
  return MAT[item.craftSkill ?? ""] ?? 1;
}

/** Main-hand family; a two-handed blade counts as a greatsword, wooden mains without a family as staves. */
export function familyOf(item: ItemDef | undefined): number {
  if (!item) return 0;
  const fam = (item as ItemDef & { weaponFamily?: string }).weaponFamily;
  if (fam && FAMILY[fam]) return FAMILY[fam];
  if (item.craftSkill === "woodworking") return item.twoHand ? FAMILY.staff : FAMILY.club;
  return FAMILY.sword;
}

export type GearArgs = [number, number, number, number, number, number, number, number, number, number, number, number, number];

export function gearArgs(equip: Partial<Equipment> | undefined, getItem: (id: number) => ItemDef | undefined): GearArgs {
  const at = (slot: keyof Equipment) => {
    const id = equip?.[slot];
    return id ? { id, item: getItem(id) } : null;
  };
  const main = at("main");
  const body = at("body");
  const head = at("head");
  const legs = at("legs");
  const feet = at("feet");
  const sub = at("sub");
  const hands = at("hands");
  return [
    main ? familyOf(main.item) : 0,
    main ? materialOf(main.item) : 0,
    main?.id ?? 0,
    body ? materialOf(body.item) : 0,
    body?.id ?? 0,
    head ? materialOf(head.item) : 0,
    head?.id ?? 0,
    legs ? materialOf(legs.item) : 0,
    legs?.id ?? 0,
    feet ? materialOf(feet.item) : 0,
    feet?.id ?? 0,
    sub?.id ?? 0,
    hands?.id ?? 0,
  ];
}

/** Preset key for a preview figure (#37), same as in-world players. */
export function previewPreset(
  job: string,
  gender: string | undefined,
  form?: number,
): string {
  if (job === "druid") {
    const raw = form ?? 0;
    const n = isDruidForm(raw) ? raw : 0;
    const key = DRUID_FORM_PRESET[n];
    if (n === 0) return `${key}/${gender ?? "male"}`;
    return key;
  }
  return `${job}/${gender ?? "male"}`;
}
