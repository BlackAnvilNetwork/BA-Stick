// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Height-aware iso ground: painter's-order quads over the baked zone grid.
use stick_engine::camera::{Camera, P2, View, HEIGHT_PX, ISO_Y, NEAR};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;

use crate::palette::*;
use crate::zone::*;

// Shared with weather.rs (snow cover) from the phc-local-wip 3D ground path.
/// Skip a ground quad only when every corner is behind the near plane (3D).
#[inline]
pub(crate) fn quad_all_culled(a: P2, b: P2, c: P2, d: P2) -> bool {
    a.culled() && b.culled() && c.culled() && d.culled()
}

/// True when the quad's screen bounds miss the framebuffer (iso + 3D).
#[inline]
pub(crate) fn quad_off_screen(fb: &Framebuffer, a: P2, b: P2, c: P2, d: P2) -> bool {
    let min_y = a.y.min(b.y).min(c.y).min(d.y);
    let max_y = a.y.max(b.y).max(c.y).max(d.y);
    let min_x = a.x.min(b.x).min(c.x).min(d.x);
    let max_x = a.x.max(b.x).max(c.x).max(d.x);
    max_y < -2.0 || min_y > fb.h as f32 + 2.0 || max_x < -2.0 || min_x > fb.w as f32 + 2.0
}

/// Near-plane cull returns (0, 0); never rasterize a tri that includes such a vertex.
#[inline]
pub(crate) fn tri_ok(a: P2, b: P2, c: P2) -> bool {
    !a.culled() && !b.culled() && !c.culled()
}

/// CamRig third- / first-person (not iso, not legacy `persp` blend on `view == None`).
#[inline]
pub(crate) fn perspective_ground(cam: &Camera) -> Option<View> {
    cam.view.filter(|v| v.inv_d > 0.0)
}

#[inline]
fn eye_dist(v: &View, p: Vec3) -> f32 {
    if v.inv_d <= 0.0 {
        return f32::INFINITY;
    }
    let q = p - v.target;
    let z = q.dot(v.fwd());
    1.0 / v.inv_d + z
}

const NEAR_GROUND: f32 = NEAR + 0.02;

#[inline]
fn lerp_v3(a: Vec3, b: Vec3, t: f32) -> Vec3 {
    a + (b - a) * t
}

#[inline]
fn lerp_uv(a: (f32, f32), b: (f32, f32), t: f32) -> (f32, f32) {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
}

/// Clip a convex polygon to points at or beyond the perspective near plane.
fn clip_poly_near_uv(v: &View, input: &[(Vec3, (f32, f32))]) -> Vec<(Vec3, (f32, f32))> {
    if v.inv_d <= 0.0 || input.len() < 3 {
        return input.to_vec();
    }
    let mut output = Vec::new();
    let n = input.len();
    let mut s = input[n - 1];
    let mut ds = eye_dist(v, s.0);
    for e in input {
        let de = eye_dist(v, e.0);
        let (s_in, e_in) = (ds >= NEAR_GROUND, de >= NEAR_GROUND);
        if e_in {
            if !s_in {
                let t = (NEAR_GROUND - ds) / (de - ds);
                output.push((lerp_v3(s.0, e.0, t), lerp_uv(s.1, e.1, t)));
            }
            output.push(*e);
        } else if s_in {
            let t = (NEAR_GROUND - ds) / (de - ds);
            output.push((lerp_v3(s.0, e.0, t), lerp_uv(s.1, e.1, t)));
        }
        s = *e;
        ds = de;
    }
    output
}

fn fan_tris_uv(poly: &[(Vec3, (f32, f32))]) -> Vec<[(Vec3, (f32, f32)); 3]> {
    if poly.len() < 3 {
        return Vec::new();
    }
    (1..poly.len() - 1)
        .map(|i| [poly[0], poly[i], poly[i + 1]])
        .collect()
}

pub(crate) fn project_tri_plain(fb: &mut Framebuffer, cam: &Camera, v: &View, tri: [Vec3; 3], col: u8) {
    let (a, b, c) = (cam.project(tri[0]), cam.project(tri[1]), cam.project(tri[2]));
    if tri_ok(a, b, c) {
        fill_tri(fb, a, b, c, col);
        return;
    }
    let poly = clip_poly_near_uv(v, &tri.map(|p| (p, (0.0, 0.0))));
    for t in fan_tris_uv(&poly) {
        let (a, b, c) = (cam.project(t[0].0), cam.project(t[1].0), cam.project(t[2].0));
        if tri_ok(a, b, c) {
            fill_tri(fb, a, b, c, col);
        }
    }
}


/// Fill a triangle into the colour buffer (no depth).
pub fn fill_tri(fb: &mut Framebuffer, a: P2, b: P2, c: P2, col: u8) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb.w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb.h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-6 {
        return;
    }
    let s = area.signum();
    let w = fb.w;
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)) * s;
            let w1 = ((c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x)) * s;
            let w2 = ((a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x)) * s;
            if w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0 {
                fb.color[y as usize * w + x as usize] = col;
            }
        }
    }
}

/// Biome-edge band (B1): fraction of the cell, from each edge, that dithers
/// toward a differing neighbour biome. 0.5 = half-cell.
pub const EDGE_BAND: f32 = 0.5;
/// Neighbour coverage at the shared edge (fades to 0 across the band).
pub const EDGE_MAX: f32 = 0.5;

/// W1 water tones (existing WATER ramp: 70 dark, 71 mid, 72 light).
pub const WATER_DEEP: u8 = WATER;
pub const WATER_BODY: u8 = WATER + 1;
pub const WATER_FOAM: u8 = WATER + 2;
/// W2/W3 shoreline band (fraction of a cell) and coverage at the bank.
pub const SHORE_BAND: (f32, f32) = (0.3, 0.7);
/// SE-bank foam reaches half a cell so it still reads at 3× upscale.
pub const FOAM_BAND: f32 = 0.5;

/// Low-frequency swell phase: a hash per 4×4-cell block, bilinearly blended
/// so neighbouring blocks don't seam. Phase only: a per-block speed would make
/// the field drift apart over time.
pub fn swell_phase(i: i32, j: i32) -> f32 {
    let (bi, bj) = (i.div_euclid(4), j.div_euclid(4));
    let (fi, fj) = (i.rem_euclid(4) as f32 / 4.0, j.rem_euclid(4) as f32 / 4.0);
    let r = |a: i32, b: i32| (cell_hash(a, b) & 0xffff) as f32 / 65535.0;
    let lerp = |a: f32, b: f32, t: f32| a + (b - a) * t;
    let v = lerp(lerp(r(bi, bj), r(bi + 1, bj), fi), lerp(r(bi, bj + 1), r(bi + 1, bj + 1), fi), fj);
    v * std::f32::consts::TAU * 0.6
}

/// Land (not water, not bridge) at (i, j). Out of bounds counts as water.
#[inline]
fn land(z: &Zone, i: i32, j: i32) -> bool {
    if i < 0 || j < 0 || i >= z.w as i32 || j >= z.h as i32 {
        return false;
    }
    z.flags[z.idx(i, j)] & (F_WATER | F_BRIDGE) == 0
}

/// B3: trail↔ground edges dither over a narrower band on each side.
pub const TRAIL_BAND: (f32, f32) = (0.25, 0.5);

#[inline]
fn is_trail(c: u8) -> bool {
    (TRAIL_DIRT..TRAIL_DIRT + 3).contains(&c) || (TRAIL_STONE..TRAIL_STONE + 3).contains(&c)
}

/// Trail kind of a cell: Some(ramp base) for a plain trail cell.
fn trail_base(z: &Zone, i: i32, j: i32) -> Option<u8> {
    if i < 0 || j < 0 || i >= z.w as i32 || j >= z.h as i32 {
        return None;
    }
    let f = z.flags[z.idx(i, j)];
    if f & (F_WATER | F_BRIDGE) != 0 || f & F_TRAIL == 0 {
        return None;
    }
    Some(if f & F_STONE != 0 { TRAIL_STONE } else { TRAIL_DIRT })
}

/// Plain biome (no water / trail / bridge flag) at (i, j), or None.
#[inline]
fn plain_biome(z: &Zone, i: i32, j: i32) -> Option<u8> {
    if i < 0 || j < 0 || i >= z.w as i32 || j >= z.h as i32 {
        return None;
    }
    let k = z.idx(i, j);
    if z.flags[k] & (F_WATER | F_TRAIL | F_BRIDGE) != 0 {
        return None;
    }
    Some(z.biome[k].min(15))
}

/// Triangle fill with a per-pixel biome-edge dither. `uv*` are cell-local
/// (0..1) coords of each vertex; `nb` holds the neighbour colour across the
/// -i, +i, -j, +j edges (None = same biome or not plain ground). `org` anchors
/// the dither pattern to the world so it does not swim when the camera pans.
#[allow(clippy::too_many_arguments)]
fn fill_tri_edge(fb: &mut Framebuffer, a: P2, b: P2, c: P2, ua: (f32, f32), ub: (f32, f32), uc: (f32, f32), own: u8, nb: [Option<u8>; 4], org: (i32, i32), band: (f32, f32)) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb.w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb.h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-6 {
        return;
    }
    let inv = 1.0 / area;
    let w = fb.w;
    let (edge_band, k) = (band.0, band.1 / band.0);
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 < 0.0 || w1 < 0.0 || w2 < 0.0 {
                continue;
            }
            let u = w0 * ua.0 + w1 * ub.0 + w2 * uc.0;
            let v = w0 * ua.1 + w1 * ub.1 + w2 * uc.1;
            let (mut best, mut col) = (0.0f32, own);
            for (n, d) in nb.iter().zip([u, 1.0 - u, v, 1.0 - v]) {
                if let Some(nc) = n {
                    let eb = if *nc == WATER_FOAM {
                        FOAM_BAND
                    } else if is_trail(*nc) {
                        TRAIL_BAND.0.min(edge_band)
                    } else {
                        edge_band
                    };
                    let cov = (eb - d) * k;
                    if cov > best {
                        best = cov;
                        col = *nc;
                    }
                }
            }
            fb.color[y as usize * w + x as usize] =
                if best > 0.0 && crate::dither::on(x - org.0, y - org.1, best) { col } else { own };
        }
    }
}

/// Trail triangle. `own` is cobble at the pixel's world position; the edge
/// band still dithers toward the neighbouring ground.
#[allow(clippy::too_many_arguments)]
fn fill_tri_cobble(
    fb: &mut Framebuffer,
    a: P2,
    b: P2,
    c: P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    origin: (f32, f32),
    cell: f32,
    ij: (i32, i32),
    shade: u8,
    nb: [Option<u8>; 4],
    org: (i32, i32),
) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb.w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb.h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-6 {
        return;
    }
    let inv = 1.0 / area;
    let w = fb.w;
    let (edge_band, k) = (TRAIL_BAND.0, TRAIL_BAND.1 / TRAIL_BAND.0);
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 < 0.0 || w1 < 0.0 || w2 < 0.0 {
                continue;
            }
            let u = w0 * ua.0 + w1 * ub.0 + w2 * uc.0;
            let v = w0 * ua.1 + w1 * ub.1 + w2 * uc.1;
            let (mut best, mut col) = (0.0f32, 0u8);
            for (n, d) in nb.iter().zip([u, 1.0 - u, v, 1.0 - v]) {
                if let Some(nc) = n {
                    let cov = (edge_band - d) * k;
                    if cov > best {
                        best = cov;
                        col = *nc;
                    }
                }
            }
            let stone = cobble(origin.0 + (ij.0 as f32 + u) * cell, origin.1 + (ij.1 as f32 + v) * cell, shade);
            fb.color[y as usize * w + x as usize] =
                if best > 0.0 && crate::dither::on(x - org.0, y - org.1, best) { col } else { stone };
        }
    }
}

/// L1 thresholds on n·SUN_DIR (flat ground = SUN_DIR.y ≈ 0.707 → mid).
pub const SHADE_LIT: f32 = 0.78;
pub const SHADE_DARK: f32 = 0.62;

/// Terrain shade step against `SUN_DIR`: 0 lit, 1 mid, 2 shadow. Quantised to
/// one normal per 2×2-cell block (1 m at 0.5 m cells) so bands follow the
/// terrain instead of reading as per-cell blotches (round 2 ART).
pub fn slope_shade(z: &Zone, i: i32, j: i32) -> u8 {
    let bi = (i & !1).min(z.w as i32 - 3).max(0);
    let bj = (j & !1).min(z.h as i32 - 3).max(0);
    let h = |a: i32, b: i32| z.height[z.idx(a, b)];
    let (h00, h10, h01, h11) = (h(bi, bj), h(bi + 2, bj), h(bi, bj + 2), h(bi + 2, bj + 2));
    let c = z.cell * 2.0;
    let gx = ((h10 - h00) + (h11 - h01)) * 0.5 / c;
    let gz = ((h01 - h00) + (h11 - h10)) * 0.5 / c;
    let inv = 1.0 / (gx * gx + 1.0 + gz * gz).sqrt();
    let s = crate::atmosphere::SUN_DIR;
    let d = (-gx * s[0] + s[1] - gz * s[2]) * inv;
    if d > SHADE_LIT { 0 } else if d < SHADE_DARK { 2 } else { 1 }
}

/// B4: roughly 1 in 12 plain cells gets a 2-px darker fleck (fixed hash).
pub const FLECK_EVERY: u32 = 12;

/// Stone pitch in metres. A 3.3 m road is about six stones across.
const COBBLE_PITCH: f32 = 0.56;

/// Irregular cobbles in world space. Grout sits on the +x and +z side of each
/// stone so the line is drawn once; the neighbour's body starts on the other
/// side of that line. Rows stagger by half a stone.
pub fn cobble(wx: f32, wz: f32, shade: u8) -> u8 {
    const STONES: [u8; 8] = [ROCK_D, WOOD, BEIGE_D, WALL_D, ROCK, WOOD_L, WALL, BEIGE];
    let gz = wz / COBBLE_PITCH;
    let row = gz.floor() as i32;
    let fz = gz - row as f32;
    let stagger = if row & 1 == 0 { 0.0 } else { 0.5 };
    let gx = wx / COBBLE_PITCH + stagger;
    let col = gx.floor() as i32;
    let fx = gx - col as f32;
    let h = cell_hash(col, row);
    let inset_x = 0.09 + ((h >> 4) & 3) as f32 * 0.012;
    let inset_z = 0.09 + ((h >> 6) & 3) as f32 * 0.012;
    // A few joints open so two stones read as one longer block.
    let open_x = cell_hash(col, row.wrapping_mul(3)) % 7 == 0;
    let open_z = cell_hash(col.wrapping_mul(3), row) % 7 == 0;
    if (fx > 1.0 - inset_x && !open_x) || (fz > 1.0 - inset_z && !open_z) {
        return CR_NOSE;
    }
    let mut idx = ((h >> 10) as usize) % STONES.len();
    if fx < 0.2 && fz < 0.26 {
        idx = (idx + 2).min(STONES.len() - 1);
    } else if fx > 0.78 || fz > 0.72 {
        idx = idx.saturating_sub(1);
    }
    idx = match shade {
        0 => (idx + 1).min(STONES.len() - 1),
        2 => idx.saturating_sub(2),
        _ => idx,
    };
    STONES[idx]
}

#[inline]
pub(crate) fn cell_hash(i: i32, j: i32) -> u32 {
    let mut h = (i as u32).wrapping_mul(0x9E37_79B1) ^ (j as u32).wrapping_mul(0x85EB_CA77);
    h ^= h >> 15;
    h = h.wrapping_mul(0x2C1B_3C6D);
    h ^ (h >> 12)
}

fn cell_color(z: &Zone, i: i32, j: i32, _time: f32, shade: u8) -> u8 {
    let k = z.idx(i, j);
    let f = z.flags[k];
    if f & F_WATER != 0 {
        return WATER_BODY;
    }
    if f & F_BRIDGE != 0 {
        return TRAIL_STONE + shade;
    }
    if f & F_TRAIL != 0 {
        return if f & F_STONE != 0 { TRAIL_STONE + shade } else { TRAIL_DIRT + shade };
    }
    let b = z.biome[k].min(15);
    BIOME0 + b * 3 + shade
}

/// Cells of `zone` that can appear on screen. Quads need a neighbour, so the
/// span stops one cell short of the grid edge.
/// World rect (x0, x1, z0, z1, padded) of the detailed ground pass.
fn detail_world_rect(fb: &Framebuffer, cam: &Camera) -> (f32, f32, f32, f32) {
    let margin_m = 4.0 + 12.0 * HEIGHT_PX / ISO_Y / 2.0;
    let corners = [(0.0, 0.0), (fb.w as f32, 0.0), (0.0, fb.h as f32), (fb.w as f32, fb.h as f32)];
    let (mut x0, mut x1, mut z0, mut z1) = (f32::MAX, f32::MIN, f32::MAX, f32::MIN);
    for (sx, sy) in corners {
        let (x, z) = cam.unproject_ground(sx, sy);
        x0 = x0.min(x);
        x1 = x1.max(x);
        z0 = z0.min(z);
        z1 = z1.max(z);
    }
    // 3D: screen-corner unprojection is unreliable (corners above the horizon
    // collapse to the camera centre; steep or wide views clip the near ground),
    // so the detailed pass covers a fixed square around the ground just ahead
    // of the eye instead. Ground past it is the coarse far pass. While the eye
    // is still far out (iso -> tp dolly) centre on the followed target.
    if let Some(v) = cam.view {
        let r = 22.0;
        let (mut mx, mut mz) = (cam.cx, cam.cz);
        if let Some(eye) = v.eye() {
            let (dx, dz) = (eye.x - v.target.x, eye.z - v.target.z);
            if dx * dx + dz * dz < 20.0 * 20.0 {
                let f = v.fwd();
                let fl = (f.x * f.x + f.z * f.z).sqrt().max(1e-4);
                mx = eye.x + f.x / fl * 8.0;
                mz = eye.z + f.z / fl * 8.0;
            }
        }
        x0 = mx - r;
        x1 = mx + r;
        z0 = mz - r;
        z1 = mz + r;
    }
    let pad = if cam.view.is_some() { 2.0 } else { margin_m };
    (x0 - pad, x1 + pad, z0 - pad, z1 + pad)
}

/// World rect any ground of a zone can be drawn in this frame: the detail
/// rect in iso, the far-pass square around the eye in 3D. Zones outside it
/// are skipped by the multi-zone world path.
pub(crate) fn view_world_rect(fb: &Framebuffer, cam: &Camera) -> (f32, f32, f32, f32) {
    if let Some(v) = cam.view {
        let c = v.eye().unwrap_or(v.target);
        let r = stick_engine::camera::FAR + 2.0;
        return (c.x - r, c.x + r, c.z - r, c.z + r);
    }
    detail_world_rect(fb, cam)
}

#[inline]
pub(crate) fn zone_overlaps_world_rect(zone: &Zone, x0: f32, x1: f32, z0: f32, z1: f32) -> bool {
    let (zx0, zz0) = (zone.min_x, zone.min_z);
    let (zx1, zz1) = (zone.min_x + zone.w as f32 * zone.cell, zone.min_z + zone.h as f32 * zone.cell);
    x0 <= zx1 && x1 >= zx0 && z0 <= zz1 && z1 >= zz0
}

/// Cells of `zone` in the detailed pass. Quads need a neighbour, so the
/// span stops one cell short of the grid edge.
pub(crate) fn view_cells(fb: &Framebuffer, cam: &Camera, zone: &Zone) -> Option<(i32, i32, i32, i32)> {
    let (x0, x1, z0, z1) = detail_world_rect(fb, cam);
    let (i0, j0) = zone.cell_of(x0, z0);
    let (i1, j1) = zone.cell_of(x1, z1);
    let i0 = i0.max(0);
    let j0 = j0.max(0);
    let i1 = i1.min(zone.w as i32 - 2);
    let j1 = j1.min(zone.h as i32 - 2);
    if i0 > i1 || j0 > j1 { None } else { Some((i0, j0, i1, j1)) }
}

/// Green ground in `BIOMES` (bake-zones.ts): vine cliff, grass, meadow.
pub(crate) const GREEN_GROUND: [u8; 3] = [9, 13, 15];

/// 0 between gusts, up to 1 at the peak of one. The two clocks are not
/// harmonics, so the quiet gaps come at uneven times.
fn grass_gust(time: f32) -> f32 {
    let raw = (time * 0.47).sin() * (time * 0.19 + 1.3).sin();
    ((raw - 0.28) * 2.4).clamp(0.0, 1.0)
}

fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn hash01(i: i32, j: i32) -> f32 {
    (cell_hash(i, j) & 1023) as f32 / 1023.0
}

/// Four surrounding lattice greens, eased so a patch holds its colour in the
/// middle and only changes as it approaches the next one.
fn value_noise(x: f32, z: f32) -> f32 {
    let x0 = x.floor() as i32;
    let z0 = z.floor() as i32;
    let fx = smoothstep(x - x0 as f32);
    let fz = smoothstep(z - z0 as f32);
    let v00 = hash01(x0, z0);
    let v10 = hash01(x0 + 1, z0);
    let v01 = hash01(x0, z0 + 1);
    let v11 = hash01(x0 + 1, z0 + 1);
    v00 * (1.0 - fx) * (1.0 - fz)
        + v10 * fx * (1.0 - fz)
        + v01 * (1.0 - fx) * fz
        + v11 * fx * fz
}

/// Blade clearance from the smoothed water edge (m): the drawn shore spills
/// past the cell grid, so a blade must stand this far inside the dry side.
const BLADE_SHORE: f32 = 0.35;

/// Ground height under a blade at (x, z), or None if the blade would stand in
/// or at the water (wet cell, inside the smoothed shore, or at water level).
#[inline]
fn dry_blade(zone: &Zone, water: Option<&crate::pixel_water::WaterField>, x: f32, z: f32) -> Option<f32> {
    if wet_world(zone, x, z) {
        return None;
    }
    if let Some(f) = water {
        if f.sample(x, z).sdist > -BLADE_SHORE {
            return None;
        }
    }
    let fx = (x - zone.min_x) / zone.cell;
    let fz = (z - zone.min_z) / zone.cell;
    let (i, j) = (fx.floor() as i32, fz.floor() as i32);
    let (a, b) = (fx - i as f32, fz - j as f32);
    Some(
        shore_height(zone, i, j) * (1.0 - a) * (1.0 - b)
            + shore_height(zone, i + 1, j) * a * (1.0 - b)
            + shore_height(zone, i, j + 1) * (1.0 - a) * b
            + shore_height(zone, i + 1, j + 1) * a * b,
    )
}

fn wet_world(zone: &Zone, x: f32, z: f32) -> bool {
    let i = ((x - zone.min_x) / zone.cell).floor() as i32;
    let j = ((z - zone.min_z) / zone.cell).floor() as i32;
    wet(zone, i, j)
}

fn grass_cell(zone: &Zone, i: i32, j: i32) -> bool {
    if i < 0 || j < 0 || i >= zone.w as i32 || j >= zone.h as i32 {
        return false;
    }
    let k = zone.idx(i, j);
    if !GREEN_GROUND.contains(&zone.biome[k]) {
        return false;
    }
    if zone.flags[k] & (F_WATER | F_BRIDGE | F_TRAIL) != 0 {
        return false;
    }
    if grass_steep(zone, i, j) {
        return false;
    }
    for (di, dj) in DIRS_8 {
        if wet(zone, i + di, j + dj) {
            return false;
        }
    }
    true
}

const DIRS_8: [(i32, i32); 8] = [
    (-1, 0),
    (1, 0),
    (0, -1),
    (0, 1),
    (-1, -1),
    (1, -1),
    (-1, 1),
    (1, 1),
];

/// True where the ground is a cut face or cliff (rise over a cell beside it > 0.9 per m).
fn grass_steep(zone: &Zone, i: i32, j: i32) -> bool {
    let h = |a: i32, b: i32| zone.height[zone.idx(a.clamp(0, zone.w as i32 - 1), b.clamp(0, zone.h as i32 - 1))];
    let c = h(i, j);
    let m = (h(i + 1, j) - c).abs().max((h(i - 1, j) - c).abs()).max((h(i, j + 1) - c).abs()).max((h(i, j - 1) - c).abs());
    m > 0.9 * zone.cell
}

/// 0..6 along the meadow ramp. A broad octave sets the patch, a finer one
/// drifts it, and a slow pocket pulls the top of the ramp into blue-green.
#[inline(always)]
fn grass_field(i: i32, j: i32) -> f32 {
    let x = i as f32 / 12.0;
    let z = j as f32 / 12.0;
    let n = value_noise(x * 0.45, z * 0.45) * 0.7 + value_noise(x, z) * 0.3;
    let green = n * 5.0;
    let pocket = value_noise(x * 0.35 + 9.0, z * 0.35 - 4.0);
    if pocket > 0.68 {
        let k = ((pocket - 0.68) / 0.32).clamp(0.0, 1.0);
        green * (1.0 - k) + 6.0 * k
    } else {
        green
    }
}

#[inline(always)]
fn grass_blade_color(cols: &[u8; 7], i: i32, j: i32, pick: f32) -> u8 {
    let t = grass_field(i, j);
    let lo = t.floor().clamp(0.0, 6.0) as usize;
    let hi = (lo + 1).min(6);
    let frac = (t - lo as f32).clamp(0.0, 1.0);
    cols[if pick < frac { hi } else { lo }]
}

/// Baked forge menu — rising embers on heat biomes (quarry / ore_seam), like meadow grass.
const FORGE_WARM_FLOOR: u8 = 8; // quarry
const FORGE_LAVA: u8 = 10; // ore_seam

pub fn draw_forge_ambient(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    cam_y: f32,
    time: f32,
    lights: &mut Vec<crate::lighting::ScreenLight>,
) {
    let Some((i0, j0, i1, j1)) = view_cells(fb, cam, zone) else {
        return;
    };
    let cell = zone.cell;
    for j in j0..=j1 {
        for i in i0..=i1 {
            let k = zone.idx(i, j);
            let biome = zone.biome[k];
            if biome != FORGE_WARM_FLOOR && biome != FORGE_LAVA {
                continue;
            }
            if zone.flags[k] & F_BLOCKED != 0 {
                continue;
            }
            let h = cell_hash(i, j);
            let x = zone.min_x + i as f32 * cell;
            let z = zone.min_z + j as f32 * cell;
            let y = zone.height[k] - cam_y;
            let life = ((time * 0.38 + (h as f32) * 0.017) % 1.0 + 1.0) % 1.0;
            if life > 0.82 {
                continue;
            }
            let ox = ((h & 255) as f32 / 255.0 - 0.5) * cell * 0.9;
            let oz = (((h >> 8) & 255) as f32 / 255.0 - 0.5) * cell * 0.9;
            let rise = life * (0.35 + (h & 3) as f32 * 0.08);
            let col = if biome == FORGE_LAVA {
                if life < 0.35 { EMBER } else { COAL }
            } else if life < 0.4 {
                COAL
            } else {
                ROCK_D
            };
            let p = cam.project(v3(x + ox, y + rise, z + oz));
            fb.plot(p.x as i32, p.y as i32, p.d - 0.35, col);
            if biome == FORGE_LAVA && (h & 31) == 0 && life < 0.2 {
                let flick = 1.0 + 0.08 * (time * 9.0 + x).sin();
                lights.push(crate::lighting::ScreenLight {
                    x: p.x,
                    y: p.y,
                    r: 120.0 * flick,
                    k: 0.75 * flick,
                });
            }
        }
    }
}

const GRASS_COLS: [u8; 7] = [
    crate::palette::MEADOW_DEEP,
    crate::palette::MEADOW_D,
    crate::palette::MEADOW,
    crate::palette::MEADOW_MID,
    crate::palette::MEADOW_L,
    crate::palette::MEADOW_SUN,
    crate::palette::MEADOW_BLUE,
];

/// Blades of one ground cell. Drawn right after the cell in the painter's
/// loop, so nearer cells (water included) cover blades they hide; a separate
/// grass pass after all ground drew blades over nearer water.
#[allow(clippy::too_many_arguments)]
#[inline]
fn cell_blades(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    i: i32,
    j: i32,
    cam_y: f32,
    time: f32,
    breeze: f32,
    gust: f32,
    water: Option<&crate::pixel_water::WaterField>,
) {
    if !grass_cell(zone, i, j) {
        return;
    }
    let cell = zone.cell;
    let hc = cell_hash(i, j);
    let x = zone.min_x + i as f32 * cell;
    let z = zone.min_z + j as f32 * cell;
    let mut n = 7 + (hc & 1) as usize;
    if let Some(eye) = cam.view.and_then(|v| v.eye()) {
        let q = v3(x, zone.height[zone.idx(i, j)] - cam_y, z) - eye;
        let d2 = q.dot(q);
        if d2 >= GRASS_HALF_M * GRASS_HALF_M {
            n = n.div_ceil(4);
        } else if d2 >= GRASS_FULL_M * GRASS_FULL_M {
            n = n.div_ceil(2);
        }
    }
    let wave = (time * 1.35 - x * 0.55 - z * 0.22).sin();
    for b in 0..n {
        let hb = cell_hash(i.wrapping_mul(13) + b as i32, j.wrapping_mul(17) ^ hc as i32);
        let u = (hb & 255) as f32 / 255.0;
        let v = ((hb >> 8) & 255) as f32 / 255.0;
        let lean = ((hb >> 16) & 255) as f32 / 255.0 - 0.5;
        let ox = (u - 0.15) * cell;
        let oz = (v - 0.15) * cell;
        let Some(gy) = dry_blade(zone, water, x + ox, z + oz) else {
            continue;
        };
        let ht = 0.14 + 0.2 * (((hb >> 4) & 255) as f32 / 255.0);
        let shiver = (time * 2.4 + x * 1.7 + b as f32).sin() * 0.012 * breeze;
        let sway = shiver + gust * wave * (0.07 + 0.05 * (hb & 1) as f32);
        let yb = gy - cam_y;
        let root = cam.project(v3(x + ox, yb, z + oz));
        let tip = cam.project(v3(x + ox + lean * 0.04 + sway, yb + ht, z + oz + lean * 0.03));
        if root.culled() || tip.culled() {
            continue;
        }
        let col = grass_blade_color(&GRASS_COLS, i, j, (hb & 255) as f32 / 255.0);
        fb.line(root, tip, col);
    }
}

/// 3D grass keeps every blade within this distance of the eye (m)...
const GRASS_FULL_M: f32 = 9.0;
/// ...half of them out to here, and a quarter beyond.
const GRASS_HALF_M: f32 = 16.0;

/// Draw the zone. `cam_y` is subtracted from all heights so the camera's
/// reference height sits at the screen centre line.
pub fn draw_zone(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    cam_y: f32,
    time: f32,
    water: Option<&crate::pixel_water::WaterField>,
    ripples: &[crate::pixel_water::Ripple],
) {
    draw_zone_in(fb, cam, zone, cam_y, time, true, water, ripples, None);
}

/// `clear` fills the framebuffer with sky first. Concurrent zones pass false
/// so a later zone does not erase one already drawn.
pub(crate) fn draw_zone_in(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    cam_y: f32,
    time: f32,
    clear: bool,
    water: Option<&crate::pixel_water::WaterField>,
    ripples: &[crate::pixel_water::Ripple],
    grass: Option<f32>,
) {
    let grass = grass.map(|b| {
        let b = b.clamp(0.0, 1.0);
        (b, grass_gust(time) * b)
    });
    if clear {
        fb.color.fill(crate::atmosphere::SKY);
    }
    let near = view_cells(fb, cam, zone);
    if cam.view.is_some() {
        draw_zone_far(fb, cam, zone, cam_y, time, near);
    }
    let Some((i0, j0, i1, j1)) = near else {
        return;
    };
    let c = zone.cell;
    let o = cam.project(v3(zone.min_x, -cam_y, zone.min_z));
    let org = (o.x.round() as i32, o.y.round() as i32);
    let pt = |i: i32, j: i32| {
        cam.project(v3(
            zone.min_x + i as f32 * c,
            shore_height(zone, i, j) - cam_y,
            zone.min_z + j as f32 * c,
        ))
    };
    // One slope_shade per visible block, cached for this frame (cells plus a
    // one-cell rim for neighbour lookups).
    let (ci0, cj0) = ((i0 - 1).max(0), (j0 - 1).max(0));
    let (ci1, cj1) = ((i1 + 1).min(zone.w as i32 - 2), (j1 + 1).min(zone.h as i32 - 2));
    let cw = (ci1 - ci0 + 1) as usize;
    let mut shades = vec![0u8; cw * (cj1 - cj0 + 1) as usize];
    for j in cj0..=cj1 {
        for i in ci0..=ci1 {
            shades[(j - cj0) as usize * cw + (i - ci0) as usize] = slope_shade(zone, i, j);
        }
    }
    let sh = |i: i32, j: i32| shades[(j - cj0) as usize * cw + (i - ci0) as usize];
    // One cell, stamped into both loops below so the iso loop compiles
    // exactly as before (a shared closure cost iso ~0.2 ms per frame).
    macro_rules! draw_cell {
        // Iso never culls a corner. 3D: a cell under or beside the eye can
        // straddle the near plane; clip it instead of dropping it (a hole).
        (@straddle iso, $i:ident, $j:ident) => {};
        (@straddle view, $i:ident, $j:ident) => {{
            let yw = zone.height[zone.idx($i, $j)];
            let water = zone.flags[zone.idx($i, $j)] & (F_WATER | F_BRIDGE) == F_WATER;
            let fall = water && fall_face_cell(zone, $i, $j);
            let wp = |i: i32, j: i32| {
                let y = if fall { fall_corner(zone, yw, i, j) - cam_y } else if water { water_corner(zone, yw, i, j) - cam_y } else { shore_height(zone, i, j) - cam_y };
                v3(zone.min_x + i as f32 * c, y, zone.min_z + j as f32 * c)
            };
            let col = cell_color(zone, $i, $j, time, sh($i, $j));
            fill_quad_near_clipped(fb, cam, [wp($i, $j), wp($i + 1, $j), wp($i + 1, $j + 1), wp($i, $j + 1)], col);
        }};
        // Iso: p11 is always the top corner and p00 the bottom.
        (@onscreen iso, $p00:ident, $p10:ident, $p01:ident, $p11:ident) => {
            if $p11.y < -2.0 || $p00.y > fb.h as f32 + 2.0 + 300.0 {
                continue;
            }
        };
        // 3D: any corner can be the top one, depending on yaw.
        (@onscreen view, $p00:ident, $p10:ident, $p01:ident, $p11:ident) => {{
            let (y0, y1) = ($p00.y.min($p10.y).min($p01.y).min($p11.y), $p00.y.max($p10.y).max($p01.y).max($p11.y));
            let (x0, x1) = ($p00.x.min($p10.x).min($p01.x).min($p11.x), $p00.x.max($p10.x).max($p01.x).max($p11.x));
            if y1 < -2.0 || y0 > fb.h as f32 + 2.0 || x1 < -2.0 || x0 > fb.w as f32 + 2.0 {
                continue;
            }
        }};
        ($i:expr, $j:expr, $view:tt) => {{
            let (i, j) = ($i, $j);
                let (p00, p10, p01, p11) = if zone.flags[zone.idx(i, j)] & (F_WATER | F_BRIDGE) == F_WATER {
                    let yw = zone.height[zone.idx(i, j)];
                    let fall = fall_face_cell(zone, i, j);
                    let pw = |ii: i32, jj: i32| {
                        let y = if fall { fall_corner(zone, yw, ii, jj) } else { water_corner(zone, yw, ii, jj) } - cam_y;
                        cam.project(v3(zone.min_x + ii as f32 * c, y, zone.min_z + jj as f32 * c))
                    };
                    (pw(i, j), pw(i + 1, j), pw(i, j + 1), pw(i + 1, j + 1))
                } else {
                    (pt(i, j), pt(i + 1, j), pt(i, j + 1), pt(i + 1, j + 1))
                };
                if p00.culled() || p10.culled() || p01.culled() || p11.culled() {
                    draw_cell!(@straddle $view, i, j);
                    continue;
                }
                draw_cell!(@onscreen $view, p00, p10, p01, p11);
                if zone.flags[zone.idx(i, j)] & (F_WATER | F_BRIDGE) == F_WATER {
                    paint_water_cell(fb, zone, i, j, time, p00, p10, p01, p11, water, ripples);
                    continue;
                }
                {
                    let cx = zone.min_x + (i as f32 + 0.5) * c;
                    let cz = zone.min_z + (j as f32 + 0.5) * c;
                    if let Some(flow) = water.and_then(|f| f.fall_flow_at(cx, cz)) {
                        paint_fall_cell(fb, zone, i, j, time, p00, p10, p01, p11, water, ripples, flow);
                        continue;
                    }
                }
                'land: {
                let col = cell_color(zone, i, j, time, sh(i, j));
                // B1: dither toward differing neighbour biomes (same shade step).
                if let Some(b) = plain_biome(zone, i, j) {
                    let shade = col - (BIOME0 + b * 3);
                    // Neighbour colour if it differs in biome or (after L1) in shade step,
                    // so slope-shading steps dither too instead of forming cell blocks.
                    let n = |di: i32, dj: i32| {
                        let (ni, nj) = (i + di, j + dj);
                        if ni > zone.w as i32 - 2 || nj > zone.h as i32 - 2 {
                            return None;
                        }
                        if trail_base(zone, ni, nj).is_some() {
                            return None;
                        }
                        let nb = plain_biome(zone, ni, nj)?;
                        let nc = BIOME0 + nb * 3 + sh(ni, nj);
                        (nc != col).then_some(if nb != b { BIOME0 + nb * 3 + shade } else { nc })
                    };
                    let nb = [n(-1, 0), n(1, 0), n(0, -1), n(0, 1)];
                    if nb.iter().any(|x| x.is_some()) {
                        fill_tri_edge(fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), col, nb, org, (EDGE_BAND, EDGE_MAX));
                        fill_tri_edge(fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), col, nb, org, (EDGE_BAND, EDGE_MAX));
                        break 'land;
                    }
                }
                // Roads: cobble in world space. The road cell dithers its edge
                // toward grass; the grass cell does not paint a flat dirt fringe.
                if trail_base(zone, i, j).is_some() {
                    let shade = sh(i, j);
                    let n = |di: i32, dj: i32| {
                        let (ni, nj) = (i + di, j + dj);
                        if ni > zone.w as i32 - 2 || nj > zone.h as i32 - 2 {
                            return None;
                        }
                        if trail_base(zone, ni, nj).is_some() {
                            return None;
                        }
                        plain_biome(zone, ni, nj).map(|b| BIOME0 + b * 3 + shade)
                    };
                    let nb = [n(-1, 0), n(1, 0), n(0, -1), n(0, 1)];
                    let origin = (zone.min_x, zone.min_z);
                    fill_tri_cobble(fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), origin, c, (i, j), shade, nb, org);
                    fill_tri_cobble(fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), origin, c, (i, j), shade, nb, org);
                    break 'land;
                }
                fill_tri(fb, p00, p10, p11, col);
                fill_tri(fb, p00, p11, p01, col);
                // B4: sparse ground grain on plain biome cells (not water or trails).
                if plain_biome(zone, i, j).is_some() && cell_hash(i, j) % FLECK_EVERY == 0 {
                    if let Some(d) = crate::dither::darker(col) {
                        let (cx, cy) = (((p00.x + p11.x) * 0.5) as i32, ((p00.y + p11.y) * 0.5) as i32);
                        for dx in 0..2 {
                            let x = cx + dx;
                            if x >= 0 && cy >= 0 && x < fb.w as i32 && cy < fb.h as i32 {
                                fb.color[cy as usize * fb.w + x as usize] = d;
                            }
                        }
                    }
                }
                }
                // Zone border: hang a rock skirt off the outer edge so the
                // world ends in a cliff instead of a sliver of sky below it.
                {
                    let last_i = zone.w as i32 - 2;
                    let last_j = zone.h as i32 - 2;
                    if i == 0 || j == 0 || i == last_i || j == last_j {
                        let drop = |p: P2, ii: i32, jj: i32| {
                            let q = cam.project(v3(
                                zone.min_x + ii as f32 * c,
                                shore_height(zone, ii, jj) - cam_y - EDGE_SKIRT_M,
                                zone.min_z + jj as f32 * c,
                            ));
                            (p, q)
                        };
                        let mut edges: [Option<((P2, P2), (P2, P2))>; 4] = [None; 4];
                        if i == last_i { edges[0] = Some((drop(p10, i + 1, j), drop(p11, i + 1, j + 1))); }
                        if j == last_j { edges[1] = Some((drop(p01, i, j + 1), drop(p11, i + 1, j + 1))); }
                        if i == 0 { edges[2] = Some((drop(p00, i, j), drop(p01, i, j + 1))); }
                        if j == 0 { edges[3] = Some((drop(p00, i, j), drop(p10, i + 1, j))); }
                        for ((a, a2), (b, b2)) in edges.into_iter().flatten() {
                            if a2.culled() || b2.culled() {
                                continue;
                            }
                            fill_tri(fb, a, b, b2, crate::palette::ROCK_D);
                            fill_tri(fb, a, b2, a2, crate::palette::ROCK_D);
                        }
                    }
                }
                // Shore lip: the smooth water edge spills onto this bank cell,
                // drawn in the same far-to-near order so nearer ground covers it.
                if let Some(field) = water {
                    if DIRS_8.into_iter().any(|(di, dj)| calm_wet(zone, i + di, j + dj)) {
                        paint_wet_lip_cell(fb, zone, i, j, time, field, ripples, p00, p10, p01, p11, sh(i, j));
                    }
                }
                if let Some((breeze, gust)) = grass {
                    cell_blades(fb, cam, zone, i, j, cam_y, time, breeze, gust, water);
                }
        }};
    }
    match cam.view {
        // 3D: far to near along the view direction. The iso diagonal order
        // below is only back-to-front for the iso azimuth.
        Some(v) => {
            let fwd = v.fwd();
            let (fi, fj) = (fwd.x > 0.0, fwd.z > 0.0);
            let at = |lo: i32, hi: i32, toward_hi: bool, k: i32| if toward_hi { hi - k } else { lo + k };
            if fwd.x.abs() >= fwd.z.abs() {
                for a in 0..=(i1 - i0) {
                    for b in 0..=(j1 - j0) {
                        draw_cell!(at(i0, i1, fi, a), at(j0, j1, fj, b), view);
                    }
                }
            } else {
                for b in 0..=(j1 - j0) {
                    for a in 0..=(i1 - i0) {
                        draw_cell!(at(i0, i1, fi, a), at(j0, j1, fj, b), view);
                    }
                }
            }
        }
        // Iso: back to front, increasing i + j.
        None => {
            for s in (i0 + j0)..=(i1 + j1) {
                let ilo = i0.max(s - j1);
                let ihi = i1.min(s - j0);
                for i in ilo..=ihi {
                    draw_cell!(i, s - i, iso);
                }
            }
        }
    }
}

/// Water level a bank cell's lip may reach: the highest calm water beside it.
fn lip_level(zone: &Zone, i: i32, j: i32) -> Option<f32> {
    let mut wl: Option<f32> = None;
    for (di, dj) in DIRS_8 {
        if calm_wet(zone, i + di, j + dj) {
            let y = zone.height[zone.idx(i + di, j + dj)];
            wl = Some(wl.map_or(y, |w: f32| w.max(y)));
        }
    }
    wl
}

#[allow(clippy::too_many_arguments)]
fn paint_wet_lip_cell(
    fb: &mut Framebuffer,
    zone: &Zone,
    i: i32,
    j: i32,
    time: f32,
    field: &crate::pixel_water::WaterField,
    ripples: &[crate::pixel_water::Ripple],
    p00: P2,
    p10: P2,
    p01: P2,
    p11: P2,
    shade: u8,
) {
    let Some(wl) = lip_level(zone, i, j) else { return };
    let c = zone.cell;
    let ox = zone.min_x + i as f32 * c;
    let oz = zone.min_z + j as f32 * c;
    let land = cell_color(zone, i, j, 0.0, shade);
    // Ground height at each corner: the lip only floods ground at the water
    // line, never up a bank face (no blue facets climbing a slope).
    let (y00, y10, y01, y11) = (shore_height(zone, i, j), shore_height(zone, i + 1, j), shore_height(zone, i, j + 1), shore_height(zone, i + 1, j + 1));
    crate::pixel_water::fill_wet_lip(
        fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), ox, oz, c, time, field, ripples, land, [y00, y10, y11], wl,
    );
    crate::pixel_water::fill_wet_lip(
        fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), ox, oz, c, time, field, ripples, land, [y00, y11, y01], wl,
    );
}

/// Open water (not a bridge deck). Out of bounds is dry.
#[inline]
fn wet(z: &Zone, i: i32, j: i32) -> bool {
    if i < 0 || j < 0 || i >= z.w as i32 || j >= z.h as i32 {
        return false;
    }
    z.flags[z.idx(i, j)] & (F_WATER | F_BRIDGE) == F_WATER
}

/// Render height of grid vertex (i, j): the precomputed `zone.vy` when built,
/// else computed on the spot (tests and hand-built zones).
#[inline]
fn shore_height(z: &Zone, i: i32, j: i32) -> f32 {
    let i = i.clamp(0, z.w as i32 - 1);
    let j = j.clamp(0, z.h as i32 - 1);
    if z.vy.len() == z.w * z.h {
        return z.vy[z.idx(i, j)];
    }
    vertex_y_raw(z, i, j)
}

/// Biggest surface step (m) that still counts as one sheet of water when
/// vertices are shared; anything taller is a fall and keeps its own level.
const SHEET_STEP: f32 = 0.6;

/// Depth of the rock skirt hung off the zone border (m).
const EDGE_SKIRT_M: f32 = 30.0;

/// Open water for shore shaping. (Deep water and fall faces both carry
/// F_BLOCKED, so the flag cannot tell them apart; levels are clustered by
/// `SHEET_STEP` instead.)
#[inline]
fn calm_wet(z: &Zone, i: i32, j: i32) -> bool {
    wet(z, i, j)
}

/// Water level at a vertex: mean of the calm water cells that share it
/// (cells (i-1..i, j-1..j)), or None when no water cell touches it.
fn vertex_water(z: &Zone, i: i32, j: i32) -> Option<f32> {
    let (mut s, mut n) = (0.0f32, 0u32);
    let mut lo = f32::INFINITY;
    for (di, dj) in [(-1, -1), (0, -1), (-1, 0), (0, 0)] {
        if calm_wet(z, i + di, j + dj) {
            lo = lo.min(z.height[z.idx(i + di, j + dj)]);
        }
    }
    if !lo.is_finite() {
        return None;
    }
    // One sheet: average only the cells on the lowest level, so a fall lip
    // never drags the pool up into a facet.
    for (di, dj) in [(-1, -1), (0, -1), (-1, 0), (0, 0)] {
        if calm_wet(z, i + di, j + dj) {
            let y = z.height[z.idx(i + di, j + dj)];
            if y - lo < SHEET_STEP {
                s += y;
                n += 1;
            }
        }
    }
    Some(s / n as f32)
}

/// Shore-aware vertex height. A vertex touching water sits exactly on the
/// water line (bank and surface share it: no seam, no step, no pyramid).
/// One or two vertices out, land stays a low bank above the water (never
/// below it); only a real hinterland cliff keeps its rise.
fn vertex_y_raw(z: &Zone, i: i32, j: i32) -> f32 {
    let y = z.height[z.idx(i, j)];
    if let Some(wl) = vertex_water(z, i, j) {
        return wl;
    }
    if wet(z, i, j) {
        // Fall face or water only on a far corner: keep the cell level.
        return y;
    }
    let mut wy = 0.0;
    let mut n = 0u32;
    let mut hinterland = 0u32;
    for r in 1..=2i32 {
        for (di, dj) in DIRS_8 {
            let (ni, nj) = (i + di * r, j + dj * r);
            if calm_wet(z, ni, nj) {
                wy += z.height[z.idx(ni, nj)];
                n += 1;
                continue;
            }
            if r != 1 || ni < 0 || nj < 0 || ni >= z.w as i32 || nj >= z.h as i32 {
                continue;
            }
            let near = DIRS_8.iter().any(|&(ei, ej)| wet(z, ni + ei, nj + ej));
            if !near && z.height[z.idx(ni, nj)] > y - 0.35 {
                hinterland += 1;
            }
        }
    }
    if n == 0 {
        return y;
    }
    wy /= n as f32;
    if y - wy > 1.8 && hinterland >= 2 {
        return y;
    }
    y.min(wy + 0.4).max(wy + 0.06)
}

/// Render heights for every vertex of the grid (`Zone::vy`).
pub fn vertex_heights(z: &Zone) -> Vec<f32> {
    let mut out = vec![0.0; z.w * z.h];
    for j in 0..z.h as i32 {
        for i in 0..z.w as i32 {
            out[z.idx(i, j)] = vertex_y_raw(z, i, j);
        }
    }
    out
}

/// Recompute `vy` within `r` vertices of (i, j) after a cell patch.
pub fn refresh_vertex_heights(z: &mut Zone, i: i32, j: i32, r: i32) {
    if z.vy.len() != z.w * z.h {
        return;
    }
    for jj in (j - r).max(0)..=(j + r).min(z.h as i32 - 1) {
        for ii in (i - r).max(0)..=(i + r).min(z.w as i32 - 1) {
            let k = z.idx(ii, jj);
            z.vy[k] = vertex_y_raw(z, ii, jj);
        }
    }
}

/// A cell inside a fall face: blocked water with wet water both well above and
/// well below it. Such cells draw as one sloped sheet from lip to pool instead
/// of flat per-cell terraces (which read as stairs, not a waterfall).
fn fall_face_cell(z: &Zone, i: i32, j: i32) -> bool {
    let k = z.idx(i, j);
    if z.flags[k] & (F_WATER | F_BLOCKED | F_BRIDGE) != F_WATER | F_BLOCKED {
        return false;
    }
    let y = z.height[k];
    let (mut up, mut down) = (false, false);
    for (di, dj) in DIRS_8 {
        let (ni, nj) = (i + di, j + dj);
        if !wet(z, ni, nj) {
            continue;
        }
        let d = z.height[z.idx(ni, nj)] - y;
        up |= d > 0.3;
        down |= d < -0.3;
    }
    up && down
}

/// Corner of a fall-face quad: mean of every water cell at the vertex.
fn fall_corner(z: &Zone, own: f32, i: i32, j: i32) -> f32 {
    let (mut s, mut n) = (0.0f32, 0u32);
    for (di, dj) in [(-1, -1), (0, -1), (-1, 0), (0, 0)] {
        if wet(z, i + di, j + dj) {
            s += z.height[z.idx(i + di, j + dj)];
            n += 1;
        }
    }
    if n == 0 { own } else { s / n as f32 }
}

/// Corner height of a water quad: the shared vertex when it is on this
/// cell's sheet, else the cell's own level (a fall keeps its step).
#[inline]
fn water_corner(z: &Zone, own: f32, i: i32, j: i32) -> f32 {
    let v = shore_height(z, i, j);
    if (v - own).abs() < SHEET_STEP { v } else { own }
}

const FLOW_DIRS: [(i32, i32); 8] = [
    (-1, 0),
    (1, 0),
    (0, -1),
    (0, 1),
    (-1, -1),
    (1, -1),
    (-1, 1),
    (1, 1),
];

/// Downhill on water, then a wider search so flat pools still drain toward
/// an outlet and a lip can see the water below a drop.
fn water_drive(zone: &Zone, i: i32, j: i32) -> Option<(f32, f32, f32, Option<(f32, f32, f32)>)> {
    if !wet(zone, i, j) {
        return None;
    }
    let h0 = zone.height[zone.idx(i, j)];
    let mut best = (0.0f32, 0.0f32, 0.0f32);
    for (di, dj) in FLOW_DIRS {
        let (ni, nj) = (i + di, j + dj);
        if !wet(zone, ni, nj) {
            continue;
        }
        let drop = h0 - zone.height[zone.idx(ni, nj)];
        if drop > best.2 {
            best = (di as f32, dj as f32, drop);
        }
    }
    let mut pour = None;
    let mut far = (0.0f32, 0.0f32, 0.0f32);
    if best.2 < 0.008 {
        for r in 2..=14 {
            for (di, dj) in FLOW_DIRS {
                let (ni, nj) = (i + di * r, j + dj * r);
                if !wet(zone, ni, nj) {
                    continue;
                }
                let drop = h0 - zone.height[zone.idx(ni, nj)];
                if drop > far.2 {
                    far = (di as f32, dj as f32, drop);
                    if drop > 1.2 {
                        let c = zone.cell;
                        pour = Some((
                            zone.min_x + (ni as f32 + 0.5) * c,
                            zone.min_z + (nj as f32 + 0.5) * c,
                            zone.height[zone.idx(ni, nj)],
                        ));
                    }
                }
            }
        }
    }
    let (mut fx, mut fz, drop) = if best.2 >= 0.002 {
        best
    } else if far.2 >= 0.01 || pour.is_some() {
        far
    } else {
        return None;
    };
    // Stay in the channel: ease away from banks.
    let mut bx = 0.0;
    let mut bz = 0.0;
    for (di, dj) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
        if !wet(zone, i + di, j + dj) {
            bx -= di as f32;
            bz -= dj as f32;
        }
    }
    fx += bx * 0.35;
    fz += bz * 0.35;
    let len = (fx * fx + fz * fz).sqrt();
    if len < 1e-4 {
        return None;
    }
    Some((fx / len, fz / len, drop, pour))
}

/// True when much higher water sits nearby — the plunge of a fall.
fn incoming_fall(zone: &Zone, i: i32, j: i32) -> bool {
    if !wet(zone, i, j) {
        return false;
    }
    let h0 = zone.height[zone.idx(i, j)];
    for r in 2..=12 {
        for (di, dj) in FLOW_DIRS {
            let (ni, nj) = (i + di * r, j + dj * r);
            if wet(zone, ni, nj) && zone.height[zone.idx(ni, nj)] - h0 > 1.2 {
                return true;
            }
        }
    }
    false
}

fn paint_fall_cell(
    fb: &mut Framebuffer,
    zone: &Zone,
    i: i32,
    j: i32,
    time: f32,
    p00: P2,
    p10: P2,
    p01: P2,
    p11: P2,
    field: Option<&crate::pixel_water::WaterField>,
    ripples: &[crate::pixel_water::Ripple],
    flow: [f32; 2],
) {
    let c = zone.cell;
    let ox = zone.min_x + i as f32 * c;
    let oz = zone.min_z + j as f32 * c;
    let p = crate::pixel_water::Mode::Rush.params_iso();
    crate::pixel_water::fill_tri_xz(
        fb, p00, p10, p11, (ox, oz), (ox + c, oz), (ox + c, oz + c), time, p, field, ripples, true, flow,
    );
    crate::pixel_water::fill_tri_xz(
        fb, p00, p11, p01, (ox, oz), (ox + c, oz + c), (ox, oz + c), time, p, field, ripples, true, flow,
    );
}

fn paint_water_cell(
    fb: &mut Framebuffer,
    zone: &Zone,
    i: i32,
    j: i32,
    time: f32,
    p00: P2,
    p10: P2,
    p01: P2,
    p11: P2,
    field: Option<&crate::pixel_water::WaterField>,
    ripples: &[crate::pixel_water::Ripple],
) {
    let c = zone.cell;
    let ox = zone.min_x + i as f32 * c;
    let oz = zone.min_z + j as f32 * c;
    // A water cell on a fall face is the curtain itself: draw the sheet
    // (shore distance would otherwise paint it as bank, hiding the falls).
    if let Some(flow) = field.and_then(|f| f.fall_flow_at(ox + c * 0.5, oz + c * 0.5)) {
        paint_fall_cell(fb, zone, i, j, time, p00, p10, p01, p11, field, ripples, flow);
        return;
    }
    let p = if let Some(f) = field {
        let on_fall = false;
        let s = f.sample(ox + c * 0.5, oz + c * 0.5);
        let fl = (s.flow[0] * s.flow[0] + s.flow[1] * s.flow[1]).sqrt();
        crate::pixel_water::mode_from_flow(fl, on_fall).params_iso()
    } else {
        let (drop, pour) = match water_drive(zone, i, j) {
            Some((_, _, drop, p)) => (drop, p.is_some()),
            None => (0.0, false),
        };
        crate::pixel_water::mode_from_grade(drop, pour, incoming_fall(zone, i, j)).params_iso()
    };
    let land = shore_land(zone, i, j);
    crate::pixel_water::fill_tri(
        fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), ox, oz, c, time, p, field, ripples, land,
    );
    crate::pixel_water::fill_tri(
        fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), ox, oz, c, time, p, field, ripples, land,
    );
}

fn shore_land(zone: &Zone, i: i32, j: i32) -> u8 {
    for (di, dj) in [(0, -1), (0, 1), (-1, 0), (1, 0)] {
        let (ni, nj) = (i + di, j + dj);
        if !wet(zone, ni, nj) && ni >= 0 && nj >= 0 && ni < zone.w as i32 - 1 && nj < zone.h as i32 - 1 {
            return cell_color(zone, ni, nj, 0.0, slope_shade(zone, ni, nj));
        }
    }
    BIOME0 + 4 * 3 + 1
}

/// Air-gap sheets: same pixel-water shade as the river, rushing downhill.
/// Drawn after meadow grass so the drop is not painted over by blades.
pub(crate) fn draw_fall_sheets(
    fb: &mut Framebuffer,
    cam: &Camera,
    cam_y: f32,
    time: f32,
    field: &crate::pixel_water::WaterField,
    _ripples: &[crate::pixel_water::Ripple],
) {
    let p = crate::pixel_water::Mode::Buffet.params_iso();
    let eye = cam.view.and_then(|v| v.eye());
    for f in &field.falls {
        let (dx, dz) = (f.pool[0] - f.lip[0], f.pool[1] - f.lip[1]);
        let len = (dx * dx + dz * dz).sqrt();
        if len < 0.2 {
            continue;
        }
        let (ux, uz) = (dx / len, dz / len);
        // The face is only visible when it faces the camera. Iso looks from +x +z.
        let facing = match eye {
            Some(e) => (e.x - f.lip[0]) * ux + (e.z - f.lip[1]) * uz > 0.0,
            None => ux + uz > -0.1,
        };
        if !facing {
            continue;
        }
        let (px, pz) = (-uz, ux);
        let (hw0, hw1) = (f.lip_w, f.pool_w);
        let a = cam.project(v3(f.lip[0] - px * hw0, f.lip[2] - cam_y, f.lip[1] - pz * hw0));
        let b = cam.project(v3(f.lip[0] + px * hw0, f.lip[2] - cam_y, f.lip[1] + pz * hw0));
        let c = cam.project(v3(f.pool[0] + px * hw1, f.pool[2] - cam_y, f.pool[1] + pz * hw1));
        let d = cam.project(v3(f.pool[0] - px * hw1, f.pool[2] - cam_y, f.pool[1] - pz * hw1));
        if a.culled() || b.culled() || c.culled() || d.culled() || quad_off_screen(fb, a, b, c, d) {
            continue;
        }
        crate::pixel_water::fill_fall_quad(fb, a, b, c, d, f, time, p);
    }
}

/// Cells per side of one far-ground block (2 m at 0.5 m cells).
const FAR_BLOCK: i32 = 4;

/// 3D only: coarse ground from the edge of the detailed `view_cells` disc out
/// to the engine's `FAR` plane. The detailed pass stops ~22 m from the camera
/// to keep its cost near iso, which left the rest of a 3D frame as bare sky
/// while props were drawn all the way out. One flat-coloured quad per block,
/// painted far to near; the detailed pass then draws over the near disc.
#[inline(never)]
#[cold]
fn draw_zone_far(fb: &mut Framebuffer, cam: &Camera, zone: &Zone, cam_y: f32, time: f32, near: Option<(i32, i32, i32, i32)>) {
    let Some(v) = cam.view else { return };
    let Some(eye) = v.eye() else { return };
    let far = stick_engine::camera::FAR;
    let (ei0, ej0) = zone.cell_of(eye.x - far, eye.z - far);
    let (ei1, ej1) = zone.cell_of(eye.x + far, eye.z + far);
    let k = FAR_BLOCK;
    let last_i = zone.w as i32 - 1;
    let last_j = zone.h as i32 - 1;
    // Block indices covering the disc, clipped to the grid.
    let (bi0, bj0) = (ei0.max(0) / k, ej0.max(0) / k);
    let (bi1, bj1) = (ei1.min(last_i - 1) / k, ej1.min(last_j - 1) / k);
    if bi0 > bi1 || bj0 > bj1 {
        return;
    }
    let c = zone.cell;
    let (w, h) = (fb.w as f32, fb.h as f32);
    let fwd = v.fwd();
    let pt = |i: i32, j: i32| {
        let (i, j) = (i.min(last_i), j.min(last_j));
        let y = shore_height(zone, i, j) - cam_y;
        cam.project(v3(zone.min_x + i as f32 * c, y, zone.min_z + j as f32 * c))
    };
    sweep_far_to_near((bi0, bj0, bi1, bj1), fwd, |bi, bj| {
        let (i, j) = (bi * k, bj * k);
        // Wholly inside the detailed disc: that pass paints it.
        if let Some((ni0, nj0, ni1, nj1)) = near {
            if i >= ni0 && j >= nj0 && i + k <= ni1 + 1 && j + k <= nj1 + 1 {
                return;
            }
        }
        let mid = v3(zone.min_x + (i as f32 + k as f32 * 0.5) * c, eye.y, zone.min_z + (j as f32 + k as f32 * 0.5) * c);
        let q = mid - eye;
        let half = k as f32 * c * std::f32::consts::FRAC_1_SQRT_2;
        if q.dot(q) > (far + half) * (far + half) || q.dot(fwd) < -half {
            return;
        }
        let (p00, p10, p01, p11) = (pt(i, j), pt(i + k, j), pt(i, j + k), pt(i + k, j + k));
        if p00.culled() || p10.culled() || p01.culled() || p11.culled() {
            let wp = |i: i32, j: i32| {
                let (i, j) = (i.min(last_i), j.min(last_j));
                v3(zone.min_x + i as f32 * c, zone.height[zone.idx(i, j)] - cam_y, zone.min_z + j as f32 * c)
            };
            let (ci, cj) = ((i + k / 2).min(last_i - 1), (j + k / 2).min(last_j - 1));
            let col = cell_color(zone, ci, cj, time, slope_shade(zone, ci, cj));
            fill_quad_near_clipped(fb, cam, [wp(i, j), wp(i + k, j), wp(i + k, j + k), wp(i, j + k)], col);
            return;
        }
        let (x0, x1) = (p00.x.min(p10.x).min(p01.x).min(p11.x), p00.x.max(p10.x).max(p01.x).max(p11.x));
        let (y0, y1) = (p00.y.min(p10.y).min(p01.y).min(p11.y), p00.y.max(p10.y).max(p01.y).max(p11.y));
        if x1 < 0.0 || x0 > w || y1 < 0.0 || y0 > h {
            return;
        }
        let (ci, cj) = ((i + k / 2).min(last_i - 1), (j + k / 2).min(last_j - 1));
        let col = cell_color(zone, ci, cj, time, slope_shade(zone, ci, cj));
        fill_tri(fb, p00, p10, p11, col);
        fill_tri(fb, p00, p11, p01, col);
    });
}

/// Fill a ground quad (corners in winding order) that crosses the 3D near
/// plane: clip it to the visible side so the ground under the eye has no hole.
fn fill_quad_near_clipped(fb: &mut Framebuffer, cam: &Camera, q: [Vec3; 4], col: u8) {
    let Some(v) = cam.view else { return };
    if v.inv_d <= 0.0 {
        return;
    }
    let f = v.fwd();
    // project_view culls when 1 + z * inv_d <= NEAR * inv_d; keep a hair inside.
    let zc = (stick_engine::camera::NEAR * v.inv_d - 1.0) / v.inv_d + 1e-3;
    let z = |p: Vec3| (p - v.target).dot(f);
    let mut out: [Vec3; 8] = [v3(0.0, 0.0, 0.0); 8];
    let mut n = 0;
    for k in 0..4 {
        let (a, b) = (q[k], q[(k + 1) % 4]);
        let (za, zb) = (z(a), z(b));
        if za > zc {
            out[n] = a;
            n += 1;
        }
        if (za > zc) != (zb > zc) {
            let t = (zc - za) / (zb - za);
            out[n] = a + (b - a) * t;
            n += 1;
        }
    }
    if n < 3 {
        return;
    }
    let p0 = cam.project(out[0]);
    for k in 1..n - 1 {
        let (p1, p2) = (cam.project(out[k]), cam.project(out[k + 1]));
        if p0.culled() || p1.culled() || p2.culled() {
            continue;
        }
        fill_tri(fb, p0, p1, p2, col);
    }
}

/// Visit every cell of an inclusive block from the far side to the near side
/// of `fwd` (outer loop on the dominant axis), so a heightfield paints in
/// painter's order for any 3D yaw.
pub(crate) fn sweep_far_to_near((i0, j0, i1, j1): (i32, i32, i32, i32), fwd: Vec3, mut f: impl FnMut(i32, i32)) {
    // Looking toward +axis puts the high end far away: step it first.
    let at = |lo: i32, hi: i32, toward_hi: bool, k: i32| if toward_hi { hi - k } else { lo + k };
    let (fi, fj) = (fwd.x > 0.0, fwd.z > 0.0);
    if fwd.x.abs() >= fwd.z.abs() {
        for a in 0..=(i1 - i0) {
            for b in 0..=(j1 - j0) {
                f(at(i0, i1, fi, a), at(j0, j1, fj, b));
            }
        }
    } else {
        for b in 0..=(j1 - j0) {
            for a in 0..=(i1 - i0) {
                f(at(i0, i1, fi, a), at(j0, j1, fj, b));
            }
        }
    }
}

#[cfg(test)]
mod gust_tests {
    use super::grass_gust;

    #[test]
    fn gusts_come_and_go_at_uneven_gaps() {
        let mut calm = 0;
        let mut strong = 0;
        let mut gaps = Vec::new();
        let mut in_gust = false;
        let mut gap = 0;
        let mut t = 0.0;
        while t < 80.0 {
            let g = grass_gust(t);
            if g < 0.05 {
                calm += 1;
                if in_gust {
                    gaps.push(gap);
                    gap = 0;
                    in_gust = false;
                }
                gap += 1;
            }
            if g > 0.45 {
                strong += 1;
                in_gust = true;
            }
            t += 0.2;
        }
        assert!(calm > 40, "calm samples {calm}");
        assert!(strong > 8, "strong samples {strong}");
        assert!(gaps.len() >= 3, "gusts {gaps:?}");
        let min = *gaps.iter().min().unwrap();
        let max = *gaps.iter().max().unwrap();
        assert!(max > min + 2, "gaps {gaps:?}");
    }
}

#[cfg(test)]
mod grass_color_tests {
    use super::grass_field;

    #[test]
    fn neighbouring_cells_ease_and_the_field_uses_several_greens() {
        let mut steep = 0;
        let mut seen = [0u32; 7];
        for j in 0..48 {
            for i in 0..48 {
                let a = grass_field(i, j);
                let b = grass_field(i + 1, j);
                if (a - b).abs() > 1.0 {
                    steep += 1;
                }
                seen[a.floor().clamp(0.0, 6.0) as usize] += 1;
            }
        }
        assert_eq!(steep, 0, "hard steps {steep}");
        let kinds = seen.iter().filter(|c| **c > 30).count();
        assert!(kinds >= 4, "greens {seen:?}");
    }
}

#[cfg(test)]
mod cobble_tests {
    use super::cobble;
    use crate::palette::CR_NOSE;

    #[test]
    fn cobbles_mix_several_stones_around_grout() {
        let mut mortar = 0;
        let mut kinds = std::collections::BTreeSet::new();
        let n = 90;
        for j in 0..n {
            for i in 0..n {
                let c = cobble(i as f32 * 0.04, j as f32 * 0.04, 1);
                if c == CR_NOSE {
                    mortar += 1;
                } else {
                    kinds.insert(c);
                }
            }
        }
        let total = n * n;
        let pct = mortar * 100 / total;
        assert!(pct > 8 && pct < 35, "grout {pct}%");
        assert!(kinds.len() >= 4, "stones {kinds:?}");
        assert_eq!(cobble(1.25, 3.4, 1), cobble(1.25, 3.4, 1));
    }
}
