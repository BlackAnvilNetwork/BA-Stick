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
use crate::gear::{
    Garb, HeadStyle, WeaponLook, BONE_DAGGER_ITEM, BONE_HELM_ITEM, BRONZE_AXE_ITEM, BRONZE_HELM_ITEM,
    DECAYED_AXE_ITEM,
    BRONZE_SWORD_ITEM, DARKSTEEL_BLADE_ITEM, DARKSTEEL_GREAT_AXE_ITEM, DARKSTEEL_HELM_ITEM,
    FANG_DAGGER_ITEM, IRON_DAGGER_ITEM, IRON_GREAT_AXE_ITEM, IRON_GREATSWORD_ITEM, IRON_HELM_ITEM,
    MYTHRIL_GREATSWORD_ITEM, MYTHRIL_HELM_ITEM, MYTHRIL_SWORD_ITEM, NEOLITHIC_DAGGER_ITEM,
    ORICHALCUM_SWORD_ITEM, PALACE_GREAT_AXE_ITEM, PALACE_HELM_ITEM, SCALE_MAIL_HELM_ITEM,
    SHADE_HELM_ITEM, STEEL_GREATSWORD_ITEM, BELL_TORQUE_BAND_ITEM, CIRCLET_ITEM, LINEN_HELM_ITEM,
    LEATHER_BANDANA_ITEM, MYTHRIL_TORQUE_ITEM, SHADE_LEATHER_BANDANA_ITEM, FINE_JERKIN_HELM_ITEM,
    SKULL_BANDANA_ITEM, SILK_HAT_ITEM, VELVET_HAT_ITEM, DECAYED_SWORD_ITEM, uses_bandana_mesh,
};
use crate::palette::{CR_TUSK, GEAR_BONE, GEAR_BRONZE, GEAR_LEATHER, GEAR_LEATHER_FAR, ROCK, ROCK_D};

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
    draw_garbed(
        fb,
        cam,
        j,
        pr,
        look,
        &garb,
        false,
        false,
        GatherTool::None,
        false,
        0.0,
        None,
        0,
        0.0,
    );
}

/// What the right hand holds during a gather channel. The equipped weapon is stowed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GatherTool {
    None,
    Shovel,
    Pick,
    /// Bench leathercraft: RON hammer + leather workpiece.
    Leathercraft,
    /// Summoned anvil + hammer (smithing).
    Smithing,
    /// Summoned cook pot + spoon (cooking).
    Cooking,
    /// Jeweler's stake + hammer (goldsmithing).
    Goldsmithing,
}

/// Three hammer strikes over this window (matches client `LEATHERCRAFT_ANIM_MS`).
pub const LEATHERCRAFT_SEC: f32 = 2.7;
const LEATHERCRAFT_STRIKES: f32 = 3.0;

/// Figure with equipment applied (#14). `fp` draws only the forearms and the
/// weapon (the eye is inside the head). `swinging` aims a sword along the swing.
/// `planted` aims the sword down into `ground_y` (a hero's rest).
pub fn draw_garbed(
    fb: &mut Framebuffer,
    cam: &Camera,
    j: &Joints,
    pr: &Proportions,
    look: &Look,
    garb: &Garb,
    fp: bool,
    swinging: bool,
    tool: GatherTool,
    planted: bool,
    ground_y: f32,
    hair_rig: Option<(&stick_engine::rig::Joints, &stick_engine::body::BodyParams)>,
    weapon_edge: u8,
    time: f32,
) {
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
    if garb.cuisses {
        draw_iron_cuisses(fb, cam, j);
    }
    let head_px = pr.head_r * HEIGHT_PX * cam.scale_at(j.head);
    fb.disc(p(j.head), head_px, look.body, o);
    let hair_ok = garb.helm_item == 0 && garb.hat_item.is_none() && garb.headband_item == 0 && garb.head.is_none();
    if hair_ok {
        if let Some((rig, body)) = hair_rig {
            if body.hair != stick_engine::body::HairStyle::None {
                stick_engine::render::draw_hair(fb, cam, rig, body, look.hair, look.body, o);
            }
        }
    }
    if garb.helm_item != 0 {
        draw_catalog_helm(fb, cam, j, garb.helm_item);
    } else if uses_bandana_mesh(garb.headband_item) {
        draw_leather_bandana(fb, cam, j, garb.headband_item);
    } else if garb.headband_item != 0 {
        draw_headband(fb, cam, j, garb.headband_item);
    } else if let Some(item) = garb.hat_item {
        draw_cloth_hat(fb, cam, j, item);
    } else if let Some((style, c, crest)) = garb.head {
        head_gear(fb, cam, j, pr.head_r, style, c, crest);
    }
    if garb.shield {
        draw_iron_shield(fb, cam, j);
    }
    if garb.kite {
        draw_kite_shield(fb, cam, j);
    }
    }
    let w = garb.weapon.unwrap_or(WeaponLook::plain(Weapon::None));
    let lay = pixel_sword_layout(&w);
    let pixel_axe = pixel_axe_item(w.seed);
    let pixel_blade = lay.is_some() || pixel_axe;
    let blade = sword_blade_frame(j, ground_y, planted, swinging, pixel_blade, lay.as_ref());
    let hand = blade.hand;
    let dir = blade.dir;
    let plane = blade.plane;
    let base = if pr.sword > 0.0 { pr.sword } else { 0.75 };
    let side = {
        let s = v3(dir.z, 0.0, -dir.x);
        if s.len() > 1e-3 { s * (1.0 / s.len()) } else { v3(1.0, 0.0, 0.0) }
    };
    if tool == GatherTool::Leathercraft {
        draw_leathercraft_props(fb, cam, j);
    } else if tool == GatherTool::Smithing {
        draw_smithing_props(fb, cam, j, ground_y);
    } else if tool == GatherTool::Cooking {
        draw_cooking_props(fb, cam, j, ground_y);
    } else if tool == GatherTool::Goldsmithing {
        draw_goldsmithing_props(fb, cam, j, ground_y);
    } else if tool != GatherTool::None {
        match tool {
            GatherTool::Shovel => draw_iron_shovel(fb, cam, hand, dir, plane),
            GatherTool::Pick => draw_iron_pickaxe(fb, cam, hand, dir, plane),
            GatherTool::None | GatherTool::Leathercraft | GatherTool::Smithing | GatherTool::Cooking | GatherTool::Goldsmithing => {}
        }
    } else { match w.kind {
        Weapon::Sword => {
            let tip = blade.tip_y;
            let lay = lay.as_ref().expect("pixel sword layout");
            let pal = pixel_sword_palette(w.seed);
            draw_pixel_sword(fb, cam, hand, dir, plane, tip, lay, pal);
            draw_sword_edge_pixels(fb, cam, hand, dir, plane, tip, lay, weapon_edge, time);
        }
        Weapon::Greatsword => {
            if let Some(lay) = lay.as_ref() {
                let tip = blade.tip_y;
                let pal = pixel_sword_palette(w.seed);
                draw_pixel_sword(fb, cam, hand, dir, plane, tip, lay, pal);
                draw_sword_edge_pixels(fb, cam, hand, dir, plane, tip, lay, weapon_edge, time);
                if pixel_two_hand_grip(lay) {
                    let off_y = pixel_sword_offhand_grip_y(lay);
                    fb.disc(p(hand + dir * off_y), t * 0.85, look.body, o);
                }
            } else {
                let len = base * 1.45;
                let width = 1.7;
                let guard = 0.16;
                let tip = hand + dir * (len * w.len);
                let pommel = hand - dir * 0.1;
                let guard_c = hand + dir * 0.06;
                fb.capsule(p(pommel), p(guard_c), 1.2, w.grip, None);
                fb.disc(p(pommel), 1.1, w.gem, None);
                fb.capsule(p(guard_c - side * guard), p(guard_c + side * guard), 1.0, w.guard, None);
                fb.capsule(p(guard_c), p(tip), width, w.blade, o);
                fb.line(p(guard_c), p(tip), C_TRAIL);
            }
        }
        Weapon::Dagger => {
            if let Some(lay) = lay.as_ref() {
                let tip = blade.tip_y;
                let pal = pixel_sword_palette(w.seed);
                draw_pixel_sword(fb, cam, hand, dir, plane, tip, lay, pal);
                draw_sword_edge_pixels(fb, cam, hand, dir, plane, tip, lay, weapon_edge, time);
            } else {
                let len = base * 0.5;
                let width = 0.8;
                let guard = 0.07;
                let tip = hand + dir * (len * w.len);
                let pommel = hand - dir * 0.1;
                let guard_c = hand + dir * 0.06;
                fb.capsule(p(pommel), p(guard_c), 1.2, w.grip, None);
                fb.disc(p(pommel), 1.1, w.gem, None);
                fb.capsule(p(guard_c - side * guard), p(guard_c + side * guard), 1.0, w.guard, None);
                fb.capsule(p(guard_c), p(tip), width, w.blade, o);
                fb.line(p(guard_c), p(tip), C_TRAIL);
            }
        }
        Weapon::Axe => {
            if let Some(style) = pixel_labrys_style(w.seed) {
                let (head_mul, haft_mul) = if w.seed == BRONZE_AXE_ITEM || w.seed == DECAYED_AXE_ITEM {
                    (1.0, 1.0)
                } else {
                    (1.5, 3.0)
                };
                draw_pixel_labrys_axe(fb, cam, hand, dir, plane, o, head_mul, haft_mul, style);
                if haft_mul > 1.5 {
                    let grip_y = labrys_grip_y(haft_mul);
                    let off_y = labrys_offhand_grip_y(haft_mul);
                    let off = hand + dir * (off_y - grip_y);
                    fb.disc(p(off), t * 0.85, look.body, o);
                }
            } else {
                let top = hand + dir * (0.8 * w.len);
                fb.capsule(p(hand - dir * 0.15), p(top), 1.1, w.grip, o);
                let a = top - dir * 0.05;
                let b = top - dir * 0.3;
                let edge = side * (0.22 * w.len);
                crate::props::tri(fb, p(a), p(b), p(a + edge + dir * 0.05), w.blade);
                crate::props::tri(fb, p(b), p(b + edge - dir * 0.05), p(a + edge + dir * 0.05), w.blade);
                fb.capsule(p(a + edge + dir * 0.05), p(b + edge - dir * 0.05), 0.8, C_TRAIL, None);
            }
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
    }}
    if tool != GatherTool::None || w.kind != Weapon::Knuckles {
        fb.disc(p(hand), t * 0.9, look.body, None);
    }
}

/// The blade leaves the hand at a right angle. The point is the part of up that is not along the forearm.
fn sword_from_hand(forearm: Vec3) -> Vec3 {
    let arm = forearm * (1.0 / forearm.len().max(1e-3));
    let lift = v3(-arm.x * arm.y, 1.0 - arm.y * arm.y, -arm.z * arm.y);
    if lift.len() > 0.25 {
        lift * (1.0 / lift.len())
    } else {
        let flat = v3(arm.z, 0.0, -arm.x);
        if flat.len() > 1e-3 { flat * (1.0 / flat.len()) } else { v3(1.0, 0.0, 0.0) }
    }
}

/// Width of the blade. It runs with the character's front, so a side view shows the flat.
fn blade_across(dir: Vec3, front: Vec3) -> Vec3 {
    let s = front - dir * front.dot(dir);
    if s.len() > 1e-3 {
        s * (1.0 / s.len())
    } else {
        let s = v3(dir.z, 0.0, -dir.x);
        if s.len() > 1e-3 { s * (1.0 / s.len()) } else { v3(1.0, 0.0, 0.0) }
    }
}

fn character_front(j: &Joints) -> Vec3 {
    let right = j.shoulder[1] - j.shoulder[0];
    let f = v3(-right.z, 0.0, right.x);
    if f.len() > 1e-3 { f * (1.0 / f.len()) } else { v3(0.0, 0.0, 1.0) }
}

const SWORD_GRIP: (f32, f32) = (-0.14, 0.04);
const SWORD_GUARD_Y: f32 = 0.08;
const SWORD_GUARD_HALF: f32 = 0.11;
const SWORD_PLATE_HALF: f32 = 0.042;
pub const SWORD_BLADE: (f32, f32) = (0.12, 0.86);
pub const SWORD_BLADE_HALF: f32 = 0.04;
const SWORD_POINT: f32 = 0.74;

#[derive(Clone, Copy, Debug)]
pub struct PixelSwordLayout {
    pub grip: (f32, f32),
    pub guard_y: f32,
    pub guard_half: f32,
    pub plate_half: f32,
    pub blade: (f32, f32),
    pub blade_half: f32,
    pub point: f32,
    pub crossguard: bool,
}

fn layout_1h() -> PixelSwordLayout {
    PixelSwordLayout {
        grip: SWORD_GRIP,
        guard_y: SWORD_GUARD_Y,
        guard_half: SWORD_GUARD_HALF,
        plate_half: SWORD_PLATE_HALF,
        blade: SWORD_BLADE,
        blade_half: SWORD_BLADE_HALF,
        point: SWORD_POINT,
        crossguard: true,
    }
}

/// Short blade, no crossguard or plate (iron dagger).
fn layout_dagger() -> PixelSwordLayout {
    let blade_len = (SWORD_BLADE.1 - SWORD_BLADE.0) * 0.52;
    let blade_start = SWORD_GRIP.1 + 0.02;
    PixelSwordLayout {
        grip: SWORD_GRIP,
        guard_y: SWORD_GUARD_Y,
        guard_half: 0.0,
        plate_half: 0.0,
        blade: (blade_start, blade_start + blade_len),
        blade_half: SWORD_BLADE_HALF * 0.9,
        point: blade_start + blade_len * 0.84,
        crossguard: false,
    }
}

/// 2× blade width, 1.5× blade length and grip length (iron greatsword).
fn layout_great() -> PixelSwordLayout {
    let grip_len = (SWORD_GRIP.1 - SWORD_GRIP.0) * 1.5;
    let blade_len = (SWORD_BLADE.1 - SWORD_BLADE.0) * 1.5;
    PixelSwordLayout {
        grip: (SWORD_GRIP.1 - grip_len, SWORD_GRIP.1),
        guard_y: SWORD_GUARD_Y,
        guard_half: SWORD_GUARD_HALF,
        plate_half: SWORD_PLATE_HALF,
        blade: (SWORD_BLADE.0, SWORD_BLADE.0 + blade_len),
        blade_half: SWORD_BLADE_HALF * 2.0,
        point: SWORD_BLADE.0 + (SWORD_POINT - SWORD_BLADE.0) * 1.5,
        crossguard: true,
    }
}

fn pixel_greatsword_item(seed: u32) -> bool {
    matches!(
        seed,
        IRON_GREATSWORD_ITEM | STEEL_GREATSWORD_ITEM | MYTHRIL_GREATSWORD_ITEM
    )
}

fn pixel_dagger_item(seed: u32) -> bool {
    matches!(
        seed,
        IRON_DAGGER_ITEM
            | NEOLITHIC_DAGGER_ITEM
            | FANG_DAGGER_ITEM
            | BONE_DAGGER_ITEM
    )
}

fn pixel_axe_item(seed: u32) -> bool {
    pixel_labrys_style(seed).is_some()
}

const HAFT_GRIP_FRAC: f32 = 0.38;
const HAFT_OFFHAND_GRIP_FRAC: f32 = 0.72;

fn labrys_haft_lo(haft_len_mul: f32) -> f32 {
    const HAFT_PIVOT: f32 = 0.11;
    const BRONZE_HAFT_LO: f32 = -0.22;
    let haft_len = HAFT_PIVOT - BRONZE_HAFT_LO;
    HAFT_PIVOT - haft_len * haft_len_mul
}

fn labrys_grip_y(haft_len_mul: f32) -> f32 {
    let lo = labrys_haft_lo(haft_len_mul);
    const HAFT_PIVOT: f32 = 0.11;
    lo + (HAFT_PIVOT - lo) * HAFT_GRIP_FRAC
}

fn labrys_offhand_grip_y(haft_len_mul: f32) -> f32 {
    let lo = labrys_haft_lo(haft_len_mul);
    const HAFT_PIVOT: f32 = 0.11;
    lo + (HAFT_PIVOT - lo) * HAFT_OFFHAND_GRIP_FRAC
}

fn pixel_two_hand_grip(lay: &PixelSwordLayout) -> bool {
    let one_h = SWORD_GRIP.1 - SWORD_GRIP.0;
    (lay.grip.1 - lay.grip.0) > one_h * 1.2
}

fn pixel_sword_offhand_grip_y(lay: &PixelSwordLayout) -> f32 {
    let span = lay.grip.1 - lay.grip.0;
    lay.grip.0 + span * 0.30
}

#[derive(Clone, Copy)]
enum LabrysPalette {
    Bronze,
    Decayed,
    IronGreat,
    DarksteelGreat,
    PalaceGreat,
}

fn pixel_labrys_style(seed: u32) -> Option<LabrysPalette> {
    match seed {
        BRONZE_AXE_ITEM => Some(LabrysPalette::Bronze),
        DECAYED_AXE_ITEM => Some(LabrysPalette::Decayed),
        IRON_GREAT_AXE_ITEM => Some(LabrysPalette::IronGreat),
        DARKSTEEL_GREAT_AXE_ITEM => Some(LabrysPalette::DarksteelGreat),
        PALACE_GREAT_AXE_ITEM => Some(LabrysPalette::PalaceGreat),
        _ => None,
    }
}

fn labrys_colors(style: LabrysPalette) -> (u8, u8, u8, u8, u8) {
    match style {
        LabrysPalette::Bronze => (C_GOLD, GEAR_LEATHER_FAR, C_GOLD, C_GOLD, C_OUTLINE),
        LabrysPalette::Decayed => (C_OUTLINE, C_OUTLINE, C_OUTLINE, C_OUTLINE, C_OUTLINE),
        LabrysPalette::IronGreat => (C_STEEL, C_STEEL, C_SHADOW, C_STEEL, C_OUTLINE),
        LabrysPalette::DarksteelGreat => (C_STEEL, C_DUST, C_SHADOW, C_STEEL, C_OUTLINE),
        LabrysPalette::PalaceGreat => (C_GOLD, C_DASH, C_STEEL, C_GOLD, C_OUTLINE),
    }
}

pub fn pixel_sword_layout(w: &WeaponLook) -> Option<PixelSwordLayout> {
    if pixel_dagger_item(w.seed) {
        return Some(layout_dagger());
    }
    match w.kind {
        Weapon::Sword => Some(layout_1h()),
        Weapon::Greatsword if pixel_greatsword_item(w.seed) => Some(layout_great()),
        _ => None,
    }
}

fn iron_dagger() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_iron_dagger.ron")).expect("ba_iron_dagger")
    })
}

fn iron_sword() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_sword.ron")).expect("ba_iron_sword"))
}

fn bronze_sword() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_bronze_sword.ron")).expect("ba_bronze_sword"))
}

struct PixelSwordPalette {
    grip: u8,
    guard: u8,
    blade: u8,
    edge: u8,
    plate: u8,
    fuller: u8,
}

fn pixel_sword_palette(item_id: u32) -> PixelSwordPalette {
    match item_id {
        BRONZE_SWORD_ITEM => PixelSwordPalette {
            grip: crate::palette::GEAR_LEATHER,
            guard: crate::palette::GEAR_LEATHER_FAR,
            blade: GEAR_BRONZE,
            edge: C_GOLD,
            plate: GEAR_BRONZE,
            fuller: C_SHADOW,
        },
        DARKSTEEL_BLADE_ITEM => PixelSwordPalette {
            grip: C_OUTLINE,
            guard: C_OUTLINE,
            blade: C_DUST,
            edge: C_SHADOW,
            plate: C_DUST,
            fuller: C_OUTLINE,
        },
        MYTHRIL_SWORD_ITEM | MYTHRIL_GREATSWORD_ITEM => PixelSwordPalette {
            grip: C_TRAIL,
            guard: C_TRAIL,
            blade: C_DASH,
            edge: crate::palette::WATER,
            plate: C_DASH,
            fuller: C_SHADOW,
        },
        STEEL_GREATSWORD_ITEM => PixelSwordPalette {
            grip: C_SHADOW,
            guard: C_DUST,
            blade: C_STEEL,
            edge: C_SHADOW,
            plate: C_STEEL,
            fuller: C_OUTLINE,
        },
        ORICHALCUM_SWORD_ITEM => PixelSwordPalette {
            grip: C_TRAIL,
            guard: C_TRAIL,
            blade: C_TRAIL,
            edge: C_STEEL,
            plate: C_TRAIL,
            fuller: C_DUST,
        },
        BONE_DAGGER_ITEM => PixelSwordPalette {
            grip: GEAR_BONE,
            guard: GEAR_BONE,
            blade: GEAR_BONE,
            edge: C_DUST,
            plate: GEAR_BONE,
            fuller: C_SHADOW,
        },
        NEOLITHIC_DAGGER_ITEM => PixelSwordPalette {
            grip: GEAR_LEATHER,
            guard: GEAR_LEATHER_FAR,
            blade: ROCK,
            edge: ROCK_D,
            plate: ROCK,
            fuller: C_SHADOW,
        },
        FANG_DAGGER_ITEM => PixelSwordPalette {
            grip: GEAR_LEATHER_FAR,
            guard: GEAR_LEATHER_FAR,
            blade: CR_TUSK,
            edge: C_ACCENT,
            plate: CR_TUSK,
            fuller: C_SHADOW,
        },
        DECAYED_SWORD_ITEM => PixelSwordPalette {
            grip: C_OUTLINE,
            guard: C_OUTLINE,
            blade: C_OUTLINE,
            edge: C_OUTLINE,
            plate: C_OUTLINE,
            fuller: C_OUTLINE,
        },
        _ => PixelSwordPalette {
            grip: C_STEEL,
            guard: C_STEEL,
            blade: C_BODY,
            edge: C_GOLD,
            plate: C_GOLD,
            fuller: C_SHADOW,
        },
    }
}

/// Tip of the mark on the gold plate, then the two base corners. The tip points along the blade.
fn sword_mark() -> [(f32, f32); 3] {
    [
        (0.0, SWORD_GUARD_Y + 0.026),
        (-0.028, SWORD_GUARD_Y - 0.022),
        (0.028, SWORD_GUARD_Y - 0.022),
    ]
}

/// How far along the blade the point is. A planted sword stops at the ground.
fn sword_into_ground(hand: Vec3, dir: Vec3, ground_y: f32, blade_end: f32) -> f32 {
    if dir.y >= -0.2 {
        return blade_end;
    }
    let t = (ground_y - hand.y) / dir.y;
    (t + 0.02).clamp(0.42, blade_end)
}

/// The drawn sword. Grip and guard capsules, plate with a triangle, blade with a dark fuller.
/// `tip_y` is where the point sits along the blade. The full sword uses `SWORD_BLADE.1`.
fn draw_pixel_sword(
    fb: &mut Framebuffer,
    cam: &Camera,
    hand: Vec3,
    dir: Vec3,
    side: Vec3,
    tip_y: f32,
    lay: &PixelSwordLayout,
    pal: PixelSwordPalette,
) {
    let tip_min = if lay.crossguard {
        lay.guard_y + 0.2
    } else {
        lay.grip.1 + 0.02
    };
    let tip = tip_y.clamp(tip_min, lay.blade.1);
    let span = (lay.blade.1 - lay.blade.0).max(1e-3);
    let point = lay.blade.0 + (lay.point - lay.blade.0) * ((tip - lay.blade.0) / span).clamp(0.0, 1.0);
    let at = |x: f32, y: f32| hand + dir * y + side * x;
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for (x, y) in [
        (0.0, lay.grip.0),
        (0.0, tip),
        (-lay.blade_half, lay.blade.0),
        (lay.blade_half, tip),
    ] {
        include_px(&mut bounds, cam.project(at(x, y)), 3.0);
    }
    if lay.crossguard {
        for (x, y) in [(-lay.guard_half, lay.guard_y), (lay.guard_half, lay.guard_y)] {
            include_px(&mut bounds, cam.project(at(x, y)), 3.0);
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
    let p = |x: f32, y: f32| cam.project(at(x, y));
    fb.capsule(p(0.0, lay.grip.0), p(0.0, lay.grip.1), 2.0, pal.grip, None);
    if lay.crossguard {
        fb.capsule(
            p(-lay.guard_half, lay.guard_y),
            p(lay.guard_half, lay.guard_y),
            1.6,
            pal.guard,
            None,
        );
    }
    sword_quad(fb, p, -lay.blade_half, lay.blade.0, lay.blade_half, point, pal.blade);
    paint_solid_tri(
        fb,
        p(-lay.blade_half, point),
        p(lay.blade_half, point),
        p(0.0, tip),
        pal.blade,
        -0.2,
    );
    fb.line(p(-lay.blade_half, lay.blade.0), p(-lay.blade_half, point), pal.edge);
    fb.line(p(-lay.blade_half, point), p(0.0, tip), pal.edge);
    fb.line(p(lay.blade_half, lay.blade.0), p(lay.blade_half, point), pal.edge);
    fb.line(p(lay.blade_half, point), p(0.0, tip), pal.edge);
    fb.line(
        p(0.0, lay.blade.0 + 0.04),
        p(0.0, (point - 0.02).max(lay.blade.0 + 0.05)),
        pal.fuller,
    );
    if lay.crossguard {
        sword_quad(
            fb,
            p,
            -lay.plate_half,
            lay.guard_y - 0.034,
            lay.plate_half,
            lay.guard_y + 0.034,
            pal.plate,
        );
        let mark = sword_mark();
        fb.line(p(mark[0].0, mark[0].1), p(mark[1].0, mark[1].1), C_OUTLINE);
        fb.line(p(mark[1].0, mark[1].1), p(mark[2].0, mark[2].1), C_OUTLINE);
        fb.line(p(mark[2].0, mark[2].1), p(mark[0].0, mark[0].1), C_OUTLINE);
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

/// Double-bit labrys on the hand plane (+y along the haft). Geometry matches pixel-axe.ts.
fn draw_pixel_labrys_axe(
    fb: &mut Framebuffer,
    cam: &Camera,
    hand: Vec3,
    dir: Vec3,
    side: Vec3,
    o: Option<u8>,
    head_mul: f32,
    haft_len_mul: f32,
    palette: LabrysPalette,
) {
    let (haft, head, edge, socket, outline) = labrys_colors(palette);
    const HAFT_PIVOT: f32 = 0.11;
    let grip_y = labrys_grip_y(haft_len_mul);
    let haft_lo = labrys_haft_lo(haft_len_mul);
    let sx = |x: f32| x * head_mul;
    let sy = |y: f32| HAFT_PIVOT + (y - HAFT_PIVOT) * head_mul;
    let p = |x: f32, y: f32| cam.project(hand + dir * (y - grip_y) + side * x);
    const BASE_SOCKET_X: f32 = 0.09;
    const BASE_SOCKET_Y0: f32 = 0.12;
    const BASE_SOCKET_Y1: f32 = 0.26;
    const BASE_SOCKET_INNER_HALF: f32 = 0.062;
    const BASE_WING_BOTTOM_Y: f32 = 0.028;
    const BASE_WING_X_TOP: f32 = 0.345;
    const BASE_WING_BOTTOM_REACH: f32 = 0.85;
    const BASE_WING_X_BOT: f32 = 0.322;
    const BASE_WING_OUT_X: f32 = 0.356;
    const BASE_WING_OUT_FLARE: f32 = 0.022;
    const BASE_WING_CHEV_X: f32 = 0.386;
    const BASE_WING_OUT_Y1: f32 = 0.212;
    const BASE_CAP_Y1: f32 = 0.286;
    const BASE_CAP_HALF: f32 = 0.06;
    let socket_x = sx(BASE_SOCKET_X);
    let socket_y0 = sy(BASE_SOCKET_Y0);
    let socket_y1 = sy(BASE_SOCKET_Y1);
    let socket_cy = (socket_y0 + socket_y1) * 0.5;
    let socket_inner = sx(BASE_SOCKET_INNER_HALF);
    let wing_bottom_y = sy(BASE_WING_BOTTOM_Y);
    let wing_y1 = socket_y1;
    let wing_bottom_x = |x: f32| socket_x + (sx(x) - socket_x) * BASE_WING_BOTTOM_REACH;
    let wing_x_bot = wing_bottom_x(BASE_WING_X_BOT);
    let wing_out_x_mid = sx(BASE_WING_OUT_X) + sx(BASE_WING_OUT_FLARE);
    let wing_out_x_bot = wing_bottom_x(BASE_WING_OUT_X) + sx(BASE_WING_OUT_FLARE);
    let wing_chev_x = sx(BASE_WING_CHEV_X);
    let wing_chev_y = sy((BASE_SOCKET_Y1 + BASE_WING_BOTTOM_Y) * 0.52);
    let wing_out_y1 = sy(BASE_WING_OUT_Y1);
    let cap_y1 = sy(BASE_CAP_Y1);
    let cap_half = sx(BASE_CAP_HALF);
    let wing_edge_r = 1.85 * head_mul;
    const HAFT_CAPSULE_R: f32 = 1.55;
    let haft_thick = HAFT_CAPSULE_R * haft_len_mul.sqrt();
    let pommel_half = sx(0.024);
    let pommel_rise = 0.034 * haft_len_mul.sqrt();

    fb.capsule(p(0.0, haft_lo), p(0.0, HAFT_PIVOT), haft_thick, haft, o);
    paint_solid_tri(
        fb,
        p(0.0, haft_lo),
        p(-pommel_half, haft_lo + pommel_rise),
        p(pommel_half, haft_lo + pommel_rise),
        haft,
        -0.1,
    );

    sword_quad(fb, p, -socket_x, socket_y0, socket_x, socket_y1, socket);
    sword_quad(
        fb,
        p,
        -socket_inner,
        socket_cy - socket_inner,
        socket_inner,
        socket_cy + socket_inner,
        outline,
    );

    let wing = |fb: &mut Framebuffer, sx_sign: f32| {
        let x = |v: f32| sx_sign * v.abs();
        let xa = x(socket_x);
        let pts = [
            p(xa, wing_bottom_y),
            p(xa, wing_y1),
            p(x(sx(BASE_WING_X_TOP)), wing_y1),
            p(x(wing_out_x_mid), wing_out_y1),
            p(x(wing_chev_x), wing_chev_y),
            p(x(wing_out_x_bot), wing_bottom_y),
            p(x(wing_x_bot), wing_bottom_y),
        ];
        for i in 1..pts.len() - 1 {
            paint_solid_tri(fb, pts[0], pts[i], pts[i + 1], head, -0.15);
        }
        for i in 3..pts.len() {
            fb.capsule(pts[i - 1], pts[i], wing_edge_r, edge, o);
        }
        fb.capsule(*pts.last().unwrap(), pts[0], wing_edge_r, edge, o);
    };
    wing(fb, -1.0);
    wing(fb, 1.0);

    sword_quad(fb, p, -cap_half, socket_y1, cap_half, cap_y1, socket);

    fb.line(p(-socket_x, socket_y0), p(socket_x, socket_y0), edge);
    fb.line(p(-socket_x, socket_y0), p(-socket_x, socket_y1), edge);
    fb.line(p(socket_x, socket_y0), p(socket_x, socket_y1), edge);
}

fn forge_hash(x: f32, y: f32, t: f32) -> f32 {
    let s = (x * 12.9898 + y * 78.233 + t * 0.017).sin() * 43758.547;
    s - s.floor()
}

fn sword_blade_half_at(y: f32, point: f32, tip: f32, blade_half: f32) -> f32 {
    if y <= point {
        blade_half
    } else {
        let span = (tip - point).max(1e-3);
        blade_half * (1.0 - (y - point) / span).clamp(0.0, 1.0)
    }
}

/// Boot-menu-style heat blots along the blade (normalized u along edge, v across).
struct SwordBlot {
    u: f32,
    v: f32,
    ru: f32,
    rv: f32,
    c: u8,
    w: f32,
}

fn sword_blot_weight(b: &SwordBlot, u: f32, v: f32) -> f32 {
    let du = (u - b.u) / b.ru;
    let dv = (v - b.v) / b.rv;
    let d2 = du * du + dv * dv;
    if d2 >= 1.0 {
        return 0.0;
    }
    let t = 1.0 - d2;
    b.w * t * t
}

fn sword_forge_sample(u: f32, v: f32, blots: &[SwordBlot]) -> (u8, f32) {
    let mut best = (crate::palette::COAL, 0.0f32);
    let mut second = (crate::palette::COAL, 0.0f32);
    for b in blots {
        let w = sword_blot_weight(b, u, v);
        if w > best.1 {
            second = best;
            best = (b.c, w);
        } else if w > second.1 {
            second = (b.c, w);
        }
    }
    if second.1 > best.1 * 0.38 && second.0 != best.0 && forge_hash(u * 90.0, v * 70.0, 0.0) > 0.42 {
        (second.0, second.1)
    } else {
        (best.0, best.1)
    }
}

fn sword_forge_brighten(base: u8, px: f32, py: f32, t: f32, hi: u8) -> u8 {
    if base == hi {
        return hi;
    }
    if base == crate::palette::COAL && forge_hash(px * 0.7, py * 0.9, t) > 0.42 {
        return hi;
    }
    base
}

/// Blade frame shared by iron sword draw, edge pixels, and forge embers.
pub struct SwordBladeFrame {
    pub hand: Vec3,
    pub dir: Vec3,
    pub plane: Vec3,
    pub tip_y: f32,
}

#[inline]
pub fn sword_blade_at(f: &SwordBladeFrame, x: f32, y: f32) -> Vec3 {
    f.hand + f.dir * y + f.plane * x
}

/// Same axes as `draw_pixel_sword` (carry pose uses `sword_from_hand`, not raw `sword_dir`).
pub fn sword_blade_frame(
    j: &Joints,
    ground_y: f32,
    planted: bool,
    swinging: bool,
    pixel_sword_carry: bool,
    lay: Option<&PixelSwordLayout>,
) -> SwordBladeFrame {
    let hand = j.hand[1];
    let along = j.sword_dir * (1.0 / j.sword_dir.len().max(1e-3));
    let dir = if planted {
        along
    } else if pixel_sword_carry && !swinging {
        sword_from_hand(hand - j.elbow[1])
    } else {
        along
    };
    let plane = blade_across(dir, character_front(j));
    let blade_end = lay.map(|l| l.blade.1).unwrap_or(SWORD_BLADE.1);
    let tip_y = if planted {
        sword_into_ground(hand, dir, ground_y, blade_end)
    } else {
        blade_end
    };
    SwordBladeFrame { hand, dir, plane, tip_y }
}

/// World points for rising forge embers while Cinder Edge (fire) is active.
pub fn sword_forge_particle_sources(f: &SwordBladeFrame, blade_half: f32, blade_start: f32) -> [Vec3; 4] {
    let tip = f.tip_y;
    [
        sword_blade_at(f, 0.0, tip),
        sword_blade_at(f, blade_half * 0.55, tip * 0.88),
        sword_blade_at(f, 0.0, (blade_start + tip) * 0.55),
        sword_blade_at(f, 0.0, SWORD_GUARD_Y + 0.18),
    ]
}

/// Forge-style pixel heat on the blade + screen-space rising motes (boot menu drift).
fn draw_sword_edge_pixels(
    fb: &mut Framebuffer,
    cam: &Camera,
    hand: Vec3,
    dir: Vec3,
    side: Vec3,
    tip_y: f32,
    lay: &PixelSwordLayout,
    edge: u8,
    t: f32,
) {
    if edge == 0 {
        return;
    }
    let tip_min = if lay.crossguard {
        lay.guard_y + 0.2
    } else {
        lay.grip.1 + 0.02
    };
    let tip = tip_y.clamp(tip_min, lay.blade.1);
    let span = (lay.blade.1 - lay.blade.0).max(1e-3);
    let point = lay.blade.0 + (lay.point - lay.blade.0) * ((tip - lay.blade.0) / span).clamp(0.0, 1.0);
    let at = |x: f32, y: f32| hand + dir * y + side * x;
    let (hi, mid, spark) = match edge {
        2 => (crate::palette::BANK_L, crate::palette::WATER, crate::palette::FX_CAST),
        3 => (crate::palette::FX_LEVEL, crate::palette::FX_CAST, crate::palette::FX_RING_SELF),
        _ => (crate::palette::EMBER, crate::palette::COAL, crate::palette::FX_TELL),
    };
    let fire_blots: &[SwordBlot] = &[
        SwordBlot { u: 0.08, v: 0.0, ru: 0.20, rv: 1.05, c: mid, w: 1.35 },
        SwordBlot { u: 0.18, v: -0.42, ru: 0.18, rv: 0.62, c: hi, w: 1.45 },
        SwordBlot { u: 0.18, v: 0.42, ru: 0.18, rv: 0.62, c: hi, w: 1.45 },
        SwordBlot { u: 0.30, v: 0.0, ru: 0.26, rv: 1.08, c: hi, w: 1.65 },
        SwordBlot { u: 0.44, v: 0.0, ru: 0.24, rv: 1.05, c: hi, w: 1.55 },
        SwordBlot { u: 0.52, v: -0.28, ru: 0.16, rv: 0.55, c: hi, w: 1.35 },
        SwordBlot { u: 0.52, v: 0.28, ru: 0.16, rv: 0.55, c: hi, w: 1.35 },
        SwordBlot { u: 0.62, v: 0.0, ru: 0.22, rv: 0.95, c: mid, w: 1.4 },
        SwordBlot { u: 0.74, v: 0.0, ru: 0.18, rv: 0.72, c: hi, w: 1.5 },
        SwordBlot { u: 0.86, v: -0.18, ru: 0.14, rv: 0.48, c: hi, w: 1.35 },
        SwordBlot { u: 0.86, v: 0.18, ru: 0.14, rv: 0.48, c: hi, w: 1.35 },
        SwordBlot { u: 0.94, v: 0.0, ru: 0.12, rv: 0.48, c: spark, w: 1.35 },
        SwordBlot { u: 0.38, v: 0.0, ru: 0.10, rv: 0.35, c: spark, w: 1.2 },
    ];
    let ice_blots: &[SwordBlot] = &[
        SwordBlot { u: 0.35, v: 0.0, ru: 0.28, rv: 1.0, c: mid, w: 1.2 },
        SwordBlot { u: 0.62, v: 0.0, ru: 0.22, rv: 0.75, c: hi, w: 1.0 },
        SwordBlot { u: 0.85, v: 0.0, ru: 0.12, rv: 0.45, c: spark, w: 0.9 },
    ];
    let blots = match edge {
        2 | 3 => ice_blots,
        _ => fire_blots,
    };
    let blade_len = (tip - lay.blade.0).max(1e-3);
    let fire = edge == 1;
    let step_y = if fire { 0.0035 } else { 0.006 };
    let steps_y = (blade_len / step_y).clamp(if fire { 80.0 } else { 55.0 }, if fire { 200.0 } else { 140.0 }) as i32;
    let flick = if fire {
        1.0 + 0.14 * (t * 8.0).sin() + 0.09 * (t * 4.7).sin()
    } else {
        1.0 + 0.08 * (t * 8.0).sin() + 0.05 * (t * 4.7).sin()
    };
    let depth = if fire { -0.44 } else { -0.38 };
    let steps_x = if fire { 13 } else { 9 };
    let skip_wt = if fire { 0.025 } else { 0.06 };
    let skip_hash = if fire { 0.52 } else { 0.32 };
    let spark_cut = if fire { 0.72 } else { 0.88 };
    for iy in 0..steps_y {
        let u_lin = iy as f32 / (steps_y - 1).max(1) as f32;
        let y = lay.blade.0 + blade_len * u_lin;
        let half = sword_blade_half_at(y, point, tip, lay.blade_half);
        let u_norm = u_lin;
        for ix in 0..steps_x {
            let v_lin = (ix as f32 / (steps_x - 1) as f32) * 2.0 - 1.0;
            let x = half * v_lin;
            if x.abs() > half + 1e-4 {
                continue;
            }
            let (base, wt) = sword_forge_sample(u_norm, v_lin, blots);
            if wt * flick < skip_wt && forge_hash(u_norm * 120.0 + v_lin * 40.0, t, 2.0) > skip_hash {
                continue;
            }
            let col = sword_forge_brighten(base, u_norm * 80.0, v_lin * 50.0, t, hi);
            let col = if forge_hash(u_norm, v_lin, t + 5.0) > spark_cut {
                spark
            } else if fire && base == mid && forge_hash(u_norm + 2.0, v_lin, t) > 0.55 {
                hi
            } else {
                col
            };
            let wobble = (t * 9.0 + u_norm * 14.0).sin() * if fire { 0.006 } else { 0.008 };
            let p2 = cam.project(at(x + wobble * v_lin, y));
            fb.plot(p2.x as i32, p2.y as i32, depth, col);
            if fire && (wt > 0.2 || col == hi || col == spark) {
                fb.plot(p2.x as i32 + 1, p2.y as i32, depth - 0.01, col);
                if forge_hash(u_norm, v_lin, t + 1.0) > 0.62 {
                    fb.plot(p2.x as i32, p2.y as i32 + 1, depth - 0.01, if col == mid { hi } else { col });
                }
            } else if wt > 0.45 && forge_hash(u_norm + t, v_lin, 1.0) > 0.78 {
                fb.plot(p2.x as i32 + 1, p2.y as i32, depth - 0.01, spark);
            }
        }
    }
    // Crawling heat veins on the flat of the blade (fire only — not rising embers).
    if fire {
        let time = t * 0.85;
        for i in 0..48 {
            let s = i as f32;
            let u_norm = 0.05 + (s / 47.0) * 0.92;
            let y = lay.blade.0 + blade_len * u_norm;
            let half = sword_blade_half_at(y, point, tip, lay.blade_half);
            let v_lin = (forge_hash(s, 0.0, 0.0) * 2.0 - 1.0) * 0.92;
            let x = half * v_lin;
            let pulse = 0.5 + 0.5 * (time * 5.0 + s * 0.35).sin();
            if pulse < 0.35 {
                continue;
            }
            let col = if forge_hash(s, time, x) > 0.38 { hi } else { mid };
            let p2 = cam.project(at(x, y));
            fb.plot(p2.x as i32, p2.y as i32, depth - 0.02, col);
            if pulse > 0.72 {
                fb.plot(p2.x as i32 + 1, p2.y as i32, depth - 0.03, spark);
            }
        }
    }
}

fn sword_quad(
    fb: &mut Framebuffer,
    p: impl Fn(f32, f32) -> stick_engine::camera::P2,
    x0: f32,
    y0: f32,
    x1: f32,
    y1: f32,
    color: u8,
) {
    paint_solid_tri(fb, p(x0, y0), p(x1, y0), p(x1, y1), color, -0.2);
    paint_solid_tri(fb, p(x0, y0), p(x1, y1), p(x0, y1), color, -0.2);
}

const SHOVEL_SHAFT: (f32, f32) = (-0.16, 0.56);
const SHOVEL_SOCKET: f32 = 0.045;
const SHOVEL_MOUTH: f32 = 0.16;
const SHOVEL_BLADE: (f32, f32) = (0.54, 0.88);

const PICK_SHAFT: (f32, f32) = (-0.16, 0.62);
const PICK_EYE: (f32, f32) = (0.56, 0.72);
const PICK_POINT: (f32, f32) = (-0.32, 0.66);
const PICK_CHISEL: (f32, f32) = (0.18, 0.64);

fn iron_shovel() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_shovel.ron")).expect("ba_iron_shovel"))
}

fn iron_pickaxe() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_pickaxe.ron")).expect("ba_iron_pickaxe"))
}

fn craft_hammer() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_craft_hammer.ron")).expect("ba_craft_hammer"))
}

fn leather_workpiece() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_leather_workpiece.ron")).expect("ba_leather_workpiece")
    })
}

fn black_anvil() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_black_anvil.ron")).expect("ba_black_anvil"))
}

fn goldsmith_stake() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_goldsmith_stake.ron")).expect("ba_goldsmith_stake")
    })
}

fn goldsmith_ramp(slot: ColorSlot) -> u8 {
    use crate::palette::WOOD;
    match slot {
        ColorSlot::Trim => C_GOLD,
        ColorSlot::Glow => WOOD,
        _ => C_OUTLINE,
    }
}

fn cook_pot() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_cook_pot.ron")).expect("ba_cook_pot"))
}

fn cook_pot_ramp(slot: ColorSlot) -> u8 {
    use crate::palette::{EMBER, ROCK_D, STEW, WOOD};
    match slot {
        ColorSlot::Material => C_OUTLINE,
        ColorSlot::Accent => STEW,
        ColorSlot::Trim => EMBER,
        ColorSlot::Glow => WOOD,
        ColorSlot::Outline => ROCK_D,
        _ => C_OUTLINE,
    }
}

#[cfg(test)]
fn wood_spoon() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_wood_spoon.ron")).expect("ba_wood_spoon"))
}

fn hammer_ramp(slot: ColorSlot) -> u8 {
    match slot {
        ColorSlot::Trim => C_HILT,
        ColorSlot::Accent => C_STEEL,
        _ => C_STEEL,
    }
}

fn leather_ramp(slot: ColorSlot) -> u8 {
    match slot {
        ColorSlot::Trim => C_GOLD,
        ColorSlot::Accent => crate::palette::GEAR_LEATHER_FAR,
        _ => crate::palette::GEAR_LEATHER,
    }
}

fn fig_hand_frame(fig: &Fig, right: bool) -> (Vec3, Vec3, Vec3, Vec3) {
    let o = if right { fig.hand[1] } else { fig.hand[0] };
    let mut y = if right { fig.sword_dir } else { fig.wpn_l };
    if y.len() < 1e-3 {
        y = v3(0.0, 1.0, 0.0);
    } else {
        y = y * (1.0 / y.len());
    }
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    (o, x, y, z)
}

fn draw_gear_in_frame(
    fb: &mut Framebuffer,
    cam: &Camera,
    j: &Joints,
    frame: (Vec3, Vec3, Vec3, Vec3),
    g: &GearDef,
    tint: fn(ColorSlot) -> u8,
) {
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
                include_px(&mut bounds, cam.project(disc_at(j, &frame, at, *center)), r * HEIGHT_PX);
            }
        }
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let snap = tool_snap(fb, x0, y0, x1, y1);
    for sh in &g.shapes {
        match sh {
            Shape::Line { from, to, ramp, .. } => {
                fb.line(cam.project(local(&frame, *from)), cam.project(local(&frame, *to)), tint(*ramp));
            }
            Shape::Capsule { from, to, ramp, thick } => {
                let (a, b) = (cam.project(local(&frame, *from)), cam.project(local(&frame, *to)));
                fb.capsule(a, b, *thick, tint(*ramp), None);
            }
            Shape::Disc { at, center, r, ramp } => {
                fb.disc(cam.project(disc_at(j, &frame, at, *center)), r * HEIGHT_PX, tint(*ramp), None);
            }
        }
    }
    if let Some((_bw, before)) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

/// World-placed bench props (cauldron, anvil). Outlines only — no silhouette merge.
fn draw_world_gear_in_frame(
    fb: &mut Framebuffer,
    cam: &Camera,
    frame: (Vec3, Vec3, Vec3, Vec3),
    g: &GearDef,
    tint: fn(ColorSlot) -> u8,
) {
    let ol = Some(C_OUTLINE);
    for sh in &g.shapes {
        match sh {
            Shape::Line { from, to, ramp, .. } => {
                fb.line(cam.project(local(&frame, *from)), cam.project(local(&frame, *to)), tint(*ramp));
            }
            Shape::Capsule { from, to, ramp, thick } => {
                let (a, b) = (cam.project(local(&frame, *from)), cam.project(local(&frame, *to)));
                fb.capsule(a, b, *thick, tint(*ramp), ol);
            }
            Shape::Disc { .. } => {}
        }
    }
}

fn draw_gear_shapes(
    fb: &mut Framebuffer,
    cam: &Camera,
    j: &Joints,
    g: &GearDef,
    tint: fn(ColorSlot) -> u8,
) {
    use stick_engine::rig::Joint;
    let right = matches!(g.attach, Joint::RHand);
    draw_gear_in_frame(fb, cam, j, fig_hand_frame(j, right), g, tint);
}

fn anvil_world_frame(j: &Joints, ground_y: f32) -> (Vec3, Vec3, Vec3, Vec3) {
    let fwd = character_front(j);
    let mut fwd_h = v3(fwd.x, 0.0, fwd.z);
    if fwd_h.len() < 1e-3 {
        fwd_h = v3(0.0, 0.0, 1.0);
    } else {
        fwd_h = fwd_h * (1.0 / fwd_h.len());
    }
    let right = v3(fwd_h.z, 0.0, -fwd_h.x);
    let up = Vec3::UP;
    let origin = v3(
        j.pelvis.x + fwd_h.x * 0.58,
        ground_y + 0.02,
        j.pelvis.z + fwd_h.z * 0.58,
    );
    (origin, right, up, fwd_h)
}

fn anvil_ramp(slot: ColorSlot) -> u8 {
    match slot {
        ColorSlot::Trim => C_GOLD,
        _ => C_OUTLINE,
    }
}

fn draw_leathercraft_props(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    draw_gear_shapes(fb, cam, j, leather_workpiece(), leather_ramp);
    draw_gear_shapes(fb, cam, j, craft_hammer(), hammer_ramp);
}

fn draw_smithing_props(fb: &mut Framebuffer, cam: &Camera, j: &Joints, ground_y: f32) {
    let frame = anvil_world_frame(j, ground_y);
    draw_gear_in_frame(fb, cam, j, frame, black_anvil(), anvil_ramp);
    draw_gear_shapes(fb, cam, j, craft_hammer(), hammer_ramp);
}

fn cook_pot_world_frame(j: &Joints, ground_y: f32) -> (Vec3, Vec3, Vec3, Vec3) {
    let (origin, right, up, fwd) = anvil_world_frame(j, ground_y);
    (origin + fwd * 0.12, right, up, fwd)
}

fn draw_cooking_stir_spoon(
    fb: &mut Framebuffer,
    cam: &Camera,
    j: &Joints,
    frame: (Vec3, Vec3, Vec3, Vec3),
) {
    let tip_w = local(&frame, (0.0, 0.23, 0.06));
    let tip = cam.project(tip_w);
    let hand_w = j.hand[1];
    let mut dir = hand_w - tip_w;
    let len = dir.len();
    if len < 1e-3 {
        return;
    }
    dir = dir * (1.0 / len);
    let handle_m = 0.09f32.min(len * 0.28);
    let grip_w = tip_w + dir * handle_m;
    let grip = cam.project(grip_w);
    fb.capsule(grip, tip, 0.55, crate::palette::WOOD_L, None);
    fb.disc(tip, 0.45, C_HILT, None);
}

fn draw_cooking_props(fb: &mut Framebuffer, cam: &Camera, j: &Joints, ground_y: f32) {
    let frame = cook_pot_world_frame(j, ground_y);
    draw_world_gear_in_frame(fb, cam, frame, cook_pot(), cook_pot_ramp);
    draw_cooking_stir_spoon(fb, cam, j, frame);
}

fn draw_goldsmithing_props(fb: &mut Framebuffer, cam: &Camera, j: &Joints, ground_y: f32) {
    let frame = anvil_world_frame(j, ground_y);
    draw_world_gear_in_frame(fb, cam, frame, goldsmith_stake(), goldsmith_ramp);
    draw_gear_shapes(fb, cam, j, craft_hammer(), hammer_ramp);
}

/// Bench leathercraft: planted feet, left hand holds the workpiece, right hammers it.
pub fn leathercraft_arm(pose: &mut stick_engine::anim::Pose, t: f32) {
    use stick_engine::anim::Ch;
    let cycle = LEATHERCRAFT_SEC / LEATHERCRAFT_STRIKES;
    let u = (t / cycle).rem_euclid(1.0);
    let strike = 0.5 * (1.0 - (u * std::f32::consts::TAU).cos());
    let s = strike * strike * (3.0 - 2.0 * strike);

    // Stand still at the bench — no gait bleed-through.
    pose.set(Ch::LHip, 0.0);
    pose.set(Ch::LKnee, 0.0);
    pose.set(Ch::RHip, 0.0);
    pose.set(Ch::RKnee, 0.0);
    pose.set(Ch::Twist, 0.0);
    pose.set(Ch::Bob, 0.0);
    pose.set(Ch::Lean, 16.0);
    pose.set(Ch::Head, 8.0);

    // Left: steady support hand, leather held in front of the chest.
    pose.set(Ch::LShoulder, 62.0);
    pose.set(Ch::LElbow, 82.0);
    pose.set(Ch::LArmOut, -10.0);
    pose.set(Ch::LWpnYaw, 10.0);
    pose.set(Ch::LWpnPitch, -28.0);

    // Right: raise the hammer, then drive it down onto the leather.
    let r_shoulder = 132.0 + (50.0 - 132.0) * s;
    let r_elbow = 72.0 + (22.0 - 72.0) * s;
    pose.set(Ch::RShoulder, r_shoulder);
    pose.set(Ch::RElbow, r_elbow);
    pose.set(Ch::RArmOut, 2.0);
    pose.set(Ch::RWpnYaw, -18.0);
    let r_pitch_windup = r_shoulder + r_elbow - 115.0;
    let r_pitch_strike = r_shoulder + r_elbow - 72.0;
    pose.set(Ch::RWpnPitch, r_pitch_windup + (r_pitch_strike - r_pitch_windup) * s);
}

/// One bench-craft pulse per strike cycle (peak at u = 0.5).
fn bench_craft_strike_impact(t: f32, prev_t: f32) -> bool {
    if t <= prev_t || prev_t < 0.0 {
        return false;
    }
    let cycle = LEATHERCRAFT_SEC / LEATHERCRAFT_STRIKES;
    let phase = |x: f32| (x / cycle).rem_euclid(1.0);
    phase(prev_t) < 0.5 && phase(t) >= 0.5
}

/// One hammer impact per smithing strike cycle.
pub fn smithing_strike_impact(t: f32, prev_t: f32) -> bool {
    bench_craft_strike_impact(t, prev_t)
}

/// One stir pulse per cooking strike cycle.
pub fn cooking_strike_impact(t: f32, prev_t: f32) -> bool {
    bench_craft_strike_impact(t, prev_t)
}

/// One tap per goldsmithing strike cycle.
pub fn goldsmith_strike_impact(t: f32, prev_t: f32) -> bool {
    bench_craft_strike_impact(t, prev_t)
}

/// World point on the anvil face where the hammer lands.
pub fn smithing_anvil_strike_world(j: &Joints, ground_y: f32) -> Vec3 {
    let frame = anvil_world_frame(j, ground_y);
    local(&frame, (0.04, 0.185, 0.0))
}

/// Horn stake tip where the jeweler's hammer taps.
pub fn goldsmith_stake_strike_world(j: &Joints, ground_y: f32) -> Vec3 {
    let frame = anvil_world_frame(j, ground_y);
    local(&frame, (0.08, 0.145, 0.035))
}

/// Steam / ember origin above the cook pot.
pub fn cooking_pot_strike_world(j: &Joints, ground_y: f32) -> Vec3 {
    let frame = cook_pot_world_frame(j, ground_y);
    local(&frame, (0.0, 0.22, 0.07))
}

/// Ember bed under the cauldron (continuous fire read while channeling).
pub fn cooking_fire_world(j: &Joints, ground_y: f32) -> Vec3 {
    let frame = cook_pot_world_frame(j, ground_y);
    local(&frame, (0.0, 0.07, 0.06))
}

/// Smithing: anvil in front, right hand strikes the face three times.
pub fn smithing_arm(pose: &mut stick_engine::anim::Pose, t: f32) {
    use stick_engine::anim::Ch;
    let cycle = LEATHERCRAFT_SEC / LEATHERCRAFT_STRIKES;
    let u = (t / cycle).rem_euclid(1.0);
    let strike = 0.5 * (1.0 - (u * std::f32::consts::TAU).cos());
    let s = strike * strike * (3.0 - 2.0 * strike);

    pose.set(Ch::LHip, 0.0);
    pose.set(Ch::LKnee, 0.0);
    pose.set(Ch::RHip, 0.0);
    pose.set(Ch::RKnee, 0.0);
    pose.set(Ch::Twist, 0.0);
    pose.set(Ch::Bob, 0.0);
    pose.set(Ch::Lean, 14.0);
    pose.set(Ch::Head, 6.0);

    // Left hand rests on the hip while the right works the hammer.
    pose.set(Ch::LShoulder, 18.0);
    pose.set(Ch::LElbow, 22.0);
    pose.set(Ch::LArmOut, -6.0);
    pose.set(Ch::LWpnYaw, 0.0);
    pose.set(Ch::LWpnPitch, 0.0);

    let r_shoulder = 128.0 + (46.0 - 128.0) * s;
    let r_elbow = 68.0 + (18.0 - 68.0) * s;
    pose.set(Ch::RShoulder, r_shoulder);
    pose.set(Ch::RElbow, r_elbow);
    pose.set(Ch::RArmOut, 4.0);
    pose.set(Ch::RWpnYaw, -8.0);
    let r_pitch_windup = r_shoulder + r_elbow - 118.0;
    let r_pitch_strike = r_shoulder + r_elbow - 68.0;
    pose.set(Ch::RWpnPitch, r_pitch_windup + (r_pitch_strike - r_pitch_windup) * s);
}

/// Goldsmithing: stake in front, left steadies the bench, right taps three times.
pub fn goldsmith_arm(pose: &mut stick_engine::anim::Pose, t: f32) {
    use stick_engine::anim::Ch;
    let cycle = LEATHERCRAFT_SEC / LEATHERCRAFT_STRIKES;
    let u = (t / cycle).rem_euclid(1.0);
    let strike = 0.5 * (1.0 - (u * std::f32::consts::TAU).cos());
    let s = strike * strike * (3.0 - 2.0 * strike);

    pose.set(Ch::LHip, 0.0);
    pose.set(Ch::LKnee, 0.0);
    pose.set(Ch::RHip, 0.0);
    pose.set(Ch::RKnee, 0.0);
    pose.set(Ch::Twist, 0.0);
    pose.set(Ch::Bob, 0.0);
    pose.set(Ch::Lean, 16.0);
    pose.set(Ch::Head, 8.0);

    pose.set(Ch::LShoulder, 52.0);
    pose.set(Ch::LElbow, 78.0);
    pose.set(Ch::LArmOut, -8.0);
    pose.set(Ch::LWpnYaw, 12.0);
    pose.set(Ch::LWpnPitch, -38.0);

    let r_shoulder = 118.0 + (58.0 - 118.0) * s;
    let r_elbow = 62.0 + (28.0 - 62.0) * s;
    pose.set(Ch::RShoulder, r_shoulder);
    pose.set(Ch::RElbow, r_elbow);
    pose.set(Ch::RArmOut, 6.0);
    pose.set(Ch::RWpnYaw, -10.0);
    let r_pitch_windup = r_shoulder + r_elbow - 112.0;
    let r_pitch_strike = r_shoulder + r_elbow - 74.0;
    pose.set(Ch::RWpnPitch, r_pitch_windup + (r_pitch_strike - r_pitch_windup) * s);
}

/// Cooking: cauldron in front, left steadies the rim, right stirs three times.
pub fn cooking_arm(pose: &mut stick_engine::anim::Pose, t: f32) {
    use stick_engine::anim::Ch;
    let cycle = LEATHERCRAFT_SEC / LEATHERCRAFT_STRIKES;
    let u = (t / cycle).rem_euclid(1.0);
    let strike = 0.5 * (1.0 - (u * std::f32::consts::TAU).cos());
    let s = strike * strike * (3.0 - 2.0 * strike);

    pose.set(Ch::LHip, 0.0);
    pose.set(Ch::LKnee, 0.0);
    pose.set(Ch::RHip, 0.0);
    pose.set(Ch::RKnee, 0.0);
    pose.set(Ch::Twist, 0.0);
    pose.set(Ch::Bob, 0.0);
    pose.set(Ch::Lean, 24.0);
    pose.set(Ch::Head, 12.0);

    pose.set(Ch::LShoulder, 58.0);
    pose.set(Ch::LElbow, 86.0);
    pose.set(Ch::LArmOut, -2.0);
    pose.set(Ch::LWpnYaw, 4.0);
    pose.set(Ch::LWpnPitch, -82.0);

    let r_shoulder = 62.0 + (48.0 - 62.0) * s;
    let r_elbow = 78.0 + (66.0 - 78.0) * s;
    pose.set(Ch::RShoulder, r_shoulder);
    pose.set(Ch::RElbow, r_elbow);
    pose.set(Ch::RArmOut, 4.0);
    pose.set(Ch::RWpnYaw, -4.0);
    let r_pitch_high = r_shoulder + r_elbow - 112.0;
    let r_pitch_stir = r_shoulder + r_elbow - 86.0;
    pose.set(Ch::RWpnPitch, r_pitch_high + (r_pitch_stir - r_pitch_high) * s);
}

/// One chop. `t` is seconds into the gather. The arm rises, then the head comes down.
pub fn dig_arm(pose: &mut stick_engine::anim::Pose, t: f32, pick: bool) {
    use stick_engine::anim::Ch;
    let cycle = 0.9_f32;
    let u = (t / cycle).rem_euclid(1.0);
    let strike = 0.5 * (1.0 - (u * std::f32::consts::TAU).cos());
    let s = strike * strike * (3.0 - 2.0 * strike);
    let shoulder = if pick { 155.0 + (22.0 - 155.0) * s } else { 128.0 + (32.0 - 128.0) * s };
    let elbow = 28.0 + (6.0 - 28.0) * s;
    pose.set(Ch::RShoulder, shoulder);
    pose.set(Ch::RElbow, elbow);
    pose.set(Ch::RArmOut, if pick { 6.0 } else { 16.0 });
    pose.set(Ch::RWpnYaw, 0.0);
    pose.set(Ch::RWpnPitch, shoulder + elbow - 90.0);
    pose.set(Ch::Lean, 6.0 + 12.0 * s);
}

fn draw_iron_shovel(fb: &mut Framebuffer, cam: &Camera, hand: Vec3, dir: Vec3, side: Vec3) {
    let _gear = iron_shovel();
    let at = |x: f32, y: f32| hand + dir * y + side * x;
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for (x, y) in [
        (0.0, SHOVEL_SHAFT.0),
        (-SHOVEL_MOUTH, SHOVEL_BLADE.1),
        (SHOVEL_MOUTH, SHOVEL_BLADE.1),
        (0.0, SHOVEL_BLADE.0),
    ] {
        include_px(&mut bounds, cam.project(at(x, y)), 3.0);
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let snap = tool_snap(fb, x0, y0, x1, y1);
    let p = |x: f32, y: f32| cam.project(at(x, y));
    fb.capsule(p(0.0, SHOVEL_SHAFT.0), p(0.0, SHOVEL_SHAFT.1), 1.6, C_HILT, None);
    fb.capsule(p(-SHOVEL_SOCKET, SHOVEL_BLADE.0), p(SHOVEL_SOCKET, SHOVEL_BLADE.0), 2.0, C_STEEL, None);
    paint_solid_tri(fb, p(-SHOVEL_SOCKET, SHOVEL_BLADE.0), p(SHOVEL_SOCKET, SHOVEL_BLADE.0), p(SHOVEL_MOUTH, SHOVEL_BLADE.1), C_STEEL, -0.2);
    paint_solid_tri(fb, p(-SHOVEL_SOCKET, SHOVEL_BLADE.0), p(SHOVEL_MOUTH, SHOVEL_BLADE.1), p(-SHOVEL_MOUTH, SHOVEL_BLADE.1), C_STEEL, -0.2);
    fb.line(p(-SHOVEL_SOCKET, SHOVEL_BLADE.0), p(-SHOVEL_MOUTH, SHOVEL_BLADE.1), C_GOLD);
    fb.line(p(-SHOVEL_MOUTH, SHOVEL_BLADE.1), p(SHOVEL_MOUTH, SHOVEL_BLADE.1), C_GOLD);
    fb.line(p(SHOVEL_MOUTH, SHOVEL_BLADE.1), p(SHOVEL_SOCKET, SHOVEL_BLADE.0), C_GOLD);
    fb.line(p(0.0, SHOVEL_BLADE.0 + 0.04), p(0.0, SHOVEL_BLADE.1 - 0.04), C_SHADOW);
    if let Some((_bw, before)) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn draw_iron_pickaxe(fb: &mut Framebuffer, cam: &Camera, hand: Vec3, dir: Vec3, side: Vec3) {
    let _gear = iron_pickaxe();
    let at = |x: f32, y: f32| hand + dir * y + side * x;
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for (x, y) in [
        (0.0, PICK_SHAFT.0),
        PICK_POINT,
        PICK_CHISEL,
        (0.0, PICK_EYE.0),
        (0.0, PICK_EYE.1),
    ] {
        include_px(&mut bounds, cam.project(at(x, y)), 3.0);
    }
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let snap = tool_snap(fb, x0, y0, x1, y1);
    let p = |x: f32, y: f32| cam.project(at(x, y));
    fb.capsule(p(0.0, PICK_SHAFT.0), p(0.0, PICK_SHAFT.1), 1.6, C_HILT, None);
    paint_solid_tri(fb, p(0.0, PICK_EYE.0), p(0.0, PICK_EYE.1), p(PICK_POINT.0, PICK_POINT.1), C_STEEL, -0.2);
    paint_solid_tri(fb, p(0.0, PICK_EYE.0), p(0.0, PICK_EYE.1), p(PICK_CHISEL.0, PICK_CHISEL.1), C_STEEL, -0.2);
    fb.line(p(0.0, PICK_EYE.1), p(PICK_POINT.0, PICK_POINT.1), C_GOLD);
    fb.line(p(PICK_POINT.0, PICK_POINT.1), p(0.0, PICK_EYE.0), C_GOLD);
    fb.line(p(0.0, PICK_EYE.1), p(PICK_CHISEL.0, PICK_CHISEL.1), C_GOLD);
    fb.line(p(PICK_CHISEL.0, PICK_CHISEL.1), p(0.0, PICK_EYE.0), C_GOLD);
    if let Some((_bw, before)) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn tool_snap(fb: &Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32) -> Option<(usize, Vec<u8>)> {
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    (bw > 0 && bh > 0 && bw * bh <= 80_000).then(|| {
        let mut before = vec![0u8; bw * bh];
        for y in y0..=y1 {
            for x in x0..=x1 {
                before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
            }
        }
        (bw, before)
    })
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
            if !row.is_empty() && row.bytes().all(|c| matches!(c, b'.' | b'g' | b'r' | b'c' | b'k' | b'b' | b'm' | b'l' | b'd' | b'h' | b's' | b'e' | b'i' | b'o' | b'w' | b'n')) {
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
                'o' => GEAR_BRONZE,
                'w' => crate::compat::C_TRAIL,
                'n' => crate::compat::C_DASH,
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

macro_rules! helm_plate_fn {
    ($fn:ident, $path:expr) => {
        fn $fn() -> &'static Plate {
            use std::sync::OnceLock;
            static PLATE: OnceLock<Plate> = OnceLock::new();
            PLATE.get_or_init(|| parse_plate(include_str!($path)))
        }
    };
}

helm_plate_fn!(iron_helm_plate, "../assets/gear/ba_iron_helm.plate.ron");
helm_plate_fn!(bronze_helm_plate, "../assets/gear/ba_bronze_helm.plate.ron");
helm_plate_fn!(bone_helm_plate, "../assets/gear/ba_bone_helm.plate.ron");
helm_plate_fn!(mythril_helm_plate, "../assets/gear/ba_mythril_helm.plate.ron");
helm_plate_fn!(darksteel_helm_plate, "../assets/gear/ba_darksteel_helm.plate.ron");
helm_plate_fn!(palace_helm_plate, "../assets/gear/ba_palace_helm.plate.ron");
helm_plate_fn!(scale_mail_helm_plate, "../assets/gear/ba_scale_mail_helm.plate.ron");
helm_plate_fn!(shade_helm_plate, "../assets/gear/ba_shade_helm.plate.ron");

fn catalog_helm_plate(item_id: u32) -> &'static Plate {
    match item_id {
        BRONZE_HELM_ITEM => bronze_helm_plate(),
        IRON_HELM_ITEM => iron_helm_plate(),
        MYTHRIL_HELM_ITEM => mythril_helm_plate(),
        DARKSTEEL_HELM_ITEM => darksteel_helm_plate(),
        PALACE_HELM_ITEM => palace_helm_plate(),
        SCALE_MAIL_HELM_ITEM => scale_mail_helm_plate(),
        SHADE_HELM_ITEM => shade_helm_plate(),
        BONE_HELM_ITEM => bone_helm_plate(),
        _ => iron_helm_plate(),
    }
}

fn helm_cap_color(item_id: u32) -> u8 {
    match item_id {
        BONE_HELM_ITEM => GEAR_BONE,
        BRONZE_HELM_ITEM => GEAR_BRONZE,
        DARKSTEEL_HELM_ITEM => crate::compat::C_SHADOW,
        SHADE_HELM_ITEM => crate::compat::C_SHADOW,
        MYTHRIL_HELM_ITEM => crate::compat::C_TRAIL,
        _ => C_GOLD,
    }
}

/// Shell radius, just outside the face. Disks are cross-sections; they are not drawn.
const HELM_R: f32 = 0.17;
const HELM_FACE: f32 = 0.13;
/// Horizontal disks, crown first, then down to the face.
const CROWN_Y: [f32; 5] = [0.155, 0.12, 0.08, 0.04, 0.0];
/// Vertical disks, face first, then dorsally to the back of the head.
const DORSAL_Z: [f32; 5] = [0.02, -0.03, -0.08, -0.12, -0.155];
const HELM_STEPS: usize = 16;

#[derive(Clone, Copy)]
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

/// Pixel strips between invisible disks. The most dorsal disk is the back cap.
fn draw_catalog_helm(fb: &mut Framebuffer, cam: &Camera, j: &Joints, item_id: u32) {
    let plate = catalog_helm_plate(item_id);
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
    paint_dorsal_cap(fb, cam, &frame, dorsal.last().unwrap(), helm_cap_color(item_id));
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

/// Fill on the furthest-back disk. The other disks stay invisible.
fn paint_dorsal_cap(
    fb: &mut Framebuffer,
    cam: &Camera,
    frame: &(Vec3, Vec3, Vec3, Vec3),
    disk: &HelmDisk,
    color: u8,
) {
    let ring = Ring {
        center: local(frame, helm_flip(disk.center)),
        right: helm_axis(frame, disk.right),
        fwd: helm_axis(frame, disk.fwd),
        rx: disk.rx,
        rz: disk.rz,
    };
    paint_ring(fb, cam, &ring, color, -0.5);
}

fn headband() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_headband.ron")).expect("ba_headband"))
}

helm_plate_fn!(headband_plate, "../assets/gear/ba_headband.plate.ron");
helm_plate_fn!(bell_torque_band_plate, "../assets/gear/ba_bell_torque_band.plate.ron");
helm_plate_fn!(circlet_plate, "../assets/gear/ba_circlet.plate.ron");
helm_plate_fn!(mythril_torque_plate, "../assets/gear/ba_mythril_torque.plate.ron");
helm_plate_fn!(leather_bandana_plate, "../assets/gear/ba_leather_bandana.plate.ron");
helm_plate_fn!(linen_helm_plate, "../assets/gear/ba_linen_helm.plate.ron");
helm_plate_fn!(fine_jerkin_helm_plate, "../assets/gear/ba_fine_jerkin_helm.plate.ron");
helm_plate_fn!(shade_leather_bandana_plate, "../assets/gear/ba_shade_leather_bandana.plate.ron");
helm_plate_fn!(skull_bandana_plate, "../assets/gear/ba_skull_bandana.plate.ron");

fn catalog_bandana_plate(item_id: u32) -> &'static Plate {
    match item_id {
        LEATHER_BANDANA_ITEM => leather_bandana_plate(),
        SHADE_LEATHER_BANDANA_ITEM => shade_leather_bandana_plate(),
        FINE_JERKIN_HELM_ITEM => fine_jerkin_helm_plate(),
        LINEN_HELM_ITEM => linen_helm_plate(),
        SKULL_BANDANA_ITEM => skull_bandana_plate(),
        _ => leather_bandana_plate(),
    }
}

fn catalog_headband_plate(item_id: u32) -> &'static Plate {
    match item_id {
        BELL_TORQUE_BAND_ITEM => bell_torque_band_plate(),
        MYTHRIL_TORQUE_ITEM => mythril_torque_plate(),
        CIRCLET_ITEM => circlet_plate(),
        _ => headband_plate(),
    }
}

/// Forehead band heights along head-neck +y (metres from head joint). Half-thickness span 0.045.
const HEADBAND_Y: [f32; 4] = [0.060, 0.045, 0.030, 0.015];
const HEADBAND_SKIN: f32 = 0.13;

fn headband_shell_r(y: f32) -> f32 {
    (HEADBAND_SKIN * HEADBAND_SKIN - y * y).max(0.0004).sqrt() + 0.006
}

fn headband_disks() -> [HelmDisk; 4] {
    HEADBAND_Y.map(|y| {
        let r = headband_shell_r(y);
        HelmDisk {
            center: (0.0, y, 0.0),
            right: (1.0, 0.0, 0.0),
            fwd: (0.0, 0.0, 1.0),
            rx: r,
            rz: r,
        }
    })
}

/// Face-side verts pull in front of the head disc; the back arc keeps natural depth.
fn headband_proj(cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), p: (f32, f32, f32)) -> stick_engine::camera::P2 {
    let q = cam.project(local(frame, p));
    if p.2 > 0.0 {
        helm_in_front(q)
    } else {
        q
    }
}

/// Head-local mesh; 180° about Y so crown + knot match face/back (reference art).
fn bandana_disk(cx: f32, cy: f32, cz: f32, r: f32) -> HelmDisk {
    HelmDisk {
        center: (-cx, cy, -cz),
        right: (-1.0, 0.0, 0.0),
        fwd: (0.0, 0.0, -1.0),
        rx: r,
        rz: r,
    }
}

fn leather_bandana() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| {
        GearDef::from_ron(include_str!("../assets/gear/ba_leather_bandana.ron")).expect("ba_leather_bandana")
    })
}

fn bandana_brow_disks() -> [HelmDisk; 4] {
    headband_disks().map(|d| bandana_disk(d.center.0, d.center.1, d.center.2, d.rx))
}

/// Folded triangle over the crown: spine from brow toward the forehead, wings to the sides.
fn bandana_spine_disks() -> [HelmDisk; 4] {
    [
        bandana_disk(0.0, 0.058, 0.028, 0.072),
        bandana_disk(0.0, 0.042, 0.058, 0.052),
        bandana_disk(0.0, 0.024, 0.078, 0.036),
        bandana_disk(0.0, 0.006, 0.092, 0.020),
    ]
}

fn bandana_wing_disks(side: f32) -> [HelmDisk; 3] {
    [
        bandana_disk(side * 0.052, 0.052, 0.025, 0.038),
        bandana_disk(side * 0.040, 0.035, 0.055, 0.028),
        bandana_disk(side * 0.028, 0.018, 0.072, 0.020),
    ]
}

fn bandana_knot_disk() -> HelmDisk {
    bandana_disk(0.0, 0.038, -0.128, 0.040)
}

fn bandana_tail_disks(side: f32) -> [HelmDisk; 3] {
    [
        bandana_disk(side * 0.038, 0.012, -0.118, 0.030),
        bandana_disk(side * 0.048, -0.028, -0.102, 0.026),
        bandana_disk(side * 0.055, -0.068, -0.088, 0.022),
    ]
}

fn headband_bounds_sample(
    bounds: &mut [i32; 4],
    cam: &Camera,
    frame: &(Vec3, Vec3, Vec3, Vec3),
    disks: &[HelmDisk],
) {
    for disk in disks {
        for step in 0..HELM_STEPS {
            let raw = helm_rim(disk, step as f32 / HELM_STEPS as f32);
            include_px(bounds, headband_proj(cam, frame, raw), 2.0);
        }
    }
}

fn headband_silhouette_snap(
    fb: &mut Framebuffer,
    cam: &Camera,
    frame: &(Vec3, Vec3, Vec3, Vec3),
    disks: &[HelmDisk],
) -> Option<(i32, i32, i32, i32, Vec<u8>)> {
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    headband_bounds_sample(&mut bounds, cam, frame, disks);
    let (x0, y0, x1, y1) = clip_bounds(fb, bounds);
    let bw = (x1 - x0 + 1).max(0) as usize;
    let bh = (y1 - y0 + 1).max(0) as usize;
    if bw == 0 || bh == 0 || bw * bh > 80_000 {
        return None;
    }
    let mut before = vec![0u8; bw * bh];
    for y in y0..=y1 {
        for x in x0..=x1 {
            before[(y - y0) as usize * bw + (x - x0) as usize] = fb.color[y as usize * fb.w + x as usize];
        }
    }
    Some((x0, y0, x1, y1, before))
}

fn draw_leather_bandana(fb: &mut Framebuffer, cam: &Camera, j: &Joints, item_id: u32) {
    let _ = leather_bandana();
    let plate = catalog_bandana_plate(item_id);
    let frame = head_neck_frame(j);
    let brow = bandana_brow_disks();
    let spine = bandana_spine_disks();
    let wing_l = bandana_wing_disks(-1.0);
    let wing_r = bandana_wing_disks(1.0);
    let knot = bandana_knot_disk();
    let tail_l = bandana_tail_disks(-1.0);
    let tail_r = bandana_tail_disks(1.0);
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for disks in [&brow[..], &spine[..], &wing_l[..], &wing_r[..], &tail_l[..], &tail_r[..]] {
        headband_bounds_sample(&mut bounds, cam, &frame, disks);
    }
    headband_bounds_sample(&mut bounds, cam, &frame, std::slice::from_ref(&knot));
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
    paint_headband_chain(fb, cam, &frame, plate, &brow);
    paint_headband_chain(fb, cam, &frame, plate, &[brow[0], spine[0]]);
    paint_headband_chain(fb, cam, &frame, plate, &spine);
    paint_headband_chain(fb, cam, &frame, plate, &wing_l);
    paint_headband_chain(fb, cam, &frame, plate, &wing_r);
    for i in 0..3 {
        paint_headband_chain(fb, cam, &frame, plate, &[spine[i], wing_l[i]]);
        paint_headband_chain(fb, cam, &frame, plate, &[spine[i + 1], wing_l[i]]);
        paint_headband_chain(fb, cam, &frame, plate, &[spine[i], wing_r[i]]);
        paint_headband_chain(fb, cam, &frame, plate, &[spine[i + 1], wing_r[i]]);
    }
    paint_headband_chain(fb, cam, &frame, plate, &[knot, tail_l[0]]);
    paint_headband_chain(fb, cam, &frame, plate, &[knot, tail_r[0]]);
    paint_headband_chain(fb, cam, &frame, plate, &tail_l);
    paint_headband_chain(fb, cam, &frame, plate, &tail_r);
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn draw_headband(fb: &mut Framebuffer, cam: &Camera, j: &Joints, item_id: u32) {
    let _ = headband();
    let plate = catalog_headband_plate(item_id);
    let frame = head_neck_frame(j);
    let disks = headband_disks();
    let snap = headband_silhouette_snap(fb, cam, &frame, &disks);
    paint_headband_chain(fb, cam, &frame, plate, &disks);
    if let Some((x0, y0, x1, y1, before)) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_headband_chain(
    fb: &mut Framebuffer,
    cam: &Camera,
    frame: &(Vec3, Vec3, Vec3, Vec3),
    plate: &Plate,
    disks: &[HelmDisk],
) {
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
            let pa = headband_proj(cam, frame, a);
            let pb = headband_proj(cam, frame, b);
            let pc = headband_proj(cam, frame, c);
            let pd = headband_proj(cam, frame, d);
            paint_cloth_tri(fb, pa, pb, pc, (u0, v0), (u1, v0), (u1, v1), plate);
            paint_cloth_tri(fb, pa, pc, pd, (u0, v0), (u1, v1), (u0, v1), plate);
        }
    }
}

fn cloth_hat() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_cloth_hat.ron")).expect("ba_cloth_hat"))
}

helm_plate_fn!(cloth_hat_plate, "../assets/gear/ba_cloth_hat.plate.ron");
helm_plate_fn!(silk_hat_plate, "../assets/gear/ba_silk_hat.plate.ron");
helm_plate_fn!(velvet_hat_plate, "../assets/gear/ba_velvet_hat.plate.ron");

fn catalog_hat_plate(item_id: u32) -> &'static Plate {
    match item_id {
        SILK_HAT_ITEM => silk_hat_plate(),
        VELVET_HAT_ITEM => velvet_hat_plate(),
        _ => cloth_hat_plate(),
    }
}

/// Pointed hat: (height, radius) from the tip down to the brim. The brim is the wide last disk.
const HAT_DISKS: [(f32, f32); 6] = [
    (0.58, 0.02),
    (0.44, 0.07),
    (0.30, 0.12),
    (0.18, 0.15),
    (0.10, 0.16),
    (0.07, 0.32),
];

fn hat_disks() -> [HelmDisk; 6] {
    HAT_DISKS.map(|(y, r)| HelmDisk {
        center: (0.0, y, 0.0),
        right: (1.0, 0.0, 0.0),
        fwd: (0.0, 0.0, 1.0),
        rx: r,
        rz: r,
    })
}

/// Pixel strips on a pointed stack. The tip disk is filled with the top row. The face stays open.
fn draw_cloth_hat(fb: &mut Framebuffer, cam: &Camera, j: &Joints, item_id: u32) {
    let _ = cloth_hat();
    let plate = catalog_hat_plate(item_id);
    let frame = head_frame(j);
    let disks = hat_disks();
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for disk in &disks {
        for step in 0..HELM_STEPS {
            let raw = helm_rim(disk, step as f32 / HELM_STEPS as f32);
            include_px(&mut bounds, cam.project(local(&frame, raw)), 2.0);
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
    paint_hat_chain(fb, cam, &frame, plate, &disks);
    paint_hat_tip(fb, cam, &frame, &disks[0], plate_edge(plate, 0));
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_hat_chain(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), plate: &Plate, disks: &[HelmDisk]) {
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
            let pa = helm_in_front(cam.project(local(frame, a)));
            let pb = helm_in_front(cam.project(local(frame, b)));
            let pc = helm_in_front(cam.project(local(frame, c)));
            let pd = helm_in_front(cam.project(local(frame, d)));
            paint_cloth_tri(fb, pa, pb, pc, (u0, v0), (u1, v0), (u1, v1), plate);
            paint_cloth_tri(fb, pa, pc, pd, (u0, v0), (u1, v1), (u0, v1), plate);
        }
    }
}

fn hat_axis(frame: &(Vec3, Vec3, Vec3, Vec3), a: (f32, f32, f32)) -> Vec3 {
    frame.1 * a.0 + frame.2 * a.1 + frame.3 * a.2
}

/// Close the tip with the plate's top row. The brim stays a ring, so the face is not covered.
fn paint_hat_tip(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), disk: &HelmDisk, color: u8) {
    let ring = Ring {
        center: local(frame, disk.center),
        right: hat_axis(frame, disk.right),
        fwd: hat_axis(frame, disk.fwd),
        rx: disk.rx,
        rz: disk.rz,
    };
    paint_ring(fb, cam, &ring, color, -0.5);
}

fn iron_shield() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_shield.ron")).expect("ba_iron_shield"))
}

fn shield_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_iron_shield.plate.ron")))
}

/// Face center in the off-hand frame, and ring radii from the boss out to the rim.
const SHIELD_CENTER: (f32, f32, f32) = (0.0, 0.04, 0.16);
const SHIELD_R: [f32; 4] = [0.05, 0.11, 0.17, 0.24];
const SHIELD_STEPS: usize = 24;

fn shield_frame(j: &Joints) -> (Vec3, Vec3, Vec3, Vec3) {
    let o = j.hand[0];
    let mut y = j.wpn_l;
    if y.len() < 0.5 {
        y = j.elbow[0] - j.hand[0];
    }
    y = y.norm();
    let mut x = y.cross(Vec3::UP).norm();
    if x.len() < 0.5 {
        x = v3(1.0, 0.0, 0.0);
    }
    let z = x.cross(y).norm();
    (o, x, y, z)
}

fn shield_disks() -> [HelmDisk; 4] {
    SHIELD_R.map(|r| HelmDisk {
        center: SHIELD_CENTER,
        right: (1.0, 0.0, 0.0),
        fwd: (0.0, 0.0, 1.0),
        rx: r,
        rz: r,
    })
}

/// Concentric strips in the shield plane. The boss is a filled gold disk. The grip is the capsule.
fn draw_iron_shield(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let gear = iron_shield();
    let plate = shield_plate();
    let frame = shield_frame(j);
    let disks = shield_disks();
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for disk in &disks {
        for step in 0..SHIELD_STEPS {
            let raw = helm_rim(disk, step as f32 / SHIELD_STEPS as f32);
            include_px(&mut bounds, cam.project(local(&frame, raw)), 2.0);
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
    for sh in &gear.shapes {
        if let Shape::Capsule { from, to, thick, ramp } = sh {
            let a = cam.project(local(&frame, *from));
            let b = cam.project(local(&frame, *to));
            fb.capsule(a, b, *thick, plate_color(*ramp), None);
        }
    }
    paint_shield_chain(fb, cam, &frame, plate, &disks);
    paint_shield_boss(fb, cam, &frame, &disks[0]);
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_shield_chain(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), plate: &Plate, disks: &[HelmDisk]) {
    let n = disks.len();
    if n < 2 {
        return;
    }
    for i in 0..n - 1 {
        let v0 = i as f32 / (n - 1) as f32;
        let v1 = (i + 1) as f32 / (n - 1) as f32;
        for col in 0..SHIELD_STEPS {
            let u0 = col as f32 / SHIELD_STEPS as f32;
            let u1 = (col + 1) as f32 / SHIELD_STEPS as f32;
            let a = helm_rim(&disks[i], u0);
            let b = helm_rim(&disks[i], u1);
            let c = helm_rim(&disks[i + 1], u1);
            let d = helm_rim(&disks[i + 1], u0);
            let pa = cam.project(local(frame, a));
            let pb = cam.project(local(frame, b));
            let pc = cam.project(local(frame, c));
            let pd = cam.project(local(frame, d));
            paint_cloth_tri(fb, pa, pb, pc, (u0, v0), (u1, v0), (u1, v1), plate);
            paint_cloth_tri(fb, pa, pc, pd, (u0, v0), (u1, v1), (u0, v1), plate);
        }
    }
}

fn paint_shield_boss(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), disk: &HelmDisk) {
    let ring = Ring {
        center: local(frame, disk.center),
        right: frame.1 * disk.right.0 + frame.2 * disk.right.1 + frame.3 * disk.right.2,
        fwd: frame.1 * disk.fwd.0 + frame.2 * disk.fwd.1 + frame.3 * disk.fwd.2,
        rx: disk.rx,
        rz: disk.rz,
    };
    paint_ring(fb, cam, &ring, C_GOLD, 0.0);
}

fn kite_shield() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_kite_shield.ron")).expect("ba_kite_shield"))
}

fn kite_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_kite_shield.plate.ron")))
}

/// Kite in the off-hand plane. Local x is across the face, local z is up the face.
const KITE_Y: f32 = 0.04;
const KITE_TOP: f32 = 0.50;
const KITE_BOT: f32 = -0.56;
const KITE_HALF: f32 = 0.32;
const KITE_RIM: f32 = 0.06;

/// Half-width. v = 0 is the flat top, v = 1 is the point. The top stays wide, then the sides run to the point.
fn kite_half(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    let shoulder = 0.22;
    let corner = 0.06;
    let round = if v < corner {
        let t = v / corner;
        0.94 + 0.06 * (1.0 - (1.0 - t) * (1.0 - t))
    } else {
        1.0
    };
    let taper = if v <= shoulder { 1.0 } else { (1.0 - v) / (1.0 - shoulder) };
    KITE_HALF * round * taper
}

/// Closed loop in (x, z). Top-left, down to the point, up to the top-right.
fn kite_outline() -> Vec<(f32, f32)> {
    let n = 16;
    let mut pts = Vec::with_capacity(n * 2);
    for i in 0..=n {
        let v = i as f32 / n as f32;
        let z = KITE_TOP + (KITE_BOT - KITE_TOP) * v;
        pts.push((-kite_half(v), z));
    }
    for i in (0..n).rev() {
        let v = i as f32 / n as f32;
        let z = KITE_TOP + (KITE_BOT - KITE_TOP) * v;
        pts.push((kite_half(v), z));
    }
    pts
}

fn kite_area(pts: &[(f32, f32)]) -> f32 {
    let n = pts.len();
    let mut a = 0.0;
    for i in 0..n {
        let p = pts[i];
        let q = pts[(i + 1) % n];
        a += p.0 * q.1 - q.0 * p.1;
    }
    a * 0.5
}

/// Move each vertex inward so the gold border keeps a steady thickness, including at the point.
fn kite_inset(pts: &[(f32, f32)], dist: f32) -> Vec<(f32, f32)> {
    let n = pts.len();
    let sign = if kite_area(pts) > 0.0 { 1.0 } else { -1.0 };
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let prev = pts[(i + n - 1) % n];
        let cur = pts[i];
        let next = pts[(i + 1) % n];
        let d0 = kite_norm(cur.0 - prev.0, cur.1 - prev.1);
        let d1 = kite_norm(next.0 - cur.0, next.1 - cur.1);
        let n0 = (-d0.1 * sign, d0.0 * sign);
        let n1 = (-d1.1 * sign, d1.0 * sign);
        let mut nx = n0.0 + n1.0;
        let mut nz = n0.1 + n1.1;
        let len = (nx * nx + nz * nz).sqrt().max(1e-6);
        nx /= len;
        nz /= len;
        let align = (n0.0 * nx + n0.1 * nz).max(0.25);
        let m = (dist / align).min(dist * 3.2);
        out.push((cur.0 + nx * m, cur.1 + nz * m));
    }
    out
}

fn kite_norm(x: f32, z: f32) -> (f32, f32) {
    let len = (x * x + z * z).sqrt().max(1e-6);
    (x / len, z / len)
}

fn kite_inside(pts: &[(f32, f32)], x: f32, z: f32) -> bool {
    let mut hit = false;
    let n = pts.len();
    for i in 0..n {
        let (x0, z0) = pts[i];
        let (x1, z1) = pts[(i + 1) % n];
        if (z0 > z) != (z1 > z) {
            let cross = x0 + (z - z0) * (x1 - x0) / (z1 - z0);
            if x < cross {
                hit = !hit;
            }
        }
    }
    hit
}

/// Vertical bar, then the horizontal bar. (x0, z0, x1, z1) in the shield plane.
fn kite_cross() -> [(f32, f32, f32, f32); 2] {
    [(-0.045, -0.08, 0.045, 0.40), (-0.15, 0.115, 0.15, 0.205)]
}

/// Pointed steel face, gold rim of even thickness, gold cross. The grip is the capsule.
fn draw_kite_shield(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let gear = kite_shield();
    let plate = kite_plate();
    let frame = shield_frame(j);
    let outer = kite_outline();
    let inner = kite_inset(&outer, KITE_RIM);
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for p in &outer {
        include_px(&mut bounds, cam.project(local(&frame, (p.0, KITE_Y, p.1))), 2.0);
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
    for sh in &gear.shapes {
        if let Shape::Capsule { from, to, thick, ramp } = sh {
            let a = cam.project(local(&frame, *from));
            let b = cam.project(local(&frame, *to));
            fb.capsule(a, b, *thick, plate_color(*ramp), None);
        }
    }
    let steel = plate.cells[plate.w / 2 + plate.w * (plate.h / 2)];
    paint_kite_fan(fb, cam, &frame, &outer, steel);
    paint_kite_band(fb, cam, &frame, &outer, &inner, C_GOLD);
    for bar in kite_cross() {
        paint_kite_rect(fb, cam, &frame, bar, C_GOLD);
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_kite_fan(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), pts: &[(f32, f32)], color: u8) {
    if pts.len() < 3 {
        return;
    }
    let (mut sx, mut sz) = (0.0, 0.0);
    for p in pts {
        sx += p.0;
        sz += p.1;
    }
    let n = pts.len() as f32;
    let c = cam.project(local(frame, (sx / n, KITE_Y, sz / n)));
    for i in 0..pts.len() {
        let a = pts[i];
        let b = pts[(i + 1) % pts.len()];
        let pa = cam.project(local(frame, (a.0, KITE_Y, a.1)));
        let pb = cam.project(local(frame, (b.0, KITE_Y, b.1)));
        paint_solid_tri(fb, c, pa, pb, color, 0.0);
    }
}

fn paint_kite_band(
    fb: &mut Framebuffer,
    cam: &Camera,
    frame: &(Vec3, Vec3, Vec3, Vec3),
    outer: &[(f32, f32)],
    inner: &[(f32, f32)],
    color: u8,
) {
    let n = outer.len().min(inner.len());
    let proj = |p: (f32, f32)| cam.project(local(frame, (p.0, KITE_Y, p.1)));
    for i in 0..n {
        let j = (i + 1) % n;
        let a = proj(outer[i]);
        let b = proj(outer[j]);
        let c = proj(inner[j]);
        let d = proj(inner[i]);
        paint_solid_tri(fb, a, b, c, color, 0.0);
        paint_solid_tri(fb, a, c, d, color, 0.0);
    }
}

fn paint_kite_rect(fb: &mut Framebuffer, cam: &Camera, frame: &(Vec3, Vec3, Vec3, Vec3), bar: (f32, f32, f32, f32), color: u8) {
    let (x0, z0, x1, z1) = bar;
    let p = |x: f32, z: f32| cam.project(local(frame, (x, KITE_Y, z)));
    paint_solid_tri(fb, p(x0, z0), p(x1, z0), p(x1, z1), color, 0.0);
    paint_solid_tri(fb, p(x0, z0), p(x1, z1), p(x0, z1), color, 0.0);
}

fn cuisse_plate() -> &'static Plate {
    use std::sync::OnceLock;
    static PLATE: OnceLock<Plate> = OnceLock::new();
    PLATE.get_or_init(|| parse_plate(include_str!("../assets/gear/ba_iron_cuisses.plate.ron")))
}

fn iron_cuisses() -> &'static GearDef {
    use std::sync::OnceLock;
    static GEAR: OnceLock<GearDef> = OnceLock::new();
    GEAR.get_or_init(|| GearDef::from_ron(include_str!("../assets/gear/ba_iron_cuisses.ron")).expect("ba_iron_cuisses"))
}

/// Fraction down the thigh after the hip cap. 0 is the hip joint. The last stop is above the knee.
const CUISSE_T: [f32; 5] = [0.0, 0.22, 0.46, 0.68, 0.90];
/// Shell radius around the bone. Wider at the hip, clear of the limb on every side.
const CUISSE_R: [f32; 5] = [0.108, 0.096, 0.084, 0.074, 0.064];
const CUISSE_HIP_R: f32 = 0.13;
const CUISSE_HIP_LIFT: f32 = 0.13;
const CUISSE_HIP_OUT: f32 = 0.04;
/// Arc from just inside the front, around the outside, and across the back. The inner thigh stays open.
const CUISSE_ANG0: f32 = -0.45;
const CUISSE_SWEEP: f32 = 4.6;
const CUISSE_STEPS: usize = 12;

fn body_fwd(j: &Joints) -> Vec3 {
    let right = (j.hip[1] - j.hip[0]).norm();
    let up = (j.chest - j.pelvis).norm();
    let fwd = right.cross(up);
    if fwd.len() < 0.5 { v3(0.0, 0.0, 1.0) } else { fwd.norm() }
}

fn thigh_axes(hip: Vec3, knee: Vec3, fwd: Vec3) -> (Vec3, Vec3) {
    let along = (knee - hip).norm();
    let mut front = fwd - along * fwd.dot(along);
    if front.len() < 0.25 {
        let up = Vec3::UP - along * Vec3::UP.dot(along);
        front = if up.len() > 0.25 { up } else { v3(1.0, 0.0, 0.0) };
    }
    let front = front.norm();
    let right = front.cross(along).norm();
    (right, front)
}

fn cuisse_rings() -> usize {
    CUISSE_T.len() + 1
}

/// One point on the shell. Ring 0 is the hip cap. `u` runs the open edges on the inner thigh.
fn cuisse_point(j: &Joints, side: usize, ring: usize, u: f32) -> Vec3 {
    let hip = j.hip[side];
    let knee = j.knee[side];
    let (right, front) = thigh_axes(hip, knee, body_fwd(j));
    let outward = if side == 0 { right * -1.0 } else { right };
    let up = (j.chest - j.pelvis).norm();
    let ang = CUISSE_ANG0 + u * CUISSE_SWEEP;
    let (center, radius) = if ring == 0 {
        (hip + up * CUISSE_HIP_LIFT + outward * CUISSE_HIP_OUT, CUISSE_HIP_R)
    } else {
        let i = ring - 1;
        (hip + (knee - hip) * CUISSE_T[i], CUISSE_R[i])
    };
    center + front * ang.cos() * radius + outward * ang.sin() * radius
}

/// Steel shell on each hip and thigh. The inner thigh stays open. The knee is not covered.
fn draw_iron_cuisses(fb: &mut Framebuffer, cam: &Camera, j: &Joints) {
    let _gear = iron_cuisses();
    let plate = cuisse_plate();
    let mut bounds = [i32::MAX, i32::MAX, i32::MIN, i32::MIN];
    for side in 0..2 {
        for ring in 0..cuisse_rings() {
            for step in 0..=CUISSE_STEPS {
                let u = step as f32 / CUISSE_STEPS as f32;
                include_px(&mut bounds, cam.project(cuisse_point(j, side, ring, u)), 2.0);
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
    for side in 0..2 {
        paint_cuisse(fb, cam, j, side, plate);
    }
    if let Some(before) = snap {
        silhouette(fb, x0, y0, x1, y1, &before);
    }
}

fn paint_cuisse(fb: &mut Framebuffer, cam: &Camera, j: &Joints, side: usize, plate: &Plate) {
    let n = cuisse_rings();
    for i in 0..n - 1 {
        let v0 = i as f32 / (n - 1) as f32;
        let v1 = (i + 1) as f32 / (n - 1) as f32;
        for step in 0..CUISSE_STEPS {
            let u0 = step as f32 / CUISSE_STEPS as f32;
            let u1 = (step + 1) as f32 / CUISSE_STEPS as f32;
            let a = cam.project(cuisse_point(j, side, i, u0));
            let b = cam.project(cuisse_point(j, side, i, u1));
            let c = cam.project(cuisse_point(j, side, i + 1, u1));
            let d = cam.project(cuisse_point(j, side, i + 1, u0));
            paint_cloth_tri(fb, a, b, c, (u0, v0), (u1, v0), (u1, v1), plate);
            paint_cloth_tri(fb, a, c, d, (u0, v0), (u1, v1), (u0, v1), plate);
        }
    }
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

/// Head-local frame: +y from neck to head so rings sit on skull latitude.
fn head_neck_frame(j: &Joints) -> (Vec3, Vec3, Vec3, Vec3) {
    let y = (j.head - j.neck).norm();
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
        let plate = super::iron_helm_plate();
        assert!(plate.cells.contains(&super::C_STEEL));
        assert!(plate.cells.contains(&super::C_GOLD));
        assert!(!plate.cells.contains(&0));
        assert!(!plate.cells.contains(&13), "helm pixels are grey and gold only");
    }

    #[test]
    fn cloth_hat_is_a_pointed_stack() {
        let disks = super::hat_disks();
        assert!(disks[0].center.1 > disks[5].center.1, "the stack steps down from the tip");
        assert!(disks[0].center.1 > 0.5, "the tip stands above the head");
        assert!(disks[0].rx < 0.04, "the tip is a point");
        assert!(disks[5].rx > disks[4].rx, "the last disk is the brim");
        assert!(disks[5].rx > 0.28);
        assert!(disks[5].center.1 > 0.05, "the brim stays above the face");
        let g = super::cloth_hat();
        assert!(g.shapes.is_empty(), "the disks are invisible");
        let plate = super::cloth_hat_plate();
        assert!(!plate.cells.contains(&0), "every hat pixel is painted");
        assert!(plate.cells.iter().all(|c| *c == crate::palette::WATER), "the cone is one opaque blue");
        assert!(!plate.cells.contains(&super::C_STEEL));
        assert!(!plate.cells.contains(&super::C_GOLD));
    }

    #[test]
    fn headband_is_a_forehead_stack() {
        let disks = super::headband_disks();
        assert!(disks[0].center.1 > disks[3].center.1);
        assert!(disks[0].center.1 > disks[3].center.1, "rings step down from crown toward brow");
        assert!(disks[3].center.1 > 0.0, "the band stays above the eyes");
        assert!(disks[0].rx > 0.10 && disks[0].rx < 0.13);
        assert!(disks[3].rx > disks[0].rx, "lower ring is wider on the skull");
        let g = super::headband();
        assert!(g.shapes.is_empty());
        let plate = super::headband_plate();
        assert!(!plate.cells.contains(&0));
        assert!(plate.cells.contains(&crate::palette::GEAR_LEATHER));
        assert!(plate.cells.contains(&crate::palette::GEAR_LEATHER_FAR));
    }

    #[test]
    fn iron_shield_is_a_faced_plane() {
        use stick_engine::gear::Shape;
        let disks = super::shield_disks();
        assert!(disks.iter().all(|d| d.center == disks[0].center), "the rings share one plane");
        assert_eq!(disks[0].fwd, (0.0, 0.0, 1.0), "the face stands across the weapon direction");
        assert!(disks[0].rx < disks[3].rx);
        assert!(disks[0].rx < 0.06, "the inner ring is the boss");
        assert!(disks[3].rx > 0.2, "the outer ring is the rim");
        let g = super::iron_shield();
        assert_eq!(g.shapes.len(), 1);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        let plate = super::shield_plate();
        assert!(plate.cells.contains(&super::C_STEEL));
        assert!(plate.cells.contains(&super::C_GOLD));
        assert!(!plate.cells.contains(&0));
        assert!(!plate.cells.contains(&13));
        assert!(!plate.cells.contains(&crate::compat::C_SHADOW));
    }

    #[test]
    fn kite_shield_is_a_pointed_face() {
        use stick_engine::gear::Shape;
        let outer = super::kite_outline();
        let inner = super::kite_inset(&outer, super::KITE_RIM);
        let top = outer.iter().map(|p| p.1).fold(f32::MIN, f32::max);
        let bot = outer.iter().map(|p| p.1).fold(f32::MAX, f32::min);
        assert!(top - bot > 0.9, "the kite is tall");
        assert!(outer.iter().any(|p| p.0.abs() > 0.25), "the top is wide");
        assert!(outer.iter().filter(|p| (p.1 - bot).abs() < 0.02).all(|p| p.0.abs() < 0.04), "the bottom is a point");
        let inner_bot = inner.iter().map(|p| p.1).fold(f32::MAX, f32::min);
        assert!(inner_bot > bot, "the rim stays thick at the point");
        let bars = super::kite_cross();
        let (vx0, vz0, vx1, vz1) = bars[0];
        let (hx0, hz0, hx1, hz1) = bars[1];
        assert!(vz1 - vz0 > hx1 - hx0, "the upright of the cross is the long bar");
        for (x, z) in [(vx0, vz0), (vx1, vz1), (hx0, hz0), (hx1, hz1), (0.0, (hz0 + hz1) * 0.5)] {
            assert!(super::kite_inside(&inner, x, z), "the cross sits inside the rim");
        }
        let g = super::kite_shield();
        assert_eq!(g.shapes.len(), 1);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        let plate = super::kite_plate();
        assert!(plate.cells.iter().all(|c| *c == super::C_STEEL), "the field is one steel");
        assert!(!plate.cells.contains(&0));
        assert!(!plate.cells.contains(&13));
    }

    #[test]
    fn iron_cuisses_follow_the_thighs() {
        use stick_engine::math::v3;
        let j = crate::compat::Fig {
            pelvis: v3(0.0, 0.9, 0.0),
            chest: v3(0.0, 1.42, 0.0),
            hip: [v3(-0.11, 0.9, 0.0), v3(0.11, 0.9, 0.0)],
            knee: [v3(-0.11, 0.44, 0.0), v3(0.11, 0.44, 0.0)],
            ..crate::compat::Fig::default()
        };
        let fwd = super::body_fwd(&j);
        let hip = j.hip[0];
        let knee = j.knee[0];
        let hip_cap = super::cuisse_point(&j, 0, 0, 0.2);
        let low = super::cuisse_point(&j, 0, 5, 0.1);
        assert!(hip_cap.y > hip.y + 0.08, "the hip plate rises above the joint");
        assert!((low - knee).len() < (low - hip).len(), "the narrow end stops by the knee");
        assert!(super::CUISSE_HIP_R > super::CUISSE_R[4], "the hip is wider than the knee");
        let bone = hip + (knee - hip) * super::CUISSE_T[2];
        let front = super::cuisse_point(&j, 0, 3, 0.1);
        let back = super::cuisse_point(&j, 0, 3, 0.78);
        assert!((front - bone).dot(fwd) > super::LIMB_R, "the front of the thigh is plated");
        assert!((back - bone).dot(fwd) < -super::LIMB_R, "the back of the thigh is plated");
        let mut swung = j;
        swung.knee[0] = knee + v3(0.0, 0.05, 0.25);
        let moved = super::cuisse_point(&swung, 0, 5, 0.1);
        assert!((moved - low).len() > 0.15, "a stride carries the plate");
        let g = super::iron_cuisses();
        assert!(g.shapes.is_empty(), "the arcs are invisible");
        let plate = super::cuisse_plate();
        assert!(plate.cells.contains(&super::C_STEEL));
        assert!(plate.cells.contains(&super::C_GOLD));
        assert!(!plate.cells.contains(&0));
        assert!(!plate.cells.contains(&13));
        assert!(!plate.cells.contains(&crate::compat::C_SHADOW));
    }

    #[test]
    fn catalog_daggers_use_short_layout_not_iron_sword() {
        use crate::gear::{Mat, WeaponLook, BONE_DAGGER_ITEM, FANG_DAGGER_ITEM, IRON_DAGGER_ITEM, NEOLITHIC_DAGGER_ITEM};
        use crate::preset::Weapon;
        let g = super::iron_dagger();
        assert_eq!(g.shapes.len(), 1, "dagger grip only, not iron sword guard capsule");
        for seed in [
            IRON_DAGGER_ITEM,
            NEOLITHIC_DAGGER_ITEM,
            FANG_DAGGER_ITEM,
            BONE_DAGGER_ITEM,
        ] {
            let w = WeaponLook::new(Weapon::Dagger, Mat::Bone, seed);
            let lay = super::pixel_sword_layout(&w).expect("catalog dagger pixel layout");
            assert!(!lay.crossguard, "seed {seed} must not use iron sword crossguard");
            assert!(lay.blade.1 < super::SWORD_BLADE.1 * 0.6, "seed {seed} blade shorter than 1h sword");
        }
        let misclassified = WeaponLook::new(Weapon::Sword, Mat::Bone, BONE_DAGGER_ITEM);
        assert!(
            !super::pixel_sword_layout(&misclassified).unwrap().crossguard,
            "dagger catalog id wins over sword family"
        );
    }

    #[test]
    fn decayed_sword_is_one_hand_sword_not_great_axe() {
        use crate::gear::{Mat, WeaponLook, DECAYED_SWORD_ITEM, IRON_GREAT_AXE_ITEM};
        use crate::preset::Weapon;
        let w = WeaponLook::new(Weapon::Sword, Mat::Bone, DECAYED_SWORD_ITEM);
        let lay = super::pixel_sword_layout(&w).expect("decayed sword pixel layout");
        assert!(lay.crossguard, "1h iron sword crossguard");
        assert!(!super::pixel_axe_item(DECAYED_SWORD_ITEM));
        assert!(super::pixel_axe_item(IRON_GREAT_AXE_ITEM));
    }

    #[test]
    fn decayed_axe_is_one_hand_labrys() {
        use crate::gear::{Mat, WeaponLook, DECAYED_AXE_ITEM};
        use crate::preset::Weapon;
        let w = WeaponLook::new(Weapon::Axe, Mat::Bone, DECAYED_AXE_ITEM);
        assert!(super::pixel_axe_item(DECAYED_AXE_ITEM));
        assert!(super::pixel_labrys_style(DECAYED_AXE_ITEM).is_some());
        assert_eq!(w.kind, Weapon::Axe);
    }

    #[test]
    fn iron_sword_matches_the_drawing() {
        use stick_engine::gear::Shape;
        use stick_engine::math::v3;
        let g = super::iron_sword();
        let _bronze = super::bronze_sword();
        assert_eq!(g.shapes.len(), 2);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        assert!(super::SWORD_BLADE.1 - super::SWORD_BLADE.0 > super::SWORD_GRIP.1 - super::SWORD_GRIP.0, "the blade is the long part");
        assert!(super::SWORD_GUARD_HALF > super::SWORD_BLADE_HALF, "the guard is wider than the blade");
        assert!(super::SWORD_BLADE.0 > super::SWORD_GUARD_Y, "the blade starts past the guard");
        assert!(super::SWORD_POINT > super::SWORD_BLADE.0 && super::SWORD_POINT < super::SWORD_BLADE.1, "the sides meet at a point");
        assert!(super::SWORD_GRIP.1 < super::SWORD_GUARD_Y, "the grip ends at the guard");
        let mark = super::sword_mark();
        assert!(mark[0].1 > mark[1].1 && mark[0].1 > mark[2].1, "the triangle points along the blade");
        assert!(mark[0].1 < super::SWORD_BLADE.0, "the mark sits on the plate, not on the blade");
        assert!(mark[1].0.abs() < super::SWORD_PLATE_HALF && mark[0].1 - super::SWORD_GUARD_Y < super::SWORD_PLATE_HALF);
        let across = super::sword_from_hand(v3(0.0, 0.0, 1.0));
        assert!(across.dot(v3(0.0, 0.0, 1.0)).abs() < 1e-3, "the blade is square to the hand");
        assert!(across.y > 0.9, "the point stands up off a level hand");
        let front = v3(0.0, 0.0, 1.0);
        let wide = super::blade_across(across, front);
        let face = across.cross(wide);
        assert!(wide.dot(across).abs() < 1e-3, "the roll stays on the blade axis");
        assert!(face.dot(front).abs() < 0.1, "the edge faces the front");
        assert!(face.x.abs() > 0.9, "a side view shows the flat");
    }

    #[test]
    fn iron_shovel_is_a_shaft_and_a_wide_blade() {
        use stick_engine::gear::Shape;
        let g = super::iron_shovel();
        assert_eq!(g.id, "ba_iron_shovel");
        assert_eq!(g.shapes.len(), 2);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        assert!(super::SHOVEL_BLADE.1 > super::SHOVEL_SHAFT.1, "the scoop sits past the shaft");
        assert!(super::SHOVEL_MOUTH > super::SHOVEL_SOCKET * 2.0, "the mouth is wider than the socket");
        assert!((g.reach - super::SHOVEL_BLADE.1).abs() < 1e-3);
    }

    #[test]
    fn iron_pickaxe_is_a_shaft_and_a_crossed_head() {
        use stick_engine::gear::Shape;
        let g = super::iron_pickaxe();
        assert_eq!(g.id, "ba_iron_pickaxe");
        assert_eq!(g.shapes.len(), 2);
        assert!(matches!(g.shapes[1], Shape::Capsule { .. }));
        assert!(super::PICK_EYE.1 > super::PICK_SHAFT.0, "the head sits on the shaft");
        assert!(super::PICK_POINT.0.abs() > super::PICK_CHISEL.0, "one point is the long one");
        assert!(super::PICK_POINT.0 < 0.0 && super::PICK_CHISEL.0 > 0.0, "the head crosses the shaft");
    }

    #[test]
    fn black_anvil_parses_from_ron() {
        use stick_engine::color::ColorSlot;
        use stick_engine::gear::Shape;
        let g = super::black_anvil();
        assert_eq!(g.id, "ba_black_anvil");
        assert!(g.shapes.len() >= 6);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        assert!(
            g.shapes.iter().any(|sh| matches!(sh, Shape::Line { .. })),
            "gold lip on the face"
        );
        assert_eq!(super::anvil_ramp(ColorSlot::Material), super::C_OUTLINE);
    }

    #[test]
    fn smithing_arm_strikes_the_anvil() {
        use stick_engine::anim::{Ch, Pose};
        let mut top = Pose::default();
        super::smithing_arm(&mut top, 0.0);
        let mut hit = Pose::default();
        let cycle = super::LEATHERCRAFT_SEC / 3.0;
        super::smithing_arm(&mut hit, cycle * 0.45);
        assert!(top.get(Ch::RShoulder) > hit.get(Ch::RShoulder) + 30.0);
        assert_eq!(top.get(Ch::LHip), 0.0);
    }

    #[test]
    fn smithing_strike_impact_once_per_hammer_cycle() {
        let cycle = super::LEATHERCRAFT_SEC / 3.0;
        assert!(!super::smithing_strike_impact(0.0, 0.0));
        assert!(super::smithing_strike_impact(cycle * 0.51, cycle * 0.49));
        assert!(!super::smithing_strike_impact(cycle * 0.52, cycle * 0.51));
    }

    #[test]
    fn goldsmith_stake_parses_from_ron() {
        use stick_engine::color::ColorSlot;
        use stick_engine::gear::Shape;
        let g = super::goldsmith_stake();
        assert_eq!(g.id, "ba_goldsmith_stake");
        assert!(g.shapes.len() >= 5);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
        assert_eq!(super::goldsmith_ramp(ColorSlot::Trim), super::C_GOLD);
    }

    #[test]
    fn goldsmith_arm_taps_the_stake() {
        use stick_engine::anim::{Ch, Pose};
        let mut top = Pose::default();
        super::goldsmith_arm(&mut top, 0.0);
        let mut hit = Pose::default();
        let cycle = super::LEATHERCRAFT_SEC / 3.0;
        super::goldsmith_arm(&mut hit, cycle * 0.45);
        assert!(top.get(Ch::RShoulder) > hit.get(Ch::RShoulder) + 20.0);
        assert_eq!(top.get(Ch::LHip), 0.0);
    }

    #[test]
    fn cook_pot_and_spoon_parse_from_ron() {
        use stick_engine::gear::Shape;
        let pot = super::cook_pot();
        assert_eq!(pot.id, "ba_cook_pot");
        assert!(pot.shapes.len() >= 5);
        let spoon = super::wood_spoon();
        assert_eq!(spoon.id, "ba_wood_spoon");
        assert!(matches!(spoon.shapes[0], Shape::Capsule { .. }));
    }

    #[test]
    fn cooking_arm_stirs_the_pot() {
        use stick_engine::anim::{Ch, Pose};
        let mut top = Pose::default();
        super::cooking_arm(&mut top, 0.0);
        let mut stir = Pose::default();
        let cycle = super::LEATHERCRAFT_SEC / 3.0;
        super::cooking_arm(&mut stir, cycle * 0.5);
        assert!(top.get(Ch::RShoulder) > stir.get(Ch::RShoulder) + 8.0);
        assert!(stir.get(Ch::RElbow) < top.get(Ch::RElbow) - 4.0);
        assert_eq!(top.get(Ch::LHip), 0.0);
    }

    #[test]
    fn craft_hammer_parses_from_ron() {
        use stick_engine::gear::Shape;
        let g = super::craft_hammer();
        assert_eq!(g.id, "ba_craft_hammer");
        assert!(g.shapes.len() >= 2);
        assert!(matches!(g.shapes[0], Shape::Capsule { .. }));
    }

    #[test]
    fn leather_workpiece_parses_from_ron() {
        use stick_engine::gear::Shape;
        let g = super::leather_workpiece();
        assert_eq!(g.id, "ba_leather_workpiece");
        assert!(matches!(g.shapes[0], Shape::Disc { .. }));
    }

    #[test]
    fn leathercraft_arm_strikes_three_times() {
        use stick_engine::anim::{Ch, Pose};
        let mut top = Pose::default();
        super::leathercraft_arm(&mut top, 0.0);
        let mut hit = Pose::default();
        let cycle = super::LEATHERCRAFT_SEC / 3.0;
        super::leathercraft_arm(&mut hit, cycle * 0.45);
        assert!(top.get(Ch::RShoulder) > hit.get(Ch::RShoulder) + 30.0, "hammer arm drops on strike");
        assert!(top.get(Ch::RWpnPitch) > hit.get(Ch::RWpnPitch) + 15.0, "hammer head drives down on strike");
        assert_eq!(top.get(Ch::LHip), 0.0);
        assert_eq!(top.get(Ch::LShoulder), 62.0, "support hand stays fixed");
        let mut windup = Pose::default();
        super::leathercraft_arm(&mut windup, cycle * 1.02);
        assert!(windup.get(Ch::RShoulder) > hit.get(Ch::RShoulder) + 20.0, "arm rises between strikes");
    }

    #[test]
    fn dig_arm_strikes_down() {
        use stick_engine::anim::{Ch, Pose};
        let mut raised = Pose::default();
        super::dig_arm(&mut raised, 0.0, true);
        let mut struck = Pose::default();
        super::dig_arm(&mut struck, 0.45, true);
        assert!(raised.get(Ch::RShoulder) > struck.get(Ch::RShoulder) + 40.0, "the arm comes down");
        assert!(struck.get(Ch::RWpnPitch) < -40.0, "the head points down at the strike");
        let mut shovel = Pose::default();
        super::dig_arm(&mut shovel, 0.45, false);
        assert!(shovel.get(Ch::RWpnPitch) < -20.0);
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
