import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGear } from "./gear-ron.ts";
import { gearRonForSlug, GEAR_RON_IDS } from "./wiki-gear.ts";
import { swordLayoutForGearId } from "./pixel-sword.ts";

const gearDir = join(import.meta.dirname, "../../../engine/ba-stick-render/assets/gear");

test("catalog dagger slugs map to ba_* gear ids", () => {
  for (const slug of ["iron-dagger", "bone-dagger", "neolithic-dagger", "fang-dagger", "bronze-axe", "iron-helm"]) {
    const id = gearRonForSlug(slug);
    assert.ok(id, slug);
    assert.ok(GEAR_RON_IDS.has(id!));
  }
});

test("tier helms map to their own ba_*_helm gear files", () => {
  for (const [slug, id] of [
    ["bronze-helm", "ba_bronze_helm"],
    ["iron-helm", "ba_iron_helm"],
    ["bone-helm", "ba_bone_helm"],
    ["mythril-helm", "ba_mythril_helm"],
    ["darksteel-helm", "ba_darksteel_helm"],
    ["palace-helm", "ba_palace_helm"],
    ["scale-mail-helm", "ba_scale_mail_helm"],
    ["shade-helm", "ba_shade_helm"],
  ] as const) {
    assert.equal(gearRonForSlug(slug), id, slug);
  }
  assert.equal(gearRonForSlug("linen-helm"), "ba_linen_helm");
  assert.equal(gearRonForSlug("bell-torque-band"), "ba_bell_torque_band");
  assert.equal(gearRonForSlug("mythril-torque"), "ba_mythril_torque");
  assert.equal(gearRonForSlug("circlet"), "ba_circlet");
  assert.equal(gearRonForSlug("leather-bandana"), "ba_leather_bandana");
  assert.equal(gearRonForSlug("shade-leather-bandana"), "ba_shade_leather_bandana");
  assert.equal(gearRonForSlug("fine-jerkin-helm"), "ba_fine_jerkin_helm");
  assert.equal(gearRonForSlug("skull-bandana"), "ba_skull_bandana");
  assert.equal(gearRonForSlug("silk-hat"), "ba_silk_hat");
  assert.equal(gearRonForSlug("velvet-hat"), "ba_velvet_hat");
  assert.equal(gearRonForSlug("decayed-sword"), "ba_decayed_sword");
  assert.equal(gearRonForSlug("decayed-axe"), "ba_decayed_axe");
});

test("bundled gear files exist for wiki dagger previews", () => {
  for (const slug of ["bone-dagger", "neolithic-dagger", "fang-dagger"]) {
    const id = gearRonForSlug(slug)!;
    const path = join(gearDir, `${id}.ron`);
    const g = parseGear(readFileSync(path, "utf8"));
    assert.equal(g.id, id);
    const lay = swordLayoutForGearId(id);
    assert.equal(lay.crossguard, false, `${id} uses dagger layout in viewer`);
  }
});

test("index lookup by parsed gear id finds dagger files", () => {
  const files = readdirSync(gearDir).filter((f) => f.endsWith(".ron") && !f.endsWith(".plate.ron"));
  const items = files.map((name) => ({ name, src: readFileSync(join(gearDir, name), "utf8") }));
  function indexFor(want: string): number {
    for (let i = 0; i < items.length; i++) {
      if (parseGear(items[i]!.src).id === want) return i;
    }
    return -1;
  }
  for (const id of ["ba_bone_dagger", "ba_neolithic_dagger", "ba_fang_dagger"]) {
    assert.ok(indexFor(id) >= 0, id);
  }
});
