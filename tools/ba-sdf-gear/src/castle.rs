// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Modular castle wall kit — shared dims + curtain bay + generative compose.
//!
//! Snap rule: each bay is centred on its origin with towers at `±tower_sep`.
//! Adjacent bay origins are spaced by [`CastleModule::pitch`] (`2 * tower_sep`)
//! so neighbouring towers coincide and soft-union into one post.
//!
//! Art: `art/curtain_wall_front.png` (curtain bay). Gatehouse bay reuses gatehouse SDF.

use crate::gatehouse::{gatehouse_mat, gatehouse_sdf, GatehouseParams};
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

/// Shared castle kit dimensions — must match gatehouse so bays snap.
#[derive(Clone, Debug)]
pub struct CastleModule {
    pub tower_sep: f32,
    pub tower_r: f32,
    pub tower_h: f32,
    pub crown_r: f32,
    pub crown_h: f32,
    pub wall_half: Vec3,
    pub battlement: f32,
    pub merlon_w: f32,
    pub merlon_gap: f32,
    pub wall_shell: f32,
    /// Curtain gallery shell (hollow so wall slits have an interior).
    pub gallery_shell: f32,
}

impl Default for CastleModule {
    fn default() -> Self {
        // Pitch 7.92 (3× old 2.64 / AB_KIT_PITCH) — long curtain spans, fewer towers.
        // Towers ~2.3× old so posts stay chunky without filling the longer wall.
        Self {
            tower_sep: 3.96,
            tower_r: 1.55,
            tower_h: 7.2,
            crown_r: 1.90,
            crown_h: 1.05,
            wall_half: Vec3::new(3.35, 2.85, 0.92),
            battlement: 0.72,
            merlon_w: 0.42,
            merlon_gap: 0.28,
            wall_shell: 0.28,
            gallery_shell: 0.24,
        }
    }
}

impl CastleModule {
    /// Origin-to-origin spacing for adjacent bays (shared tower axes).
    pub fn pitch(&self) -> f32 {
        self.tower_sep * 2.0
    }

    /// Left / right tower world positions for a bay at `origin_x`.
    pub fn tower_xs(&self, origin_x: f32) -> (f32, f32) {
        (origin_x - self.tower_sep, origin_x + self.tower_sep)
    }

    /// Twin-tower gate sized for the south passage clear (3.6 m ≈ `GATE_HALF_W * 2`).
    /// Wider than a curtain bay — bastion layout places it at x≈0 and skips nearby curtains.
    pub fn to_gatehouse(&self, door_open: f32) -> GatehouseParams {
        let tower_r = (self.tower_r * 1.18).max(1.6);
        // Keep ~3.7 m arch clear; towers sit outside the passage.
        let tower_sep = (1.85 + tower_r * 0.85).max(4.2);
        GatehouseParams {
            tower_sep,
            tower_r,
            tower_h: self.tower_h * 1.08,
            crown_r: tower_r * 1.22,
            crown_h: self.crown_h * 1.05,
            wall_half: Vec3::new(
                tower_sep - tower_r * 0.30,
                self.wall_half.y * 1.06,
                self.wall_half.z * 1.15,
            ),
            arch_w: 1.85,
            arch_h: 2.85,
            battlement: self.battlement * 1.05,
            merlon_w: self.merlon_w * 1.10,
            merlon_gap: self.merlon_gap,
            wall_shell: self.wall_shell,
            door_open: door_open.clamp(0.0, 1.0),
        }
    }
}

/// One bay in a generative wall run.
#[derive(Clone, Debug)]
pub enum CastleBay {
    /// Twin towers + solid curtain with wall arrow slit (no gate).
    Curtain,
    /// Twin towers + arched gate + hinged doors.
    Gate { door_open: f32 },
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

fn corbel_ring(p: Vec3, y: f32, r: f32, n: f32) -> f32 {
    let q = p - Vec3::new(0.0, y, 0.0);
    let rad = Vec2::new(q.x, q.z).length();
    let ang = q.z.atan2(q.x);
    let sector = std::f32::consts::TAU / n;
    let a = (ang + sector * 0.5).rem_euclid(sector) - sector * 0.5;
    let along = a * rad;
    let bracket = sd_box(
        Vec3::new(along, q.y + 0.02, rad - r),
        Vec3::new(0.055, 0.09, 0.11),
    );
    let scoop = sd_cylinder_y(Vec3::new(along, q.y + 0.10, rad - r), 0.07, 0.06);
    bracket.max(-scoop + 0.02)
}

fn corbel_line_x(p: Vec3, y: f32, x0: f32, x1: f32, z: f32) -> f32 {
    let period = 0.48;
    let local_x = p.x - x0;
    let cell = (local_x / period).floor() * period + period * 0.5;
    let cx = x0 + cell;
    if cx < x0 || cx > x1 {
        return 1e3;
    }
    let q = p - Vec3::new(cx, y, z);
    let bracket = sd_box(q + Vec3::new(0.0, 0.04, 0.0), Vec3::new(0.12, 0.16, 0.20));
    let scoop = sd_cylinder_y(q + Vec3::new(0.0, 0.18, 0.0), 0.12, 0.10);
    bracket.max(-scoop + 0.03)
}

fn footing_sdf(p: Vec3, m: &CastleModule) -> f32 {
    let pad = |cx: f32, r: f32| {
        let q = p - Vec3::new(cx, -0.02, 0.0);
        let n = ((q.x * 3.1).sin() * (q.z * 2.7).cos()) * 0.04;
        sd_cylinder_y(q - Vec3::new(0.0, n, 0.0), r, 0.10 + n.abs())
    };
    let tl = pad(-m.tower_sep, m.tower_r * 1.18);
    let tr = pad(m.tower_sep, m.tower_r * 1.18);
    let mid = sd_box(
        p - Vec3::new(0.0, -0.02, 0.0),
        Vec3::new(m.tower_sep * 0.85, 0.08, m.wall_half.z * 1.25),
    );
    tl.min(tr).min(mid)
}

fn tower_sdf(p: Vec3, cx: f32, m: &CastleModule) -> f32 {
    let local = p - Vec3::new(cx, 0.0, 0.0);
    let flare = 1.0 + (1.0 - (local.y / 0.55).clamp(0.0, 1.0)) * 0.10;
    let outer_r = m.tower_r * flare;
    let shaft_outer = sd_cylinder_y(
        local - Vec3::new(0.0, m.tower_h * 0.5, 0.0),
        outer_r,
        m.tower_h * 0.5,
    );
    let inner_r = (m.tower_r - m.wall_shell).max(0.18);
    let cavity = sd_cylinder_y(
        local - Vec3::new(0.0, m.tower_h * 0.5 + 0.12, 0.0),
        inner_r,
        m.tower_h * 0.5 - 0.18,
    );
    let floor = sd_cylinder_y(local - Vec3::new(0.0, 0.12, 0.0), inner_r + 0.02, 0.10);
    let mut body = shaft_outer.max(-cavity);
    body = smin(body, floor, 0.02);

    let crown_y = m.tower_h - m.crown_h * 0.12;
    let crown = sd_cylinder_y(
        local - Vec3::new(0.0, crown_y + m.crown_h * 0.38, 0.0),
        m.crown_r,
        m.crown_h * 0.48,
    );
    let lip = sd_cylinder_y(
        local - Vec3::new(0.0, crown_y + 0.04, 0.0),
        m.crown_r * 0.98,
        0.07,
    );
    body = smin(body, crown, 0.045);
    body = smin(body, lip, 0.03);
    body = smin(body, corbel_ring(local, crown_y + 0.01, m.crown_r * 0.86, 20.0), 0.02);

    let slit_y = m.tower_h * 0.48; // mid-span like reference wall piece
    let slit_outer = sd_box(
        local - Vec3::new(0.0, slit_y, m.tower_r * 0.50),
        Vec3::new(0.10, 0.55, m.tower_r * 0.85),
    );
    let slit_inner = sd_box(
        local - Vec3::new(0.0, slit_y, 0.05),
        Vec3::new(0.22, 0.65, inner_r + 0.08),
    );
    body = body.max(-slit_outer).max(-slit_inner);

    let bat_y = m.tower_h + m.crown_h * 0.42;
    let bat = battlement_ring_y(
        local,
        bat_y,
        m.crown_r * 0.70,
        m.crown_r * 1.04,
        m.battlement,
        m.merlon_w,
        m.merlon_gap,
    );
    let walk = sd_cylinder_y(
        local - Vec3::new(0.0, bat_y + 0.02, 0.0),
        m.crown_r * 0.92,
        0.05,
    );
    body = smin(body, walk, 0.02);
    smin(body, bat, 0.025)
}

/// Sloping exterior buttresses on +Z (outward face after wall yaw).
fn exterior_buttresses(p: Vec3, m: &CastleModule) -> f32 {
    let span = (m.tower_sep - m.tower_r * 0.85).max(0.8);
    // Three piers on the long curtain so the span does not read empty.
    let xs = [-span * 0.55, 0.0, span * 0.55];
    let mut d = 1e3_f32;
    let h = m.wall_half.y * 1.35;
    for &cx in &xs {
        let y = p.y.clamp(0.0, h);
        let taper = 1.0 - (y / h.max(1e-3)).clamp(0.0, 1.0) * 0.55;
        let hx = 0.28 * taper;
        let hz = 0.58 * taper;
        let pier = sd_box(
            p - Vec3::new(cx, h * 0.48, m.wall_half.z + hz * 0.72),
            Vec3::new(hx, h * 0.48, hz),
        );
        d = d.min(pier);
    }
    d
}

/// Solid curtain with hollow gallery + centre arrow slit (window into interior).
fn curtain_solid_sdf(p: Vec3, m: &CastleModule) -> f32 {
    let wall = sd_box(p - Vec3::new(0.0, m.wall_half.y, 0.0), m.wall_half);
    // Hollow walk gallery inside the curtain so the wall slit has an interior.
    let gal_half = Vec3::new(
        (m.wall_half.x - m.gallery_shell).max(0.2),
        (m.wall_half.y - m.gallery_shell * 1.2).max(0.35),
        (m.wall_half.z - m.gallery_shell).max(0.12),
    );
    let gallery = sd_box(
        p - Vec3::new(0.0, m.wall_half.y + 0.06, 0.0),
        gal_half,
    );
    let mut body = wall.max(-gallery);

    // Centre arrow slit through both faces into the gallery.
    let slit_y = m.wall_half.y * 1.05;
    let slit = sd_box(
        p - Vec3::new(0.0, slit_y, 0.0),
        Vec3::new(0.10, 0.55, m.wall_half.z + 0.35),
    );
    let slit_splay = sd_box(
        p - Vec3::new(0.0, slit_y, 0.0),
        Vec3::new(0.22, 0.65, gal_half.z + 0.08),
    );
    body = body.max(-slit).max(-slit_splay);

    // Courtyard-side postern cue (−Z): small doorway into the hollow gallery.
    let postern = sd_box(
        p - Vec3::new(0.0, 1.15, -m.wall_half.z * 0.20),
        Vec3::new(0.42, 1.15, m.wall_half.z + 0.35),
    );
    body = body.max(-postern);

    let top_y = m.wall_half.y * 2.0;
    let span = m.tower_sep - m.tower_r * 0.75;
    let parapet = sd_box(
        p - Vec3::new(0.0, top_y + 0.07, 0.0),
        Vec3::new(span * 0.96, 0.09, m.wall_half.z * 1.20),
    );
    let bat = battlement_line_x(
        p,
        top_y + 0.02,
        -span,
        span,
        0.0,
        m.wall_half.z * 1.55,
        m.battlement,
        m.merlon_w,
        m.merlon_gap,
    );
    let cor_f = corbel_line_x(p, top_y - 0.02, -span * 0.95, span * 0.95, m.wall_half.z * 0.95);
    let cor_b = corbel_line_x(p, top_y - 0.02, -span * 0.95, span * 0.95, -m.wall_half.z * 0.95);
    body = smin(body, parapet, 0.03);
    body = smin(body, cor_f, 0.02);
    body = smin(body, cor_b, 0.02);
    body = smin(body, exterior_buttresses(p, m), 0.04);
    smin(body, bat, 0.02)
}

/// Single curtain-wall bay at local origin (towers at ±tower_sep).
pub fn curtain_wall_sdf(p: Vec3, m: &CastleModule) -> f32 {
    let tl = tower_sdf(p, -m.tower_sep, m);
    let tr = tower_sdf(p, m.tower_sep, m);
    let wall = curtain_solid_sdf(p, m);
    let foot = footing_sdf(p, m);
    let mut d = tl.min(tr);
    d = smin(d, wall, 0.07);
    smin(d, foot, 0.05)
}

/// Weathered grimdark stone attribute (0..1) for the curtain bay.
pub fn curtain_wall_mat(p: Vec3, m: &CastleModule) -> f32 {
    // Darker inside tower / gallery cavities
    let inner_r = (m.tower_r - m.wall_shell).max(0.18);
    for sx in [-m.tower_sep, m.tower_sep] {
        let local = p - Vec3::new(sx, 0.0, 0.0);
        if Vec2::new(local.x, local.z).length() < inner_r + 0.04
            && local.y > 0.2
            && local.y < m.tower_h - 0.3
        {
            return 0.28;
        }
    }
    let crack = ((p.x * 11.0).sin() * (p.y * 8.5).cos() * (p.z * 9.0).sin()).abs();
    let moss = ((p.y * 0.35).sin().abs()) * ((p.x * 4.2).sin() * 0.5 + 0.5);
    let base = 0.38 + 0.18 * crack + 0.12 * (p.y / m.tower_h).clamp(0.0, 1.0);
    // Low moss lift near base
    base + 0.08 * moss * (1.0 - (p.y / 1.2).clamp(0.0, 1.0))
}

pub fn curtain_stone_rgb(m: f32) -> [f32; 3] {
    let m = m.clamp(0.0, 1.0);
    // Cool grey ashlar (matches ROCK / ROCK_L palette — not warm beige WALL).
    let u = m;
    [
        0.38 + 0.28 * u,
        0.36 + 0.26 * u,
        0.33 + 0.24 * u,
    ]
}

/// Generative wall: union of bays along X with shared tower pitch.
pub fn castle_wall_sdf(p: Vec3, m: &CastleModule, bays: &[CastleBay]) -> f32 {
    let pitch = m.pitch();
    let mut d = 1e3;
    for (i, bay) in bays.iter().enumerate() {
        let ox = i as f32 * pitch;
        let local = p - Vec3::new(ox, 0.0, 0.0);
        let part = match bay {
            CastleBay::Curtain => curtain_wall_sdf(local, m),
            CastleBay::Gate { door_open } => {
                let g = m.to_gatehouse(*door_open);
                gatehouse_sdf(local, &g)
            }
        };
        d = if i == 0 { part } else { smin(d, part, 0.06) };
    }
    d
}

pub fn castle_wall_mat(p: Vec3, m: &CastleModule, bays: &[CastleBay]) -> f32 {
    let pitch = m.pitch();
    // Prefer gatehouse wood mat when near a gate bay door.
    for (i, bay) in bays.iter().enumerate() {
        let ox = i as f32 * pitch;
        let local = p - Vec3::new(ox, 0.0, 0.0);
        match bay {
            CastleBay::Gate { door_open } => {
                let g = m.to_gatehouse(*door_open);
                let mat = gatehouse_mat(local, &g);
                if mat < 0.25 {
                    return mat;
                }
            }
            CastleBay::Curtain => {}
        }
    }
    curtain_wall_mat(p, m)
}

/// World AABB for a bay run (for meshing).
pub fn castle_wall_bounds(m: &CastleModule, bay_count: usize, door_pad: f32) -> (Vec3, Vec3) {
    let n = bay_count.max(1) as f32;
    let last = (n - 1.0) * m.pitch();
    let x0 = -m.tower_sep - m.tower_r * 1.3;
    let x1 = last + m.tower_sep + m.tower_r * 1.3;
    let z = 1.75_f32.max(m.wall_half.z + 1.05 + door_pad);
    let top = m.tower_h + m.crown_h + m.battlement + 0.35;
    (
        Vec3::new(x0, -0.22, -z),
        Vec3::new(x1, top, z),
    )
}

/// Parse a compact bay string: `curtain`, `gate`, `gate:0.85`, comma-separated.
pub fn parse_bays(spec: &str) -> Result<Vec<CastleBay>, String> {
    let mut out = Vec::new();
    for raw in spec.split(',') {
        let tok = raw.trim().to_ascii_lowercase();
        if tok.is_empty() {
            continue;
        }
        if tok == "curtain" || tok == "wall" {
            out.push(CastleBay::Curtain);
        } else if tok == "gate" || tok == "gatehouse" {
            out.push(CastleBay::Gate { door_open: 0.0 });
        } else if let Some(rest) = tok.strip_prefix("gate:") {
            let open: f32 = rest
                .parse()
                .map_err(|_| format!("bad gate open amount: {rest}"))?;
            out.push(CastleBay::Gate {
                door_open: open.clamp(0.0, 1.0),
            });
        } else {
            return Err(format!(
                "unknown bay '{tok}' (use curtain | gate | gate:0.85)"
            ));
        }
    }
    if out.is_empty() {
        return Err("need at least one bay".into());
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pitch_shares_tower_axes() {
        let m = CastleModule::default();
        let (_a_l, a_r) = m.tower_xs(0.0);
        let (b_l, _b_r) = m.tower_xs(m.pitch());
        assert!((a_r - b_l).abs() < 1e-5, "shared tower {a_r} vs {b_l}");
        assert!((m.pitch() - 2.0 * m.tower_sep).abs() < 1e-5);
    }

    #[test]
    fn curtain_wall_solid_and_slit() {
        let m = CastleModule::default();
        // Outer curtain face away from postern / gallery (sample mid-bay shell).
        let shell = curtain_wall_sdf(Vec3::new(0.55, 1.5, m.wall_half.z - 0.02), &m);
        assert!(shell < 0.0, "curtain shell d={shell}");
        let slit = curtain_wall_sdf(Vec3::new(0.0, m.wall_half.y * 1.05, m.wall_half.z * 0.5), &m);
        assert!(slit > -0.05, "wall slit passage d={slit}");
        let buttress = curtain_wall_sdf(
            Vec3::new(0.0, m.wall_half.y * 0.55, m.wall_half.z + 0.35),
            &m,
        );
        assert!(buttress < 0.05, "exterior buttress d={buttress}");
    }

    #[test]
    fn pitch_matches_kit_snap() {
        let m = CastleModule::default();
        assert!((m.pitch() - 7.92).abs() < 1e-5, "pitch={}", m.pitch());
    }

    #[test]
    fn tower_cavity_empty() {
        let m = CastleModule::default();
        let d = curtain_wall_sdf(Vec3::new(-m.tower_sep, m.tower_h * 0.45, 0.0), &m);
        assert!(d > 0.0, "cavity d={d}");
    }

    #[test]
    fn compose_two_curtains_merges() {
        let m = CastleModule::default();
        let bays = [CastleBay::Curtain, CastleBay::Curtain];
        // Shared tower axis — sample mid-shell away from slits.
        let mid_r = m.tower_r - m.wall_shell * 0.55;
        let d = castle_wall_sdf(
            Vec3::new(m.tower_sep, m.tower_h * 0.35, mid_r),
            &m,
            &bays,
        );
        assert!(d < 0.0, "shared tower shell d={d}");
        // Far from run should still be outside.
        let far = castle_wall_sdf(Vec3::new(20.0, 2.0, 20.0), &m, &bays);
        assert!(far > 1.0, "far d={far}");
    }

    #[test]
    fn parse_bays_ok() {
        let b = parse_bays("curtain,gate:0.5,curtain").unwrap();
        assert_eq!(b.len(), 3);
        assert!(matches!(b[1], CastleBay::Gate { door_open } if (door_open - 0.5).abs() < 1e-5));
    }
}
