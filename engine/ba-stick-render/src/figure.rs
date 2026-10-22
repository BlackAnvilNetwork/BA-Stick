// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Biped drawing: Stick Engine's rig layout with BA weapon variants and a
//! death collapse. Mirrors `stick_engine::rig::draw` (same limb order and
//! outline) so player figures look identical to the engine's.
use stick_engine::camera::{Camera, HEIGHT_PX};
use stick_engine::color::ColorSlot;
use stick_engine::gear::{local, GearDef, Shape};
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
    draw_garbed(fb, cam, j, pr, look, &garb, false);
}

/// Figure with equipment applied (#14). `fp` draws only the forearms and the
/// weapon (the eye is inside the head).
pub fn draw_garbed(fb: &mut Framebuffer, cam: &Camera, j: &Joints, pr: &Proportions, look: &Look, garb: &Garb, fp: bool) {
    let p = |v: Vec3| cam.project(v);
    let o = Some(C_OUTLINE);
    let t = pr.limb_px;
    let (torso, torso_far) = garb.torso.unwrap_or((look.body, look.far));
    let (legs, legs_far) = garb.legs.unwrap_or((look.body, look.far));
    let arm_t = t * 0.9 + garb.bulk * 0.5;
    if fp {
        for i in 0..2 {
            fb.capsule(p(j.elbow[i]), p(j.hand[i]), t * 0.9, look.body, o);
        }
    } else {
    for (i, lc, ac) in [(0usize, legs_far, torso_far), (1, legs, torso)] {
        fb.capsule(p(j.hip[i]), p(j.knee[i]), t, lc, o);
        fb.capsule(p(j.knee[i]), p(j.foot[i]), t, lc, o);
        fb.capsule(p(j.shoulder[i]), p(j.elbow[i]), arm_t, ac, o);
        fb.capsule(p(j.elbow[i]), p(j.hand[i]), t * 0.9, if garb.torso.is_some() { ac } else { look.body }, o);
    }
    fb.capsule(p(j.hip[0]), p(j.hip[1]), t, legs, o);
    fb.capsule(p(j.pelvis), p(j.chest), t + 0.6 + garb.bulk, torso, o);
    let yoke = if garb.robe {
        crate::palette::WATER
    } else if garb.vest {
        crate::palette::GEAR_LEATHER
    } else if garb.harness {
        crate::palette::CR_HARE
    } else {
        torso
    };
    fb.capsule(p(j.shoulder[0]), p(j.shoulder[1]), t + garb.bulk * 0.5, yoke, o);
    fb.capsule(p(j.chest), p(j.neck), t * 0.8, yoke, o);
    fb.disc(p(j.neck), t + 0.4, if garb.robe || garb.vest || garb.harness { yoke } else { look.accent }, None);
    if garb.plate {
        draw_iron_cuirass(fb, cam, j);
    }
    if garb.robe {
        draw_wizard_robe(fb, cam, j);
    }
    if garb.vest {
        draw_leather_vest(fb, cam, j);
    }
    if garb.harness {
        draw_bone_harness(fb, cam, j);
    }
    let head_px = pr.head_r * HEIGHT_PX * cam.scale_at(j.head);
    fb.disc(p(j.head), head_px, look.body, o);
    if garb.helm {
        draw_iron_helm(fb, cam, j);
    } else if let Some((style, c, crest)) = garb.head {
        head_gear(fb, cam, j, pr.head_r, style, c, crest);
    }
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

fn iron_cuirass() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_iron_cuirass.ron")).expect("ba_iron_cuirass")
    })
}

/// Front-face palette grid. `0` cells leave the steel underneath.
struct Plate {
    x0: f32,
    y0: f32,
    x1: f32,
    y1: f32,
    z: f32,
    /// Upper-arm guard, as fractions of the shoulder-to-elbow bone.
    arm_from: f32,
    arm_to: f32,
    arm_thick: f32,
    cuff_from: f32,
    cuff_to: f32,
    cuff_thick: f32,
    /// Viewer uses this to tell a robe plate from a cuirass plate. The sheet
    /// follows the bones, so the game draw does not read it.
    #[allow(dead_code)]
    flow: f32,
    /// Kept on the plate file. The sleeves are the skeleton.
    #[allow(dead_code)]
    sleeve_drop: f32,
    /// Skeleton v where a short mesh ends. 0 is a flat stamp, not a wrap.
    wrap: f32,
    w: usize,
    h: usize,
    cells: Vec<u8>,
}

#[cfg(test)]
fn wizard_robe() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_wizard_robe.ron")).expect("ba_wizard_robe")
    })
}

fn wizard_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_wizard_robe.plate.ron")))
}

fn iron_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_iron_cuirass.plate.ron")))
}

fn parse_plate(src: &str) -> Plate {
    fn num_or(src: &str, key: &str, fallback: f32) -> f32 {
        let pat = format!("{key}:");
        let Some(i) = src.find(&pat) else { return fallback };
        let rest = src[i + pat.len()..].trim_start();
        let end = rest.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-')).unwrap_or(rest.len());
        rest[..end].parse().unwrap_or(fallback)
    }
    fn num(src: &str, key: &str) -> f32 {
        let n = num_or(src, key, f32::NAN);
        assert!(n.is_finite(), "plate missing {key}");
        n
    }
    let mut rows: Vec<&str> = Vec::new();
    let mut i = 0;
    let b = src.as_bytes();
    while i < b.len() {
        if b[i] == b'"' {
            i += 1;
            let start = i;
            while i < b.len() && b[i] != b'"' {
                i += 1;
            }
            let row = &src[start..i];
            if !row.is_empty() && row.bytes().all(|c| matches!(c, b'.' | b'g' | b'r' | b'c' | b'k' | b'b' | b'm' | b'l' | b'd' | b'h' | b's' | b'e' | b'i')) {
                rows.push(row);
            }
        }
        i += 1;
    }
    assert!(!rows.is_empty(), "plate has no rows");
    let w = rows[0].len();
    assert!(rows.iter().all(|r| r.len() == w), "plate rows differ in width");
    let mut cells = Vec::with_capacity(w * rows.len());
    for r in &rows {
        for c in r.chars() {
            cells.push(match c {
                'g' => C_GOLD,
                'r' => C_ACCENT,
                'k' => C_SHADOW,
                'c' => 27,
                'b' => crate::palette::WATER,
                'm' => crate::palette::WATER + 1,
                'l' => crate::palette::GEAR_LEATHER,
                'd' => crate::palette::GEAR_LEATHER_FAR,
                'h' => crate::palette::CR_HARE,
                's' => crate::palette::CR_HARE_FAR,
                'e' => C_STEEL,
                'i' => 13,
                _ => 0,
            });
        }
    }
    Plate {
        x0: num(src, "x0"), y0: num(src, "y0"), x1: num(src, "x1"), y1: num(src, "y1"), z: num(src, "z"),
        arm_from: num(src, "arm_from"), arm_to: num(src, "arm_to"), arm_thick: num(src, "arm_thick"),
        cuff_from: num(src, "cuff_from"), cuff_to: num(src, "cuff_to"), cuff_thick: num(src, "cuff_thick"),
        flow: num_or(src, "flow", 0.0), sleeve_drop: num_or(src, "sleeve_drop", 0.0),
        wrap: num_or(src, "wrap", 0.0),
        w, h: rows.len(), cells,
    }
}

fn plate_color(slot: ColorSlot) -> u8 {
    match slot {
        ColorSlot::Trim => C_GOLD,
        ColorSlot::Accent => C_ACCENT,
        _ => C_STEEL,
    }
}

/// Joint-local chest plate. Shapes are filled with no per-piece outline;
/// one 1 px border is stamped around the combined silhouette afterwards.
fn draw_iron_cuirass(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let g = iron_cuirass();
    let plate = iron_plate();
    let origin = j.chest;
    let y = (j.chest - j.pelvis).norm();
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    let frame = (origin, x, y, z);
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for sh in &g.shapes {
        match sh {
            Shape::Line { from, to, .. } => {
                include_px(&mut bounds, cam.project(local(&frame, *from)), 1.0);
                include_px(&mut bounds, cam.project(local(&frame, *to)), 1.0);
            }
            Shape::Capsule { from, to, thick, .. } => {
                include_px(&mut bounds, cam.project(local(&frame, *from)), *thick);
                include_px(&mut bounds, cam.project(local(&frame, *to)), *thick);
            }
            Shape::Disc { at, center, r, .. } => {
                let c = disc_at(j, &frame, at, *center);
                include_px(&mut bounds, cam.project(c), r * HEIGHT_PX);
            }
        }
    }
    for (lx, ly) in [(plate.x0, plate.y0), (plate.x0, plate.y1), (plate.x1, plate.y0), (plate.x1, plate.y1)] {
        include_px(&mut bounds, cam.project(local(&frame, (lx, ly, plate.z))), 1.0);
    }
    for (sh, el) in [(j.shoulder[0], j.elbow[0]), (j.shoulder[1], j.elbow[1])] {
        let along = |t: f32| sh + (el - sh) * t;
        include_px(&mut bounds, cam.project(along(plate.arm_from)), plate.arm_thick);
        include_px(&mut bounds, cam.project(along(plate.arm_to.max(plate.cuff_to))), plate.arm_thick.max(plate.cuff_thick));
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    let snap = (bw > 0 && bh > 0 && bw * bh <= 80_000).then(|| {
        let mut before = vec![0u8; bw * bh];
        for y in y0..=y1 {
            for x in x0..=x1 {
                before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
            }
        }
        before
    });
    for sh in &g.shapes {
        match sh {
            Shape::Line { from, to, ramp, .. } => {
                fb.line(cam.project(local(&frame, *from)), cam.project(local(&frame, *to)), plate_color(*ramp));
            }
            Shape::Capsule { from, to, ramp, thick } => {
                let (a, b) = (cam.project(local(&frame, *from)), cam.project(local(&frame, *to)));
                fb.capsule(a, b, *thick, plate_color(*ramp), None);
            }
            Shape::Disc { at, center, r, ramp } => {
                fb.disc(cam.project(disc_at(j, &frame, at, *center)), r * HEIGHT_PX, plate_color(*ramp), None);
            }
        }
    }
    for (sh, el) in [(j.shoulder[0], j.elbow[0]), (j.shoulder[1], j.elbow[1])] {
        draw_upper_arm(fb, cam, plate, sh, el);
    }
    if let Some(before) = &snap {
        stamp_plate(fb, cam, &frame, plate, before, x0, y0, x1, y1, j, 0.0);
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

/// 0 at the shoulders, 1 at the hem. Squared so the skirt moves more than the waist.
fn cloth_weight(y: f32) -> f32 {
    let t = ((-0.2 - y) / 0.95).clamp(0.0, 1.0);
    t * t
}

/// Shift a chest-local point toward the foot on its side. Idle feet barely move it.
fn robe_sway(p: (f32, f32, f32), frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, flow: f32) -> Vec3 {
    let rest = local(frame, p);
    let w = cloth_weight(p.1) * flow;
    if w <= 0.001 {
        return rest;
    }
    let side = (p.0 / 0.18).clamp(-1.0, 1.0);
    let t = (side + 1.0) * 0.5;
    let foot = j.foot[0] * (1.0 - t) + j.foot[1] * t;
    let rel = foot - j.pelvis;
    let right = frame.1;
    let fwd = frame.3;
    let push = fwd * rel.dot(fwd) + right * (rel.dot(right) * 0.45);
    rest + push * w
}

const SHEET_COLS: usize = 7;
const SHEET_ROWS: usize = 8;

/// Invisible cross-section. The cloth rides its rim; the disk itself is never drawn.
struct Ring {
    center: Vec3,
    right: Vec3,
    fwd: Vec3,
    rx: f32,
    rz: f32,
}

/// Point on one side of the skeleton. `v` 0 is the shoulder, 1 is the foot.
fn bone_at(j: &Joints, side: usize, v: f32) -> Vec3 {
    let v = v.clamp(0.0, 1.0);
    let shoulder = j.shoulder[side];
    let hip = j.hip[side];
    let knee = j.knee[side];
    let foot = j.foot[side];
    if v < 0.34 {
        shoulder + (hip - shoulder) * (v / 0.34)
    } else if v < 0.67 {
        hip + (knee - hip) * ((v - 0.34) / 0.33)
    } else {
        knee + (foot - knee) * ((v - 0.67) / 0.33)
    }
}

/// Default figure limb radius, in metres. The torso capsule is `limb_px + 0.6`.
const LIMB_R: f32 = 2.2 / HEIGHT_PX;
const TORSO_R: f32 = 2.8 / HEIGHT_PX;

/// How far a horizontal slice of a leg capsule reaches. A leaning bone cuts
/// a wider hole than its radius.
fn leg_clearance(frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, v: f32) -> f32 {
    let mut lean = 1.0_f32;
    for side in 0..2 {
        let (a, b) = if v < 0.67 {
            (bone_at(j, side, 0.34), bone_at(j, side, 0.67))
        } else {
            (bone_at(j, side, 0.67), bone_at(j, side, 1.0))
        };
        let up = (b - a).norm().dot(frame.2).abs().max(0.35);
        lean = lean.min(up);
    }
    LIMB_R / lean
}

/// Smallest ellipse radii that contain a circle of radius `r` around `(bx, bz)`.
fn cover_circle(bx: f32, bz: f32, r: f32) -> (f32, f32) {
    let (ex, ez) = (bx.abs() + r, bz.abs() + r);
    let mut need = 1.0_f32;
    for i in 0..12 {
        let a = (i as f32) * std::f32::consts::PI * 2.0 / 12.0;
        let x = bx + a.cos() * r;
        let z = bz + a.sin() * r;
        let f = (x / ex) * (x / ex) + (z / ez) * (z / ez);
        if f > need {
            need = f;
        }
    }
    let s = need.sqrt();
    (ex * s, ez * s)
}

/// Disk around the two bones at this height. The rim sits outside the limb
/// capsules, not on the bone centers. The hem disk (v = 1) is centered on the
/// feet, so a stride carries it. Shoulders stay near the joint so the arms
/// leave at the seam.
fn ring_at(frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, v: f32) -> Ring {
    let left = bone_at(j, 0, v);
    let right_b = bone_at(j, 1, v);
    let span = right_b - left;
    let shoulder_pad = LIMB_R * (0.35 + 0.65 * (v / 0.34).clamp(0.0, 1.0));
    let lift = (1.0 - (v / 0.18).clamp(0.0, 1.0)) * LIMB_R * 0.65;
    let center = (left + right_b) * 0.5 + frame.2 * lift;
    let sx = span.dot(frame.1).abs() * 0.5 + shoulder_pad;
    let sz = (span.dot(frame.3).abs() * 0.5 + shoulder_pad).max(TORSO_R);
    let t = ((v - 0.28) / 0.10).clamp(0.0, 1.0);
    if t <= 0.0 {
        return Ring { center, right: frame.1, fwd: frame.3, rx: sx, rz: sz };
    }
    let clearance = leg_clearance(frame, j, v);
    let mut lx = TORSO_R;
    let mut lz = TORSO_R;
    for bone in [left, right_b] {
        let d = bone - center;
        let (ex, ez) = cover_circle(d.dot(frame.1), d.dot(frame.3), clearance);
        lx = lx.max(ex);
        lz = lz.max(ez);
    }
    Ring {
        center,
        right: frame.1,
        fwd: frame.3,
        rx: sx * (1.0 - t) + lx * t,
        rz: sz * (1.0 - t) + lz * t,
    }
}

/// Upper arm is 0.30 m, forearm 0.28 m. `v` 0 is the shoulder, 1 is the wrist.
const ARM_SPLIT: f32 = 0.30 / 0.58;

fn arm_at(j: &Joints, side: usize, v: f32) -> Vec3 {
    let v = v.clamp(0.0, 1.0);
    let shoulder = j.shoulder[side];
    let elbow = j.elbow[side];
    let hand = j.hand[side];
    if v < ARM_SPLIT {
        shoulder + (elbow - shoulder) * (v / ARM_SPLIT)
    } else {
        elbow + (hand - elbow) * ((v - ARM_SPLIT) / (1.0 - ARM_SPLIT))
    }
}

fn arm_dir(j: &Joints, side: usize, v: f32) -> Vec3 {
    let shoulder = j.shoulder[side];
    let elbow = j.elbow[side];
    let hand = j.hand[side];
    let d = if v < ARM_SPLIT { elbow - shoulder } else { hand - elbow };
    let n = d.norm();
    if n.len() < 0.5 { v3(0.0, -1.0, 0.0) } else { n }
}

/// Disk around one arm bone. Radius is the limb, so the sleeve stops on the arm.
/// The wrist disk (v = 1) is centered on the hand.
fn sleeve_ring(frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, side: usize, v: f32) -> Ring {
    let dir = arm_dir(j, side, v);
    let mut right = dir.cross(frame.3);
    if right.len() < 0.25 {
        right = dir.cross(Vec3::UP);
    }
    if right.len() < 0.25 {
        right = dir.cross(frame.1);
    }
    right = right.norm();
    let fwd = right.cross(dir).norm();
    Ring { center: arm_at(j, side, v), right, fwd, rx: LIMB_R, rz: LIMB_R }
}

fn on_ring(ring: &Ring, u: f32, front: bool) -> Vec3 {
    let u = u.clamp(0.0, 1.0);
    let ang = if front {
        (u - 0.5) * std::f32::consts::PI
    } else {
        std::f32::consts::PI - (u - 0.5) * std::f32::consts::PI
    };
    ring.center + ring.right * (ang.sin() * ring.rx) + ring.fwd * (ang.cos() * ring.rz)
}

/// Front or back sheet on the disk rim. Both sheets share the left and right edges,
/// and the whole bottom row is the hem disk.
fn sheet_point(frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, u: f32, v: f32, front: bool) -> Vec3 {
    on_ring(&ring_at(frame, j, v), u, front)
}

fn sleeve_point(frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, side: usize, u: f32, v: f32, front: bool) -> Vec3 {
    on_ring(&sleeve_ring(frame, j, side, v), u, front)
}

/// Two pixel sheets, front and back, pinned to the shoulder line and carried by the bones.
fn draw_wizard_robe(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let plate = wizard_plate();
    let y = (j.chest - j.pelvis).norm();
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    let frame = (j.chest, x, y, z);
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for front in [false, true] {
        for row in 0..SHEET_ROWS {
            for col in 0..SHEET_COLS {
                let u = col as f32 / (SHEET_COLS - 1) as f32;
                let v = row as f32 / (SHEET_ROWS - 1) as f32;
                include_px(&mut bounds, cam.project(sheet_point(&frame, j, u, v, front)), 1.0);
                for side in 0..2 {
                    include_px(&mut bounds, cam.project(sleeve_point(&frame, j, side, u, v, front)), 1.0);
                }
            }
        }
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    let snap = (bw > 0 && bh > 0 && bw * bh <= 80_000).then(|| {
        let mut before = vec![0u8; bw * bh];
        for y in y0..=y1 {
            for x in x0..=x1 {
                before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
            }
        }
        before
    });
    // Back sheet first. Depth keeps it behind the skeleton and the front sheet.
    for front in [false, true] {
        draw_sheet(fb, cam, &frame, j, plate, front);
        for side in 0..2 {
            draw_sleeve(fb, cam, &frame, j, plate, side, front);
        }
    }
    // Top cap is the top row. Bottom cap is the bottom row.
    let top = plate_edge(plate, 0);
    let hem_c = plate_edge(plate, plate.h.saturating_sub(1));
    paint_ring(fb, cam, &ring_at(&frame, j, 0.0), top, -0.04);
    paint_ring(fb, cam, &ring_at(&frame, j, 1.0), hem_c, -0.04);
    for side in 0..2 {
        paint_ring(fb, cam, &sleeve_ring(&frame, j, side, 0.0), top, -0.02);
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn leather_vest() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_leather_vest.ron")).expect("ba_leather_vest")
    })
}

fn vest_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_leather_vest.plate.ron")))
}

fn vest_color(slot: ColorSlot) -> u8 {
    match slot {
        ColorSlot::Trim => C_STEEL,
        _ => crate::palette::GEAR_LEATHER,
    }
}

fn bone_harness() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_bone_harness.ron")).expect("ba_bone_harness")
    })
}

fn harness_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_bone_harness.plate.ron")))
}

fn harness_color(_slot: ColorSlot) -> u8 {
    crate::palette::GEAR_BONE
}

/// Short leather mesh on the torso, plus shoulder straps fixed to the chest.
fn draw_leather_vest(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    draw_wrapped(fb, cam, j, leather_vest(), vest_plate(), vest_color);
}

/// Hide mesh on the torso. Bone ribs and straps are capsules on the chest.
fn draw_bone_harness(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    draw_wrapped(fb, cam, j, bone_harness(), harness_plate(), harness_color);
}

fn draw_wrapped(fb: &mut Framebuffer, cam: &Camera, j: &Joints, g: &GearDef, plate: &Plate, color: fn(ColorSlot) -> u8) {
    let y = (j.chest - j.pelvis).norm();
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    let frame = (j.chest, x, y, z);
    let vend = plate.wrap.clamp(0.05, 1.0);
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for front in [false, true] {
        for row in 0..SHEET_ROWS {
            for col in 0..SHEET_COLS {
                let u = col as f32 / (SHEET_COLS - 1) as f32;
                let v = row as f32 / (SHEET_ROWS - 1) as f32 * vend;
                include_px(&mut bounds, cam.project(sheet_point(&frame, j, u, v, front)), 1.0);
            }
        }
    }
    for sh in &g.shapes {
        match sh {
            Shape::Capsule { from, to, thick, .. } => {
                include_px(&mut bounds, cam.project(local(&frame, *from)), *thick);
                include_px(&mut bounds, cam.project(local(&frame, *to)), *thick);
            }
            Shape::Disc { at, center, r, .. } => {
                include_px(&mut bounds, cam.project(disc_at(j, &frame, at, *center)), r * HEIGHT_PX);
            }
            Shape::Line { from, to, .. } => {
                include_px(&mut bounds, cam.project(local(&frame, *from)), 1.0);
                include_px(&mut bounds, cam.project(local(&frame, *to)), 1.0);
            }
        }
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    let snap = (bw > 0 && bh > 0 && bw * bh <= 80_000).then(|| {
        let mut before = vec![0u8; bw * bh];
        for y in y0..=y1 {
            for x in x0..=x1 {
                before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
            }
        }
        before
    });
    for front in [false, true] {
        paint_grid(fb, cam, plate, vend, |u, v| sheet_point(&frame, j, u, v, front));
    }
    let top = plate_edge(plate, 0);
    let hem_c = plate_edge(plate, plate.h.saturating_sub(1));
    paint_ring(fb, cam, &ring_at(&frame, j, 0.0), top, -0.04);
    paint_ring(fb, cam, &ring_at(&frame, j, vend), hem_c, -0.04);
    for sh in &g.shapes {
        match sh {
            Shape::Line { from, to, ramp, .. } => {
                fb.line(cam.project(local(&frame, *from)), cam.project(local(&frame, *to)), color(*ramp));
            }
            Shape::Capsule { from, to, ramp, thick } => {
                let (a, b) = (cam.project(local(&frame, *from)), cam.project(local(&frame, *to)));
                fb.capsule(a, b, *thick, color(*ramp), None);
            }
            Shape::Disc { at, center, r, ramp } => {
                fb.disc(cam.project(disc_at(j, &frame, at, *center)), r * HEIGHT_PX, color(*ramp), None);
            }
        }
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn plate_edge(plate: &Plate, row: usize) -> u8 {
    let row = row.min(plate.h.saturating_sub(1));
    let cell = plate.cells[row * plate.w + plate.w / 2];
    if cell == 0 { C_DUST } else { cell }
}

fn paint_ring(fb: &mut Framebuffer, cam: &Camera, ring: &Ring, color: u8, bias: f32) {
    const N: usize = 12;
    let center = cam.project(ring.center);
    if center.culled() {
        return;
    }
    let at = |i: usize| {
        let ang = (i as f32) / (N as f32) * std::f32::consts::PI * 2.0;
        cam.project(ring.center + ring.right * ang.sin() * ring.rx + ring.fwd * ang.cos() * ring.rz)
    };
    let mut prev = at(0);
    for i in 1..=N {
        let next = at(i % N);
        paint_solid_tri(fb, center, prev, next, color, bias);
        prev = next;
    }
}

fn paint_solid_tri(fb: &mut Framebuffer, a: stick_engine::camera::P2, b: stick_engine::camera::P2, c: stick_engine::camera::P2, color: u8, bias: f32) {
    if a.culled() || b.culled() || c.culled() {
        return;
    }
    let min_x = (a.x.min(b.x).min(c.x).floor() as i32).max(0);
    let max_x = (a.x.max(b.x).max(c.x).ceil() as i32).min(fb.w as i32 - 1);
    let min_y = (a.y.min(b.y).min(c.y).floor() as i32).max(0);
    let max_y = (a.y.max(b.y).max(c.y).ceil() as i32).min(fb.h as i32 - 1);
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-4 {
        return;
    }
    let inv = 1.0 / area;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3 {
                continue;
            }
            fb.plot(x, y, w0 * a.d + w1 * b.d + w2 * c.d + bias, color);
        }
    }
}

fn draw_sheet(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, plate: &Plate, front: bool) {
    paint_grid(fb, cam, plate, 1.0, |u, v| sheet_point(frame, j, u, v, front));
}

fn draw_sleeve(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), j: &Joints, plate: &Plate, side: usize, front: bool) {
    paint_grid(fb, cam, plate, 1.0, |u, v| sleeve_point(frame, j, side, u, v, front));
}

/// `v_end` is the skeleton position of the last row. Texture v still runs 0..1.
fn paint_grid(fb: &mut Framebuffer, cam: &Camera, plate: &Plate, v_end: f32, at: impl Fn(f32, f32) -> Vec3) {
    let proj = |col: usize, row: usize| {
        let u = col as f32 / (SHEET_COLS - 1) as f32;
        let tv = row as f32 / (SHEET_ROWS - 1) as f32;
        (cam.project(at(u, tv * v_end)), (u, tv))
    };
    for row in 0..SHEET_ROWS - 1 {
        for col in 0..SHEET_COLS - 1 {
            let (a, ua) = proj(col, row);
            let (b, ub) = proj(col + 1, row);
            let (c, uc) = proj(col + 1, row + 1);
            let (d, ud) = proj(col, row + 1);
            paint_cloth_tri(fb, a, b, c, ua, ub, uc, plate);
            paint_cloth_tri(fb, a, c, d, ua, uc, ud, plate);
        }
    }
}

fn paint_cloth_tri(
    fb: &mut Framebuffer,
    a: stick_engine::camera::P2,
    b: stick_engine::camera::P2,
    c: stick_engine::camera::P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    plate: &Plate,
) {
    if a.culled() || b.culled() || c.culled() {
        return;
    }
    let min_x = (a.x.min(b.x).min(c.x).floor() as i32).max(0);
    let max_x = (a.x.max(b.x).max(c.x).ceil() as i32).min(fb.w as i32 - 1);
    let min_y = (a.y.min(b.y).min(c.y).floor() as i32).max(0);
    let max_y = (a.y.max(b.y).max(c.y).ceil() as i32).min(fb.h as i32 - 1);
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-4 {
        return;
    }
    let inv = 1.0 / area;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3 {
                continue;
            }
            let u = (w0 * ua.0 + w1 * ub.0 + w2 * uc.0).clamp(0.0, 0.9999);
            let v = (w0 * ua.1 + w1 * ub.1 + w2 * uc.1).clamp(0.0, 0.9999);
            let col = (u * plate.w as f32) as usize;
            let row = (v * plate.h as f32) as usize;
            let cell = plate.cells[row * plate.w + col];
            let depth = w0 * a.d + w1 * b.d + w2 * c.d;
            fb.plot(x, y, depth, if cell == 0 { C_DUST } else { cell });
        }
    }
}

/// Steel guard on the upper arm, starting under the shoulder cap, with a gold cuff.
fn draw_upper_arm(fb: &mut Framebuffer, cam: &Camera, plate: &Plate, shoulder: Vec3, elbow: Vec3) {
    let along = |t: f32| shoulder + (elbow - shoulder) * t;
    let p = |t: f32| cam.project(along(t));
    fb.capsule(p(plate.arm_from), p(plate.arm_to), plate.arm_thick, C_STEEL, None);
    fb.capsule(p(plate.cuff_from), p(plate.cuff_to), plate.cuff_thick, C_GOLD, None);
}

/// Recolour gear pixels that the front-face quad covers. Empty cells stay steel.
fn stamp_plate(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), plate: &Plate, before: &[u8], x0: i32, y0: i32, x1: i32, y1: i32, j: &Joints, flow: f32) {
    let corner = |lx: f32, ly: f32| cam.project(robe_sway((lx, ly, plate.z), frame, j, flow));
    let tl = corner(plate.x0, plate.y1);
    let tr = corner(plate.x1, plate.y1);
    let br = corner(plate.x1, plate.y0);
    let bl = corner(plate.x0, plate.y0);
    stamp_tri(fb, tl, tr, br, (0.0, 0.0), (1.0, 0.0), (1.0, 1.0), plate, before, x0, y0, x1, y1);
    stamp_tri(fb, tl, br, bl, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), plate, before, x0, y0, x1, y1);
}

fn stamp_tri(
    fb: &mut Framebuffer,
    a: stick_engine::camera::P2,
    b: stick_engine::camera::P2,
    c: stick_engine::camera::P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    plate: &Plate,
    before: &[u8],
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
) {
    let min_x = (a.x.min(b.x).min(c.x).floor() as i32).max(x0);
    let max_x = (a.x.max(b.x).max(c.x).ceil() as i32).min(x1);
    let min_y = (a.y.min(b.y).min(c.y).floor() as i32).max(y0);
    let max_y = (a.y.max(b.y).max(c.y).ceil() as i32).min(y1);
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-4 {
        return;
    }
    let inv = 1.0 / area;
    let bw = (x1 - x0 + 1) as usize;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3 {
                continue;
            }
            let fi = y as usize * fb.w + x as usize;
            let bi = (y - y0) as usize * bw + (x - x0) as usize;
            if fb.color[fi] == before[bi] {
                continue;
            }
            let u = (w0 * ua.0 + w1 * ub.0 + w2 * uc.0).clamp(0.0, 0.9999);
            let v = (w0 * ua.1 + w1 * ub.1 + w2 * uc.1).clamp(0.0, 0.9999);
            let col = (u * plate.w as f32) as usize;
            let row = (v * plate.h as f32) as usize;
            let cell = plate.cells[row * plate.w + col];
            if cell != 0 {
                fb.color[fi] = cell;
            }
        }
    }
}

fn disc_at(j: &Joints, frame: &(Vec3, Vec3, Vec3, Vec3), at: &Option<String>, center: (f32, f32, f32)) -> Vec3 {
    match at.as_deref() {
        Some("l_shoulder") => j.shoulder[0],
        Some("r_shoulder") => j.shoulder[1],
        _ => local(frame, center),
    }
}

fn include_px(b: &mut [i32; 4], p: stick_engine::camera::P2, rad: f32) {
    if p.culled() {
        return;
    }
    let r = rad.ceil() as i32 + 2;
    b[0] = b[0].min(p.x.floor() as i32 - r);
    b[1] = b[1].min(p.y.floor() as i32 - r);
    b[2] = b[2].max(p.x.ceil() as i32 + r);
    b[3] = b[3].max(p.y.ceil() as i32 + r);
}

fn clip_bounds(fb: &Framebuffer, b: [i32; 4]) -> (i32, i32, i32, i32) {
    let x0 = b[0].clamp(0, fb.w as i32 - 1);
    let y0 = b[1].clamp(0, fb.h as i32 - 1);
    let x1 = b[2].clamp(0, fb.w as i32 - 1);
    let y1 = b[3].clamp(0, fb.h as i32 - 1);
    (x0, y0, x1, y1)
}

/// 1 px border on pixels that touch the gear but are not part of it.
fn silhouette(fb: &mut Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32, before: &[u8]) {
    let bw = (x1 - x0 + 1) as usize;
    let mut gear = vec![false; before.len()];
    for y in y0..=y1 {
        for x in x0..=x1 {
            let i = (y - y0) as usize * bw + (x - x0) as usize;
            if fb.color[y as usize * fb.w + x as usize] != before[i] {
                gear[i] = true;
            }
        }
    }
    for y in y0..=y1 {
        for x in x0..=x1 {
            let i = (y - y0) as usize * bw + (x - x0) as usize;
            if gear[i] {
                continue;
            }
            let mut depth = f32::INFINITY;
            for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)] {
                let (nx, ny) = (x + dx, y + dy);
                if nx < x0 || ny < y0 || nx > x1 || ny > y1 {
                    continue;
                }
                let n = (ny - y0) as usize * bw + (nx - x0) as usize;
                if gear[n] {
                    depth = depth.min(fb.depth[ny as usize * fb.w + nx as usize]);
                }
            }
            if depth.is_finite() {
                fb.plot(x, y, depth + 0.02, C_OUTLINE);
            }
        }
    }
}

fn iron_helm() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_helm.ron")).expect("ba_iron_helm"))
}

fn helm_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_iron_helm.plate.ron")))
}

/// Shell radius, just outside the face. Disks are cross-sections; they are not drawn.
const HELM_R: f32 = 0.17;
const HELM_FACE: f32 = 0.13;
/// Horizontal disks, crown first, then down to the face.
const CROWN_Y: [f32; 5] = [0.155, 0.12, 0.08, 0.04, 0.0];
/// Vertical disks, face first, then dorsally to the back of the head.
const DORSAL_Z: [f32; 5] = [0.02, -0.03, -0.08, -0.12, -0.155];
const HELM_STEPS: usize = 16;

struct HelmDisk {
    center: (f32, f32, f32),
    right: (f32, f32, f32),
    fwd: (f32, f32, f32),
    rx: f32,
    rz: f32,
}

fn helm_rad(along: f32) -> f32 {
    (HELM_R * HELM_R - along * along).max(0.0004).sqrt()
}

fn crown_disks() -> [HelmDisk; 5] {
    CROWN_Y.map(|y| {
        let r = helm_rad(y);
        HelmDisk { center: (0.0, y, 0.0), right: (1.0, 0.0, 0.0), fwd: (0.0, 0.0, 1.0), rx: r, rz: r }
    })
}

fn dorsal_disks() -> [HelmDisk; 5] {
    DORSAL_Z.map(|z| {
        let r = helm_rad(z);
        HelmDisk { center: (0.0, 0.0, z), right: (1.0, 0.0, 0.0), fwd: (0.0, 1.0, 0.0), rx: r, rz: r }
    })
}

fn helm_rim(disk: &HelmDisk, u: f32) -> (f32, f32, f32) {
    let ang = u * std::f32::consts::TAU;
    let (s, c) = (ang.sin(), ang.cos());
    (
        disk.center.0 + disk.right.0 * s * disk.rx + disk.fwd.0 * c * disk.rz,
        disk.center.1 + disk.right.1 * s * disk.rx + disk.fwd.1 * c * disk.rz,
        disk.center.2 + disk.right.2 * s * disk.rx + disk.fwd.2 * c * disk.rz,
    )
}

/// Pull a helm pixel in front of the head disc so the shell hides the head
/// wherever it covers it. The opening has no pixels, so the face stays there.
fn helm_in_front(mut p: stick_engine::camera::P2) -> stick_engine::camera::P2 {
    p.d -= 0.5;
    p
}
fn helm_flip(p: (f32, f32, f32)) -> (f32, f32, f32) {
    (-p.0, p.1, -p.2)
}

/// Front of the head, inside the face. Strips stop here so the face stays open.
fn face_hole(p: (f32, f32, f32)) -> bool {
    if p.2 > 0.0 && p.1 < 0.11 && p.0 * p.0 + p.1 * p.1 < HELM_FACE * HELM_FACE {
        return true;
    }
    p.2 > -0.05 && p.1 < 0.0 && p.0 * p.0 < 0.10 * 0.10
}

/// Pixel strips between invisible disks. The most dorsal disk is the gold cap.
fn draw_iron_helm(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let _ = iron_helm();
    let plate = helm_plate();
    let frame = head_frame(j);
    let crown = crown_disks();
    let dorsal = dorsal_disks();
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for chain in [&crown[..], &dorsal[..]] {
        for disk in chain {
            for step in 0..HELM_STEPS {
                let raw = helm_rim(disk, step as f32 / HELM_STEPS as f32);
                if face_hole(raw) {
                    continue;
                }
                include_px(&mut bounds, cam.project(local(&frame, helm_flip(raw))), 2.0);
            }
        }
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    let snap = (bw > 0 && bh > 0 && bw * bh <= 80_000).then(|| {
        let mut before = vec![0u8; bw * bh];
        for y in y0..=y1 {
            for x in x0..=x1 {
                before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
            }
        }
        before
    });
    paint_helm_chain(fb, cam, &frame, plate, &crown);
    paint_helm_chain(fb, cam, &frame, plate, &dorsal);
    paint_dorsal_cap(fb, cam, &frame, dorsal.last().unwrap());
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_helm_chain(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), plate: &Plate, disks: &[HelmDisk]) {
    let n = disks.len();
    if n < 2 {
        return;
    }
    for i in 0..n - 1 {
        let v0 = i as f32 / (n - 1) as f32;
        let v1 = (i + 1) as f32 / (n - 1) as f32;
        for col in 0..HELM_STEPS {
            let u0 = col as f32 / HELM_STEPS as f32;
            let u1 = (col + 1) as f32 / HELM_STEPS as f32;
            let a = helm_rim(&disks[i], u0);
            let b = helm_rim(&disks[i], u1);
            let c = helm_rim(&disks[i + 1], u1);
            let d = helm_rim(&disks[i + 1], u0);
            if face_hole(a) || face_hole(b) || face_hole(c) || face_hole(d) {
                continue;
            }
            let pa = helm_in_front(cam.project(local(frame, helm_flip(a))));
            let pb = helm_in_front(cam.project(local(frame, helm_flip(b))));
            let pc = helm_in_front(cam.project(local(frame, helm_flip(c))));
            let pd = helm_in_front(cam.project(local(frame, helm_flip(d))));
            paint_cloth_tri(fb, pa, pb, pc, (u0, v0), (u1, v0), (u1, v1), plate);
            paint_cloth_tri(fb, pa, pc, pd, (u0, v0), (u1, v1), (u0, v1), plate);
        }
    }
}

fn helm_axis(frame: &(Vec3, Vec3, Vec3, Vec3), a: (f32, f32, f32)) -> Vec3 {
    let a = helm_flip(a);
    frame.1 * a.0 + frame.2 * a.1 + frame.3 * a.2
}

/// Gold fill on the furthest-back disk. The other disks stay invisible.
fn paint_dorsal_cap(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), disk: &HelmDisk) {
    let ring = Ring {
        center: local(frame, helm_flip(disk.center)),
        right: helm_axis(frame, disk.right),
        fwd: helm_axis(frame, disk.fwd),
        rx: disk.rx,
        rz: disk.rz,
    };
    paint_ring(fb, cam, &ring, C_GOLD, -0.5);
}

fn head_frame(j: &Joints) -> (Vec3, Vec3, Vec3, Vec3) {
    let y = (j.chest - j.pelvis).norm();
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    (j.head, x, y, z)
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

#[cfg(test)]
mod plate_tests {
    #[test]
    fn cuirass_plate_is_a_grid_with_gold_and_a_medallion() {
        let p = super::iron_plate();
        assert_eq!(p.w, 15);
        assert_eq!(p.h, 18);
        assert!(p.arm_to > p.arm_from);
        assert!(p.cells.contains(&crate::compat::C_GOLD));
        assert!(p.cells.contains(&crate::compat::C_ACCENT));
        assert!(p.cells.contains(&0));
        assert_eq!(p.flow, 0.0);
    }

    #[test]
    fn wizard_robe_flows_from_the_hem() {
        let p = super::wizard_plate();
        assert_eq!(p.w, 15);
        assert_eq!(p.h, 18);
        assert!(p.flow > 0.2);
        assert!(p.sleeve_drop > 0.2);
        assert!(p.cells.contains(&crate::compat::C_SHADOW));
        assert!(p.cells.contains(&crate::palette::WATER));
        assert!(p.cells.contains(&27));
        assert!(!p.cells.contains(&0), "every robe pixel is painted");
        let g = super::wizard_robe();
        assert_eq!(g.shapes.len(), 14);
    }

    #[test]
    fn leather_vest_is_a_short_mesh_with_straps() {
        use stick_engine::gear::Shape;
        let p = super::vest_plate();
        assert_eq!(p.w, 15);
        assert!(p.wrap > 0.2 && p.wrap < 0.45, "hem stops at the waist");
        assert_eq!(p.flow, 0.0);
        assert!(!p.cells.contains(&0), "every vest pixel is painted");
        assert!(p.cells.contains(&crate::palette::GEAR_LEATHER));
        assert!(p.cells.contains(&crate::palette::GEAR_LEATHER_FAR));
        assert!(p.cells.contains(&crate::compat::C_SHADOW));
        let g = super::leather_vest();
        assert_eq!(g.shapes.len(), 2);
        assert!(g.shapes.iter().all(|s| matches!(s, Shape::Capsule { .. })));
    }

    #[test]
    fn bone_harness_is_hide_with_ribs() {
        use stick_engine::gear::Shape;
        let p = super::harness_plate();
        assert_eq!(p.w, 15);
        assert!(p.wrap > 0.2 && p.wrap < 0.45, "hem stops at the waist");
        assert_eq!(p.flow, 0.0);
        assert!(!p.cells.contains(&0), "every hide pixel is painted");
        assert!(p.cells.contains(&crate::palette::CR_HARE));
        assert!(p.cells.contains(&crate::palette::CR_HARE_FAR));
        assert!(p.cells.contains(&crate::compat::C_SHADOW));
        let g = super::bone_harness();
        assert_eq!(g.shapes.len(), 8);
        assert!(g.shapes.iter().all(|s| matches!(s, Shape::Capsule { .. })));
    }

    #[test]
    fn iron_helm_disks_run_crown_to_face_then_back() {
        let crown = super::crown_disks();
        assert!(crown[0].center.1 > crown[4].center.1, "crown stack steps down");
        assert!(crown[0].center.1 > 0.14);
        assert!(crown[4].center.1 <= 0.01, "the last horizontal disk is at the face");
        assert!(crown[4].rx > crown[0].rx);
        let front = super::helm_rim(&crown[4], 0.0);
        assert!(super::face_hole(front), "the face opening is not a strip");
        let side = super::helm_rim(&crown[4], 0.25);
        assert!(!super::face_hole(side), "the side of the face disk stays");
        let dorsal = super::dorsal_disks();
        assert!(dorsal[0].center.2 > dorsal[4].center.2, "vertical disks step back");
        assert!(dorsal[0].center.2 > 0.0);
        assert!(dorsal[4].center.2 < -0.14);
        assert_eq!(dorsal[0].fwd.1, 1.0, "dorsal disks stand vertical");
        let back = super::helm_rim(&dorsal[4], 0.5);
        assert!(back.2 < -0.14);
        assert!(!super::face_hole(back));
        let g = super::iron_helm();
        assert!(g.shapes.is_empty(), "the disks are invisible");
        let plate = super::helm_plate();
        assert!(plate.cells.contains(&super::C_STEEL));
        assert!(plate.cells.contains(&super::C_GOLD));
        assert!(!plate.cells.contains(&0));
        assert!(!plate.cells.contains(&13), "helm pixels are grey and gold only");
    }

    #[test]
    fn robe_sheet_stays_between_the_bones() {
        use stick_engine::math::{v3, Vec3};
        let j = crate::compat::Fig {
            pelvis: v3(0.0, 0.9, 0.0),
            chest: v3(0.0, 1.4, 0.0),
            shoulder: [v3(-0.2, 1.35, 0.0), v3(0.2, 1.35, 0.0)],
            hip: [v3(-0.1, 0.9, 0.0), v3(0.12, 0.9, 0.04)],
            knee: [v3(-0.11, 0.48, 0.16), v3(0.13, 0.48, -0.12)],
            foot: [v3(-0.1, 0.02, 0.22), v3(0.14, 0.02, -0.18)],
            ..crate::compat::Fig::default()
        };
        let y = (j.chest - j.pelvis).norm();
        let mut x = y.cross(Vec3::UP).norm();
        if x.len() < 0.5 {
            x = v3(1.0, 0.0, 0.0);
        }
        let z = x.cross(y).norm();
        let frame = (j.chest, x, y, z);
        let pin = super::sheet_point(&frame, &j, 0.0, 0.0, true);
        assert!((pin - j.shoulder[0]).len() < 0.08, "top corner stays on the shoulder");
        for v in [0.0_f32, 0.4, 0.7, 1.0] {
            let left = super::bone_at(&j, 0, v);
            let right = super::bone_at(&j, 1, v);
            let mid = super::sheet_point(&frame, &j, 0.5, v, true);
            let back = super::sheet_point(&frame, &j, 0.5, v, false);
            let lx = left.dot(x);
            let rx = right.dot(x);
            let mx = mid.dot(x);
            assert!(mx > lx.min(rx) - 0.001 && mx < lx.max(rx) + 0.001, "row {v} crosses a limb");
            assert!((mid - (left + (right - left) * 0.5)).dot(z) > 0.04, "front sheet stays in front of the bone");
            assert!((back - (left + (right - left) * 0.5)).dot(z) < -0.04, "back sheet stays behind the bone");
        }
        let hem_l_front = super::sheet_point(&frame, &j, 0.0, 1.0, true);
        let hem_l_back = super::sheet_point(&frame, &j, 0.0, 1.0, false);
        let hem_r_front = super::sheet_point(&frame, &j, 1.0, 1.0, true);
        let hem_r_back = super::sheet_point(&frame, &j, 1.0, 1.0, false);
        assert!((hem_l_front - hem_l_back).len() < 1e-4, "both sheets meet on the left of the hem disk");
        assert!((hem_r_front - hem_r_back).len() < 1e-4, "both sheets meet on the right of the hem disk");
        let hem_center = (hem_l_front + hem_r_front) * 0.5;
        let feet = (j.foot[0] + j.foot[1]) * 0.5;
        assert!((hem_center - feet).len() < 1e-3, "the hem disk rides the feet");
        for v in [0.5_f32, 0.75, 1.0] {
            let ring = super::ring_at(&frame, &j, v);
            for side in 0..2 {
                let bone = super::bone_at(&j, side, v);
                for i in 0..8 {
                    let a = (i as f32) * std::f32::consts::PI * 2.0 / 8.0;
                    let p = bone + x * (a.cos() * super::LIMB_R) + z * (a.sin() * super::LIMB_R);
                    let d = p - ring.center;
                    let ex = d.dot(ring.right) / ring.rx;
                    let ez = d.dot(ring.fwd) / ring.rz;
                    assert!(ex * ex + ez * ez <= 1.02, "leg capsule stays inside the cloth at {v}");
                }
            }
        }
    }

    #[test]
    fn sleeve_cloth_ends_on_the_wrist() {
        use stick_engine::math::{v3, Vec3};
        let j = crate::compat::Fig {
            pelvis: v3(0.0, 0.9, 0.0),
            chest: v3(0.0, 1.4, 0.0),
            shoulder: [v3(-0.2, 1.35, 0.0), v3(0.2, 1.35, 0.0)],
            elbow: [v3(-0.34, 1.08, 0.04), v3(0.36, 1.05, 0.02)],
            hand: [v3(-0.42, 0.82, 0.10), v3(0.50, 0.78, 0.12)],
            ..crate::compat::Fig::default()
        };
        let y = (j.chest - j.pelvis).norm();
        let mut x = y.cross(Vec3::UP).norm();
        if x.len() < 0.5 {
            x = v3(1.0, 0.0, 0.0);
        }
        let z = x.cross(y).norm();
        let frame = (j.chest, x, y, z);
        let l = super::sleeve_point(&frame, &j, 1, 0.0, 1.0, true);
        let r = super::sleeve_point(&frame, &j, 1, 1.0, 1.0, true);
        let back = super::sleeve_point(&frame, &j, 1, 0.0, 1.0, false);
        assert!((l - back).len() < 1e-4, "both sleeve sheets meet on the wrist disk");
        let center = (l + r) * 0.5;
        assert!((center - j.hand[1]).len() < 1e-3, "the wrist disk sits on the hand");
        assert!(((l - center).len() - super::LIMB_R).abs() < 1e-3, "the cuff matches the wrist");
        let bone = super::arm_at(&j, 1, 0.25);
        let cloth = super::sleeve_point(&frame, &j, 1, 0.5, 0.25, true);
        let dist = (cloth - bone).len();
        assert!(dist < super::LIMB_R + 0.01 && dist > super::LIMB_R * 0.5, "sleeve stays on the arm");
    }
}
