// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Atmosphere (#26): per-pixel light at RGB conversion time. Cool ambient,
//! warm radial campfire pools with flicker, distance haze toward the
//! horizon colour, a pixel skyline behind the zone edge, and a vignette.
//! Emissive palette entries (fire, FX, floaters) skip the ambient/haze so they
//! read as "glow" without a bloom pass.
use crate::palette::*;

/// Shared sun direction (round 1 polish): unit vector pointing *toward* the
/// sun, from the screen's upper-left (NW) and above. Light falls on NW faces;
/// shadows fall SE (screen lower-right). Read by contact shadows (S2) and
/// terrain/prop shading.
pub const SUN_DIR: [f32; 3] = [-0.6835, 0.7071, -0.1810];

/// Ground-plane offset (x, z) for a contact shadow of footprint radius `r`:
/// a fraction of `r` along -SUN_DIR projected onto the ground.
pub fn shadow_offset(r: f32) -> (f32, f32) {
    let (x, z) = (-SUN_DIR[0], -SUN_DIR[2]);
    let l = (x * x + z * z).sqrt();
    (x / l * r * 0.25, z / l * r * 0.25)
}

/// Framebuffer index left where no terrain was drawn (sky / beyond bounds).
pub const SKY: u8 = 141;

#[derive(Clone, Copy, Debug)]
pub struct Light {
    pub x: f32,
    pub y: f32,
    /// Radius in px (horizontal; vertical is halved for the iso ground).
    pub r: f32,
    pub k: f32,
}

#[derive(Clone, Copy)]
pub struct Params {
    pub ambient: [f32; 3],
    pub warm: [f32; 3],
    pub haze: u32,
    pub sky_top: u32,
    pub vignette: f32,
    /// Distance haze multiplier (thick fog uses ~2.6).
    pub haze_strength: f32,
    /// 0..1 — depth buffer drives fog instead of screen row (fog weather ~1.0).
    pub fog_depth: f32,
    /// 0..1 — drifting mist banks (fog ~0.6, light rain ~0.15).
    pub bank: f32,
}

pub const PALE_HOLLOW: Params = Params {
    ambient: [0.82, 0.86, 0.98],
    warm: [0.62, 0.34, 0.08],
    haze: 0x6e6a7c,
    sky_top: 0x1e1b2c,
    vignette: 0.32,
    haze_strength: 1.0,
    fog_depth: 0.0,
    bank: 0.0,
};

pub const FORGE_MENU: Params = Params {
    ambient: [0.14, 0.11, 0.1],
    warm: [1.05, 0.52, 0.14],
    haze: 0x682818,
    sky_top: 0x0a0608,
    vignette: 0.42,
    haze_strength: 1.0,
    fog_depth: 0.0,
    bank: 0.0,
};

/// Per-frame inputs for atmosphere (time, depth buffer).
pub struct Extra<'a> {
    pub time: f32,
    /// Same length as framebuffer colour; 0 = undrawn.
    pub depth: Option<&'a [f32]>,
    /// Screen px — fog thins within ~2 m of the followed unit's feet.
    pub clear_center: Option<(f32, f32)>,
    pub clear_radius_px: f32,
    /// Third/first-person pixel sky (#sky). `None` keeps the iso gradient + skyline.
    pub sky: Option<crate::sky::SkyCtx>,
}

impl Extra<'_> {
    pub const NONE: Extra<'static> = Extra {
        time: 0.0,
        depth: None,
        clear_center: None,
        clear_radius_px: 0.0,
        sky: None,
    };
}

/// World depth at which fog is essentially opaque (silhouette like the reference).
const FOG_FAR: f32 = 95.0;
/// Depth values at or above this are treated as "no depth" (e.g. cleared buffer).
pub(crate) const FOG_DEPTH_SANITY: f32 = 600.0;
const FOG_STEPS: f32 = 5.0;
const BANK_CELL: usize = 8;
const BAYER4: [f32; 16] = [
    0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.,
];

use crate::weather::Kind as WeatherKind;

/// Pale Hollow sky/lighting for the active weather roll.
pub fn pale_hollow_weather(base: &Params, kind: WeatherKind) -> Params {
    let mut p = *base;
    match kind {
        WeatherKind::Clear => {
            p.ambient = [0.94, 0.93, 0.98];
            p.haze_strength = 0.65;
            p.vignette = 0.24;
            p.fog_depth = 0.0;
            p.bank = 0.0;
        }
        WeatherKind::Rain => {
            p.ambient = [0.48, 0.50, 0.56];
            p.warm = [0.38, 0.28, 0.12];
            p.haze = 0x4a4e58;
            p.sky_top = 0x101218;
            p.haze_strength = 1.35;
            p.vignette = 0.40;
            p.fog_depth = 0.0;
            p.bank = 0.15;
        }
        WeatherKind::Fog => {
            // Cold, desaturated volume — near grass readable, far props fade to grey silhouettes.
            p.ambient = [0.58, 0.60, 0.66];
            p.haze = 0x848c98;
            p.sky_top = 0xc4cad4;
            p.haze_strength = 1.55;
            p.vignette = 0.20;
            p.fog_depth = 1.0;
            p.bank = 0.68;
        }
        WeatherKind::Snow => {
            p.ambient = [0.86, 0.88, 0.96];
            p.haze = 0xa8b4c8;
            p.sky_top = 0x283040;
            p.haze_strength = 1.15;
            p.vignette = 0.30;
            p.fog_depth = 0.0;
            p.bank = 0.0;
        }
    }
    p
}

fn lerp_f(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn lerp_rgb(a: u32, b: u32, t: f32) -> u32 {
    let lerp = |c: u32| {
        let ca = ((a >> c) & 255) as f32;
        let cb = ((b >> c) & 255) as f32;
        lerp_f(ca, cb, t).round() as u32
    };
    (lerp(16) << 16) | (lerp(8) << 8) | lerp(0)
}

/// Smooth sky/lighting between two weather spells (t 0..1).
pub fn lerp_params(a: Params, b: Params, t: f32) -> Params {
    let t = t.clamp(0.0, 1.0);
    Params {
        ambient: [
            lerp_f(a.ambient[0], b.ambient[0], t),
            lerp_f(a.ambient[1], b.ambient[1], t),
            lerp_f(a.ambient[2], b.ambient[2], t),
        ],
        warm: [
            lerp_f(a.warm[0], b.warm[0], t),
            lerp_f(a.warm[1], b.warm[1], t),
            lerp_f(a.warm[2], b.warm[2], t),
        ],
        haze: lerp_rgb(a.haze, b.haze, t),
        sky_top: lerp_rgb(a.sky_top, b.sky_top, t),
        vignette: lerp_f(a.vignette, b.vignette, t),
        haze_strength: lerp_f(a.haze_strength, b.haze_strength, t),
        fog_depth: lerp_f(a.fog_depth, b.fog_depth, t),
        bank: lerp_f(a.bank, b.bank, t),
    }
}

fn ihash(x: i32, y: i32) -> f32 {
    let mut n = (x as u32).wrapping_mul(0x9E37_79B1) ^ (y as u32).wrapping_mul(0x85EB_CA6B);
    n ^= n >> 15;
    n = n.wrapping_mul(0x2C1B_3C6D);
    n ^= n >> 12;
    (n >> 8) as f32 / 16_777_216.0
}

fn noise2(x: f32, y: f32) -> f32 {
    let (xi, yi) = (x.floor(), y.floor());
    let (fx, fy) = (x - xi, y - yi);
    let (sx, sy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
    let (xi, yi) = (xi as i32, yi as i32);
    let a = ihash(xi, yi) + (ihash(xi + 1, yi) - ihash(xi, yi)) * sx;
    let b = ihash(xi, yi + 1) + (ihash(xi + 1, yi + 1) - ihash(xi, yi + 1)) * sx;
    a + (b - a) * sy
}

fn meadow_blade(c: u8) -> bool {
    use crate::palette::{
        MEADOW, MEADOW_BLUE, MEADOW_D, MEADOW_DEEP, MEADOW_L, MEADOW_MID, MEADOW_SUN,
    };
    matches!(
        c,
        MEADOW_DEEP | MEADOW_D | MEADOW | MEADOW_MID | MEADOW_L | MEADOW_SUN | MEADOW_BLUE
    )
}

pub(crate) fn emissive(c: u8) -> bool {
    matches!(c, 9 | 11 | 14)
        || (80..=90).contains(&c)
        || c == COAL
        || c == EMBER
        || (FN_DMG..=FN_MISS).contains(&c)
        || c == BLOOM_C
}

fn rgb(c: u32) -> [f32; 3] {
    [
        ((c >> 16) & 255) as f32,
        ((c >> 8) & 255) as f32,
        (c & 255) as f32,
    ]
}

fn hash(n: i32) -> f32 {
    let s = (n as f32 * 12.9898).sin() * 43758.547;
    s - s.floor()
}

/// Smooth 1-D value noise.
fn noise(x: f32) -> f32 {
    let i = x.floor();
    let f = x - i;
    let (a, b) = (hash(i as i32), hash(i as i32 + 1));
    a + (b - a) * f * f * (3.0 - 2.0 * f)
}

/// Height (px above `base`) of a skyline layer at screen column `x`.
fn ridge(x: f32, scroll: f32, scale: f32, amp: f32, seed: f32) -> f32 {
    let u = (x + scroll) / scale + seed;
    amp * (0.6 * noise(u) + 0.3 * noise(u * 2.3) + 0.1 * noise(u * 5.1))
}

/// Convert indexed colour to RGBA with lighting. `scroll` = camera screen
/// offset in px (for skyline parallax).
#[allow(clippy::too_many_arguments)]
pub fn write_rgba(
    pal: &[u32; 256],
    color: &[u8],
    w: usize,
    h: usize,
    lights: &[Light],
    p: &Params,
    scroll: f32,
    out: &mut [u8],
) {
    write_rgba_key(pal, color, w, h, lights, p, scroll, false, Extra::NONE, out);
}

/// Key-light strength (L2): lit ramp steps warm up, shadow steps cool down.
pub const KEY_LIT: [f32; 3] = [1.07, 1.06, 1.03];
pub const KEY_SHADE: [f32; 3] = [0.93, 0.94, 0.98];

/// Ramp step of a palette index for the key light: Some(0) lit, Some(2)
/// shadow, Some(1) mid, None = not on a known ramp (unchanged).
pub fn key_step(c: u8) -> Option<u8> {
    if let Some(s) = crate::dither::shade_step(c) {
        return Some(s);
    }
    match c {
        PINE_L | ASH_L | GRASS_L | ROCK_L | WALL_L | WOOD_L | BANK_L => Some(0),
        PINE_D | ASH_D | CYP_D | GRASS_D | ROCK_D | WALL_D | WOOD_D | BANK_D | BANK_DD
        | OLIVE_D | BEIGE_D => Some(2),
        _ => None,
    }
}

/// `write_rgba` with an optional directional key light (L2). The key light is
/// folded into the per-index colour table, so it costs no per-pixel work.
#[allow(clippy::too_many_arguments)]
pub fn write_rgba_key(
    pal: &[u32; 256],
    color: &[u8],
    w: usize,
    h: usize,
    lights: &[Light],
    p: &Params,
    scroll: f32,
    key: bool,
    ex: Extra<'_>,
    out: &mut [u8],
) {
    let haze = rgb(p.haze);
    let top = rgb(p.sky_top);
    let (cx, cy) = (w as f32 * 0.5, h as f32 * 0.5);
    // per-index colour and emissive flag
    let mut lut = [[0f32; 3]; 256];
    let mut emis = [false; 256];
    for c in 0..256 {
        lut[c] = rgb(pal[c]);
        emis[c] = emissive(c as u8);
        if key && !emis[c] {
            let m = match key_step(c as u8) {
                Some(0) => KEY_LIT,
                Some(2) => KEY_SHADE,
                _ => [1.0; 3],
            };
            for k in 0..3 {
                lut[c][k] *= m[k];
            }
        }
    }
    // separable vignette
    let vx: Vec<f32> = (0..w).map(|x| ((x as f32 - cx) / cx).powi(2)).collect();
    let glow = 1.0 + 0.5 * (p.haze_strength - 1.0).max(0.0).min(1.7) / 1.7;
    // warm-light buffer, only filled inside each light's box
    let mut warm = vec![0f32; w * h];
    for l in lights {
        let (rx, ry) = (l.r * glow, l.r * glow * 0.55);
        let (x0, x1) = (
            (l.x - rx).max(0.0) as usize,
            ((l.x + rx) as usize + 1).min(w),
        );
        let (y0, y1) = (
            (l.y - ry).max(0.0) as usize,
            ((l.y + ry) as usize + 1).min(h),
        );
        for y in y0..y1 {
            let dy = (y as f32 - l.y) / ry;
            for x in x0..x1 {
                let dx = (x as f32 - l.x) / rx;
                let d2 = dx * dx + dy * dy;
                if d2 < 1.0 {
                    warm[y * w + x] += l.k * (1.0 - d2) * (1.0 - d2);
                }
            }
        }
    }
    let horizon = h as f32 * 0.55;
    let ridges: Vec<(f32, f32)> = (0..w)
        .map(|x| {
            let fx = x as f32;
            (
                horizon - ridge(fx, scroll * 0.15, 60.0, 70.0, 3.0),
                horizon + 30.0 - ridge(fx, scroll * 0.35, 38.0, 80.0, 11.0),
            )
        })
        .collect();
    let (gw, gh) = (w / BANK_CELL + 2, h / BANK_CELL + 2);
    let mut bank_grid = vec![0f32; gw * gh];
    if p.bank > 0.0 {
        let hf = h as f32;
        for gy in 0..gh {
            for gx in 0..gw {
                let (px, py) = ((gx * BANK_CELL) as f32, (gy * BANK_CELL) as f32);
                let u = (px + scroll * 0.6) / 90.0 + ex.time * 0.04;
                let v = py / 34.0;
                let n = 0.65 * noise2(u, v) + 0.35 * noise2(u * 2.3 + 7.0, v * 2.3);
                let t = ((n - 0.46) / 0.34).clamp(0.0, 1.0);
                let dens = t * t * (3.0 - 2.0 * t);
                // Low cloud deck + drifting patches (reference: ground darker, sky washed).
                bank_grid[gy * gw + gx] = dens * (0.40 + 0.60 * (1.0 - py / hf).powf(1.15));
            }
        }
    }
    let bank_at = |x: usize, y: usize| -> f32 {
        if p.bank <= 0.0 {
            return 0.0;
        }
        let (fx, fy) = (x as f32 / BANK_CELL as f32, y as f32 / BANK_CELL as f32);
        let (gx, gy) = (fx as usize, fy as usize);
        let (tx, ty) = (fx.fract(), fy.fract());
        let g = |a: usize, b: usize| bank_grid[b * gw + a];
        let top = g(gx, gy) + (g(gx + 1, gy) - g(gx, gy)) * tx;
        let bot = g(gx, gy + 1) + (g(gx + 1, gy + 1) - g(gx, gy + 1)) * tx;
        top + (bot - top) * ty
    };
    for y in 0..h {
        let fy = y as f32;
        let far_row = (1.0 - fy / h as f32).powi(2) * 0.28 * p.haze_strength;
        let far = far_row * (1.0 - p.fog_depth * 0.92);
        let vy = ((fy - cy) / cy).powi(2);
        let t = (fy / h as f32).clamp(0.0, 1.0);
        let sky = [
            top[0] + (haze[0] - top[0]) * t,
            top[1] + (haze[1] - top[1]) * t,
            top[2] + (haze[2] - top[2]) * t,
        ];
        for x in 0..w {
            let i = y * w + x;
            let c = color[i];
            let v = if c == SKY && ex.sky.is_some() {
                ex.sky.as_ref().map(|s| s.shade(x, y)).unwrap_or([0.0; 3])
            } else if c == SKY {
                let (far_r, near_r) = ridges[x];
                let mut v = if fy > near_r {
                    [sky[0] * 0.55, sky[1] * 0.55, sky[2] * 0.62]
                } else if fy > far_r {
                    [sky[0] * 0.78, sky[1] * 0.78, sky[2] * 0.84]
                } else {
                    sky
                };
                if p.fog_depth > 0.5 {
                    let cloud = bank_at(x, y) * p.bank;
                    let wash = (0.22 + t * 0.35 + cloud * 0.12).min(0.72);
                    for k in 0..3 {
                        v[k] = v[k] * (1.0 - wash) + haze[k] * wash;
                    }
                }
                v
            } else {
                let mut v = lut[c as usize];
                if emis[c as usize] && meadow_blade(c) {
                    // Meadow indices share the floater (emissive) range, so they skip
                    // ambient; in 3D still let the time of day dim them.
                    if let Some(s) = ex.sky.as_ref() {
                        let m = crate::sky::ambient_scale(s.phase);
                        for k in 0..3 {
                            v[k] *= m[k];
                        }
                    }
                }
                if !emis[c as usize] {
                    let wm = warm[i];
                    let cloud = bank_at(x, y);
                    let mut fog = far;
                    let mut depth_fog = 0.0f32;
                    if let Some(dp) = ex.depth {
                        let d = dp[i];
                        if d.is_finite() && d > 0.0 && d < FOG_DEPTH_SANITY {
                            let dn = (d / FOG_FAR).clamp(0.0, 1.0);
                            depth_fog = dn.powf(2.05) * 0.52 * p.haze_strength;
                            fog = far * (1.0 - p.fog_depth) + depth_fog * p.fog_depth;
                        }
                    }
                    if p.fog_depth > 0.0 {
                        let mist = cloud * p.bank * (0.22 + depth_fog * 0.35);
                        fog = (fog + mist).min(0.88);
                        if meadow_blade(c) {
                            fog = (fog + 0.06 * p.fog_depth + cloud * p.bank * 0.10).min(0.88);
                        }
                    } else {
                        fog += cloud * p.bank * 0.4;
                    }
                    if p.fog_depth > 0.0 {
                        if let Some((ax, ay)) = ex.clear_center {
                            let r = ex.clear_radius_px.max(8.0);
                            let dist = ((x as f32 - ax).powi(2) + (y as f32 - ay).powi(2)).sqrt();
                            let t = (dist / r).clamp(0.0, 1.0);
                            let clear = t * t * (3.0 - 2.0 * t);
                            fog *= clear;
                        }
                    }
                    let th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16.0;
                    let cap = if p.fog_depth > 0.5 { 0.88 } else { 0.95 };
                    let fog = (((fog.min(cap)) * FOG_STEPS + th).floor() / FOG_STEPS).min(cap);
                    for k in 0..3 {
                        v[k] *= p.ambient[k] + wm * p.warm[k];
                        v[k] += (haze[k] - v[k]) * fog;
                    }
                }
                v
            };
            let r2 = (vx[x] + vy) * 0.5;
            let vg = 1.0 - p.vignette * if r2 >= 1.0 { 1.0 } else { r2 * r2.sqrt() };
            let o = &mut out[i * 4..i * 4 + 4];
            o[0] = (v[0] * vg).clamp(0.0, 255.0) as u8;
            o[1] = (v[1] * vg).clamp(0.0, 255.0) as u8;
            o[2] = (v[2] * vg).clamp(0.0, 255.0) as u8;
            o[3] = 255;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn campfire_warms_and_ambient_cools() {
        let pal = palette();
        let (w, h) = (64, 36);
        let color = vec![BIOME0 + 13 * 3 + 1; w * h];
        let mut lit = vec![0u8; w * h * 4];
        let light = [Light {
            x: 32.0,
            y: 18.0,
            r: 20.0,
            k: 1.0,
        }];
        write_rgba(&pal, &color, w, h, &light, &PALE_HOLLOW, 0.0, &mut lit);
        let px = |b: &[u8], x: usize, y: usize| {
            let i = (y * w + x) * 4;
            (b[i] as i32, b[i + 1] as i32, b[i + 2] as i32)
        };
        let (c, e) = (px(&lit, 32, 18), px(&lit, 2, 18));
        assert!(c.0 > e.0 + 20, "warm pool is brighter red: {c:?} vs {e:?}");
        assert!(c.0 - c.2 > e.0 - e.2, "pool is warmer");
        // emissive colours skip the ambient multiply
        let mut col2 = color.clone();
        col2[18 * w + 32] = EMBER;
        let mut out2 = vec![0u8; w * h * 4];
        write_rgba(&pal, &col2, w, h, &[], &PALE_HOLLOW, 0.0, &mut out2);
        assert!(px(&out2, 32, 18).0 >= 240);
    }

    #[test]
    fn sky_fills_void() {
        let pal = palette();
        let (w, h) = (32, 32);
        let color = vec![SKY; w * h];
        let mut out = vec![0u8; w * h * 4];
        write_rgba(&pal, &color, w, h, &[], &PALE_HOLLOW, 0.0, &mut out);
        // top darker than bottom
        assert!(
            out[(16) * 4 + 2] < out[((h - 1) * w + 16) * 4 + 2]
                || out[(16) * 4] < out[((h - 1) * w + 16) * 4]
        );
    }
}
