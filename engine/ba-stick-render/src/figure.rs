//! Biped drawing: Stick Engine's rig layout with BA weapon variants and a
//! death collapse. Mirrors `stick_engine::rig::draw` (same limb order and
//! outline) so player figures look identical to the engine's.
use stick_engine::camera::{Camera, HEIGHT_PX};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::*;
use stick_engine::rig::{Joints, Look, Proportions};

use crate::preset::Weapon;

/// Lay the figure down along its facing. `t` in 0..1 (0 = standing).
pub fn collapse(j: &mut Joints, ground: Vec3, yaw: f32, t: f32) {
    if t <= 0.0 {
        return;
    }
    let t = t.min(1.0);
    // Ease out: fast drop, soft landing.
    let k = 1.0 - (1.0 - t) * (1.0 - t);
    let back = v3(-yaw.sin(), 0.0, -yaw.cos());
    let tilt = |p: &mut Vec3| {
        let h = p.y - ground.y;
        let lying = v3(p.x, ground.y + 0.06 + h * 0.08, p.z) + back * h;
        *p = *p + (lying - *p) * k;
    };
    for p in [&mut j.pelvis, &mut j.chest, &mut j.neck, &mut j.head, &mut j.sword_tip] {
        tilt(p);
    }
    for i in 0..2 {
        for p in [&mut j.hip[i], &mut j.knee[i], &mut j.foot[i], &mut j.shoulder[i], &mut j.elbow[i], &mut j.hand[i]] {
            tilt(p);
        }
    }
}

pub fn draw(fb: &mut Framebuffer, cam: &Camera, j: &Joints, pr: &Proportions, look: &Look, weapon: Weapon) {
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    let t = pr.limb_px;
    for (i, c) in [(0usize, look.far), (1, look.body)] {
        fb.capsule(p(j.hip[i]), p(j.knee[i]), t, c, o);
        fb.capsule(p(j.knee[i]), p(j.foot[i]), t, c, o);
        fb.capsule(p(j.shoulder[i]), p(j.elbow[i]), t * 0.9, c, o);
        fb.capsule(p(j.elbow[i]), p(j.hand[i]), t * 0.9, c, o);
    }
    fb.capsule(p(j.hip[0]), p(j.hip[1]), t, look.body, o);
    fb.capsule(p(j.pelvis), p(j.chest), t + 0.6, look.body, o);
    fb.capsule(p(j.shoulder[0]), p(j.shoulder[1]), t, look.body, o);
    fb.capsule(p(j.chest), p(j.neck), t * 0.8, look.body, o);
    fb.disc(p(j.neck), t + 0.4, look.accent, None);
    fb.disc(p(j.head), pr.head_r * HEIGHT_PX, look.body, o);
    let hand = j.hand[1];
    match weapon {
        Weapon::Sword => {
            let pommel = hand - j.sword_dir * 0.1;
            let guard_c = hand + j.sword_dir * 0.06;
            let side = v3(j.sword_dir.z, 0.0, -j.sword_dir.x);
            let side = if side.len() > 1e-3 { side * (0.11 / side.len()) } else { v3(0.11, 0.0, 0.0) };
            fb.capsule(p(pommel), p(guard_c), 1.2, C_HILT, None);
            fb.capsule(p(guard_c - side), p(guard_c + side), 1.0, C_GOLD, None);
            fb.capsule(p(guard_c), p(j.sword_tip), 1.0, C_STEEL, o);
            fb.line(p(guard_c), p(j.sword_tip), C_TRAIL);
        }
        Weapon::Staff => {
            // A staff held upright-ish: shaft through the hand, tilted along the swing.
            let d = j.sword_dir * 0.35 + v3(0.0, 1.0, 0.0);
            let dir = d * (1.0 / d.len().max(1e-3));
            let foot = hand - dir * 0.75;
            let top = hand + dir * 0.75;
            fb.capsule(p(foot), p(top), 1.1, C_HILT, o);
            fb.disc(p(top + dir * 0.05), 2.4, look.accent, o);
        }
        Weapon::None => {}
    }
    fb.disc(p(hand), t * 0.9, look.body, None);
}
