/** Gear `.ron` ids under `engine/ba-stick-render/assets/gear/` (in-world stick figure art). */
export const GEAR_RON_IDS = new Set([
  "ba_black_anvil",
  "ba_bone_harness",
  "ba_bone_helm",
  "ba_bronze_helm",
  "ba_cloth_hat",
  "ba_silk_hat",
  "ba_velvet_hat",
  "ba_cook_pot",
  "ba_craft_hammer",
  "ba_darksteel_helm",
  "ba_goldsmith_stake",
  "ba_headband",
  "ba_leather_bandana",
  "ba_linen_helm",
  "ba_fine_jerkin_helm",
  "ba_shade_leather_bandana",
  "ba_skull_bandana",
  "ba_bell_torque_band",
  "ba_circlet",
  "ba_mythril_torque",
  "ba_iron_cuirass",
  "ba_iron_cuisses",
  "ba_iron_helm",
  "ba_iron_pickaxe",
  "ba_iron_shield",
  "ba_iron_shovel",
  "ba_iron_sword",
  "ba_decayed_sword",
  "ba_iron_dagger",
  "ba_bone_dagger",
  "ba_neolithic_dagger",
  "ba_fang_dagger",
  "ba_iron_greatsword",
  "ba_steel_greatsword",
  "ba_mythril_greatsword",
  "ba_mythril_helm",
  "ba_bronze_sword",
  "ba_bronze_axe",
  "ba_decayed_axe",
  "ba_iron_great_axe",
  "ba_darksteel_great_axe",
  "ba_palace_great_axe",
  "ba_palace_helm",
  "ba_darksteel_blade",
  "ba_mythril_sword",
  "ba_orichalcum_sword",
  "ba_kite_shield",
  "ba_leather_vest",
  "ba_leather_workpiece",
  "ba_scale_mail_helm",
  "ba_shade_helm",
  "ba_wizard_robe",
  "ba_wood_spoon",
]);

export function gearRonForSlug(slug: string): string | null {
  const id = "ba_" + slug.replace(/-/g, "_");
  return GEAR_RON_IDS.has(id) ? id : null;
}

/** Deep-link gear viewer (query + hash so embed and new tab both honor the id). */
export function gearViewerUrl(gearId: string): string {
  const q = encodeURIComponent(gearId);
  return `./gear-viewer.html?gear=${q}#${q}`;
}
