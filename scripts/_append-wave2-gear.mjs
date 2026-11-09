import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAT = join(ROOT, "packages/items/src/catalog.json");

const gold = (L) => 50 + 20 * L;
const CAST = ["battlemage", "tim", "sorcerer", "cleric", "druid"];
const ROGUE = ["rogue"];
const BONE = ["fighter", "rogue"];
const LEATHER = ["rogue", "fighter"];

function eq({ id, name, slug, L, skill, slot, rarity, stats, mats, jobs, extra = {} }) {
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
  // --- 20-24 Chalkreed + Pitstraw + Riverbone ---
  eq({
    id: 1187, name: "Chalkreed Cuffs", slug: "chalkreed-cuffs", L: 20, skill: "clothcraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 5, mnd: 2, mp: 16 }, mats: "Linen Cloth×1, Pale Dust×1", jobs: CAST,
    extra: { blurb: "Reed-wrapped cuffs chalked at the pool so the flax does not slip the wrist." },
  }),
  eq({
    id: 1188, name: "Pitstraw Chaps", slug: "pitstraw-chaps", L: 21, skill: "leathercraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 7, agi: 3, hp: 18 }, mats: "Leather×2, Pale Dust×1", jobs: ROGUE,
    extra: { blurb: "Straw-stuffed chaps for the Ash Pit's packed rims, not the river walls." },
  }),
  eq({
    id: 1189, name: "Chalk Bead", slug: "chalk-bead", L: 22, skill: "goldsmithing", slot: "earring", rarity: "Uncommon",
    stats: { mnd: 2, mp: 10 }, mats: "Glass Bead×2, Pale Dust×1",
    extra: { blurb: "A pale glass drop dusted with chalk, sold at the pool for a handful of copper." },
  }),
  eq({
    id: 1190, name: "Riverbone Mitts", slug: "riverbone-mitts", L: 22, skill: "bonecraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 6, atk: 2, acc: 2 }, mats: "Bone Chip×2, Pale Dust×1", jobs: BONE,
    extra: { blurb: "River-smoothed chips bound for the palm, still cool from the ford." },
  }),
  eq({
    id: 1191, name: "Pitstraw Gloves", slug: "pitstraw-gloves", L: 23, skill: "leathercraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 6, dex: 2, agi: 2 }, mats: "Leather×1, Pale Dust×1", jobs: ROGUE,
    extra: { blurb: "Thin pit-hide gloves, straw at the cuff so grit does not work under the nails." },
  }),
  eq({
    id: 1192, name: "Sand-Bone Ring", slug: "sand-bone-ring", L: 24, skill: "bonecraft", slot: "ring", rarity: "Uncommon",
    stats: { str: 2, hp: 8 }, mats: "Bone Chip×1, Pale Dust×1", jobs: BONE,
    extra: { blurb: "A sanded knuckle-bone hoop, pale as the ford's bars." },
  }),

  // --- 25-28 Fordcamp + Thornreed ---
  eq({
    id: 1193, name: "Fordcamp Slops", slug: "fordcamp-slops", L: 25, skill: "clothcraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 8, mp: 24, mnd: 2 }, mats: "Shade Cotton Thread×2, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Camp slops cut short so they do not drag the ford's silt." },
  }),
  eq({
    id: 1194, name: "Thornreed Vest", slug: "thornreed-vest", L: 26, skill: "leathercraft", slot: "body", rarity: "Uncommon",
    stats: { def: 14, agi: 10, hp: 22 }, mats: "Leather×2, Climbing Cord×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "A reed-ribbed vest, thorn-scored from the basin's understorey." },
  }),
  eq({
    id: 1195, name: "Camp-Glass Ring", slug: "camp-glass-ring", L: 26, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { acc: 3, dex: 2 }, mats: "Glass Bead×1, Ash Dust×1",
    extra: { blurb: "Ash-glass from a ford camp fire, set in a thin hoop." },
  }),
  eq({
    id: 1196, name: "Reed Greaves", slug: "reed-greaves", L: 27, skill: "bonecraft", slot: "feet", rarity: "Rare",
    stats: { def: 9, agi: 3, hp: 16 }, mats: "Bone Chip×2, Insect Wing×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "Hollow reed-bone greaves that whisper when the Stillmere wind is up." },
  }),
  eq({
    id: 1197, name: "Camp Signet", slug: "camp-signet", L: 27, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { int: 3, mp: 10 }, mats: "Glass Bead×1, Lapis×1, Ash Dust×1",
    extra: { blurb: "A lapis chip in camp-glass, the ford's mark in miniature." },
  }),

  // --- 29-34 Cinderflax + Coilhide + Ash-Rib ---
  eq({
    id: 1198, name: "Cinderflax Slops", slug: "cinderflax-slops", L: 29, skill: "clothcraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 10, mp: 28, mnd: 3 }, mats: "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Flax slops smoked over cinder so the ash-road does not show every stain." },
  }),
  eq({
    id: 1199, name: "Coilhide Chaps", slug: "coilhide-chaps", L: 31, skill: "leathercraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 11, agi: 4, hp: 24 }, mats: "Leather×2, Climbing Cord×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "Hide cut on the coil, wrapped so a briar cannot take the calf." },
  }),
  eq({
    id: 1200, name: "Marrow Hoop", slug: "marrow-hoop", L: 32, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { mnd: 3, mp: 12 }, mats: "Glass Bead×1, Lapis×1, Ash Dust×1",
    extra: { blurb: "A glass hoop with a marrow-dark core, quiet on the finger." },
  }),
  eq({
    id: 1201, name: "Ash-Rib Trousers", slug: "ash-rib-trousers", L: 32, skill: "bonecraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 12, str: 3, hp: 22 }, mats: "Bone Chip×2, Horn×1, Ash Dust×1", jobs: BONE,
    extra: { blurb: "Rib-staves smoked in ash, bound as trousers for the pit road." },
  }),
  eq({
    id: 1202, name: "Cinderflax Cuffs", slug: "cinderflax-cuffs", L: 33, skill: "clothcraft", slot: "hands", rarity: "Uncommon",
    stats: { def: 8, mab: 3, mnd: 3 }, mats: "Shade Cotton Thread×2, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Cinder-smoked cuffs that keep spell-heat off the wrist." },
  }),
  eq({
    id: 1203, name: "Ford Bead", slug: "ford-bead", L: 34, skill: "goldsmithing", slot: "earring", rarity: "Uncommon",
    stats: { acc: 3, dex: 2 }, mats: "Glass Bead×1, Ash Dust×1",
    extra: { blurb: "A dark glass drop from the ford's night fires." },
  }),

  // --- 35-40 Wicklinen + Slaghide ---
  eq({
    id: 1204, name: "Wicklinen Robe", slug: "wicklinen-robe", L: 35, skill: "clothcraft", slot: "body", rarity: "Rare",
    stats: { def: 18, int: 16, mp: 36, hp: 20 }, mats: "Shade Cotton Thread×3, Horn×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "A horn-trimmed robe, wick-dyed so the hem reads as lamp-soot after dusk." },
  }),
  eq({
    id: 1205, name: "Slaghide Boots", slug: "slaghide-boots", L: 36, skill: "leathercraft", slot: "feet", rarity: "Uncommon",
    stats: { def: 10, agi: 3, hp: 18 }, mats: "Leather×1, Scale Hide×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "Scale-laced boots for slag-road grit, still flexible at the ankle." },
  }),
  eq({
    id: 1206, name: "Slaghide Chaps", slug: "slaghide-chaps", L: 37, skill: "leathercraft", slot: "legs", rarity: "Uncommon",
    stats: { def: 13, agi: 5, hp: 28 }, mats: "Leather×2, Scale Hide×1, Ash Dust×1", jobs: ROGUE,
    extra: { blurb: "Scale-hide chaps that shed sparks on the slag benches." },
  }),
  eq({
    id: 1207, name: "Wicklinen Slops", slug: "wicklinen-slops", L: 38, skill: "clothcraft", slot: "legs", rarity: "Rare",
    stats: { def: 13, mp: 40, int: 4 }, mats: "Shade Cotton Thread×2, Horn×1, Ash Dust×1", jobs: CAST,
    extra: { blurb: "Wick-dyed slops, horn-threaded at the hem, for long watches." },
  }),
  eq({
    id: 1208, name: "Slag Loop", slug: "slag-loop", L: 39, skill: "goldsmithing", slot: "ring", rarity: "Rare",
    stats: { acc: 4, dex: 3, atk: 2 }, mats: "Glass Bead×1, Onyx×1, Ash Dust×1",
    extra: { blurb: "Onyx set in slag-glass, a loop the slag-road goldsmiths keep for themselves." },
  }),
  eq({
    id: 1209, name: "Ember-Glass Ring", slug: "ember-glass-ring", L: 40, skill: "goldsmithing", slot: "ring", rarity: "Uncommon",
    stats: { mab: 3, int: 2, mp: 12 }, mats: "Glass Bead×2, Ash Dust×1",
    extra: { blurb: "Ember-tinted glass from Emberwatch, still warm to the look." },
  }),

  // --- 41-50 Scarp + Driftpelt + Marshbone ---
  eq({
    id: 1210, name: "Scarp Cowl", slug: "scarp-cowl", L: 41, skill: "clothcraft", slot: "head", rarity: "Rare",
    stats: { def: 12, int: 5, mnd: 4, mp: 36 }, mats: "Shade Cotton Thread×2, Slag Dust×1", jobs: CAST,
    extra: { blurb: "A scarp-cut cowl that keeps wind off the face on the high benches." },
  }),
  eq({
    id: 1211, name: "Driftpelt Gloves", slug: "driftpelt-gloves", L: 42, skill: "leathercraft", slot: "hands", rarity: "Rare",
    stats: { def: 11, dex: 5, acc: 4 }, mats: "Fine Leather×1, Slag Dust×1", jobs: LEATHER,
    extra: { blurb: "Pelt gloves from the drift-meadows, palm-soft and wrist-tight." },
  }),
  eq({
    id: 1212, name: "Marshbone Harness", slug: "marshbone-harness", L: 43, skill: "bonecraft", slot: "body", rarity: "Rare",
    stats: { def: 22, str: 6, dex: 4, hp: 28 }, mats: "Skull Plate×1, Bone Chip×2, Slag Dust×1", jobs: BONE,
    extra: { blurb: "A marsh-bleached rib cage, plate at the breast, for fighters who wade." },
  }),
  eq({
    id: 1213, name: "Driftpelt Boots", slug: "driftpelt-boots", L: 44, skill: "leathercraft", slot: "feet", rarity: "Rare",
    stats: { def: 12, agi: 5, hp: 22 }, mats: "Fine Leather×1, Slag Dust×1", jobs: LEATHER,
    extra: { blurb: "Quiet drift-meadow boots, the pelt still holding rain." },
  }),
  eq({
    id: 1214, name: "Scarp Cuffs", slug: "scarp-cuffs", L: 45, skill: "clothcraft", slot: "hands", rarity: "Rare",
    stats: { def: 11, mab: 4, mnd: 4 }, mats: "Silk Thread×2, Slag Dust×1", jobs: CAST,
    extra: { blurb: "Silk-threaded cuffs cut for the scarp wind, not the yard." },
  }),
  eq({
    id: 1215, name: "Marshbone Gloves", slug: "marshbone-gloves", L: 46, skill: "bonecraft", slot: "hands", rarity: "Rare",
    stats: { def: 12, atk: 4, acc: 4 }, mats: "Bone Chip×2, Skull Plate×1, Slag Dust×1", jobs: BONE,
    extra: { blurb: "Marsh-bleached knuckle plates, lashed for a wet grip." },
  }),
  eq({
    id: 1216, name: "Tally Loop", slug: "tally-loop", L: 47, skill: "goldsmithing", slot: "ring", rarity: "Rare",
    stats: { acc: 5, dex: 3, hp: 12 }, mats: "Glass Bead×1, Lapis×1, Slag Dust×1",
    extra: { blurb: "A lapis loop the Tally Row scribes wear while they count the yard." },
  }),
  eq({
    id: 1217, name: "Scarp Hose", slug: "scarp-hose", L: 47, skill: "clothcraft", slot: "legs", rarity: "Rare",
    stats: { def: 16, mp: 52, int: 5 }, mats: "Silk Cloth×2, Slag Dust×1", jobs: CAST,
    extra: { blurb: "Silk hose for the scarp benches, hemmed so they do not catch stone." },
  }),

  // --- 51-60 Nighweave + Saltjack + Crownbone ---
  eq({
    id: 1218, name: "Saltjack Cap", slug: "saltjack-cap", L: 51, skill: "leathercraft", slot: "head", rarity: "Epic",
    stats: { def: 16, dex: 6, agi: 5 }, mats: "Fine Leather×1, Bell Dust×1", jobs: LEATHER,
    extra: { blurb: "A salt-stiff cap from the White Caps shore, brim cut against spray." },
  }),
  eq({
    id: 1219, name: "Ember Studs", slug: "ember-studs", L: 51, skill: "goldsmithing", slot: "earring", rarity: "Uncommon",
    stats: { mab: 3, int: 2 }, mats: "Glass Bead×1, Onyx×1, Bell Dust×1",
    extra: { blurb: "Paired ember-glass studs, small enough to forget until the light hits." },
  }),
  eq({
    id: 1220, name: "Saltjack Boots", slug: "saltjack-boots", L: 53, skill: "leathercraft", slot: "feet", rarity: "Epic",
    stats: { def: 16, agi: 6, hp: 28 }, mats: "Fine Leather×1, Bell Dust×1", jobs: LEATHER,
    extra: { blurb: "Shore boots, salt-cured, for the spray-line paths above the mere." },
  }),
  eq({
    id: 1221, name: "Mere Loop", slug: "mere-loop", L: 55, skill: "goldsmithing", slot: "ring", rarity: "Rare",
    stats: { mnd: 5, mp: 20, mab: 3 }, mats: "Glass Bead×1, Lapis×1, Bell Dust×1",
    extra: { blurb: "A still-water loop, lapis pale as the mere at first light." },
  }),
  eq({
    id: 1222, name: "Crownbone Gloves", slug: "crownbone-gloves", L: 56, skill: "bonecraft", slot: "hands", rarity: "Legendary",
    stats: { def: 16, str: 6, atk: 6, acc: 5 }, mats: "Skull Plate×1, Giant Femur×1, Bell Dust×1", jobs: BONE,
    extra: { blurb: "Knuckle plates from a crown of femur, the marrow line still gold-dark." },
  }),
  eq({
    id: 1223, name: "Nighweave Gloves", slug: "nighweave-gloves", L: 57, skill: "clothcraft", slot: "hands", rarity: "Rare",
    stats: { def: 13, mab: 5, int: 5 }, mats: "Silk Cloth×1, Silk Thread×1, Bell Dust×1", jobs: CAST,
    extra: { blurb: "Night-dyed silk gloves, thin enough to feel a page, thick enough for cold." },
  }),
  eq({
    id: 1224, name: "Nighweave Pumps", slug: "nighweave-pumps", L: 58, skill: "clothcraft", slot: "feet", rarity: "Rare",
    stats: { def: 14, mp: 48, agi: 3 }, mats: "Silk Cloth×1, Bell Dust×1", jobs: CAST,
    extra: { blurb: "Night-dyed pumps that make no sound on the yard's boards." },
  }),
  eq({
    id: 1225, name: "Crownbone Greaves", slug: "crownbone-greaves", L: 59, skill: "bonecraft", slot: "feet", rarity: "Legendary",
    stats: { def: 18, str: 6, agi: 4, hp: 32 }, mats: "Skull Plate×1, Giant Femur×1, Bell Dust×1", jobs: BONE,
    extra: { blurb: "Shin cages of crown-femur, heavy enough to plant a stance." },
  }),
  eq({
    id: 1226, name: "Saltjack Chaps", slug: "saltjack-chaps", L: 60, skill: "leathercraft", slot: "legs", rarity: "Epic",
    stats: { def: 22, agi: 8, hp: 40 }, mats: "Fine Leather×2, Bell Dust×1", jobs: LEATHER,
    extra: { blurb: "Salt-cured chaps that close the shore kit, still supple at the knee." },
  }),
];

const catalog = JSON.parse(readFileSync(CAT, "utf8"));
const maxId = Math.max(...catalog.map((i) => i.id));
if (maxId !== 1186) {
  console.error("expected max id 1186, got", maxId);
  process.exit(1);
}
const slugs = new Set(catalog.map((i) => i.slug));
for (const it of items) {
  if (slugs.has(it.slug)) {
    console.error("slug collision", it.slug);
    process.exit(1);
  }
  slugs.add(it.slug);
}
catalog.push(...items);
writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("appended", items.length, "items; max id", items[items.length - 1].id);
