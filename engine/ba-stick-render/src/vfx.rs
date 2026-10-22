//! Pixel particle VFX (#13): projectile / line / burst / ring primitives.
//! Particles are true-colour and blended additively over the palette image
//! after lighting, so they glow and don't consume palette slots.
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

#[derive(Clone, Copy)]
struct Particle {
    pos: Vec3,
    vel: Vec3,
    age: f32,
    life: f32,
    rgb: [u8; 3],
    grav: f32,
    big: bool,
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
    pub fn spawn(&mut self, prim: Prim, from: Vec3, to: Vec3, color: u32, count: u32, radius: f32, rise: bool) {
        let rgb = rgb_of(color);
        let n = count.clamp(1, 400);
        match prim {
            Prim::Projectile => {
                let d = ((to.x - from.x).powi(2) + (to.z - from.z).powi(2)).sqrt();
                self.bolts.push(Bolt { from, to, t: 0.0, dur: (d / 14.0).clamp(0.12, 0.6), rgb, count: n, acc: 0.0 });
            }
            Prim::Line => {
                for i in 0..n {
                    let k = i as f32 / n as f32;
                    let j = v3(self.sym(), self.sym(), self.sym()) * 0.05;
                    let life = 0.25 + self.rnd() * 0.2;
                    let vel = v3(self.sym(), self.sym() + 0.4, self.sym()) * 0.4;
                    self.push(Particle { pos: from + (to - from) * k + j, vel, age: 0.0, life, rgb, grav: 0.0, big: i % 2 == 0 });
                }
                self.burst(to, rgb, n / 3 + 4, 0.3, false);
            }
            Prim::Burst => self.burst(to, rgb, n, radius.max(0.2), rise),
            Prim::Ring => {
                let r = radius.max(0.4);
                for i in 0..n {
                    let a = i as f32 / n as f32 * std::f32::consts::TAU + self.sym() * 0.05;
                    let dir = v3(a.cos(), 0.0, a.sin());
                    let up = if rise { 0.9 + self.rnd() * 0.6 } else { 0.25 + self.rnd() * 0.3 };
                    let life = 0.6 + self.rnd() * 0.35;
                    self.push(Particle { pos: to + dir * (r * 0.8) + v3(0.0, 0.05, 0.0), vel: dir * (r * 0.3) + v3(0.0, up, 0.0), age: 0.0, life, rgb, grav: 0.0, big: i % 2 == 0 });
                }
            }
        }
    }

    fn burst(&mut self, at: Vec3, rgb: [u8; 3], n: u32, spread: f32, rise: bool) {
        for i in 0..n {
            let dir = v3(self.sym(), self.rnd() * 0.8 + 0.2, self.sym());
            let sp = (1.2 + self.rnd() * 1.6) * spread * 2.0;
            let life = 0.35 + self.rnd() * 0.4;
            let (vel, grav) = if rise { (v3(dir.x * 0.4, 1.0 + self.rnd(), dir.z * 0.4) * spread * 2.0, -0.5) } else { (dir * sp, 5.0) };
            let p = at + v3(self.sym(), self.rnd() * 2.0, self.sym()) * (spread * 0.3);
            self.push(Particle { pos: p, vel, age: 0.0, life, rgb, grav, big: i % 2 == 0 });
        }
    }

    pub fn tick(&mut self, dt: f32) {
        let mut arrived = Vec::new();
        let mut trail = Vec::new();
        for b in &mut self.bolts {
            b.t += dt;
            let k = (b.t / b.dur).min(1.0);
            let head = b.from + (b.to - b.from) * k + v3(0.0, (k * std::f32::consts::PI).sin() * 0.25, 0.0);
            b.acc += dt * b.count as f32 / b.dur;
            while b.acc >= 1.0 {
                b.acc -= 1.0;
                trail.push((head, b.rgb));
            }
            if k >= 1.0 {
                arrived.push((b.to, b.rgb, b.count));
            }
        }
        self.bolts.retain(|b| b.t < b.dur);
        for (p, rgb) in trail {
            let j = v3(self.sym(), self.sym(), self.sym()) * 0.04;
            let v = v3(self.sym(), self.sym(), self.sym()) * 0.3;
            let life = 0.22 + self.rnd() * 0.12;
            self.push(Particle { pos: p + j, vel: v, age: 0.0, life, rgb, grav: 0.0, big: true });
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
        for p in &self.parts {
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
            self.sparks.push(Spark { x, y, rgb: p.rgb, a, big: p.big });
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
        }
    }
}
