import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, getItem } from "../../../packages/items/src/index.ts";
import { FAMILY, familyOf, gearArgs, materialOf } from "./gear.ts";

test("every equipment item maps to a look", () => {
  for (const it of CATALOG.filter((i) => i.kind === "equipment")) {
    assert.ok(materialOf(it) >= 1 && materialOf(it) <= 6, it.slug);
    if (it.slot === "main") assert.ok(familyOf(it) >= 1 && familyOf(it) <= 7, it.slug);
  }
});

test("mythril plate and blades stay metal; jewelry stays gold", () => {
  const helm = getItem(127)!;
  assert.equal(helm.craftSkill, "goldsmithing");
  assert.equal(materialOf(helm), 3);
  const sword = getItem(126)!;
  assert.equal(sword.craftSkill, "goldsmithing");
  assert.equal(materialOf(sword), 3);
  const mail = getItem(1115)!;
  assert.equal(mail.craftSkill, "goldsmithing");
  assert.equal(materialOf(mail), 3);
  const torque = getItem(315)!;
  assert.equal(torque.craftSkill, "goldsmithing");
  assert.equal(materialOf(torque), 6);
  const ring = getItem(367)!;
  assert.equal(ring.craftSkill, "goldsmithing");
  assert.equal(materialOf(ring), 6);
});

test("gap-fill weapons map to club, sword, and dagger families", () => {
  const mace = getItem(1232)!;
  assert.equal(mace.slug, "iron-mace");
  assert.equal(familyOf(mace), FAMILY.club);
  const sword = getItem(1242)!;
  assert.equal(sword.slug, "bronze-shortsword");
  assert.equal(familyOf(sword), FAMILY.sword);
  const kris = getItem(1245)!;
  assert.equal(kris.slug, "bronze-kris");
  assert.equal(familyOf(kris), FAMILY.dagger);
  const war = getItem(1241)!;
  assert.equal(familyOf(war), FAMILY.sword);
});

test("bone knuckles use knuckles family", () => {
  const kn = getItem(316)!;
  assert.equal(kn.slug, "bone-knuckles");
  assert.equal(kn.weaponFamily, "knuckles");
  assert.equal(familyOf(kn), FAMILY.knuckles);
  const a = gearArgs({ main: 316 }, getItem);
  assert.equal(a[0], FAMILY.knuckles);
  assert.equal(a[2], 316);
});

test("decayed axe uses axe family for in-world pixel draw", () => {
  const decayed = getItem(1065)!;
  assert.equal(decayed.slug, "decayed-axe");
  assert.equal(familyOf(decayed), FAMILY.axe);
  const a = gearArgs({ main: 1065 }, getItem);
  assert.equal(a[0], FAMILY.axe);
  assert.equal(a[2], 1065);
});

test("decayed sword uses sword family for in-world pixel draw", () => {
  const decayed = getItem(1064)!;
  assert.equal(decayed.slug, "decayed-sword");
  assert.equal(familyOf(decayed), FAMILY.sword);
  const a = gearArgs({ main: 1064 }, getItem);
  assert.equal(a[0], FAMILY.sword);
  assert.equal(a[2], 1064);
});

test("gear args from equipment", () => {
  const staff = CATALOG.find((i) => i.slug === "ashbeam-staff")!;
  const robe = CATALOG.find((i) => i.slug === "linen-robe")!;
  const a = gearArgs({ main: staff.id, body: robe.id, head: null }, getItem);
  assert.deepEqual(a, [5, 4, staff.id, 1, robe.id, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(gearArgs(undefined, getItem), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("feet gear args seed catalog id for sabatons", () => {
  const bronze = getItem(1068)!;
  assert.equal(bronze.slug, "bronze-sabatons");
  assert.equal(bronze.slot, "feet");
  const a = gearArgs({ feet: 1068 }, getItem);
  assert.equal(a[9], 3);
  assert.equal(a[10], 1068);
  const coat = gearArgs({ body: 1071 }, getItem);
  assert.equal(coat[3], 1);
  assert.equal(coat[4], 1071);
  const altar = gearArgs({ body: 1072 }, getItem);
  assert.equal(altar[3], 1);
  assert.equal(altar[4], 1072);
  const shield = gearArgs({ sub: 1073 }, getItem);
  assert.equal(shield[11], 1073);
  const crozier = getItem(1074)!;
  assert.equal(familyOf(crozier), FAMILY.staff);
  const c = gearArgs({ main: 1074 }, getItem);
  assert.equal(c[0], FAMILY.staff);
  assert.equal(c[2], 1074);
  const cuffs = gearArgs({ hands: 1077 }, getItem);
  assert.equal(cuffs[12], 1077);
});

test("batch D catalog ids seed head hands legs feet", () => {
  const hat = gearArgs({ head: 1100 }, getItem);
  assert.equal(hat[5], 1);
  assert.equal(hat[6], 1100);
  const hood = gearArgs({ head: 1101 }, getItem);
  assert.equal(hood[6], 1101);
  const gloves = gearArgs({ hands: 1102 }, getItem);
  assert.equal(gloves[12], 1102);
  const trousers = gearArgs({ legs: 1103 }, getItem);
  assert.equal(trousers[7], 2);
  assert.equal(trousers[8], 1103);
  const hose = gearArgs({ legs: 1104 }, getItem);
  assert.equal(hose[8], 1104);
  const slippers = gearArgs({ feet: 1105 }, getItem);
  assert.equal(slippers[9], 1);
  assert.equal(slippers[10], 1105);
  const cuisses = gearArgs({ legs: 1106 }, getItem);
  assert.equal(cuisses[7], 3);
  assert.equal(cuisses[8], 1106);
  const twCuffs = gearArgs({ hands: 1107 }, getItem);
  assert.equal(twCuffs[12], 1107);
  const slacks = gearArgs({ legs: 1108 }, getItem);
  assert.equal(slacks[8], 1108);
  const pumps = gearArgs({ feet: 1109 }, getItem);
  assert.equal(pumps[10], 1109);
});

test("batch E catalog ids seed steel set and greatswords", () => {
  const helm = gearArgs({ head: 1110 }, getItem);
  assert.equal(helm[5], 3);
  assert.equal(helm[6], 1110);
  const mittens = gearArgs({ hands: 1111 }, getItem);
  assert.equal(mittens[12], 1111);
  const shield = gearArgs({ sub: 1112 }, getItem);
  assert.equal(shield[11], 1112);
  const legs = gearArgs({ legs: 1113 }, getItem);
  assert.equal(legs[7], 3);
  assert.equal(legs[8], 1113);
  const feet = gearArgs({ feet: 1114 }, getItem);
  assert.equal(feet[10], 1114);
  const mail = gearArgs({ body: 1115 }, getItem);
  assert.equal(mail[3], 3);
  assert.equal(mail[4], 1115);
  const ds = getItem(1116)!;
  assert.equal(familyOf(ds), FAMILY.greatsword);
  const dsa = gearArgs({ main: 1116 }, getItem);
  assert.equal(dsa[0], FAMILY.greatsword);
  assert.equal(dsa[2], 1116);
  const ori = gearArgs({ main: 1117 }, getItem);
  assert.equal(ori[0], FAMILY.greatsword);
  assert.equal(ori[2], 1117);
});

test("batch F catalog ids seed metal weapons and targe", () => {
  const bronzeGreat = getItem(1118)!;
  assert.equal(familyOf(bronzeGreat), FAMILY.greatsword);
  assert.equal(gearArgs({ main: 1118 }, getItem)[2], 1118);
  const ironAxe = getItem(1119)!;
  assert.equal(familyOf(ironAxe), FAMILY.axe);
  assert.equal(gearArgs({ main: 1119 }, getItem)[0], FAMILY.axe);
  const steelGaxe = gearArgs({ main: 1120 }, getItem);
  assert.equal(steelGaxe[0], FAMILY.axe);
  assert.equal(steelGaxe[2], 1120);
  const targe = gearArgs({ sub: 1121 }, getItem);
  assert.equal(targe[11], 1121);
  const mythGaxe = gearArgs({ main: 1122 }, getItem);
  assert.equal(mythGaxe[0], FAMILY.axe);
  const mythDag = getItem(1123)!;
  assert.equal(familyOf(mythDag), FAMILY.dagger);
  assert.equal(gearArgs({ main: 1123 }, getItem)[2], 1123);
  const dsDag = gearArgs({ main: 1124 }, getItem);
  assert.equal(dsDag[0], FAMILY.dagger);
  const palace = getItem(1125)!;
  assert.equal(familyOf(palace), FAMILY.sword);
  assert.equal(gearArgs({ main: 1125 }, getItem)[2], 1125);
});

test("batch G catalog ids seed 1H axes bronze dagger and bone extremities", () => {
  const bronzeDag = getItem(1126)!;
  assert.equal(familyOf(bronzeDag), FAMILY.dagger);
  assert.equal(gearArgs({ main: 1126 }, getItem)[2], 1126);
  const bronzeGaxe = getItem(1127)!;
  assert.equal(familyOf(bronzeGaxe), FAMILY.axe);
  assert.equal(gearArgs({ main: 1127 }, getItem)[2], 1127);
  const steelDag = gearArgs({ main: 1128 }, getItem);
  assert.equal(steelDag[0], FAMILY.dagger);
  const steelAxe = getItem(1129)!;
  assert.equal(familyOf(steelAxe), FAMILY.axe);
  assert.equal(gearArgs({ main: 1129 }, getItem)[0], FAMILY.axe);
  const mythAxe = gearArgs({ main: 1130 }, getItem);
  assert.equal(mythAxe[0], FAMILY.axe);
  const dsAxe = gearArgs({ main: 1131 }, getItem);
  assert.equal(dsAxe[0], FAMILY.axe);
  const gloves = gearArgs({ hands: 1132 }, getItem);
  assert.equal(gloves[12], 1132);
  const boots = gearArgs({ feet: 1133 }, getItem);
  assert.equal(boots[9], 5);
  assert.equal(boots[10], 1133);
});

test("batch H catalog ids seed orichalcum axes shields and palace blades", () => {
  const oriAxe = getItem(1134)!;
  assert.equal(familyOf(oriAxe), FAMILY.axe);
  assert.equal(gearArgs({ main: 1134 }, getItem)[0], FAMILY.axe);
  assert.equal(gearArgs({ main: 1134 }, getItem)[2], 1134);
  const oriGaxe = gearArgs({ main: 1135 }, getItem);
  assert.equal(oriGaxe[0], FAMILY.axe);
  assert.equal(oriGaxe[2], 1135);
  const shield = gearArgs({ sub: 1136 }, getItem);
  assert.equal(shield[11], 1136);
  const palaceGs = getItem(1137)!;
  assert.equal(familyOf(palaceGs), FAMILY.greatsword);
  assert.equal(gearArgs({ main: 1137 }, getItem)[2], 1137);
  const targe = gearArgs({ sub: 1138 }, getItem);
  assert.equal(targe[11], 1138);
});
