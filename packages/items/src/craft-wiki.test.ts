import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allCraftableRecipes,
  craftablesForSkill,
  getCraftableItem,
  maxCraftLevelForSkill,
  recipeMaterialGroups,
  recipeMaterialsComplete,
} from "./craft";
import { CATALOG_BY_ID } from "./catalog.generated";

test("craftablesForSkill lists recipes in ascending craft level", () => {
  const smith = craftablesForSkill("smithing");
  assert.ok(smith.length > 0);
  let prev = 0;
  for (const def of smith) {
    assert.equal(getCraftableItem(def.id), def);
    const lv = def.craftLevel ?? 0;
    assert.ok(lv >= prev, `${def.name} L${lv} after L${prev}`);
    prev = lv;
  }
  assert.equal(maxCraftLevelForSkill("smithing"), prev);
});

test("decayed sword recipe resolves dustgrain from catalog materialsText", () => {
  const def = CATALOG_BY_ID[1064];
  assert.ok(def);
  assert.equal(def!.craftSkill, "bonecraft");
  assert.equal(def!.craftLevel, 2);
  assert.ok(recipeMaterialsComplete(def!));
  const groups = recipeMaterialGroups(def!);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.options[0]!.slug, "dustgrain");
  assert.equal(groups[0]!.options[0]!.qty, 5);
  assert.ok(craftablesForSkill("bonecraft").some((i) => i.id === 1064));
});

test("decayed axe recipe resolves dustgrain and bonecraft level", () => {
  const def = CATALOG_BY_ID[1065];
  assert.ok(def);
  assert.equal(def!.craftSkill, "bonecraft");
  assert.equal(def!.craftLevel, 5);
  assert.equal(def!.stats?.atk, 10);
  assert.equal(def!.stats?.str, 2);
  assert.ok(recipeMaterialsComplete(def!));
  const groups = recipeMaterialGroups(def!);
  assert.equal(groups[0]!.options[0]!.slug, "dustgrain");
  assert.equal(groups[0]!.options[0]!.qty, 10);
});

test("bronze and iron sabatons fill empty smithing levels and knight feet", () => {
  const bronze = CATALOG_BY_ID[1068];
  assert.ok(bronze);
  assert.equal(bronze!.craftSkill, "smithing");
  assert.equal(bronze!.craftLevel, 6);
  assert.equal(bronze!.slot, "feet");
  assert.ok(bronze!.jobRestrict?.includes("knight"));
  assert.ok(recipeMaterialsComplete(bronze!));
  const iron = CATALOG_BY_ID[1069];
  assert.ok(iron);
  assert.equal(iron!.craftLevel, 25);
  assert.equal(iron!.slot, "feet");
  assert.ok(recipeMaterialsComplete(iron!));
});

test("decayed greaves fills bonecraft level 4", () => {
  const def = CATALOG_BY_ID[1070];
  assert.ok(def);
  assert.equal(def!.craftSkill, "bonecraft");
  assert.equal(def!.craftLevel, 4);
  assert.equal(def!.slot, "feet");
  assert.ok(recipeMaterialsComplete(def!));
  const groups = recipeMaterialGroups(def!);
  assert.equal(groups[0]!.options[0]!.slug, "dustgrain");
  assert.equal(groups[0]!.options[0]!.qty, 6);
});

test("battleweave coat fills clothcraft 61 for battlemage body", () => {
  const def = CATALOG_BY_ID[1071];
  assert.ok(def);
  assert.equal(def!.craftSkill, "clothcraft");
  assert.equal(def!.craftLevel, 61);
  assert.equal(def!.slot, "body");
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("altarweave slacks fill clothcraft 76 for cleric legs", () => {
  const def = CATALOG_BY_ID[1083];
  assert.ok(def);
  assert.equal(def!.name, "Altarweave Slacks");
  assert.equal(def!.slot, "legs");
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("altarweave pumps fill clothcraft 78 for cleric feet", () => {
  const def = CATALOG_BY_ID[1084];
  assert.ok(def);
  assert.equal(def!.name, "Altarweave Pumps");
  assert.equal(def!.slot, "feet");
  assert.ok(recipeMaterialsComplete(def!));
});

test("battleweave raiment fills clothcraft 93 for battlemage body", () => {
  const def = CATALOG_BY_ID[1085];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Raiment");
  assert.equal(def!.slot, "body");
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum targe fills smithing 91 for hybrid healer sub", () => {
  const def = CATALOG_BY_ID[1086];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum Targe");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.slot, "sub");
  assert.ok(recipeMaterialsComplete(def!));
});

test("batch F metal weapon siblings fill smithing holes", () => {
  const bronzeGreat = CATALOG_BY_ID[1118];
  assert.equal(bronzeGreat!.name, "Bronze Greatsword");
  assert.equal(bronzeGreat!.rarity, "Common");
  assert.equal(bronzeGreat!.craftLevel, 15);
  assert.equal(bronzeGreat!.recipe?.gold, 350);
  assert.equal(bronzeGreat!.twoHand, true);
  assert.equal(bronzeGreat!.weaponFamily, "greatsword");
  const ironAxe = CATALOG_BY_ID[1119];
  assert.equal(ironAxe!.name, "Iron Axe");
  assert.equal(ironAxe!.weaponFamily, "axe");
  assert.equal(ironAxe!.recipe?.gold, 470);
  const steelGaxe = CATALOG_BY_ID[1120];
  assert.equal(steelGaxe!.name, "Steel Great Axe");
  assert.equal(steelGaxe!.rarity, "Uncommon");
  assert.equal(steelGaxe!.twoHand, true);
  const targe = CATALOG_BY_ID[1121];
  assert.equal(targe!.name, "Mythril Targe");
  assert.equal(targe!.slot, "sub");
  assert.deepEqual(targe!.jobRestrict, ["battlemage", "cleric"]);
  const mythGaxe = CATALOG_BY_ID[1122];
  assert.equal(mythGaxe!.name, "Mythril Great Axe");
  assert.equal(mythGaxe!.rarity, "Rare");
  const mythDag = CATALOG_BY_ID[1123];
  assert.equal(mythDag!.name, "Mythril Dagger");
  assert.equal(mythDag!.delayMs, 1800);
  const dsDag = CATALOG_BY_ID[1124];
  assert.equal(dsDag!.name, "Darksteel Dagger");
  assert.equal(dsDag!.rarity, "Epic");
  const palace = CATALOG_BY_ID[1125];
  assert.equal(palace!.name, "Palace Sword");
  assert.equal(palace!.rarity, "Legendary");
  assert.equal(palace!.recipe?.gold, 2030);
  assert.deepEqual(palace!.jobRestrict, ["knight", "fighter", "battlemage"]);
  for (const id of [1118, 1119, 1120, 1121, 1122, 1123, 1124, 1125]) {
    assert.ok(recipeMaterialsComplete(CATALOG_BY_ID[id]!));
  }
});

test("batch G 1H axe bronze and bone extremities fill holes", () => {
  const bronzeDag = CATALOG_BY_ID[1126];
  assert.equal(bronzeDag!.name, "Bronze Dagger");
  assert.equal(bronzeDag!.rarity, "Common");
  assert.equal(bronzeDag!.craftLevel, 13);
  assert.equal(bronzeDag!.recipe?.gold, 310);
  assert.equal(bronzeDag!.weaponFamily, "dagger");
  assert.deepEqual(bronzeDag!.jobRestrict, ["rogue"]);
  const bronzeGaxe = CATALOG_BY_ID[1127];
  assert.equal(bronzeGaxe!.name, "Bronze Great Axe");
  assert.equal(bronzeGaxe!.twoHand, true);
  assert.equal(bronzeGaxe!.recipe?.gold, 390);
  const steelDag = CATALOG_BY_ID[1128];
  assert.equal(steelDag!.name, "Steel Dagger");
  assert.equal(steelDag!.rarity, "Uncommon");
  assert.equal(steelDag!.recipe?.gold, 1170);
  const steelAxe = CATALOG_BY_ID[1129];
  assert.equal(steelAxe!.name, "Steel Axe");
  assert.equal(steelAxe!.weaponFamily, "axe");
  assert.equal(steelAxe!.twoHand, undefined);
  const mythAxe = CATALOG_BY_ID[1130];
  assert.equal(mythAxe!.name, "Mythril Axe");
  assert.equal(mythAxe!.rarity, "Rare");
  const dsAxe = CATALOG_BY_ID[1131];
  assert.equal(dsAxe!.name, "Darksteel Axe");
  assert.equal(dsAxe!.rarity, "Epic");
  assert.equal(dsAxe!.recipe?.gold, 1330);
  const gloves = CATALOG_BY_ID[1132];
  assert.equal(gloves!.name, "Bone Gloves");
  assert.equal(gloves!.slot, "hands");
  assert.equal(gloves!.craftSkill, "bonecraft");
  assert.deepEqual(gloves!.jobRestrict, ["fighter", "rogue"]);
  const boots = CATALOG_BY_ID[1133];
  assert.equal(boots!.name, "Bone Boots");
  assert.equal(boots!.slot, "feet");
  assert.equal(boots!.recipe?.gold, 710);
  for (const id of [1126, 1127, 1128, 1129, 1130, 1131, 1132, 1133]) {
    assert.ok(recipeMaterialsComplete(CATALOG_BY_ID[id]!));
  }
});

test("batch H orichalcum palace and craft-only fills", () => {
  const oriAxe = CATALOG_BY_ID[1134];
  assert.equal(oriAxe!.name, "Orichalcum Axe");
  assert.equal(oriAxe!.rarity, "Epic");
  assert.equal(oriAxe!.craftLevel, 76);
  assert.equal(oriAxe!.recipe?.gold, 1570);
  assert.equal(oriAxe!.weaponFamily, "axe");
  assert.equal(oriAxe!.twoHand, undefined);
  assert.deepEqual(oriAxe!.jobRestrict, ["fighter"]);
  const oriGaxe = CATALOG_BY_ID[1135];
  assert.equal(oriGaxe!.name, "Orichalcum Great Axe");
  assert.equal(oriGaxe!.twoHand, true);
  assert.equal(oriGaxe!.recipe?.gold, 1590);
  const shield = CATALOG_BY_ID[1136];
  assert.equal(shield!.name, "Orichalcum Shield");
  assert.equal(shield!.slot, "sub");
  assert.deepEqual(shield!.jobRestrict, ["knight"]);
  assert.equal(shield!.recipe?.gold, 1610);
  const palaceGs = CATALOG_BY_ID[1137];
  assert.equal(palaceGs!.name, "Palace Greatsword");
  assert.equal(palaceGs!.rarity, "Legendary");
  assert.equal(palaceGs!.twoHand, true);
  assert.equal(palaceGs!.delayMs, 3800);
  assert.equal(palaceGs!.recipe?.gold, 1970);
  assert.deepEqual(palaceGs!.jobRestrict, ["knight", "fighter"]);
  const targe = CATALOG_BY_ID[1138];
  assert.equal(targe!.name, "Palace Targe");
  assert.equal(targe!.craftLevel, 97);
  assert.deepEqual(targe!.jobRestrict, ["battlemage", "cleric"]);
  assert.equal(targe!.recipe?.gold, 1990);
  const nail = CATALOG_BY_ID[1139];
  assert.equal(nail!.name, "Iron Nail×12");
  assert.equal(nail!.kind, "intermediate");
  assert.equal(nail!.craftLevel, 19);
  assert.equal(nail!.craftOutputQty, 12);
  assert.equal(nail!.recipe?.gold, 430);
  const elixir = CATALOG_BY_ID[1140];
  assert.equal(elixir!.name, "Slag DEX Elixir");
  assert.equal(elixir!.kind, "consumable");
  assert.equal(elixir!.craftLevel, 53);
  assert.equal(elixir!.recipe?.gold, 1110);
  const belt = CATALOG_BY_ID[1141];
  assert.equal(belt!.name, "Fine Leather Belt");
  assert.equal(belt!.kind, "intermediate");
  assert.equal(belt!.craftLevel, 61);
  assert.equal(belt!.recipe?.gold, 1270);
  for (const id of [1134, 1135, 1136, 1137, 1138, 1139, 1140, 1141]) {
    assert.ok(recipeMaterialsComplete(CATALOG_BY_ID[id]!));
  }
});

test("batch E steel set and greatsword tiers fill smithing holes", () => {
  const helm = CATALOG_BY_ID[1110];
  assert.equal(helm!.name, "Steel Helm");
  assert.equal(helm!.rarity, "Uncommon");
  assert.equal(helm!.craftLevel, 32);
  assert.equal(helm!.recipe?.gold, 690);
  assert.deepEqual(helm!.jobRestrict, ["knight", "fighter"]);
  const mittens = CATALOG_BY_ID[1111];
  assert.equal(mittens!.name, "Steel Mittens");
  assert.equal(mittens!.craftLevel, 33);
  const shield = CATALOG_BY_ID[1112];
  assert.equal(shield!.name, "Steel Shield");
  assert.equal(shield!.slot, "sub");
  assert.deepEqual(shield!.jobRestrict, ["knight", "battlemage", "cleric"]);
  const subligar = CATALOG_BY_ID[1113];
  assert.equal(subligar!.name, "Steel Subligar");
  assert.equal(subligar!.craftLevel, 41);
  const sabatons = CATALOG_BY_ID[1114];
  assert.equal(sabatons!.slot, "feet");
  assert.equal(sabatons!.recipe?.gold, 910);
  const mail = CATALOG_BY_ID[1115];
  assert.equal(mail!.name, "Mythril Mail");
  assert.equal(mail!.rarity, "Rare");
  assert.deepEqual(mail!.jobRestrict, ["fighter"]);
  const ds = CATALOG_BY_ID[1116];
  assert.equal(ds!.name, "Darksteel Greatsword");
  assert.equal(ds!.weaponFamily, "greatsword");
  assert.equal(ds!.twoHand, true);
  assert.equal(ds!.delayMs, 3800);
  const ori = CATALOG_BY_ID[1117];
  assert.equal(ori!.name, "Orichalcum Greatsword");
  assert.equal(ori!.recipe?.gold, 1850);
  for (const id of [1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117]) {
    assert.ok(recipeMaterialsComplete(CATALOG_BY_ID[id]!));
  }
});

test("batch D leftover fills craft levels and jobs", () => {
  const gloves = CATALOG_BY_ID[1102];
  assert.equal(gloves!.name, "Battleweave Gloves");
  assert.equal(gloves!.craftLevel, 82);
  assert.equal(gloves!.recipe?.gold, 1690);
  assert.deepEqual(gloves!.jobRestrict, ["battlemage"]);
  const trousers = CATALOG_BY_ID[1103];
  assert.equal(trousers!.name, "Rogue's Trousers");
  assert.equal(trousers!.rarity, "Rare");
  assert.equal(trousers!.craftLevel, 85);
  const hose = CATALOG_BY_ID[1104];
  assert.equal(hose!.name, "Battleweave Hose");
  assert.equal(hose!.craftLevel, 86);
  const slippers = CATALOG_BY_ID[1105];
  assert.equal(slippers!.slot, "feet");
  assert.equal(slippers!.recipe?.gold, 1810);
  const cuisses = CATALOG_BY_ID[1106];
  assert.equal(cuisses!.name, "Orichalcum War Cuisses");
  assert.equal(cuisses!.rarity, "Epic");
  assert.deepEqual(cuisses!.jobRestrict, ["fighter"]);
  const cuffs = CATALOG_BY_ID[1107];
  assert.equal(cuffs!.rarity, "Legendary");
  assert.equal(cuffs!.craftLevel, 91);
  const slacks = CATALOG_BY_ID[1108];
  assert.equal(slacks!.name, "Throneweave Slacks");
  const pumps = CATALOG_BY_ID[1109];
  assert.equal(pumps!.name, "Throneweave Pumps");
  assert.equal(pumps!.recipe?.gold, 2010);
  for (const id of [1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109]) {
    assert.ok(recipeMaterialsComplete(CATALOG_BY_ID[id]!));
  }
});

test("battleweave hood fills clothcraft 81 for battlemage head", () => {
  const def = CATALOG_BY_ID[1101];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Hood");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.craftLevel, 81);
  assert.equal(def!.slot, "head");
  assert.equal(def!.recipe?.gold, 1670);
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("battleweave hat fills clothcraft 64 for battlemage head", () => {
  const def = CATALOG_BY_ID[1100];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Hat");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.craftSkill, "clothcraft");
  assert.equal(def!.craftLevel, 64);
  assert.equal(def!.slot, "head");
  assert.equal(def!.recipe?.gold, 1330);
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("rogue gloves fill leathercraft 83 for rogue hands", () => {
  const def = CATALOG_BY_ID[1097];
  assert.ok(def);
  assert.equal(def!.name, "Rogue's Gloves");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "hands");
  assert.equal(def!.recipe?.gold, 1710);
  assert.deepEqual(def!.jobRestrict, ["rogue"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("rogue boots fill leathercraft 84 for rogue feet", () => {
  const def = CATALOG_BY_ID[1098];
  assert.ok(def);
  assert.equal(def!.name, "Rogue's Boots");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "feet");
  assert.equal(def!.recipe?.gold, 1730);
  assert.deepEqual(def!.jobRestrict, ["rogue"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum dagger fills smithing 87 for rogue main", () => {
  const def = CATALOG_BY_ID[1099];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum Dagger");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.weaponFamily, "dagger");
  assert.equal(def!.delayMs, 1800);
  assert.equal(def!.recipe?.gold, 1790);
  assert.deepEqual(def!.jobRestrict, ["rogue"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("rogue helm fills leathercraft 81 for rogue head", () => {
  const def = CATALOG_BY_ID[1096];
  assert.ok(def);
  assert.equal(def!.name, "Rogue's Helm");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.craftSkill, "leathercraft");
  assert.equal(def!.craftLevel, 81);
  assert.equal(def!.slot, "head");
  assert.equal(def!.recipe?.gold, 1670);
  assert.deepEqual(def!.jobRestrict, ["rogue"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum war sabatons fill smithing 84 for fighter feet", () => {
  const def = CATALOG_BY_ID[1095];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum War Sabatons");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.craftSkill, "smithing");
  assert.equal(def!.craftLevel, 84);
  assert.equal(def!.slot, "feet");
  assert.equal(def!.recipe?.gold, 1730);
  assert.deepEqual(def!.jobRestrict, ["fighter"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum war gauntlets fill smithing 83 for fighter hands", () => {
  const def = CATALOG_BY_ID[1094];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum War Gauntlets");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.craftSkill, "smithing");
  assert.equal(def!.craftLevel, 83);
  assert.equal(def!.slot, "hands");
  assert.equal(def!.recipe?.gold, 1710);
  assert.deepEqual(def!.jobRestrict, ["fighter"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum war helm fills smithing 81 for fighter head", () => {
  const def = CATALOG_BY_ID[1093];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum War Helm");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.craftSkill, "smithing");
  assert.equal(def!.craftLevel, 81);
  assert.equal(def!.slot, "head");
  assert.equal(def!.recipe?.gold, 1670);
  assert.deepEqual(def!.jobRestrict, ["fighter"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("orichalcum mail fills smithing 85 for fighter body", () => {
  const def = CATALOG_BY_ID[1090];
  assert.ok(def);
  assert.equal(def!.name, "Orichalcum Mail");
  assert.equal(def!.rarity, "Epic");
  assert.deepEqual(def!.jobRestrict, ["fighter"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("rogue dagger fills bonecraft 61 for rogue main", () => {
  const def = CATALOG_BY_ID[1091];
  assert.ok(def);
  assert.equal(def!.name, "Rogue's Dagger");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.weaponFamily, "dagger");
  assert.deepEqual(def!.jobRestrict, ["rogue"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("altarweave hat fills clothcraft 62 for cleric head", () => {
  const def = CATALOG_BY_ID[1092];
  assert.ok(def);
  assert.equal(def!.name, "Altarweave Hat");
  assert.equal(def!.slot, "head");
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("steel mail fills smithing 37 for tank body", () => {
  const def = CATALOG_BY_ID[1089];
  assert.ok(def);
  assert.equal(def!.name, "Steel Mail");
  assert.equal(def!.rarity, "Uncommon");
  assert.equal(def!.slot, "body");
  assert.ok(def!.jobRestrict?.includes("knight"));
  assert.ok(def!.jobRestrict?.includes("fighter"));
  assert.ok(recipeMaterialsComplete(def!));
});

test("steel sword fills smithing 36 for tank hybrid main", () => {
  const def = CATALOG_BY_ID[1088];
  assert.ok(def);
  assert.equal(def!.name, "Steel Sword");
  assert.equal(def!.rarity, "Uncommon");
  assert.equal(def!.slot, "main");
  assert.equal(def!.weaponFamily, "sword");
  assert.ok(recipeMaterialsComplete(def!));
});

test("throneweave hat fills clothcraft 95 for caster head", () => {
  const def = CATALOG_BY_ID[1087];
  assert.ok(def);
  assert.equal(def!.name, "Throneweave Hat");
  assert.equal(def!.rarity, "Legendary");
  assert.equal(def!.slot, "head");
  assert.ok(def!.jobRestrict?.includes("tim"));
  assert.ok(def!.jobRestrict?.includes("sorcerer"));
  assert.ok(def!.jobRestrict?.includes("cleric"));
  assert.ok(recipeMaterialsComplete(def!));
});

test("altarweave cuffs fill clothcraft 74 for cleric hands", () => {
  const def = CATALOG_BY_ID[1082];
  assert.ok(def);
  assert.equal(def!.name, "Altarweave Cuffs");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "hands");
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("battleweave pumps fill clothcraft 71 for battlemage feet", () => {
  const def = CATALOG_BY_ID[1081];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Pumps");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "feet");
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("battleweave slacks fill clothcraft 67 for battlemage legs", () => {
  const def = CATALOG_BY_ID[1080];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Slacks");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "legs");
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("palace shield fills smithing 97 for knight sub", () => {
  const def = CATALOG_BY_ID[1079];
  assert.ok(def);
  assert.equal(def!.name, "Palace Shield");
  assert.equal(def!.rarity, "Legendary");
  assert.equal(def!.slot, "sub");
  assert.deepEqual(def!.jobRestrict, ["knight"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("darksteel targe fills smithing 75 for hybrid healer sub", () => {
  const def = CATALOG_BY_ID[1078];
  assert.ok(def);
  assert.equal(def!.name, "Darksteel Targe");
  assert.equal(def!.rarity, "Epic");
  assert.equal(def!.slot, "sub");
  assert.ok(def!.jobRestrict?.includes("battlemage"));
  assert.ok(def!.jobRestrict?.includes("cleric"));
  assert.ok(recipeMaterialsComplete(def!));
});

test("battleweave cuffs fill clothcraft 63 for battlemage hands", () => {
  const def = CATALOG_BY_ID[1077];
  assert.ok(def);
  assert.equal(def!.name, "Battleweave Cuffs");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.slot, "hands");
  assert.deepEqual(def!.jobRestrict, ["battlemage"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("bellwood crozier fills woodworking 70 for cleric main", () => {
  const def = CATALOG_BY_ID[1076];
  assert.ok(def);
  assert.equal(def!.name, "Bellwood Crozier");
  assert.equal(def!.rarity, "Uncommon");
  assert.equal(def!.twoHand, true);
  assert.equal(def!.craftLevel, 70);
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("ashbeam tome fills clothcraft 55 for tim main", () => {
  const def = CATALOG_BY_ID[1075];
  assert.ok(def);
  assert.equal(def!.name, "Ashbeam Tome");
  assert.equal(def!.rarity, "Common");
  assert.equal(def!.craftSkill, "clothcraft");
  assert.equal(def!.craftLevel, 55);
  assert.equal(def!.slot, "main");
  assert.deepEqual(def!.jobRestrict, ["tim"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("bloodbeam crozier fills woodworking 57 for cleric main", () => {
  const def = CATALOG_BY_ID[1074];
  assert.ok(def);
  assert.equal(def!.name, "Bloodbeam Crozier");
  assert.equal(def!.rarity, "Uncommon");
  assert.equal(def!.craftSkill, "woodworking");
  assert.equal(def!.craftLevel, 57);
  assert.equal(def!.slot, "main");
  assert.equal(def!.weaponFamily, "staff");
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.ok(recipeMaterialsComplete(def!));
});

test("iron shield fills smithing 31 for tank hybrid healer sub", () => {
  const def = CATALOG_BY_ID[1073];
  assert.ok(def);
  assert.equal(def!.name, "Iron Shield");
  assert.equal(def!.rarity, "Common");
  assert.equal(def!.craftSkill, "smithing");
  assert.equal(def!.craftLevel, 31);
  assert.equal(def!.slot, "sub");
  assert.ok(def!.jobRestrict?.includes("knight"));
  assert.ok(def!.jobRestrict?.includes("battlemage"));
  assert.ok(def!.jobRestrict?.includes("cleric"));
  assert.ok(recipeMaterialsComplete(def!));
});

test("altarweave coat fills clothcraft 72 for cleric body", () => {
  const def = CATALOG_BY_ID[1072];
  assert.ok(def);
  assert.equal(def!.name, "Altarweave Coat");
  assert.equal(def!.rarity, "Rare");
  assert.equal(def!.craftSkill, "clothcraft");
  assert.equal(def!.craftLevel, 72);
  assert.equal(def!.slot, "body");
  assert.deepEqual(def!.jobRestrict, ["cleric"]);
  assert.equal(def!.stats?.mnd, 31);
  assert.ok(recipeMaterialsComplete(def!));
});

test("smithing has craft recipes at levels 2 and 4", () => {
  const smith = craftablesForSkill("smithing");
  assert.ok(smith.some((i) => i.id === 1066 && i.craftLevel === 2));
  assert.ok(smith.some((i) => i.id === 1067 && i.craftLevel === 4));
  assert.ok(recipeMaterialsComplete(getCraftableItem(1066)!));
  assert.ok(recipeMaterialsComplete(getCraftableItem(1067)!));
});

test("allCraftableRecipes is sorted by level then name", () => {
  const all = allCraftableRecipes();
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!;
    const b = all[i]!;
    const dl = (a.craftLevel ?? 0) - (b.craftLevel ?? 0);
    assert.ok(dl <= 0, `${a.name} vs ${b.name}`);
    if (dl === 0) assert.ok(a.name.localeCompare(b.name) <= 0);
  }
});
