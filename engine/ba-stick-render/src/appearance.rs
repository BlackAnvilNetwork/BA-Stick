// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Stick Engine hair styles and shared hair/body colour ramps (client cosmetic).

use stick_engine::body::{HairStyle, ALL_HAIR};
use stick_engine::math::v3;
use stick_engine::math::Vec3;
use stick_engine::raster::{ramp_id, shade, HAIR_RAMPS, LUT};
use stick_engine::character::HairSpring;

use crate::compat::{Look, C_ACCENT};

/// Three palette steps per ramp: far, body lit, hair highlight (shades 2, 4, 5).
pub const TONE_BASE: u8 = 228;
pub const N_RAMPS: usize = HAIR_RAMPS.len();
const SHADES: [u8; 3] = [2, 4, 5];

#[derive(Clone, Copy, Debug)]
pub struct Appearance {
    pub style: HairStyle,
    /// Index into [`HAIR_RAMPS`].
    pub hair_color: u8,
    pub body_color: u8,
}

impl Default for Appearance {
    fn default() -> Self {
        Appearance {
            style: HairStyle::Buzz,
            hair_color: 1,
            body_color: 1,
        }
    }
}

impl Appearance {
    pub fn cycle_style(&mut self, d: i32) {
        let n = ALL_HAIR.len() as i32;
        let i = ALL_HAIR.iter().position(|&s| s == self.style).unwrap_or(0) as i32;
        let j = (i + d).rem_euclid(n) as usize;
        self.style = ALL_HAIR[j];
    }

    pub fn cycle_hair_color(&mut self, d: i32) {
        let n = N_RAMPS as i32;
        self.hair_color = (self.hair_color as i32 + d).rem_euclid(n) as u8;
    }

    pub fn cycle_body_color(&mut self, d: i32) {
        let n = N_RAMPS as i32;
        self.body_color = (self.body_color as i32 + d).rem_euclid(n) as u8;
    }

    pub fn look(&self) -> Look {
        let b = tone(self.body_color);
        let h = tone(self.hair_color);
        Look {
            body: b.body,
            far: b.far,
            accent: C_ACCENT,
            hair: h.hair,
        }
    }
}

struct Tone {
    far: u8,
    body: u8,
    hair: u8,
}

fn tone(idx: u8) -> Tone {
    let i = (idx as usize).min(N_RAMPS - 1);
    let base = TONE_BASE + (i as u8) * 3;
    Tone {
        far: base,
        body: base + 1,
        hair: base + 2,
    }
}

pub fn bake_palette(p: &mut [u32; 256]) {
    for (i, name) in HAIR_RAMPS.iter().enumerate() {
        let Some(rid) = ramp_id(name) else { continue };
        let base = TONE_BASE as usize + i * 3;
        for (k, sh) in SHADES.iter().enumerate() {
            let idx = shade(rid, *sh) as usize;
            p[base + k] = LUT[idx];
        }
    }
}

pub fn update_hair_spring(style: HairStyle, spring: &mut [HairSpring; 3], head: Vec3, dt: f32) {
    if !style.sways() {
        *spring = [HairSpring::default(); 3];
        return;
    }
    const GAIN: f32 = 1.6;
    for (s, v) in spring.iter_mut().zip([head.x, head.y, head.z]) {
        s.step(v, dt, GAIN);
    }
}

pub fn hair_sway(spring: &[HairSpring; 3]) -> Vec3 {
    let [x, y, z] = spring;
    v3(x.x, y.x, z.x)
}
