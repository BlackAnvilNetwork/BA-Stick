// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Black Anvil's look layer on top of Stick Engine's character-anim rig.
//!
//! The engine moved to ramp palettes, `BodyParams` and an indexed `Joints`
//! array. BA-Stick keeps its own 256-colour palette (`palette.rs`) and its
//! own figure drawing, so this module holds the BA colour indices, the BA
//! `Look`/`Proportions` presets, and a named-joint view (`Fig`) built from
//! the engine's FK output.
use stick_engine::body::BodyParams;
use stick_engine::math::Vec3;
use stick_engine::rig::{Joint, Joints};

/// BA base palette (indices 0..15).
pub const PALETTE: [u32; 16] = [
    0x0d0b14, // 0 void / outline
    0x2a2633, // 1 ground dark
    0x34303f, // 2 ground light
    0x221f2a, // 3 grid line
    0x18161f, // 4 shadow
    0xe8e2d0, // 5 bone white (body)
    0xc9b98f, // 6 body far side
    0xb33939, // 7 accent red
    0x9aa6b8, // 8 steel
    0xf4f7ff, // 9 steel highlight / trail
    0x6c5a42, // 10 hilt brown
    0xd9a441, // 11 gold
    0x7d7486, // 12 dust
    0x4a4458, // 13 stone
    0x5fc4e8, // 14 dash cyan
    0x3b3546, // 15 ground mid
];
pub const C_OUTLINE: u8 = 0;
pub const C_SHADOW: u8 = 4;
pub const C_BODY: u8 = 5;
pub const C_BODY_FAR: u8 = 6;
pub const C_ACCENT: u8 = 7;
pub const C_STEEL: u8 = 8;
pub const C_TRAIL: u8 = 9;
pub const C_HILT: u8 = 10;
pub const C_GOLD: u8 = 11;
pub const C_DUST: u8 = 12;
pub const C_DASH: u8 = 14;

/// Body / far-side / accent palette indices for a figure.
#[derive(Clone, Copy, Debug)]
pub struct Look {
    pub body: u8,
    pub far: u8,
    pub accent: u8,
    pub hair: u8,
}

impl Default for Look {
    fn default() -> Self {
        Look {
            body: C_BODY,
            far: C_BODY_FAR,
            accent: C_ACCENT,
            hair: C_BODY,
        }
    }
}

/// BA proportions in metres (half widths), plus weapon length and limb px.
/// Purely visual: body shape never feeds gameplay (the server is authoritative).
#[derive(Clone, Copy, Debug)]
pub struct Proportions {
    pub thigh: f32,
    pub shin: f32,
    pub spine: f32,
    pub neck: f32,
    pub head_r: f32,
    pub upper_arm: f32,
    pub forearm: f32,
    pub shoulder_w: f32,
    pub hip_w: f32,
    pub sword: f32,
    pub limb_px: f32,
}

impl Default for Proportions {
    fn default() -> Self {
        Proportions {
            thigh: 0.46,
            shin: 0.46,
            spine: 0.52,
            neck: 0.08,
            head_r: 0.14,
            upper_arm: 0.3,
            forearm: 0.28,
            shoulder_w: 0.19,
            hip_w: 0.1,
            sword: 0.9,
            limb_px: 2.2,
        }
    }
}

impl Proportions {
    /// Engine body for FK (engine widths are full widths).
    pub fn body(&self) -> BodyParams {
        let mut b = BodyParams::default();
        b.thigh = self.thigh;
        b.shin = self.shin;
        b.torso = self.spine;
        b.neck = self.neck;
        b.head_r = self.head_r;
        b.upper_arm = self.upper_arm;
        b.forearm = self.forearm;
        b.shoulder_w = self.shoulder_w * 2.0;
        b.hip_w = self.hip_w * 2.0;
        b.limb_px = self.limb_px;
        b.height = b.computed_height();
        b
    }
}

/// Named joints ([left, right] pairs) for BA's figure drawing.
#[derive(Clone, Copy, Debug, Default)]
pub struct Fig {
    pub pelvis: Vec3,
    pub chest: Vec3,
    pub neck: Vec3,
    pub head: Vec3,
    pub hip: [Vec3; 2],
    pub knee: [Vec3; 2],
    pub foot: [Vec3; 2],
    pub shoulder: [Vec3; 2],
    pub elbow: [Vec3; 2],
    pub hand: [Vec3; 2],
    pub sword_tip: Vec3,
    pub sword_dir: Vec3,
    /// Left-hand weapon direction. The shield face is built in that frame.
    pub wpn_l: Vec3,
}

impl Fig {
    /// From engine FK; the weapon is in the right hand, `sword` metres long.
    pub fn from_joints(j: &Joints, sword: f32) -> Fig {
        use Joint::*;
        let g = |a: Joint| j.get(a);
        Fig {
            pelvis: g(Pelvis),
            chest: g(Chest),
            neck: g(Neck),
            head: g(Head),
            hip: [g(LHip), g(RHip)],
            knee: [g(LKnee), g(RKnee)],
            foot: [g(LFoot), g(RFoot)],
            shoulder: [g(LShoulder), g(RShoulder)],
            elbow: [g(LElbow), g(RElbow)],
            hand: [g(LHand), g(RHand)],
            sword_tip: j.weapon_point(1, sword),
            sword_dir: j.wpn_dir[1],
            wpn_l: j.wpn_dir[0],
        }
    }
}
