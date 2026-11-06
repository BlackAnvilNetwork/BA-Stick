// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Gear visuals (#14): equipped items change the stick figure. Purely
//! cosmetic. Each item's look is derived from its family/material and a
//! per-item seed (the catalog id), so the same item always looks the same
//! and different items of one family differ (blade length, guard, crest,
//! trim colour).
use crate::compat::*;
use crate::palette::{GEAR_BONE, GEAR_LEATHER, GEAR_LEATHER_FAR};
use crate::preset::Weapon;

/// Item material (from craft skill / name).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Mat {
    #[default]
    None,
    Cloth,
    Leather,
    Metal,
    Wood,
    Bone,
    Gold,
}

impl Mat {
    pub fn from_u8(n: u8) -> Mat {
        match n {
            1 => Mat::Cloth,
            2 => Mat::Leather,
            3 => Mat::Metal,
            4 => Mat::Wood,
            5 => Mat::Bone,
            6 => Mat::Gold,
            _ => Mat::None,
        }
    }
    /// (near, far) palette indices.
    pub fn colors(self, seed: u32) -> (u8, u8) {
        match self {
            Mat::None => (C_BODY, C_BODY_FAR),
            // dyed cloth: seed picks the dye
            Mat::Cloth => [
                (C_BODY, C_BODY_FAR),
                (C_ACCENT, 13),
                (C_DASH, 13),
                (C_DUST, 13),
            ][(seed % 4) as usize],
            Mat::Leather => (GEAR_LEATHER, GEAR_LEATHER_FAR),
            Mat::Metal => (C_STEEL, 13),
            Mat::Wood => (C_HILT, GEAR_LEATHER_FAR),
            Mat::Bone => (GEAR_BONE, C_DUST),
            Mat::Gold => (C_GOLD, C_HILT),
        }
    }
}

/// Seed-derived weapon variation.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WeaponLook {
    pub kind: Weapon,
    /// Catalog item id (stable look seed).
    pub seed: u32,
    /// Length multiplier (0.85..1.15).
    pub len: f32,
    pub guard: u8,
    pub grip: u8,
    pub blade: u8,
    pub gem: u8,
}

/// `packages/items` catalog ids for pixel-art swords.
pub const IRON_DAGGER_ITEM: u32 = 6;
pub const IRON_GREATSWORD_ITEM: u32 = 8;
pub const NEOLITHIC_DAGGER_ITEM: u32 = 86;
pub const FANG_DAGGER_ITEM: u32 = 87;
pub const BONE_DAGGER_ITEM: u32 = 317;
pub const STEEL_GREATSWORD_ITEM: u32 = 122;
pub const MYTHRIL_GREATSWORD_ITEM: u32 = 134;
pub const BRONZE_SWORD_ITEM: u32 = 102;
pub const BRONZE_AXE_ITEM: u32 = 103;
pub const MYTHRIL_SWORD_ITEM: u32 = 126;
pub const DARKSTEEL_BLADE_ITEM: u32 = 137;
pub const IRON_GREAT_AXE_ITEM: u32 = 113;
pub const DARKSTEEL_GREAT_AXE_ITEM: u32 = 138;
pub const PALACE_GREAT_AXE_ITEM: u32 = 158;
pub const ORICHALCUM_SWORD_ITEM: u32 = 151;
pub const BRONZE_HELM_ITEM: u32 = 104;
pub const IRON_HELM_ITEM: u32 = 114;
pub const MYTHRIL_HELM_ITEM: u32 = 127;
pub const DARKSTEEL_HELM_ITEM: u32 = 139;
pub const PALACE_HELM_ITEM: u32 = 153;
pub const SCALE_MAIL_HELM_ITEM: u32 = 245;
pub const SHADE_HELM_ITEM: u32 = 276;
pub const BONE_HELM_ITEM: u32 = 328;
/// Forehead ring stack (`ba_*` torque / headband / circlet), not the pointed cloth hat.
pub const LINEN_HELM_ITEM: u32 = 264;
pub const BELL_TORQUE_BAND_ITEM: u32 = 301;
pub const MYTHRIL_TORQUE_ITEM: u32 = 315;
pub const CIRCLET_ITEM: u32 = 354;
pub const LEATHER_BANDANA_ITEM: u32 = 211;
pub const SHADE_LEATHER_BANDANA_ITEM: u32 = 221;
pub const FINE_JERKIN_HELM_ITEM: u32 = 234;
pub const SKULL_BANDANA_ITEM: u32 = 337;
pub const DECAYED_SWORD_ITEM: u32 = 1064;
pub const DECAYED_AXE_ITEM: u32 = 1065;
pub const BRONZE_SABATONS_ITEM: u32 = 1068;
pub const IRON_SABATONS_ITEM: u32 = 1069;
pub const DECAYED_GREAVES_ITEM: u32 = 1070;
pub const BATTLEWEAVE_COAT_ITEM: u32 = 1071;
pub const ALTARWEAVE_COAT_ITEM: u32 = 1072;
pub const IRON_SHIELD_ITEM: u32 = 1073;
pub const BLOODBEAM_CROZIER_ITEM: u32 = 1074;
pub const ASHBEAM_TOME_ITEM: u32 = 1075;
pub const BELLWOOD_CROZIER_ITEM: u32 = 1076;
pub const BATTLEWEAVE_CUFFS_ITEM: u32 = 1077;
pub const DARKSTEEL_TARGE_ITEM: u32 = 1078;
pub const PALACE_SHIELD_ITEM: u32 = 1079;
pub const BATTLEWEAVE_SLACKS_ITEM: u32 = 1080;
pub const BATTLEWEAVE_PUMPS_ITEM: u32 = 1081;
pub const ALTARWEAVE_CUFFS_ITEM: u32 = 1082;
pub const ALTARWEAVE_SLACKS_ITEM: u32 = 1083;
pub const ALTARWEAVE_PUMPS_ITEM: u32 = 1084;
pub const BATTLEWEAVE_RAIMENT_ITEM: u32 = 1085;
pub const ORICHALCUM_TARGE_ITEM: u32 = 1086;
pub const THRONEWEAVE_HAT_ITEM: u32 = 1087;
pub const STEEL_SWORD_ITEM: u32 = 1088;
pub const STEEL_MAIL_ITEM: u32 = 1089;
pub const ORICHALCUM_MAIL_ITEM: u32 = 1090;
pub const ROGUES_DAGGER_ITEM: u32 = 1091;
pub const ALTARWEAVE_HAT_ITEM: u32 = 1092;
pub const ORICHALCUM_WAR_HELM_ITEM: u32 = 1093;
pub const ORICHALCUM_WAR_GAUNTLETS_ITEM: u32 = 1094;
pub const ORICHALCUM_WAR_SABATONS_ITEM: u32 = 1095;
pub const ROGUES_HELM_ITEM: u32 = 1096;
pub const ROGUES_GLOVES_ITEM: u32 = 1097;
pub const ROGUES_BOOTS_ITEM: u32 = 1098;
pub const ORICHALCUM_DAGGER_ITEM: u32 = 1099;
pub const BATTLEWEAVE_HAT_ITEM: u32 = 1100;
pub const BATTLEWEAVE_HOOD_ITEM: u32 = 1101;
pub const BATTLEWEAVE_GLOVES_ITEM: u32 = 1102;
pub const ROGUES_TROUSERS_ITEM: u32 = 1103;
pub const BATTLEWEAVE_HOSE_ITEM: u32 = 1104;
pub const BATTLEWEAVE_SLIPPERS_ITEM: u32 = 1105;
pub const ORICHALCUM_WAR_CUISSES_ITEM: u32 = 1106;
pub const THRONEWEAVE_CUFFS_ITEM: u32 = 1107;
pub const THRONEWEAVE_SLACKS_ITEM: u32 = 1108;
pub const THRONEWEAVE_PUMPS_ITEM: u32 = 1109;
pub const STEEL_HELM_ITEM: u32 = 1110;
pub const STEEL_MITTENS_ITEM: u32 = 1111;
pub const STEEL_SHIELD_ITEM: u32 = 1112;
pub const STEEL_SUBLIGAR_ITEM: u32 = 1113;
pub const STEEL_SABATONS_ITEM: u32 = 1114;
pub const MYTHRIL_MAIL_ITEM: u32 = 1115;
pub const DARKSTEEL_GREATSWORD_ITEM: u32 = 1116;
pub const ORICHALCUM_GREATSWORD_ITEM: u32 = 1117;
pub const BRONZE_GREATSWORD_ITEM: u32 = 1118;
pub const IRON_AXE_ITEM: u32 = 1119;
pub const STEEL_GREAT_AXE_ITEM: u32 = 1120;
pub const MYTHRIL_TARGE_ITEM: u32 = 1121;
pub const MYTHRIL_GREAT_AXE_ITEM: u32 = 1122;
pub const MYTHRIL_DAGGER_ITEM: u32 = 1123;
pub const DARKSTEEL_DAGGER_ITEM: u32 = 1124;
pub const PALACE_SWORD_ITEM: u32 = 1125;
pub const BRONZE_DAGGER_ITEM: u32 = 1126;
pub const BRONZE_GREAT_AXE_ITEM: u32 = 1127;
pub const STEEL_DAGGER_ITEM: u32 = 1128;
pub const STEEL_AXE_ITEM: u32 = 1129;
pub const MYTHRIL_AXE_ITEM: u32 = 1130;
pub const DARKSTEEL_AXE_ITEM: u32 = 1131;
pub const BONE_GLOVES_ITEM: u32 = 1132;
pub const BONE_BOOTS_ITEM: u32 = 1133;
pub const ORICHALCUM_AXE_ITEM: u32 = 1134;
pub const ORICHALCUM_GREAT_AXE_ITEM: u32 = 1135;
pub const ORICHALCUM_SHIELD_ITEM: u32 = 1136;
pub const PALACE_GREATSWORD_ITEM: u32 = 1137;
pub const PALACE_TARGE_ITEM: u32 = 1138;
pub const SILK_HAT_ITEM: u32 = 284;
pub const VELVET_HAT_ITEM: u32 = 296;

/// Brow wrap, crown drape, knot, and tails (`ba_leather_bandana` mesh).
const BANDANA_MESH_ITEMS: &[u32] = &[
    LEATHER_BANDANA_ITEM,
    SHADE_LEATHER_BANDANA_ITEM,
    FINE_JERKIN_HELM_ITEM,
    LINEN_HELM_ITEM,
    SKULL_BANDANA_ITEM,
];

pub fn uses_bandana_mesh(item_id: u32) -> bool {
    BANDANA_MESH_ITEMS.contains(&item_id)
}

const HEADBAND_MESH_ITEMS: &[u32] = &[
    LINEN_HELM_ITEM,
    LEATHER_BANDANA_ITEM,
    SHADE_LEATHER_BANDANA_ITEM,
    FINE_JERKIN_HELM_ITEM,
    SKULL_BANDANA_ITEM,
    BELL_TORQUE_BAND_ITEM,
    MYTHRIL_TORQUE_ITEM,
    CIRCLET_ITEM,
];

pub fn uses_headband_mesh(item_id: u32) -> bool {
    HEADBAND_MESH_ITEMS.contains(&item_id)
}

const HOOD_MESH_ITEMS: &[u32] = &[BATTLEWEAVE_HOOD_ITEM];

pub fn uses_hood_mesh(item_id: u32) -> bool {
    HOOD_MESH_ITEMS.contains(&item_id)
}

const IRON_HELM_MESH_ITEMS: &[u32] = &[
    BRONZE_HELM_ITEM,
    IRON_HELM_ITEM,
    MYTHRIL_HELM_ITEM,
    DARKSTEEL_HELM_ITEM,
    PALACE_HELM_ITEM,
    SCALE_MAIL_HELM_ITEM,
    ORICHALCUM_WAR_HELM_ITEM,
    STEEL_HELM_ITEM,
    ROGUES_HELM_ITEM,
    SHADE_HELM_ITEM,
    BONE_HELM_ITEM,
];

pub fn uses_iron_helm_mesh(item_id: u32) -> bool {
    IRON_HELM_MESH_ITEMS.contains(&item_id)
}

const CATALOG_FEET_MESH_ITEMS: &[u32] = &[
    BRONZE_SABATONS_ITEM,
    IRON_SABATONS_ITEM,
    DECAYED_GREAVES_ITEM,
    BATTLEWEAVE_PUMPS_ITEM,
    ALTARWEAVE_PUMPS_ITEM,
    ORICHALCUM_WAR_SABATONS_ITEM,
    ROGUES_BOOTS_ITEM,
    BATTLEWEAVE_SLIPPERS_ITEM,
    THRONEWEAVE_PUMPS_ITEM,
    STEEL_SABATONS_ITEM,
    BONE_BOOTS_ITEM,
];

pub fn uses_catalog_feet_mesh(item_id: u32) -> bool {
    CATALOG_FEET_MESH_ITEMS.contains(&item_id)
}

const CATALOG_COAT_MESH_ITEMS: &[u32] = &[
    BATTLEWEAVE_COAT_ITEM,
    ALTARWEAVE_COAT_ITEM,
    BATTLEWEAVE_RAIMENT_ITEM,
];

pub fn uses_catalog_coat_mesh(item_id: u32) -> bool {
    CATALOG_COAT_MESH_ITEMS.contains(&item_id)
}

const CATALOG_PLATE_MESH_ITEMS: &[u32] = &[STEEL_MAIL_ITEM, MYTHRIL_MAIL_ITEM];

const CATALOG_HAUBERK_MESH_ITEMS: &[u32] = &[ORICHALCUM_MAIL_ITEM];

pub fn uses_catalog_hauberk_mesh(item_id: u32) -> bool {
    CATALOG_HAUBERK_MESH_ITEMS.contains(&item_id)
}

pub fn uses_catalog_plate_mesh(item_id: u32) -> bool {
    CATALOG_PLATE_MESH_ITEMS.contains(&item_id)
}

const ROUND_SHIELD_ITEMS: &[u32] = &[
    IRON_SHIELD_ITEM,
    STEEL_SHIELD_ITEM,
    DARKSTEEL_TARGE_ITEM,
    ORICHALCUM_TARGE_ITEM,
    MYTHRIL_TARGE_ITEM,
    ORICHALCUM_SHIELD_ITEM,
    PALACE_TARGE_ITEM,
];

pub fn uses_round_shield_mesh(item_id: u32) -> bool {
    ROUND_SHIELD_ITEMS.contains(&item_id)
}

const KITE_SHIELD_ITEMS: &[u32] = &[PALACE_SHIELD_ITEM];

pub fn uses_kite_shield_mesh(item_id: u32) -> bool {
    KITE_SHIELD_ITEMS.contains(&item_id)
}

const CATALOG_HANDS_MESH_ITEMS: &[u32] = &[
    BATTLEWEAVE_CUFFS_ITEM,
    ALTARWEAVE_CUFFS_ITEM,
    ORICHALCUM_WAR_GAUNTLETS_ITEM,
    ROGUES_GLOVES_ITEM,
    BATTLEWEAVE_GLOVES_ITEM,
    THRONEWEAVE_CUFFS_ITEM,
    STEEL_MITTENS_ITEM,
    BONE_GLOVES_ITEM,
];

const CATALOG_LEGS_MESH_ITEMS: &[u32] = &[
    BATTLEWEAVE_SLACKS_ITEM,
    ALTARWEAVE_SLACKS_ITEM,
    ROGUES_TROUSERS_ITEM,
    BATTLEWEAVE_HOSE_ITEM,
    ORICHALCUM_WAR_CUISSES_ITEM,
    THRONEWEAVE_SLACKS_ITEM,
    STEEL_SUBLIGAR_ITEM,
];

pub fn uses_catalog_legs_mesh(item_id: u32) -> bool {
    CATALOG_LEGS_MESH_ITEMS.contains(&item_id)
}

pub fn uses_catalog_hands_mesh(item_id: u32) -> bool {
    CATALOG_HANDS_MESH_ITEMS.contains(&item_id)
}

const CATALOG_STAFF_RON_ITEMS: &[u32] = &[
    BLOODBEAM_CROZIER_ITEM,
    ASHBEAM_TOME_ITEM,
    BELLWOOD_CROZIER_ITEM,
];

pub fn uses_catalog_staff_ron(item_id: u32) -> bool {
    CATALOG_STAFF_RON_ITEMS.contains(&item_id)
}

/// Apply off-hand and hands catalog ids after `garb()` (setGear 12th / 13th seeds).
pub fn apply_offhand(g: &mut Garb, sseed: u32) {
    g.shield = uses_round_shield_mesh(sseed);
    g.kite = uses_kite_shield_mesh(sseed);
    g.shield_item = sseed;
}

pub fn apply_hands(g: &mut Garb, hndseed: u32) {
    g.hands_item = if uses_catalog_hands_mesh(hndseed) { hndseed } else { 0 };
}

pub fn hash(seed: u32) -> u32 {
    let mut x = seed.wrapping_mul(0x9e37_79b9) ^ 0x5bd1_e995;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2c1b_3c6d);
    x ^ (x >> 12)
}

impl WeaponLook {
    pub fn new(kind: Weapon, mat: Mat, seed: u32) -> WeaponLook {
        let h = hash(seed);
        let len = 0.85 + (h % 31) as f32 / 100.0;
        let guard = [C_GOLD, C_STEEL, C_HILT][((h >> 5) % 3) as usize];
        let gem = [C_ACCENT, C_DASH, C_GOLD, 9][((h >> 9) % 4) as usize];
        let blade = match mat {
            Mat::Bone => GEAR_BONE,
            Mat::Gold => C_GOLD,
            Mat::Wood => C_HILT,
            _ => C_STEEL,
        };
        let grip = if mat == Mat::Leather {
            GEAR_LEATHER
        } else {
            C_HILT
        };
        WeaponLook {
            kind,
            seed,
            len,
            guard,
            grip,
            blade,
            gem,
        }
    }
    pub fn plain(kind: Weapon) -> WeaponLook {
        WeaponLook {
            kind,
            seed: 0,
            len: 1.0,
            guard: C_GOLD,
            grip: C_HILT,
            blade: C_STEEL,
            gem: C_ACCENT,
        }
    }
}

/// Head gear style.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HeadStyle {
    Helm,
    Hood,
    Circlet,
    Cap,
}

/// Everything equipment changes on a figure. `None` parts keep the preset.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Garb {
    pub weapon: Option<WeaponLook>,
    pub torso: Option<(u8, u8)>,
    /// Extra torso/arm thickness (px) for heavy armour.
    pub bulk: f32,
    pub legs: Option<(u8, u8)>,
    pub head: Option<(HeadStyle, u8, u8)>,
    /// Steel breastplate (`ba_iron_cuirass`) on metal chest pieces.
    pub plate: bool,
    /// Catalog id for a name-skinned mail plate (`ba_steel_mail`), or 0.
    pub plate_item: u32,
    /// Long cloth robe (`ba_wizard_robe`) on cloth chest pieces.
    pub robe: bool,
    /// Leather vest (`ba_leather_vest`) on leather chest pieces.
    pub vest: bool,
    /// Bone harness (`ba_bone_harness`) on bone chest pieces.
    pub harness: bool,
    /// Catalog item id for a tier helm (`ba_*_helm` plate), or 0.
    pub helm_item: u32,
    /// Cloth hat mesh (`ba_cloth_hat` stack) on cloth head pieces, or None.
    pub hat_item: Option<u32>,
    /// Catalog id for a forehead ring (`ba_headband`, torque, circlet), or 0.
    pub headband_item: u32,
    /// Catalog id for a cloth cowl (`HeadStyle::Hood`), or 0.
    pub hood_item: u32,
    /// Iron shield (`ba_iron_shield`) on the off hand. A faced plane, not a billboard.
    pub shield: bool,
    /// Catalog id for the off-hand face plate, or 0.
    pub shield_item: u32,
    /// Kite shield (`ba_kite_shield`) on the off hand. A pointed steel face with a gold rim and cross.
    pub kite: bool,
    /// Iron cuisses (`ba_iron_cuisses`) on metal leg pieces. A plate over each hip and thigh.
    pub cuisses: bool,
    /// Leather trousers (`ba_leather_trousers`) on leather leg pieces. Same thigh shell, leather paint.
    pub leather_trousers: bool,
    /// Catalog id for instanced foot plates (`ba_*_sabatons` / greaves), or 0.
    pub feet_item: u32,
    /// Catalog id for a name-skinned coat (`ba_battleweave_coat` / `ba_altarweave_coat`), or 0.
    pub coat_item: u32,
    /// Catalog id for instanced wrist cuffs (`ba_*_cuffs`), or 0.
    pub hands_item: u32,
    /// Catalog id for cloth slacks (`ba_battleweave_slacks`), or 0.
    pub legs_item: u32,
    /// Catalog id for a wrap hauberk (`ba_orichalcum_mail`), or 0.
    pub hauberk_item: u32,
}

/// Build a garb from wasm args. `family` 0 = keep preset weapon,
/// 1 sword, 2 greatsword, 3 dagger, 4 axe, 5 staff, 6 club, 7 knuckles.
#[allow(clippy::too_many_arguments)]
pub fn garb(
    family: u8,
    wmat: u8,
    wseed: u32,
    body: u8,
    bseed: u32,
    head: u8,
    hseed: u32,
    legs: u8,
    lseed: u32,
    feet: u8,
    fseed: u32,
) -> Garb {
    let kind = match family {
        1 => Some(Weapon::Sword),
        2 => Some(Weapon::Greatsword),
        3 => Some(Weapon::Dagger),
        4 => Some(Weapon::Axe),
        5 => Some(Weapon::Staff),
        6 => Some(Weapon::Club),
        7 => Some(Weapon::Knuckles),
        _ => None,
    };
    let bm = Mat::from_u8(body);
    let hm = Mat::from_u8(head);
    let lm = Mat::from_u8(legs);
    Garb {
        weapon: kind.map(|k| WeaponLook::new(k, Mat::from_u8(wmat), wseed)),
        torso: (bm != Mat::None).then(|| bm.colors(bseed)),
        bulk: match bm {
            Mat::Metal => 0.8,
            Mat::Leather | Mat::Bone => 0.4,
            _ => 0.0,
        },
        legs: (lm != Mat::None).then(|| lm.colors(lseed)),
        head: (hm != Mat::None).then(|| {
            let style = match hm {
                Mat::Metal => HeadStyle::Helm,
                Mat::Cloth => HeadStyle::Hood,
                Mat::Gold => HeadStyle::Circlet,
                _ => HeadStyle::Cap,
            };
            let (c, _) = hm.colors(hseed);
            let crest = [C_ACCENT, C_GOLD, C_DASH, C_STEEL][(hash(hseed) % 4) as usize];
            (style, c, crest)
        }),
        plate: bm == Mat::Metal && !uses_catalog_hauberk_mesh(bseed),
        plate_item: if uses_catalog_plate_mesh(bseed) { bseed } else { 0 },
        hauberk_item: if uses_catalog_hauberk_mesh(bseed) { bseed } else { 0 },
        robe: bm == Mat::Cloth && !uses_catalog_coat_mesh(bseed),
        vest: bm == Mat::Leather,
        harness: bm == Mat::Bone,
        helm_item: if uses_iron_helm_mesh(hseed) { hseed } else { 0 },
        hat_item: (hm == Mat::Cloth && !uses_headband_mesh(hseed) && !uses_hood_mesh(hseed)).then_some(hseed),
        headband_item: if uses_headband_mesh(hseed) { hseed } else { 0 },
        hood_item: if uses_hood_mesh(hseed) { hseed } else { 0 },
        shield: false,
        shield_item: 0,
        kite: false,
        cuisses: lm == Mat::Metal && !uses_catalog_legs_mesh(lseed),
        leather_trousers: lm == Mat::Leather && !uses_catalog_legs_mesh(lseed),
        legs_item: if uses_catalog_legs_mesh(lseed) { lseed } else { 0 },
        feet_item: if Mat::from_u8(feet) != Mat::None && uses_catalog_feet_mesh(fseed) {
            fseed
        } else {
            0
        },
        coat_item: if uses_catalog_coat_mesh(bseed) { bseed } else { 0 },
        hands_item: 0,
    }
}
