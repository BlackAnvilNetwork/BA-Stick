// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Height-aware iso ground: painter's-order quads over the baked zone grid.
use stick_engine::camera::{Camera, P2, HEIGHT_PX, ISO_Y};
use stick_engine::math::v3;
use stick_engine::raster::Framebuffer;

use crate::palette::*;
use crate::zone::*;

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

#[inline]
fn cell_hash(i: i32, j: i32) -> u32 {
    let mut h = (i as u32).wrapping_mul(0x9E37_79B1) ^ (j as u32).wrapping_mul(0x85EB_CA77);
    h ^= h >> 15;
    h = h.wrapping_mul(0x2C1B_3C6D);
    h ^ (h >> 12)
}

fn cell_color(z: &Zone, i: i32, j: i32, time: f32, shade: u8) -> u8 {
    let k = z.idx(i, j);
    let f = z.flags[k];
    if f & F_WATER != 0 {
        // W1: calm body in two tones; a slow diagonal swell (~6 cells) instead
        // of a per-cell checker.
        let ph = swell_phase(i, j);
        let swell = ((i + j) as f32 * (std::f32::consts::TAU / 6.0) + ph - time * 1.1).sin();
        return if swell > 0.55 { WATER_DEEP } else { WATER_BODY };
    }
    if f & F_BRIDGE != 0 {
        return BRIDGE + shade;
    }
    if f & F_TRAIL != 0 {
        return if f & F_STONE != 0 { TRAIL_STONE + shade } else { TRAIL_DIRT + shade };
    }
    let b = z.biome[k].min(15);
    BIOME0 + b * 3 + shade
}

/// Draw the zone. `cam_y` is subtracted from all heights so the camera's
/// reference height sits at the screen centre line.
pub fn draw_zone(fb: &mut Framebuffer, cam: &Camera, zone: &Zone, cam_y: f32, time: f32) {
    fb.color.fill(crate::atmosphere::SKY);
    // Visible world rectangle at reference height, plus a margin for relief.
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
    let (i0, j0) = zone.cell_of(x0 - margin_m, z0 - margin_m);
    let (i1, j1) = zone.cell_of(x1 + margin_m, z1 + margin_m);
    let i0 = i0.max(0);
    let j0 = j0.max(0);
    let i1 = i1.min(zone.w as i32 - 2);
    let j1 = j1.min(zone.h as i32 - 2);
    if i0 > i1 || j0 > j1 {
        return;
    }
    let c = zone.cell;
    let o = cam.project(v3(zone.min_x, -cam_y, zone.min_z));
    let org = (o.x.round() as i32, o.y.round() as i32);
    let pt = |i: i32, j: i32| {
        let h = zone.height[zone.idx(i, j)] - cam_y;
        cam.project(v3(zone.min_x + i as f32 * c, h, zone.min_z + j as f32 * c))
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
    // Back to front: increasing i + j.
    for s in (i0 + j0)..=(i1 + j1) {
        let ilo = i0.max(s - j1);
        let ihi = i1.min(s - j0);
        for i in ilo..=ihi {
            let j = s - i;
            let (p00, p10, p01, p11) = (pt(i, j), pt(i + 1, j), pt(i, j + 1), pt(i + 1, j + 1));
            if p11.y < -2.0 || p00.y > fb.h as f32 + 2.0 + 300.0 {
                continue;
            }
            let col = cell_color(zone, i, j, time, sh(i, j));
            // W2/W3: water next to land. Banks on the SE (downstream of the NW
            // sun) get a dithered foam line; banks on the NW side shade the water.
            if zone.flags[zone.idx(i, j)] & (F_WATER | F_BRIDGE) == F_WATER {
                let side = |di: i32, dj: i32, c: u8| land(zone, i + di, j + dj).then_some(c);
                let nb = [side(-1, 0, WATER_DEEP), side(1, 0, WATER_FOAM), side(0, -1, WATER_DEEP), side(0, 1, WATER_FOAM)];
                if nb.iter().any(|x| x.is_some()) {
                    // Foam flickers by shifting the dither origin twice a second.
                    let o2 = (org.0 + ((time * 2.0) as i32 & 1) * 2, org.1);
                    fill_tri_edge(fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), col, nb, o2, SHORE_BAND);
                    fill_tri_edge(fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), col, nb, o2, SHORE_BAND);
                    continue;
                }
            }
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
                    if let Some(t) = trail_base(zone, ni, nj) {
                        return Some(t + shade);
                    }
                    let nb = plain_biome(zone, ni, nj)?;
                    let nc = BIOME0 + nb * 3 + sh(ni, nj);
                    (nc != col).then_some(if nb != b { BIOME0 + nb * 3 + shade } else { nc })
                };
                let nb = [n(-1, 0), n(1, 0), n(0, -1), n(0, 1)];
                if nb.iter().any(|x| x.is_some()) {
                    fill_tri_edge(fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), col, nb, org, (EDGE_BAND, EDGE_MAX));
                    fill_tri_edge(fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), col, nb, org, (EDGE_BAND, EDGE_MAX));
                    continue;
                }
            }
            // B3: trail cells dither toward differing ground/trail neighbours.
            if let Some(tb) = trail_base(zone, i, j) {
                let shade = col - tb;
                let n = |di: i32, dj: i32| {
                    let (ni, nj) = (i + di, j + dj);
                    if ni > zone.w as i32 - 2 || nj > zone.h as i32 - 2 {
                        return None;
                    }
                    if let Some(t) = trail_base(zone, ni, nj) {
                        return (t != tb).then_some(t + shade);
                    }
                    plain_biome(zone, ni, nj).map(|b| BIOME0 + b * 3 + shade)
                };
                let nb = [n(-1, 0), n(1, 0), n(0, -1), n(0, 1)];
                if nb.iter().any(|x| x.is_some()) {
                    fill_tri_edge(fb, p00, p10, p11, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), col, nb, org, TRAIL_BAND);
                    fill_tri_edge(fb, p00, p11, p01, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), col, nb, org, TRAIL_BAND);
                    continue;
                }
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
    }
}
