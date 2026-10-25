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

const IRON_HELM_MESH_ITEMS: &[u32] = &[
    BRONZE_HELM_ITEM,
    IRON_HELM_ITEM,
    MYTHRIL_HELM_ITEM,
    DARKSTEEL_HELM_ITEM,
    PALACE_HELM_ITEM,
    SCALE_MAIL_HELM_ITEM,
    SHADE_HELM_ITEM,
    BONE_HELM_ITEM,
];

pub fn uses_iron_helm_mesh(item_id: u32) -> bool {
    IRON_HELM_MESH_ITEMS.contains(&item_id)
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
    /// Iron shield (`ba_iron_shield`) on the off hand. A faced plane, not a billboard.
    pub shield: bool,
    /// Kite shield (`ba_kite_shield`) on the off hand. A pointed steel face with a gold rim and cross.
    pub kite: bool,
    /// Iron cuisses (`ba_iron_cuisses`) on metal leg pieces. A plate over each hip and thigh.
    pub cuisses: bool,
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
        plate: bm == Mat::Metal,
        robe: bm == Mat::Cloth,
        vest: bm == Mat::Leather,
        harness: bm == Mat::Bone,
        helm_item: if uses_iron_helm_mesh(hseed) { hseed } else { 0 },
        hat_item: (hm == Mat::Cloth && !uses_headband_mesh(hseed)).then_some(hseed),
        headband_item: if uses_headband_mesh(hseed) { hseed } else { 0 },
        shield: false,
        kite: false,
        cuisses: lm == Mat::Metal,
    }
}
