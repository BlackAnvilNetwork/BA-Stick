// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Zone weather overlays — snow on ground (blanket) and generative canopy tint,
//! screen-space rain/snow, atmosphere tuning via Scene.

use stick_engine::camera::{Camera, P2};
use stick_engine::math::v3;
use stick_engine::raster::Framebuffer;

use crate::atmosphere::{FOG_DEPTH_SANITY, SKY};
use crate::ground::{cell_hash, fill_tri, view_cells};
use crate::palette::{ROCK, ROCK_L, WALL_L};
use crate::zone::{F_BRIDGE, F_WATER, Zone};

/// Biomes that stay bare (forge heat / lava).
const NO_SNOW_BIOME: [u8; 2] = [8, 10];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Clear = 0,
    Rain = 1,
    Fog = 2,
    Snow = 3,
}

impl Kind {
    pub fn from_u8(v: u8) -> Kind {
        match v {
            1 => Kind::Rain,
            2 => Kind::Fog,
            3 => Kind::Snow,
            _ => Kind::Clear,
        }
    }
}

fn snow_hash(i: i32, j: i32) -> f32 {
    (cell_hash(i.wrapping_mul(17), j.wrapping_mul(19).wrapping_add(0x5a17)) & 1023) as f32
        / 1023.0
}

/// Stable 0..1 melt order for foliage at a world spot (matches ground patch dissolve).
pub(crate) fn snow_keep_at(x: f32, z: f32, salt: i32) -> f32 {
    snow_hash((x * 3.1) as i32 ^ salt.wrapping_mul(41), (z * 3.7) as i32)
}

fn snow_tone(h: u32) -> u8 {
    if (h & 3) == 0 {
        WALL_L
    } else {
        ROCK_L
    }
}

/// Stable cover for drawing (avoids patches popping every frame while lerping).
pub fn snow_cover_display(cover: f32, melting: bool) -> f32 {
    let c = cover.clamp(0.0, 1.0);
    if c >= 0.99 {
        return 1.0;
    }
    let steps = if melting { 40.0 } else { 24.0 };
    (c * steps).floor() / steps
}

/// Patch dissolve for melt; whole-cell fill while snow is building up.
fn fill_tri_snow(
    fb: &mut Framebuffer,
    a: P2,
    b: P2,
    c: P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    cell_i: i32,
    cell_j: i32,
    cover: f32,
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
    let s = area.signum();
    let cover = cover.clamp(0.0, 1.0);
    let w = fb.w;
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)) * s;
            let w1 = ((c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x)) * s;
            let w2 = ((a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x)) * s;
            if w0 < 0.0 || w1 < 0.0 || w2 < 0.0 {
                continue;
            }
            let u = ua.0 * w0 + ub.0 * w1 + uc.0 * w2;
            let v = ua.1 * w0 + ub.1 * w1 + uc.1 * w2;
            // World-locked patches melt in fixed order as cover falls (no screen static).
            let pu = (u * 4.0).floor() as i32 & 3;
            let pv = (v * 4.0).floor() as i32 & 3;
            let order = snow_hash(
                cell_i.wrapping_mul(4).wrapping_add(pu),
                cell_j.wrapping_mul(4).wrapping_add(pv),
            );
            if order > cover {
                continue;
            }
            let h = cell_hash(cell_i, cell_j) ^ cell_hash(pu, pv);
            fb.color[y as usize * w + x as usize] = snow_tone(h);
        }
    }
}

fn land_cell(zone: &Zone, i: i32, j: i32) -> bool {
    if i < 0 || j < 0 || i >= zone.w as i32 || j >= zone.h as i32 {
        return false;
    }
    let k = zone.idx(i, j);
    if zone.flags[k] & (F_WATER | F_BRIDGE) != 0 {
        return false;
    }
    !NO_SNOW_BIOME.contains(&zone.biome[k])
}

/// Snow blanket on all walkable ground (trails, rock, meadow), not water/bridge/lava.
pub fn draw_snow_ground(
    fb: &mut Framebuffer,
    cam: &Camera,
    zone: &Zone,
    cam_y: f32,
    cover: f32,
    melting: bool,
) {
    if cover < 0.02 {
        return;
    }
    let cover = snow_cover_display(cover, melting);
    if cover < 0.02 {
        return;
    }
    let Some((i0, j0, i1, j1)) = view_cells(fb, cam, zone) else {
        return;
    };
    let c = zone.cell;
    let pt = |i: i32, j: i32| {
        let h = zone.height[zone.idx(i, j)] - cam_y;
        cam.project(v3(zone.min_x + i as f32 * c, h + 0.012, zone.min_z + j as f32 * c))
    };
    let full_blanket = cover >= 0.99;
    let cell_accum = !melting && !full_blanket;
    for s in (i0 + j0)..=(i1 + j1) {
        let ilo = i0.max(s - j1);
        let ihi = i1.min(s - j0);
        for i in ilo..=ihi {
            let j = s - i;
            if !land_cell(zone, i, j) {
                continue;
            }
            let (p00, p10, p01, p11) = (pt(i, j), pt(i + 1, j), pt(i, j + 1), pt(i + 1, j + 1));
            if p00.culled() || p10.culled() || p01.culled() || p11.culled() {
                continue;
            }
            if p11.y < -2.0 || p00.y > fb.h as f32 + 2.0 + 300.0 {
                continue;
            }
            if full_blanket {
                let col = snow_tone(cell_hash(i, j) as u32);
                fill_tri(fb, p00, p10, p11, col);
                fill_tri(fb, p00, p11, p01, col);
                continue;
            }
            if cell_accum {
                if snow_hash(i, j) > cover {
                    continue;
                }
                let col = snow_tone(cell_hash(i, j) as u32);
                fill_tri(fb, p00, p10, p11, col);
                fill_tri(fb, p00, p11, p01, col);
                continue;
            }
            fill_tri_snow(
                fb,
                p00,
                p10,
                p11,
                (0.0, 0.0),
                (1.0, 0.0),
                (1.0, 1.0),
                i,
                j,
                cover,
            );
            fill_tri_snow(
                fb,
                p00,
                p11,
                p01,
                (0.0, 0.0),
                (1.0, 1.0),
                (0.0, 1.0),
                i,
                j,
                cover,
            );
        }
    }
}

/// Uniform in [0, 1). Fully mixed, so (x, y, t) behave as independent streams.
fn precip_hash(x: i32, y: i32, t: i32) -> f32 {
    let mut n = (x as u32).wrapping_mul(0x9E37_79B1)
        ^ (y as u32).wrapping_mul(0x85EB_CA6B)
        ^ (t as u32).wrapping_mul(0xC2B2_AE35);
    n ^= n >> 16;
    n = n.wrapping_mul(0x7FEB_352D);
    n ^= n >> 15;
    n = n.wrapping_mul(0x846C_A68B);
    n ^= n >> 16;
    (n >> 8) as f32 / 16_777_216.0
}

/// Rain and/or falling snow in screen space (after the world, before RGBA).
pub fn draw_precip(
    fb: &mut Framebuffer,
    time: f64,
    cover: f32,
    rain_intensity: f32,
    snow_intensity: f32,
) {
    if rain_intensity > 0.01 {
        draw_rain(fb, time, rain_intensity);
    }
    if snow_intensity > 0.01 {
        draw_falling_snow(fb, time, cover, snow_intensity);
    }
}

/// Plot one weather pixel.
/// Terrain is filled colour-only (`fill_tri` never writes depth), so bare ground has no
/// usable depth: write the colour straight in and leave the depth buffer alone. Over an
/// object (finite depth in range, the same test atmosphere.rs uses) draw depth-tested just
/// in front of it. Sky is never touched.
fn weather_px(fb: &mut Framebuffer, x: i32, y: i32, c: u8) {
    if x < 0 || y < 0 || x >= fb.w as i32 || y >= fb.h as i32 {
        return;
    }
    let idx = (y as usize) * fb.w + x as usize;
    if fb.color[idx] == SKY {
        return;
    }
    let d = fb.depth[idx];
    if d.is_finite() && d > 0.0 && d < FOG_DEPTH_SANITY {
        fb.plot(x, y, d - 0.001, c);
        return;
    }
    // Bare terrain (no depth written): streak on ground colour only.
    fb.color[idx] = c;
}

macro_rules! wplot {
    ($fb:expr, $x:expr, $y:expr, $c:expr) => {
        weather_px($fb, $x, $y, $c)
    };
}

const RAIN_LEAN: f32 = 0.28;

fn fall_phase_f64(time: f64, period: f64, off: f64) -> (i32, f64) {
    let p = time / period + off;
    let c = p.floor();
    (c as i32, p - c)
}

/// Each drop: fall to a ground spot, splash there, rest, then pick a new spot.
/// Every drop has its own period, and the head moves at a constant speed, so it lands
/// exactly where it splashes. The streak is a pure function of `time` (no state).
fn draw_rain(fb: &mut Framebuffer, time: f64, intensity: f32) {
    let w = fb.w as f64;
    let hf = fb.h as f64;
    let sc = (hf / 180.0).max(1.0);
    let drops = (((fb.w * fb.h) as f32 / 36.0 * intensity.clamp(0.0, 1.0)) as i32).clamp(80, 1600);
    let lean = RAIN_LEAN as f64;

    for n in 0..drops {
        let near = precip_hash(n, 0, 1) < 0.35;
        let v = precip_hash(n, 0, 2) as f64;
        let off = precip_hash(n, 0, 3) as f64;
        let (speed, len) = if near {
            ((210.0 + v * 70.0) * sc, ((5.0 * sc).round() as i32).max(2))
        } else {
            ((120.0 + v * 40.0) * sc, ((3.0 * sc).round() as i32).max(2))
        };
        let rest = 0.25 + precip_hash(n, 0, 6) as f64 * 0.55;
        let splash = 0.07 + precip_hash(n, 0, 7) as f64 * 0.05;
        // Fixed period (longest possible fall) so cycle numbers never jump mid-drop.
        let max_fall = (hf + len as f64 + 4.0) / speed;
        let period = rest + splash + max_fall;
        let (cyc, u) = fall_phase_f64(time, period, off);
        let t = u * period; // seconds into this cycle

        let ground_y = hf * (0.38 + precip_hash(n, cyc, 5) as f64 * 0.58) - len as f64 * 0.5;
        let land_x = precip_hash(n, cyc, 4) as f64 * w;
        let fall_d = (ground_y + len as f64) / speed; // this cycle's fall time

        if t < fall_d {
            // head moves at `speed` and reaches (land_x, ground_y) at t = fall_d
            let head_y = t * speed - len as f64;
            let head_x = land_x - (ground_y - head_y) * lean;
            for k in 0..len {
                let px = (head_x - k as f64 * lean).round() as i32;
                let py = (head_y - k as f64).round() as i32;
                if near && k < 2 {
                    wplot!(fb, px, py, ROCK_L);
                } else {
                    wplot!(fb, px, py, ROCK);
                }
            }
        } else if t < fall_d + splash {
            let age = (t - fall_d) / splash;
            let xl = land_x.round() as i32;
            let yl = ground_y.round() as i32;
            if age < 0.55 {
                wplot!(fb, xl - 1, yl, ROCK_L);
                wplot!(fb, xl, yl, ROCK_L);
                wplot!(fb, xl + 1, yl, ROCK_L);
            } else {
                wplot!(fb, xl - 2, yl, ROCK);
                wplot!(fb, xl + 2, yl, ROCK);
            }
        }
    }
}

fn draw_falling_snow(fb: &mut Framebuffer, time: f64, cover: f32, intensity: f32) {
    let w = fb.w as i32;
    let h = fb.h as i32;
    let hf = h as f64;
    let sc = (hf / 180.0).max(1.0);
    let density = (0.18 + cover.clamp(0.0, 1.0) * 0.22) * intensity.clamp(0.0, 1.0);
    let flakes = (((w * h) as f32 / 22.0 * density) as i32).clamp(0, 4096);
    let span = hf + 8.0 * sc;
    for n in 0..flakes {
        let near = precip_hash(n, 0, 14) < 0.15;
        let v = precip_hash(n, 0, 13);
        let off = precip_hash(n, 0, 12) as f64;
        let speed = if near {
            (46.0 + v as f64 * 18.0) * sc
        } else {
            (22.0 + v as f64 * 16.0) * sc
        };
        let period = span / speed;
        let (cyc, f) = fall_phase_f64(time, period, off);
        let y = (f * span - 4.0 * sc).round() as i32;
        let amp = (if near { 2.5 } else { 1.5 }) * sc as f32;
        // phase in f64 so sin() stays smooth in long sessions
        let sway = ((time * (0.6 + v as f64 * 0.8) + off * std::f64::consts::TAU).sin() as f32
            * amp)
            .round();
        let x = (precip_hash(n, cyc, 11) * w as f32 + sway) as i32;
        let size = if near {
            ((2.0 * sc).round() as i32).max(2)
        } else {
            (sc.round() as i32).max(1)
        };
        for dy in 0..size {
            for dx in 0..size {
                wplot!(fb, x + dx, y + dy, WALL_L);
            }
        }
    }
}
