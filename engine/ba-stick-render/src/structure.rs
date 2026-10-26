// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Field structures. Posts and roof edges are the invisible frame. The drawer
//! fills posts as solids and the roof and walls as strips between those edges,
//! the same ring-to-ring path a conifer uses.
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Post {
    pub x: f32,
    pub z: f32,
    pub y: f32,
    pub thick: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Roof {
    pub y0: f32,
    pub y1: f32,
    pub x0: f32,
    pub x1: f32,
    pub z0: f32,
    pub z1: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Wall {
    pub x0: f32,
    pub z0: f32,
    pub x1: f32,
    pub z1: f32,
    pub y: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ShelterDef {
    pub id: String,
    pub posts: Vec<Post>,
    pub roof: Roof,
    pub walls: Vec<Wall>,
}

impl ShelterDef {
    pub fn from_ron(src: &str) -> Result<ShelterDef, String> {
        let s: ShelterDef = ron::from_str(src).map_err(|e| e.to_string())?;
        if s.posts.len() < 4 {
            return Err(format!("shelter '{}' needs four posts", s.id));
        }
        if !(s.roof.y0 > 0.4 && s.roof.y1 > 0.4 && s.roof.x1 > s.roof.x0 && s.roof.z1 > s.roof.z0) {
            return Err(format!("shelter '{}': the roof must span and stand", s.id));
        }
        Ok(s)
    }
}

pub fn lean_to() -> &'static ShelterDef {
    use std::sync::OnceLock;
    static T: OnceLock<ShelterDef> = OnceLock::new();
    T.get_or_init(|| ShelterDef::from_ron(include_str!("../assets/props/ba_lean_to.ron")).expect("ba_lean_to"))
}

pub fn shack() -> &'static ShelterDef {
    use std::sync::OnceLock;
    static T: OnceLock<ShelterDef> = OnceLock::new();
    T.get_or_init(|| ShelterDef::from_ron(include_str!("../assets/props/ba_shack.ron")).expect("ba_shack"))
}

pub fn cairn() -> &'static crate::tree::TreeDef {
    use std::sync::OnceLock;
    static T: OnceLock<crate::tree::TreeDef> = OnceLock::new();
    T.get_or_init(|| crate::tree::TreeDef::from_ron(include_str!("../assets/props/ba_cairn.ron")).expect("ba_cairn"))
}
