import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGear } from "./gear-ron.ts";
import { applyViewerMeshAlias } from "./gear-viewer-mesh.ts";

const gearDir = new URL("../../../engine/", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, gearDir), "utf8");
}

test("decayed axe viewer mesh is bronze axe capsules", () => {
  const decayed = parseGear(read("ba-stick-render/assets/gear/ba_decayed_axe.ron"));
  const bronze = parseGear(read("ba-stick-render/assets/gear/ba_bronze_axe.ron"));
  const view = applyViewerMeshAlias(decayed, (id) => (id === "ba_bronze_axe" ? bronze : undefined));
  assert.equal(view.id, "ba_decayed_axe");
  assert.equal(view.shapes.length, bronze.shapes.length);
});

test("decayed sword viewer mesh is iron sword capsules", () => {
  const decayed = parseGear(read("ba-stick-render/assets/gear/ba_decayed_sword.ron"));
  const iron = parseGear(read("ba-stick-render/assets/gear/ba_iron_sword.ron"));
  const greatAxe = parseGear(read("ba-stick-render/assets/gear/ba_iron_great_axe.ron"));
  const view = applyViewerMeshAlias(decayed, (id) => (id === "ba_iron_sword" ? iron : undefined));
  assert.equal(view.id, "ba_decayed_sword");
  assert.equal(view.shapes.length, iron.shapes.length);
  assert.notEqual(view.shapes.length, greatAxe.shapes.length);
  assert.equal(view.stance, "1h");
});
