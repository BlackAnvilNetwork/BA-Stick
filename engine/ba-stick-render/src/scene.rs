// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! The renderable scene: units keyed by server id, a following camera, and a
//! framebuffer.
use std::collections::BTreeMap;

use stick_engine::anim::{AnimLibrary, Animator, Pose};
use stick_engine::body::{Personality, Sex};
use stick_engine::gait::Gait;
use stick_engine::camera::{Camera, P2};
use stick_engine::math::{angle_diff, v3, Vec3};
use stick_engine::raster::Framebuffer;
use crate::compat::*;
use stick_engine::rig;

use crate::preset::{AnimState, Body, RigPreset};
use crate::palette::*;
use crate::zone::Zone;
use crate::{creature, figure, floaters, ground, palette, props};

/// One unit update from the host (mirrors the fields of `UnitSnapshot` that
/// affect rendering).
#[derive(Clone, Debug)]
pub struct UnitInput {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    /// Facing in radians (server convention: yaw around +y, 0 = +z).
    pub facing: f32,
    pub anim: AnimState,
    pub preset: String,
}

/// Per-unit effect state computed by the host from `UnitSnapshot` +
/// timestamps each frame (keeps this crate clock-free).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct UnitFx {
    /// HP fraction 0..1, or < 0 to hide the bar.
    pub hp: f32,
    /// Cast progress 0..1, or < 0 when not casting.
    pub cast: f32,
    /// AoE telegraph radius in world units (0 = none).
    pub aoe: f32,
    /// `FX_*` bit flags.
    pub flags: u32,
    /// Opacity 0..1 (corpse fade); dithered.
    pub fade: f32,
    /// Level-up column progress 0..1, or < 0 when inactive.
    pub level_up: f32,
}

impl Default for UnitFx {
    fn default() -> Self {
        UnitFx { hp: -1.0, cast: -1.0, aoe: 0.0, flags: 0, fade: 1.0, level_up: -1.0 }
    }
}

pub const FX_SELECTED: u32 = 1;
pub const FX_HOVERED: u32 = 2;
pub const FX_SHINY: u32 = 4;
pub const FX_HOSTILE: u32 = 8;
pub const FX_SELF: u32 = 16;
/// Player-style cast (forward circle) rather than an enemy telegraph.
pub const FX_PLAYER_CAST: u32 = 32;
pub const FX_PETRIFIED: u32 = 64;
/// Gather node already harvested (greyed, no glow).
pub const FX_DEPLETED: u32 = 128;
/// Background index in preview mode (keyed to transparent).
const BACKDROP: u8 = crate::atmosphere::SKY;

struct Unit {
    pos: Vec3,
    fx: UnitFx,
    gait: f32,
    moving: f32,
    dead_t: f32,
    target: Vec3,
    yaw: f32,
    target_yaw: f32,
    anim: AnimState,
    preset_key: String,
    preset: RigPreset,
    /// Equipment look (#14).
    garb: crate::gear::Garb,
    animator: Animator,
    /// Procedural walk/run base layer (engine gait).
    walk: Gait,
    idle_t: f32,
    /// Seconds since the current anim state started (creature lunges).
    act_t: f32,
    snap: bool,
}

pub struct Scene {
    pub fb: Framebuffer,
    pub cam: Camera,
    /// Requested view: false = iso, true = 3D perspective.
    pub view3d: bool,
    lib: AnimLibrary,
    units: BTreeMap<String, Unit>,
    follow: Option<String>,
    /// Exponential smoothing rate for positions (1/s). 20 Hz snapshots →
    /// ~15 hides the step without visible lag.
    pub smoothing: f32,
    zone: Option<Zone>,
    props: Vec<props::Prop>,
    floaters: Vec<floaters::Floater>,
    pub vfx: crate::vfx::Vfx,
    /// Preview mode (#37): no ground, transparent background.
    pub backdrop: bool,
    /// Reference height subtracted from everything so the followed unit sits mid-screen.
    pub cam_y: f32,
    /// Pixels the followed unit sits above the camera's default anchor.
    pub follow_lift_px: f32,
    time: f32,
    pal: [u32; 256],
    lights: Vec<crate::atmosphere::Light>,
    /// Lighting, haze, skyline and vignette (#26).
    pub atmosphere: bool,
    /// L2 directional key light (round 1 polish). Off by default; `?keylight`.
    pub keylight: bool,
    /// Buff / ailment visuals per unit (#34).
    buffs: BTreeMap<String, crate::buffvfx::BuffFx>,
    /// Engine-drawn minimap (baked once per zone, blitted each frame).
    pub minimap: crate::minimap::Minimap,
}

impl Scene {
    pub fn new(w: usize, h: usize) -> Scene {
        Scene {
            fb: Framebuffer::new(w, h),
            cam: Camera::new(w, h),
            view3d: false,
            lib: AnimLibrary::builtin(),
            units: BTreeMap::new(),
            follow: None,
            smoothing: 15.0,
            zone: None,
            props: Vec::new(),
            floaters: Vec::new(),
            vfx: crate::vfx::Vfx::default(),
            backdrop: false,
            cam_y: 0.0,
            follow_lift_px: 40.0,
            time: 0.0,
            pal: palette::palette(),
            lights: Vec::new(),
            atmosphere: true,
            keylight: false,
            buffs: BTreeMap::new(),
            minimap: crate::minimap::Minimap::new(),
        }
    }

    pub fn width(&self) -> usize { self.fb.w }
    pub fn height(&self) -> usize { self.fb.h }
    pub fn unit_count(&self) -> usize { self.units.len() }
    pub fn has_unit(&self, id: &str) -> bool { self.units.contains_key(id) }

    /// Center the camera on a world point (x, z). Clears `follow`.
    pub fn set_camera(&mut self, x: f32, z: f32) {
        self.follow = None;
        self.cam.cx = x;
        self.cam.cz = z;
        self.cam_y = self.zone_height(x, z);
    }

    /// Load a baked zone (BAZ1). Replaces any previous zone.
    pub fn load_zone(&mut self, bytes: &[u8]) -> Result<(), String> {
        self.zone = Some(Zone::parse(bytes)?);
        self.minimap.invalidate();
        Ok(())
    }

    pub fn clear_zone(&mut self) {
        self.zone = None;
        self.props.clear();
        self.minimap.clear();
    }

    /// Load static props (BAP1). Replaces any previous set.
    pub fn load_props(&mut self, bytes: &[u8]) -> Result<usize, String> {
        self.props = props::parse(bytes)?;
        self.minimap.invalidate();
        Ok(self.props.len())
    }

    pub fn prop_count(&self) -> usize { self.props.len() }
    pub fn has_zone(&self) -> bool { self.zone.is_some() }

    /// Stand height from the zone (0 without a zone).
    pub fn zone_height(&self, x: f32, z: f32) -> f32 {
        self.zone.as_ref().map_or(0.0, |zn| zn.height_at(x, z))
    }

    pub fn zone_flags(&self, x: f32, z: f32) -> u8 {
        self.zone.as_ref().map_or(0, |zn| zn.flags_at(x, z))
    }

    /// Keep the camera on a unit (typically the local player).
    pub fn follow(&mut self, id: Option<&str>) {
        self.follow = id.map(str::to_owned);
    }

    /// Insert or update a unit. New units snap to their position; existing
    /// ones interpolate toward it.
    pub fn upsert_unit(&mut self, id: &str, u: UnitInput) {
        let target = v3(u.x, u.y, u.z);
        match self.units.get_mut(id) {
            Some(e) => {
                e.target = target;
                e.target_yaw = u.facing;
                if e.preset_key != u.preset {
                    e.preset = RigPreset::resolve(&u.preset);
                    e.preset_key = u.preset;
                }
                if e.anim != u.anim || u.anim.restarts() && e.animator.action_finished(&self.lib) {
                    e.animator.play(u.anim.action_clip(), 0.12, 1.0, u.anim.restarts());
                    e.anim = u.anim;
                    e.act_t = 0.0;
                }
            }
            None => {
                let mut animator = Animator::new();
                animator.play(u.anim.action_clip(), 0.0, 1.0, true);
                let idle = self.lib.get("idle").map(|c| c.sample(0.0)).unwrap_or_default();
                animator.update(&self.lib, 0.0, &idle);
                self.units.insert(id.to_owned(), Unit {
                    pos: target,
                    target,
                    yaw: u.facing,
                    target_yaw: u.facing,
                    anim: u.anim,
                    preset: RigPreset::resolve(&u.preset),
                    garb: crate::gear::Garb::default(),
                    preset_key: u.preset,
                    animator,
                    walk: Gait::default(),
                    idle_t: 0.0,
                    act_t: 0.0,
                    snap: true,
                    fx: UnitFx::default(),
                    gait: 0.0,
                    moving: 0.0,
                    dead_t: if u.anim == AnimState::Dead { 1.0 } else { 0.0 },
                });
            }
        }
    }

    pub fn remove_unit(&mut self, id: &str) -> bool {
        if self.follow.as_deref() == Some(id) {
            self.follow = None;
        }
        self.buffs.remove(id);
        self.units.remove(id).is_some()
    }

    /// Unit's current (interpolated) world position.
    pub fn unit_pos(&self, id: &str) -> Option<(f32, f32, f32)> {
        self.units.get(id).map(|u| (u.pos.x, u.pos.y, u.pos.z))
    }

    pub fn unit_clip(&self, id: &str) -> Option<&str> {
        self.units.get(id).map(|u| match &u.animator.action {
            Some(a) => a.clip.as_str(),
            None => u.anim.clip(),
        })
    }

    /// Advance interpolation and animation by `dt` seconds.
    /// Spawn a floating combat number over unit `id` (see `floaters::kind`).
    pub fn add_floater(&mut self, id: &str, kind: u8, value: u32) {
        let n = self.floaters.iter().filter(|f| f.unit == id && f.age < 0.25).count();
        let dx = [0.0, 7.0, -7.0, 12.0, -12.0][n % 5];
        let at = self.anchor(id).map(|(x, y, _)| (x, y));
        self.floaters.push(floaters::Floater { unit: id.to_string(), at, text: floaters::text_for(kind, value), kind, age: 0.0, dx });
        if self.floaters.len() > 48 {
            self.floaters.remove(0);
        }
    }

    pub fn floater_count(&self) -> usize { self.floaters.len() }

    /// Spawn an ability VFX step between two units (#13). `to` = None → on
    /// the caster. Flags: 1 = rising particles, 2 = strike from the sky.
    /// Returns false if the caster is unknown.
    #[allow(clippy::too_many_arguments)]
    pub fn spawn_vfx(&mut self, prim: crate::vfx::Prim, from: &str, to: Option<&str>, color: u32, count: u32, radius: f32, flags: u32) -> bool {
        let Some(a) = self.units.get(from).map(|u| u.pos) else { return false };
        let b = to.and_then(|t| self.units.get(t)).map(|u| u.pos).unwrap_or(a);
        self.spawn_vfx_at(prim, a, b, color, count, radius, flags);
        true
    }

    #[allow(clippy::too_many_arguments)]
    pub fn spawn_vfx_at(&mut self, prim: crate::vfx::Prim, a: Vec3, b: Vec3, color: u32, count: u32, radius: f32, flags: u32) {
        use crate::vfx::Prim;
        let chest = v3(0.0, 0.9, 0.0);
        let src = if flags & 2 != 0 { b + v3(0.0, 5.0, 0.0) } else { a + chest };
        let dst = match prim {
            Prim::Ring => b,
            Prim::Burst => b + v3(0.0, 0.4, 0.0),
            _ => b + chest,
        };
        self.vfx.spawn(prim, src, dst, color, count, radius, flags & 1 != 0);
    }

    pub fn vfx_count(&self) -> usize { self.vfx.count() }

    pub fn tick(&mut self, dt: f32) {
        self.time += dt;
        // Iso ↔ 3D camera blend (#19), ~0.4 s ease.
        let target = if self.view3d { 1.0 } else { 0.0 };
        self.cam.persp += (target - self.cam.persp) * (1.0 - (-8.0 * dt).exp());
        if (target - self.cam.persp).abs() < 1e-3 {
            self.cam.persp = target;
        }
        self.vfx.tick(dt);
        for f in &mut self.floaters {
            f.age += dt;
        }
        self.floaters.retain(|f| f.age < floaters::LIFE);
        let k = 1.0 - (-self.smoothing * dt).exp();
        for u in self.units.values_mut() {
            let before = u.pos;
            if u.snap {
                u.snap = false;
            } else {
                u.pos = u.pos.lerp(u.target, k);
                u.yaw += angle_diff(u.yaw, u.target_yaw) * k;
            }
            let moved = ((u.pos.x - before.x).powi(2) + (u.pos.z - before.z).powi(2)).sqrt();
            let speed = if dt > 0.0 { moved / dt } else { 0.0 };
            let want = (speed / 2.5).min(1.0);
            u.moving += (want - u.moving) * (1.0 - (-10.0 * dt).exp());
            u.gait += moved * 6.0 + dt * 1.5 * u.moving;
            if u.anim == AnimState::Dead { u.dead_t += dt / 0.45 } else { u.dead_t = 0.0 }
            // Base layer: idle clip blended into the engine's procedural gait.
            // Server walk/run states keep the legs moving even when the
            // interpolated speed is tiny (e.g. pushing against a wall).
            let gait_speed = match u.anim {
                AnimState::Walk => speed.max(1.6),
                AnimState::Run => speed.max(4.5),
                _ => speed,
            };
            let body = u.preset.props.body();
            let sx = Sex::Male.gait();
            let gait_pose = u.walk.update(dt, gait_speed, &body, &Personality::default(), &sx);
            u.idle_t += dt;
            u.act_t += dt;
            let idle_pose = self.lib.get("idle").map(|c| c.sample(u.idle_t)).unwrap_or_default();
            let m = (gait_speed / 0.8).clamp(0.0, 1.0);
            let base: Pose = idle_pose.blend(&gait_pose, m * m * (3.0 - 2.0 * m));
            u.animator.update(&self.lib, dt, &base);
        }
        if let Some(f) = self.follow.as_ref().and_then(|id| self.units.get(id)) {
            // Lift the followed unit above the engine's 55% line so the HUD
            // (hotbar + log along the bottom) does not cover the action.
            let k = self.follow_lift_px / (2.0 * stick_engine::camera::ISO_Y);
            self.cam.cx = f.pos.x + k;
            self.cam.cz = f.pos.z + k;
            let ty = f.pos.y;
            self.cam_y += (ty - self.cam_y) * (1.0 - (-6.0 * dt).exp());
        }
    }

    /// Screen pixel (framebuffer space) → ground point (x, z).
    pub fn pick_world(&self, sx: f32, sy: f32) -> (f32, f32) {
        // Iterate: unproject at the reference plane, then correct by local relief.
        let (mut x, mut z) = self.cam.unproject_ground(sx, sy);
        for _ in 0..3 {
            let dy = self.zone_height(x, z) - self.cam_y;
            let (nx, nz) = self.cam.unproject_ground(sx, sy + dy * stick_engine::camera::HEIGHT_PX);
            x = nx;
            z = nz;
        }
        (x, z)
    }

    fn rel(&self, p: Vec3) -> Vec3 {
        v3(p.x, p.y - self.cam_y, p.z)
    }

    /// Topmost unit whose body box contains the screen pixel.
    pub fn pick_unit(&self, sx: f32, sy: f32) -> Option<&str> {
        self.pick_unit_except(sx, sy, None)
    }

    /// Like `pick_unit` but ignores one id (the local player, so clicking a
    /// mob standing behind you still targets it).
    pub fn pick_unit_except(&self, sx: f32, sy: f32, skip: Option<&str>) -> Option<&str> {
        let mut best: Option<(&str, f32)> = None;
        for (id, u) in &self.units {
            if skip == Some(id.as_str()) || u.fx.fade < 0.3 {
                continue;
            }
            let feet = self.cam.project(self.rel(u.pos));
            let half_w = (body_radius(&u.preset.body) * 28.0).max(12.0);
            let height = unit_height_px(u).max(24.0);
            if (sx - feet.x).abs() <= half_w && sy <= feet.y + 6.0 && sy >= feet.y - height {
                if best.map_or(true, |(_, d)| feet.d < d) {
                    best = Some((id.as_str(), feet.d));
                }
            }
        }
        best.map(|(id, _)| id)
    }

    /// Set per-unit effect state (bars, rings, telegraphs, fade, tint).
    /// Equipment look for a unit (#14). Cosmetic only.
    pub fn set_gear(&mut self, id: &str, garb: crate::gear::Garb) -> bool {
        match self.units.get_mut(id) {
            Some(u) => { u.garb = garb; true }
            None => false,
        }
    }

    pub fn set_fx(&mut self, id: &str, fx: UnitFx) -> bool {
        match self.units.get_mut(id) {
            Some(u) => { u.fx = fx; true }
            None => false,
        }
    }

    /// True when a unit stands in open water (not on a bridge deck).
    fn wading(&self, u: &Unit) -> bool {
        if matches!(u.preset.body, Body::Node { .. }) {
            return false;
        }
        let Some(z) = &self.zone else { return false };
        z.deep_water_at(u.pos.x, u.pos.z) && u.pos.y < z.height_at(u.pos.x, u.pos.z) + 0.4
    }

    pub fn is_wading(&self, id: &str) -> bool {
        self.units.get(id).is_some_and(|u| self.wading(u))
    }

    /// Framebuffer anchors for a unit: (x, head top y, feet y), so the host
    /// can place HTML (names, NPC menus) over it.
    pub fn anchor(&self, id: &str) -> Option<(f32, f32, f32)> {
        let u = self.units.get(id)?;
        let feet = self.cam.project(self.rel(u.pos));
        Some((feet.x, feet.y - unit_height_px(u), feet.y))
    }

    /// Framebuffer position of a world point.
    pub fn world_to_screen(&self, x: f32, y: f32, z: f32) -> (f32, f32) {
        let p = self.cam.project(self.rel(v3(x, y, z)));
        (p.x, p.y)
    }

    /// Buff / ailment visual state for a unit (#34); false if unknown.
    pub fn set_buffs(&mut self, id: &str, fx: crate::buffvfx::BuffFx) -> bool {
        if !self.units.contains_key(id) {
            return false;
        }
        if fx.mask == 0 {
            self.buffs.remove(id);
        } else {
            self.buffs.insert(id.to_owned(), fx);
        }
        true
    }

    pub fn buffs(&self, id: &str) -> Option<crate::buffvfx::BuffFx> { self.buffs.get(id).copied() }

    fn buff_anchor(&self, id: &str, u: &Unit) -> crate::buffvfx::Anchor {
        let base = self.rel(u.pos);
        let seed = id.bytes().fold(2166136261u32, |h, b| (h ^ b as u32).wrapping_mul(16777619));
        crate::buffvfx::Anchor { base, feet: self.cam.project(base), h: unit_height_px(u), seed }
    }

    /// Draw the ground and all units into the framebuffer.
    pub fn draw(&mut self) {
        if let Some(z) = &self.zone {
            if self.minimap.needs_bake() && !self.backdrop {
                self.minimap.bake(z, &self.props);
            }
        }
        match &self.zone {
            _ if self.backdrop => self.fb.color.fill(BACKDROP),
            Some(z) => ground::draw_zone(&mut self.fb, &self.cam, z, self.cam_y, self.time),
            None => draw_ground(&mut self.fb, &self.cam),
        }
        self.fb.clear_depth();
        let cam = self.cam;
        let t = self.time;
        props::draw(&mut self.fb, &cam, &self.props, self.cam_y, t);
        // Contact shadows under props (S2/S3): ground-only, so after props is fine.
        if self.zone.is_some() {
            props::draw_shadows(&mut self.fb, &cam, &self.props, self.cam_y);
        }
        self.lights.clear();
        if self.zone.is_some() {
            for p in self.props.iter().filter(|p| p.kind == props::kind::FIRE_PIT) {
                let q = cam.project(v3(p.x, p.y - self.cam_y, p.z));
                let flick = 1.0 + 0.07 * (t * 13.0).sin() + 0.05 * (t * 7.3 + 1.0).sin();
                if q.x > -200.0 && q.x < self.fb.w as f32 + 200.0 && q.y > -200.0 && q.y < self.fb.h as f32 + 200.0 {
                    self.lights.push(crate::atmosphere::Light { x: q.x, y: q.y - 4.0, r: 150.0 * flick, k: 0.9 * flick });
                }
            }
        }
        let cy = self.cam_y;
        let rel = |p: Vec3| v3(p.x, p.y - cy, p.z);
        // Ground decals: buff rings (#34), telegraphs, selection / hover rings, shadows.
        for (id, bfx) in &self.buffs {
            if let Some(u) = self.units.get(id) {
                let a = self.buff_anchor(id, u);
                crate::buffvfx::draw_ground(&mut self.fb, &cam, &a, bfx, t);
            }
        }
        for u in self.units.values() {
            let c = rel(u.pos);
            let fx = u.fx;
            if fx.cast >= 0.0 {
                if fx.aoe > 0.0 && fx.flags & FX_PLAYER_CAST == 0 {
                    telegraph(&mut self.fb, &cam, c, fx.aoe, fx.cast, t);
                } else {
                    let f = v3(u.yaw.sin(), 0.0, u.yaw.cos());
                    let r = if fx.aoe > 0.0 { fx.aoe } else { 0.7 };
                    // Player casts sit slightly forward; mob single-target casts glow at the feet.
                    let fwd = fx.aoe <= 0.0 && fx.flags & FX_PLAYER_CAST != 0;
                    let at = if fwd { c + f * 0.9 } else { c };
                    ring(&mut self.fb, &cam, at, r, FX_CAST, Some(t * 2.0));
                    ring(&mut self.fb, &cam, at, r * fx.cast.clamp(0.0, 1.0), FX_CAST, None);
                }
            }
            let size = body_radius(&u.preset.body);
            if fx.flags & FX_SELECTED != 0 {
                let col = if fx.flags & FX_HOSTILE != 0 { FX_RING_HOSTILE } else if fx.flags & FX_SELF != 0 { FX_RING_SELF } else { FX_RING_FRIEND };
                ring(&mut self.fb, &cam, c, size, col, None);
                ring(&mut self.fb, &cam, c, size + 0.08, col, None);
            } else if fx.flags & FX_HOVERED != 0 {
                ring(&mut self.fb, &cam, c, size, FX_HOVER, Some(t * 1.5));
            }
            let p = cam.project(c);
            if fx.fade > 0.35 && !self.wading(u) && !matches!(u.preset.body, Body::Node { .. }) {
                crate::dither::soft_shadow_on(&mut self.fb, p.x, p.y, 13.0 * size / 0.5, 6.0 * size / 0.5, 1.0, crate::dither::UNIT_CORE, Some(p.d));
            }
        }
        // Units back to front (depth buffer also resolves overlaps).
        let mut order: Vec<&Unit> = self.units.values().collect();
        order.sort_by(|a, b| (b.pos.x + b.pos.z).partial_cmp(&(a.pos.x + a.pos.z)).unwrap_or(std::cmp::Ordering::Equal).reverse());
        for u in order {
            let base = rel(u.pos);
            let feet = cam.project(base);
            let bb = BBox::around(&self.fb, feet.x, feet.y, unit_height_px(u) + 24.0, 48.0);
            let saved = bb.save(&self.fb);
            match u.preset.body {
                Body::Biped => {
                    let mut look = u.preset.look;
                    let fk = rig::solve(&u.animator.pose, &u.preset.props.body(), base, u.yaw, u.walk.sway);
                    let mut j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                    if u.anim == AnimState::Dead {
                        figure::collapse(&mut j, base, u.yaw, u.dead_t);
                        look.accent = C_SHADOW;
                    }
                    let mut garb = u.garb;
                    if garb.weapon.is_none() {
                        garb.weapon = Some(crate::gear::WeaponLook::plain(u.preset.weapon));
                    }
                    figure::draw_garbed(&mut self.fb, &cam, &j, &u.preset.props, &look, &garb);
                }
                ref body => {
                    // Old-client melee punch (F27): non-canine mobs lunge toward their facing,
                    // snapping forward then settling, repeating while the server holds "melee".
                    let lunge = if u.anim == AnimState::Melee && !matches!(body, Body::Canine { .. } | Body::Node { .. }) {
                        melee_lunge(u.act_t)
                    } else {
                        0.0
                    };
                    let pose = creature::Pose {
                        pos: base + v3(u.yaw.sin() * lunge, 0.0, u.yaw.cos() * lunge),
                        yaw: u.yaw,
                        phase: u.gait,
                        moving: u.moving,
                        dead: if u.anim == AnimState::Dead { u.dead_t.min(1.0) } else { 0.0 },
                        time: t + u.gait * 0.01,
                        ready: u.fx.flags & FX_DEPLETED == 0,
                        attack: if u.anim == AnimState::Melee { (u.act_t / creature::LUNGE_S).min(1.0) } else { 1.0 },
                    };
                    creature::draw(&mut self.fb, &cam, body, &pose);
                }
            }
            if self.wading(u) {
                // Hide everything the unit drew below shin height, then ripple.
                let depth = if matches!(u.preset.body, Body::Biped) { WADE_DEPTH } else { 0.1 };
                let wl = cam.project(base + v3(0.0, depth, 0.0)).y.round() as usize;
                bb.restore_below(&mut self.fb, &saved, wl);
                ripple(&mut self.fb, feet.x, wl as f32, body_radius(&u.preset.body), t);
            }
            let tint = if u.fx.flags & (FX_PETRIFIED | FX_DEPLETED) != 0 || u.anim == AnimState::Dead {
                Some(TINT_STONE)
            } else if u.anim == AnimState::Cast {
                Some(TINT_CAST)
            } else if u.fx.flags & FX_SHINY != 0 && (t * 3.0).sin() > -0.2 {
                Some(TINT_SHINY)
            } else {
                None
            };
            bb.post(&mut self.fb, &saved, tint, u.fx.fade);
            if let Some(mark) = u.preset.npc_mark {
                let top = feet.y - unit_height_px(u) - 4.0 + (t * 2.0).sin() * 1.5;
                diamond(&mut self.fb, feet.x, top, mark);
            }
            if u.fx.flags & FX_SHINY != 0 {
                for k in 0..4u32 {
                    let ph = t * 1.3 + k as f32 * 1.7;
                    if ph.sin() > 0.4 {
                        let a = hash01(k * 31 + 7) * std::f32::consts::TAU;
                        let x = feet.x + a.cos() * 9.0;
                        let y = feet.y - unit_height_px(u) * hash01(k * 17 + 3);
                        sparkle(&mut self.fb, x, y, FX_LEVEL);
                    }
                }
            }
        }
        self.vfx.project(&cam, self.cam_y, &self.fb.depth, self.fb.w, self.fb.h);
        // Buff / ailment visuals over the bodies (#34).
        let bl: Vec<_> = self.buffs.iter().filter_map(|(id, b)| self.units.get(id).map(|u| (self.buff_anchor(id, u), *b))).collect();
        for (a, b) in &bl {
            crate::buffvfx::draw_body(&mut self.fb, &cam, a, b, t);
        }
        // Overlays without depth: level-up columns, HP and cast bars.
        for u in self.units.values() {
            let feet = cam.project(rel(u.pos));
            let top = feet.y - unit_height_px(u);
            if u.fx.level_up >= 0.0 {
                level_up(&mut self.fb, &cam, rel(u.pos), u.fx.level_up);
            }
            let mut y = top - 7.0;
            if u.preset.npc_mark.is_some() {
                y -= 6.0;
            }
            if u.fx.hp >= 0.0 && u.fx.fade > 0.5 {
                let col = if u.fx.hp < 0.3 { FX_HP_LOW } else { FX_HP };
                bar(&mut self.fb, feet.x, y, 20, u.fx.hp, col);
                y += 3.0;
            }
            if u.fx.cast >= 0.0 {
                bar(&mut self.fb, feet.x, y, 20, u.fx.cast, FX_CAST);
            }
        }
        // Floating combat numbers follow their unit (or stay where it vanished).
        let mut fl = std::mem::take(&mut self.floaters);
        for f in &mut fl {
            if let Some((x, y, _)) = self.anchor(&f.unit) {
                f.at = Some((x, y));
            }
            if let Some((x, y)) = f.at {
                floaters::draw(&mut self.fb, f, x, y);
            }
        }
        self.floaters = fl;
    }

    /// Minimap data from the host (names from @bellgrave/config). Re-bakes on next draw.
    pub fn set_map_title(&mut self, t: &str) {
        self.minimap.title = t.to_owned();
        self.minimap.invalidate();
    }
    pub fn add_map_road(&mut self, name: &str, pts: &[f32]) {
        let pts = pts.chunks_exact(2).map(|c| (c[0], c[1])).collect();
        self.minimap.roads.push(crate::minimap::Road { name: name.to_owned(), pts });
        self.minimap.invalidate();
    }
    pub fn add_map_label(&mut self, text: &str, x: f32, z: f32, kind: u8) {
        self.minimap.labels.push(crate::minimap::Label { text: text.to_owned(), x, z, kind });
        self.minimap.invalidate();
    }
    pub fn clear_map_data(&mut self) {
        self.minimap.roads.clear();
        self.minimap.labels.clear();
        self.minimap.invalidate();
    }

    /// Minimap centre and heading: the followed unit, else the camera.
    fn map_view(&self) -> (f32, f32, f32, Vec<crate::minimap::Marker>) {
        use crate::minimap::Marker;
        let me = self.follow.as_deref().and_then(|id| self.units.get(id));
        let (cx, cz, yaw) = me.map_or((self.cam.cx, self.cam.cz, 0.0), |u| (u.pos.x, u.pos.z, u.yaw));
        let mut marks = Vec::new();
        for (id, u) in &self.units {
            if Some(id.as_str()) == self.follow.as_deref() || matches!(u.preset.body, Body::Node { .. }) || u.anim == AnimState::Dead {
                continue;
            }
            if (u.pos.x - cx).abs() > 70.0 || (u.pos.z - cz).abs() > 70.0 {
                continue;
            }
            let kind = if u.fx.flags & FX_HOSTILE != 0 { 1 } else if u.preset.npc_mark.is_some() { 2 } else { 3 };
            marks.push(Marker { x: u.pos.x, z: u.pos.z, kind });
        }
        (cx, cz, yaw, marks)
    }

    /// Framebuffer as RGBA8 (ImageData layout).
    pub fn write_rgba(&self, out: &mut [u8]) {
        if self.atmosphere && self.zone.is_some() {
            let scroll = (self.cam.cx - self.cam.cz) * stick_engine::camera::ISO_X;
            crate::atmosphere::write_rgba_key(&self.pal, &self.fb.color, self.fb.w, self.fb.h, &self.lights, &crate::atmosphere::PALE_HOLLOW, scroll, self.keylight, out);
        } else {
            palette::write_rgba(&self.pal, &self.fb.color, out);
        }
        crate::vfx::blend(&self.vfx.sparks, self.fb.w, self.fb.h, out);
        if !self.backdrop && self.zone.is_some() && self.minimap.on {
            let (cx, cz, yaw, marks) = self.map_view();
            self.minimap.composite(out, self.fb.w, self.fb.h, cx, cz, yaw, &marks);
        }
        if self.backdrop {
            for (i, &c) in self.fb.color.iter().enumerate() {
                if c == BACKDROP {
                    out[i * 4 + 3] = 0;
                }
            }
        }
    }
}

/// Plain iso checker ground until zone data lands (#7).
fn draw_ground(fb: &mut Framebuffer, cam: &Camera) {
    let (w, h) = (fb.w, fb.h);
    let (x0, z0) = cam.unproject_ground(0.5, 0.5);
    let (x1, z1) = cam.unproject_ground(1.5, 0.5);
    let (x2, z2) = cam.unproject_ground(0.5, 1.5);
    let (dxx, dzx, dxy, dzy) = (x1 - x0, z1 - z0, x2 - x0, z2 - z0);
    for y in 0..h {
        let (mut gx, mut gz) = (x0 + dxy * y as f32, z0 + dzy * y as f32);
        for px in fb.color[y * w..(y + 1) * w].iter_mut() {
            let (tx, tz) = (gx.floor(), gz.floor());
            let (fx, fz) = (gx - tx, gz - tz);
            *px = if fx < 0.03 || fz < 0.03 { 3 } else if (tx as i32 + tz as i32) & 1 == 0 { 2 } else { 15 };
            gx += dxx;
            gz += dzx;
        }
    }
}

/// Swing period for the creature punch (old client clamps 160..420 ms).
pub const MELEE_SWING_S: f32 = 0.42;

/// Forward offset (world units) of a creature melee punch `t` seconds into the
/// melee state: 0.06 rest + 0.22 punch, fast out (35%) and eased back.
pub fn melee_lunge(t: f32) -> f32 {
    let k = (t.max(0.0) % MELEE_SWING_S) / MELEE_SWING_S;
    let punch = if k < 0.35 { k / 0.35 } else { (1.0 - (k - 0.35) / 0.65).max(0.0) };
    0.06 + punch * 0.22
}

fn unit_height_px(u: &Unit) -> f32 {
    match u.preset.body {
        Body::Biped => {
            let p = &u.preset.props;
            (p.thigh + p.shin + p.spine + p.neck) * stick_engine::camera::HEIGHT_PX + p.head_r * 2.0 * stick_engine::camera::HEIGHT_PX + 4.0
        }
        ref b => creature::height_px(b),
    }
}

/// Ground footprint radius (world units) for rings.
fn body_radius(b: &Body) -> f32 {
    match *b {
        Body::Biped => 0.5,
        Body::Quadruped { size, .. } => 0.35 + 0.35 * size,
        Body::Serpent { size, .. } => 0.55 * size,
        Body::Blob { size, .. } => 0.35 + 0.25 * size,
        Body::Canine { size } => 0.4 + 0.3 * size,
        Body::Node { .. } => 0.45,
    }
}

fn hash01(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    (x & 0xFFFF) as f32 / 65535.0
}

const BAYER4: [f32; 16] = [0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0];

/// Screen rectangle around a unit; lets us post-process only the pixels the
/// unit wrote (tint, dither fade) without a second framebuffer.
struct BBox { x0: usize, y0: usize, x1: usize, y1: usize }

impl BBox {
    fn around(fb: &Framebuffer, x: f32, feet_y: f32, up: f32, half_w: f32) -> BBox {
        let cl = |v: f32, hi: usize| (v.max(0.0) as usize).min(hi);
        BBox { x0: cl(x - half_w, fb.w), x1: cl(x + half_w, fb.w), y0: cl(feet_y - up, fb.h), y1: cl(feet_y + 14.0, fb.h) }
    }
    fn save(&self, fb: &Framebuffer) -> Vec<(u8, f32)> {
        let mut v = Vec::with_capacity((self.x1 - self.x0) * (self.y1 - self.y0));
        for y in self.y0..self.y1 {
            for x in self.x0..self.x1 {
                let i = y * fb.w + x;
                v.push((fb.color[i], fb.depth[i]));
            }
        }
        v
    }
    /// Undo the unit's pixels at or below framebuffer row `wl` (wading).
    fn restore_below(&self, fb: &mut Framebuffer, saved: &[(u8, f32)], wl: usize) {
        let mut k = 0;
        for y in self.y0..self.y1 {
            for x in self.x0..self.x1 {
                if y >= wl {
                    let i = y * fb.w + x;
                    (fb.color[i], fb.depth[i]) = saved[k];
                }
                k += 1;
            }
        }
    }

    fn post(&self, fb: &mut Framebuffer, saved: &[(u8, f32)], tint: Option<u8>, fade: f32) {
        if tint.is_none() && fade >= 1.0 {
            return;
        }
        let mut k = 0;
        for y in self.y0..self.y1 {
            for x in self.x0..self.x1 {
                let i = y * fb.w + x;
                let (c0, d0) = saved[k];
                k += 1;
                if fb.color[i] == c0 && fb.depth[i] == d0 {
                    continue;
                }
                if fade < 1.0 && (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16.0 > fade {
                    fb.color[i] = c0;
                    fb.depth[i] = d0;
                } else if let Some(tb) = tint {
                    fb.color[i] = palette::tinted(fb.color[i], tb);
                }
            }
        }
    }
}

/// Ground ring of world radius `r` (y = centre height). `dash` = rotating dashes phase.
fn ring(fb: &mut Framebuffer, cam: &Camera, c: Vec3, r: f32, col: u8, dash: Option<f32>) {
    if r <= 0.01 {
        return;
    }
    let n = (r * 40.0).clamp(24.0, 160.0) as usize;
    let pt = |a: f32| cam.project(v3(c.x + a.cos() * r, c.y, c.z + a.sin() * r));
    for i in 0..n {
        if let Some(ph) = dash {
            if ((i as f32 / n as f32 * 12.0 + ph) as i32) & 1 == 1 {
                continue;
            }
        }
        let a0 = i as f32 / n as f32 * std::f32::consts::TAU;
        let a1 = (i + 1) as f32 / n as f32 * std::f32::consts::TAU;
        let (p0, p1) = (pt(a0), pt(a1));
        fb.line(P2 { d: f32::MAX, ..p0 }, P2 { d: f32::MAX, ..p1 }, col);
    }
}

/// Enemy AoE telegraph: solid outer rune ring, counter-rotating inner dashes,
/// a filling progress ring and a rising curtain of lines at the edge.
fn telegraph(fb: &mut Framebuffer, cam: &Camera, c: Vec3, r: f32, prog: f32, t: f32) {
    ring(fb, cam, c, r * 0.72, FX_TELL, Some(-t * 3.0));
    ring(fb, cam, c, r * 0.72 - 0.05, FX_TELL_DARK, Some(t * 3.0));
    ring(fb, cam, c, (r * prog.clamp(0.0, 1.0)).max(0.05), FX_TELL, None);
    let n = (r * 10.0).clamp(10.0, 48.0) as usize;
    for i in 0..n {
        let a = i as f32 / n as f32 * std::f32::consts::TAU + t * 0.6;
        let base = v3(c.x + a.cos() * r, c.y, c.z + a.sin() * r);
        let h = (0.15 + 0.25 * ((t * 4.0 + i as f32 * 1.3).sin() * 0.5 + 0.5)) * prog.clamp(0.2, 1.0);
        let p0 = cam.project(base);
        let p1 = cam.project(base + v3(0.0, h, 0.0));
        fb.line(P2 { d: f32::MAX, ..p0 }, P2 { d: f32::MAX, ..p1 }, if i % 2 == 0 { FX_TELL } else { FX_TELL_DARK });
    }
    // Outer rune ring last so the curtain never breaks the radius line.
    ring(fb, cam, c, r - 0.06, FX_TELL_DARK, None);
    ring(fb, cam, c, r, FX_TELL, None);
}

/// Rising rings + sparks around a unit (progress 0..1).
fn level_up(fb: &mut Framebuffer, cam: &Camera, c: Vec3, prog: f32) {
    let fade = 1.0 - prog;
    for k in 0..3 {
        let h = ((prog * 1.6 + k as f32 / 3.0) % 1.0) * 2.4;
        let r = 0.7 - h * 0.18;
        ring(fb, cam, c + v3(0.0, h, 0.0), r, FX_LEVEL, if k == 1 { Some(prog * 20.0) } else { None });
    }
    for k in 0..14u32 {
        if hash01(k * 13 + 1) > fade + 0.2 {
            continue;
        }
        let a = hash01(k * 7 + 2) * std::f32::consts::TAU;
        let rr = 0.25 + hash01(k * 5 + 3) * 0.5;
        let h = ((prog * (1.0 + hash01(k) * 1.5) + hash01(k * 3 + 9)) % 1.0) * 2.6;
        let p = cam.project(c + v3(a.cos() * rr, h, a.sin() * rr));
        sparkle(fb, p.x, p.y, if k % 3 == 0 { C_TRAIL } else { FX_LEVEL });
    }
}

fn put(fb: &mut Framebuffer, x: i32, y: i32, c: u8) {
    if x >= 0 && y >= 0 && (x as usize) < fb.w && (y as usize) < fb.h {
        fb.color[y as usize * fb.w + x as usize] = c;
    }
}

fn sparkle(fb: &mut Framebuffer, x: f32, y: f32, c: u8) {
    let (x, y) = (x as i32, y as i32);
    put(fb, x, y, c);
    put(fb, x - 1, y, c);
    put(fb, x + 1, y, c);
    put(fb, x, y - 1, c);
    put(fb, x, y + 1, c);
}

fn diamond(fb: &mut Framebuffer, x: f32, y: f32, c: u8) {
    let (x, y) = (x as i32, y as i32);
    for dy in -3i32..=3 {
        let w = 3 - dy.abs();
        for dx in -w..=w {
            let edge = dx.abs() == w;
            put(fb, x + dx, y + dy, if edge { C_OUTLINE } else { c });
        }
    }
}

/// Screen-space bar centred on x with a 1 px dark frame.
fn bar(fb: &mut Framebuffer, cx: f32, y: f32, w: i32, frac: f32, col: u8) {
    let x0 = cx as i32 - w / 2;
    let y0 = y as i32;
    for dy in -1..=2 {
        for dx in -1..=w {
            put(fb, x0 + dx, y0 + dy, C_OUTLINE);
        }
    }
    let fill = (frac.clamp(0.0, 1.0) * w as f32).round() as i32;
    for dy in 0..2 {
        for dx in 0..w {
            put(fb, x0 + dx, y0 + dy, if dx < fill { col } else { FX_BAR_BG });
        }
    }
}

/// How deep units sink when wading (world units; ≈ shin height).
pub const WADE_DEPTH: f32 = 0.3;

/// Animated ripple ellipse at the water line around a wading unit.
fn ripple(fb: &mut Framebuffer, cx: f32, cy: f32, size: f32, t: f32) {
    for k in 0..2 {
        let ph = ((t * 0.9 + k as f32 * 0.5) % 1.0) as f32;
        let (rx, ry) = ((9.0 + ph * 8.0) * size / 0.5, (3.5 + ph * 3.0) * size / 0.5);
        if ph > 0.75 && k == 1 {
            continue;
        }
        let n = 40;
        for i in 0..n {
            let a = i as f32 / n as f32 * std::f32::consts::TAU;
            let (x, y) = ((cx + a.cos() * rx) as i32, (cy + a.sin() * ry) as i32);
            if x >= 0 && y >= 0 && (x as usize) < fb.w && (y as usize) < fb.h && (i + k) % 3 != 0 {
                let i2 = y as usize * fb.w + x as usize;
                if fb.depth[i2] == f32::INFINITY {
                    fb.color[i2] = WATER + 3;
                }
            }
        }
    }
}

#[cfg(test)]
mod lunge_tests {
    use super::*;

    #[test]
    fn creature_melee_punch_snaps_forward_and_repeats() {
        assert!((melee_lunge(0.0) - 0.06).abs() < 1e-5);
        let peak = melee_lunge(MELEE_SWING_S * 0.35);
        assert!((peak - 0.28).abs() < 1e-4);
        assert!(melee_lunge(MELEE_SWING_S * 0.9) < peak);
        assert!((melee_lunge(MELEE_SWING_S + 0.01) - melee_lunge(0.01)).abs() < 1e-4);
    }

    #[test]
    fn hare_moves_forward_while_meleeing() {
        let draw = |anim: AnimState, t: f32| {
            let mut s = Scene::new(200, 160);
            s.atmosphere = false;
            s.upsert_unit("h", UnitInput { x: 0.0, y: 0.0, z: 0.0, facing: 0.0, anim, preset: "mob:dust_hare".into() });
            s.set_camera(0.0, 0.0);
            s.tick(t);
            s.draw();
            s.fb.color.clone()
        };
        let idle = draw(AnimState::Idle, MELEE_SWING_S * 0.35);
        let hit = draw(AnimState::Melee, MELEE_SWING_S * 0.35);
        assert_ne!(idle, hit);
    }
}
