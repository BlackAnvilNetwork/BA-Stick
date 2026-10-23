// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Conifer props. A trunk and a stack of tiers, in fractions of the tree's
//! height. `droop` and `lump` say how the species hangs and how far a bough
//! may stray from the tier radius. Each planted tree grows its own boughs
//! from its world position.
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct TreeTier {
    /// Base of the tier, fraction of tree height.
    pub y0: f32,
    /// Tip of the tier, fraction of tree height.
    pub y1: f32,
    /// Base radius, fraction of tree height.
    pub r: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct TreeDef {
    pub id: String,
    /// Trunk top, fraction of tree height.
    pub trunk_y: f32,
    /// Trunk radius at mid-height, fraction of tree height. The base flares wider.
    pub trunk_r: f32,
    /// How far a bough hangs below its tier, as a fraction of its length.
    pub droop: f32,
    /// How far a bough's length may stray from the tier radius.
    pub lump: f32,
    pub tiers: Vec<TreeTier>,
}

impl TreeDef {
    pub fn from_ron(src: &str) -> Result<TreeDef, String> {
        let t: TreeDef = ron::from_str(src).map_err(|e| e.to_string())?;
        if t.tiers.is_empty() {
            return Err(format!("tree '{}' needs a tier", t.id));
        }
        for tier in &t.tiers {
            if !(tier.y1 > tier.y0 && tier.r > 0.0) {
                return Err(format!("tree '{}': a tier must rise and have a radius", t.id));
            }
        }
        Ok(t)
    }
}

pub fn pine() -> &'static TreeDef {
    use std::sync::OnceLock;
    static T: OnceLock<TreeDef> = OnceLock::new();
    T.get_or_init(|| TreeDef::from_ron(include_str!("../assets/props/ba_pine.ron")).expect("ba_pine"))
}

pub fn spruce() -> &'static TreeDef {
    use std::sync::OnceLock;
    static T: OnceLock<TreeDef> = OnceLock::new();
    T.get_or_init(|| TreeDef::from_ron(include_str!("../assets/props/ba_spruce.ron")).expect("ba_spruce"))
}

pub fn cypress() -> &'static TreeDef {
    use std::sync::OnceLock;
    static T: OnceLock<TreeDef> = OnceLock::new();
    T.get_or_init(|| TreeDef::from_ron(include_str!("../assets/props/ba_cypress.ron")).expect("ba_cypress"))
}
