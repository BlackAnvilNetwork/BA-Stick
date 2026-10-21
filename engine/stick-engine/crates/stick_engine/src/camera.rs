// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

use crate::math::Vec3;

/// Pixels per world metre along iso axes. A 1 m tile is a 64x32 diamond and a
/// 1.8 m stick figure is ~80 px tall.
pub const ISO_X: f32 = 32.0;
pub const ISO_Y: f32 = 16.0;
pub const HEIGHT_PX: f32 = 44.0;

/// Projected point: screen x/y in pixels plus depth (smaller = nearer).
#[derive(Clone, Copy, Debug)]
pub struct P2 {
    pub x: f32,
    pub y: f32,
    pub d: f32,
}

/// Camera abstraction. `persp` blends the iso projection (0) into a 3D
/// perspective view (1) along the same view azimuth, so back-to-front draw
/// order is unchanged and ground picking stays closed-form.
#[derive(Clone, Copy, Debug)]
pub struct Camera {
    pub cx: f32,
    pub cz: f32,
    pub w: f32,
    pub h: f32,
    /// 0 = iso, 1 = full perspective. Values between blend.
    pub persp: f32,
}

/// Perspective strength at `persp = 1` (per metre of view depth).
pub const PERSP_K: f32 = 0.045;

impl Camera {
    pub fn new(w: usize, h: usize) -> Self {
        Camera { cx: 0.0, cz: 0.0, w: w as f32, h: h as f32, persp: 0.0 }
    }
    pub fn project(&self, p: Vec3) -> P2 {
        let u = (p.x - self.cx) - (p.z - self.cz);
        let v = (p.x - self.cx) + (p.z - self.cz);
        let s = self.scale_at_v(v);
        P2 {
            x: self.w * 0.5 + u * ISO_X * s,
            y: self.h * 0.55 + (v * ISO_Y - p.y * HEIGHT_PX) * s,
            d: -(p.x + p.z),
        }
    }
    /// Screen pixel -> point on the ground plane (y = 0).
    pub fn unproject_ground(&self, sx: f32, sy: f32) -> (f32, f32) {
        let yv = (sy - self.h * 0.55) / ISO_Y;
        // y = v * s(v), s(v) = 1 / (1 - a v)  =>  v = y / (1 + a y)
        let a = PERSP_K * self.persp;
        let v = yv / (1.0 + a * yv).max(0.2);
        let u = (sx - self.w * 0.5) / (ISO_X * self.scale_at_v(v));
        (self.cx + (u + v) * 0.5, self.cz + (v - u) * 0.5)
    }
    /// Screen magnification at view depth `v` (positive = nearer the viewer).
    pub fn scale_at_v(&self, v: f32) -> f32 {
        1.0 / (1.0 - PERSP_K * self.persp * v).max(0.2)
    }
    /// Magnification at a world point; 1 in iso mode.
    pub fn scale_at(&self, p: Vec3) -> f32 {
        self.scale_at_v((p.x - self.cx) + (p.z - self.cz))
    }
}
