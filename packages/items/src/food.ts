import { hqAmount, hqStats, type ItemDef, type ItemStats } from "./types";

/** Every cooked dish lasts half an hour. */
export const FOOD_DURATION_SEC = 1800;
export const FOOD_DURATION_MS = FOOD_DURATION_SEC * 1000;

export type FoodKind = "grain" | "meat" | "fish" | "stew" | "mage" | "rogue" | "noodles" | "feast";

const STAT_KEYS = [
  "str",
  "dex",
  "vit",
  "agi",
  "int",
  "mnd",
  "atk",
  "def",
  "acc",
  "eva",
  "mab",
  "mdb",
  "hp",
  "mp",
  "regen",
  "healPotency",
] as const satisfies readonly (keyof ItemStats)[];

const STAT_ABBR: Record<(typeof STAT_KEYS)[number], string> = {
  str: "STR",
  dex: "DEX",
  vit: "VIT",
  agi: "AGI",
  int: "INT",
  mnd: "MND",
  atk: "ATK",
  def: "DEF",
  acc: "ACC",
  eva: "EVA",
  mab: "MAB",
  mdb: "MDB",
  hp: "HP",
  mp: "MP",
  regen: "Regen",
  healPotency: "Healing",
};

type FoodRank = {
  major: number;
  minor: number;
  combat: number;
  vitality: number;
  mana: number;
  all: number;
};

/** Cooked consumables — not bait, potions, or stillroom intermediates. */
export function isFoodItem<T extends Pick<ItemDef, "kind" | "craftSkill">>(
  def: T | null | undefined,
): def is T & { kind: "consumable"; craftSkill: "cooking" } {
  return !!def && def.kind === "consumable" && def.craftSkill === "cooking";
}

/** Rank scales with the recipe's cooking level, not the eater's level. */
export function foodRank(craftLevel: number): FoodRank {
  const lv = Math.max(1, Math.floor(craftLevel));
  return {
    major: 2 + Math.floor(lv / 10),
    minor: 1 + Math.floor(lv / 16),
    combat: 1 + Math.floor(lv / 12),
    vitality: 8 + Math.floor(lv * 0.7),
    mana: 5 + Math.floor(lv * 0.5),
    all: 2 + Math.floor(lv / 20),
  };
}

export function foodKindOf(name: string): FoodKind {
  const n = name.toLowerCase();
  if (/feast|banquet|coronation|throne/.test(n)) return "feast";
  if (/\bmage\b/.test(n)) return "mage";
  if (/\brogue\b|\bjerky\b/.test(n)) return "rogue";
  if (/\bnoodles?\b/.test(n)) return "noodles";
  if (/\bstew\b|\bsoup\b|\bcake\b/.test(n)) return "stew";
  if (/\bsteak\b|\bgrill\b/.test(n)) return "meat";
  if (/\bsashimi\b|\bcarp\b|\beel\b|\bkoi\b|\bminnow\b|\bsmoked\b|\bfish\b|\bskewer\b/.test(n)) {
    return "fish";
  }
  return "grain";
}

function foodStatsForKind(kind: FoodKind, craftLevel: number): ItemStats {
  const r = foodRank(craftLevel);
  const halfCombat = Math.max(1, Math.floor(r.combat / 2));
  switch (kind) {
    case "grain":
      return { vit: r.major, def: r.combat, hp: r.vitality };
    case "meat":
      return { str: r.major, atk: r.combat, vit: r.minor };
    case "fish":
      return { dex: r.major, acc: r.combat, agi: r.minor };
    case "stew":
      return { vit: r.major, hp: r.vitality, mnd: r.minor, def: r.combat };
    case "mage":
      return { int: r.major, mnd: r.major, mp: r.mana, mab: r.combat };
    case "rogue":
      return { dex: r.major, agi: r.major, acc: r.combat, eva: r.combat };
    case "noodles":
      return { dex: r.major, vit: r.minor, hp: r.vitality, acc: r.combat };
    case "feast":
      return {
        str: r.all,
        dex: r.all,
        vit: r.all,
        agi: r.all,
        int: r.all,
        mnd: r.all,
        hp: r.vitality,
        mp: r.mana,
        atk: halfCombat,
        def: halfCombat,
        mab: halfCombat,
      };
  }
}

/** Lasting meal stats. Instant eat-heal stays on `consume.hp`. */
export function foodStatsFor(def: Pick<ItemDef, "name" | "craftLevel">): ItemStats {
  return foodStatsForKind(foodKindOf(def.name), def.craftLevel ?? 1);
}

export function mealStatsFor(
  def: Pick<ItemDef, "name" | "craftLevel" | "kind" | "craftSkill">,
  hq = false,
): ItemStats {
  if (!isFoodItem(def)) return {};
  const stats = foodStatsFor(def);
  return hq ? hqStats(stats) : stats;
}

export function addItemStats(a: ItemStats, b: ItemStats): ItemStats {
  const out: ItemStats = {};
  for (const key of STAT_KEYS) {
    const n = (a[key] ?? 0) + (b[key] ?? 0);
    if (n) out[key] = n;
  }
  return out;
}

export function formatFoodBuffLine(stats: ItemStats | undefined): string {
  if (!stats) return "";
  return STAT_KEYS.filter((key) => typeof stats[key] === "number" && (stats[key] ?? 0) !== 0)
    .map((key) => `${STAT_ABBR[key]} +${stats[key]}`)
    .join(" / ");
}

export function foodBiteHeal(def: Pick<ItemDef, "consume" | "craftLevel">): number {
  const authored = def.consume?.hp;
  if (typeof authored === "number" && authored > 0) return authored;
  return 16 + Math.max(1, Math.floor(def.craftLevel ?? 1));
}

/** Bag / wiki line: lasting meal first, then the bite heal. */
export function formatFoodUseLine(
  def: Pick<ItemDef, "name" | "craftLevel" | "kind" | "craftSkill" | "consume">,
  hq = false,
): string {
  if (!isFoodItem(def)) return "";
  const meal = formatFoodBuffLine(mealStatsFor(def, hq));
  const parts = ["Meal 30m"];
  if (meal) parts.push(meal);
  const hp = def.consume?.hp;
  const mp = def.consume?.mp;
  if (typeof hp === "number" && hp > 0) parts.push(`Eat +${hq ? hqAmount(hp) : hp} HP`);
  if (typeof mp === "number" && mp > 0) parts.push(`+${hq ? hqAmount(mp) : mp} MP`);
  return parts.join(" · ");
}
