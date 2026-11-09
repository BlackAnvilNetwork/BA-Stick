// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Pixel particle VFX (#13): projectile / line / burst / ring primitives.
//! Ability motes stamp a few pixels (diamond, plus flare, short streak, or a
//! bright pixel with a darker neighbour) instead of a lone dot. A few cores
//! use the larger `big` plus. Particles stay true-colour and blend additively
//! over the palette image after lighting, so they glow and don't consume
//! palette slots.
use stick_engine::camera::Camera;
use stick_engine::math::{v3, Vec3};

pub const MAX_PARTICLES: usize = 2048;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Prim {
    Projectile = 0,
    Line = 1,
    Burst = 2,
    Ring = 3,
}

impl Prim {
    pub fn from_u8(n: u8) -> Prim {
        match n {
            0 => Prim::Projectile,
            1 => Prim::Line,
            3 => Prim::Ring,
            _ => Prim::Burst,
        }
    }
}

/// Pixel stamp. Ambient motes stay a single dot; ability spawns pick a shape.
const GLYPH_DOT: u8 = 0;
const GLYPH_DIAMOND: u8 = 1;
const GLYPH_FLARE: u8 = 2;
const GLYPH_STREAK: u8 = 3;
const GLYPH_OUTLINE: u8 = 4;
const GLYPH_CORE: u8 = 5;

/// 5 px gem. Shade is 0..=255 of the mote colour; the last value scales alpha.
/// The centre is not `big` — that plus is `GLYPH_CORE`, so these don't double-draw.
const DIAMOND: [(i32, i32, u8, f32); 5] = [
    (-1, -1, 210, 0.72),
    (1, -1, 230, 0.78),
    (0, 0, 255, 1.0),
    (-1, 1, 160, 0.55),
    (1, 1, 130, 0.42),
];

/// 5 px plus flare, brighter at the core and dimmer on the lower arm.
const FLARE: [(i32, i32, u8, f32); 5] = [
    (0, -1, 235, 0.82),
    (-1, 0, 200, 0.7),
    (0, 0, 255, 1.0),
    (1, 0, 200, 0.7),
    (0, 1, 165, 0.52),
];

#[derive(Clone, Copy)]
struct Particle {
    pos: Vec3,
    vel: Vec3,
    age: f32,
    life: f32,
    rgb: [u8; 3],
    grav: f32,
    big: bool,
    glyph: u8,
}

/// A travelling emitter (projectile head) that leaves a trail and bursts on arrival.
struct Bolt {
    from: Vec3,
    to: Vec3,
    t: f32,
    dur: f32,
    rgb: [u8; 3],
    count: u32,
    acc: f32,
}

/// A projected particle ready to blend.
#[derive(Clone, Copy)]
pub struct Spark {
    pub x: i32,
    pub y: i32,
    pub rgb: [u8; 3],
    pub a: f32,
    pub big: bool,
}

#[derive(Default)]
pub struct Vfx {
    parts: Vec<Particle>,
    bolts: Vec<Bolt>,
    seed: u32,
    pub sparks: Vec<Spark>,
}

fn rgb_of(c: u32) -> [u8; 3] {
    [(c >> 16) as u8, (c >> 8) as u8, c as u8]
}

fn scale_rgb(rgb: [u8; 3], shade: u8) -> [u8; 3] {
    [
        (rgb[0] as u16 * shade as u16 / 255) as u8,
        (rgb[1] as u16 * shade as u16 / 255) as u8,
        (rgb[2] as u16 * shade as u16 / 255) as u8,
    ]
}

fn dir_unit(d: Vec3) -> Vec3 {
    let len = (d.x * d.x + d.y * d.y + d.z * d.z).sqrt();
    if len > 1e-3 {
        d * (1.0 / len)
    } else {
        v3(0.0, 1.0, 0.0)
    }
}

impl Vfx {
    fn rnd(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed >> 8) as f32 / (1u32 << 24) as f32
    }
    fn sym(&mut self) -> f32 {
        self.rnd() * 2.0 - 1.0
    }

    pub fn count(&self) -> usize {
        self.parts.len() + self.bolts.len()
    }

    fn push(&mut self, p: Particle) {
        if self.parts.len() < MAX_PARTICLES {
            self.parts.push(p);
        }
    }

    /// Spawn one primitive. `from` = caster chest, `to` = target point
    /// (ground-level for rings). `radius` in world units (ring/burst spread).
    pub fn spawn(
        &mut self,
        prim: Prim,
        from: Vec3,
        to: Vec3,
        color: u32,
        count: u32,
        radius: f32,
        rise: bool,
    ) {
        let rgb = rgb_of(color);
        let n = count.clamp(1, 400);
        match prim {
            Prim::Projectile => {
                let d = ((to.x - from.x).powi(2) + (to.z - from.z).powi(2)).sqrt();
                self.bolts.push(Bolt {
                    from,
                    to,
                    t: 0.0,
                    dur: (d / 14.0).clamp(0.12, 0.6),
                    rgb,
                    count: n,
                    acc: 0.0,
                });
            }
            Prim::Line => {
                let along = dir_unit(to - from);
                for i in 0..n {
                    let k = i as f32 / n as f32;
                    let j = v3(self.sym(), self.sym(), self.sym()) * 0.05;
                    let life = 0.25 + self.rnd() * 0.2;
                    let vel = along * 0.45 + v3(self.sym(), self.sym(), self.sym()) * 0.06;
                    self.push(Particle {
                        pos: from + (to - from) * k + j,
                        vel,
                        age: 0.0,
                        life,
                        rgb,
                        grav: 0.0,
                        big: false,
                        glyph: if i % 7 == 0 { GLYPH_DIAMOND } else { GLYPH_STREAK },
                    });
                }
                self.burst(to, rgb, n / 3 + 4, 0.3, false);
            }
            Prim::Burst => self.burst(to, rgb, n, radius.max(0.2), rise),
            Prim::Ring => {
                let r = radius.max(0.4);
                for i in 0..n {
                    let a = i as f32 / n as f32 * std::f32::consts::TAU + self.sym() * 0.05;
                    let dir = v3(a.cos(), 0.0, a.sin());
                    let up = if rise {
                        0.9 + self.rnd() * 0.6
                    } else {
                        0.25 + self.rnd() * 0.3
                    };
                    let life = 0.6 + self.rnd() * 0.35;
                    let glyph = if i % 8 == 0 {
                        GLYPH_CORE
                    } else if i % 8 == 4 {
                        GLYPH_DIAMOND
                    } else {
                        GLYPH_OUTLINE
                    };
                    self.push(Particle {
                        pos: to + dir * (r * 0.8) + v3(0.0, 0.05, 0.0),
                        vel: dir * (r * 0.3) + v3(0.0, up, 0.0),
                        age: 0.0,
                        life,
                        rgb,
                        grav: 0.0,
                        big: false,
                        glyph,
                    });
                }
            }
        }
    }

    /// Steam from the soup on each stir, with a few sparks from the fire below.
    pub fn cooking_ember_burst(&mut self, at: Vec3) {
        const EMBER_RGB: [u8; 3] = [0xff, 0xa0, 0x38];
        const STEAM_RGB: [u8; 3] = [0xe8, 0xf4, 0xff];
        for i in 0..10 {
            let mut dir = v3(self.sym() * 0.45, 0.85 + self.rnd() * 0.65, self.sym() * 0.45);
            if dir.len() < 1e-3 {
                dir = v3(0.0, 1.0, 0.0);
            } else {
                dir = dir * (1.0 / dir.len());
            }
            let speed = 1.4 + self.rnd() * 1.2;
            let life = 0.55 + self.rnd() * 0.55;
            let steam = i < 7;
            let rgb = if steam { STEAM_RGB } else { EMBER_RGB };
            for k in 0..4 {
                let lag = k as f32 * 0.009;
                self.push(Particle {
                    pos: at - dir * lag,
                    vel: dir * speed,
                    age: k as f32 * 0.01,
                    life,
                    rgb,
                    grav: if steam { 0.08 } else { 0.45 },
                    big: i % 2 == 0,
                    glyph: GLYPH_DOT,
                });
            }
        }
    }

    /// Small flicker at the log fire under the pot.
    pub fn cooking_fire_flicker(&mut self, at: Vec3) {
        const EMBER_RGB: [u8; 3] = [0xff, 0xb0, 0x40];
        for _ in 0..2 {
            let sx = self.sym();
            let sy = self.sym();
            let sz = self.sym();
            let spd = self.rnd();
            let life = self.rnd();
            let lift = self.rnd();
            let mut dir = v3(sx * 0.35, 0.55 + lift * 0.35, sz * 0.35);
            if dir.len() < 1e-3 {
                dir = v3(0.0, 1.0, 0.0);
            } else {
                dir = dir * (1.0 / dir.len());
            }
            self.push(Particle {
                pos: at + v3(sx * 0.06, 0.02, sy * 0.06),
                vel: dir * (0.9 + spd * 0.8),
                age: 0.0,
                life: 0.22 + life * 0.18,
                rgb: EMBER_RGB,
                grav: 0.2,
                big: false,
                glyph: GLYPH_DOT,
            });
        }
    }

    /// Hot yellow rods ejected from the anvil on each smithing strike.
    pub fn smithing_rod_burst(&mut self, at: Vec3) {
        const GOLD: [u8; 3] = [0xff, 0xe0, 0x5a];
        for _ in 0..10 {
            let mut dir = v3(self.sym() * 0.9, 0.55 + self.rnd() * 0.45, self.sym() * 0.9);
            if dir.len() < 1e-3 {
                dir = v3(0.0, 1.0, 0.0);
            } else {
                dir = dir * (1.0 / dir.len());
            }
            let speed = 2.8 + self.rnd() * 2.4;
            let life = 0.42 + self.rnd() * 0.38;
            for k in 0..5 {
                let lag = k as f32 * 0.011;
                self.push(Particle {
                    pos: at - dir * lag,
                    vel: dir * speed,
                    age: k as f32 * 0.012,
                    life,
                    rgb: GOLD,
                    grav: 1.2,
                    big: false,
                    glyph: GLYPH_DOT,
                });
            }
        }
    }

    /// Long-lived ash mote — fills upper/side air without flashy motion.
    pub fn menu_forge_haze(&mut self, at: Vec3) {
        const DIM: [u8; 3] = [0xa8, 0x60, 0x30];
        const WARM: [u8; 3] = [0xc8, 0x88, 0x44];
        const ASH: [u8; 3] = [0x90, 0x50, 0x28];
        let roll = self.rnd();
        let rgb = if roll > 0.78 {
            WARM
        } else if roll > 0.35 {
            DIM
        } else {
            ASH
        };
        let sx = self.sym();
        let sy = self.sym();
        let sz = self.sym();
        let drift = self.rnd();
        let life = self.rnd();
        self.push(Particle {
            pos: at + v3(sx * 0.9, sy * 0.55, sz * 0.85),
            vel: v3(sx * 0.08 + (drift - 0.5) * 0.04, 0.04 + drift * 0.1, sz * 0.07),
            age: 0.0,
            life: 2.8 + life * 3.2,
            rgb,
            grav: -0.04,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Vignette ember — crawls up frame rocks, stays dim.
    pub fn menu_forge_edge_ember(&mut self, at: Vec3) {
        const CORE: [u8; 3] = [0xd0, 0x68, 0x22];
        const COOL: [u8; 3] = [0xa0, 0x48, 0x18];
        let rgb = if self.rnd() > 0.45 { CORE } else { COOL };
        let sx = self.sym();
        let lift = self.rnd();
        let life = self.rnd();
        let mut dir = v3(sx * 0.35, 0.45 + lift * 0.35, self.sym() * 0.25);
        if dir.len() < 1e-3 {
            dir = v3(0.0, 1.0, 0.0);
        } else {
            dir = dir * (1.0 / dir.len());
        }
        let pos_y = self.rnd() * 0.06;
        self.push(Particle {
            pos: at + v3(sx * 0.2, pos_y, sx * 0.12),
            vel: dir * (0.28 + lift * 0.35),
            age: 0.0,
            life: 1.4 + life * 1.6,
            rgb,
            grav: -0.12,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Brief distant glint — back cavern twinkle, no streak.
    pub fn menu_forge_twinkle(&mut self, at: Vec3) {
        const GOLD: [u8; 3] = [0xff, 0xd0, 0x78];
        const PALE: [u8; 3] = [0xe8, 0xb0, 0x58];
        let rgb = if self.rnd() > 0.5 { GOLD } else { PALE };
        let sx = self.sym();
        let sy = self.sym();
        let sz = self.sym();
        let life = self.rnd();
        self.push(Particle {
            pos: at + v3(sx * 0.25, sy * 0.2, sz * 0.2),
            vel: v3(sx * 0.04, sy * 0.03, sz * 0.04),
            age: 0.0,
            life: 0.28 + life * 0.38,
            rgb,
            grav: 0.0,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Ember lifted off an en-spelled blade (tight spawn, rises along the edge).
    pub fn sword_edge_ember(&mut self, at: Vec3, blade_dir: Vec3) {
        const CORE: [u8; 3] = [0xff, 0x90, 0x28];
        const HOT: [u8; 3] = [0xff, 0xcc, 0x70];
        let rgb = if self.rnd() > 0.5 { HOT } else { CORE };
        let sx = self.sym();
        let sz = self.sym();
        let lift = self.rnd();
        let mut up = blade_dir;
        if up.y < 0.35 {
            up = v3(up.x * 0.35, up.y + 0.75, up.z * 0.35);
        }
        if up.len() > 1e-3 {
            up = up * (1.0 / up.len());
        } else {
            up = v3(0.0, 1.0, 0.0);
        }
        let side = v3(-up.z, 0.0, up.x);
        let jitter = if side.len() > 1e-3 {
            side * (1.0 / side.len()) * (sx * 0.04)
        } else {
            v3(sx * 0.04, 0.0, 0.0)
        };
        let life = 0.75 + self.rnd() * 0.85;
        let big = self.rnd() > 0.82;
        self.push(Particle {
            pos: at + jitter + v3(0.0, sz * 0.015, 0.0),
            vel: (up * (0.35 + lift * 0.45) + v3(sx * 0.06, 0.22 + lift * 0.18, sz * 0.06)) * 0.85,
            age: 0.0,
            life,
            rgb,
            grav: -0.08,
            big,
            glyph: GLYPH_DOT,
        });
    }

    /// Brief spark at the sword tip while Cinder Edge is active.
    pub fn sword_edge_spark(&mut self, at: Vec3, blade_dir: Vec3) {
        const SPARK: [u8; 3] = [0xff, 0xd8, 0x90];
        let sx = self.sym();
        let sy = self.rnd();
        let sz = self.sym();
        let life = 0.22 + sy * 0.18;
        let mut up = blade_dir;
        if up.len() > 1e-3 {
            up = up * (1.0 / up.len());
        } else {
            up = v3(0.0, 1.0, 0.0);
        }
        self.push(Particle {
            pos: at + up * 0.02,
            vel: up * (0.45 + sy * 0.35) + v3(sx * 0.12, 0.15, sz * 0.12),
            age: 0.0,
            life,
            rgb: SPARK,
            grav: -0.05,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Slow rising ember (boot menu forge pools).
    pub fn menu_forge_ember(&mut self, at: Vec3) {
        const CORE: [u8; 3] = [0xff, 0x90, 0x28];
        const HOT: [u8; 3] = [0xff, 0xcc, 0x70];
        let roll = self.rnd();
        let rgb = if roll > 0.55 { HOT } else { CORE };
        let sx = self.sym();
        let sy = self.sym();
        let sz = self.sym();
        let lift = self.rnd();
        let spd = self.rnd();
        let life = self.rnd();
        let big = self.rnd() > 0.72;
        let mut dir = v3(sx * 0.55, 0.65 + lift * 0.55, sz * 0.45);
        if dir.len() < 1e-3 {
            dir = v3(0.0, 1.0, 0.0);
        } else {
            dir = dir * (1.0 / dir.len());
        }
        self.push(Particle {
            pos: at + v3(sx * 0.35, sy * 0.08, sz * 0.25),
            vel: dir * (0.55 + spd * 0.75),
            age: 0.0,
            life: 1.1 + life * 1.4,
            rgb,
            grav: -0.22,
            big,
            glyph: GLYPH_DOT,
        });
    }

    /// Molten drip from a high arch (boot menu).
    pub fn menu_forge_drip(&mut self, at: Vec3) {
        const LAVA: [u8; 3] = [0xff, 0x68, 0x18];
        let sx = self.sym();
        let fall = self.rnd();
        let life = self.rnd();
        self.push(Particle {
            pos: at + v3(sx * 0.12, 0.0, sx * 0.08),
            vel: v3(sx * 0.08, -0.35 - fall * 0.25, sx * 0.06),
            age: 0.0,
            life: 0.55 + life * 0.45,
            rgb: LAVA,
            grav: 1.4,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Brief spark above a lava pool (single mote — menu stays calm).
    pub fn menu_forge_spark(&mut self, at: Vec3) {
        const SPARK: [u8; 3] = [0xe8, 0xc8, 0x88];
        let sx = self.sym();
        let sy = self.rnd();
        let sz = self.sym();
        let spd = self.rnd();
        let life = self.rnd();
        let mut dir = v3(sx * 0.55, 0.35 + sy * 0.5, sz * 0.55);
        if dir.len() < 1e-3 {
            dir = v3(0.0, 1.0, 0.0);
        } else {
            dir = dir * (1.0 / dir.len());
        }
        self.push(Particle {
            pos: at + v3(sx * 0.12, sy * 0.1, sz * 0.12),
            vel: dir * (0.85 + spd * 0.75),
            age: 0.0,
            life: 0.14 + life * 0.16,
            rgb: SPARK,
            grav: 0.65,
            big: false,
            glyph: GLYPH_DOT,
        });
    }

    /// Gold and white chips from the horn stake on each jeweler's tap.
    pub fn goldsmith_spark_burst(&mut self, at: Vec3) {
        const GOLD: [u8; 3] = [0xff, 0xd8, 0x48];
        const CHIP: [u8; 3] = [0xff, 0xf4, 0xdc];
        for i in 0..12 {
            let sx = self.sym();
            let sy = self.sym();
            let sz = self.sym();
            let spd = self.rnd();
            let life = self.rnd();
            let mut dir = v3(sx * 0.75, 0.35 + self.rnd() * 0.55, sz * 0.75);
            if dir.len() < 1e-3 {
                dir = v3(0.0, 1.0, 0.0);
            } else {
                dir = dir * (1.0 / dir.len());
            }
            let speed = 1.6 + spd * 1.8;
            let rgb = if i % 3 == 0 { CHIP } else { GOLD };
            self.push(Particle {
                pos: at + v3(sx * 0.02, sy * 0.02, sz * 0.02),
                vel: dir * speed,
                age: 0.0,
                life: 0.28 + life * 0.32,
                rgb,
                grav: 0.85,
                big: i % 4 == 0,
                glyph: GLYPH_DOT,
            });
        }
    }

    fn burst(&mut self, at: Vec3, rgb: [u8; 3], n: u32, spread: f32, rise: bool) {
        for i in 0..n {
            let dir = v3(self.sym(), self.rnd() * 0.8 + 0.2, self.sym());
            let sp = (1.2 + self.rnd() * 1.6) * spread * 2.0;
            let life = 0.35 + self.rnd() * 0.4;
            let (vel, grav) = if rise {
                (
                    v3(dir.x * 0.4, 1.0 + self.rnd(), dir.z * 0.4) * spread * 2.0,
                    -0.5,
                )
            } else {
                (dir * sp, 5.0)
            };
            let p = at + v3(self.sym(), self.rnd() * 2.0, self.sym()) * (spread * 0.3);
            let glyph = match i % 10 {
                0 | 1 => GLYPH_CORE,
                2 | 3 | 4 => GLYPH_DIAMOND,
                5 | 6 => GLYPH_FLARE,
                _ => GLYPH_OUTLINE,
            };
            self.push(Particle {
                pos: p,
                vel,
                age: 0.0,
                life,
                rgb,
                grav,
                big: false,
                glyph,
            });
        }
    }

    pub fn tick(&mut self, dt: f32) {
        let mut arrived = Vec::new();
        let mut trail = Vec::new();
        for b in &mut self.bolts {
            b.t += dt;
            let k = (b.t / b.dur).min(1.0);
            let head = b.from
                + (b.to - b.from) * k
                + v3(0.0, (k * std::f32::consts::PI).sin() * 0.25, 0.0);
            let dir = dir_unit(b.to - b.from);
            b.acc += dt * b.count as f32 / b.dur;
            while b.acc >= 1.0 {
                b.acc -= 1.0;
                trail.push((head, b.rgb, dir));
            }
            if k >= 1.0 {
                arrived.push((b.to, b.rgb, b.count));
            }
        }
        self.bolts.retain(|b| b.t < b.dur);
        for (p, rgb, dir) in trail {
            let j = v3(self.sym(), self.sym(), self.sym()) * 0.04;
            let life = 0.22 + self.rnd() * 0.12;
            let glitter = self.rnd() > 0.84;
            let jitter = v3(self.sym(), self.sym(), self.sym()) * 0.08;
            self.push(Particle {
                pos: p + j,
                vel: dir * 0.7 + jitter,
                age: 0.0,
                life,
                rgb,
                grav: 0.0,
                big: false,
                glyph: if glitter { GLYPH_DIAMOND } else { GLYPH_STREAK },
            });
        }
        for (to, rgb, n) in arrived {
            self.burst(to, rgb, n, 0.35, false);
        }
        for p in &mut self.parts {
            p.age += dt;
            p.vel.y -= p.grav * dt;
            p.pos = p.pos + p.vel * dt;
            p.vel = p.vel * (1.0 - 1.5 * dt).max(0.0);
        }
        self.parts.retain(|p| p.age < p.life);
    }

    /// Project + depth-test against the scene (call after units are drawn).
    pub fn project(&mut self, cam: &Camera, cam_y: f32, depth: &[f32], w: usize, h: usize) {
        self.sparks.clear();
        for i in 0..self.parts.len() {
            let p = self.parts[i];
            let q = cam.project(v3(p.pos.x, p.pos.y - cam_y, p.pos.z));
            let (x, y) = (q.x as i32, q.y as i32);
            if x < 0 || y < 0 || x >= w as i32 || y >= h as i32 {
                continue;
            }
            // allow a little slack so particles on a body aren't culled by it
            if q.d > depth[y as usize * w + x as usize] + 0.6 {
                continue;
            }
            let a = (1.0 - (p.age / p.life).powi(2)) * 1.6;
            self.stamp(cam, cam_y, &p, x, y, a);
        }
    }

    fn push_spark(&mut self, x: i32, y: i32, rgb: [u8; 3], a: f32, big: bool) {
        if a < 0.05 {
            return;
        }
        self.sparks.push(Spark { x, y, rgb, a, big });
    }

    fn paint(&mut self, x: i32, y: i32, rgb: [u8; 3], a: f32, offs: &[(i32, i32, u8, f32)]) {
        for &(dx, dy, shade, fade) in offs {
            self.push_spark(x + dx, y + dy, scale_rgb(rgb, shade), a * fade, false);
        }
    }

    /// One screen step along the mote's horizontal velocity (ring thickness).
    fn outward_step(&self, cam: &Camera, cam_y: f32, p: &Particle) -> (i32, i32) {
        let len = (p.vel.x * p.vel.x + p.vel.z * p.vel.z).sqrt();
        let (dx, dz) = if len > 1e-3 {
            (p.vel.x / len, p.vel.z / len)
        } else {
            (1.0, 0.0)
        };
        let q0 = cam.project(v3(p.pos.x, p.pos.y - cam_y, p.pos.z));
        let q1 = cam.project(v3(p.pos.x + dx * 0.15, p.pos.y - cam_y, p.pos.z + dz * 0.15));
        let sx = (q1.x - q0.x).round() as i32;
        let sy = (q1.y - q0.y).round() as i32;
        if sx == 0 && sy == 0 {
            (1, 0)
        } else {
            (sx.signum(), sy.signum())
        }
    }

    fn streak(&mut self, cam: &Camera, cam_y: f32, p: &Particle, x: i32, y: i32, a: f32) {
        let q0 = cam.project(v3(p.pos.x, p.pos.y - cam_y, p.pos.z));
        let q1 = cam.project(v3(
            p.pos.x + p.vel.x * 0.08,
            p.pos.y - cam_y + p.vel.y * 0.08,
            p.pos.z + p.vel.z * 0.08,
        ));
        let mut dx = q1.x - q0.x;
        let mut dy = q1.y - q0.y;
        let len = (dx * dx + dy * dy).sqrt();
        if len < 0.75 {
            dx = 1.0;
            dy = 0.0;
        } else {
            dx /= len;
            dy /= len;
        }
        const SHADE: [u8; 3] = [255, 188, 112];
        for i in 0..3 {
            let k = i as f32;
            let shade = SHADE[i];
            self.push_spark(
                x - (dx * k).round() as i32,
                y - (dy * k).round() as i32,
                scale_rgb(p.rgb, shade),
                a * (1.0 - k * 0.22),
                false,
            );
        }
    }

    fn stamp(&mut self, cam: &Camera, cam_y: f32, p: &Particle, x: i32, y: i32, a: f32) {
        match p.glyph {
            GLYPH_DIAMOND => self.paint(x, y, p.rgb, a, &DIAMOND),
            GLYPH_FLARE => self.paint(x, y, p.rgb, a, &FLARE),
            GLYPH_STREAK => self.streak(cam, cam_y, p, x, y, a),
            GLYPH_OUTLINE => {
                self.push_spark(x, y, p.rgb, a, false);
                let (ox, oy) = self.outward_step(cam, cam_y, p);
                self.push_spark(x + ox, y + oy, scale_rgb(p.rgb, 110), a * 0.5, false);
            }
            GLYPH_CORE => self.push_spark(x, y, p.rgb, a, true),
            _ => self.push_spark(x, y, p.rgb, a, p.big),
        }
    }
}

/// Additively blend projected sparks into an RGBA buffer.
pub fn blend(sparks: &[Spark], w: usize, h: usize, out: &mut [u8]) {
    let add = |out: &mut [u8], x: i32, y: i32, rgb: [u8; 3], a: f32| {
        if x < 0 || y < 0 || x >= w as i32 || y >= h as i32 {
            return;
        }
        let i = (y as usize * w + x as usize) * 4;
        for k in 0..3 {
            out[i + k] = (out[i + k] as f32 + rgb[k] as f32 * a.min(1.0)).min(255.0) as u8;
        }
    };
    for s in sparks {
        add(out, s.x, s.y, s.rgb, s.a);
        if s.big {
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                add(out, s.x + dx, s.y + dy, s.rgb, s.a * 0.55);
            }
            // Darker corners so a core reads as a shaded gem, not a flat cross.
            let edge = [s.rgb[0] / 2, s.rgb[1] / 2, s.rgb[2] / 2];
            for (dx, dy) in [(1, 1), (1, -1), (-1, 1), (-1, -1)] {
                add(out, s.x + dx, s.y + dy, edge, s.a * 0.32);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stick_engine::camera::Camera;
    use stick_engine::math::v3;

    fn project_at_origin(v: &mut Vfx) {
        let cam = Camera::new(160, 120);
        let depth = vec![1.0e6_f32; 160 * 120];
        v.project(&cam, 0.0, &depth, 160, 120);
    }

    #[test]
    fn stamps_are_multi_pixel_and_particle_count_stays_capped() {
        let mut one = Vfx::default();
        one.spawn(Prim::Burst, v3(0.0, 0.9, 0.0), v3(0.0, 0.9, 0.0), 0xff4d5c, 1, 0.2, false);
        one.tick(0.0);
        assert_eq!(one.count(), 1);
        project_at_origin(&mut one);
        let mut buf = vec![0u8; 160 * 120 * 4];
        blend(&one.sparks, 160, 120, &mut buf);
        let lit = buf.chunks(4).filter(|px| px[0] > 0 || px[1] > 0 || px[2] > 0).count();
        assert!((5..=9).contains(&lit), "core stamp lit {lit}");

        let mut ring = Vfx::default();
        ring.spawn(Prim::Ring, v3(0.0, 0.0, 0.0), v3(0.0, 0.0, 0.0), 0xe4eef8, 16, 1.1, false);
        let n = ring.count();
        ring.tick(0.0);
        project_at_origin(&mut ring);
        assert!(ring.sparks.len() > n, "ring outlines span more than one pixel");

        let mut flood = Vfx::default();
        for _ in 0..30 {
            flood.spawn(
                Prim::Burst,
                v3(0.0, 0.0, 0.0),
                v3(0.0, 0.0, 0.0),
                0xffffff,
                400,
                1.0,
                false,
            );
        }
        assert_eq!(flood.count(), MAX_PARTICLES);
    }
}
