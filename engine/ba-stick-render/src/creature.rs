//! Non-biped mobs: quadrupeds (hare hop / boar trot), serpent, blob.
//! Driven by the unit's ground position, yaw, a gait phase that advances
//! with distance travelled, and a death collapse factor.
use stick_engine::camera::{Camera, HEIGHT_PX};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;
use crate::compat::*;

use crate::palette::CR_TUSK;
use crate::preset::Body;

pub struct Pose {
    pub pos: Vec3,
    pub yaw: f32,
    /// Gait phase in radians (advances with movement).
    pub phase: f32,
    /// 0..1 movement intensity (0 = idle).
    pub moving: f32,
    /// 0..1 death collapse.
    pub dead: f32,
    pub time: f32,
}

/// Approximate on-screen height in px (for picking and bar placement).
pub fn height_px(body: &Body) -> f32 {
    match *body {
        Body::Biped => 0.0,
        Body::Quadruped { size, hop: true, .. } => 0.62 * size * HEIGHT_PX + 6.0,
        Body::Quadruped { size, .. } => (0.75 * size) * HEIGHT_PX + 8.0,
        Body::Serpent { size, .. } => 0.35 * size * HEIGHT_PX + 6.0,
        Body::Blob { size, .. } => 0.7 * size * HEIGHT_PX + 4.0,
    }
}

pub fn draw(fb: &mut Framebuffer, cam: &Camera, body: &Body, ps: &Pose) {
    let f = v3(ps.yaw.sin(), 0.0, ps.yaw.cos());
    let r = v3(ps.yaw.cos(), 0.0, -ps.yaw.sin());
    let up = v3(0.0, 1.0, 0.0);
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    match *body {
        Body::Biped => {}
        Body::Quadruped { size: s, hop: true, body: c, far, .. } => hare(fb, cam, s, c, far, ps),
        Body::Quadruped { size: s, hop, tusks, body: c, far } => {
            let (lift, legs_fold) = if hop {
                let h = (ps.phase.sin()).abs() * 0.28 * s * ps.moving;
                (h, (ps.phase.sin()).abs() * ps.moving)
            } else {
                ((ps.phase * 2.0).sin().abs() * 0.03 * s * ps.moving, 0.0)
            };
            let flat = 1.0 - ps.dead * 0.75;
            let base = ps.pos + up * lift;
            let hip = base - f * (0.32 * s) + up * (0.42 * s * flat);
            let sh = base + f * (0.30 * s) + up * (0.46 * s * flat);
            let head = sh + f * (0.22 * s) + up * (0.12 * s * flat);
            let breathe = (ps.time * 2.2).sin() * 0.01 * s;
            let legs: [(Vec3, f32, u8); 4] = [
                (hip - r * (0.11 * s), 0.0, far),
                (sh - r * (0.11 * s), std::f32::consts::PI, far),
                (hip + r * (0.11 * s), std::f32::consts::PI, c),
                (sh + r * (0.11 * s), 0.0, c),
            ];
            let limb = (1.6 + s * 1.2).max(1.4);
            for (i, &(top, off, col)) in legs.iter().enumerate() {
                if i == 2 {
                    // body between far and near legs
                    fb.capsule(p(hip), p(sh + up * breathe), limb + 2.2 * s + 0.8, c, o);
                }
                let sw = if hop { -0.12 * legs_fold * if i % 2 == 0 { 1.0 } else { -1.0 } } else { (ps.phase + off).sin() * 0.16 * s * ps.moving };
                let fl = if hop { 0.0 } else { (ps.phase + off).cos().max(0.0) * 0.07 * s * ps.moving };
                let foot = v3(top.x, ps.pos.y + fl + lift * 0.3, top.z) + f * sw;
                let foot = foot + (top - foot) * (ps.dead * 0.6);
                fb.capsule(p(top), p(foot), limb * 0.7, col, o);
            }
            fb.disc(p(head), (0.14 * s * HEIGHT_PX).max(2.5), c, o);
            if hop {
                // long ears
                for side in [-1.0f32, 1.0] {
                    let base = head + r * (0.04 * side * s);
                    let tip = base + up * (0.28 * s * flat) - f * (0.06 * s);
                    fb.capsule(p(base), p(tip), 1.2, c, o);
                }
            }
            if tusks {
                for side in [-1.0f32, 1.0] {
                    let a = head + f * (0.1 * s) + r * (0.05 * side * s);
                    let b = a + f * (0.1 * s) + up * (0.08 * s);
                    fb.capsule(p(a), p(b), 1.0, CR_TUSK, None);
                }
            }
            let eye = head + f * (0.08 * s) + up * (0.03 * s);
            fb.plot(p(eye).x as i32, p(eye).y as i32, p(eye).d - 0.5, C_OUTLINE);
        }
        Body::Serpent { size: s, body: c } => {
            let n = 9;
            let raise = (1.0 - ps.dead) * (0.32 + (ps.time * 1.7).sin() * 0.04) * s * (1.0 - ps.moving * 0.4);
            let mut prev: Option<(Vec3, f32)> = None;
            for i in 0..n {
                let k = i as f32 / (n - 1) as f32;
                let wave = (ps.phase * 1.5 - k * 5.0).sin() * 0.14 * s * (0.3 + 0.7 * ps.moving.max(0.25));
                let along = 0.35 * s - k * 1.0 * s;
                let y = if i == 0 { raise } else if i == 1 { raise * 0.55 } else if i == 2 { raise * 0.15 } else { 0.04 * s };
                let pt = ps.pos + f * along + r * (wave * k) + up * y;
                let rad = (2.2 * s) * (1.0 - k * 0.7) + 1.0;
                if let Some((q, qr)) = prev {
                    fb.capsule(p(q), p(pt), (rad + qr) * 0.5, c, o);
                }
                prev = Some((pt, rad));
            }
            let head = ps.pos + f * (0.38 * s) + up * raise;
            fb.disc(p(head), 2.2 * s + 1.2, c, o);
            let eye = p(head + f * (0.05 * s) + up * (0.03 * s));
            fb.plot(eye.x as i32, eye.y as i32, eye.d - 1.0, C_GOLD);
            let tongue = head + f * (0.12 * s);
            if (ps.time * 3.0).sin() > 0.6 {
                fb.line(p(head), p(tongue), C_ACCENT);
            }
        }
        Body::Blob { size: s, body: c, far } => {
            let squash = 1.0 + (ps.phase * 2.0).sin() * 0.18 * ps.moving.max(0.35) - ps.dead * 0.6;
            let hgt = 0.55 * s * squash.max(0.25);
            let wid = 0.62 * s / squash.max(0.4).sqrt();
            let px = |v: Vec3| p(v);
            // Stack discs from bottom to top to build a dome.
            let steps = 5;
            for i in 0..steps {
                let k = i as f32 / (steps - 1) as f32;
                let y = hgt * k * 0.55;
                let rad = wid * (1.0 - k * k * 0.7) * HEIGHT_PX * 0.5;
                let col = if i == 0 { far } else { c };
                fb.disc(px(ps.pos + up * y), rad.max(1.5), col, o);
            }
            let eyes = ps.pos + up * (hgt * 0.5) + f * (wid * 0.6);
            for side in [-1.0f32, 1.0] {
                let e = p(eyes + r * (0.09 * s * side));
                fb.plot(e.x as i32, e.y as i32, e.d - 1.0, C_OUTLINE);
                fb.plot(e.x as i32, e.y as i32 - 1, e.d - 1.0, C_OUTLINE);
            }
        }
    }
}

/// Hop cycle for the hare: (hind-leg extension 0..1, body lift, body pitch).
/// Cycle `c` in 0..1: crouch → hind legs drive push-off → airborne arc →
/// front paws land → hind legs swing back under the haunch.
pub fn hare_hop(phase: f32, moving: f32) -> (f32, f32, f32) {
    let c = (phase / std::f32::consts::PI).rem_euclid(1.0);
    let bump = |c0: f32, w: f32| (1.0 - ((c - c0) / w).powi(2)).max(0.0);
    let ext = bump(0.28, 0.22) * moving;
    let lift = if (0.2..0.8).contains(&c) { ((c - 0.2) / 0.6 * std::f32::consts::PI).sin() } else { 0.0 } * moving;
    // nose up on push-off, nose down on landing
    let pitch = (bump(0.25, 0.2) * 0.35 - bump(0.72, 0.15) * 0.3) * moving;
    (ext, lift, pitch)
}

/// Dust Hare: arched body with a big haunch, long folded hind legs with
/// large feet that drive the hop, short front legs and big ears.
fn hare(fb: &mut Framebuffer, cam: &Camera, s: f32, c: u8, far: u8, ps: &Pose) {
    let f = v3(ps.yaw.sin(), 0.0, ps.yaw.cos());
    let r = v3(ps.yaw.cos(), 0.0, -ps.yaw.sin());
    let up = v3(0.0, 1.0, 0.0);
    let o = Some(C_OUTLINE);
    let p = |v: Vec3| cam.project(v);
    let (ext, lift, pitch) = hare_hop(ps.phase, ps.moving);
    let flat = 1.0 - ps.dead * 0.75;
    let base = ps.pos + up * (lift * 0.30 * s);
    // Body-space point (forward a, up b) pitched about the haunch.
    let (pc, pn) = (pitch.cos(), pitch.sin());
    let (ra, rb) = (-0.2f32, 0.18f32);
    let bp = |a: f32, b: f32, side: f32| {
        let (da, db) = (a - ra, b - rb);
        let (a2, b2) = (ra + da * pc - db * pn, rb + da * pn + db * pc);
        base + f * (a2 * s) + up * (b2 * s * flat) + r * (side * s)
    };
    // Ground-space point for feet (not lifted unless airborne).
    let gp = |a: f32, b: f32, side: f32| base + f * (a * s) + up * (b * s) + r * (side * s);
    let px = |r_: f32| (r_ * s * HEIGHT_PX).max(1.5);
    let lerp = |a: f32, b: f32| a + (b - a) * ext;
    let breathe = (ps.time * 3.1).sin() * 0.008;

    let hind = |fb: &mut Framebuffer, side: f32, col: u8| {
        let hip = bp(-0.2, 0.15, side);
        let knee = gp(lerp(-0.07, -0.33), lerp(0.07, 0.10), side);
        let hock = gp(lerp(-0.27, -0.45), lerp(0.02, 0.05), side);
        let toe = gp(lerp(0.0, -0.6), 0.0, side);
        let (knee, hock, toe) = if ps.dead > 0.0 {
            let k = ps.dead * 0.5;
            (knee + (hip - knee) * k, hock + (hip - hock) * k, toe + (hip - toe) * k)
        } else {
            (knee, hock, toe)
        };
        // big haunch over the thigh
        fb.disc(p(bp(-0.17, 0.14, side * 0.6)), px(0.11), col, o);
        fb.capsule(p(hip), p(knee), 2.2, col, o);
        fb.capsule(p(knee), p(hock), 1.6, col, o);
        fb.capsule(p(hock), p(toe), 1.8, col, o); // long hind foot
    };
    let front = |fb: &mut Framebuffer, side: f32, col: u8| {
        let sh = bp(0.13, 0.12, side);
        let reach = (lift * 1.2).min(1.0);
        let paw = gp(0.16 + reach * 0.12, 0.0 + reach * 0.05, side);
        let paw = paw + (sh - paw) * (ps.dead * 0.5);
        fb.capsule(p(sh), p(paw), 1.1, col, o);
    };

    hind(fb, -0.07, far);
    front(fb, -0.05, far);
    // Arched spine: rump → hump → shoulders → neck.
    let spine = [(-0.26, 0.19, 0.115), (-0.14, 0.25 + breathe, 0.12), (0.0, 0.24 + breathe, 0.10), (0.12, 0.18, 0.085)];
    for w in spine.windows(2) {
        let (a, b) = (w[0], w[1]);
        fb.capsule(p(bp(a.0, a.1, 0.0)), p(bp(b.0, b.1, 0.0)), px((a.2 + b.2) * 0.5), c, o);
    }
    // cotton tail
    fb.disc(p(bp(-0.37, 0.24, 0.0)), px(0.045), C_TRAIL, o);
    hind(fb, 0.07, c);
    front(fb, 0.05, c);
    // head + muzzle
    let head = bp(0.21, 0.27, 0.0);
    fb.disc(p(head), px(0.09), c, o);
    fb.disc(p(bp(0.29, 0.24, 0.0)), px(0.05), c, None);
    // big ears, swept back in the air
    let sweep = 0.10 + lift * 0.12;
    for (side, col) in [(-1.0f32, far), (1.0, c)] {
        let eb = bp(0.17 + 0.03 * side, 0.33, 0.04 * side);
        let tip = eb + up * ((0.36 - sweep * 0.4) * s * flat) - f * ((sweep + 0.05 - 0.05 * side) * s) + r * (0.12 * side * s);
        let mid = eb + (tip - eb) * 0.5;
        fb.capsule(p(eb), p(mid), 2.0, col, o);
        fb.capsule(p(mid), p(tip), 1.6, col, o);
    }
    let eye = p(bp(0.25, 0.29, 0.06));
    fb.plot(eye.x as i32, eye.y as i32, eye.d - 0.5, C_OUTLINE);
}
