// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Druid stick-forms. Bear, deer, lion, and racerunner are baked envelopes.
use std::sync::OnceLock;

use serde::Deserialize;
use stick_engine::camera::{Camera, HEIGHT_PX};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;

use crate::compat::C_OUTLINE;
use crate::creature::Pose;
use crate::palette::{EMBER, WOOD, WOOD_D, WOOD_L};

#[derive(Clone, Debug, Deserialize)]
pub struct StickLobe {
    /// Forward offset, metres at size 1 (hip negative, snout positive).
    pub along: f32,
    /// Height, metres at size 1.
    pub y: f32,
    /// Girth radius, metres at size 1.
    pub r: f32,
    /// 0 body, 1 withers, 2 skull, 3 snout, 4 tail.
    pub bias: u8,
}

#[derive(Clone, Debug, Deserialize)]
pub struct StickFormDef {
    pub id: String,
    /// bear | deer | lion | racer
    pub kit: String,
    pub hip_along: f32,
    pub sh_along: f32,
    pub stance: f32,
    pub leg_thick: f32,
    pub lobes: Vec<StickLobe>,
}

impl StickFormDef {
    pub fn from_ron(src: &str) -> Result<StickFormDef, String> {
        let t: StickFormDef = ron::from_str(src).map_err(|e| e.to_string())?;
        if t.lobes.is_empty() {
            return Err(format!("form '{}' needs a lobe", t.id));
        }
        for lobe in &t.lobes {
            if lobe.r <= 0.0 {
                return Err(format!("form '{}': a lobe must have a radius", t.id));
            }
        }
        Ok(t)
    }
}

fn load(src: &'static str, name: &str) -> StickFormDef {
    StickFormDef::from_ron(src).unwrap_or_else(|e| panic!("{name}: {e}"))
}

pub fn stick_bear() -> &'static StickFormDef {
    static T: OnceLock<StickFormDef> = OnceLock::new();
    T.get_or_init(|| load(include_str!("../assets/forms/ba_stick_bear.ron"), "ba_stick_bear"))
}

pub fn stick_deer() -> &'static StickFormDef {
    static T: OnceLock<StickFormDef> = OnceLock::new();
    T.get_or_init(|| load(include_str!("../assets/forms/ba_stick_deer.ron"), "ba_stick_deer"))
}

pub fn stick_lion() -> &'static StickFormDef {
    static T: OnceLock<StickFormDef> = OnceLock::new();
    T.get_or_init(|| load(include_str!("../assets/forms/ba_stick_lion.ron"), "ba_stick_lion"))
}

pub fn racerunner() -> &'static StickFormDef {
    static T: OnceLock<StickFormDef> = OnceLock::new();
    T.get_or_init(|| load(include_str!("../assets/forms/ba_racerunner.ron"), "ba_racerunner"))
}

pub fn form_def(kind: u8) -> &'static StickFormDef {
    match kind {
        1 => stick_deer(),
        2 => stick_lion(),
        3 => racerunner(),
        _ => stick_bear(),
    }
}

/// Kept so the form viewer / wasm API stay stable. Baked forms ignore seed.
pub fn set_seed(_seed: u32) {}

pub fn active_seed(_def: &StickFormDef) -> u32 {
    0
}

pub struct FormLayout {
    pub hip: Vec3,
    pub sh: Vec3,
    pub head: Vec3,
}

/// Draw a stick-form envelope. kind 0 bear / 1 deer / 2 lion / 3 racerunner.
pub fn draw_form(fb: &mut Framebuffer, cam: &Camera, kind: u8, s: f32, ps: &Pose) -> FormLayout {
    let def = form_def(kind);
    let f = v3(ps.yaw.sin(), 0.0, ps.yaw.cos());
    let right = v3(ps.yaw.cos(), 0.0, -ps.yaw.sin());
    let up = v3(0.0, 1.0, 0.0);
    let flat = 1.0 - ps.dead * 0.72;
    let trot = (ps.phase * 2.0).sin() * 0.03 * s * ps.moving;
    let base = ps.pos + up * trot.abs();
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    let limb = (1.5 + s * 1.1).max(1.3);
    let mid_along = {
        let a0 = def.lobes.first().map(|l| l.along).unwrap_or(0.0);
        let a1 = def.lobes.last().map(|l| l.along).unwrap_or(0.0);
        (a0 + a1) * 0.5
    };
    let at = |along: f32, y: f32, side: f32| {
        base + f * ((along - mid_along) * s) + up * (y * s * flat) + right * (side * s)
    };

    let mut prev: Option<Vec3> = None;
    let mut head = at(def.lobes.last().map(|l| l.along).unwrap_or(0.3), 0.5, 0.0);
    let mut snout = head;
    let mut hip_lobe = at(def.hip_along, 0.4, 0.0);
    for lobe in &def.lobes {
        let center = at(lobe.along, lobe.y, 0.0);
        if (lobe.along - def.hip_along).abs() < 0.02 {
            hip_lobe = center;
        }
        if lobe.bias == 2 {
            head = center;
        }
        if lobe.bias == 3 {
            snout = center;
        }
        if let Some(a) = prev {
            let thick = limb * (0.55 + lobe.r * 1.8);
            fb.capsule(p(a), p(center), thick, WOOD, o);
        }
        prev = Some(center);
        let girth = (lobe.r * s * HEIGHT_PX * 0.82).max(2.4);
        fb.disc(p(center), girth, WOOD, o);
    }

    let hip = at(def.hip_along, y_at(def, def.hip_along), 0.0);
    let sh = at(def.sh_along, y_at(def, def.sh_along), 0.0);
    fb.disc(p(head), (head_disc(def) * s * HEIGHT_PX).max(2.4), WOOD, o);
    fb.capsule(p(head), p(snout), 1.55, WOOD_L, o);
    match def.kit.as_str() {
        "deer" => antlers(fb, cam, head, f, right, up, flat, s),
        "lion" => {
            // Ruff behind and above the skull so the muzzle reads in front.
            let mane = head - f * (0.10 * s) + up * (0.07 * s * flat);
            fb.disc(p(mane), (0.12 * s * HEIGHT_PX).max(2.8), WOOD_D, o);
            for side in [-1.0f32, 1.0] {
                let puff = mane + right * (0.05 * side * s) - f * (0.015 * s);
                fb.disc(p(puff), (0.09 * s * HEIGHT_PX).max(2.2), WOOD, o);
            }
            let sway = (ps.phase).sin() * 0.03 * s;
            let tail_m = hip_lobe + f * -(0.18 * s) + up * (0.08 * s * flat) + right * sway;
            let tail_t = hip_lobe + f * -(0.34 * s) + up * (0.03 * s * flat) + right * (sway * 1.2);
            fb.capsule(p(hip_lobe), p(tail_m), 1.1, WOOD_D, o);
            fb.capsule(p(tail_m), p(tail_t), 0.95, WOOD, o);
            fb.disc(p(tail_t), 2.3, WOOD, o);
        }
        "racer" => {
            let wave = (ps.phase * 1.6).sin() * 0.05 * s * (0.35 + 0.65 * ps.moving);
            let mid = hip_lobe + f * -(0.18 * s) + right * wave + up * (0.06 * s * flat);
            let tip = hip_lobe + f * -(0.38 * s) + right * (wave * 1.4) + up * (0.05 * s * flat);
            fb.capsule(p(hip_lobe), p(mid), 1.1, WOOD_D, o);
            fb.capsule(p(mid), p(tip), 0.95, WOOD, o);
            let glow = 0.55 + 0.45 * (ps.time * 6.0).sin();
            fb.disc(p(tip), 1.6 + glow, if glow > 0.7 { EMBER } else { WOOD_L }, None);
        }
        _ => {
            for side in [-1.0f32, 1.0] {
                let root = head + right * (0.05 * side * s) + up * (0.05 * s * flat);
                let tip = root + right * (0.04 * side * s) + up * (0.10 * s * flat) - f * (0.01 * s);
                fb.capsule(p(root), p(tip), 1.25, WOOD, o);
                fb.disc(p(tip), 1.4, WOOD, o);
            }
        }
    }
    let eye = head + f * (0.06 * s) + up * (0.025 * s);
    fb.plot(p(eye).x as i32, p(eye).y as i32, p(eye).d - 0.5, C_OUTLINE);
    FormLayout { hip, sh, head }
}

fn head_disc(def: &StickFormDef) -> f32 {
    match def.kit.as_str() {
        "deer" => 0.09,
        "lion" => 0.08,
        "racer" => 0.08,
        _ => 0.15,
    }
}

fn antlers(
    fb: &mut Framebuffer,
    cam: &Camera,
    head: Vec3,
    f: Vec3,
    right: Vec3,
    up: Vec3,
    flat: f32,
    s: f32,
) {
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    for side in [-1.0f32, 1.0] {
        let root = head + right * (0.035 * side * s) + up * (0.05 * s * flat);
        let mid = root + up * (0.16 * s * flat) + right * (0.05 * side * s) - f * (0.02 * s);
        let tip = mid + up * (0.12 * s * flat) + right * (0.07 * side * s);
        let fork = mid + up * (0.07 * s * flat) - right * (0.04 * side * s) + f * (0.025 * s);
        fb.capsule(p(root), p(mid), 1.15, WOOD_L, o);
        fb.capsule(p(mid), p(tip), 1.0, WOOD_L, o);
        fb.capsule(p(mid), p(fork), 0.95, WOOD, o);
    }
}

fn y_at(def: &StickFormDef, along: f32) -> f32 {
    let mut best = def.lobes[0].y;
    let mut dist = (def.lobes[0].along - along).abs();
    for lobe in &def.lobes[1..] {
        let d = (lobe.along - along).abs();
        if d < dist {
            dist = d;
            best = lobe.y;
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stick_forms_load() {
        assert_eq!(stick_bear().id, "ba_stick_bear");
        assert_eq!(stick_bear().kit, "bear");
        assert_eq!(stick_deer().id, "ba_stick_deer");
        assert_eq!(stick_lion().id, "ba_stick_lion");
        assert_eq!(racerunner().id, "ba_racerunner");
        for def in [stick_bear(), stick_deer(), stick_lion(), racerunner()] {
            assert!(def.lobes.len() >= 6);
            assert!(def.lobes.iter().all(|l| l.r > 0.0));
            assert!(def.lobes.iter().any(|l| l.bias == 2));
            assert!(def.lobes.iter().any(|l| l.bias == 3));
        }
    }
}
