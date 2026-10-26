// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Boot menu — epic live pixel forge (Black Anvil cavern).
//! Engine motes use palette COAL / EMBER; HTML overlays use `apps/stick-web/src/boot-menu-theme.ts`.
use stick_engine::camera::{Camera, P2};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;

use crate::atmosphere::Light;
use crate::palette::*;

const VOID: u8 = crate::atmosphere::SKY;
const TAU: f32 = std::f32::consts::TAU;

/// Foreground rock origin (world x).
pub const HERO_ROCK_X: f32 = -0.85;

struct Ctx<'a> {
    fb: &'a mut Framebuffer,
    cam: &'a Camera,
    cy: f32,
    t: f32,
    lights: &'a mut Vec<Light>,
}

impl<'a> Ctx<'a> {
    fn wp(&self, x: f32, y: f32, z: f32) -> P2 {
        self.cam.project(v3(x, y - self.cy, z))
    }

    fn cap(&mut self, ax: f32, ay: f32, az: f32, bx: f32, by: f32, bz: f32, r: f32, c: u8) {
        let a = self.wp(ax, ay, az);
        let b = self.wp(bx, by, bz);
        self.fb.capsule(a, b, r, c, None);
    }

    fn disc(&mut self, x: f32, y: f32, z: f32, r: f32, c: u8) {
        let p = self.wp(x, y, z);
        self.fb.disc(p, r, c, None);
    }

    fn plot(&mut self, x: f32, y: f32, z: f32, c: u8) {
        let p = self.wp(x, y, z);
        self.fb.plot(p.x as i32, p.y as i32, p.d - 0.4, c);
    }

    fn lava_light(&mut self, x: f32, y: f32, z: f32, base_r: f32, k: f32) {
        let q = self.wp(x, y, z);
        let flick = 1.0 + 0.11 * (self.t * 9.0).sin() + 0.07 * (self.t * 5.3 + 1.2).sin();
        self.lights.push(Light {
            x: q.x,
            y: q.y,
            r: base_r * flick,
            k: k * flick,
        });
    }

    fn lava_pulse(&self, seed: f32) -> u8 {
        let w = (self.t * 3.8 + seed).sin() * 0.5 + 0.5;
        if w > 0.62 {
            EMBER
        } else if w > 0.26 {
            COAL
        } else {
            ROCK_D
        }
    }

    /// Horseshoe arch built from offset discs + horizontal lava sheets (no iso pillar stacks).
    fn forge_arch(
        &mut self,
        x: f32,
        z: f32,
        scale: f32,
        bands: u8,
        skew: f32,
        bright: f32,
    ) {
        for i in 0..10 {
            let a = skew + (i as f32 / 10.0) * std::f32::consts::PI * 1.15 + std::f32::consts::PI * 0.42;
            let rx = x + a.cos() * 2.45 * scale;
            let rz = z + a.sin() * 2.05 * scale + (i as f32 * 0.04);
            let ry = 0.35 + (1.0 - a.sin().max(0.0)) * 5.2 * scale;
            let rock = if i % 3 == 0 { ROCK_L } else { ROCK };
            self.disc(rx, ry, rz, (2.4 + hash(i as f32 + x) * 0.8) * scale, rock);
        }
        for b in 0..bands {
            let by = (0.55 + b as f32 * 0.48) * scale;
            let bz = z + 0.35 + b as f32 * 0.18;
            let pulse = self.lava_pulse(x * 0.7 + b as f32 * 2.1);
            let span_l = (2.05 - b as f32 * 0.11) * scale;
            let span_r = (1.35 - b as f32 * 0.08) * scale;
            let x_off = (hash(b as f32 * 4.7 + z) - 0.5) * 1.1 * scale;
            self.cap(
                x - span_l + x_off,
                by,
                bz,
                x + span_r + x_off,
                by + 0.16 * scale,
                bz + 0.22,
                (2.7 - b as f32 * 0.14) * scale,
                pulse,
            );
        }
        self.lava_light(x + 0.5 * scale, 2.6 * scale, z + 0.4, 210.0 * scale * bright, bright);
    }

    fn lava_cascade(&mut self, x0: f32, y0: f32, z0: f32, steps: u8, scale: f32) {
        for s in 0..steps {
            let k = s as f32;
            let pulse = self.lava_pulse(k * 3.3 + x0);
            let x = x0 + k * 0.35 * scale;
            let y = y0 - k * 0.22 * scale;
            let z = z0 - k * 0.85 * scale;
            self.cap(
                x - 1.6 * scale,
                y,
                z,
                x + 1.1 * scale,
                y + 0.14 * scale,
                z + 0.12,
                (2.2 - k * 0.08) * scale,
                pulse,
            );
            if s % 2 == 0 {
                self.lava_light(x, y + 0.1, z, 120.0 * scale, 0.55);
            }
        }
    }

    fn cavern_vault(&mut self) {
        for rib in 0..7 {
            let y = 8.8 + rib as f32 * 0.55;
            let z = 12.0 + rib as f32 * 0.45;
            let wobble = (self.t * 0.07 + rib as f32 * 0.9).sin() * 0.35;
            self.cap(
                -12.0,
                y + wobble,
                z,
                12.0,
                y + 0.35 + wobble,
                z + 0.3,
                4.2 - rib as f32 * 0.25,
                if rib % 2 == 0 { ROCK_D } else { ROCK },
            );
        }
    }

    fn stalactite_teeth(&mut self) {
        for i in 0..22 {
            let x = -11.5 + hash(i as f32 * 2.3) * 23.0;
            let y_top = 7.2 + hash(i as f32 * 4.1) * 4.2;
            let z = 3.5 + hash(i as f32 * 6.7) * 12.0;
            let len = 1.4 + hash(i as f32 * 8.1) * 2.8;
            self.cap(
                x,
                y_top,
                z,
                x + (hash(i as f32 * 1.7) - 0.5) * 0.7,
                y_top - len,
                z + 0.35,
                0.75 + hash(i as f32 * 3.3) * 0.55,
                ROCK_D,
            );
            if hash(i as f32 * 9.3) > 0.8 {
                self.plot(x, y_top - len, z + 0.25, COAL);
            }
        }
    }

    /// Glowing rune span — stone deck under the login tablet.
    fn rune_bridge(&mut self) {
        self.cap(-5.2, 0.2, 3.6, 6.2, 0.34, 4.4, 5.2, ROCK_L);
        self.cap(-4.8, 0.26, 3.9, 5.8, 0.38, 4.15, 3.8, ROCK);
        for i in 0..12 {
            let x = -4.2 + i as f32 * 0.92;
            let pulse = (self.t * 2.8 + i as f32 * 0.65).sin();
            if pulse > 0.15 {
                self.plot(
                    x,
                    0.3,
                    4.05 + (i as f32 * 0.05),
                    if pulse > 0.62 { EMBER } else { COAL },
                );
            }
        }
        for (bx, bz) in [(-4.8f32, 3.85), (5.4, 4.25)] {
            self.disc(bx, 0.48, bz, 1.35, ROCK);
            self.disc(bx, 0.62, bz + 0.06, 0.75, if (self.t * 5.0 + bx).sin() > 0.1 { COAL } else { ROCK_D });
            if (self.t * 6.0 + bz).sin() > 0.55 {
                self.plot(bx, 0.72, bz + 0.1, EMBER);
            }
        }
        self.lava_light(0.8, 0.45, 4.0, 140.0, 0.65);
    }

    /// Suspended chain path linking the distant gates (readable at menu scale).
    fn chain_walkway(&mut self) {
        let steps = 13;
        for s in 0..steps {
            let k = s as f32 / (steps - 1) as f32;
            let x = -5.2 + k * 10.8;
            let y = 2.65 + k * 0.22 + (self.t * 0.06 + k * 3.0).sin() * 0.12;
            let z = 9.2 - k * 3.4;
            self.disc(x, y, z, 1.45, ROCK);
            if s + 1 < steps {
                let k2 = (s + 1) as f32 / (steps - 1) as f32;
                let x2 = -5.2 + k2 * 10.8;
                let y2 = 2.65 + k2 * 0.22 + (self.t * 0.06 + k2 * 3.0).sin() * 0.12;
                let z2 = 9.2 - k2 * 3.4;
                self.cap(x, y, z, x2, y2, z2, 0.62, ROCK_D);
            }
            if s % 4 == 0 && (self.t * 4.0 + s as f32).sin() > 0.35 {
                self.plot(x, y - 0.18, z + 0.08, COAL);
            }
        }
    }

    /// Foreground molten lake — big readable glow pool.
    fn magma_lake(&mut self, x: f32, z: f32, scale: f32) {
        for ring in 0..10 {
            let a = ring as f32 * 0.72 + self.t * 0.04;
            let rx = x + a.cos() * 2.4 * scale;
            let rz = z + a.sin() * 1.8 * scale;
            let pulse = self.lava_pulse(ring as f32 + x);
            self.disc(
                rx,
                0.34 + ring as f32 * 0.015,
                rz,
                (3.8 - ring as f32 * 0.22) * scale,
                pulse,
            );
        }
        self.lava_light(x, 0.55, z, 280.0 * scale, 1.45);
    }

    /// Giant anvil silhouette in the back glow (Black Anvil sigil).
    fn anvil_sigil(&mut self) {
        let cx = 3.2;
        let cy = 6.8;
        let cz = 14.2;
        self.cap(cx - 4.2, cy, cz, cx + 4.2, cy + 0.35, cz + 0.15, 0.85, COAL);
        self.cap(cx - 1.05, cy - 3.2, cz + 0.08, cx + 1.05, cy - 0.05, cz + 0.12, 0.95, EMBER);
        self.cap(cx - 2.6, cy - 0.15, cz, cx + 2.6, cy + 0.25, cz + 0.1, 0.75, COAL);
        for i in 0..12 {
            let f = i as f32 / 12.0;
            let px = cx - 3.8 + f * 7.6;
            if (self.t * 2.2 + f * 6.0).sin() > 0.4 {
                self.plot(px, cy + 0.15, cz + 0.2, if f > 0.42 && f < 0.58 { EMBER } else { COAL });
            }
        }
    }

    fn smoke_plume(&mut self, x: f32, y: f32, z: f32) {
        for i in 0..14 {
            let drift = (self.t * 0.35 + i as f32 * 0.35).sin();
            let px = x + drift * 1.1;
            let py = y + i as f32 * 0.48;
            let pz = z + i as f32 * 0.14 + drift * 0.45;
            let r = (2.0 - i as f32 * 0.06).max(0.65);
            self.disc(
                px,
                py,
                pz,
                r,
                if i % 5 == 0 { COAL } else { ROCK_D },
            );
        }
    }

    /// Shared floor language — broken basalt plates (same ROCK/COAL palette).
    fn forge_floor_plates(&mut self) {
        for row in 0..6 {
            for col in 0..10 {
                if hash(col as f32 * 1.7 + row as f32 * 2.9) > 0.38 {
                    continue;
                }
                let x = -8.5 + col as f32 * 1.75;
                let z = 2.2 + row as f32 * 1.28;
                let pulse = (self.t * 1.6 + col as f32 * 0.4 + row as f32).sin();
                let cslot = if pulse > 0.55 && (row + col) % 4 == 0 {
                    COAL
                } else {
                    ROCK_D
                };
                self.cap(x, 0.12, z, x + 1.35, 0.2, z + 0.06, 0.85, cslot);
            }
        }
    }

    fn anvil_monument(&mut self, x: f32, y: f32, z: f32) {
        self.disc(x, y, z, 4.2, ROCK_D);
        self.disc(x + 0.15, y + 0.55, z + 0.2, 2.6, ROCK);
        self.cap(x - 2.8, y + 0.72, z + 0.15, x + 3.1, y + 0.78, z + 0.22, 1.35, ROCK_L);
        self.disc(x + 0.1, y + 0.95, z + 0.28, 1.05, ROCK_D);
        let glow = (self.t * 6.0).sin() * 0.5 + 0.5;
        if glow > 0.55 {
            self.plot(x, y + 1.05, z + 0.35, EMBER);
            self.plot(x + 0.6, y + 1.02, z + 0.32, COAL);
        }
    }
}

fn hash(n: f32) -> f32 {
    let s = (n * 12.9898).sin() * 43758.547;
    s - s.floor()
}

/// Full forge backdrop + platforms; menu hero draws on the foreground rock.
pub fn draw(fb: &mut Framebuffer, cam: &Camera, cam_y: f32, t: f32, lights: &mut Vec<Light>) {
    fb.color.fill(VOID);
    let mut c = Ctx {
        fb,
        cam,
        cy: cam_y,
        t,
        lights,
    };

    c.cavern_vault();
    c.stalactite_teeth();

    // Distant jagged range
    for i in 0..20 {
        let x = -12.0 + i as f32 * 1.25;
        let h = 2.8 + hash(i as f32 * 2.7) * 3.8;
        let z = 17.2 + hash(i as f32 * 1.9) * 1.2;
        c.disc(x, h * 0.52, z, 2.8 + hash(i as f32 * 1.3) * 1.4, ROCK_D);
    }

    // Left gate (scaled up to balance the epic right forge)
    c.forge_arch(-6.2, 15.2, 1.12, 8, -0.35, 0.95);
    // Dominant Black Anvil forge mouth (right)
    c.forge_arch(7.4, 11.4, 1.62, 9, 0.22, 1.38);
    c.lava_cascade(8.2, 4.8, 9.5, 14, 1.05);
    c.anvil_sigil();
    c.magma_lake(8.2, 3.4, 1.05);
    c.magma_lake(-6.8, 5.4, 0.65);

    c.anvil_monument(9.2, 0.42, 5.8);
    c.smoke_plume(9.0, 1.15, 5.9);

    c.chain_walkway();

    // Molten river across the mid chamber
    for lane in 0..6 {
        let lz = 9.8 + lane as f32 * 0.38;
        let lx = -1.5 + lane as f32 * 0.55;
        let pulse = c.lava_pulse(30.0 + lane as f32);
        c.cap(
            lx - 4.5,
            0.38,
            lz,
            lx + 5.2,
            0.52,
            lz + 0.08,
            3.6 - lane as f32 * 0.22,
            pulse,
        );
    }
    c.lava_light(2.0, 0.92, 10.4, 240.0, 1.22);
    c.lava_light(7.2, 1.8, 11.0, 200.0, 1.05);

    c.forge_floor_plates();

    // Foreground canyon walls
    c.cap(-12.5, 0.0, 2.8, -3.5, 4.8, 1.2, 7.5, ROCK_D);
    c.cap(12.5, 0.0, 2.5, 4.0, 4.2, 1.0, 7.0, ROCK_D);
    c.disc(-9.5, 2.2, 3.5, 5.5, ROCK);
    c.disc(10.5, 1.9, 3.2, 5.2, ROCK);

    c.rune_bridge();

    // Hero mesa (left third)
    let hx = HERO_ROCK_X;
    let rz = 1.05;
    c.cap(hx - 2.6, 0.28, rz - 0.2, hx + 2.8, 0.58, rz, 6.5, ROCK);
    c.cap(hx - 2.0, 0.48, rz + 0.15, hx + 2.2, 0.82, rz + 0.45, 5.2, ROCK_L);
    c.disc(hx + 0.1, 0.52, rz + 0.65, 4.2, ROCK);
    c.cap(hx - 0.8, 0.78, rz + 0.55, hx + 1.4, 1.05, rz + 0.75, 2.8, ROCK_D);

    for i in 0..16 {
        let life = ((t * 0.34 + hash(i as f32 * 5.5)) % 1.0 + 1.0) % 1.0;
        if life > 0.86 {
            continue;
        }
        let ang = hash(i as f32 * 3.1) * TAU;
        let rad = 2.8 + hash(i as f32 * 2.4) * 1.6;
        let x = hx + 0.15 + ang.cos() * rad * 0.38;
        let z = rz + 0.55 + ang.sin() * rad * 0.32;
        c.plot(
            x,
            0.42 + life * 0.28,
            z,
            if life < 0.35 { EMBER } else { COAL },
        );
    }

    for (x, z, lean) in [(hx - 1.25, rz + 0.95, -0.1f32), (hx + 1.45, rz + 0.95, 0.1f32)] {
        c.cap(x, 0.58, z, x + lean, 1.08, z + 0.08, 1.9, ROCK_D);
        c.cap(x + lean * 0.5, 1.08, z + 0.05, x + lean, 1.22, z + 0.16, 2.2, ROCK);
        c.disc(
            x + lean * 0.45,
            1.18,
            z + 0.12,
            1.25,
            if (t * 4.0 + x).sin() > 0.12 { EMBER } else { COAL },
        );
    }

    // Atmospheric pixel fill
    for i in 0..100 {
        let life = ((t * 0.32 + hash(i as f32 * 2.7)) % 1.0 + 1.0) % 1.0;
        if life > 0.9 {
            continue;
        }
        let band = hash(i as f32 * 11.0);
        let x = (hash(i as f32 * 5.1) - 0.5) * 19.0
            + (t * 0.22 + i as f32 * 0.13).sin() * 0.55
            + (hash(i as f32 * 8.3 + t * 0.11) - 0.5) * 2.0;
        let y = 0.25 + life * (5.0 + band * 8.0);
        let z = 1.0 + hash(i as f32 * 9.3) * 15.5;
        let cslot = if life < 0.22 {
            EMBER
        } else if life < 0.52 {
            COAL
        } else {
            ROCK_D
        };
        c.plot(x, y, z, cslot);
    }

    for i in 0..36 {
        let phase = ((t * 0.14 + hash(i as f32 * 8.7)) % 1.0 + 1.0) % 1.0;
        if phase > 0.88 {
            continue;
        }
        let x = (hash(i as f32 * 5.9) - 0.5) * 13.0
            + (t * 0.09 + i as f32 * 0.23).sin() * 0.65;
        let y = 1.6 + hash(i as f32 * 4.1) * 4.2 + phase * 0.32;
        let z = 6.5 + hash(i as f32 * 6.3) * 7.0;
        c.plot(x, y, z, if phase < 0.4 { ROCK_D } else { COAL });
    }

    for i in 0..24 {
        let phase = ((t * 0.11 + hash(i as f32 * 9.7)) % 1.0 + 1.0) % 1.0;
        if phase > 0.84 {
            continue;
        }
        let x = (hash(i as f32 * 3.9) - 0.5) * 21.0 + (t * 0.08 + i as f32 * 0.27).sin() * 0.55;
        let y = 9.0 + hash(i as f32 * 2.2) * 4.0 + phase * 0.25;
        let z = 3.5 + hash(i as f32 * 8.1) * 12.0;
        c.plot(x, y, z, if phase < 0.2 { COAL } else { ROCK_D });
    }

    for i in 0..28 {
        let side = if i % 2 == 0 { -1.0 } else { 1.0 };
        let life = ((t * 0.26 + hash(i as f32 * 4.3)) % 1.0 + 1.0) % 1.0;
        if life > 0.84 {
            continue;
        }
        let x = side * (8.2 + hash(i as f32 * 2.1) * 4.2)
            + (t * 0.14 + i as f32 * 0.21).sin() * 0.42;
        let y = 0.12 + life * 3.6;
        let z = 2.0 + hash(i as f32 * 6.7) * 5.5;
        c.plot(x, y, z, if life < 0.38 { COAL } else { ROCK_D });
    }
}

pub fn hero_platform_vfx_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    v3(
        HERO_ROCK_X + (hash(s * 0.21 + t * 0.02) - 0.5) * 2.6,
        0.42 + hash(s * 0.37) * 0.55,
        1.05 + hash(s * 0.51) * 1.35,
    )
}

pub fn ambient_vfx_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    v3(
        (hash(s * 0.17 + t * 0.05) - 0.5) * 17.0,
        0.4 + hash(s * 0.31) * 7.5,
        1.5 + hash(s * 0.53 + 1.0) * 13.0,
    )
}

pub fn mid_chamber_vfx_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    v3(
        (hash(s * 0.11 + t * 0.03) - 0.5) * 14.0,
        0.55 + hash(s * 0.33) * 3.2,
        7.0 + hash(s * 0.49) * 7.5,
    )
}

pub fn haze_vfx_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    v3(
        (hash(s * 0.13 + t * 0.04) - 0.5) * 20.0,
        1.6 + hash(s * 0.29) * 7.0,
        2.5 + hash(s * 0.47) * 12.5,
    )
}

pub fn edge_vfx_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    let side = if hash(s * 0.19) > 0.5 { 1.0 } else { -1.0 };
    let mag = 7.2 + hash(s * 0.41) * 4.8;
    v3(
        side * mag + (t * 0.16 + s * 0.05).sin() * 0.4,
        0.06 + hash(s * 0.27) * 0.65,
        1.8 + hash(s * 0.61) * 5.8,
    )
}

pub fn distant_twinkle_origin(seed: i32, t: f32) -> Vec3 {
    let s = seed as f32;
    v3(
        -9.5 + hash(s * 0.23 + t * 0.02) * 19.0,
        2.5 + hash(s * 0.37) * 4.8,
        13.5 + hash(s * 0.51) * 4.5,
    )
}

pub fn particle_sources() -> [Vec3; 6] {
    let hx = HERO_ROCK_X;
    [
        v3(-6.2, 1.4, 15.2),
        v3(7.4, 2.0, 11.4),
        v3(1.8, 0.85, 10.2),
        v3(hx - 0.6, 0.52, 2.75),
        v3(hx + 0.9, 0.52, 2.75),
        v3(hx + 0.15, 0.48, 2.55),
    ]
}

pub fn menu_hero() -> (f32, f32, f32, f32) {
    (HERO_ROCK_X + 0.05, 0.62, 1.42, 0.52)
}
