// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Localized lighting (lighting overhaul).
//!
//! The scene is drawn as normal, then a light layer is built in a reused
//! offscreen buffer: it is filled with the mood's ambient colour and every
//! visible light adds its colour through one pre-rendered radial sprite. The
//! layer is multiplied over the RGBA frame (emissive pixels such as flames and
//! spell sparks are left full-bright), and an optional additive glow pass puts
//! a small coloured bloom over fires, lava and effect flashes.
//!
//! Lights live in world space and are projected every frame, with centres and
//! radii snapped to whole pixels so nothing shimmers as the camera moves.
//! Flicker is smooth value noise seeded by each light's position: the same
//! light at the same time always gives the same brightness, never a per-frame
//! random roll.
//!
//! Bright moods skip the light pass: their ambient is folded into the
//! atmosphere's per-pixel multiply instead, which costs nothing extra.

use stick_engine::camera::Camera;
use stick_engine::math::{v3, Vec3};

/// Most lights stamped in one frame (nearest and brightest win).
pub const MAX_LIGHTS: usize = 24;
/// Most effect flashes alive at once.
pub const MAX_EFFECTS: usize = 16;
/// Side of the square pre-rendered falloff sprite.
const SPRITE: usize = 64;
/// Moods whose ambient is at least this bright everywhere skip the light pass.
pub const BRIGHT: f32 = 0.9;
/// Mood easing rate (1/s): about a second to settle when walking between moods.
const MOOD_RATE: f32 = 2.5;

/// How a light breathes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Flicker {
    Steady,
    /// Lantern glass: slow, shallow.
    Lantern,
    /// Open flame: faster and deeper, still smooth.
    Fire,
}

/// What a light is, for its defaults.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Fire,
    Lantern,
    Forge,
    Brazier,
    Lava,
    Crystal,
    Torch,
}

impl Kind {
    pub fn from_u8(n: u8) -> Kind {
        match n {
            1 => Kind::Lantern,
            2 => Kind::Forge,
            3 => Kind::Brazier,
            4 => Kind::Lava,
            5 => Kind::Crystal,
            6 => Kind::Torch,
            _ => Kind::Fire,
        }
    }

    /// (radius m, strength, colour, flicker, glow).
    pub fn defaults(self) -> (f32, f32, [f32; 3], Flicker, bool) {
        match self {
            Kind::Fire => (7.5, 1.0, [1.0, 0.62, 0.30], Flicker::Fire, true),
            Kind::Lantern => (4.5, 0.75, [1.0, 0.82, 0.52], Flicker::Lantern, false),
            Kind::Forge => (9.0, 1.15, [1.0, 0.50, 0.20], Flicker::Fire, true),
            Kind::Brazier => (6.0, 0.95, [1.0, 0.58, 0.26], Flicker::Fire, true),
            Kind::Lava => (8.0, 0.9, [1.0, 0.36, 0.12], Flicker::Lantern, true),
            Kind::Crystal => (5.0, 0.7, [0.62, 0.78, 1.0], Flicker::Lantern, true),
            Kind::Torch => (5.0, 0.85, [1.0, 0.66, 0.34], Flicker::Fire, true),
        }
    }
}

/// A light fixed in the world (from props or map data).
#[derive(Clone, Copy, Debug)]
pub struct StaticLight {
    pub pos: Vec3,
    /// Radius in metres on the ground.
    pub r: f32,
    pub k: f32,
    pub rgb: [f32; 3],
    pub flicker: Flicker,
    pub glow: bool,
    seed: f32,
}

impl StaticLight {
    pub fn seed(&self) -> f32 { self.seed }
    pub fn of_kind(kind: Kind, pos: Vec3) -> StaticLight {
        let (r, k, rgb, flicker, glow) = kind.defaults();
        StaticLight { pos, r, k, rgb, flicker, glow, seed: seed_of(pos) }
    }
}

/// A short-lived flash from an ability or hit.
#[derive(Clone, Copy, Debug)]
pub struct EffectLight {
    pub pos: Vec3,
    pub r: f32,
    pub k: f32,
    pub rgb: [f32; 3],
    /// Seconds before the flash starts (projectile flight).
    pub delay: f32,
    pub age: f32,
    pub life: f32,
}

impl EffectLight {
    /// 0..1 envelope: quick rise, smooth fall.
    pub fn envelope(&self) -> f32 {
        if self.age < self.delay {
            return 0.0;
        }
        let t = ((self.age - self.delay) / self.life).clamp(0.0, 1.0);
        let rise = (t / 0.12).min(1.0);
        let fall = 1.0 - t;
        rise * fall * fall
    }
    pub fn done(&self) -> bool { self.age >= self.delay + self.life }
}

/// A light already in screen space (boot menu forge blots, lava cells).
#[derive(Clone, Copy, Debug)]
pub struct ScreenLight {
    pub x: f32,
    pub y: f32,
    /// Horizontal radius in px; vertical is 0.55 of it (iso ground).
    pub r: f32,
    pub k: f32,
}

/// The light of a place.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Mood {
    /// Ambient multiplier (1 = unlit scene colour).
    pub ambient: [f32; 3],
    /// Colour given to screen-space lights (boot menu).
    pub warm: [f32; 3],
    /// Player spotlight radius in metres (0 = none).
    pub player_r: f32,
    pub player_k: f32,
    /// Additive glow strength over fires and flashes (0 = off).
    pub glow: f32,
}

impl Mood {
    pub const DAYLIGHT: Mood = Mood {
        ambient: [1.0, 1.0, 1.0],
        warm: [1.0, 0.6, 0.25],
        player_r: 0.0,
        player_k: 0.0,
        glow: 0.0,
    };
    /// The boot menu's forge cavern (was atmosphere::FORGE_MENU's ambient/warm).
    pub const FORGE_MENU: Mood = Mood {
        ambient: [0.14, 0.11, 0.1],
        warm: [1.05, 0.52, 0.14],
        player_r: 0.0,
        player_k: 0.0,
        glow: 0.0,
    };

    /// True when the light pass can be skipped.
    pub fn bright(&self) -> bool {
        self.ambient.iter().all(|&a| a >= BRIGHT) && self.player_k <= 0.0
    }

    pub fn lerp(a: Mood, b: Mood, t: f32) -> Mood {
        let t = t.clamp(0.0, 1.0);
        let l = |x: f32, y: f32| x + (y - x) * t;
        let l3 = |x: [f32; 3], y: [f32; 3]| [l(x[0], y[0]), l(x[1], y[1]), l(x[2], y[2])];
        Mood {
            ambient: l3(a.ambient, b.ambient),
            warm: l3(a.warm, b.warm),
            player_r: l(a.player_r, b.player_r),
            player_k: l(a.player_k, b.player_k),
            glow: l(a.glow, b.glow),
        }
    }
}

/// A place inside a zone with its own mood (Emberwatch inside Pale Hollow).
#[derive(Clone, Copy, Debug)]
pub struct MoodArea {
    pub x: f32,
    pub z: f32,
    /// Full mood inside `r`; fades out over `feather` metres beyond it.
    pub r: f32,
    pub feather: f32,
    pub mood: Mood,
}

impl MoodArea {
    pub fn weight(&self, x: f32, z: f32) -> f32 {
        let d = ((x - self.x).powi(2) + (z - self.z).powi(2)).sqrt();
        let t = ((d - self.r) / self.feather.max(0.01)).clamp(0.0, 1.0);
        let s = 1.0 - t;
        s * s * (3.0 - 2.0 * s)
    }
}

/// Deterministic per-light seed from its rounded position.
fn seed_of(p: Vec3) -> f32 {
    let (x, z) = ((p.x * 4.0).round() as i32, (p.z * 4.0).round() as i32);
    let mut n = (x as u32).wrapping_mul(0x9E37_79B1) ^ (z as u32).wrapping_mul(0x85EB_CA6B);
    n ^= n >> 15;
    n = n.wrapping_mul(0x2C1B_3C6D);
    n ^= n >> 12;
    (n >> 8) as f32 / 16_777_216.0 * 97.0
}

fn hash1(i: i32) -> f32 {
    let mut n = (i as u32).wrapping_mul(0x27D4_EB2D) ^ 0x1656_67B1;
    n ^= n >> 15;
    n = n.wrapping_mul(0x85EB_CA6B);
    n ^= n >> 13;
    (n >> 8) as f32 / 16_777_216.0
}

/// Smooth 1-D value noise in 0..1 (C1 continuous: no steps between frames).
pub fn noise1(x: f32) -> f32 {
    let i = x.floor();
    let f = x - i;
    let s = f * f * (3.0 - 2.0 * f);
    let (a, b) = (hash1(i as i32), hash1(i as i32 + 1));
    a + (b - a) * s
}

/// Brightness factor for a flicker style at time `t` (around 1.0).
pub fn flicker(style: Flicker, seed: f32, t: f32) -> f32 {
    match style {
        Flicker::Steady => 1.0,
        Flicker::Lantern => 1.0 + 0.05 * (noise1(t * 0.9 + seed) - 0.5) * 2.0,
        Flicker::Fire => {
            let n = 0.65 * noise1(t * 2.3 + seed) + 0.35 * noise1(t * 5.1 + seed * 1.7);
            1.0 + 0.12 * (n - 0.5) * 2.0
        }
    }
}

/// One light ready to stamp: screen centre and radii in whole pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Stamp {
    pub x: i32,
    pub y: i32,
    pub rx: i32,
    pub ry: i32,
    pub rgb: [f32; 3],
    pub k: f32,
    pub glow: bool,
}

/// Project a ground light (centre + radius in metres) to a pixel-snapped
/// screen ellipse. Works in iso and the 3D views: the radii come from
/// projecting points one radius away along the world axes.
pub fn project_light(cam: &Camera, pos: Vec3, r: f32) -> Option<(i32, i32, i32, i32)> {
    let c = cam.project(pos);
    if !c.x.is_finite() || !c.y.is_finite() {
        return None;
    }
    let a = cam.project(pos + v3(r, 0.0, 0.0));
    let b = cam.project(pos + v3(0.0, 0.0, r));
    let rx = (a.x - c.x).abs().max((b.x - c.x).abs());
    let ry = (a.y - c.y).abs().max((b.y - c.y).abs()).max(rx * 0.3);
    if !rx.is_finite() || !ry.is_finite() || rx < 1.0 {
        return None;
    }
    Some((c.x.round() as i32, c.y.round() as i32, rx.round() as i32, ry.round().max(1.0) as i32))
}

/// Pick at most `cap` stamps: drop those off the viewport, then keep the
/// strongest and nearest to the screen centre. Ties keep input order, so the
/// set does not flip between frames.
pub fn cull(stamps: &mut Vec<Stamp>, w: usize, h: usize, cap: usize) {
    let (w, h) = (w as i32, h as i32);
    stamps.retain(|s| s.x + s.rx >= 0 && s.x - s.rx < w && s.y + s.ry >= 0 && s.y - s.ry < h && s.k > 0.002);
    if stamps.len() <= cap {
        return;
    }
    let (cx, cy) = (w as f32 * 0.5, h as f32 * 0.5);
    let score = |s: &Stamp| {
        let d = ((s.x as f32 - cx).powi(2) + (s.y as f32 - cy).powi(2)).sqrt();
        s.k * s.rx as f32 / (1.0 + d / (w as f32 * 0.25))
    };
    stamps.sort_by(|a, b| score(b).partial_cmp(&score(a)).unwrap_or(std::cmp::Ordering::Equal));
    stamps.truncate(cap);
}

/// The reusable light layer.
pub struct LightLayer {
    w: usize,
    h: usize,
    /// RGB light per pixel (1.0 = scene colour unchanged).
    buf: Vec<[f32; 3]>,
    sprite: Vec<f32>,
    glow_sprite: Vec<f32>,
    /// Times the buffer was (re)allocated; tests check reuse.
    pub allocs: u32,
}

impl Default for LightLayer {
    fn default() -> Self { LightLayer::new() }
}

impl LightLayer {
    pub fn new() -> LightLayer {
        let mk = |pow: f32| {
            let mut s = vec![0f32; SPRITE * SPRITE];
            let c = (SPRITE as f32 - 1.0) * 0.5;
            for y in 0..SPRITE {
                for x in 0..SPRITE {
                    let (dx, dy) = ((x as f32 - c) / c, (y as f32 - c) / c);
                    let d2 = dx * dx + dy * dy;
                    if d2 < 1.0 {
                        // Smooth to zero at the rim, a soft hot core at the centre.
                        let f = (1.0 - d2) * (1.0 - d2);
                        s[y * SPRITE + x] = f.powf(pow);
                    }
                }
            }
            s
        };
        LightLayer { w: 0, h: 0, buf: Vec::new(), sprite: mk(1.0), glow_sprite: mk(2.5), allocs: 0 }
    }

    /// Resize only on change.
    pub fn ensure(&mut self, w: usize, h: usize) {
        if self.w != w || self.h != h || self.buf.len() != w * h {
            self.w = w;
            self.h = h;
            self.buf = vec![[1.0; 3]; w * h];
            self.allocs += 1;
        }
    }

    pub fn at(&self, x: usize, y: usize) -> [f32; 3] { self.buf[y * self.w + x] }

    /// Ambient fill plus every stamp.
    pub fn build(&mut self, w: usize, h: usize, ambient: [f32; 3], stamps: &[Stamp]) {
        self.ensure(w, h);
        self.buf.fill(ambient);
        for s in stamps {
            stamp(&mut self.buf, w, h, &self.sprite, s, s.k, s.rgb);
        }
    }

    /// Multiply the layer over `out` (RGBA8). `skip` marks pixels left
    /// full-bright (emissive colours). Light above 1 brightens up to `cap`.
    pub fn composite(&self, out: &mut [u8], skip: impl Fn(usize) -> bool) {
        const CAP: f32 = 1.6;
        for (i, l) in self.buf.iter().enumerate() {
            if skip(i) {
                continue;
            }
            let o = &mut out[i * 4..i * 4 + 3];
            for k in 0..3 {
                o[k] = (o[k] as f32 * l[k].min(CAP)).min(255.0) as u8;
            }
        }
    }

    /// Additive coloured bloom over stamps flagged `glow`.
    pub fn glow(&self, out: &mut [u8], w: usize, h: usize, stamps: &[Stamp], strength: f32) {
        if strength <= 0.0 {
            return;
        }
        let mut add = vec![[0f32; 3]; 0];
        for s in stamps.iter().filter(|s| s.glow) {
            let g = Stamp { rx: (s.rx / 3).max(2), ry: (s.ry / 3).max(2), ..*s };
            if add.is_empty() {
                add = vec![[0f32; 3]; w * h];
            }
            stamp(&mut add, w, h, &self.glow_sprite, &g, s.k * strength * 70.0, s.rgb);
        }
        if add.is_empty() {
            return;
        }
        for (i, a) in add.iter().enumerate() {
            if a[0] + a[1] + a[2] <= 0.0 {
                continue;
            }
            let o = &mut out[i * 4..i * 4 + 3];
            for k in 0..3 {
                o[k] = (o[k] as f32 + a[k]).min(255.0) as u8;
            }
        }
    }
}

fn stamp(buf: &mut [[f32; 3]], w: usize, h: usize, sprite: &[f32], s: &Stamp, k: f32, rgb: [f32; 3]) {
    let (x0, x1) = ((s.x - s.rx).max(0), (s.x + s.rx).min(w as i32 - 1));
    let (y0, y1) = ((s.y - s.ry).max(0), (s.y + s.ry).min(h as i32 - 1));
    if x0 > x1 || y0 > y1 {
        return;
    }
    let (fx, fy) = (SPRITE as f32 / (2 * s.rx + 1) as f32, SPRITE as f32 / (2 * s.ry + 1) as f32);
    for y in y0..=y1 {
        let v = (((y - s.y + s.ry) as f32 + 0.5) * fy) as usize;
        let row = &sprite[v.min(SPRITE - 1) * SPRITE..];
        let line = &mut buf[y as usize * w..];
        for x in x0..=x1 {
            let u = (((x - s.x + s.rx) as f32 + 0.5) * fx) as usize;
            let f = row[u.min(SPRITE - 1)] * k;
            if f > 0.0 {
                let p = &mut line[x as usize];
                p[0] += rgb[0] * f;
                p[1] += rgb[1] * f;
                p[2] += rgb[2] * f;
            }
        }
    }
}

/// All lighting state a scene keeps between frames.
#[derive(Default)]
pub struct Lighting {
    pub layer: LightLayer,
    pub statics: Vec<StaticLight>,
    /// Lights added by the host (forges, braziers not modelled as props).
    pub extra: Vec<StaticLight>,
    pub effects: Vec<EffectLight>,
    pub areas: Vec<MoodArea>,
    /// The zone's own mood (host-set); `None` = daylight.
    pub base: Option<Mood>,
    /// Mood after easing, drawn this frame.
    pub mood: Option<Mood>,
    /// Stamps built for the current frame (also drive the glow pass).
    pub stamps: Vec<Stamp>,
    /// Off switch (`?lights=0`, phones).
    pub off: bool,
}

impl Lighting {
    /// Mood wanted at a world point: the zone mood, overlaid by areas.
    pub fn target_mood(&self, x: f32, z: f32) -> Mood {
        let mut m = self.base.unwrap_or(Mood::DAYLIGHT);
        for a in &self.areas {
            let wgt = a.weight(x, z);
            if wgt > 0.0 {
                m = Mood::lerp(m, a.mood, wgt);
            }
        }
        m
    }

    /// Ease toward the target mood and age effect lights.
    pub fn tick(&mut self, dt: f32, at: Option<(f32, f32)>) {
        for e in &mut self.effects {
            e.age += dt;
        }
        self.effects.retain(|e| !e.done());
        let target = at.map_or(self.base.unwrap_or(Mood::DAYLIGHT), |(x, z)| self.target_mood(x, z));
        let cur = self.mood.unwrap_or(target);
        let k = 1.0 - (-MOOD_RATE * dt.max(0.0)).exp();
        self.mood = Some(Mood::lerp(cur, target, k));
    }

    /// Snap the mood (zone change after a fade, tests).
    pub fn settle(&mut self, at: Option<(f32, f32)>) {
        self.mood = Some(at.map_or(self.base.unwrap_or(Mood::DAYLIGHT), |(x, z)| self.target_mood(x, z)));
    }

    pub fn push_effect(&mut self, e: EffectLight) {
        if self.effects.len() >= MAX_EFFECTS {
            self.effects.remove(0);
        }
        self.effects.push(e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flicker_is_smooth_and_deterministic() {
        let s = 12.5;
        let mut prev = flicker(Flicker::Fire, s, 0.0);
        for i in 1..600 {
            let t = i as f32 / 60.0;
            let a = flicker(Flicker::Fire, s, t);
            assert_eq!(a, flicker(Flicker::Fire, s, t), "same time, same light");
            assert!((a - prev).abs() < 0.03, "no jump between frames at {t}: {prev} -> {a}");
            assert!((0.85..=1.15).contains(&a));
            prev = a;
        }
        assert_eq!(flicker(Flicker::Steady, s, 3.0), 1.0);
    }

    #[test]
    fn layer_is_reused_and_lights_fall_off() {
        let mut l = LightLayer::new();
        let st = [Stamp { x: 32, y: 18, rx: 20, ry: 11, rgb: [1.0, 0.6, 0.3], k: 1.0, glow: false }];
        l.build(64, 36, [0.2; 3], &st);
        l.build(64, 36, [0.2; 3], &st);
        assert_eq!(l.allocs, 1, "same size reuses the buffer");
        let c = l.at(32, 18);
        let mid = l.at(42, 18);
        let far = l.at(2, 2);
        assert!(c[0] > mid[0] && mid[0] > far[0], "falls off with distance");
        assert_eq!(far, [0.2; 3], "outside the light is ambient");
        assert!(c[0] > c[2], "warm light");
        l.build(80, 36, [0.2; 3], &st);
        assert_eq!(l.allocs, 2);
    }

    #[test]
    fn cull_drops_offscreen_and_caps() {
        let mk = |x: i32, k: f32| Stamp { x, y: 50, rx: 10, ry: 5, rgb: [1.0; 3], k, glow: false };
        let mut v: Vec<Stamp> = (0..40).map(|i| mk(i * 10, 0.5)).collect();
        v.push(mk(-50, 1.0));
        cull(&mut v, 200, 100, MAX_LIGHTS);
        assert!(v.len() <= MAX_LIGHTS);
        assert!(v.iter().all(|s| s.x + s.rx >= 0 && s.x - s.rx < 200));
    }

    #[test]
    fn moods_blend_by_area() {
        let dark = Mood { ambient: [0.3; 3], ..Mood::DAYLIGHT };
        let mut lt = Lighting::default();
        lt.areas.push(MoodArea { x: 0.0, z: 0.0, r: 10.0, feather: 10.0, mood: dark });
        assert_eq!(lt.target_mood(0.0, 0.0).ambient, [0.3; 3]);
        assert_eq!(lt.target_mood(50.0, 0.0), Mood::DAYLIGHT);
        let mid = lt.target_mood(15.0, 0.0).ambient[0];
        assert!(mid > 0.3 && mid < 1.0);
        assert!(Mood::DAYLIGHT.bright() && !dark.bright());
        // Easing: one short tick moves only part of the way.
        lt.mood = Some(Mood::DAYLIGHT);
        lt.tick(1.0 / 60.0, Some((0.0, 0.0)));
        let a = lt.mood.unwrap().ambient[0];
        assert!(a < 1.0 && a > 0.9, "eases, no pop: {a}");
    }

    #[test]
    fn effect_envelope_waits_then_fades() {
        let mut e = EffectLight { pos: v3(0.0, 0.0, 0.0), r: 3.0, k: 1.0, rgb: [1.0; 3], delay: 0.2, age: 0.0, life: 0.4 };
        assert_eq!(e.envelope(), 0.0);
        e.age = 0.25;
        assert!(e.envelope() > 0.0);
        e.age = 0.61;
        assert!(e.done());
    }
}
