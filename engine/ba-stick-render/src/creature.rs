// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Non-biped mobs: quadrupeds (hare hop / boar trot), serpent, blob.
//! Driven by the unit's ground position, yaw, a gait phase that advances
//! with distance travelled, and a death collapse factor.
use crate::compat::*;
use stick_engine::camera::{Camera, HEIGHT_PX, P2};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;

use crate::palette::{
    BLOOM_C, CR_DOG, CR_DOG_FAR, CR_DOG_FILL, CR_DOG_SPOT, CR_NOSE, CR_TEETH, CR_TUSK, GRASS,
    GRASS_D, GRASS_L, ROCK, ROCK_D, ROCK_L, WATER,
};
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
    /// Gather nodes: harvestable now (glow + sparkles).
    pub ready: bool,
    /// Melee progress 0..1 (1 = done / not attacking).
    pub attack: f32,
}

/// Duration of a creature melee lunge.
pub const LUNGE_S: f32 = 0.55;

/// Approximate on-screen height in px (for picking and bar placement).
pub fn height_px(body: &Body) -> f32 {
    match *body {
        Body::Biped => 0.0,
        Body::Quadruped {
            size, hop: true, ..
        } => 0.62 * size * HEIGHT_PX + 6.0,
        Body::Quadruped { size, .. } => (0.75 * size) * HEIGHT_PX + 8.0,
        Body::Serpent { size, .. } => 0.35 * size * HEIGHT_PX + 6.0,
        Body::Blob { size, .. } => 0.7 * size * HEIGHT_PX + 4.0,
        Body::Canine { size } => 1.08 * size * HEIGHT_PX + 4.0,
        Body::Node { .. } => 16.0,
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
        Body::Quadruped {
            size: s,
            hop: true,
            body: c,
            far,
            ..
        } => hare(fb, cam, s, c, far, ps),
        Body::Quadruped {
            size: s,
            hop,
            tusks,
            body: c,
            far,
        } => {
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
                let sw = if hop {
                    -0.12 * legs_fold * if i % 2 == 0 { 1.0 } else { -1.0 }
                } else {
                    (ps.phase + off).sin() * 0.16 * s * ps.moving
                };
                let fl = if hop {
                    0.0
                } else {
                    (ps.phase + off).cos().max(0.0) * 0.07 * s * ps.moving
                };
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
            let raise = (1.0 - ps.dead)
                * (0.32 + (ps.time * 1.7).sin() * 0.04)
                * s
                * (1.0 - ps.moving * 0.4);
            let mut prev: Option<(Vec3, f32)> = None;
            for i in 0..n {
                let k = i as f32 / (n - 1) as f32;
                let wave =
                    (ps.phase * 1.5 - k * 5.0).sin() * 0.14 * s * (0.3 + 0.7 * ps.moving.max(0.25));
                let along = 0.35 * s - k * 1.0 * s;
                let y = if i == 0 {
                    raise
                } else if i == 1 {
                    raise * 0.55
                } else if i == 2 {
                    raise * 0.15
                } else {
                    0.04 * s
                };
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
        Body::Node { method } => node(fb, cam, method, ps),
        Body::Canine { size: s } => canine(fb, cam, s, ps),
        Body::Blob {
            size: s,
            body: c,
            far,
        } => {
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
    let lift = if (0.2..0.8).contains(&c) {
        ((c - 0.2) / 0.6 * std::f32::consts::PI).sin()
    } else {
        0.0
    } * moving;
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
            (
                knee + (hip - knee) * k,
                hock + (hip - hock) * k,
                toe + (hip - toe) * k,
            )
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
    let spine = [
        (-0.26, 0.19, 0.115),
        (-0.14, 0.25 + breathe, 0.12),
        (0.0, 0.24 + breathe, 0.10),
        (0.12, 0.18, 0.085),
    ];
    for w in spine.windows(2) {
        let (a, b) = (w[0], w[1]);
        fb.capsule(
            p(bp(a.0, a.1, 0.0)),
            p(bp(b.0, b.1, 0.0)),
            px((a.2 + b.2) * 0.5),
            c,
            o,
        );
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
        let tip = eb + up * ((0.36 - sweep * 0.4) * s * flat)
            - f * ((sweep + 0.05 - 0.05 * side) * s)
            + r * (0.12 * side * s);
        let mid = eb + (tip - eb) * 0.5;
        fb.capsule(p(eb), p(mid), 2.0, col, o);
        fb.capsule(p(mid), p(tip), 1.6, col, o);
    }
    let eye = p(bp(0.25, 0.29, 0.06));
    fb.plot(eye.x as i32, eye.y as i32, eye.d - 0.5, C_OUTLINE);
}

/// Lunge curve for a melee progress `a` (0..1): (forward offset, crouch, jaw open).
/// Short wind-back crouch, then a snapping lunge forward and recovery.
pub fn lunge(a: f32) -> (f32, f32, f32) {
    use std::f32::consts::PI;
    if a >= 1.0 {
        return (0.0, 0.0, 0.0);
    }
    if a < 0.3 {
        let k = (a / 0.3 * PI * 0.5).sin();
        (-0.07 * k, k, 0.2 * k)
    } else {
        let k = ((a - 0.3) / 0.7 * PI).sin();
        (0.26 * k, (1.0 - (a - 0.3) / 0.2).max(0.0), k)
    }
}

/// Stick dog after the reference sketch: thick orange-brown strokes, boxy
/// torso with a golden fill and dark spot, tall pointed ear, long snout with
/// black nose and bared teeth, upturned tufted tail, long thin bent legs.
/// Trots on diagonal leg pairs; melee is a crouch-and-lunge with a snap.
fn canine(fb: &mut Framebuffer, cam: &Camera, s: f32, ps: &Pose) {
    use std::f32::consts::PI;
    let f = v3(ps.yaw.sin(), 0.0, ps.yaw.cos());
    let r = v3(ps.yaw.cos(), 0.0, -ps.yaw.sin());
    let up = v3(0.0, 1.0, 0.0);
    let o = Some(C_OUTLINE);
    let p = |v: Vec3| cam.project(v);
    let (lf, crouch, jaw) = lunge(ps.attack);
    let flat = 1.0 - ps.dead * 0.7;
    let trot = ps.moving;
    let bob = (ps.phase * 2.0).sin().abs() * 0.025 * trot;
    let base = ps.pos + f * (lf * s) + up * (bob * s);
    // body-space point: forward a, up b, side; crouch lowers the front, lunge lifts the head
    let bp = |a: f32, b: f32, side: f32| {
        let drop = crouch * 0.06 * (a + 0.4).max(0.0);
        base + f * (a * s) + up * ((b - drop) * s * flat) + r * (side * s)
    };
    let gp = |a: f32, b: f32, side: f32| {
        ps.pos + f * ((a + lf * 0.35) * s) + up * (b * s) + r * (side * s)
    };
    let stroke = (2.0 * s).max(1.6);
    let leg_w = (1.4 * s).max(1.2);

    // legs: (hip/shoulder a, b, side, phase offset, front?)
    let leg = |fb: &mut Framebuffer, a: f32, side: f32, off: f32, front: bool, col: u8| {
        let ph = ps.phase + off;
        let sw = ph.sin() * 0.14 * trot
            + if ps.attack < 1.0 && front {
                lf * 0.6
            } else {
                0.0
            };
        let lift = ph.cos().max(0.0) * 0.07 * trot;
        let top = if front {
            bp(a, 0.36, side)
        } else {
            bp(a, 0.42, side)
        };
        let paw = gp(a + sw, lift, side);
        // knee: front legs bend backward a little, hind legs forward-then-hock
        let (knee, hock) = if front {
            (gp(a + sw * 0.5 + 0.04, 0.2 + lift * 0.6, side), None)
        } else {
            (
                gp(a + sw * 0.4 + 0.07, 0.26 + lift * 0.5, side),
                Some(gp(a + sw * 0.8 - 0.06, 0.11 + lift, side)),
            )
        };
        let fold = |v: Vec3| v + (top - v) * (ps.dead * 0.55);
        let (knee, paw) = (fold(knee), fold(paw));
        fb.capsule(p(top), p(knee), leg_w, col, o);
        match hock {
            Some(h) => {
                let h = fold(h);
                fb.capsule(p(knee), p(h), leg_w, col, o);
                fb.capsule(p(h), p(paw), leg_w * 0.9, col, o);
            }
            None => fb.capsule(p(knee), p(paw), leg_w, col, o),
        }
    };
    let w = 0.07;
    // far side first (diagonal pairs: near-front with far-hind)
    leg(fb, -0.34, -w, 0.0, false, CR_DOG_FAR);
    leg(fb, 0.18, -w, PI, true, CR_DOG_FAR);

    // tail: upturned, wagging, small tuft
    let wag = (ps.time * 6.0).sin() * 0.05 + (ps.phase).sin() * 0.03 * trot;
    let t0 = bp(-0.42, 0.5, 0.0);
    let t1 = bp(-0.52, 0.58, wag * 0.5);
    let t2 = bp(-0.6, 0.66, wag);
    fb.capsule(p(t0), p(t1), stroke * 0.8, CR_DOG, o);
    fb.capsule(p(t1), p(t2), stroke * 0.7, CR_DOG, o);
    fb.disc(
        p(t2 + up * (0.03 * s) - f * (0.02 * s)),
        stroke * 0.8,
        CR_DOG,
        o,
    );

    // boxy torso: filled polygon outlined with thick strokes
    let breathe = (ps.time * 2.4).sin() * 0.006;
    let poly = [
        bp(-0.44, 0.52, 0.0),          // rump top
        bp(0.16, 0.57 + breathe, 0.0), // withers
        bp(0.30, 0.46, 0.0),           // chest front
        bp(0.14, 0.30 - breathe, 0.0), // brisket
        bp(-0.12, 0.38, 0.0),          // belly tuck
        bp(-0.42, 0.40, 0.0),          // haunch
    ];
    let pp: Vec<_> = poly.iter().map(|&v| p(v)).collect();
    for i in 1..pp.len() - 1 {
        crate::props::tri(fb, pp[0], pp[i], pp[i + 1], CR_DOG_FILL);
    }
    fb.disc(
        p(bp(0.06, 0.44, 0.0)),
        (0.05 * s * HEIGHT_PX).max(1.5),
        CR_DOG_SPOT,
        None,
    );
    fb.disc(
        p(bp(0.12, 0.40, 0.0)),
        (0.03 * s * HEIGHT_PX).max(1.0),
        CR_DOG_SPOT,
        None,
    );
    for i in 0..poly.len() {
        fb.capsule(pp[i], pp[(i + 1) % pp.len()], stroke * 0.75, CR_DOG, o);
    }
    // near legs over the torso
    leg(fb, -0.34, w, PI, false, CR_DOG);
    leg(fb, 0.18, w, 0.0, true, CR_DOG);

    // neck + head (head pushes forward and opens the jaw on the lunge)
    let hx = 0.03 * jaw;
    let n0 = bp(0.2, 0.52, 0.0);
    let n1 = bp(0.32 + hx, 0.80 - 0.04 * jaw, 0.0);
    fb.capsule(p(n0), p(n1), stroke, CR_DOG, o);
    let hb = |a: f32, b: f32| bp(a + hx, b - 0.04 * jaw, 0.0);
    let skull = [
        hb(0.27, 0.86),
        hb(0.38, 0.93),
        hb(0.64, 0.82),
        hb(0.40, 0.76),
        hb(0.30, 0.75),
    ];
    let sp: Vec<_> = skull.iter().map(|&v| p(v)).collect();
    for i in 1..sp.len() - 1 {
        crate::props::tri(fb, sp[0], sp[i], sp[i + 1], CR_DOG_FILL);
    }
    for i in 0..sp.len() {
        if i == 3 {
            continue; // open mouth edge drawn below
        }
        fb.capsule(sp[i], sp[(i + 1) % sp.len()], stroke * 0.7, CR_DOG, o);
    }
    // lower jaw + bared teeth
    let jaw_tip = hb(0.60, 0.76 - 0.06 * jaw);
    fb.capsule(p(hb(0.40, 0.76)), p(jaw_tip), stroke * 0.7, CR_DOG, o);
    let teeth_a = p(hb(0.46, 0.79));
    let teeth_b = p(hb(0.60, 0.80));
    fb.line(teeth_a, teeth_b, CR_TEETH);
    for k in 0..4 {
        let t = k as f32 / 3.0;
        let q = p(hb(0.47 + 0.12 * t, 0.785));
        fb.plot(q.x as i32, q.y as i32 + 1, q.d - 1.0, CR_TEETH);
    }
    // black nose
    let mut nose = p(hb(0.65, 0.825));
    nose.d -= 0.05;
    fb.disc(nose, (0.035 * s * HEIGHT_PX).max(1.8), CR_NOSE, None);
    // tall pointed ear (filled triangle with stroke)
    let e0 = hb(0.28, 0.87);
    let e1 = hb(0.36, 0.92);
    let et = hb(0.31, 1.08) - f * (0.04 * jaw * s);
    crate::props::tri(fb, p(e0), p(e1), p(et), CR_DOG_FILL);
    fb.capsule(p(e0), p(et), stroke * 0.6, CR_DOG, o);
    fb.capsule(p(e1), p(et), stroke * 0.6, CR_DOG, o);
    let eye = p(hb(0.42, 0.86) + r * (0.02 * s));
    fb.plot(eye.x as i32, eye.y as i32, eye.d - 1.0, C_OUTLINE);
}

/// Gather node marker: ground glow + a small prop per method + twinkles.
fn node(fb: &mut Framebuffer, cam: &Camera, method: u8, ps: &Pose) {
    let c = cam.project(ps.pos);
    let ph = ps.time * 1.6 + ps.pos.x * 0.27 + ps.pos.z * 0.19;
    if ps.ready {
        // soft pulsing glow ellipse (dithered so terrain shows through)
        let s = 0.95 + 0.08 * (0.5 + 0.5 * ph.sin());
        let (rx, ry) = (13.0 * s, 5.5 * s);
        for y in (c.y - ry) as i32..=(c.y + ry) as i32 {
            for x in (c.x - rx) as i32..=(c.x + rx) as i32 {
                let (nx, ny) = ((x as f32 - c.x) / rx, (y as f32 - c.y) / ry);
                let r2 = nx * nx + ny * ny;
                if r2 <= 1.0
                    && (x + y) % 2 == 0
                    && x >= 0
                    && y >= 0
                    && (x as usize) < fb.w
                    && (y as usize) < fb.h
                {
                    let i = y as usize * fb.w + x as usize;
                    if fb.depth[i] == f32::INFINITY {
                        fb.color[i] = if r2 < 0.35 { C_GOLD } else { C_DUST };
                    }
                }
            }
        }
    }
    let o = Some(C_OUTLINE);
    let at = |dx: f32, dy: f32| P2 {
        s: 1.0,
        x: c.x + dx,
        y: c.y + dy,
        d: c.d - 0.05,
    };
    match method {
        1 => {
            // herb tuft: a few leaves and a bloom
            for (k, (dx, h)) in [(-4.0f32, 7.0f32), (-1.0, 10.0), (2.0, 8.0), (4.5, 6.0)]
                .iter()
                .enumerate()
            {
                let sway = (ps.time * 2.0 + k as f32).sin() * 1.0;
                let col = [GRASS_D, GRASS, GRASS_L, GRASS][k];
                fb.capsule(at(*dx, 0.0), at(dx + sway, -h), 1.2, col, o);
            }
            fb.disc(at(-0.5, -10.5), 1.8, BLOOM_C, o);
        }
        2 => {
            // fishing spot: concentric ripples
            for k in 0..3 {
                let t = ((ps.time * 0.6 + k as f32 / 3.0) % 1.0) as f32;
                let (rx, ry) = (3.0 + t * 10.0, 1.4 + t * 4.2);
                if t > 0.85 {
                    continue;
                }
                for i in 0..36 {
                    let a = i as f32 / 36.0 * std::f32::consts::TAU;
                    let (x, y) = ((c.x + a.cos() * rx) as i32, (c.y + a.sin() * ry) as i32);
                    if x >= 0 && y >= 0 && (x as usize) < fb.w && (y as usize) < fb.h && i % 4 != 0
                    {
                        let ix = y as usize * fb.w + x as usize;
                        if fb.depth[ix] == f32::INFINITY {
                            fb.color[ix] = WATER + 3;
                        }
                    }
                }
            }
        }
        _ => {
            // ore rock with glints
            fb.disc(at(-3.0, -3.0), 4.5, ROCK_D, o);
            fb.disc(at(2.0, -4.0), 5.5, ROCK, o);
            fb.disc(at(0.5, -6.5), 3.0, ROCK_L, None);
            for (k, (dx, dy)) in [(-3.0f32, -4.0f32), (2.5, -6.0), (4.0, -3.0)]
                .iter()
                .enumerate()
            {
                if (ps.time * 3.0 + k as f32 * 2.1).sin() > 0.2 {
                    fb.plot((c.x + dx) as i32, (c.y + dy) as i32, c.d - 0.1, C_GOLD);
                }
            }
        }
    }
    if ps.ready {
        // two twinkling sparks above the node
        for (k, (ox, oy, sp)) in [(-5.0f32, -14.0f32, 2.6f32), (6.0, -19.0, 3.2)]
            .iter()
            .enumerate()
        {
            let tw = 0.5 + 0.5 * (ps.time * sp + k as f32 * 1.7 + ps.pos.x).sin();
            if tw.powi(3) > 0.45 {
                let (x, y) = ((c.x + ox) as i32, (c.y + oy) as i32);
                for (dx, dy) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)] {
                    fb.plot(
                        x + dx,
                        y + dy,
                        0.0,
                        if dx == 0 && dy == 0 { C_TRAIL } else { C_GOLD },
                    );
                }
            }
        }
    }
}
