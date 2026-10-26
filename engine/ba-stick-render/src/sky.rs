// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Pixel sky for the third- and first-person cameras. Iso keeps the flat
//! gradient + skyline. Every `SKY` pixel is shaded from its view ray: banded
//! (Bayer-dithered) day/night gradient, dawn/dusk glow, a hard-edged pixel
//! sun and moon, hashed single-pixel stars and stepped cloud tones whose
//! cover and darkness follow the zone weather.
//!
//! Time of day is a phase 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon,
//! 0.75 = sunset) handed in by the host from the same wall clock the server
//! uses for its weather spells (`paleHollowDayPhaseAt` in `@bellgrave/config`).

use crate::weather::Kind;

/// Weather look for the sky (lerped between spells like `atmosphere::Params`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SkyWeather {
    /// Cloud cover 0..1.
    pub cover: f32,
    /// Cloud darkness 0 (white) ..1 (storm grey).
    pub dark: f32,
    /// Flat haze wash over everything 0..1 (fog).
    pub haze: f32,
    /// Dims sun/moon/stars 0..1.
    pub veil: f32,
}

pub fn sky_weather(k: Kind) -> SkyWeather {
    match k {
        Kind::Clear => SkyWeather { cover: 0.22, dark: 0.0, haze: 0.0, veil: 0.0 },
        Kind::Rain => SkyWeather { cover: 0.92, dark: 0.75, haze: 0.18, veil: 0.85 },
        Kind::Fog => SkyWeather { cover: 0.6, dark: 0.15, haze: 0.82, veil: 0.9 },
        Kind::Snow => SkyWeather { cover: 0.8, dark: 0.3, haze: 0.3, veil: 0.7 },
    }
}

pub fn lerp_weather(a: SkyWeather, b: SkyWeather, t: f32) -> SkyWeather {
    let l = |x: f32, y: f32| x + (y - x) * t.clamp(0.0, 1.0);
    SkyWeather { cover: l(a.cover, b.cover), dark: l(a.dark, b.dark), haze: l(a.haze, b.haze), veil: l(a.veil, b.veil) }
}

/// Per-frame sky inputs: camera basis (unit vectors) and focal length in px.
#[derive(Clone, Copy, Debug)]
pub struct SkyCtx {
    pub fwd: [f32; 3],
    pub right: [f32; 3],
    pub down: [f32; 3],
    pub ax: f32,
    pub ay: f32,
    pub focal: f32,
    /// 0..1, 0 = midnight.
    pub phase: f32,
    pub weather: SkyWeather,
    /// Seconds, for cloud drift.
    pub time: f32,
}

/// Unit vector toward the sun. Rises in the east (+x), sets in the west.
pub fn sun_dir(phase: f32) -> [f32; 3] {
    let a = (phase - 0.25) * std::f32::consts::TAU;
    let (s, c) = a.sin_cos();
    norm([c, s * 0.92, s * 0.38])
}

/// 0 at night .. 1 in full day (sun elevation based, smooth through twilight).
pub fn daylight(phase: f32) -> f32 {
    let e = sun_dir(phase)[1];
    ((e + 0.18) / 0.36).clamp(0.0, 1.0)
}

/// World ambient multiplier for the time of day (applied in 3D views only).
pub fn ambient_scale(phase: f32) -> [f32; 3] {
    let d = daylight(phase);
    let s = |n: f32| n + (1.0 - n) * d;
    [s(0.42), s(0.46), s(0.62)]
}

/// RGB multiplier for characters: full at noon, warm at dawn/dusk, cool
/// moonlight at night with a floor so figures stay readable. Overcast dims a little.
pub fn unit_light(phase: f32, w: SkyWeather) -> [f32; 3] {
    let day = daylight(phase);
    let sun = sun_dir(phase);
    let twi = (1.0 - (sun[1] / 0.28).abs()).clamp(0.0, 1.0);
    let night = [0.62, 0.68, 0.92];
    let mut m = mix(night, [1.0, 1.0, 1.0], day);
    m = mix(m, [1.06, 0.9, 0.76], twi * 0.7);
    let dim = 1.0 - 0.12 * w.cover * w.dark;
    [m[0] * dim, m[1] * dim, m[2] * dim]
}

fn norm(v: [f32; 3]) -> [f32; 3] {
    let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-6);
    [v[0] / l, v[1] / l, v[2] / l]
}
fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn mix(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    let t = t.clamp(0.0, 1.0);
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
fn hex(c: u32) -> [f32; 3] {
    [((c >> 16) & 255) as f32, ((c >> 8) & 255) as f32, (c & 255) as f32]
}
fn h2(x: i32, y: i32) -> f32 {
    let mut n = (x as u32).wrapping_mul(0x27d4_eb2d) ^ (y as u32).wrapping_mul(0x1656_67b1);
    n ^= n >> 15;
    n = n.wrapping_mul(0x85eb_ca6b);
    n ^= n >> 13;
    (n & 0xffff) as f32 / 65536.0
}
fn vnoise(x: f32, y: f32) -> f32 {
    let (xi, yi) = (x.floor(), y.floor());
    let (fx, fy) = (x - xi, y - yi);
    let (sx, sy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
    let (i, j) = (xi as i32, yi as i32);
    let a = h2(i, j) + (h2(i + 1, j) - h2(i, j)) * sx;
    let b = h2(i, j + 1) + (h2(i + 1, j + 1) - h2(i, j + 1)) * sx;
    a + (b - a) * sy
}

const BAYER4: [f32; 16] = [0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.];
/// Snap `t` to `steps` bands with ordered dithering at pixel (x, y).
fn band(t: f32, steps: f32, x: usize, y: usize) -> f32 {
    let th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16.0 - 0.5;
    ((t * steps + th).round() / steps).clamp(0.0, 1.0)
}

/// Sky palette keyframes: (zenith, horizon) for night, dawn/dusk, day.
const NIGHT: (u32, u32) = (0x070a1a, 0x1c2140);
const TWILIGHT: (u32, u32) = (0x2a2a5c, 0xe0784a);
const DAY: (u32, u32) = (0x3a6ec8, 0xa8c8e8);
const STORM: (u32, u32) = (0x3c4048, 0x6a6e78);
const FOG: [f32; 3] = [196.0, 202.0, 212.0];

impl SkyCtx {
    /// View ray through screen pixel (x, y).
    pub fn ray(&self, x: f32, y: f32) -> [f32; 3] {
        let (dx, dy) = (x - self.ax, y - self.ay);
        norm([
            self.fwd[0] * self.focal + self.right[0] * dx + self.down[0] * dy,
            self.fwd[1] * self.focal + self.right[1] * dx + self.down[1] * dy,
            self.fwd[2] * self.focal + self.right[2] * dx + self.down[2] * dy,
        ])
    }

    /// RGB (0..255) of the sky at screen pixel (x, y).
    pub fn shade(&self, x: usize, y: usize) -> [f32; 3] {
        let d = self.ray(x as f32 + 0.5, y as f32 + 0.5);
        let w = self.weather;
        let sun = sun_dir(self.phase);
        let day = daylight(self.phase);
        // Twilight peaks while the sun crosses the horizon.
        let twi = (1.0 - (sun[1] / 0.28).abs()).clamp(0.0, 1.0);
        let elev = d[1].max(-0.05);
        let up = band((elev * 1.6).clamp(0.0, 1.0).sqrt(), 7.0, x, y);
        let zen = mix(mix(hex(NIGHT.0), hex(DAY.0), day), hex(TWILIGHT.0), twi * 0.5);
        let hor = mix(mix(hex(NIGHT.1), hex(DAY.1), day), hex(TWILIGHT.1), twi);
        // Glow is strongest on the sun's side of the horizon.
        let toward = (dot([d[0], 0.0, d[2]], norm([sun[0], 0.0, sun[2]])) * 0.5 + 0.5).powi(2);
        let hor = mix(mix(hex(NIGHT.1), hex(DAY.1), day), hor, 0.35 + 0.65 * toward);
        let mut c = mix(hor, zen, up);
        // Overcast flattens the gradient toward storm grey (darker at night).
        let storm = mix(hex(STORM.1), hex(STORM.0), up);
        let storm = [storm[0] * (0.25 + 0.75 * day), storm[1] * (0.25 + 0.75 * day), storm[2] * (0.3 + 0.7 * day)];
        c = mix(c, storm, w.cover * w.dark);

        let clear = 1.0 - w.veil;
        // Night: Milky Way band, nebula swirls, sized twinkling stars, meteors.
        let night = (1.0 - day * 1.6).clamp(0.0, 1.0) * clear;
        if night > 0.03 && d[1] > -0.02 {
            c = self.night_sky(c, d, night, x, y);
        }
        // Sun: hard disc + one ring, colour warms near the horizon.
        let sd = dot(d, sun);
        if sun[1] > -0.1 {
            let warm = (1.0 - sun[1] / 0.4).clamp(0.0, 1.0);
            let core = mix([255.0, 250.0, 214.0], [255.0, 168.0, 82.0], warm);
            let a = clear * (0.25 + 0.75 * (1.0 - w.cover * 0.6));
            if sd > 0.9985 {
                c = mix(c, core, a);
            } else if sd > 0.9965 {
                c = mix(c, core, a * 0.45);
            } else if sd > 0.985 {
                c = mix(c, core, band((sd - 0.985) / 0.0115, 3.0, x, y) * a * 0.22);
            }
        }
        // Moon: opposite the sun, pale disc with two crater pixels-worth of shade.
        let moon = [-sun[0], -sun[1], -sun[2]];
        let md = dot(d, moon);
        if moon[1] > -0.1 && md > 0.9988 {
            let a = clear * (1.0 - day);
            let crater = h2(((d[0] - moon[0]) * 900.0) as i32, ((d[1] - moon[1]) * 900.0) as i32) > 0.72;
            let mc = if crater { [176.0, 182.0, 200.0] } else { [222.0, 226.0, 236.0] };
            c = mix(c, mc, a);
        } else if moon[1] > -0.1 && md > 0.996 {
            c = mix(c, [150.0, 160.0, 200.0], clear * (1.0 - day) * 0.25);
        }
        // Cumulus: two drifting decks (parallax), sun-side highlights, rim light.
        if d[1] > 0.012 {
            c = self.clouds(c, d, sun, day, twi, x, y);
        }
        // Fog: wash toward the haze colour, dimmed at night.
        if w.haze > 0.0 {
            let f = [FOG[0] * (0.3 + 0.7 * day), FOG[1] * (0.3 + 0.7 * day), FOG[2] * (0.35 + 0.65 * day)];
            c = mix(c, f, band(w.haze * (1.0 - elev * 0.35), 4.0, x, y));
        }
        c
    }
}

fn fbm(x: f32, y: f32, oct: u32) -> f32 {
    let (mut a, mut f, mut t, mut n) = (0.5, 1.0, 0.0, 0.0);
    for i in 0..oct {
        t += a * vnoise(x * f + i as f32 * 17.3, y * f - i as f32 * 9.1);
        n += a;
        a *= 0.5;
        f *= 2.03;
    }
    t / n
}
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
fn add(c: [f32; 3], k: [f32; 3], a: f32) -> [f32; 3] {
    [(c[0] + k[0] * a).min(255.0), (c[1] + k[1] * a).min(255.0), (c[2] + k[2] * a).min(255.0)]
}

/// Spiral nebulae: (direction, size rad, arm twist, colour A, colour B).
const NEBULAE: [([f32; 3], f32, f32, u32, u32); 3] = [
    ([0.35, 0.72, 0.6], 0.16, 2.6, 0xb048c8, 0x3cc8d8),
    ([-0.55, 0.55, -0.62], 0.11, -3.2, 0x4a6cff, 0xff6ab4),
    ([0.1, 0.45, -0.88], 0.08, 2.0, 0x38d8a8, 0x8a5cf0),
];

impl SkyCtx {
    /// Sky rotates with the clock so the galaxy wheels overhead through the night.
    fn celestial(&self, d: [f32; 3]) -> [f32; 3] {
        let a = self.phase * std::f32::consts::TAU;
        let (s, c) = a.sin_cos();
        [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]]
    }

    fn night_sky(&self, mut c: [f32; 3], d: [f32; 3], night: f32, x: usize, y: usize) -> [f32; 3] {
        let px = 1.0 / self.focal.max(1.0);
        let q = self.celestial(d);
        let horizon = (d[1] * 5.0 + 0.1).clamp(0.0, 1.0);
        let n = night * horizon;
        // Galaxy band: a tilted great circle with a bright core and dust lanes.
        let g = norm([0.88, 0.12, 0.45]);
        let t1 = norm(cross(g, [0.0, 1.0, 0.0]));
        let t2 = cross(g, t1);
        let v = dot(q, g);
        let u = dot(q, t2).atan2(dot(q, t1));
        let core = (-(v / 0.24).powi(2)).exp();
        let mut gal = 0.0;
        if core > 0.02 {
            let warp = fbm(u * 3.0, v * 6.0, 3) * 0.5;
            let dust = fbm(u * 4.0 + warp * 3.0, v * 14.0 + warp, 4);
            let lane = fbm(u * 9.0 + 4.0, v * 22.0 - warp * 2.0, 3);
            let hub = (-((u - 0.8).powi(2) * 2.5)).exp();
            gal = (core * (0.55 + 0.9 * dust) * (1.0 - 0.75 * ((lane - 0.5) * 3.0).clamp(0.0, 1.0) * core) * (0.7 + 0.6 * hub)).clamp(0.0, 1.0);
            let tint = fbm(u * 2.0 + 30.0, v * 5.0, 2);
            let col = if tint < 0.42 {
                mix([70.0, 40.0, 130.0], [60.0, 80.0, 170.0], tint / 0.42)
            } else if tint < 0.58 {
                mix([60.0, 80.0, 170.0], [40.0, 150.0, 160.0], (tint - 0.42) / 0.16)
            } else {
                mix([40.0, 150.0, 160.0], [210.0, 190.0, 240.0], ((tint - 0.58) / 0.3).min(1.0))
            };
            let a = band(gal, 6.0, x, y) * n;
            c = add(c, col, a * 1.1);
            c = add(c, [255.0, 235.0, 220.0], band((gal - 0.75).max(0.0) * 3.0, 3.0, x, y) * n * 0.35);
        }
        // Spiral nebulae: logarithmic arms around fixed sky points.
        for (dir, size, twist, ca, cb) in NEBULAE {
            let nd = norm(dir);
            let k = dot(q, nd);
            if k < (size * 1.6).cos() {
                continue;
            }
            let a1 = norm(cross(nd, [0.0, 0.0, 1.0]));
            let a2 = cross(nd, a1);
            let (lx, ly) = (dot(q, a1) / size, dot(q, a2) / size);
            let r = (lx * lx + ly * ly).sqrt().max(1e-3);
            let th = ly.atan2(lx);
            let arms = ((2.0 * (th - twist * r.ln())).cos() * 0.5 + 0.5).powf(2.2);
            let fall = (-r * 2.3).exp();
            let grain = fbm(lx * 6.0, ly * 6.0, 2);
            let s = (arms * fall * (0.6 + 0.8 * grain) + (-r * r * 40.0).exp() * 0.9).clamp(0.0, 1.0);
            let col = mix(hex(ca), hex(cb), (r * 1.2 + grain * 0.3).min(1.0));
            c = add(c, col, band(s, 5.0, x, y) * n * 0.75);
            c = add(c, [255.0, 245.0, 255.0], band(((-r * r * 60.0).exp() - 0.4).max(0.0), 2.0, x, y) * n);
        }
        // Stars on a celestial grid; denser inside the galaxy. Cell size ~3 px.
        let cell = (px * 3.2).max(0.004);
        // Cube-face grid keeps stars round (no shear from lat/long cells).
        let ab = [q[0].abs(), q[1].abs(), q[2].abs()];
        let (face, fu, fv) = if ab[1] >= ab[0] && ab[1] >= ab[2] {
            (if q[1] > 0.0 { 0 } else { 1 }, q[0] / ab[1], q[2] / ab[1])
        } else if ab[0] >= ab[2] {
            (if q[0] > 0.0 { 2 } else { 3 }, q[2] / ab[0], q[1] / ab[0])
        } else {
            (if q[2] > 0.0 { 4 } else { 5 }, q[0] / ab[2], q[1] / ab[2])
        };
        let (fi, fj) = (fu / cell + face as f32 * 1000.0, fv / cell);
        let (ci, cj) = (fi.floor() as i32, fj.floor() as i32);
        for (di, dj) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)] {
            let (i, j) = (ci + di, cj + dj);
            let r = h2(i, j);
            let thresh = 0.955 - 0.08 * gal;
            if r < thresh {
                continue;
            }
            let sx = i as f32 + 0.2 + 0.6 * h2(j, i + 7);
            let sy = j as f32 + 0.2 + 0.6 * h2(i - 3, j);
            let (ox, oy) = ((fi - sx) * cell / px, (fj - sy) * cell / px);
            let mag = (r - thresh) / (1.0 - thresh);
            let tw = 0.6 + 0.4 * (self.time * (1.5 + 3.0 * h2(i, j + 99)) + r * 80.0).sin();
            let (ax, ay) = (ox.abs(), oy.abs());
            let lit = if ax < 0.5 && ay < 0.5 {
                1.0
            } else if mag > 0.75 && ((ax < 0.5 && ay < 1.5) || (ay < 0.5 && ax < 1.5)) {
                0.55 * tw
            } else if mag > 0.93 && ((ax < 0.5 && ay < 2.5) || (ay < 0.5 && ax < 2.5)) {
                0.25 * tw
            } else {
                0.0
            };
            if lit > 0.0 {
                let hue = h2(i + 5, j - 5);
                let sc = if hue < 0.2 { [170.0, 200.0, 255.0] } else if hue > 0.85 { [255.0, 214.0, 170.0] } else { [245.0, 245.0, 255.0] };
                let b = lit * n * (0.35 + 0.65 * mag) * (0.5 + 0.5 * tw);
                c = mix(c, sc, b);
            }
        }
        // Rare shooting star: one ~0.9 s streak in roughly 1 of 3 windows of 9 s.
        let win = (self.time / 9.0).floor() as i32;
        if h2(win, 4242) > 0.66 {
            let tt = (self.time / 9.0).fract() * 9.0 - 2.0 * h2(win, 1);
            if (0.0..0.9).contains(&tt) {
                let az0 = h2(win, 2) * std::f32::consts::TAU;
                let s0 = norm([az0.cos(), 0.55 + 0.35 * h2(win, 3), az0.sin()]);
                let dir = norm(cross(s0, [h2(win, 5) - 0.5, 1.0, h2(win, 6) - 0.5]));
                let p = tt / 0.9;
                let head = 0.35 * p;
                let rel = [d[0] - s0[0], d[1] - s0[1], d[2] - s0[2]];
                let along = dot(rel, dir);
                let perp = {
                    let o = [rel[0] - dir[0] * along, rel[1] - dir[1] * along, rel[2] - dir[2] * along];
                    dot(o, o).sqrt()
                };
                let tail = 0.12;
                if perp < px * 0.8 && along <= head && along > head - tail {
                    let f = 1.0 - (head - along) / tail;
                    let fade = (1.0 - p).min(p * 5.0).min(1.0);
                    c = mix(c, [255.0, 250.0, 230.0], band(f, 4.0, x, y) * fade * n);
                }
            }
        }
        c
    }

    fn cloud_density(&self, d: [f32; 3], height: f32, scale: f32, speed: f32, seed: f32) -> f32 {
        let k = height / d[1].max(0.02);
        let (u, v) = (d[0] * k * scale + self.time * speed + seed, d[2] * k * scale);
        let base = fbm(u * 0.5, v * 0.5, 2);
        let detail = fbm(u * 2.6 + 3.0, v * 2.6 - 2.0, 3);
        let cover = self.weather.cover;
        base * 0.6 + detail * 0.4 - (0.7 - cover * 0.52)
    }

    #[allow(clippy::too_many_arguments)]
    fn clouds(&self, mut c: [f32; 3], d: [f32; 3], sun: [f32; 3], day: f32, twi: f32, x: usize, y: usize) -> [f32; 3] {
        let w = self.weather;
        let fade = (d[1] * 9.0).clamp(0.0, 1.0);
        // Back deck first (higher, slower), then front puffs (lower, faster: parallax).
        let sflat = norm([sun[0], 0.0, sun[2]]);
        for (height, scale, speed, seed, front) in [(1.0, 1.1, 0.010, 0.0, false), (0.55, 1.6, 0.030, 41.0, true)] {
            let raw = self.cloud_density(d, height, scale, speed, seed);
            let dens = (raw / 0.07).clamp(0.0, 1.0);
            if dens <= 0.0 {
                continue;
            }
            // Billowy tops: sample toward the sun / upward; thinner there means lit.
            let off = 0.06;
            let toward = norm([d[0] + sflat[0] * off, d[1] + off * 1.3, d[2] + sflat[2] * off]);
            let dl = self.cloud_density(toward, height, scale, speed, seed);
            // Thicker toward the sun = shadowed; thinning toward it = billow top.
            let light = (0.62 - (dl - raw) * 7.0 - raw * 1.2).clamp(0.0, 1.0);
            let edge = (1.0 - dens).clamp(0.0, 1.0);
            let base_day = if front { [236.0, 238.0, 246.0] } else { [214.0, 220.0, 236.0] };
            let lit_c = mix(mix([52.0, 56.0, 80.0], base_day, day), [255.0, 196.0, 150.0], twi * 0.75);
            let shd_c = mix(mix([30.0, 32.0, 52.0], [150.0, 160.0, 186.0], day), [150.0, 96.0, 120.0], twi * 0.7);
            let storm = [74.0 * (0.4 + 0.6 * day), 78.0 * (0.4 + 0.6 * day), 88.0 * (0.45 + 0.55 * day)];
            let lit_c = mix(lit_c, mix(storm, [170.0, 172.0, 180.0], 0.5), w.dark);
            let shd_c = mix(shd_c, storm, w.dark);
            let tone = band(light, 4.0, x, y);
            let mut col = mix(shd_c, lit_c, tone);
            // Sunlit rim on thin edges, strongest at dawn/dusk and facing the sun.
            let face = (dot(d, sun) * 0.5 + 0.5).powi(3);
            let rim = band(edge * (0.3 + 0.7 * twi) * (0.4 + 0.6 * face) * (1.0 - w.dark), 3.0, x, y);
            let rim_c = mix([255.0, 252.0, 240.0], [255.0, 170.0, 90.0], twi);
            col = mix(col, rim_c, rim * 0.8 * day.max(twi));
            // Clear nights keep clouds thin so the galaxy shows through.
            let thin = (0.4 + 0.6 * day.max(twi)).max(w.cover * w.dark);
            let a = band((dens * 1.6).min(1.0) * thin, 4.0, x, y) * fade;
            c = mix(c, col, a);
        }
        c
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(phase: f32, k: Kind, pitch_up: f32) -> SkyCtx {
        let f = norm([0.0, pitch_up, 1.0]);
        SkyCtx {
            fwd: f,
            right: [-1.0, 0.0, 0.0],
            down: norm([0.0, -1.0, pitch_up]),
            ax: 32.0,
            ay: 32.0,
            focal: 40.0,
            phase,
            weather: sky_weather(k),
            time: 0.0,
        }
    }
    fn lum(c: [f32; 3]) -> f32 {
        c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
    }
    fn avg(s: &SkyCtx) -> f32 {
        let mut t = 0.0;
        for y in 0..64 {
            for x in 0..64 {
                t += lum(s.shade(x, y));
            }
        }
        t / 4096.0
    }

    #[test]
    fn noon_brighter_than_midnight() {
        assert!(avg(&ctx(0.5, Kind::Clear, 0.4)) > avg(&ctx(0.0, Kind::Clear, 0.4)) + 60.0);
    }

    #[test]
    fn rain_greys_out_day_sky() {
        let blue = |s: &SkyCtx| (0..64).flat_map(|y| (0..64).map(move |x| (x, y))).map(|(x, y)| { let c = s.shade(x, y); c[2] - c[0] }).sum::<f32>() / 4096.0;
        assert!(blue(&ctx(0.5, Kind::Rain, 0.4)) + 40.0 < blue(&ctx(0.5, Kind::Clear, 0.4)));
    }

    #[test]
    fn sun_rises_east_noon_high() {
        assert!(sun_dir(0.25)[0] > 0.9 && sun_dir(0.25)[1].abs() < 0.01);
        assert!(sun_dir(0.5)[1] > 0.8);
        assert!(daylight(0.0) == 0.0 && daylight(0.5) == 1.0);
    }

    #[test]
    fn unit_light_cycle() {
        let c = sky_weather(Kind::Clear);
        assert_eq!(unit_light(0.5, c), [1.0, 1.0, 1.0]);
        let n = unit_light(0.0, c);
        assert!(n[0] >= 0.6 && n[2] > n[0], "night has a floor and is bluish: {n:?}");
        let d = unit_light(0.25, c);
        assert!(d[0] > d[2], "dawn is warm: {d:?}");
        assert!(unit_light(0.5, sky_weather(Kind::Rain))[0] < 1.0);
    }

    #[test]
    fn stars_only_at_night() {
        let bright = |s: &SkyCtx| (0..64).flat_map(|y| (0..64).map(move |x| (x, y))).filter(|&(x, y)| lum(s.shade(x, y)) > 150.0).count();
        assert!(bright(&ctx(0.0, Kind::Clear, 0.8)) > 0, "some stars at midnight");
        assert_eq!(bright(&ctx(0.0, Kind::Rain, 0.8)), 0, "overcast hides stars");
    }
}
