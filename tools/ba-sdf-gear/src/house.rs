// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Courtyard house kit — half-timber / stone archetypes with hollow interiors.
//!
//! Door cutouts are ≥ [`DOOR_WIDTH_M`] (1.2 m) so heightfield door pads stay clear.
//! Local frame: origin at floor centre; primary door on +Z (or L crook); Y up.

use glam::Vec3;

/// Clear door opening width in metres (matches zone sheet door width).
pub const DOOR_WIDTH_M: f32 = 1.2;
/// Half-width of the door boolean cut (slightly over sheet so mesh keeps ≥1.2 clear).
pub const DOOR_HALF_W: f32 = 0.62;
/// Door opening height (lintel).
pub const DOOR_HALF_H: f32 = 1.15;

fn sd_box(p: Vec3, b: Vec3) -> f32 {
    let q = p.abs() - b;
    q.max(Vec3::ZERO).length() + q.x.max(q.y).max(q.z).min(0.0)
}

fn op_union(a: f32, b: f32) -> f32 {
    a.min(b)
}

fn op_sub(a: f32, b: f32) -> f32 {
    a.max(-b)
}

/// Kit archetypes from the Anvilhold house sheet (A/B/C/D/H). Chapel deferred.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HouseKind {
    /// Model A — large L-shaped timber house (stone base + half-timber upper).
    TimberL,
    /// Model B — small 2-storey with cantilevered upper floor.
    Overhang,
    /// Model C — stone 1-storey workshop / wide door.
    Workshop,
    /// Model D — small plaster shed with stone quoins.
    Shed,
    /// Model H — small stone body with timber gable ends.
    StoneGable,
}

impl HouseKind {
    pub fn mesh_name(self) -> &'static str {
        match self {
            Self::TimberL => "house_l",
            Self::Overhang => "house_tall",
            Self::Workshop => "house_workshop",
            Self::Shed => "house_shed",
            Self::StoneGable => "house_stone",
        }
    }

    pub fn all() -> &'static [HouseKind] {
        &[
            Self::TimberL,
            Self::Overhang,
            Self::Workshop,
            Self::Shed,
            Self::StoneGable,
        ]
    }
}

/// Local frame: origin at floor centre; door on +Z face (TimberL: crook toward +Z/+X).
#[derive(Clone, Debug)]
pub struct HouseParams {
    pub kind: HouseKind,
    pub width: f32,
    pub depth: f32,
    /// Ground-floor wall height (stone band).
    pub wall_h: f32,
    /// Upper timber storey height (0 for single-storey).
    pub upper_h: f32,
    pub roof_h: f32,
    pub wall_shell: f32,
    /// Second-storey overhang past ground footprint (Model B).
    pub overhang: f32,
    /// L-wing extra depth along +X (Model A); 0 = rectangular.
    pub wing_depth: f32,
    /// L-wing width along Z (Model A).
    pub wing_width: f32,
    pub chimney: bool,
    /// Workshop / shed: wider door half-width (still ≥ DOOR_HALF_W).
    pub door_half_w: f32,
}

impl Default for HouseParams {
    fn default() -> Self {
        Self::from_kind(HouseKind::Overhang)
    }
}

impl HouseParams {
    pub fn from_kind(kind: HouseKind) -> Self {
        match kind {
            HouseKind::TimberL => Self {
                kind,
                width: 7.2,
                depth: 5.4,
                wall_h: 2.6,
                upper_h: 2.2,
                // Steeper pitch so the triangle survives iso + mesh res 48.
                roof_h: 2.85,
                wall_shell: 0.22,
                overhang: 0.0,
                wing_depth: 4.2,
                wing_width: 4.6,
                chimney: true,
                door_half_w: DOOR_HALF_W,
            },
            HouseKind::Overhang => Self {
                kind,
                width: 4.6,
                depth: 4.0,
                wall_h: 2.5,
                upper_h: 2.1,
                roof_h: 2.55,
                wall_shell: 0.2,
                overhang: 0.45,
                wing_depth: 0.0,
                wing_width: 0.0,
                chimney: true,
                door_half_w: DOOR_HALF_W,
            },
            HouseKind::Workshop => Self {
                kind,
                width: 6.4,
                depth: 5.0,
                wall_h: 3.2,
                upper_h: 0.0,
                roof_h: 3.0,
                wall_shell: 0.28,
                overhang: 0.0,
                wing_depth: 0.0,
                wing_width: 0.0,
                chimney: false,
                door_half_w: 0.95, // ~1.9 m workshop opening
            },
            HouseKind::Shed => Self {
                kind,
                width: 3.8,
                depth: 3.4,
                wall_h: 2.6,
                upper_h: 0.0,
                roof_h: 2.15,
                wall_shell: 0.18,
                overhang: 0.0,
                wing_depth: 0.0,
                wing_width: 0.0,
                chimney: false,
                door_half_w: DOOR_HALF_W,
            },
            HouseKind::StoneGable => Self {
                kind,
                width: 4.4,
                depth: 3.8,
                wall_h: 2.8,
                upper_h: 0.0,
                roof_h: 2.45,
                wall_shell: 0.24,
                overhang: 0.0,
                wing_depth: 0.0,
                wing_width: 0.0,
                chimney: true,
                door_half_w: DOOR_HALF_W,
            },
        }
    }

    pub fn total_wall_h(&self) -> f32 {
        self.wall_h + self.upper_h
    }

    pub fn half_extents(&self) -> Vec3 {
        let top = self.total_wall_h() + self.roof_h + if self.chimney { 1.1 } else { 0.0 };
        let mut hx = self.width * 0.5 + self.overhang + 0.4;
        let mut hz = self.depth * 0.5 + self.overhang + 0.4;
        if self.wing_depth > 0.0 {
            hx = hx.max(self.width * 0.5 + self.wing_depth + 0.4);
            hz = hz.max(self.depth * 0.5 + 0.4).max(self.wing_width * 0.5 + 0.4);
        }
        Vec3::new(hx, top, hz)
    }
}

/// Roof slab thickness — must beat mesh voxel (~0.17 m at res 48) or roofs flatten.
const ROOF_SHELL: f32 = 0.34;

/// Pitched roof prism: ridge along X, triangular YZ section — reads from every angle.
fn pitched_roof_rect(p: Vec3, hw: f32, hd: f32, eave_y: f32, roof_h: f32) -> f32 {
    let shell = ROOF_SHELL;
    // Slight eave overhang past the wall footprint.
    let eave_x = hw + shell * 0.55;
    let eave_z = hd + shell * 0.35;
    let q = p - Vec3::new(0.0, eave_y, 0.0);
    let nx = q.x.abs() - eave_x;
    let nz = q.z.abs() / eave_z.max(1e-3);
    let roof_top = roof_h * (1.0 - nz.clamp(0.0, 1.0));
    let ny_above = q.y - (roof_top + shell * 0.45);
    let ny_below = -q.y - 0.02;
    // Outside the gable triangle or past eaves.
    let d_tri = ny_above.max(ny_below).max(nz - 1.0);
    let d_x = nx;
    let outside = d_tri.max(d_x);
    if outside > 0.0 {
        return outside;
    }
    // Interior of prism: distance to nearest face (negative) + thick solid core.
    let to_slope = -(roof_top + shell * 0.45 - q.y);
    let to_eave = -q.y;
    let to_end = -(eave_x - q.x.abs());
    let to_side = -(eave_z - q.z.abs());
    to_slope.max(to_eave).max(to_end).max(to_side).min(0.0) - shell * 0.4
}

/// Thick ridge beam along X — silhouette cue at distant iso zoom.
fn ridge_beam(p: Vec3, hw: f32, eave_y: f32, roof_h: f32) -> f32 {
    sd_box(
        p - Vec3::new(0.0, eave_y + roof_h + 0.12, 0.0),
        Vec3::new(hw + 0.2, 0.18, 0.22),
    )
}

/// Filled triangular gable under the roof on ±X — closes the attic from side views.
fn gable_end(p: Vec3, sx: f32, hw: f32, hd: f32, eave_y: f32, roof_h: f32, thick: f32) -> f32 {
    let t = thick.max(0.36);
    let q = p - Vec3::new(sx * (hw - t * 0.2), eave_y, 0.0);
    let nz = q.z.abs() / hd.max(1e-3);
    let roof_top = roof_h * (1.0 - nz.clamp(0.0, 1.0));
    let ny_above = q.y - roof_top;
    let ny_below = -q.y - 0.02;
    let d_tri = ny_above.max(ny_below).max(nz - 1.0);
    let d_x = q.x.abs() - t * 0.5;
    d_tri.max(d_x)
}

/// Dark bargeboard strips along the gable rake (reads as timber edge on ±X).
fn bargeboard(p: Vec3, sx: f32, hw: f32, hd: f32, eave_y: f32, roof_h: f32) -> f32 {
    let q = p - Vec3::new(sx * (hw + 0.06), eave_y, 0.0);
    let nz = (q.z.abs() / hd.max(1e-3)).clamp(0.0, 1.0);
    let rake_y = roof_h * (1.0 - nz);
    let along = sd_box(
        q - Vec3::new(0.0, rake_y * 0.5, 0.0),
        Vec3::new(0.1, rake_y * 0.5 + 0.08, hd + 0.05),
    );
    // Keep the board near the slope (thin slab following the triangle).
    let to_slope = (q.y - rake_y).abs() - 0.14;
    along.max(to_slope)
}

/// Deep window recesses on long ±Z faces (readable in iso from any yaw).
fn window_cuts(p: Vec3, hw: f32, hd: f32, sill_y: f32, shell: f32) -> f32 {
    let wh = 0.48_f32;
    let ww = 0.42_f32;
    let mut d = 1e3_f32;
    for &z_sign in &[-1.0_f32, 1.0] {
        for &ox in &[-hw * 0.42, hw * 0.42] {
            if ox.abs() < 0.35 {
                continue;
            }
            let cut = sd_box(
                p - Vec3::new(ox, sill_y + wh, z_sign * (hd - shell * 0.15)),
                Vec3::new(ww, wh, shell * 1.15 + 0.12),
            );
            d = d.min(cut);
        }
    }
    d
}

/// Timber window frames proud of the wall — dark pixels at distant zoom.
fn window_frames(p: Vec3, hw: f32, hd: f32, sill_y: f32, shell: f32) -> f32 {
    let wh = 0.48_f32;
    let ww = 0.42_f32;
    let mut d = 1e3_f32;
    for &z_sign in &[-1.0_f32, 1.0] {
        for &ox in &[-hw * 0.42, hw * 0.42] {
            if ox.abs() < 0.35 {
                continue;
            }
            let c = Vec3::new(ox, sill_y + wh, z_sign * (hd + 0.04));
            let outer = sd_box(p - c, Vec3::new(ww + 0.08, wh + 0.08, shell * 0.35));
            let inner = sd_box(p - c, Vec3::new(ww - 0.04, wh - 0.04, shell * 0.5));
            d = d.min(op_sub(outer, inner));
        }
    }
    d
}

/// Proud timber door surround on +Z (keeps ≥1.2 m clear for walk-in pads).
fn door_leaf(p: Vec3, hd: f32, _shell: f32, door_half_w: f32) -> f32 {
    let frame = sd_box(
        p - Vec3::new(0.0, DOOR_HALF_H, hd + 0.05),
        Vec3::new(door_half_w + 0.14, DOOR_HALF_H + 0.12, 0.1),
    );
    let open = sd_box(
        p - Vec3::new(0.0, DOOR_HALF_H * 0.98, hd + 0.05),
        Vec3::new(door_half_w * 0.98, DOOR_HALF_H * 0.98, 0.18),
    );
    // Thin lintel bar so the doorway still reads at distant zoom.
    let lintel = sd_box(
        p - Vec3::new(0.0, DOOR_HALF_H * 2.0 + 0.06, hd + 0.06),
        Vec3::new(door_half_w + 0.16, 0.1, 0.12),
    );
    op_union(op_sub(frame, open), lintel)
}

fn chimney_sdf(p: Vec3, cx: f32, cz: f32, base_y: f32) -> f32 {
    let q = p - Vec3::new(cx, base_y + 0.7, cz);
    sd_box(q, Vec3::new(0.28, 0.7, 0.28))
}

/// Shared roof + gable + ridge stack for rectangular footprints.
fn roof_stack(p: Vec3, hw: f32, hd: f32, eave_y: f32, roof_h: f32, gable_thick: f32) -> f32 {
    let mut r = pitched_roof_rect(p, hw + 0.14, hd + 0.14, eave_y, roof_h);
    r = op_union(r, ridge_beam(p, hw + 0.1, eave_y, roof_h));
    r = op_union(
        r,
        gable_end(p, -1.0, hw, hd + 0.1, eave_y, roof_h, gable_thick),
    );
    r = op_union(
        r,
        gable_end(p, 1.0, hw, hd + 0.1, eave_y, roof_h, gable_thick),
    );
    r = op_union(r, bargeboard(p, -1.0, hw, hd + 0.1, eave_y, roof_h));
    r = op_union(r, bargeboard(p, 1.0, hw, hd + 0.1, eave_y, roof_h));
    r
}

/// Hollow rectangular shell with door on +Z.
fn rect_shell(
    p: Vec3,
    hw: f32,
    hd: f32,
    wall_h: f32,
    shell: f32,
    door_half_w: f32,
    door_z: f32,
) -> f32 {
    let outer = sd_box(
        p - Vec3::new(0.0, wall_h * 0.5, 0.0),
        Vec3::new(hw, wall_h * 0.5, hd),
    );
    let inner_hw = (hw - shell).max(0.08);
    let inner_hd = (hd - shell).max(0.08);
    let cavity = sd_box(
        p - Vec3::new(0.0, wall_h * 0.5 + 0.02, 0.0),
        Vec3::new(
            inner_hw,
            (wall_h * 0.5 - shell * 0.5).max(0.25),
            inner_hd,
        ),
    );
    let mut body = op_sub(outer, cavity);
    let door = sd_box(
        p - Vec3::new(0.0, DOOR_HALF_H, door_z),
        Vec3::new(door_half_w, DOOR_HALF_H, shell + 0.4),
    );
    body = op_sub(body, door);
    body
}

fn timber_l_sdf(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5;
    let hd = h.depth * 0.5;
    let shell = h.wall_shell;
    let stone_h = h.wall_h;
    let total_h = h.total_wall_h();

    // Main bar along X; wing extends +X and covers +Z half.
    let main = rect_shell(p, hw, hd, total_h, shell, h.door_half_w, hd - shell * 0.5);

    let wing_cx = hw + h.wing_depth * 0.5 - 0.05;
    let wing_hw = h.wing_depth * 0.5;
    let wing_hd = h.wing_width * 0.5;
    let wing_local = p - Vec3::new(wing_cx, 0.0, hd - wing_hd);
    // Door on the crook: −X face of wing (toward courtyard L).
    let wing_outer = sd_box(
        wing_local - Vec3::new(0.0, total_h * 0.5, 0.0),
        Vec3::new(wing_hw, total_h * 0.5, wing_hd),
    );
    let wing_cav = sd_box(
        wing_local - Vec3::new(0.0, total_h * 0.5 + 0.02, 0.0),
        Vec3::new(
            (wing_hw - shell).max(0.08),
            (total_h * 0.5 - shell * 0.5).max(0.25),
            (wing_hd - shell).max(0.08),
        ),
    );
    let mut wing = op_sub(wing_outer, wing_cav);
    let crook_door = sd_box(
        wing_local - Vec3::new(-wing_hw + shell * 0.5, DOOR_HALF_H, 0.15),
        Vec3::new(shell + 0.4, DOOR_HALF_H, h.door_half_w),
    );
    wing = op_sub(wing, crook_door);

    let mut body = op_union(main, wing);
    body = op_sub(body, window_cuts(p, hw, hd, stone_h * 0.45, shell));
    body = op_union(body, window_frames(p, hw, hd, stone_h * 0.45, shell));
    body = op_union(body, door_leaf(p, hd, shell, h.door_half_w));

    // Half-timber band hint: thin outer plates on upper storey (visual mass via SDF).
    if h.upper_h > 0.1 {
        let band_y = stone_h + h.upper_h * 0.5;
        let band = sd_box(
            p - Vec3::new(0.0, band_y, 0.0),
            Vec3::new(hw + 0.04, h.upper_h * 0.5, hd + 0.04),
        );
        let band_in = sd_box(
            p - Vec3::new(0.0, band_y, 0.0),
            Vec3::new(hw - 0.02, h.upper_h * 0.5 + 0.05, hd - 0.02),
        );
        body = op_union(body, op_sub(band, band_in));
    }

    let gable_t = shell * 1.8;
    body = op_union(body, roof_stack(p, hw, hd, total_h, h.roof_h, gable_t));
    body = op_union(
        body,
        roof_stack(wing_local, wing_hw, wing_hd, total_h, h.roof_h, gable_t),
    );

    if h.chimney {
        body = op_union(
            body,
            chimney_sdf(p, -hw * 0.35, -hd * 0.2, total_h + h.roof_h * 0.3),
        );
    }
    body
}

fn overhang_sdf(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5;
    let hd = h.depth * 0.5;
    let shell = h.wall_shell;
    let oh = h.overhang;

    let ground = rect_shell(p, hw, hd, h.wall_h, shell, h.door_half_w, hd - shell * 0.5);

    let uhw = hw + oh;
    let uhd = hd + oh;
    let upper_c = Vec3::new(0.0, h.wall_h + h.upper_h * 0.5, 0.0);
    let upper_outer = sd_box(p - upper_c, Vec3::new(uhw, h.upper_h * 0.5, uhd));
    let upper_cav = sd_box(
        p - (upper_c + Vec3::new(0.0, 0.02, 0.0)),
        Vec3::new(
            (uhw - shell).max(0.08),
            (h.upper_h * 0.5 - shell * 0.4).max(0.2),
            (uhd - shell).max(0.08),
        ),
    );
    // Open floor between storeys so players walk the ground pad (2.5D).
    let mut upper = op_sub(upper_outer, upper_cav);
    let floor_gap = sd_box(
        p - Vec3::new(0.0, h.wall_h + 0.15, 0.0),
        Vec3::new(uhw - shell * 1.5, 0.35, uhd - shell * 1.5),
    );
    upper = op_sub(upper, floor_gap);

    let mut body = op_union(ground, upper);
    body = op_sub(body, window_cuts(p, hw, hd, h.wall_h * 0.4, shell));
    body = op_union(body, window_frames(p, uhw, uhd, h.wall_h + h.upper_h * 0.25, shell));
    body = op_union(body, door_leaf(p, hd, shell, h.door_half_w));
    let eave = h.total_wall_h();
    body = op_union(body, roof_stack(p, uhw, uhd, eave, h.roof_h, shell * 2.0));
    if h.chimney {
        body = op_union(
            body,
            chimney_sdf(p, uhw * 0.35, -uhd * 0.25, eave + h.roof_h * 0.25),
        );
    }
    body
}

fn workshop_sdf(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5;
    let hd = h.depth * 0.5;
    let shell = h.wall_shell;
    let mut body = rect_shell(
        p,
        hw,
        hd,
        h.wall_h,
        shell,
        h.door_half_w,
        hd - shell * 0.5,
    );
    body = op_sub(body, window_cuts(p, hw, hd, h.wall_h * 0.55, shell));
    body = op_union(body, window_frames(p, hw, hd, h.wall_h * 0.55, shell));
    body = op_union(body, door_leaf(p, hd, shell, h.door_half_w));
    body = op_union(body, roof_stack(p, hw, hd, h.wall_h, h.roof_h, shell * 1.9));
    body
}

fn shed_sdf(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5;
    let hd = h.depth * 0.5;
    let shell = h.wall_shell;
    let mut body = rect_shell(
        p,
        hw,
        hd,
        h.wall_h,
        shell,
        h.door_half_w,
        hd - shell * 0.5,
    );
    // Corner quoins.
    let qh = h.wall_h * 0.5;
    for sx in [-1.0_f32, 1.0] {
        for sz in [-1.0_f32, 1.0] {
            let q = p - Vec3::new(sx * (hw - 0.12), qh, sz * (hd - 0.12));
            body = op_union(body, sd_box(q, Vec3::new(0.18, qh, 0.18)));
        }
    }
    body = op_sub(body, window_cuts(p, hw, hd, h.wall_h * 0.5, shell));
    body = op_union(body, window_frames(p, hw, hd, h.wall_h * 0.5, shell));
    body = op_union(body, door_leaf(p, hd, shell, h.door_half_w));
    body = op_union(body, roof_stack(p, hw, hd, h.wall_h, h.roof_h, shell * 2.0));
    body
}

fn stone_gable_sdf(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5;
    let hd = h.depth * 0.5;
    let shell = h.wall_shell;
    let mut body = rect_shell(
        p,
        hw,
        hd,
        h.wall_h,
        shell,
        h.door_half_w,
        hd - shell * 0.5,
    );
    body = op_sub(body, window_cuts(p, hw, hd, h.wall_h * 0.5, shell));
    body = op_union(body, window_frames(p, hw, hd, h.wall_h * 0.5, shell));
    body = op_union(body, door_leaf(p, hd, shell, h.door_half_w));
    body = op_union(body, roof_stack(p, hw, hd, h.wall_h, h.roof_h, shell * 2.1));
    if h.chimney {
        body = op_union(
            body,
            chimney_sdf(p, hw * 0.25, -hd * 0.2, h.wall_h + h.roof_h * 0.3),
        );
    }
    body
}

/// Signed distance: negative inside solid walls / roof.
pub fn house_sdf(p: Vec3, h: &HouseParams) -> f32 {
    match h.kind {
        HouseKind::TimberL => timber_l_sdf(p, h),
        HouseKind::Overhang => overhang_sdf(p, h),
        HouseKind::Workshop => workshop_sdf(p, h),
        HouseKind::Shed => shed_sdf(p, h),
        HouseKind::StoneGable => stone_gable_sdf(p, h),
    }
}

/// Material attribute 0..1 → BAM palette (wood &lt;0.2, stone mid, plaster &gt;0.65).
pub fn house_mat(p: Vec3, h: &HouseParams) -> f32 {
    let hw = h.width * 0.5 + h.overhang;
    let hd = h.depth * 0.5 + h.overhang;
    let door_w = h.door_half_w + 0.08;
    let eave = h.total_wall_h();
    // Door leaf / frame (timber).
    if p.z > hd - h.wall_shell * 2.8 && p.y < DOOR_HALF_H * 1.15 && p.x.abs() < door_w + 0.12 {
        return 0.11;
    }
    if h.kind == HouseKind::TimberL {
        let wing_cx = h.width * 0.5 + h.wing_depth * 0.5;
        let wing_hw = h.wing_depth * 0.5;
        let local_x = p.x - wing_cx;
        if local_x < -wing_hw + h.wall_shell * 2.0
            && local_x > -wing_hw - 0.5
            && p.y < DOOR_HALF_H * 1.05
            && (p.z - (hd - h.overhang - h.wing_width * 0.5)).abs() < door_w
        {
            return 0.11;
        }
    }
    // Ridge beam + bargeboards (dark timber).
    if p.y > eave + h.roof_h * 0.85 && p.z.abs() < 0.35 {
        return 0.13;
    }
    if p.y > eave + 0.1 && p.x.abs() > hw - 0.25 {
        return 0.14;
    }
    // Roof shingles (cooler mid stone, distinct from walls).
    if p.y > eave + 0.08 {
        return 0.44 + 0.1 * ((p.x * 3.2).sin() * (p.z * 2.6).cos()).abs();
    }
    // Window frame band (timber).
    let sill = if h.upper_h > 0.1 {
        h.wall_h * 0.4
    } else {
        h.wall_h * 0.5
    };
    if (p.y - (sill + 0.48)).abs() < 0.55
        && p.z.abs() > hd - h.wall_shell * 1.6
        && ((p.x.abs() - hw * 0.42).abs() < 0.55)
    {
        return 0.12;
    }
    // Stone base band.
    if p.y < h.wall_h - 0.05 {
        return 0.36 + 0.1 * ((p.x * 4.0).sin() * (p.z * 3.5).cos()).abs();
    }
    // Upper plaster / half-timber (light) + denser studs for iso read.
    if h.upper_h > 0.1 && p.y >= h.wall_h {
        let stud = ((p.x * 1.6).sin().abs() < 0.14) || ((p.y * 2.0).sin().abs() < 0.12);
        if stud {
            return 0.13;
        }
        return 0.74 + 0.08 * ((p.x * 3.0).cos()).abs();
    }
    // Gable plaster fill on single-storey (lighter triangle vs stone walls).
    if h.upper_h < 0.1 && p.y > h.wall_h * 0.85 && p.x.abs() > hw - h.wall_shell * 2.2 {
        let stud = ((p.z * 2.0).sin().abs() < 0.12) || ((p.y * 2.4).sin().abs() < 0.1);
        if stud {
            return 0.13;
        }
        return 0.7;
    }
    // Single-storey plaster (shed) or stone (workshop / stone gable).
    match h.kind {
        HouseKind::Shed => 0.72 + 0.06 * ((p.x * 5.0).sin()).abs(),
        HouseKind::Workshop | HouseKind::StoneGable => {
            0.38 + 0.12 * ((p.x * 5.0).sin() * (p.y * 4.0).cos()).abs()
        }
        _ => 0.42,
    }
}

pub fn house_stone_rgb(m: f32) -> [f32; 3] {
    let m = m.clamp(0.0, 1.0);
    if m < 0.2 {
        [0.22, 0.14, 0.09] // dark timber
    } else if m < 0.55 {
        let u = (m - 0.2) / 0.35;
        // Cool grey stone (ROCK family), not warm beige.
        [0.42 + 0.14 * u, 0.40 + 0.12 * u, 0.37 + 0.10 * u]
    } else {
        let u = (m - 0.55) / 0.45;
        // Off-white plaster / bone.
        [0.78 + 0.08 * u, 0.74 + 0.06 * u, 0.66 + 0.04 * u]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn door_width_meets_zone_sheet() {
        assert!(DOOR_WIDTH_M >= 1.2);
        assert!(DOOR_HALF_W * 2.0 >= DOOR_WIDTH_M - 1e-3);
        for kind in HouseKind::all() {
            let h = HouseParams::from_kind(*kind);
            assert!(
                h.door_half_w * 2.0 >= DOOR_WIDTH_M - 1e-3,
                "{:?} door {:.2}",
                kind,
                h.door_half_w * 2.0
            );
        }
    }

    #[test]
    fn interior_cavity_open_on_rect_kinds() {
        for kind in [
            HouseKind::Overhang,
            HouseKind::Workshop,
            HouseKind::Shed,
            HouseKind::StoneGable,
        ] {
            let h = HouseParams::from_kind(kind);
            // Centre of room should be empty (positive / outside solid).
            let d = house_sdf(Vec3::new(0.0, 1.2, 0.0), &h);
            assert!(d > 0.0, "{:?} interior d={d}", kind);
            // Wall shell solid.
            let hw = h.width * 0.5;
            let wall = house_sdf(Vec3::new(hw - h.wall_shell * 0.4, 1.2, 0.0), &h);
            assert!(wall < 0.0, "{:?} wall d={wall}", kind);
        }
    }

    #[test]
    fn timber_l_has_solid_and_cavity() {
        let h = HouseParams::from_kind(HouseKind::TimberL);
        let cav = house_sdf(Vec3::new(0.0, 1.3, 0.0), &h);
        assert!(cav > 0.0, "main cavity d={cav}");
        let wall = house_sdf(Vec3::new(h.width * 0.5 - 0.1, 1.3, 0.0), &h);
        assert!(wall < 0.0, "main wall d={wall}");
    }

    #[test]
    fn door_cut_is_open() {
        let h = HouseParams::from_kind(HouseKind::Overhang);
        let hd = h.depth * 0.5;
        let d = house_sdf(Vec3::new(0.0, 1.0, hd - h.wall_shell * 0.5), &h);
        assert!(d > -0.05, "door cut should not be deep solid d={d}");
    }

    #[test]
    fn far_point_positive() {
        let h = HouseParams::default();
        let d = house_sdf(Vec3::new(40.0, 2.0, 40.0), &h);
        assert!(d > 1.0, "far d={d}");
    }

    #[test]
    fn pitched_roof_and_gable_solid_all_kinds() {
        for kind in HouseKind::all() {
            let h = HouseParams::from_kind(*kind);
            let eave = h.total_wall_h();
            let hw = h.width * 0.5 + h.overhang;
            let ridge = house_sdf(Vec3::new(0.0, eave + h.roof_h * 0.55, 0.0), &h);
            assert!(ridge < 0.0, "{:?} ridge solid d={ridge}", kind);
            let gable = house_sdf(
                Vec3::new(hw - 0.12, eave + h.roof_h * 0.35, 0.0),
                &h,
            );
            assert!(gable < 0.05, "{:?} gable near-solid d={gable}", kind);
        }
    }

    #[test]
    fn window_recess_opens_long_face() {
        let h = HouseParams::from_kind(HouseKind::StoneGable);
        let hd = h.depth * 0.5;
        let hw = h.width * 0.5;
        let sill = h.wall_h * 0.5;
        let d = house_sdf(
            Vec3::new(hw * 0.42, sill + 0.48, hd - h.wall_shell * 0.3),
            &h,
        );
        assert!(d > -0.08, "window cut should open wall d={d}");
    }
}
