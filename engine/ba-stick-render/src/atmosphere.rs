// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Atmosphere (#26): per-pixel weather tint at RGB conversion time, camera-relative
//! aerial haze toward the zone horizon colour, a pixel skyline behind the zone
//! edge, and a vignette. Emissive palette entries (fire, FX, floaters) skip the
//! tint/haze. Light sources live in `lighting.rs`.
use crate::palette::*;
use stick_engine::camera::{Camera, GroundMap, NEAR};

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

/// Draw-distance slider default (live iso 56 m / 3D FAR 60 m).
pub const DRAW_DEFAULT: f32 = 0.55;
/// Extra metres so a hare or flax stand at the FAR disc does not flicker.
pub const UNIT_DRAW_SLACK: f32 = 4.0;
/// Atmosphere slider default (optical-depth scale ~1.07× zone hazeBase).
pub const ATMO_DEFAULT: f32 = 0.45;
/// TP/FP: metres of eye-distance that stay clear (boom is ~6 m, so the body is inside this).
const CLEAR_EYE_M: f32 = 8.0;
/// Iso view-depth on 640×360 is only ~9 m to the top of the frame. An 8 m deadzone
/// would hide all haze. Feet already sit at s≈0; 2 m keeps the near grass from milking.
const CLEAR_ISO_M: f32 = 2.0;
/// Mix cap: haze never fully replaces the pixel.
const MIX_CAP: f32 = 0.72;

/// Piecewise lerp through the 0 / 0.55 / 1.0 draw-distance knots.
pub fn piecewise(t: f32, y0: f32, y55: f32, y1: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    if t <= 0.55 {
        y0 + (y55 - y0) * (t / 0.55)
    } else {
        y55 + (y1 - y55) * ((t - 0.55) / 0.45)
    }
}

pub fn iso_prop_m(t: f32) -> f32 {
    piecewise(t, 36.0, 56.0, 80.0)
}

pub fn iso_margin_m(t: f32) -> f32 {
    // Floor 20.5 m so 12 m peaks stay inside the iso cull. Extra pad only as t→1.
    piecewise(t, 20.5, 20.5, 26.0)
}

pub fn far_m(t: f32) -> f32 {
    piecewise(t, 36.0, 60.0, 90.0)
}

/// Player atmosphere slider → multiplier on zone hazeBase / valleyBeta.
pub fn atmosphere_scale(t: f32) -> f32 {
    0.15 + (2.2 - 0.15) * t.clamp(0.0, 1.0)
}

/// Write draw-distance reach onto the camera (pick, far-ground, iso cull, props).
pub fn apply_draw_distance(cam: &mut Camera, t: f32) {
    let t = t.clamp(0.0, 1.0);
    cam.far = far_m(t);
    cam.iso_margin = iso_margin_m(t);
    cam.iso_prop = iso_prop_m(t);
}

#[derive(Clone, Copy)]
pub struct Params {
    /// Weather / zone tint multiplier (bright moods fold their ambient in here).
    pub ambient: [f32; 3],
    pub haze: u32,
    pub sky_top: u32,
    pub vignette: f32,
    /// Weather density multiplier on hazeBase (Clear 0.65 … Fog 1.7). Not a fog wall.
    pub haze_strength: f32,
    /// 0..1 — drifting mist banks (fog ~0.6, light rain ~0.15).
    pub bank: f32,
    /// Aerial β (1/m) before the player slider. Host overwrites per zone.
    pub haze_base: f32,
    /// Valley βh (1/m). Iso only; 3D fill_tri has no world Y.
    pub valley_beta: f32,
    /// Valley scale height H (m).
    pub scale_h: f32,
}

/// Zone aerial look (host `ZONE_ATMOSPHERE`).
#[derive(Clone, Copy, Debug)]
pub struct ZoneLook {
    pub haze_base: f32,
    pub valley_beta: f32,
    pub scale_h: f32,
    pub horizon: u32,
}

/// Config `PH_HORIZON` (terrace × PH_HAZE × daylight). Not raw PH_HAZE.
pub const PALE_HOLLOW_LOOK: ZoneLook = ZoneLook {
    haze_base: 0.012,
    valley_beta: 0.018,
    scale_h: 10.0,
    horizon: 0x918b87,
};

/// A place inside a zone with its own aerial (Ash Pit lake, Mayflower density).
#[derive(Clone, Copy, Debug)]
pub struct AreaLook {
    pub x: f32,
    pub z: f32,
    pub r: f32,
    pub feather: f32,
    pub haze_base: f32,
    pub valley_beta: f32,
    pub scale_h: f32,
    pub horizon: u32,
    pub density: f32,
}

impl AreaLook {
    pub fn weight(&self, x: f32, z: f32) -> f32 {
        let d = ((x - self.x).powi(2) + (z - self.z).powi(2)).sqrt();
        let t = ((d - self.r) / self.feather.max(0.01)).clamp(0.0, 1.0);
        let s = 1.0 - t;
        s * s * (3.0 - 2.0 * s)
    }
}

pub const PALE_HOLLOW: Params = Params {
    ambient: [0.82, 0.86, 0.98],
    haze: 0x6e6a7c,
    sky_top: 0x1e1b2c,
    vignette: 0.32,
    haze_strength: 1.0,
    bank: 0.0,
    haze_base: 0.012,
    valley_beta: 0.018,
    scale_h: 10.0,
};

pub const FORGE_MENU: Params = Params {
    ambient: [0.14, 0.11, 0.1],
    haze: 0x682818,
    sky_top: 0x0a0608,
    vignette: 0.42,
    haze_strength: 1.0,
    bank: 0.0,
    haze_base: 0.004,
    valley_beta: 0.0,
    scale_h: 14.0,
};

/// Per-frame inputs for atmosphere (time, depth buffer, camera for aerial s).
pub struct Extra<'a> {
    pub time: f32,
    /// Same length as framebuffer colour; 0 = undrawn.
    pub depth: Option<&'a [f32]>,
    /// Third/first-person pixel sky (#sky). `None` keeps the iso gradient + skyline.
    pub sky: Option<crate::sky::SkyCtx>,
    pub cam: Option<&'a Camera>,
    pub cam_y: f32,
    pub height_at: Option<&'a dyn Fn(f32, f32) -> f32>,
}

impl Extra<'_> {
    pub const NONE: Extra<'static> = Extra {
        time: 0.0,
        depth: None,
        sky: None,
        cam: None,
        cam_y: 0.0,
        height_at: None,
    };
}

/// Depth values at or above this are treated as "no depth" (e.g. cleared buffer).
pub(crate) const FOG_DEPTH_SANITY: f32 = 600.0;
const FOG_STEPS: f32 = 5.0;
const BANK_CELL: usize = 8;
const BAYER4: [f32; 16] = [
    0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.,
];

use crate::weather::Kind as WeatherKind;

/// Weather density on the same aerial model. Never a fog_depth wall.
pub fn weather_haze_mul(kind: WeatherKind) -> f32 {
    match kind {
        WeatherKind::Clear => 0.65,
        WeatherKind::Rain => 1.25,
        WeatherKind::Fog => 1.7,
        WeatherKind::Snow => 1.1,
    }
}

fn scale_rgb(c: u32, k: f32) -> u32 {
    let ch = |sh: u32| ((((c >> sh) & 255) as f32 * k).round() as u32).min(255) << sh;
    ch(16) | ch(8) | ch(0)
}

/// Build sky/haze Params from the zone look. Mood ambient is folded in later.
pub fn params_from_look(look: ZoneLook) -> Params {
    Params {
        ambient: [1.0; 3],
        haze: look.horizon,
        sky_top: scale_rgb(look.horizon, 0.35),
        vignette: if look.valley_beta <= 0.0 { 0.42 } else { 0.32 },
        haze_strength: 1.0,
        bank: 0.0,
        haze_base: look.haze_base,
        valley_beta: look.valley_beta,
        scale_h: look.scale_h,
    }
}

/// Weather is density only: haze_strength. Horizon / sky_top / bank stay on the zone look.
pub fn pale_hollow_weather(base: &Params, kind: WeatherKind) -> Params {
    let mut p = *base;
    p.haze_strength = weather_haze_mul(kind);
    p
}

/// Same predicate as `Scene::sky_ctx`: keep iso aerial s while the iso→TP skew is still > 0.5.
pub fn aerial_iso(cam: &Camera) -> bool {
    cam.view.map_or(true, |v| v.skew > 0.5)
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
        haze: lerp_rgb(a.haze, b.haze, t),
        sky_top: lerp_rgb(a.sky_top, b.sky_top, t),
        vignette: lerp_f(a.vignette, b.vignette, t),
        haze_strength: lerp_f(a.haze_strength, b.haze_strength, t),
        bank: lerp_f(a.bank, b.bank, t),
        haze_base: lerp_f(a.haze_base, b.haze_base, t),
        valley_beta: lerp_f(a.valley_beta, b.valley_beta, t),
        scale_h: lerp_f(a.scale_h, b.scale_h, t),
    }
}

/// Blend zone look with overlapping aerial areas at a world point.
pub fn look_at(base: ZoneLook, areas: &[AreaLook], x: f32, z: f32) -> ZoneLook {
    let mut look = base;
    for a in areas {
        let w = a.weight(x, z);
        if w <= 0.0 {
            continue;
        }
        if a.haze_base > 0.0 {
            look.haze_base = lerp_f(look.haze_base, a.haze_base, w);
            look.valley_beta = lerp_f(look.valley_beta, a.valley_beta, w);
            look.scale_h = lerp_f(look.scale_h, a.scale_h, w);
        }
        if a.horizon != 0 {
            look.horizon = lerp_rgb(look.horizon, a.horizon, w);
        }
        look.haze_base *= lerp_f(1.0, a.density, w);
        look.valley_beta *= lerp_f(1.0, a.density, w);
    }
    look
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

pub(crate) fn emissive(c: u8) -> bool {
    matches!(c, 9 | 11 | 14)
        || (80..=90).contains(&c)
        || c == COAL
        || c == EMBER
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
    p: &Params,
    scroll: f32,
    out: &mut [u8],
) {
    write_rgba_key(pal, color, w, h, p, scroll, false, Extra::NONE, out);
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

/// Iso / persp-blend: metres along −(x+z) from the camera via unproject_ground.
fn iso_aerial(cam: &Camera, sx: f32, sy: f32) -> (f32, f32, f32) {
    let (x, z) = cam.unproject_ground(sx, sy);
    let s = (-((x - cam.cx) + (z - cam.cz)) / std::f32::consts::SQRT_2).max(0.0);
    (s, x, z)
}

/// Iso object depth is −(x+z). Convert to the same camera-relative s as `iso_aerial`.
fn iso_s_from_depth(cam: &Camera, d: f32) -> f32 {
    let d_cam = -(cam.cx + cam.cz);
    ((d - d_cam) / std::f32::consts::SQRT_2).max(0.0)
}

/// One mix toward the horizon. MIX_CAP is the final mix (no second desat pass).
fn apply_haze(v: &mut [f32; 3], haze: [f32; 3], f: f32, x: usize, y: usize) {
    let th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16.0;
    let f = (((f.min(MIX_CAP)) * FOG_STEPS + th).floor() / FOG_STEPS).min(MIX_CAP);
    for k in 0..3 {
        v[k] = v[k] * (1.0 - f) + haze[k] * f;
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
    p: &Params,
    scroll: f32,
    key: bool,
    ex: Extra<'_>,
    out: &mut [u8],
) {
    let haze = rgb(p.haze);
    let top = rgb(p.sky_top);
    let (cx, cy) = (w as f32 * 0.5, h as f32 * 0.5);
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
    let vx: Vec<f32> = (0..w).map(|x| ((x as f32 - cx) / cx).powi(2)).collect();
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
    let iso = ex.cam.is_some_and(aerial_iso);
    let gmap = ex.cam.and_then(|c| {
        if aerial_iso(c) {
            return None;
        }
        let v = c.view?;
        (v.inv_d > 0.0).then(|| GroundMap::with_far(&v, c.far))
    });
    let boom = ex.cam.and_then(|c| {
        if aerial_iso(c) {
            return None;
        }
        c.view.and_then(|v| (v.inv_d > 0.0).then(|| 1.0 / v.inv_d))
    });
    let beta = p.haze_base * p.haze_strength;
    let betah = if iso { p.valley_beta * p.haze_strength } else { 0.0 };
    let h_scale = p.scale_h.max(0.01);
    let far_s = ex.cam.map(|c| c.far).unwrap_or(60.0);
    for y in 0..h {
        let fy = y as f32;
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
            let v = if c == SKY {
                let mut v = if let Some(sky3) = ex.sky.as_ref() {
                    sky3.shade(x, y)
                } else {
                    let (far_r, near_r) = ridges[x];
                    let mut v = if fy > near_r {
                        [sky[0] * 0.55, sky[1] * 0.55, sky[2] * 0.62]
                    } else if fy > far_r {
                        [sky[0] * 0.78, sky[1] * 0.78, sky[2] * 0.84]
                    } else {
                        sky
                    };
                    if p.bank > 0.4 {
                        let cloud = bank_at(x, y) * p.bank;
                        let wash = (0.12 + t * 0.22 + cloud * 0.12).min(0.5);
                        for k in 0..3 {
                            v[k] = v[k] * (1.0 - wash) + haze[k] * wash;
                        }
                    }
                    v
                };
                // Sky at the far plane (pick still uses cam.far).
                let clear = if iso { CLEAR_ISO_M } else { CLEAR_EYE_M };
                let s_eff = (far_s - clear).max(0.0);
                let tau = beta * s_eff;
                let mut f = (1.0 - (-tau).exp()).min(MIX_CAP);
                if p.bank > 0.0 {
                    f = (f + bank_at(x, y) * p.bank * 0.22).min(MIX_CAP);
                }
                apply_haze(&mut v, haze, f, x, y);
                v
            } else {
                let mut v = lut[c as usize];
                if !emis[c as usize] {
                    for k in 0..3 {
                        v[k] *= p.ambient[k];
                    }
                    let mut s = 0.0f32;
                    let mut world_h = 0.0f32;
                    let mut from_obj = false;
                    if iso {
                        if let Some(cam) = ex.cam {
                            // During iso→TP, project writes view-z; do not feed that to iso_s_from_depth.
                            let depth_is_iso = cam.view.is_none();
                            if depth_is_iso {
                                if let Some(dp) = ex.depth {
                                    let d = dp[i];
                                    if d.is_finite() {
                                        let ss = iso_s_from_depth(cam, d);
                                        if ss < FOG_DEPTH_SANITY {
                                            s = ss;
                                            from_obj = true;
                                        }
                                    }
                                }
                            }
                            if !from_obj {
                                let (ss, wx, wz) = iso_aerial(cam, x as f32 + 0.5, y as f32 + 0.5);
                                s = ss;
                                if betah > 0.0 {
                                    world_h = ex.height_at.map_or(0.0, |f| f(wx, wz)) - ex.cam_y;
                                }
                            }
                        }
                    } else if let Some(cam) = ex.cam {
                        let mut got = false;
                        if let Some(dp) = ex.depth {
                            let d = dp[i];
                            if d.is_finite() {
                                let eye_s = boom.map_or(d, |b| b + d);
                                if eye_s > NEAR && eye_s < FOG_DEPTH_SANITY {
                                    s = eye_s.max(0.0);
                                    got = true;
                                    from_obj = true;
                                }
                            }
                        }
                        if !got {
                            if let Some(g) = &gmap {
                                let (sx, sy) = cam.to_view_px(x as f32 + 0.5, y as f32 + 0.5);
                                if let Some((_, _, dist)) = g.resolve_dist(g.raw(sx, sy)) {
                                    s = dist.max(0.0);
                                }
                            }
                        }
                    }
                    let clear = if iso { CLEAR_ISO_M } else { CLEAR_EYE_M };
                    let s_eff = (s - clear).max(0.0);
                    // Object pixels have no recovered height — skip valley βh (full valley on every prop).
                    let tau = if from_obj {
                        beta * s_eff
                    } else {
                        beta * s_eff + betah * s_eff * (-world_h.max(0.0) / h_scale).exp()
                    };
                    let mut f = (1.0 - (-tau).exp()).min(MIX_CAP);
                    if p.bank > 0.0 {
                        f = (f + bank_at(x, y) * p.bank * 0.22).min(MIX_CAP);
                    }
                    apply_haze(&mut v, haze, f, x, y);
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
    use stick_engine::camera::Camera;

    #[test]
    fn ambient_tints_and_emissive_skips() {
        let pal = palette();
        let (w, h) = (64, 36);
        let color = vec![BIOME0 + 13 * 3 + 1; w * h];
        let mut out = vec![0u8; w * h * 4];
        let dim = Params { ambient: [0.5; 3], ..PALE_HOLLOW };
        let mut full = vec![0u8; w * h * 4];
        write_rgba(&pal, &color, w, h, &dim, 0.0, &mut out);
        write_rgba(&pal, &color, w, h, &PALE_HOLLOW, 0.0, &mut full);
        let px = |b: &[u8], x: usize, y: usize| {
            let i = (y * w + x) * 4;
            (b[i] as i32, b[i + 1] as i32, b[i + 2] as i32)
        };
        assert!(px(&out, 32, 18).1 < px(&full, 32, 18).1, "lower ambient is darker");
        let mut col2 = color.clone();
        col2[18 * w + 32] = EMBER;
        let mut out2 = vec![0u8; w * h * 4];
        write_rgba(&pal, &col2, w, h, &PALE_HOLLOW, 0.0, &mut out2);
        assert!(px(&out2, 32, 18).0 >= 240);
    }

    #[test]
    fn sky_fills_void() {
        let pal = palette();
        let (w, h) = (32, 32);
        let color = vec![SKY; w * h];
        let mut out = vec![0u8; w * h * 4];
        write_rgba(&pal, &color, w, h, &PALE_HOLLOW, 0.0, &mut out);
        assert!(
            out[(16) * 4 + 2] < out[((h - 1) * w + 16) * 4 + 2]
                || out[(16) * 4] < out[((h - 1) * w + 16) * 4]
        );
    }

    #[test]
    fn draw_distance_knots() {
        assert!((iso_prop_m(0.0) - 36.0).abs() < 1e-4);
        assert!((iso_prop_m(DRAW_DEFAULT) - 56.0).abs() < 1e-4);
        assert!((iso_prop_m(1.0) - 80.0).abs() < 1e-4);
        assert!(iso_margin_m(0.0) >= 20.5);
        assert!((iso_margin_m(0.0) - 20.5).abs() < 1e-4);
        assert!((iso_margin_m(DRAW_DEFAULT) - 20.5).abs() < 1e-4);
        assert!((iso_margin_m(1.0) - 26.0).abs() < 1e-4);
        assert!((far_m(0.0) - 36.0).abs() < 1e-4);
        assert!((far_m(DRAW_DEFAULT) - 60.0).abs() < 1e-4);
        assert!((far_m(1.0) - 90.0).abs() < 1e-4);
        assert!((UNIT_DRAW_SLACK - 4.0).abs() < 1e-4);
        let mut cam = Camera::new(64, 36);
        apply_draw_distance(&mut cam, 1.0);
        assert!((cam.far - 90.0).abs() < 1e-4);
        assert!((cam.iso_prop - 80.0).abs() < 1e-4);
    }

    #[test]
    fn atmosphere_scale_matches_presets() {
        assert!((atmosphere_scale(0.45) - 1.0725).abs() < 1e-4);
        assert!((atmosphere_scale(0.72) - 1.626).abs() < 1e-3);
        assert!((atmosphere_scale(0.18) - 0.519).abs() < 1e-3);
    }

    #[test]
    fn weather_mul_is_density_not_a_wall() {
        assert!((weather_haze_mul(WeatherKind::Clear) - 0.65).abs() < 1e-6);
        assert!((weather_haze_mul(WeatherKind::Rain) - 1.25).abs() < 1e-6);
        assert!((weather_haze_mul(WeatherKind::Fog) - 1.7).abs() < 1e-6);
        assert!((weather_haze_mul(WeatherKind::Snow) - 1.1).abs() < 1e-6);
        let fog = pale_hollow_weather(&PALE_HOLLOW, WeatherKind::Fog);
        assert!((fog.haze_strength - 1.7).abs() < 1e-6);
        assert_eq!(fog.haze, PALE_HOLLOW.haze, "Fog must not replace the horizon");
        assert_eq!(fog.sky_top, PALE_HOLLOW.sky_top);
        assert_eq!(fog.bank, PALE_HOLLOW.bank);
        let look = params_from_look(PALE_HOLLOW_LOOK);
        assert_eq!(look.haze, PALE_HOLLOW_LOOK.horizon);
        assert_ne!(look.ambient, PALE_HOLLOW.ambient, "zone Params are not a PH clone");
    }

    #[test]
    fn iso_feet_are_not_a_haze_slab() {
        let pal = palette();
        let (w, h) = (640, 360);
        let grass = BIOME0 + 13 * 3 + 1;
        let color = vec![grass; w * h];
        let mut cam = Camera::new(w, h);
        cam.zoom = 0.84;
        let mut p = PALE_HOLLOW;
        p.vignette = 0.0;
        p.haze_strength = 1.0;
        let height = |_x: f32, _z: f32| 0.0f32;
        let ex = Extra {
            cam: Some(&cam),
            height_at: Some(&height),
            ..Extra::NONE
        };
        let mut out = vec![0u8; w * h * 4];
        write_rgba_key(&pal, &color, w, h, &p, 0.0, false, ex, &mut out);
        let row = |y: usize| {
            let mut acc = [0f32; 3];
            let x0 = w / 2 - 12;
            let n = 25.0;
            for x in x0..x0 + 25 {
                let i = (y * w + x) * 4;
                acc[0] += out[i] as f32;
                acc[1] += out[i + 1] as f32;
                acc[2] += out[i + 2] as f32;
            }
            [acc[0] / n, acc[1] / n, acc[2] / n]
        };
        let near = row((h as f32 * 0.55) as usize);
        let far = row(2);
        let haze = rgb(p.haze);
        let dist = |a: [f32; 3], rgb: [f32; 3]| {
            (0..3).map(|k| (a[k] - rgb[k]).abs()).sum::<f32>()
        };
        assert!(
            dist(near, haze) > dist(far, haze) + 8.0,
            "far should sit closer to the horizon than the feet: near {near:?} far {far:?}"
        );
        let grass_rgb = rgb(pal[grass as usize]);
        let near_amb = [
            grass_rgb[0] * p.ambient[0],
            grass_rgb[1] * p.ambient[1],
            grass_rgb[2] * p.ambient[2],
        ];
        let d_near = (0..3).map(|k| (near[k] - near_amb[k]).abs()).sum::<f32>();
        assert!(d_near < 40.0, "feet stayed near lit grass, not FOG_COLOR, d={d_near} {near:?}");
    }

    #[test]
    fn aerial_mix_caps_below_a_wall() {
        let pal = palette();
        let (w, h) = (8, 8);
        let color = vec![BIOME0 + 13 * 3 + 1; w * h];
        let mut cam = Camera::new(w, h);
        cam.cx = 0.0;
        cam.cz = 0.0;
        let mut p = PALE_HOLLOW;
        p.haze_base = 0.2;
        p.haze_strength = 1.7;
        p.vignette = 0.0;
        let height = |_x: f32, _z: f32| 0.0f32;
        let ex = Extra { cam: Some(&cam), height_at: Some(&height), ..Extra::NONE };
        let mut out = vec![0u8; w * h * 4];
        write_rgba_key(&pal, &color, w, h, &p, 0.0, false, ex, &mut out);
        let haze = rgb(p.haze);
        for y in 0..h {
            let i = (y * w + 4) * 4;
            let d = (0..3).map(|k| (out[i + k] as f32 - haze[k]).abs()).sum::<f32>();
            assert!(d > 8.0, "row {y} collapsed onto the horizon colour");
        }
    }
}
