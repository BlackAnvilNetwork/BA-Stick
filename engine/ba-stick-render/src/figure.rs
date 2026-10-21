// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Biped drawing: Stick Engine's rig layout with BA weapon variants and a
//! death collapse. Mirrors `stick_engine::rig::draw` (same limb order and
//! outline) so player figures look identical to the engine's.
use stick_engine::camera::{Camera, HEIGHT_PX};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;
use crate::compat::*;
use crate::compat::Fig as Joints;

use crate::preset::Weapon;
use crate::gear::{Garb, HeadStyle, WeaponLook};

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
    let garb = Garb { weapon: Some(WeaponLook::plain(weapon)), ..Garb::default() };
    draw_garbed(fb, cam, j, pr, look, &garb);
}

/// Figure with equipment applied (#14).
pub fn draw_garbed(fb: &mut Framebuffer, cam: &Camera, j: &Joints, pr: &Proportions, look: &Look, garb: &Garb) {
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    let t = pr.limb_px;
    let (torso, torso_far) = garb.torso.unwrap_or((look.body, look.far));
    let (legs, legs_far) = garb.legs.unwrap_or((look.body, look.far));
    let arm_t = t * 0.9 + garb.bulk * 0.5;
    for (i, lc, ac) in [(0usize, legs_far, torso_far), (1, legs, torso)] {
        fb.capsule(p(j.hip[i]), p(j.knee[i]), t, lc, o);
        fb.capsule(p(j.knee[i]), p(j.foot[i]), t, lc, o);
        fb.capsule(p(j.shoulder[i]), p(j.elbow[i]), arm_t, ac, o);
        fb.capsule(p(j.elbow[i]), p(j.hand[i]), t * 0.9, if garb.torso.is_some() { ac } else { look.body }, o);
    }
    fb.capsule(p(j.hip[0]), p(j.hip[1]), t, legs, o);
    fb.capsule(p(j.pelvis), p(j.chest), t + 0.6 + garb.bulk, torso, o);
    fb.capsule(p(j.shoulder[0]), p(j.shoulder[1]), t + garb.bulk * 0.5, torso, o);
    fb.capsule(p(j.chest), p(j.neck), t * 0.8, torso, o);
    fb.disc(p(j.neck), t + 0.4, look.accent, None);
    let head_px = pr.head_r * HEIGHT_PX * cam.scale_at(j.head);
    fb.disc(p(j.head), head_px, look.body, o);
    if let Some((style, c, crest)) = garb.head {
        head_gear(fb, cam, j, pr.head_r, style, c, crest);
    }
    let hand = j.hand[1];
    let dir = j.sword_dir * (1.0 / j.sword_dir.len().max(1e-3));
    let w = garb.weapon.unwrap_or(WeaponLook::plain(Weapon::None));
    let base = if pr.sword > 0.0 { pr.sword } else { 0.75 };
    let side = {
        let s = v3(dir.z, 0.0, -dir.x);
        if s.len() > 1e-3 { s * (1.0 / s.len()) } else { v3(1.0, 0.0, 0.0) }
    };
    match w.kind {
        Weapon::Sword | Weapon::Greatsword | Weapon::Dagger => {
            let (len, width, guard) = match w.kind {
                Weapon::Greatsword => (base * 1.45, 1.7, 0.16),
                Weapon::Dagger => (base * 0.5, 0.8, 0.07),
                _ => (base, 1.0, 0.11),
            };
            let tip = hand + dir * (len * w.len);
            let pommel = hand - dir * 0.1;
            let guard_c = hand + dir * 0.06;
            fb.capsule(p(pommel), p(guard_c), 1.2, w.grip, None);
            fb.disc(p(pommel), 1.1, w.gem, None);
            fb.capsule(p(guard_c - side * guard), p(guard_c + side * guard), 1.0, w.guard, None);
            fb.capsule(p(guard_c), p(tip), width, w.blade, o);
            fb.line(p(guard_c), p(tip), C_TRAIL);
        }
        Weapon::Axe => {
            let top = hand + dir * (0.8 * w.len);
            fb.capsule(p(hand - dir * 0.15), p(top), 1.1, w.grip, o);
            let a = top - dir * 0.05;
            let b = top - dir * 0.3;
            let edge = side * (0.22 * w.len);
            crate::props::tri(fb, p(a), p(b), p(a + edge + dir * 0.05), w.blade);
            crate::props::tri(fb, p(b), p(b + edge - dir * 0.05), p(a + edge + dir * 0.05), w.blade);
            fb.capsule(p(a + edge + dir * 0.05), p(b + edge - dir * 0.05), 0.8, C_TRAIL, None);
        }
        Weapon::Club => {
            let top = hand + dir * (0.6 * w.len);
            fb.capsule(p(hand - dir * 0.1), p(top), 1.2, w.grip, o);
            fb.capsule(p(top - dir * 0.15), p(top), 2.4, w.blade, o);
            fb.disc(p(top), 1.0, w.gem, None);
        }
        Weapon::Knuckles => {
            for h in j.hand {
                fb.disc(p(h), t * 0.9 + 1.4, w.blade, o);
            }
        }
        Weapon::Staff => {
            // A staff held upright-ish: shaft through the hand, tilted along the swing.
            let d = j.sword_dir * 0.35 + v3(0.0, 1.0, 0.0);
            let dir = d * (1.0 / d.len().max(1e-3));
            let reach = 0.75 * w.len;
            let foot = hand - dir * reach;
            let top = hand + dir * reach;
            fb.capsule(p(foot), p(top), 1.1, w.grip, o);
            fb.disc(p(top + dir * 0.05), 2.4, if garb.weapon.is_some() && w.gem != C_ACCENT { w.gem } else { look.accent }, o);
        }
        Weapon::None => {}
    }
    if w.kind != Weapon::Knuckles {
        fb.disc(p(hand), t * 0.9, look.body, None);
    }
}

fn head_gear(fb: &mut Framebuffer, cam: &Camera, j: &Joints, r: f32, style: HeadStyle, c: u8, crest: u8) {
    let p = |v: Vec3| cam.project(v);
    let up = (j.head - j.neck) * (1.0 / (j.head - j.neck).len().max(1e-3));
    let h = p(j.head);
    let rp = r * HEIGHT_PX * cam.scale_at(j.head);
    let front = |q: stick_engine::camera::P2| stick_engine::camera::P2 { d: q.d - 0.4, ..q };
    match style {
        HeadStyle::Helm => {
            // dome over the top half + visor slit + crest
            let top = p(j.head + up * (r * 0.35));
            fb.disc(front(top), rp * 0.95, c, Some(C_OUTLINE));
            fb.line(front(stick_engine::camera::P2 { s: 1.0, x: h.x - rp * 0.7, y: h.y, d: h.d }), front(stick_engine::camera::P2 { s: 1.0, x: h.x + rp * 0.7, y: h.y, d: h.d }), C_OUTLINE);
            let tip = p(j.head + up * (r * 1.6));
            fb.capsule(front(top), front(tip), 0.9, crest, None);
        }
        HeadStyle::Hood => {
            let tip = p(j.head + up * (r * 1.9));
            let l = stick_engine::camera::P2 { s: 1.0, x: h.x - rp * 1.05, y: h.y + rp * 0.4, d: h.d - 0.4 };
            let rr = stick_engine::camera::P2 { s: 1.0, x: h.x + rp * 1.05, y: h.y + rp * 0.4, d: h.d - 0.4 };
            crate::props::tri(fb, front(tip), l, rr, c);
            fb.line(front(tip), l, C_OUTLINE);
            fb.line(front(tip), rr, C_OUTLINE);
            fb.disc(front(h), rp * 0.55, look_skin(), None);
        }
        HeadStyle::Circlet => {
            let y = h.y - rp * 0.35;
            fb.line(front(stick_engine::camera::P2 { s: 1.0, x: h.x - rp, y, d: h.d }), front(stick_engine::camera::P2 { s: 1.0, x: h.x + rp, y, d: h.d }), c);
            fb.plot(h.x as i32, y as i32 - 1, h.d - 1.0, crest);
        }
        HeadStyle::Cap => {
            let top = p(j.head + up * (r * 0.45));
            fb.disc(front(top), rp * 0.8, c, Some(C_OUTLINE));
        }
    }
}

fn look_skin() -> u8 {
    C_BODY
}
