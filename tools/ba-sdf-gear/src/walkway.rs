// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Rampart walkway bay — stone deck + low rail (SDF), pitched to match curtain bays.

use glam::Vec3;

fn sd_box(p: Vec3, b: Vec3) -> f32 {
    let q = p.abs() - b;
    q.max(Vec3::ZERO).length() + q.x.max(q.y).max(q.z).min(0.0)
}

/// Local: deck centred on origin; length along X; walk surface at y≈0.
#[derive(Clone, Debug)]
pub struct WalkwayParams {
    pub half_len: f32,
    pub half_width: f32,
    pub deck_h: f32,
    pub rail_h: f32,
}

impl Default for WalkwayParams {
    fn default() -> Self {
        Self {
            half_len: 1.20,
            half_width: 0.95,
            deck_h: 0.10,
            rail_h: 0.42,
        }
    }
}

impl WalkwayParams {
    pub fn half_extents(&self) -> Vec3 {
        Vec3::new(
            self.half_len + 0.08,
            self.deck_h + self.rail_h + 0.12,
            self.half_width + 0.12,
        )
    }
}

pub fn walkway_sdf(p: Vec3, s: &WalkwayParams) -> f32 {
    let deck = sd_box(
        p - Vec3::new(0.0, -s.deck_h * 0.5, 0.0),
        Vec3::new(s.half_len, s.deck_h * 0.5, s.half_width),
    );
    let rail_z = s.half_width - 0.06;
    let rail = |z: f32| {
        sd_box(
            p - Vec3::new(0.0, s.rail_h * 0.5, z),
            Vec3::new(s.half_len * 0.98, s.rail_h * 0.5, 0.055),
        )
    };
    let post = |x: f32, z: f32| {
        sd_box(
            p - Vec3::new(x, s.rail_h * 0.55, z),
            Vec3::new(0.06, s.rail_h * 0.55, 0.06),
        )
    };
    let mut body = deck;
    body = body.min(rail(rail_z)).min(rail(-rail_z));
    body = body
        .min(post(-s.half_len * 0.85, rail_z))
        .min(post(s.half_len * 0.85, rail_z))
        .min(post(-s.half_len * 0.85, -rail_z))
        .min(post(s.half_len * 0.85, -rail_z));
    body
}

pub fn walkway_mat(p: Vec3, s: &WalkwayParams) -> f32 {
    let _ = (p, s);
    0.55
}

pub fn walkway_stone_rgb(heat: f32) -> [f32; 3] {
    let t = heat.clamp(0.0, 1.0);
    [
        0.42 + 0.12 * t,
        0.40 + 0.10 * t,
        0.36 + 0.08 * t,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deck_centre_negative() {
        let s = WalkwayParams::default();
        assert!(walkway_sdf(Vec3::new(0.0, -0.02, 0.0), &s) < 0.0);
    }

    #[test]
    fn far_point_positive() {
        let s = WalkwayParams::default();
        assert!(walkway_sdf(Vec3::new(8.0, 0.0, 8.0), &s) > 0.5);
    }
}
