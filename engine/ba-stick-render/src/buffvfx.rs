// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Buff / ailment visuals (#34). The host maps `units[].buffs` (see
//! `apps/stick-web/src/content/buff-vfx.json`) to a bit mask of visual kinds
//! each frame; this module only draws them. Five bespoke effects mirror the
//! old client (Quicken orbs, Flux aura, Temporal Distortion impact, petrify
//! shell, resonance ring); everything else uses a generic category treatment.
use stick_engine::camera::{Camera, HEIGHT_PX, P2};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;

use crate::compat::*;
use crate::palette::*;

pub const QUICKEN: u32 = 1 << 0;
pub const FLUX: u32 = 1 << 1;
pub const TD: u32 = 1 << 2;
pub const PETRIFY: u32 = 1 << 3;
pub const RESONANCE: u32 = 1 << 4;
pub const HASTE: u32 = 1 << 5;
pub const SLOW: u32 = 1 << 6;
pub const BIND: u32 = 1 << 7;
pub const STUN: u32 = 1 << 8;
pub const SLEEP: u32 = 1 << 9;
pub const SILENCE: u32 = 1 << 10;
pub const PARA: u32 = 1 << 11;
pub const BLIND: u32 = 1 << 12;
pub const PROTECT: u32 = 1 << 13;
pub const SHELL: u32 = 1 << 14;
pub const BERSERK: u32 = 1 << 15;
pub const REGEN: u32 = 1 << 16;
pub const DOT: u32 = 1 << 17;
pub const WARD: u32 = 1 << 18;
pub const ENFEEBLE: u32 = 1 << 19;
pub const FLASH: u32 = 1 << 20;

/// Visual kind names, index = bit. Must match `VFX_BITS` in apps/stick-web/src/buffs.ts.
pub const NAMES: [&str; 21] = [
    "quicken",
    "flux",
    "td",
    "petrify",
    "resonance",
    "haste",
    "slow",
    "bind",
    "stun",
    "sleep",
    "silence",
    "para",
    "blind",
    "protect",
    "shell",
    "berserk",
    "regen",
    "dot",
    "ward",
    "enfeeble",
    "flash",
];

/// Per-unit buff visual state set by the host each frame.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BuffFx {
    pub mask: u32,
    /// Temporal Distortion impact life 0..1 (< 0 = none).
    pub td: f32,
    /// Resonance burst life 0..1 (< 0 = none).
    pub burst: f32,
}

impl Default for BuffFx {
    fn default() -> Self {
        BuffFx {
            mask: 0,
            td: -1.0,
            burst: -1.0,
        }
    }
}

fn put(fb: &mut Framebuffer, x: i32, y: i32, c: u8) {
    if x >= 0 && y >= 0 && (x as usize) < fb.w && (y as usize) < fb.h {
        fb.color[y as usize * fb.w + x as usize] = c;
    }
}

/// Depth-tested pixel (hidden behind anything nearer than `d`).
fn put_d(fb: &mut Framebuffer, x: i32, y: i32, d: f32, c: u8) {
    if x >= 0 && y >= 0 && (x as usize) < fb.w && (y as usize) < fb.h {
        let i = y as usize * fb.w + x as usize;
        if d <= fb.depth[i] {
            fb.color[i] = c;
        }
    }
}

/// True where something (unit/prop) already wrote depth: lets overlays stay on the body.
fn solid(fb: &Framebuffer, x: i32, y: i32) -> bool {
    x >= 0
        && y >= 0
        && (x as usize) < fb.w
        && (y as usize) < fb.h
        && fb.depth[y as usize * fb.w + x as usize].is_finite()
}

fn h01(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    (x & 0xFFFF) as f32 / 65535.0
}

fn ellipse(fb: &mut Framebuffer, cx: f32, cy: f32, rx: f32, ry: f32, c: u8, dash: Option<f32>) {
    let n = ((rx + ry) * 3.0).clamp(16.0, 120.0) as usize;
    for i in 0..n {
        if let Some(ph) = dash {
            if ((i as f32 / n as f32 * 10.0 + ph) as i32) & 1 == 1 {
                continue;
            }
        }
        let a = i as f32 / n as f32 * std::f32::consts::TAU;
        put(
            fb,
            (cx + a.cos() * rx).round() as i32,
            (cy + a.sin() * ry).round() as i32,
            c,
        );
    }
}

fn plus(fb: &mut Framebuffer, x: f32, y: f32, c: u8) {
    let (x, y) = (x as i32, y as i32);
    for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)] {
        put(fb, x + dx, y + dy, c);
    }
}

/// Everything a draw call needs about the unit.
pub struct Anchor {
    /// Feet in scene space (camera-relative height applied).
    pub base: Vec3,
    pub feet: P2,
    /// Unit height in pixels.
    pub h: f32,
    /// Stable per-unit seed (for desync between units).
    pub seed: u32,
}

/// Effects drawn on the ground before units (depth-free decals).
pub fn draw_ground(fb: &mut Framebuffer, cam: &Camera, a: &Anchor, fx: &BuffFx, t: f32) {
    if fx.mask & BIND != 0 {
        ground_ring(fb, cam, a.base, 0.45, FX_TELL_DARK, Some(t * 2.0));
        ground_ring(fb, cam, a.base, 0.38, FX_CAST, Some(-t * 2.0));
    }
    if fx.mask & TD != 0 && fx.td >= 0.0 {
        let life = fx.td.clamp(0.0, 1.0);
        // Earth + chrona ring expanding from the target.
        ground_ring(
            fb,
            cam,
            a.base,
            0.3 + life * 1.6,
            if life < 0.5 { FX_CAST } else { ROCK_L },
            None,
        );
        ground_ring(fb, cam, a.base, 0.2 + life * 1.1, ROCK, Some(t * 6.0));
        // Radial ground cracks.
        for k in 0..7u32 {
            let ang = h01(a.seed ^ (k * 97)) * std::f32::consts::TAU;
            let len = (0.4 + h01(k * 13 + a.seed) * 0.7) * (life * 2.0).min(1.0);
            let mut p = cam.project(a.base);
            for s in 1..=4 {
                let r = len * s as f32 / 4.0;
                let jit = (h01(k * 31 + s) - 0.5) * 0.25;
                let q = cam.project(a.base + v3((ang + jit).cos() * r, 0.0, (ang + jit).sin() * r));
                fb.line(P2 { d: f32::MAX, ..p }, P2 { d: f32::MAX, ..q }, C_OUTLINE);
                p = q;
            }
        }
    }
}

fn ground_ring(fb: &mut Framebuffer, cam: &Camera, c: Vec3, r: f32, col: u8, dash: Option<f32>) {
    let n = (r * 40.0).clamp(24.0, 140.0) as usize;
    for i in 0..n {
        if let Some(ph) = dash {
            if ((i as f32 / n as f32 * 12.0 + ph) as i32) & 1 == 1 {
                continue;
            }
        }
        let a0 = i as f32 / n as f32 * std::f32::consts::TAU;
        let a1 = (i + 1) as f32 / n as f32 * std::f32::consts::TAU;
        let p0 = cam.project(c + v3(a0.cos() * r, 0.0, a0.sin() * r));
        let p1 = cam.project(c + v3(a1.cos() * r, 0.0, a1.sin() * r));
        fb.line(P2 { d: f32::MAX, ..p0 }, P2 { d: f32::MAX, ..p1 }, col);
    }
}

/// Effects drawn after the unit (on / around the body).
pub fn draw_body(fb: &mut Framebuffer, cam: &Camera, a: &Anchor, fx: &BuffFx, t: f32) {
    let m = fx.mask;
    let (fx_, fy) = (a.feet.x, a.feet.y);
    let top = fy - a.h;
    let chest = fy - a.h * 0.62;
    let ph = h01(a.seed) * 10.0;
    let tt = t + ph;

    if m & PETRIFY != 0 {
        // Stone shell: jagged dark cracks clipped to the body's pixels.
        for k in 0..4u32 {
            let mut x = fx_ + (h01(a.seed + k * 7) - 0.5) * 8.0;
            let mut y = top + 3.0 + h01(a.seed + k * 11) * a.h * 0.3;
            for s in 0..8u32 {
                let nx = x + (h01(a.seed ^ (k * 131 + s * 17)) - 0.5) * 5.0;
                let ny = y + 2.0 + h01(k * 3 + s) * 3.0;
                let steps = 4;
                for i in 0..=steps {
                    let (px, py) = (
                        (x + (nx - x) * i as f32 / steps as f32) as i32,
                        (y + (ny - y) * i as f32 / steps as f32) as i32,
                    );
                    if solid(fb, px, py) {
                        put(fb, px, py, C_OUTLINE);
                    }
                }
                x = nx;
                y = ny;
            }
        }
    }
    if m & FLUX != 0 {
        // Shimmering cyan aura hugging the silhouette + rising motes.
        let wob = (tt * 4.0).sin();
        let pulse = 0.5 + 0.5 * (tt * 2.2).sin();
        let (cx, cy) = (fx_, fy - a.h * 0.5);
        ellipse(
            fb,
            cx,
            cy,
            11.0 + wob + pulse,
            a.h * 0.58 + pulse,
            CR_WIGHT,
            None,
        );
        ellipse(
            fb,
            cx,
            cy,
            12.0 + wob + pulse,
            a.h * 0.6 + pulse,
            WATER + 3,
            Some(tt * 3.0),
        );
        ellipse(
            fb,
            cx,
            cy,
            9.5 - wob * 0.5,
            a.h * 0.54,
            CR_WIGHT,
            Some(-tt * 2.0),
        );
        for k in 0..10u32 {
            let life = (tt * 0.6 + h01(k + 5)) % 1.0;
            let x = fx_ + (h01(k * 9 + 1) - 0.5) * 20.0;
            let y = fy - life * (a.h + 8.0);
            let c = if life < 0.7 { CR_WIGHT } else { FX_HOVER };
            put(fb, x as i32, y as i32, c);
            put(fb, x as i32, y as i32 + 1, WATER + 3);
        }
    }
    if m & QUICKEN != 0 {
        // Two counter-rotating tilted belts of glow orbs around the chest,
        // depth-tested so orbs pass behind the body.
        let chest_y = a.h * 0.62 / HEIGHT_PX;
        for belt in 0..2 {
            let dir = if belt == 0 { 1.0 } else { -1.0 };
            let tilt = if belt == 0 { 0.16 } else { -0.16 };
            for j in 0..4 {
                for trail in 0..3 {
                    let ang = tt * 2.7 * dir
                        + j as f32 * std::f32::consts::FRAC_PI_2
                        + belt as f32 * 0.78
                        - dir * trail as f32 * 0.18;
                    let r = 0.7;
                    let off = v3(
                        ang.cos() * r,
                        chest_y + ang.sin() * r * tilt * 2.0,
                        ang.sin() * r,
                    );
                    let p = cam.project(a.base + off);
                    let d = p.d;
                    let (x, y) = (p.x as i32, p.y as i32);
                    if trail == 0 {
                        for dy in -2i32..=2 {
                            for dx in -2i32..=2 {
                                let r2 = dx * dx + dy * dy;
                                if r2 > 5 {
                                    continue;
                                }
                                let c = if r2 == 0 {
                                    FX_HOVER
                                } else if r2 <= 2 {
                                    FX_LEVEL
                                } else {
                                    FX_RING_SELF
                                };
                                put_d(fb, x + dx, y + dy, d - 0.01, c);
                            }
                        }
                    } else {
                        put_d(
                            fb,
                            x,
                            y,
                            d - 0.01,
                            if trail == 1 { FX_LEVEL } else { FX_RING_SELF },
                        );
                    }
                }
            }
        }
    }
    if m & RESONANCE != 0 || (m & QUICKEN != 0 && fx.burst >= 0.0) {
        // Resonance: soft rings bursting outward from the chest.
        let life = if fx.burst >= 0.0 {
            fx.burst.clamp(0.0, 1.0)
        } else {
            (tt * 0.9) % 1.0
        };
        let r = 6.0 + life * 26.0;
        let col = if life < 0.5 { FX_LEVEL } else { FX_RING_SELF };
        ellipse(
            fb,
            fx_,
            chest,
            r,
            r * 0.55,
            col,
            if life > 0.7 { Some(tt * 4.0) } else { None },
        );
        ellipse(
            fb,
            fx_,
            chest,
            r + 1.0,
            r * 0.55 + 1.0,
            CR_WIGHT,
            if life > 0.5 { Some(tt * 4.0) } else { None },
        );
        if life < 0.6 {
            ellipse(fb, fx_, chest, r * 0.6, r * 0.33, FX_LEVEL, None);
        }
    }
    if m & TD != 0 && fx.td >= 0.0 {
        // Chrona crack flash on the body + debris chunks thrown up.
        let life = fx.td.clamp(0.0, 1.0);
        if life < 0.5 {
            for k in 0..3u32 {
                let x0 = fx_ + (h01(a.seed + k) - 0.5) * 10.0;
                let mut y = chest - 6.0;
                let mut x = x0;
                for s in 0..5u32 {
                    let nx = x + (h01(k * 17 + s) - 0.5) * 6.0;
                    let ny = y + 3.0;
                    fb.line(
                        P2 {
                            x,
                            y,
                            d: f32::MAX,
                            s: 1.0,
                        },
                        P2 {
                            s: 1.0,
                            x: nx,
                            y: ny,
                            d: f32::MAX,
                        },
                        FX_CAST,
                    );
                    x = nx;
                    y = ny;
                }
            }
        }
        for k in 0..8u32 {
            let ang = h01(k * 23 + a.seed) * std::f32::consts::TAU;
            let sp = 0.6 + h01(k * 5) * 0.9;
            let h = (life * 4.0 - life * life * 4.0) * (0.8 + h01(k * 7) * 0.8);
            let p = cam
                .project(a.base + v3(ang.cos() * sp * life * 1.4, h, ang.sin() * sp * life * 1.4));
            let c = if k % 3 == 0 { FX_CAST } else { ROCK };
            for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                put(fb, p.x as i32 + dx, p.y as i32 + dy, c);
            }
        }
    }
    if m & HASTE != 0 && m & QUICKEN == 0 {
        // Gold speed chevrons streaming up beside the legs.
        for k in 0..3 {
            let life = (tt * 1.8 + k as f32 / 3.0) % 1.0;
            for side in [-1.0f32, 1.0] {
                let x = fx_ + side * 9.0;
                let y = fy - 2.0 - life * a.h * 0.7;
                put(fb, x as i32, y as i32, FX_LEVEL);
                put(fb, (x - side) as i32, (y + 1.0) as i32, FX_LEVEL);
                put(fb, (x - side * 2.0) as i32, (y + 2.0) as i32, FX_RING_SELF);
            }
        }
    }
    if m & SLOW != 0 {
        // Heavy blue drips sliding down.
        for k in 0..4u32 {
            let life = (tt * 0.5 + h01(k * 3 + 1)) % 1.0;
            let x = fx_ + (h01(k * 11 + a.seed) - 0.5) * 14.0;
            let y = top + life * a.h;
            put(fb, x as i32, y as i32, CR_WIGHT);
            put(fb, x as i32, y as i32 - 1, WATER + 3);
        }
    }
    if m & BIND != 0 {
        // Chain links across the shins.
        let y = fy - 4.0;
        for i in -3..=3 {
            let x = fx_ + i as f32 * 2.5;
            put(fb, x as i32, y as i32 + (i & 1), FX_TELL_DARK);
            put(fb, x as i32 + 1, y as i32 + (i & 1), FX_CAST);
        }
    }
    if m & STUN != 0 {
        for k in 0..3 {
            let ang = tt * 4.0 + k as f32 * std::f32::consts::TAU / 3.0;
            plus(
                fb,
                fx_ + ang.cos() * 7.0,
                top - 2.0 + ang.sin() * 2.0,
                FX_LEVEL,
            );
        }
    }
    if m & SLEEP != 0 {
        // Little z's rising off the head.
        for k in 0..2 {
            let life = (tt * 0.6 + k as f32 * 0.5) % 1.0;
            let (x, y) = (
                (fx_ + 4.0 + life * 6.0) as i32,
                (top - 2.0 - life * 10.0) as i32,
            );
            let s = if life > 0.5 { 2 } else { 1 };
            for i in 0..=s {
                put(fb, x + i, y - s, FX_HOVER);
                put(fb, x + i, y + 1, FX_HOVER);
                put(fb, x + s - i, y - s + 1 + i, FX_HOVER);
            }
        }
    }
    if m & SILENCE != 0 {
        // Speech bubble with a slash.
        let (x, y) = ((fx_ - 8.0) as i32, (top - 4.0) as i32);
        for dx in -2..=2 {
            put(fb, x + dx, y - 2, FX_HOVER);
            put(fb, x + dx, y + 2, FX_HOVER);
        }
        for dy in -1..=1 {
            put(fb, x - 3, y + dy, FX_HOVER);
            put(fb, x + 3, y + dy, FX_HOVER);
        }
        for i in -2..=2 {
            put(fb, x + i, y - i, FX_TELL);
        }
    }
    if m & PARA != 0 {
        // Crackling yellow zigzags on the body, re-rolled 10x/s.
        let seed = (tt * 10.0) as u32;
        for k in 0..2u32 {
            if h01(seed * 7 + k) < 0.35 {
                continue;
            }
            let mut x = fx_ + (h01(seed + k * 5) - 0.5) * 10.0;
            let mut y = top + h01(seed * 3 + k) * a.h * 0.6;
            for s in 0..4u32 {
                let nx = x + if s & 1 == 0 { 3.0 } else { -3.0 };
                let ny = y + 2.5;
                fb.line(
                    P2 {
                        x,
                        y,
                        d: f32::MAX,
                        s: 1.0,
                    },
                    P2 {
                        s: 1.0,
                        x: nx,
                        y: ny,
                        d: f32::MAX,
                    },
                    FN_CRIT,
                );
                x = nx;
                y = ny;
            }
        }
    }
    if m & BLIND != 0 {
        // Dark dithered band over the eyes.
        let y = top + a.h * 0.08;
        for dy in 0..3 {
            for dx in -5..=5 {
                if (dx + dy) & 1 == 0 || dy == 1 {
                    put(
                        fb,
                        (fx_ + dx as f32) as i32,
                        (y + dy as f32) as i32,
                        C_OUTLINE,
                    );
                }
            }
        }
    }
    if m & PROTECT != 0 {
        ellipse(
            fb,
            fx_,
            fy - a.h * 0.5,
            12.0,
            a.h * 0.6,
            FX_RING_SELF,
            Some(tt * 1.5),
        );
    }
    if m & SHELL != 0 {
        ellipse(
            fb,
            fx_,
            fy - a.h * 0.5,
            13.5,
            a.h * 0.64,
            CR_WIGHT,
            Some(-tt * 1.5 + 0.5),
        );
    }
    if m & BERSERK != 0 {
        for k in 0..6u32 {
            let life = (tt * 1.2 + h01(k + 40)) % 1.0;
            let x = fx_ + (h01(k * 19 + 3) - 0.5) * 14.0 + (tt * 6.0 + k as f32).sin();
            let y = fy - life * a.h * 1.1;
            put(
                fb,
                x as i32,
                y as i32,
                if life < 0.5 { FX_TELL } else { EMBER },
            );
        }
    }
    if m & REGEN != 0 {
        for k in 0..3u32 {
            let life = (tt * 0.7 + k as f32 / 3.0) % 1.0;
            let x = fx_ + (h01(k * 29 + 2) - 0.5) * 14.0;
            plus(
                fb,
                x,
                fy - 4.0 - life * a.h,
                if life < 0.7 { FN_HEAL } else { FX_HP },
            );
        }
    }
    if m & DOT != 0 {
        for k in 0..4u32 {
            let life = (tt * 0.8 + h01(k + 70)) % 1.0;
            let x = (fx_ + (h01(k * 37 + 1) - 0.5) * 12.0) as i32;
            let y = (fy - 2.0 - life * a.h * 0.8) as i32;
            put(fb, x, y, CR_ADDER);
            if life > 0.4 {
                put(fb, x + 1, y, CR_ADDER);
                put(fb, x, y - 1, FX_CAST);
            }
        }
    }
    if m & WARD != 0 {
        for k in 0..3 {
            let ang = tt * 1.4 + k as f32 * std::f32::consts::TAU / 3.0;
            let y = fy - a.h * (0.3 + 0.3 * ((tt + k as f32) * 0.8).sin().abs());
            put(
                fb,
                (fx_ + ang.cos() * 10.0) as i32,
                (y + ang.sin() * 2.0) as i32,
                FX_RING_SELF,
            );
        }
    }
    if m & ENFEEBLE != 0 {
        for k in 0..4u32 {
            let life = (tt * 0.5 + h01(k + 90)) % 1.0;
            let x = fx_ + (h01(k * 41 + 5) - 0.5) * 16.0;
            put(fb, x as i32, (top + life * a.h) as i32, FX_CAST);
        }
    }
    if m & FLASH != 0 {
        for k in 0..5 {
            let ang = k as f32 / 5.0 * std::f32::consts::TAU + tt;
            plus(fb, fx_ + ang.cos() * 9.0, chest + ang.sin() * 7.0, FX_HOVER);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AnimState, Scene, UnitInput};

    fn scene() -> Scene {
        let mut s = Scene::new(320, 240);
        s.upsert_unit(
            "p",
            UnitInput {
                x: 0.0,
                y: 0.0,
                z: 0.0,
                facing: 0.0,
                anim: AnimState::Idle,
                preset: "knight".into(),
            },
        );
        s.set_camera(0.0, 0.0);
        s.tick(0.3);
        s
    }

    #[test]
    fn every_kind_draws_pixels() {
        let mut base = scene();
        base.draw();
        let ref_px = base.fb.color.clone();
        for (bit, name) in NAMES.iter().enumerate() {
            let mut s = scene();
            assert!(s.set_buffs(
                "p",
                BuffFx {
                    mask: 1 << bit,
                    td: 0.3,
                    burst: 0.3
                }
            ));
            s.draw();
            let diff =
                s.fb.color
                    .iter()
                    .zip(&ref_px)
                    .filter(|(a, b)| a != b)
                    .count();
            assert!(diff > 0, "{name} drew nothing");
        }
    }

    #[test]
    fn unknown_unit_and_clear() {
        let mut s = scene();
        assert!(!s.set_buffs(
            "nobody",
            BuffFx {
                mask: QUICKEN,
                ..Default::default()
            }
        ));
        s.set_buffs(
            "p",
            BuffFx {
                mask: QUICKEN,
                ..Default::default()
            },
        );
        assert!(s.buffs("p").is_some());
        s.set_buffs("p", BuffFx::default());
        assert!(s.buffs("p").is_none());
        s.set_buffs(
            "p",
            BuffFx {
                mask: FLUX,
                ..Default::default()
            },
        );
        s.remove_unit("p");
        assert!(s.buffs("p").is_none());
    }
}
