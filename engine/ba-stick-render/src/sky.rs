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
        // Stars: one pixel per hashed direction cell, only at night.
        let night = (1.0 - day * 1.6).clamp(0.0, 1.0) * clear;
        if night > 0.05 && d[1] > 0.04 {
            let az = d[2].atan2(d[0]);
            let (si, sj) = ((az * 160.0).floor() as i32, (d[1] * 160.0).floor() as i32);
            let r = h2(si, sj);
            if r > 0.985 {
                let tw = 0.7 + 0.3 * ((self.time * 2.0 + r * 50.0).sin());
                let b = night * tw * if r > 0.996 { 1.0 } else { 0.6 };
                c = mix(c, [235.0, 235.0, 255.0], b);
            }
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
        // Clouds on a flat deck above the camera, stepped into 3 tones.
        if d[1] > 0.015 {
            let k = 1.0 / d[1];
            let (u, v) = (d[0] * k * 2.2 + self.time * 0.05, d[2] * k * 2.2);
            let n = 0.6 * vnoise(u, v) + 0.3 * vnoise(u * 2.1 + 5.0, v * 2.1) + 0.1 * vnoise(u * 4.3, v * 4.3);
            let edge = 1.0 - w.cover;
            let t = ((n - 0.25 - edge * 0.5) / 0.18).clamp(0.0, 1.0);
            // Fade into the horizon so far clouds read as haze, not noise.
            let t = t * (d[1] * 8.0).clamp(0.0, 1.0);
            if t > 0.0 {
                let lit = mix([60.0, 64.0, 86.0], [244.0, 244.0, 250.0], day);
                let lit = mix(lit, [250.0, 170.0, 130.0], twi * 0.6);
                let shade = mix(lit, [70.0, 74.0, 84.0], 0.35 + 0.55 * w.dark);
                let tone = band(t, 3.0, x, y);
                let col = mix(lit, shade, (n - edge).clamp(0.0, 1.0) * 1.4 + w.dark * 0.4);
                c = mix(c, col, tone);
            }
        }
        // Fog: wash toward the haze colour, dimmed at night.
        if w.haze > 0.0 {
            let f = [FOG[0] * (0.3 + 0.7 * day), FOG[1] * (0.3 + 0.7 * day), FOG[2] * (0.35 + 0.65 * day)];
            c = mix(c, f, band(w.haze * (1.0 - elev * 0.35), 4.0, x, y));
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
