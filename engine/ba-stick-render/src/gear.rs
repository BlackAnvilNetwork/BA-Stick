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
            Mat::Cloth => [(C_BODY, C_BODY_FAR), (C_ACCENT, 13), (C_DASH, 13), (C_DUST, 13)][(seed % 4) as usize],
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
    /// Length multiplier (0.85..1.15).
    pub len: f32,
    pub guard: u8,
    pub grip: u8,
    pub blade: u8,
    pub gem: u8,
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
        let grip = if mat == Mat::Leather { GEAR_LEATHER } else { C_HILT };
        WeaponLook { kind, len, guard, grip, blade, gem }
    }
    pub fn plain(kind: Weapon) -> WeaponLook {
        WeaponLook { kind, len: 1.0, guard: C_GOLD, grip: C_HILT, blade: C_STEEL, gem: C_ACCENT }
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
}

/// Build a garb from wasm args. `family` 0 = keep preset weapon,
/// 1 sword, 2 greatsword, 3 dagger, 4 axe, 5 staff, 6 club, 7 knuckles.
#[allow(clippy::too_many_arguments)]
pub fn garb(family: u8, wmat: u8, wseed: u32, body: u8, bseed: u32, head: u8, hseed: u32, legs: u8, lseed: u32) -> Garb {
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
    }
}
