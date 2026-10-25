import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGear, parsePlate } from "./gear-ron.ts";
import {
  checkDoc, fmtNum, formatGear, formatPlate, gearDocFrom, newGear, newPlate, plateDocFrom, plateSafe,
} from "./gear-ron-write.ts";

const gearDir = new URL("../../../engine/ba-stick-render/assets/gear/", import.meta.url);
const files = readdirSync(gearDir).filter((f) => f.endsWith(".ron"));
const read = (f: string) => readFileSync(new URL(f, gearDir), "utf8");

test("numbers always carry a decimal point", () => {
  assert.equal(fmtNum(3), "3.0");
  assert.equal(fmtNum(-0), "0.0");
  assert.equal(fmtNum(0.075), "0.075");
  assert.equal(fmtNum(-0.123456), "-0.1235");
  assert.equal(fmtNum(1e-6), "0.0");
});

test("every bundled gear file survives open and save", () => {
  for (const f of files.filter((f) => !f.endsWith(".plate.ron"))) {
    const src = read(f);
    const again = parseGear(formatGear(gearDocFrom(src)));
    assert.deepEqual(again, parseGear(src), f);
  }
});

test("every bundled plate survives open and save", () => {
  for (const f of files.filter((f) => f.endsWith(".plate.ron"))) {
    const src = read(f);
    const { id, plate } = plateDocFrom(src);
    assert.deepEqual(parsePlate(formatPlate(id, plate)), parsePlate(src), f);
  }
});

test("comments stay with their shapes", () => {
  const out = formatGear(gearDocFrom(read("ba_iron_cuirass.ron")));
  assert.match(out, /^\/\/ Copyright \(c\) 2026 Black Anvil Network/);
  assert.match(out, /\/\/ Spine of the plate, collar to below the ribs\.\n {8}Capsule\(\n {12}from: \(0\.0, -0\.02, 0\.05\)/);
  assert.match(out, /\n\n {8}\/\/ Straps from the plate corners/);
  assert.match(out, /Disc\(at: Some\("l_shoulder"\), r: 0\.075, ramp: Material\),/);
  const order = ["id:", "slot:", "attach:", "material:", "thickness_mul:", "shapes:"].map((k) => out.indexOf(`    ${k}`));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("plate comments cannot be read as a field or a row", () => {
  assert.equal(plateSafe('the "gold" z: rim'), "the 'gold' z - rim");
  const p = newPlate();
  p.header = ['Topaz: a "bed" of gold', "wrap: none"];
  p.rows = p.rows.map((r, i) => (i === 2 ? "ggggggggggggggg" : r));
  const src = formatPlate("ba_test_plate", p);
  const firstZ = src.indexOf("z:");
  assert.ok(src.slice(firstZ).startsWith("z: 0.06"), "the first z: is the field");
  assert.equal(src.indexOf("wrap:"), -1);
  const quoted = [...src.matchAll(/"([^"]*)"/g)].map((m) => m[1]!).filter((s) => /^[.grckbmdlhsei]+$/.test(s));
  assert.equal(quoted.length, p.rows.length, "only the rows look like rows");
});

test("checks flag what the engine would refuse", () => {
  const g = newGear("Chest");
  g.material = "cloth";
  g.attach = "spine";
  g.shapes.push({ kind: "Disc", from: [0, 0, 0], to: [0, 0, 0], center: [0, 0, 0], at: "l_wing", r: 0.05, ramp: "Material", thick: 1, note: [], gap: false });
  const plate = newPlate();
  const bad = checkDoc({ gear: { ...g, id: "bell" }, plate });
  const text = bad.map((c) => `${c.level} ${c.text}`).join("\n");
  assert.match(text, /error material cloth/);
  assert.match(text, /error attach spine/);
  assert.match(text, /error shape 1: joint l_wing/);
  assert.match(text, /error the id is made only of plate letters/);
  const good = newGear("MainHand");
  good.shapes.push({ kind: "Capsule", from: [0, -0.1, 0], to: [0, 0.6, 0], center: [0, 0, 0], r: 0, ramp: "Material", thick: 1.6, note: ["Shaft."], gap: false });
  assert.ok(checkDoc({ gear: good, plate: null }).every((c) => c.level === "ok"));
  const parsed = parseGear(formatGear(good));
  assert.equal(parsed.attach, "r_hand");
  assert.equal(parsed.stance, "1h");
});
