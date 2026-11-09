import { readFileSync, writeFileSync } from "node:fs";

const gold = (L) => 50 + 20 * L;
const CAST = ["battlemage", "tim", "sorcerer", "cleric", "druid"];
const ROGUE = ["rogue"];
const BONE = ["fighter", "rogue"];
const MERC = ["rogue", "tim"];
const LEATHER = ["rogue", "fighter"];

function eq({
  id, name, slug, L, skill, slot, rarity, stats, mats, jobs, extra = {},
}) {
  const o = {
    id,
    name,
    description: `${name}. ${extra.blurb ?? "Crafted at Mayflower's benches for the living roads of Pale Hollow."}`,
    icon: `/icons/items/${slug}.png`,
    slug,
    kind: "equipment",
    craftLevel: L,
    craftSkill: skill,
    recipe: { gold: gold(L), materialsText: mats },
    stats,
    slot,
    rarity,
  };
  if (jobs) o.jobRestrict = jobs;
  return o;
}

const items = [
  // --- 20-24 Dustweave + Dusthide ---
  eq({ id: 1142, name: "Dustweave Cap", slug: "dustweave-cap", L: 21, skill: "clothcraft", slot: "head", rarity: "Uncommon",
    stats: { def: 6, int: 2, mnd: 2, mp: 18 }, mats: "Linen Cloth×1, Dustgrain×2, Pale Dust×1", jobs: CAST,
    extra: { blurb: "A pale flax cap the basin weavers dust with grain so the sun does not bite." } }),
  eq({ id: 1143, name: "Dustweave Socks", slug: "dustweave-socks", L: 22, skill: "clothcraft", slot: "feet", rarity: "Uncommon",
    stats: { def: 6, agi: 2, mp: 20 }, mats: "Linen Cloth×1, Dustgrain×1, Pale Dust×1", jobs: CAST,
    extra: { blurb: "Soft feet-wraps for the ash-road, still smelling of Dustgrain." } }),
  eq({ id: 1144, name: "Dustweave Robe", slug: "dustweave-robe", L: 23, skill: "clothcraft", slot: "body", rarity: "Uncommon",
    stats: { def: 12, int: 12, mp: 26, hp: 16 }, mats: "Linen Cloth×2, Dustgrain×2, Pale Dust×1", jobs: CAST,
    extra: { blurb: "An open-country robe the Pale Hollow weavers cut for first journeys past Emberwatch." } }),
  eq({ id: 1145, name: "Dustweave Slops", slug: "dustweave-slops", L: 24, skill: "clothcraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 8, mp: 22, mnd: 2 }, mats: "Linen Cloth×2, Dead Fiber×1, Pale Dust×1", jobs: CAST,
    extra: { blurb: "Dustweave legs, loose enough to wade the Ash Pit shallows." } }),
  eq({ id: 1146, name: "Dusthide Vest", slug: "dusthide-vest", L: 22, skill: "leathercraft", slot: "body", rarity: "Uncommon",
    stats: { def: 12, agi: 10, hp: 20 }, mats: "Leather×2, Dustgrain×1, Pale Dust×1", jobs: ROGUE,
    extra: { blurb: "Desiccated hide beaten with grain until it takes a pale nap." } }),
  eq({ id: 1147, name: "Dusthide Sandals", slug: "dusthide-sandals", L: 20, skill: "leathercraft", slot: "feet", rarity: "Uncommon",
    stats: { def: 5, agi: 2, mp: 14 }, mats: "Leather×1, Dustgrain×1, Pale Dust×1", jobs: ROGUE,
    extra: { blurb: "Open sandals for the basin's packed dirt, not the river walls." } }),
  eq({ id: 1148, name: "Seam-Glass Ring", slug: "seam-glass-ring", L: 21, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { acc: 3, dex: 2 }, mats: "Glass Bead×2, Pale Dust×1",
    extra: { blurb: "A pale bead set in a copper hoop; Mayflower goldsmiths sell them by the handful." } }),
  eq({ id: 1149, name: "Marrow Stud", slug: "marrow-stud", L: 23, skill: "bonecraft", slot: "earring", rarity: "Rare",
    stats: { atk: 4, acc: 3, str: 1 }, mats: "Bone Chip×2, Pale Dust×1", jobs: BONE,
    extra: { blurb: "A polished chip worn through the ear, the marrow line still visible." } }),

  // --- 25-28 Kettle + Briarhide ---
  eq({ id: 1150, name: "Kettle Mitts", slug: "kettle-mitts", L: 26, skill: "clothcraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 7, mab: 3, mnd: 3 }, mats: "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Camp mitts from Kettle Hollow, ash-linen on the palms." } }),
  eq({ id: 1151, name: "Kettle Robe", slug: "kettle-robe", L: 27, skill: "clothcraft", slot: "body", rarity: "Uncommon",
    stats: { def: 14, int: 14, mp: 30, hp: 18 }, mats: "Shade Cotton Thread×3, Shade Cotton×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "The Forest Basin camp robe, cut short so it does not catch on briar." } }),
  eq({ id: 1152, name: "Briarhide Cap", slug: "briarhide-cap", L: 25, skill: "leathercraft", slot: "head", rarity: "Uncommon",
    stats: { def: 7, dex: 3, agi: 2 }, mats: "Leather×1, Climbing Cord×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "A low leather cap, thorn-scored, for the basin's understorey." } }),
  eq({ id: 1153, name: "Briarhide Gloves", slug: "briarhide-gloves", L: 27, skill: "leathercraft", slot: "hands", rarity: "Rare",
    stats: { def: 8, dex: 3, acc: 3 }, mats: "Leather×2, Climbing Cord×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "Thorn-proof palms the basin scouts swear by." } }),
  eq({ id: 1154, name: "Reedbone Earring", slug: "reedbone-earring", L: 26, skill: "bonecraft", slot: "earring", rarity: "Rare",
    stats: { mnd: 3, mp: 12, mab: 2 }, mats: "Bone Chip×1, Insect Wing×1, Ash Dust×1",
    extra: { blurb: "A hollow reed-bone drop that hums when the Stillmere is near." } }),
  eq({ id: 1155, name: "Hollow Signet", slug: "hollow-signet", L: 28, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { int: 3, mab: 2, mp: 8 }, mats: "Glass Bead×1, Ash Dust×1, Lapis×1",
    extra: { blurb: "Ash-glass set with a chip of lapis, the Pale Hollow mark in miniature." } }),

  // --- 29-34 Last Company + ash-linen ---
  eq({ id: 1156, name: "Last-Company Bandana", slug: "last-company-bandana", L: 29, skill: "leathercraft", slot: "head", rarity: "Legendary",
    stats: { def: 9, dex: 4, agi: 4, mp: 15 }, mats: "Leather×1, Climbing Cord×1, Ash Dust×1", jobs: MERC,
    extra: { blurb: "The sellswords' brow-cloth, still folded the way the Last Company wore it." } }),
  eq({ id: 1157, name: "Last-Company Gloves", slug: "last-company-gloves", L: 33, skill: "leathercraft", slot: "hands", rarity: "Legendary",
    stats: { def: 10, dex: 4, acc: 4, agi: 2 }, mats: "Leather×2, Climbing Cord×1, Ash Dust×1", jobs: MERC,
    extra: { blurb: "Companion gloves to the Mantle of the Last Company." } }),
  eq({ id: 1158, name: "Last-Company Boots", slug: "last-company-boots", L: 34, skill: "leathercraft", slot: "feet", rarity: "Legendary",
    stats: { def: 10, agi: 6, dex: 3, hp: 20 }, mats: "Leather×2, Climbing Cord×1, Ash Dust×1", jobs: MERC,
    extra: { blurb: "Road boots that finished the Anvilhold sellsword kit." } }),
  eq({ id: 1159, name: "Ash-Linen Cowl", slug: "ash-linen-cowl", L: 31, skill: "clothcraft", slot: "head", rarity: "Uncommon",
    stats: { def: 8, int: 3, mnd: 3, mp: 24 }, mats: "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "A short cowl of ash-linen, the shade-cotton lining still pale." } }),
  eq({ id: 1160, name: "Ivory Band", slug: "ivory-band", L: 31, skill: "bonecraft", slot: "ring", rarity: "Uncommon",
    stats: { str: 2, dex: 3, hp: 10 }, mats: "Bone Hilt×1, Bone Chip×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "A simple ivory hoop cut from a hilt blank." } }),
  eq({ id: 1161, name: "Mayflower Chain", slug: "mayflower-chain", L: 33, skill: "goldsmithing", slot: "earring", rarity: "Rare",
    stats: { int: 4, mab: 2, mp: 14 }, mats: "Glass Bead×1, Lapis×1, Ash Dust×1",
    extra: { blurb: "A short goldsmith's chain Ilse's town hangs from one ear." } }),

  // --- 35-40 Ashbone + Horncloth + Scale ---
  eq({ id: 1162, name: "Scale Coif", slug: "scale-coif", L: 35, skill: "leathercraft", slot: "head", rarity: "Uncommon",
    stats: { def: 9, vit: 3, hp: 22 }, mats: "Leather×1, Scale Hide×1, Ash Dust×1", jobs: LEATHER,
    extra: { blurb: "A hide coif sewn with the first scale scraps off the basin lizards." } }),
  eq({ id: 1163, name: "Ashbone Helm", slug: "ashbone-helm", L: 36, skill: "bonecraft", slot: "head", rarity: "Uncommon",
    stats: { def: 10, dex: 4, acc: 4 }, mats: "Skull Plate×1, Ashbeam Log×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "Skull plate bound with ashbeam splints, a Pale Hollow fighting helm." } }),
  eq({ id: 1164, name: "Horncloth Hood", slug: "horncloth-hood", L: 37, skill: "clothcraft", slot: "head", rarity: "Rare",
    stats: { def: 10, int: 4, mnd: 3, mp: 32 }, mats: "Shade Cotton Thread×2, Horn×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "A caster's hood, the brim stiffened with shaved horn." } }),
  eq({ id: 1165, name: "Ashbone Gloves", slug: "ashbone-gloves", L: 38, skill: "bonecraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 9, dex: 4, acc: 4 }, mats: "Bone Chip×2, Soft Pelt×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "Ivory finger tubes on hide, the ashbeam stain still in the grain." } }),
  eq({ id: 1166, name: "Wyrmglass Ring", slug: "wyrmglass-ring", L: 38, skill: "goldsmithing", slot: "ring", rarity: "Rare",
    stats: { mab: 4, int: 3, mp: 12 }, mats: "Glass Bead×1, Slag Dust×1, Lapis×1",
    extra: { blurb: "Slag-fired glass that keeps a green cast, set as a caster's hoop." } }),
  eq({ id: 1167, name: "Scale Gloves", slug: "scale-gloves", L: 39, skill: "leathercraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 10, acc: 4, vit: 3 }, mats: "Leather×2, Scale Hide×1, Ash Dust×1", jobs: LEATHER,
    extra: { blurb: "Companion gloves to the Scale Harness, scale on the knuckles." } }),
  eq({ id: 1168, name: "Horncloth Cuffs", slug: "horncloth-cuffs", L: 39, skill: "clothcraft", slot: "hands", rarity: "Rare",
    stats: { def: 10, mab: 5, mnd: 4 }, mats: "Shade Cotton Thread×2, Horn×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Horn-stiffened cuffs that sit over a caster's wrists." } }),
  eq({ id: 1169, name: "Ivory Studs", slug: "ivory-studs", L: 35, skill: "goldsmithing", slot: "earring", rarity: "Uncommon",
    stats: { vit: 2, hp: 12 }, mats: "Glass Bead×1, Bone Chip×1, Ash Dust×1",
    extra: { blurb: "Goldsmith work with a bone face, sold on Tally Row." } }),
  eq({ id: 1170, name: "Ashbone Harness", slug: "ashbone-harness", L: 40, skill: "bonecraft", slot: "body", rarity: "Epic",
    stats: { def: 28, str: 8, dex: 5, hp: 32 }, mats: "Giant Femur×1, Skull Plate×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "A fighting harness of femur and plate, the ash still in the joins." } }),

  // --- 41-50 Mayflower + Seamhide + Coilbone ---
  eq({ id: 1171, name: "Coilbone Greaves", slug: "coilbone-greaves", L: 41, skill: "bonecraft", slot: "feet", rarity: "Rare",
    stats: { def: 11, agi: 4, vit: 3, hp: 24 }, mats: "Bone Chip×2, Soft Pelt×1, Slag Dust×1", jobs: BONE,
    extra: { blurb: "Greaves cut on the Coil, femur splints over hide soles." } }),
  eq({ id: 1172, name: "Mayflower Gloves", slug: "mayflower-gloves", L: 42, skill: "clothcraft", slot: "hands", rarity: "Rare",
    stats: { def: 11, mab: 6, mnd: 5 }, mats: "Silk Thread×2, Linen Cloth×1, Slag Dust×1", jobs: CAST,
    extra: { blurb: "Turning Yard gloves, silk over linen, for Ilse's students." } }),
  eq({ id: 1173, name: "Mayflower Coif", slug: "mayflower-coif", L: 43, skill: "clothcraft", slot: "head", rarity: "Rare",
    stats: { def: 11, int: 4, mnd: 4, mp: 36 }, mats: "Silk Thread×2, Shade Cotton×1, Slag Dust×1", jobs: CAST,
    extra: { blurb: "A close coif the Turning Yard issues with the rest of the town kit." } }),
  eq({ id: 1174, name: "Mayflower Hose", slug: "mayflower-hose", L: 44, skill: "clothcraft", slot: "legs", rarity: "Rare",
    stats: { def: 14, mp: 50, mnd: 5 }, mats: "Silk Thread×2, Linen Cloth×1, Slag Dust×1", jobs: CAST,
    extra: { blurb: "Town hose, silk-blend, cut for Mayflower's ramped streets." } }),
  eq({ id: 1175, name: "Mayflower Shoes", slug: "mayflower-shoes", L: 46, skill: "clothcraft", slot: "feet", rarity: "Rare",
    stats: { def: 12, agi: 4, mp: 55 }, mats: "Silk Thread×2, Soft Pelt×1, Slag Dust×1", jobs: CAST,
    extra: { blurb: "Soft shoes for the Turning Yard sand and the street stones after." } }),
  eq({ id: 1176, name: "Scrivener's Earring", slug: "scriveners-earring", L: 46, skill: "goldsmithing", slot: "earring", rarity: "Rare",
    stats: { mnd: 4, int: 3, mp: 16 }, mats: "Glass Bead×1, Parchment×1, Slag Dust×1",
    extra: { blurb: "A mythril drop the scriveners of the scarp swore on." } }),
  eq({ id: 1177, name: "Seamhide Chaps", slug: "seamhide-chaps", L: 47, skill: "leathercraft", slot: "legs", rarity: "Rare",
    stats: { def: 16, agi: 6, hp: 48 }, mats: "Fine Leather×2, Slag Dust×1", jobs: LEATHER,
    extra: { blurb: "Open-sided chaps of fine leather for Seam Country's long grass." } }),
  eq({ id: 1178, name: "Lockkeeper's Signet", slug: "lockkeeper-signet", L: 49, skill: "goldsmithing", slot: "ring", rarity: "Epic",
    stats: { mnd: 4, vit: 3, mp: 18, def: 4 }, mats: "Mythril Chain×1, Jadeite×1, Slag Dust×1",
    extra: { blurb: "The lock-wardens' seal in mythril and jadeite, keys still in the cut." } }),

  // --- 51-60 Duskweave + White Caps + Skull ---
  eq({ id: 1179, name: "Duskweave Hat", slug: "duskweave-hat", L: 51, skill: "clothcraft", slot: "head", rarity: "Rare",
    stats: { def: 13, int: 5, mnd: 4, mp: 42 }, mats: "Silk Cloth×1, Silk Thread×1, Slag Dust×1", jobs: CAST,
    extra: { blurb: "A dusk-dyed hat between silk and velvet, for the long climb toward Bellgrave." } }),
  eq({ id: 1180, name: "Duskweave Coat", slug: "duskweave-coat", L: 53, skill: "clothcraft", slot: "body", rarity: "Epic",
    stats: { def: 26, int: 26, mp: 56, hp: 32 }, mats: "Silk Cloth×3, Bell Dust×1", jobs: CAST,
    extra: { blurb: "The missing coat between silk and battleweave, dusk-dyed at Mayflower." } }),
  eq({ id: 1181, name: "Stillmere Pearl", slug: "stillmere-pearl", L: 54, skill: "goldsmithing", slot: "ring", rarity: "Rare",
    stats: { mab: 4, mnd: 3, mp: 16 }, mats: "Glass Bead×1, Jadeite×1, Slag Dust×1",
    extra: { blurb: "A still-water bead the goldsmiths swear came off the mere." } }),
  eq({ id: 1182, name: "White-Caps Jack", slug: "white-caps-jack", L: 55, skill: "leathercraft", slot: "body", rarity: "Epic",
    stats: { def: 36, str: 9, agi: 8, hp: 48 }, mats: "Fine Leather×3, Bell Dust×1", jobs: LEATHER,
    extra: { blurb: "A climbing jack named for the White Caps stair, fine leather packed at the shoulders." } }),
  eq({ id: 1183, name: "White-Caps Gloves", slug: "white-caps-gloves", L: 57, skill: "leathercraft", slot: "hands", rarity: "Epic",
    stats: { def: 14, acc: 7, dex: 6 }, mats: "Fine Leather×2, Bell Dust×1", jobs: LEATHER,
    extra: { blurb: "Companion gloves to the White-Caps Jack." } }),
  eq({ id: 1184, name: "Marrowforged Ring", slug: "marrowforged-ring", L: 58, skill: "bonecraft", slot: "ring", rarity: "Epic",
    stats: { str: 4, atk: 5, hp: 20 }, mats: "Skull Plate×1, Giant Femur×1, Bell Dust×1", jobs: BONE,
    extra: { blurb: "A heavy ivory ring, marrow-dark in the core." } }),
  eq({ id: 1185, name: "Duskweave Slacks", slug: "duskweave-slacks", L: 59, skill: "clothcraft", slot: "legs", rarity: "Rare",
    stats: { def: 19, mp: 68, int: 6 }, mats: "Silk Cloth×2, Bell Dust×1", jobs: CAST,
    extra: { blurb: "Dusk-dyed slacks that close the set under the coat." } }),
  eq({ id: 1186, name: "Skull Harness", slug: "skull-harness", L: 60, skill: "bonecraft", slot: "body", rarity: "Legendary",
    stats: { def: 34, str: 10, dex: 7, hp: 40 }, mats: "Skull Plate×2, Giant Femur×1, Bell Dust×1", jobs: BONE,
    extra: { blurb: "Companion harness to the Skull Bandana, a fighting cage of plate and femur." } }),
];

const path = new URL("../packages/items/src/catalog.json", import.meta.url);
const raw = readFileSync(path, "utf8");
const cat = JSON.parse(raw);
const have = new Set(cat.map((i) => i.id));
const add = items.filter((i) => !have.has(i.id));
if (add.length !== items.length) {
  console.error("some ids already present", items.filter((i) => have.has(i.id)).map((i) => i.id));
}
cat.push(...add);
writeFileSync(path, JSON.stringify(cat, null, 2) + "\n", "utf8");
console.log("appended", add.length, "items; catalog now", cat.length);
