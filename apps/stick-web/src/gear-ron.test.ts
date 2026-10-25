import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GearParseError, parseGear, parsePlate, solveIdle, solveWalk } from "./gear-ron.ts";

const gearDir = new URL("../../../engine/", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, gearDir), "utf8");
}

test("iron cuirass parses as a chest plate", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_cuirass.ron"));
  assert.equal(g.id, "ba_iron_cuirass");
  assert.equal(g.slot, "Chest");
  assert.equal(g.attach, "chest");
  assert.equal(g.material, "steel");
  assert.equal(g.thicknessMul.spine, 1.72);
  assert.equal(g.shapes.length, 11);
  const plate = g.shapes[0]!;
  assert.equal(plate.kind, "Capsule");
  assert.equal(plate.ramp, "Material");
  assert.ok(plate.to[1] < plate.from[1], "plate hangs down the chest");
  const steel = g.shapes.filter((s) => s.kind === "Capsule" && s.ramp === "Material");
  assert.ok(steel.length >= 3, "chest and waist overlap into one plate");
  const shoulder = g.shapes.find((s) => s.at === "l_shoulder" && s.ramp === "Material");
  const stud = g.shapes.find((s) => s.at === "l_shoulder" && s.ramp === "Trim");
  assert.ok(shoulder && stud && stud.r < shoulder.r);
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_iron_cuirass.plate.ron"));
  assert.equal(paint.id, "ba_iron_cuirass");
  assert.equal(paint.rows.length, 18);
  assert.ok(paint.y0 < -0.36);
  assert.ok(paint.armTo > paint.armFrom);
  assert.equal(paint.rows[0]!.length, 15);
  assert.ok(paint.rows.some((r) => r.includes("g")));
  assert.ok(paint.rows.some((r) => r.includes("r")));
  assert.ok(paint.z > 0);
});

test("engine example gear parses", () => {
  const sword = parseGear(read("stick-engine/crates/stick_engine/assets/gear/sword.ron"));
  assert.equal(sword.id, "sword");
  assert.equal(sword.slot, "MainHand");
  assert.equal(sword.attach, "r_hand");
  assert.equal(sword.stance, "1h");
  assert.equal(sword.reach, 0.9);
  assert.equal(sword.shapes.length, 3);
  const great = parseGear(read("stick-engine/crates/stick_engine/assets/gear/greatsword.ron"));
  assert.equal(great.swingWeight, 1.4);
  assert.equal(great.shapes[2]!.to[1], 1.3);
  const shield = parseGear(read("stick-engine/crates/stick_engine/assets/gear/shield.ron"));
  assert.equal(shield.attach, "l_hand");
  assert.equal(shield.shapes[0]!.r, 0.22);
  const cuirass = parseGear(read("stick-engine/crates/stick_engine/assets/gear/cuirass.ron"));
  assert.equal(cuirass.shapes.length, 2);
  assert.equal(cuirass.thicknessMul.shoulders, 1.2);
});

test("a broken file names the line", () => {
  assert.throws(() => parseGear("(\n  id: \n)"), GearParseError);
});

test("wizard robe is a long cloth with a flowing hem", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_wizard_robe.ron"));
  assert.equal(g.id, "ba_wizard_robe");
  assert.equal(g.slot, "Chest");
  assert.equal(g.material, "dust");
  assert.equal(g.shapes.length, 14);
  const hem = g.shapes.find((s) => s.kind === "Capsule" && s.to[1] < -1.1);
  assert.ok(hem, "skirt reaches the ankles");
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_wizard_robe.plate.ron"));
  assert.equal(paint.rows.length, 18);
  assert.equal(paint.rows[0]!.length, 15);
  assert.ok(paint.flow > 0.2);
  assert.ok(paint.sleeveDrop > 0.2);
  assert.ok(paint.y0 < -1);
  assert.ok(paint.rows.every((row) => !row.includes(".")), "every robe pixel is painted");
});

test("leather vest is a short mesh with shoulder straps", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_leather_vest.ron"));
  assert.equal(g.id, "ba_leather_vest");
  assert.equal(g.slot, "Chest");
  assert.equal(g.attach, "chest");
  assert.equal(g.material, "leather");
  assert.equal(g.shapes.length, 2);
  assert.ok(g.shapes.every((s) => s.kind === "Capsule"));
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_leather_vest.plate.ron"));
  assert.equal(paint.rows.length, 12);
  assert.equal(paint.rows[0]!.length, 15);
  assert.ok(paint.wrap > 0.2 && paint.wrap < 0.45);
  assert.equal(paint.flow, 0);
  assert.ok(paint.rows.every((row) => !row.includes(".")));
  assert.ok(paint.rows.some((row) => row.includes("l")));
  assert.ok(paint.rows.some((row) => row.includes("d")));
  assert.ok(paint.rows.some((row) => row.includes("k")));
});

test("bone harness is a hide mesh with bone ribs", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_bone_harness.ron"));
  assert.equal(g.id, "ba_bone_harness");
  assert.equal(g.slot, "Chest");
  assert.equal(g.attach, "chest");
  assert.equal(g.material, "bone");
  assert.equal(g.shapes.length, 8);
  assert.ok(g.shapes.every((s) => s.kind === "Capsule"));
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_bone_harness.plate.ron"));
  assert.equal(paint.rows.length, 12);
  assert.equal(paint.rows[0]!.length, 15);
  assert.ok(paint.wrap > 0.2 && paint.wrap < 0.45);
  assert.equal(paint.flow, 0);
  assert.ok(paint.rows.every((row) => !row.includes(".")));
  assert.ok(paint.rows.some((row) => row.includes("h")));
  assert.ok(paint.rows.some((row) => row.includes("s")));
});

test("iron helm is strips on invisible disks", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_helm.ron"));
  assert.equal(g.id, "ba_iron_helm");
  assert.equal(g.slot, "Head");
  assert.equal(g.attach, "head");
  assert.equal(g.shapes.length, 0);
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_iron_helm.plate.ron"));
  assert.equal(paint.flow, 0);
  assert.equal(paint.wrap, 0);
  assert.ok(paint.rows.every((row) => !row.includes(".")));
  assert.ok(paint.rows.every((row) => !row.includes("i")));
  assert.ok(paint.rows.some((row) => row.includes("e")));
  assert.ok(paint.rows.some((row) => row.includes("g")));
});

test("bronze helm plate uses warm bronze pixels", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_bronze_helm.ron"));
  assert.equal(g.id, "ba_bronze_helm");
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_bronze_helm.plate.ron"));
  assert.ok(paint.rows.some((row) => row.includes("o")));
});

test("mythril helm plate is light blue and white", () => {
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_mythril_helm.plate.ron"));
  assert.ok(paint.rows.some((row) => row.includes("n")));
  assert.ok(paint.rows.some((row) => row.includes("w")));
  assert.ok(paint.rows.every((row) => !row.includes("g")));
});

test("headband is a short forehead ring stack", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_headband.ron"));
  assert.equal(g.id, "ba_headband");
  assert.equal(g.slot, "Head");
  assert.equal(g.material, "dust");
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_headband.plate.ron"));
  assert.equal(paint.rows.length, 4);
  assert.ok(paint.rows.every((row) => row.includes("l") || row.includes("d")));
});

test("torque and circlet plates reskin the headband mesh", () => {
  const bell = parsePlate(read("ba-stick-render/assets/gear/ba_bell_torque_band.plate.ron"));
  assert.ok(bell.rows.some((row) => row.includes("g")));
  assert.ok(bell.rows.some((row) => row.includes("r")));
  const circlet = parsePlate(read("ba-stick-render/assets/gear/ba_circlet.plate.ron"));
  assert.ok(circlet.rows.some((row) => row.includes("o")));
  assert.ok(circlet.rows.some((row) => row.includes("r")));
  const mythril = parsePlate(read("ba-stick-render/assets/gear/ba_mythril_torque.plate.ron"));
  assert.ok(mythril.rows.some((row) => row.includes("n")));
  assert.ok(mythril.rows.some((row) => row.includes("w")));
  const leather = parsePlate(read("ba-stick-render/assets/gear/ba_leather_bandana.plate.ron"));
  assert.equal(leather.rows.length, 8);
  assert.ok(leather.rows.some((row) => row.includes("k")));
  assert.ok(leather.rows.every((row) => /[ldk]/.test(row)));
});

test("bandana plates reskin the leather bandana mesh", () => {
  for (const [file, need] of [
    ["ba_linen_helm.plate.ron", "l"],
    ["ba_fine_jerkin_helm.plate.ron", "e"],
    ["ba_shade_leather_bandana.plate.ron", "k"],
    ["ba_skull_bandana.plate.ron", "h"],
  ] as const) {
    const paint = parsePlate(read(`ba-stick-render/assets/gear/${file}`));
    assert.equal(paint.rows.length, 8, file);
    assert.ok(paint.rows.some((row) => row.includes(need)), file);
  }
});

test("cloth hat is a pointed stack of invisible disks", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_cloth_hat.ron"));
  assert.equal(g.id, "ba_cloth_hat");
  assert.equal(g.slot, "Head");
  assert.equal(g.attach, "head");
  assert.equal(g.material, "dust");
  assert.equal(g.shapes.length, 0);
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_cloth_hat.plate.ron"));
  assert.equal(paint.flow, 0);
  assert.equal(paint.wrap, 0);
  assert.ok(paint.rows.every((row) => row.length === paint.rows[0]!.length));
  assert.ok(paint.rows.every((row) => !row.includes(".")));
  assert.ok(paint.rows.every((row) => !row.includes("e") && !row.includes("g") && !row.includes("i")));
  assert.ok(paint.rows.every((row) => row.split("").every((cell) => cell === "b")));
});

test("silk and velvet hats are solid fills on the cloth hat mesh", () => {
  const silk = parsePlate(read("ba-stick-render/assets/gear/ba_silk_hat.plate.ron"));
  assert.ok(silk.rows.every((row) => row.split("").every((cell) => cell === "w")));
  const velvet = parsePlate(read("ba-stick-render/assets/gear/ba_velvet_hat.plate.ron"));
  assert.ok(velvet.rows.every((row) => row.split("").every((cell) => cell === "c")));
  assert.equal(silk.rows.length, velvet.rows.length);
});

test("iron shield is a faced plane with a grip", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_shield.ron"));
  assert.equal(g.id, "ba_iron_shield");
  assert.equal(g.slot, "OffHand");
  assert.equal(g.attach, "l_hand");
  assert.equal(g.stance, "shield");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes.length, 1);
  assert.equal(g.shapes[0]!.kind, "Capsule");
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_iron_shield.plate.ron"));
  assert.equal(paint.flow, 0);
  assert.equal(paint.wrap, 0);
  assert.ok(paint.rows.every((row) => row.length === paint.rows[0]!.length));
  assert.ok(paint.rows.every((row) => !row.includes(".") && !row.includes("i") && !row.includes("k")));
  assert.ok(paint.rows.some((row) => row.includes("e")));
  assert.ok(paint.rows[paint.rows.length - 1]!.split("").every((cell) => cell === "g"));
});

test("kite shield is a pointed face with a grip", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_kite_shield.ron"));
  assert.equal(g.id, "ba_kite_shield");
  assert.equal(g.slot, "OffHand");
  assert.equal(g.attach, "l_hand");
  assert.equal(g.stance, "shield");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes.length, 1);
  assert.equal(g.shapes[0]!.kind, "Capsule");
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_kite_shield.plate.ron"));
  assert.equal(paint.flow, 0);
  assert.equal(paint.wrap, 0);
  assert.ok(paint.rows.every((row) => row.length === paint.rows[0]!.length));
  assert.ok(paint.rows.every((row) => row.split("").every((cell) => cell === "e")));
});

test("iron cuisses are plates on the thighs", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_cuisses.ron"));
  assert.equal(g.id, "ba_iron_cuisses");
  assert.equal(g.slot, "Legs");
  assert.equal(g.attach, "pelvis");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes.length, 0);
  const paint = parsePlate(read("ba-stick-render/assets/gear/ba_iron_cuisses.plate.ron"));
  assert.equal(paint.flow, 0);
  assert.equal(paint.wrap, 0);
  assert.ok(paint.rows.every((row) => row.length === paint.rows[0]!.length));
  assert.ok(paint.rows.every((row) => !row.includes(".") && !row.includes("i") && !row.includes("k")));
  assert.ok(paint.rows[0]!.split("").every((cell) => cell === "g"));
  assert.ok(paint.rows[paint.rows.length - 1]!.split("").every((cell) => cell === "g"));
  assert.ok(paint.rows.some((row) => row.includes("e")));
});

test("iron shovel is a shaft and a wide blade", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_shovel.ron"));
  assert.equal(g.id, "ba_iron_shovel");
  assert.equal(g.slot, "MainHand");
  assert.equal(g.attach, "r_hand");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes.length, 2);
  assert.ok((g.reach ?? 0) > 0.8);
});

test("iron pickaxe is a shaft and a head across it", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_pickaxe.ron"));
  assert.equal(g.id, "ba_iron_pickaxe");
  assert.equal(g.slot, "MainHand");
  assert.equal(g.attach, "r_hand");
  assert.equal(g.shapes.length, 2);
  assert.ok(g.shapes.every((sh) => sh.kind === "Capsule"));
  const head = g.shapes[1]!;
  assert.equal(head.kind, "Capsule");
  if (head.kind === "Capsule") {
    assert.ok(head.from[0]! < 0 && head.to[0]! > 0);
  }
});

test("iron sword is a grip, a guard, and a long blade", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_sword.ron"));
  assert.equal(g.id, "ba_iron_sword");
  assert.equal(g.slot, "MainHand");
  assert.equal(g.attach, "r_hand");
  assert.equal(g.stance, "1h");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes.length, 2);
  assert.ok(g.shapes.every((sh) => sh.kind === "Capsule"));
  assert.ok((g.reach ?? 0) > 0.7);
});

test("bronze axe is a haft with a pixel labrys head", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_bronze_axe.ron"));
  assert.equal(g.id, "ba_bronze_axe");
  assert.equal(g.material, "steel");
  assert.equal(g.shapes[0]?.ramp, "Trim");
  assert.equal(g.shapes.length, 1);
  assert.ok(g.reach > 0.5);
});

test("great axes are 2h labrys with a long haft", () => {
  for (const file of [
    "ba_iron_great_axe",
    "ba_darksteel_great_axe",
    "ba_palace_great_axe",
  ] as const) {
    const g = parseGear(read(`ba-stick-render/assets/gear/${file}.ron`));
    assert.equal(g.id, file);
    assert.equal(g.stance, "2h");
    assert.equal(g.shapes[0]?.from[1], -0.88);
    assert.equal(g.shapes[0]?.to[1], 0.11);
  }
});

test("bronze sword matches iron layout with leather grip", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_bronze_sword.ron"));
  assert.equal(g.id, "ba_bronze_sword");
  assert.equal(g.material, "leather");
  assert.equal(g.shapes.length, 2);
});

test("iron dagger is a grip only with no guard capsule", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_dagger.ron"));
  assert.equal(g.id, "ba_iron_dagger");
  assert.equal(g.shapes.length, 1);
  assert.ok(g.shapes[0]?.kind === "Capsule");
});

test("decayed axe matches bronze axe haft layout", () => {
  const bronze = parseGear(read("ba-stick-render/assets/gear/ba_bronze_axe.ron"));
  const decayed = parseGear(read("ba-stick-render/assets/gear/ba_decayed_axe.ron"));
  assert.equal(decayed.shapes.length, bronze.shapes.length);
  assert.equal(decayed.reach, bronze.reach);
  assert.equal(decayed.stance, bronze.stance);
  assert.equal(decayed.swingWeight, bronze.swingWeight);
});

test("decayed sword matches iron sword layout", () => {
  const iron = parseGear(read("ba-stick-render/assets/gear/ba_iron_sword.ron"));
  const decayed = parseGear(read("ba-stick-render/assets/gear/ba_decayed_sword.ron"));
  const greatAxe = parseGear(read("ba-stick-render/assets/gear/ba_iron_great_axe.ron"));
  assert.equal(decayed.shapes.length, iron.shapes.length);
  assert.equal(decayed.reach, iron.reach);
  assert.equal(decayed.stance, iron.stance);
  assert.equal(decayed.swingWeight, iron.swingWeight);
  assert.notEqual(decayed.shapes.length, greatAxe.shapes.length);
  assert.equal(greatAxe.stance, "2h");
  const cap = (g: ReturnType<typeof parseGear>) =>
    g.shapes.filter((s) => s.kind === "Capsule").map((s) => ({ from: s.from, to: s.to, thick: s.thick }));
  assert.deepEqual(cap(decayed), cap(iron), "same grip + crossguard capsules as ba_iron_sword");
});

test("bone, neolithic, and fang daggers match iron dagger grip layout", () => {
  const iron = parseGear(read("ba-stick-render/assets/gear/ba_iron_dagger.ron"));
  const sword = parseGear(read("ba-stick-render/assets/gear/ba_iron_sword.ron"));
  assert.equal(iron.shapes.length, 1);
  assert.equal(sword.shapes.length, 2);
  for (const file of ["ba_bone_dagger", "ba_neolithic_dagger", "ba_fang_dagger"]) {
    const g = parseGear(read(`ba-stick-render/assets/gear/${file}.ron`));
    assert.equal(g.shapes.length, 1, `${file} must not copy iron sword crossguard capsule`);
    assert.equal(g.reach, iron.reach);
    assert.equal(g.swingWeight, iron.swingWeight);
    assert.equal(g.stance, iron.stance);
    assert.equal(g.shapes[0]?.kind, "Capsule");
  }
  assert.equal(parseGear(read("ba-stick-render/assets/gear/ba_bone_dagger.ron")).material, "bone");
});

test("iron greatsword is 2h with a longer grip capsule", () => {
  const g = parseGear(read("ba-stick-render/assets/gear/ba_iron_greatsword.ron"));
  assert.equal(g.id, "ba_iron_greatsword");
  assert.equal(g.stance, "2h");
  assert.ok(g.shapes[0]?.from[1]! < -0.2);
});

test("steel and mythril greatswords match iron greatsword layout", () => {
  for (const file of ["ba_steel_greatsword", "ba_mythril_greatsword"]) {
    const g = parseGear(read(`ba-stick-render/assets/gear/${file}.ron`));
    assert.equal(g.stance, "2h");
    assert.equal(g.shapes.length, 2);
  }
  const mythril = parseGear(read("ba-stick-render/assets/gear/ba_mythril_greatsword.ron"));
  assert.equal(mythril.material, "mythril");
});

test("tier swords share iron sword layout", () => {
  for (const file of ["ba_darksteel_blade", "ba_mythril_sword", "ba_orichalcum_sword"]) {
    const g = parseGear(read(`ba-stick-render/assets/gear/${file}.ron`));
    assert.equal(g.id, file);
    assert.equal(g.shapes.length, 2);
    assert.ok(g.material);
  }
});

test("a walk stride swings the feet opposite ways", () => {
  const fig = solveWalk(0, 0.25);
  assert.ok(fig.joints.l_foot!.z > fig.joints.r_foot!.z + 0.1);
  const back = solveWalk(0, 0.75);
  assert.ok(back.joints.r_foot!.z > back.joints.l_foot!.z + 0.1);
});

test("idle pose stands and the right hand hangs to the right", () => {
  const fig = solveIdle(0);
  assert.ok(fig.joints.chest!.y > fig.joints.pelvis!.y);
  assert.ok(fig.joints.head!.y > fig.joints.chest!.y);
  assert.ok(fig.joints.r_hand!.x > fig.joints.l_hand!.x);
  assert.ok(fig.joints.l_foot!.y < fig.joints.pelvis!.y);
});
