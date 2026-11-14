// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Gatehouse SDF — architecture fixture (towers + curtain + arch + battlements).
//! Hand-authored from `art/gatehouse_front.png` (single view → depth_confidence 0).
//!
//! Pass-2 rules:
//! - Doors are hinged leaves (`door_open` 0..1 → 0..90° outward).
//! - Arrow slits are windows into a hollow tower interior.
//! - Corbels, voussoirs, footing, planks, and depth are authored — not ignored.

use glam::{Vec2, Vec3};

fn smin(a: f32, b: f32, k: f32) -> f32 {
    if k <= 1e-6 {
        return a.min(b);
    }
    let h = (0.5 + 0.5 * (b - a) / k).clamp(0.0, 1.0);
    b + (a - b) * h - k * h * (1.0 - h)
}

fn sd_box(p: Vec3, b: Vec3) -> f32 {
    let q = p.abs() - b;
    q.max(Vec3::ZERO).length() + q.x.max(q.y).max(q.z).min(0.0)
}

fn sd_cylinder_y(p: Vec3, r: f32, h: f32) -> f32 {
    let d = Vec2::new(Vec2::new(p.x, p.z).length() - r, p.y.abs() - h);
    d.max(Vec2::ZERO).length() + d.x.max(d.y).min(0.0)
}

fn rot_y(p: Vec3, ang: f32) -> Vec3 {
    let (s, c) = ang.sin_cos();
    Vec3::new(p.x * c - p.z * s, p.y, p.x * s + p.z * c)
}

/// Rounded arch cutout (Roman): straight jambs + semicircle head.
fn sd_arch_cut(p: Vec3, half_w: f32, height: f32, half_d: f32) -> f32 {
    let spring = height - half_w;
    let profile = if p.y <= spring {
        p.x.abs() - half_w
    } else {
        Vec2::new(p.x, p.y - spring).length() - half_w
    };
    let vertical = (-p.y).max(p.y - height);
    let depth = p.z.abs() - half_d;
    let d = profile.max(vertical).max(depth);
    let outside = Vec2::new(profile.max(vertical), depth);
    outside.max(Vec2::ZERO).length() + d.min(0.0)
}

#[derive(Clone, Debug)]
pub struct GatehouseParams {
    pub tower_sep: f32,
    pub tower_r: f32,
    pub tower_h: f32,
    pub crown_r: f32,
    pub crown_h: f32,
    pub wall_half: Vec3,
    pub arch_w: f32,
    pub arch_h: f32,
    pub battlement: f32,
    pub merlon_w: f32,
    pub merlon_gap: f32,
    /// Shell thickness for hollow tower interiors (windows look into this).
    pub wall_shell: f32,
    /// 0 = closed, 1 = fully open (~90° outward about outer hinges).
    pub door_open: f32,
}

impl Default for GatehouseParams {
    fn default() -> Self {
        // Standalone fixture defaults — bastion uses CastleModule::to_gatehouse (wider clear).
        Self {
            tower_sep: 1.32,
            tower_r: 0.68,
            tower_h: 4.15,
            crown_r: 0.84,
            crown_h: 0.62,
            wall_half: Vec3::new(0.78, 1.68, 0.40),
            arch_w: 0.55,
            arch_h: 2.15,
            battlement: 0.38,
            merlon_w: 0.18,
            merlon_gap: 0.11,
            wall_shell: 0.15,
            door_open: 0.0,
        }
    }
}

fn battlement_ring_y(p: Vec3, y0: f32, r_inner: f32, r_outer: f32, h: f32, merlon_w: f32, gap: f32) -> f32 {
    let q = p - Vec3::new(0.0, y0 + h * 0.5, 0.0);
    let rad = Vec2::new(q.x, q.z).length();
    let ang = q.z.atan2(q.x);
    let period = merlon_w + gap;
    let n = (std::f32::consts::TAU / period).round().max(8.0);
    let sector = std::f32::consts::TAU / n;
    let a = (ang + sector * 0.5).rem_euclid(sector) - sector * 0.5;
    let along = a * rad;
    sd_box(
        Vec3::new(along, q.y, rad - (r_inner + r_outer) * 0.5),
        Vec3::new(merlon_w * 0.5, h * 0.5, (r_outer - r_inner) * 0.5),
    )
}

fn battlement_line_x(
    p: Vec3,
    y0: f32,
    x0: f32,
    x1: f32,
    z: f32,
    depth: f32,
    h: f32,
    merlon_w: f32,
    gap: f32,
) -> f32 {
    let q = p - Vec3::new(0.0, y0 + h * 0.5, z);
    let period = merlon_w + gap;
    let local_x = q.x - x0;
    let cell = (local_x / period).floor() * period + merlon_w * 0.5;
    let cx = x0 + cell;
    if cx < x0 - 0.01 || cx > x1 + 0.01 {
        return 1e3;
    }
    sd_box(
        Vec3::new(q.x - cx, q.y, q.z),
        Vec3::new(merlon_w * 0.5, h * 0.5, depth * 0.5),
    )
}

/// Polar-repeat arched corbels under an overhang (reference detail).
fn corbel_ring(p: Vec3, y: f32, r: f32, n: f32) -> f32 {
    let q = p - Vec3::new(0.0, y, 0.0);
    let rad = Vec2::new(q.x, q.z).length();
    let ang = q.z.atan2(q.x);
    let sector = std::f32::consts::TAU / n;
    let a = (ang + sector * 0.5).rem_euclid(sector) - sector * 0.5;
    let along = a * rad;
    // Small inverted arch / bracket: box + rounded underside.
    let bracket = sd_box(
        Vec3::new(along, q.y + 0.02, rad - r),
        Vec3::new(0.055, 0.09, 0.11),
    );
    let scoop = sd_cylinder_y(
        Vec3::new(along, q.y + 0.10, rad - r),
        0.07,
        0.06,
    );
    bracket.max(-scoop + 0.02)
}

/// Linear corbel arcade under curtain parapet.
fn corbel_line_x(p: Vec3, y: f32, x0: f32, x1: f32, z: f32) -> f32 {
    let period = 0.18;
    let local_x = p.x - x0;
    let cell = (local_x / period).floor() * period + period * 0.5;
    let cx = x0 + cell;
    if cx < x0 || cx > x1 {
        return 1e3;
    }
    let q = p - Vec3::new(cx, y, z);
    let bracket = sd_box(q + Vec3::new(0.0, 0.02, 0.0), Vec3::new(0.055, 0.08, 0.10));
    let scoop = sd_cylinder_y(q + Vec3::new(0.0, 0.09, 0.0), 0.06, 0.05);
    bracket.max(-scoop + 0.015)
}

fn footing_sdf(p: Vec3, s: &GatehouseParams) -> f32 {
    // Uneven rubble / soil pads under towers and curtain.
    let pad = |cx: f32, r: f32| {
        let q = p - Vec3::new(cx, -0.02, 0.0);
        let n = ((q.x * 3.1).sin() * (q.z * 2.7).cos()) * 0.04;
        sd_cylinder_y(q - Vec3::new(0.0, n, 0.0), r, 0.10 + n.abs())
    };
    let tl = pad(-s.tower_sep, s.tower_r * 1.18);
    let tr = pad(s.tower_sep, s.tower_r * 1.18);
    let mid = sd_box(
        p - Vec3::new(0.0, -0.02, 0.0),
        Vec3::new(s.tower_sep * 0.85, 0.08, s.wall_half.z * 1.25),
    );
    tl.min(tr).min(mid)
}

fn tower_sdf(p: Vec3, cx: f32, s: &GatehouseParams) -> f32 {
    let local = p - Vec3::new(cx, 0.0, 0.0);
    let flare = 1.0 + (1.0 - (local.y / 0.55).clamp(0.0, 1.0)) * 0.10;
    let outer_r = s.tower_r * flare;
    let shaft_outer = sd_cylinder_y(
        local - Vec3::new(0.0, s.tower_h * 0.5, 0.0),
        outer_r,
        s.tower_h * 0.5,
    );
    // Hollow interior — windows look into this volume.
    let inner_r = (s.tower_r - s.wall_shell).max(0.18);
    let cavity = sd_cylinder_y(
        local - Vec3::new(0.0, s.tower_h * 0.5 + 0.12, 0.0),
        inner_r,
        s.tower_h * 0.5 - 0.18,
    );
    // Floor slab inside tower
    let floor = sd_cylinder_y(
        local - Vec3::new(0.0, 0.12, 0.0),
        inner_r + 0.02,
        0.10,
    );
    let mut body = shaft_outer.max(-cavity);
    body = smin(body, floor, 0.02);

    // Crown drum + overhang lip
    let crown_y = s.tower_h - s.crown_h * 0.12;
    let crown = sd_cylinder_y(
        local - Vec3::new(0.0, crown_y + s.crown_h * 0.38, 0.0),
        s.crown_r,
        s.crown_h * 0.48,
    );
    let lip = sd_cylinder_y(
        local - Vec3::new(0.0, crown_y + 0.04, 0.0),
        s.crown_r * 0.98,
        0.07,
    );
    body = smin(body, crown, 0.045);
    body = smin(body, lip, 0.03);
    // Dense arched corbel ring under crown (reference: continuous brackets)
    let corbels = corbel_ring(local, crown_y + 0.01, s.crown_r * 0.86, 20.0);
    body = smin(body, corbels, 0.02);

    // Arrow slit = window into interior (embrasure opens the cavity to +Z).
    let slit_y = s.tower_h * 0.58;
    let slit_outer = sd_box(
        local - Vec3::new(0.0, slit_y, s.tower_r * 0.50),
        Vec3::new(0.06, 0.34, s.tower_r * 0.85),
    );
    // Wider inner splay so the dark interior reads from the front.
    let slit_inner = sd_box(
        local - Vec3::new(0.0, slit_y, 0.05),
        Vec3::new(0.14, 0.40, inner_r + 0.05),
    );
    body = body.max(-slit_outer);
    body = body.max(-slit_inner);

    // Battlements on crown
    let bat_y = s.tower_h + s.crown_h * 0.42;
    let bat = battlement_ring_y(
        local,
        bat_y,
        s.crown_r * 0.70,
        s.crown_r * 1.04,
        s.battlement,
        s.merlon_w,
        s.merlon_gap,
    );
    // Thin walkway ring under merlons
    let walk = sd_cylinder_y(
        local - Vec3::new(0.0, bat_y + 0.02, 0.0),
        s.crown_r * 0.92,
        0.05,
    );
    body = smin(body, walk, 0.02);
    smin(body, bat, 0.025)
}

fn curtain_sdf(p: Vec3, s: &GatehouseParams) -> f32 {
    let wall = sd_box(p - Vec3::new(0.0, s.wall_half.y, 0.0), s.wall_half);
    let arch = sd_arch_cut(p, s.arch_w, s.arch_h, s.wall_half.z + 0.35);
    let mut body = wall.max(-arch);

    // Gate buttresses (proud framing pillars from reference)
    let bl = sd_box(
        p - Vec3::new(-(s.arch_w + 0.16), s.arch_h * 0.48, s.wall_half.z + 0.10),
        Vec3::new(0.13, s.arch_h * 0.50, 0.18),
    );
    let br = sd_box(
        p - Vec3::new(s.arch_w + 0.16, s.arch_h * 0.48, s.wall_half.z + 0.10),
        Vec3::new(0.13, s.arch_h * 0.50, 0.18),
    );
    body = smin(body, bl, 0.035);
    body = smin(body, br, 0.035);

    // Voussoir / arch face ring (stone frame around opening)
    let face_z = s.wall_half.z + 0.04;
    let outer = sd_arch_cut(
        p - Vec3::new(0.0, 0.0, face_z * 0.15),
        s.arch_w + 0.14,
        s.arch_h + 0.14,
        0.10,
    );
    let inner = sd_arch_cut(
        p - Vec3::new(0.0, 0.0, face_z * 0.15),
        s.arch_w + 0.01,
        s.arch_h + 0.01,
        0.22,
    );
    let voussoir = outer.max(-inner);
    // Keep ring near the front face only
    let face_slab = sd_box(
        p - Vec3::new(0.0, s.arch_h * 0.55, face_z),
        Vec3::new(s.arch_w + 0.20, s.arch_h * 0.58, 0.08),
    );
    body = smin(body, voussoir.max(face_slab), 0.03);

    let top_y = s.wall_half.y * 2.0;
    let span = s.tower_sep - s.tower_r * 0.75;

    // Parapet + wall-top battlements
    let parapet = sd_box(
        p - Vec3::new(0.0, top_y + 0.07, 0.0),
        Vec3::new(span * 0.96, 0.09, s.wall_half.z * 1.20),
    );
    let bat = battlement_line_x(
        p,
        top_y + 0.02,
        -span,
        span,
        0.0,
        s.wall_half.z * 1.55,
        s.battlement,
        s.merlon_w,
        s.merlon_gap,
    );
    // Corbel arcade under parapet (front + back)
    let cor_f = corbel_line_x(p, top_y - 0.02, -span * 0.95, span * 0.95, s.wall_half.z * 0.95);
    let cor_b = corbel_line_x(p, top_y - 0.02, -span * 0.95, span * 0.95, -s.wall_half.z * 0.95);
    body = smin(body, parapet, 0.03);
    body = smin(body, cor_f, 0.02);
    body = smin(body, cor_b, 0.02);
    smin(body, bat, 0.02)
}

/// One door leaf in closed local space (origin = hinge, leaf extends +X for left / -X via mirror).
fn door_leaf_local(p: Vec3, half_w: f32, half_h: f32, thick: f32) -> f32 {
    // Panel (thicker so open leaves read in the 90° preview)
    let panel = sd_box(
        p - Vec3::new(half_w, half_h, 0.0),
        Vec3::new(half_w, half_h, thick),
    );
    let mut d = panel;
    for i in 1..4 {
        let gx = half_w * (i as f32) / 4.0;
        let groove = sd_box(
            p - Vec3::new(gx, half_h, thick + 0.008),
            Vec3::new(0.014, half_h * 0.92, 0.025),
        );
        d = d.max(-groove);
    }
    let rail = sd_box(
        p - Vec3::new(half_w, half_h * 0.55, 0.0),
        Vec3::new(half_w * 0.92, 0.045, thick * 1.15),
    );
    // Strap hinge bosses near hinge edge
    let strap = sd_box(
        p - Vec3::new(0.04, half_h * 0.7, 0.0),
        Vec3::new(0.05, 0.06, thick * 1.3),
    );
    d = smin(d, rail, 0.01);
    smin(d, strap, 0.01)
}

fn door_sdf(p: Vec3, s: &GatehouseParams) -> f32 {
    let open = s.door_open.clamp(0.0, 1.0);
    let ang = open * std::f32::consts::FRAC_PI_2;
    let leaf_h = (s.arch_h - s.arch_w) * 0.94;
    let half_w = s.arch_w * 0.48;
    let thick = 0.07;
    // Hinge on the arch face so open leaves clear the wall and read in the 90° preview.
    let z0 = s.wall_half.z - 0.06;

    // SDF of a leaf rotated by +ang about hinge: evaluate local field at R(-ang)·p.
    // Left leaf: hinge at outer left; closed leaf extends +X toward centre.
    let hinge_l = Vec3::new(-s.arch_w * 0.98, 0.0, z0);
    let pl = rot_y(p - hinge_l, -ang);
    let left = door_leaf_local(pl, half_w, leaf_h * 0.5, thick);

    // Right leaf: mirror X, same outward open.
    let hinge_r = Vec3::new(s.arch_w * 0.98, 0.0, z0);
    let mut pr = p - hinge_r;
    pr.x = -pr.x;
    let pr = rot_y(pr, -ang);
    let right = door_leaf_local(pr, half_w, leaf_h * 0.5, thick);

    left.min(right)
}

/// Stone structure only (no doors) — useful for open-door clearance tests.
pub fn gatehouse_stone_sdf(p: Vec3, s: &GatehouseParams) -> f32 {
    let tl = tower_sdf(p, -s.tower_sep, s);
    let tr = tower_sdf(p, s.tower_sep, s);
    let wall = curtain_sdf(p, s);
    let foot = footing_sdf(p, s);
    let mut d = tl.min(tr);
    d = smin(d, wall, 0.07);
    smin(d, foot, 0.05)
}

/// Full gatehouse distance field. Base at y=0, mirrored about X=0.
pub fn gatehouse_sdf(p: Vec3, s: &GatehouseParams) -> f32 {
    let stone = gatehouse_stone_sdf(p, s);
    let door = door_sdf(p, s);
    smin(stone, door, 0.015)
}

/// 0..1 attribute: wood door vs stone (mortar banding).
pub fn gatehouse_mat(p: Vec3, s: &GatehouseParams) -> f32 {
    let door = door_sdf(p, s);
    if door < 0.035 {
        // Plank variation
        let grain = ((p.x * 18.0).sin() * 0.5 + 0.5) * 0.08;
        return 0.08 + grain;
    }
    // Darker inside hollow towers (near cavity)
    let local_l = p - Vec3::new(-s.tower_sep, 0.0, 0.0);
    let local_r = p - Vec3::new(s.tower_sep, 0.0, 0.0);
    let inner_r = (s.tower_r - s.wall_shell).max(0.18);
    let in_l = Vec2::new(local_l.x, local_l.z).length() < inner_r + 0.05
        && local_l.y > 0.2
        && local_l.y < s.tower_h - 0.3;
    let in_r = Vec2::new(local_r.x, local_r.z).length() < inner_r + 0.05
        && local_r.y > 0.2
        && local_r.y < s.tower_h - 0.3;
    if in_l || in_r {
        return 0.32;
    }
    let n = ((p.x * 7.1).sin() * (p.y * 5.3).sin() * (p.z * 6.2).cos()).abs();
    let mortar = ((p.y * 9.0).sin().abs() * (p.x * 8.0).sin().abs()) * 0.12;
    0.42 + 0.22 * n + 0.08 * (p.y / s.tower_h).clamp(0.0, 1.0) + mortar
}

pub fn stone_rgb(m: f32) -> [f32; 3] {
    let m = m.clamp(0.0, 1.0);
    if m < 0.25 {
        let u = m / 0.25;
        // Dark timber / iron fittings.
        [0.22 + 0.08 * u, 0.14 + 0.05 * u, 0.10 + 0.03 * u]
    } else {
        let u = (m - 0.25) / 0.75;
        // Cool grey ashlar (ROCK), not warm beige.
        [
            0.40 + 0.28 * u,
            0.38 + 0.26 * u,
            0.35 + 0.24 * u,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interior_of_wall_is_negative() {
        let s = GatehouseParams::default();
        let d = gatehouse_sdf(Vec3::new(0.58, 1.5, 0.0), &s);
        assert!(d < 0.0, "curtain interior d={d}");
    }

    #[test]
    fn arch_opening_is_outside() {
        let s = GatehouseParams::default();
        let open = gatehouse_sdf(Vec3::new(0.0, 1.5, 0.70), &s);
        assert!(open > 0.0, "outside arch front d={open}");
    }

    #[test]
    fn far_point_positive() {
        let s = GatehouseParams::default();
        let d = gatehouse_sdf(Vec3::new(8.0, 2.0, 8.0), &s);
        assert!(d > 1.0, "far d={d}");
    }

    #[test]
    fn towers_exist() {
        let s = GatehouseParams::default();
        // Mid-shell radius between cavity and outer face.
        let mid_r = s.tower_r - s.wall_shell * 0.5;
        let d = gatehouse_sdf(Vec3::new(-s.tower_sep, s.tower_h * 0.4, mid_r), &s);
        assert!(d < 0.0, "tower shell d={d}");
    }

    #[test]
    fn tower_cavity_is_empty() {
        let s = GatehouseParams::default();
        let d = gatehouse_stone_sdf(Vec3::new(-s.tower_sep, s.tower_h * 0.45, 0.0), &s);
        assert!(d > 0.0, "tower cavity should be empty d={d}");
    }

    #[test]
    fn arrow_slit_opens_to_interior() {
        let s = GatehouseParams::default();
        // Point on the slit axis just inside the outer face should be empty.
        let d = gatehouse_stone_sdf(
            Vec3::new(-s.tower_sep, s.tower_h * 0.58, s.tower_r * 0.55),
            &s,
        );
        assert!(d > -0.02, "slit passage d={d}");
    }

    #[test]
    fn open_doors_swing_out() {
        let mut s = GatehouseParams::default();
        s.door_open = 1.0;
        // Closed-door centre seam should be empty when open.
        let seam = door_sdf(Vec3::new(0.0, 0.9, 0.04), &s);
        assert!(seam > 0.05, "open seam d={seam}");
        // Swung leaf lies in +Z from the left hinge (half-width along Z when open 90°).
        let half_w = s.arch_w * 0.48;
        let z0 = s.wall_half.z - 0.06;
        let swung = door_sdf(Vec3::new(-s.arch_w * 0.98, 0.9, z0 + half_w * 0.55), &s);
        assert!(swung < 0.0, "swung leaf d={swung}");
        // Cleared past the curtain front plane.
        assert!(
            z0 + half_w > s.wall_half.z + 0.05,
            "open leaf should project past wall face"
        );
    }

    #[test]
    fn bastion_gate_clear_matches_walk_mask() {
        use crate::castle::CastleModule;
        let g = CastleModule::default().to_gatehouse(1.0);
        assert!(g.arch_w * 2.0 >= 3.6 - 0.05, "arch clear={}", g.arch_w * 2.0);
        // Mid-arch passage empty with doors open.
        let mid = gatehouse_sdf(Vec3::new(0.0, 1.2, 0.0), &g);
        assert!(mid > 0.0, "open mid-arch d={mid}");
        let high = gatehouse_sdf(Vec3::new(0.0, g.arch_h * 0.55, 0.0), &g);
        assert!(high > 0.0, "open high-arch d={high}");
    }
}
