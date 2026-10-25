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

fn cell_color(z: &Zone, i: i32, j: i32, time: f32, shade: u8) -> u8 {
    let k = z.idx(i, j);
    let f = z.flags[k];
    if f & F_WATER != 0 {
        // W1: calm channel — deep center, lighter ripples; no harsh checker.
        let ph = swell_phase(i, j);
        let swell = ((i + j) as f32 * (std::f32::consts::TAU / 8.0) + ph - time * 0.85).sin();
        let shore = land(z, i - 1, j) || land(z, i + 1, j) || land(z, i, j - 1) || land(z, i, j + 1);
        if shore {
            return if swell > 0.35 { WATER_BODY } else { WATER_DEEP };
        }
        return if swell > 0.12 { WATER_BODY } else { WATER_DEEP };
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
pub(crate) fn view_cells(fb: &Framebuffer, cam: &Camera, zone: &Zone) -> Option<(i32, i32, i32, i32)> {
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
    // Perspective corners above the horizon collapse to the camera centre and
    // the far ground can run out to FAR. Clamp to a disc about the size of
    // the iso view so a 3D frame does not rasterize the whole zone.
    if cam.view.is_some() {
        let r = 22.0;
        x0 = x0.max(cam.cx - r);
        x1 = x1.min(cam.cx + r);
        z0 = z0.max(cam.cz - r);
        z1 = z1.min(cam.cz + r);
        if x1 - x0 < 2.0 {
            x0 = cam.cx - r;
            x1 = cam.cx + r;
        }
        if z1 - z0 < 2.0 {
            z0 = cam.cz - r;
            z1 = cam.cz + r;
        }
    }
    let pad = if cam.view.is_some() { 2.0 } else { margin_m };
    let (i0, j0) = zone.cell_of(x0 - pad, z0 - pad);
    let (i1, j1) = zone.cell_of(x1 + pad, z1 + pad);
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

/// 0..6 along the meadow ramp. A broad octave sets the patch, a finer one
/// drifts it, and a slow pocket pulls the top of the ramp into blue-green.
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
    lights: &mut Vec<crate::atmosphere::Light>,
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
                lights.push(crate::atmosphere::Light {
                    x: p.x,
                    y: p.y,
                    r: 120.0 * flick,
                    k: 0.75 * flick,
                });
            }
        }
    }
}

/// Blades on every green ground cell. Trails, water and bridges stay bare.
/// Every zone uses the same pass; nothing is placed per map.
/// `breeze` 0..1 scales gust and blade sway (0 during rain).
pub fn draw_meadow_grass(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    cam_y: f32,
    time: f32,
    breeze: f32,
) {
    let breeze = breeze.clamp(0.0, 1.0);
    let Some((i0, j0, i1, j1)) = view_cells(fb, cam, zone) else { return };
    let cell = zone.cell;
    let cols = [
        crate::palette::MEADOW_DEEP,
        crate::palette::MEADOW_D,
        crate::palette::MEADOW,
        crate::palette::MEADOW_MID,
        crate::palette::MEADOW_L,
        crate::palette::MEADOW_SUN,
        crate::palette::MEADOW_BLUE,
    ];
    let gust = grass_gust(time) * breeze;
    for j in j0..=j1 {
        for i in i0..=i1 {
            let k = zone.idx(i, j);
            let biome = zone.biome[k];
            if !GREEN_GROUND.contains(&biome) {
                continue;
            }
            let f = zone.flags[k];
            if f & (F_WATER | F_BRIDGE | F_TRAIL) != 0 {
                continue;
            }
            let h = cell_hash(i, j);
            let x = zone.min_x + i as f32 * cell;
            let z = zone.min_z + j as f32 * cell;
            let y = zone.height[k] - cam_y;
            let n = 7 + (h & 1) as usize;
            let wave = (time * 1.35 - x * 0.55 - z * 0.22).sin();
            for b in 0..n {
                let hb = cell_hash(i.wrapping_mul(13) + b as i32, j.wrapping_mul(17) ^ h as i32);
                let u = (hb & 255) as f32 / 255.0;
                let v = ((hb >> 8) & 255) as f32 / 255.0;
                let lean = ((hb >> 16) & 255) as f32 / 255.0 - 0.5;
                let ox = (u - 0.15) * cell;
                let oz = (v - 0.15) * cell;
                let ht = 0.14 + 0.2 * (((hb >> 4) & 255) as f32 / 255.0);
                let shiver = (time * 2.4 + x * 1.7 + b as f32).sin() * 0.012 * breeze;
                let sway = shiver + gust * wave * (0.07 + 0.05 * (hb & 1) as f32);
                let root = cam.project(v3(x + ox, y, z + oz));
                let tip = cam.project(v3(
                    x + ox + lean * 0.04 + sway,
                    y + ht,
                    z + oz + lean * 0.03,
                ));
                let col = grass_blade_color(&cols, i, j, (hb & 255) as f32 / 255.0);
                fb.line(root, tip, col);
            }
        }
    }
}

/// Draw the zone. `cam_y` is subtracted from all heights so the camera's
/// reference height sits at the screen centre line.
pub fn draw_zone(fb: &mut Framebuffer, cam: &Camera, zone: &Zone, cam_y: f32, time: f32) {
    draw_zone_in(fb, cam, zone, cam_y, time, true);
}

/// `clear` fills the framebuffer with sky first. Concurrent zones pass false
/// so a later zone does not erase one already drawn.
pub(crate) fn draw_zone_in(fb: &mut Framebuffer, cam: &Camera, zone: &Zone, cam_y: f32, time: f32, clear: bool) {
    if clear {
        fb.color.fill(crate::atmosphere::SKY);
    }
    let Some((i0, j0, i1, j1)) = view_cells(fb, cam, zone) else {
        return;
    };
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
            if p00.culled() || p10.culled() || p01.culled() || p11.culled() {
                continue;
            }
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
                    continue;
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
                continue;
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
