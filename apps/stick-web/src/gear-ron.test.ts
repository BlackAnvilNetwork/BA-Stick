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
