import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGear } from "./gear-ron.ts";
import { gearRonForSlug, GEAR_RON_IDS } from "./wiki-gear.ts";
import { swordLayoutForGearId } from "./pixel-sword.ts";

const gearDir = join(import.meta.dirname, "../../../engine/ba-stick-render/assets/gear");

test("catalog dagger slugs map to ba_* gear ids", () => {
  for (const slug of ["iron-dagger", "bone-dagger", "neolithic-dagger", "fang-dagger", "orichalcum-dagger", "bronze-axe", "iron-helm"]) {
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
    ["orichalcum-war-helm", "ba_orichalcum_war_helm"],
    ["rogues-helm", "ba_rogues_helm"],
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
  assert.equal(gearRonForSlug("iron-leggings"), "ba_iron_leggings");
  assert.equal(gearRonForSlug("leather-trousers"), "ba_leather_trousers");
  assert.equal(gearRonForSlug("ashbeam-staff"), "ba_ashbeam_staff");
  assert.equal(gearRonForSlug("ashbeam-club"), "ba_ashbeam_club");
  assert.equal(gearRonForSlug("bronze-mittens"), "ba_bronze_mittens");
  assert.equal(gearRonForSlug("leather-sandals"), "ba_leather_sandals");
  assert.equal(gearRonForSlug("bronze-sabatons"), "ba_bronze_sabatons");
  assert.equal(gearRonForSlug("iron-sabatons"), "ba_iron_sabatons");
  assert.equal(gearRonForSlug("decayed-greaves"), "ba_decayed_greaves");
  assert.equal(gearRonForSlug("battleweave-coat"), "ba_battleweave_coat");
  assert.equal(gearRonForSlug("altarweave-coat"), "ba_altarweave_coat");
  assert.equal(gearRonForSlug("iron-shield"), "ba_iron_shield");
  assert.equal(gearRonForSlug("bloodbeam-crozier"), "ba_bloodbeam_crozier");
  assert.equal(gearRonForSlug("ashbeam-tome"), "ba_ashbeam_tome");
  assert.equal(gearRonForSlug("bellwood-crozier"), "ba_bellwood_crozier");
  assert.equal(gearRonForSlug("battleweave-cuffs"), "ba_battleweave_cuffs");
  assert.equal(gearRonForSlug("darksteel-targe"), "ba_darksteel_targe");
  assert.equal(gearRonForSlug("palace-shield"), "ba_palace_shield");
  assert.equal(gearRonForSlug("battleweave-slacks"), "ba_battleweave_slacks");
  assert.equal(gearRonForSlug("battleweave-pumps"), "ba_battleweave_pumps");
  assert.equal(gearRonForSlug("altarweave-cuffs"), "ba_altarweave_cuffs");
  assert.equal(gearRonForSlug("altarweave-slacks"), "ba_altarweave_slacks");
  assert.equal(gearRonForSlug("altarweave-pumps"), "ba_altarweave_pumps");
  assert.equal(gearRonForSlug("battleweave-raiment"), "ba_battleweave_raiment");
  assert.equal(gearRonForSlug("orichalcum-targe"), "ba_orichalcum_targe");
  assert.equal(gearRonForSlug("throneweave-hat"), "ba_throneweave_hat");
  assert.equal(gearRonForSlug("steel-sword"), "ba_steel_sword");
  assert.equal(gearRonForSlug("steel-mail"), "ba_steel_mail");
  assert.equal(gearRonForSlug("orichalcum-mail"), "ba_orichalcum_mail");
  assert.equal(gearRonForSlug("rogues-dagger"), "ba_rogues_dagger");
  assert.equal(gearRonForSlug("altarweave-hat"), "ba_altarweave_hat");
  assert.equal(gearRonForSlug("battleweave-hat"), "ba_battleweave_hat");
  assert.equal(gearRonForSlug("battleweave-hood"), "ba_battleweave_hood");
  assert.equal(gearRonForSlug("battleweave-gloves"), "ba_battleweave_gloves");
  assert.equal(gearRonForSlug("rogues-trousers"), "ba_rogues_trousers");
  assert.equal(gearRonForSlug("battleweave-hose"), "ba_battleweave_hose");
  assert.equal(gearRonForSlug("battleweave-slippers"), "ba_battleweave_slippers");
  assert.equal(gearRonForSlug("orichalcum-war-cuisses"), "ba_orichalcum_war_cuisses");
  assert.equal(gearRonForSlug("throneweave-cuffs"), "ba_throneweave_cuffs");
  assert.equal(gearRonForSlug("throneweave-slacks"), "ba_throneweave_slacks");
  assert.equal(gearRonForSlug("throneweave-pumps"), "ba_throneweave_pumps");
  assert.equal(gearRonForSlug("steel-helm"), "ba_steel_helm");
  assert.equal(gearRonForSlug("steel-mittens"), "ba_steel_mittens");
  assert.equal(gearRonForSlug("steel-shield"), "ba_steel_shield");
  assert.equal(gearRonForSlug("steel-subligar"), "ba_steel_subligar");
  assert.equal(gearRonForSlug("steel-sabatons"), "ba_steel_sabatons");
  assert.equal(gearRonForSlug("mythril-mail"), "ba_mythril_mail");
  assert.equal(gearRonForSlug("darksteel-greatsword"), "ba_darksteel_greatsword");
  assert.equal(gearRonForSlug("orichalcum-greatsword"), "ba_orichalcum_greatsword");
  assert.equal(gearRonForSlug("bronze-greatsword"), "ba_bronze_greatsword");
  assert.equal(gearRonForSlug("iron-axe"), "ba_iron_axe");
  assert.equal(gearRonForSlug("steel-great-axe"), "ba_steel_great_axe");
  assert.equal(gearRonForSlug("mythril-targe"), "ba_mythril_targe");
  assert.equal(gearRonForSlug("mythril-great-axe"), "ba_mythril_great_axe");
  assert.equal(gearRonForSlug("mythril-dagger"), "ba_mythril_dagger");
  assert.equal(gearRonForSlug("darksteel-dagger"), "ba_darksteel_dagger");
  assert.equal(gearRonForSlug("palace-sword"), "ba_palace_sword");
  assert.equal(gearRonForSlug("bronze-dagger"), "ba_bronze_dagger");
  assert.equal(gearRonForSlug("bronze-great-axe"), "ba_bronze_great_axe");
  assert.equal(gearRonForSlug("steel-dagger"), "ba_steel_dagger");
  assert.equal(gearRonForSlug("steel-axe"), "ba_steel_axe");
  assert.equal(gearRonForSlug("mythril-axe"), "ba_mythril_axe");
  assert.equal(gearRonForSlug("darksteel-axe"), "ba_darksteel_axe");
  assert.equal(gearRonForSlug("bone-gloves"), "ba_bone_gloves");
  assert.equal(gearRonForSlug("bone-boots"), "ba_bone_boots");
  assert.equal(gearRonForSlug("orichalcum-axe"), "ba_orichalcum_axe");
  assert.equal(gearRonForSlug("orichalcum-great-axe"), "ba_orichalcum_great_axe");
  assert.equal(gearRonForSlug("orichalcum-shield"), "ba_orichalcum_shield");
  assert.equal(gearRonForSlug("palace-greatsword"), "ba_palace_greatsword");
  assert.equal(gearRonForSlug("palace-targe"), "ba_palace_targe");
  assert.equal(gearRonForSlug("orichalcum-war-helm"), "ba_orichalcum_war_helm");
  assert.equal(gearRonForSlug("orichalcum-war-gauntlets"), "ba_orichalcum_war_gauntlets");
  assert.equal(gearRonForSlug("orichalcum-war-sabatons"), "ba_orichalcum_war_sabatons");
  assert.equal(gearRonForSlug("rogues-helm"), "ba_rogues_helm");
  assert.equal(gearRonForSlug("rogues-gloves"), "ba_rogues_gloves");
  assert.equal(gearRonForSlug("rogues-boots"), "ba_rogues_boots");
  assert.equal(gearRonForSlug("orichalcum-dagger"), "ba_orichalcum_dagger");
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
