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
use stick_engine::camrig::{CamConfig, CamMode, CamRig, Subject, FP_HIDE_RADIUS};
use stick_engine::math::{angle_diff, v3, wrap_angle, Vec3};
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
    /// Battle Mage en-spell on blade: 0 none, 1 fire, 2 ice, 3 thunder.
    pub weapon_edge: u8,
}

impl Default for UnitFx {
    fn default() -> Self {
        UnitFx {
            hp: -1.0,
            cast: -1.0,
            aoe: 0.0,
            flags: 0,
            fade: 1.0,
            level_up: -1.0,
            weapon_edge: 0,
        }
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
pub const FX_MOB: u32 = 256;
/// Background index in preview mode (keyed to transparent).
const BACKDROP: u8 = crate::atmosphere::SKY;

#[inline]
fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

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
    /// Stride speed, eased so a 20 Hz snapshot does not pulse the step.
    leg_speed: f32,
    idle_t: f32,
    /// Seconds since the current anim state started (creature lunges).
    act_t: f32,
    /// Rising embers off en-spelled weapons (forge menu cadence).
    weapon_edge_emit: f32,
    snap: bool,
    /// Dash afterimages: (position, life). Empty unless the unit dashed.
    ghosts: Vec<(Vec3, f32)>,
    ghost_emit: f32,
    /// Client-predicted dash for the own unit; server snapshots retarget its end.
    pred: Option<DashPred>,
    /// Latest server position while `pred` drives `target`.
    server_target: Vec3,
}

#[derive(Clone, Copy, Debug)]
struct DashPred {
    from: Vec3,
    to: Vec3,
    t: f32,
    dur: f32,
}

/// After the predicted dash ends, hold its landing this long before the server owns the unit again.
const DASH_PRED_HOLD: f32 = 0.12;

/// Stick Engine's dash trail: one afterimage per `GHOST_EVERY`, each fading over `GHOST_LIFE`.
pub(crate) const GHOST_EVERY: f32 = 0.04;
pub(crate) const GHOST_LIFE: f32 = 0.25;

/// Head centre above the feet, matching the reference biped (`thigh+shin+torso+neck+head_r`).
const HEAD_Y: f32 = 1.63;
/// First-person view-model offset (m): forearms and weapon pushed ahead of
/// and below the eye so nothing is drawn against the lens.
const FP_VIEWMODEL_FWD: f32 = 0.45;
const FP_VIEWMODEL_DOWN: f32 = 0.25;

pub struct Scene {
    pub fb: Framebuffer,
    pub cam: Camera,
    /// Iso (default), third-person, or first-person. Gameplay stays on the ground.
    rig: CamRig,
    /// Held look, −1..1. Yaw is a camera bias on top of the character's facing
    /// (positive = turn right). Pitch is passed to the rig (positive = look down).
    look_yaw: f32,
    look_pitch: f32,
    /// Extra yaw so numpad / mouse look orbits without a server facing message.
    yaw_bias: f32,
    /// Client-side WASD heading (radians) in third/first person. The camera
    /// and the followed figure face it; iso ignores it.
    heading: Option<f32>,
    lib: AnimLibrary,
    units: BTreeMap<String, Unit>,
    follow: Option<String>,
    /// Exponential smoothing rate for positions (1/s). 20 Hz snapshots →
    /// ~15 hides the step without visible lag.
    pub smoothing: f32,
    zone: Option<Zone>,
    props: Vec<props::Prop>,
    /// Every zone drawn together, already shifted into world coordinates.
    /// The minimap zone above stays in that zone's local coordinates.
    world: Vec<Zone>,
    world_props: Vec<props::Prop>,
    /// Subtracted from unit positions for the local-space minimap.
    map_ox: f32,
    map_oz: f32,
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
    /// Extra third-person boom pitch that keeps the eye out of the terrain.
    boom_lift: f32,
    /// `cam.persp` was last written by the CamRig (3D rail), not a caller.
    rig_persp: bool,
    /// L2 directional key light (round 1 polish). Off by default; `?keylight`.
    pub keylight: bool,
    /// Buff / ailment visuals per unit (#34).
    buffs: BTreeMap<String, crate::buffvfx::BuffFx>,
    /// Engine-drawn minimap (baked once per zone, blitted each frame).
    pub minimap: crate::minimap::Minimap,
    /// Boot menu: transparent canvas + forge embers over a still backdrop.
    pub boot_menu: bool,
    boot_menu_emit: f32,
    /// Pale Hollow weather spell being blended toward (0 clear, 1 rain, 2 fog, 3 snow).
    weather_kind_from: u8,
    weather_kind_to: u8,
    weather_blend: f32,
    /// Snow depth on ground and trees (0..1), eased toward server target.
    pub weather_snow: f32,
    weather_snow_target: f32,
    /// Frame clock for precipitation (f64 avoids long-session banding).
    weather_time: f64,
    /// Time of day 0..1 (0 midnight, 0.5 noon) from the host's shared wall clock.
    day_phase: f32,
    /// Per pixel: unit colour + 1 where a unit was drawn this frame, else 0.
    pub(crate) unit_px: Vec<u16>,
    /// Floating combat-number pixels `(pixel, FN_* index)`. The FN_* indices
    /// share palette slots with the meadow grass, so these are resolved from
    /// `palette::FLOAT` after lighting instead of through the palette.
    pub(crate) float_px: Vec<(u32, u8)>,
    /// Local player hair style and colours (Stick Engine cosmetics).
    player_appearance: crate::appearance::Appearance,
    player_hair_spring: [stick_engine::character::HairSpring; 3],
}

impl Scene {
    pub fn new(w: usize, h: usize) -> Scene {
        let mut lib = AnimLibrary::builtin();
        lib.register_ron(include_str!("../assets/clips/rest.ron")).expect("rest clip");
        Scene {
            fb: Framebuffer::new(w, h),
            cam: Camera::new(w, h),
            rig: CamRig::new(CamConfig::default()),
            look_yaw: 0.0,
            look_pitch: 0.0,
            yaw_bias: 0.0,
            heading: None,
            lib,
            units: BTreeMap::new(),
            follow: None,
            smoothing: 15.0,
            zone: None,
            props: Vec::new(),
            world: Vec::new(),
            world_props: Vec::new(),
            map_ox: 0.0,
            map_oz: 0.0,
            floaters: Vec::new(),
            vfx: crate::vfx::Vfx::default(),
            backdrop: false,
            cam_y: 0.0,
            follow_lift_px: 40.0,
            time: 0.0,
            pal: palette::palette(),
            lights: Vec::new(),
            atmosphere: true,
            boom_lift: 0.0,
            rig_persp: false,
            keylight: false,
            buffs: BTreeMap::new(),
            minimap: crate::minimap::Minimap::new(),
            boot_menu: false,
            boot_menu_emit: 0.0,
            weather_kind_from: 0,
            weather_kind_to: 0,
            weather_blend: 1.0,
            weather_snow: 0.0,
            weather_snow_target: 0.0,
            weather_time: 0.0,
            day_phase: 0.5,
            unit_px: Vec::new(),
            float_px: Vec::new(),
            player_appearance: crate::appearance::Appearance::default(),
            player_hair_spring: [stick_engine::character::HairSpring::default(); 3],
        }
    }

    /// Live pixel forge menu: procedural cavern, hero idle, embers.
    pub fn set_boot_menu(&mut self, on: bool) {
        self.boot_menu = on;
        self.boot_menu_emit = 0.0;
        if !on {
            return;
        }
        self.backdrop = false;
        self.atmosphere = false;
        self.keylight = false;
        self.minimap.on = false;
        self.minimap.full = false;
        self.follow = None;
        self.buffs.clear();
        self.world.clear();
        self.world_props.clear();
        self.set_cam_mode("iso");
        self.look_yaw = 0.0;
        self.look_pitch = 0.0;
        self.units.clear();
        self.follow_lift_px = 56.0;
        self.cam.cx = 0.0;
        self.cam.cz = 4.0;
        self.cam_y = 0.55;
        self.yaw_bias = -0.12;
    }

    fn tick_boot_menu_vfx(&mut self, dt: f32) {
        self.boot_menu_emit += dt;
        while self.boot_menu_emit >= 0.07 {
            self.boot_menu_emit -= 0.07;
            let n = (self.time * 24.0) as i32;
            let sources = crate::boot_forge::particle_sources();
            if n.rem_euclid(4) == 0 {
                self.vfx.menu_forge_haze(crate::boot_forge::mid_chamber_vfx_origin(
                    n + 41,
                    self.time + 0.15,
                ));
            }
            if n % 8 == 0 {
                self.vfx.menu_forge_ember(sources[(n.rem_euclid(6)) as usize]);
            }
            if n % 17 == 0 {
                self.vfx
                    .menu_forge_twinkle(crate::boot_forge::distant_twinkle_origin(n + 53, self.time));
            }
        }
    }

    fn tick_boot_menu_units(&mut self, dt: f32) {
        let k = 1.0 - (-9.0 * dt).exp();
        for u in self.units.values_mut() {
            u.idle_t += dt;
            u.act_t += dt;
            u.pos = u.pos.lerp(u.target, k);
            u.yaw += angle_diff(u.yaw, u.target_yaw) * k;

            let body = u.preset.props.body();
            if u.anim == AnimState::Walk {
                let gait_pose = u.walk.update(dt, 1.05, &body, &Personality::default(), &Sex::Male.gait());
                u.animator.update(&self.lib, dt, &gait_pose);
                let dx = u.target.x - u.pos.x;
                let dz = u.target.z - u.pos.z;
                if dx * dx + dz * dz < 0.025 {
                    u.anim = AnimState::Idle;
                    u.animator.play(AnimState::Idle.action_clip(), 0.18, 1.0, true);
                }
                continue;
            }
            let gait_pose = u.walk.update(dt, 0.0, &body, &Personality::default(), &Sex::Male.gait());
            let idle_pose = self.lib.get("idle").map(|c| c.sample(u.idle_t)).unwrap_or_default();
            let base: Pose = idle_pose.blend(&gait_pose, 0.0);
            u.animator.update(&self.lib, dt, &base);
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
    pub fn has_zone(&self) -> bool { self.zone.is_some() || !self.world.is_empty() }

    /// Add a zone to the concurrent world. `ox`/`oz` shift its grid into world space.
    /// Does not replace zones already placed, and does not change the minimap zone.
    pub fn place_zone(&mut self, bytes: &[u8], ox: f32, oz: f32) -> Result<(), String> {
        let mut zone = Zone::parse(bytes)?;
        zone.min_x += ox;
        zone.min_z += oz;
        self.world.push(zone);
        Ok(())
    }

    /// Props for a placed zone. Positions are shifted by the same origin as `place_zone`.
    pub fn place_props(&mut self, bytes: &[u8], ox: f32, oz: f32) -> Result<usize, String> {
        let mut placed = props::parse(bytes)?;
        for p in &mut placed {
            p.x += ox;
            p.z += oz;
        }
        let n = placed.len();
        self.world_props.extend(placed);
        Ok(n)
    }

    /// Local-space origin of the zone the minimap is showing.
    pub fn set_map_origin(&mut self, ox: f32, oz: f32) {
        self.map_ox = ox;
        self.map_oz = oz;
    }

    /// Zone grid that contains a world point. Placed zones win over the minimap copy.
    fn zone_at(&self, x: f32, z: f32) -> Option<&Zone> {
        if !self.world.is_empty() {
            return self.world.iter().find(|zn| zn.contains_point(x, z));
        }
        self.zone.as_ref()
    }

    #[cfg(test)]
    pub(crate) fn set_zone_for_test(&mut self, z: Zone) { self.zone = Some(z); }

    /// Stand height from the zone (0 without a zone).
    pub fn zone_height(&self, x: f32, z: f32) -> f32 {
        self.zone_at(x, z).map_or(0.0, |zn| zn.height_at(x, z))
    }

    pub fn zone_flags(&self, x: f32, z: f32) -> u8 {
        self.zone_at(x, z).map_or(0, |zn| zn.flags_at(x, z))
    }

    /// Keep the camera on a unit (typically the local player).
    pub fn follow(&mut self, id: Option<&str>) {
        self.follow = id.map(str::to_owned);
    }

    /// Insert or update a unit. New units snap to their position; existing
    /// ones interpolate toward it.
    /// Predict (or retarget) a dash for unit `id` to (x, z) over `secs`. A
    /// running prediction keeps its start and timing and only moves its end,
    /// so the server's wall-clipped landing blends in mid-flight.
    pub fn predict_dash(&mut self, id: &str, x: f32, z: f32, secs: f32) {
        if let Some(u) = self.units.get_mut(id) {
            let to = v3(x, u.server_target.y, z);
            match u.pred.as_mut() {
                Some(p) => p.to = to,
                None => u.pred = Some(DashPred { from: u.pos, to, t: 0.0, dur: secs.max(0.05) }),
            }
        }
    }
    /// Drop a prediction the server refused; the unit eases back to the server position.
    pub fn cancel_dash(&mut self, id: &str) {
        if let Some(u) = self.units.get_mut(id) {
            if u.pred.take().is_some() {
                u.target = u.server_target;
            }
        }
    }

    pub fn upsert_unit(&mut self, id: &str, u: UnitInput) {
        let target = v3(u.x, u.y, u.z);
        match self.units.get_mut(id) {
            Some(e) => {
                // A zone hand-off jumps hundreds of metres. Interpolating that
                // slides the figure across empty sky. Snap instead.
                if (e.pos.x - target.x).abs().max((e.pos.z - target.z).abs()) > 24.0 {
                    e.pos = target;
                    e.yaw = u.facing;
                }
                e.server_target = target;
                if e.pred.is_none() {
                    e.target = target;
                }
                e.target_yaw = u.facing;
                if e.preset_key != u.preset {
                    e.preset = RigPreset::resolve(&u.preset);
                    e.preset_key = u.preset;
                }
                if e.anim != u.anim || u.anim.restarts() && e.animator.action_finished(&self.lib) {
                    let blend = if e.anim == AnimState::Rest || u.anim == AnimState::Rest { 0.4 } else { 0.12 };
                    e.animator.play(u.anim.action_clip(), blend, 1.0, u.anim.restarts());
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
                    leg_speed: 0.0,
                    idle_t: 0.0,
                    act_t: 0.0,
                    weapon_edge_emit: 0.0,
                    snap: true,
                    ghosts: Vec::new(),
                    ghost_emit: 0.0,
                    pred: None,
                    server_target: target,
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

    /// `iso`, `tp`/`third`/`3d`, or `fp`/`first`. Unknown values are ignored.
    pub fn set_cam_mode(&mut self, mode: &str) {
        let Some(mode) = CamMode::parse(mode).or(match mode {
            "3d" => Some(CamMode::ThirdPerson),
            _ => None,
        }) else {
            return;
        };
        // Look bias from an earlier 3D session must not carry into a new one.
        if self.rig.mode == CamMode::Iso && mode != CamMode::Iso {
            self.yaw_bias = 0.0;
        }
        let s = self.subject();
        let cur = self.cam.effective_view();
        self.rig.set_mode(mode, &s, cur);
    }

    pub fn cam_mode(&self) -> &'static str {
        match self.rig.mode {
            CamMode::Iso => "iso",
            CamMode::ThirdPerson => "tp",
            CamMode::FirstPerson => "fp",
        }
    }

    /// Camera yaw currently in effect (character facing plus look bias, smoothed).
    pub fn cam_yaw(&self) -> f32 { self.rig.yaw }

    /// Held numpad look. Ignored while isometric. `yaw`/`pitch` are −1..1.
    pub fn set_look(&mut self, yaw: f32, pitch: f32) {
        self.look_yaw = yaw.clamp(-1.0, 1.0);
        self.look_pitch = pitch.clamp(-1.0, 1.0);
    }

    /// Right-drag look in framebuffer pixels. Ignored while isometric.
    pub fn add_look(&mut self, dx: f32, dy: f32) {
        if self.rig.mode == CamMode::Iso {
            return;
        }
        self.yaw_bias = wrap_angle(self.yaw_bias - dx * stick_engine::game::MOUSE_TURN);
        let lim = self.rig.cfg.fp_pitch_limit_deg.to_radians();
        self.rig.fp_pitch = (self.rig.fp_pitch + dy * stick_engine::game::MOUSE_PITCH).clamp(-lim, lim);
    }

    /// Client-side WASD heading for third/first person (`None` = follow the
    /// server facing, as iso always does).
    pub fn set_heading(&mut self, heading: Option<f32>) {
        self.heading = heading.filter(|h| h.is_finite()).map(wrap_angle);
    }

    pub fn heading(&self) -> Option<f32> { self.heading }

    /// Heading in effect for the camera and the followed figure.
    fn active_heading(&self) -> Option<f32> {
        if self.rig.mode == CamMode::Iso { None } else { self.heading }
    }

    /// First person once the rig has settled there. The eye trails the head a
    /// little while walking, so a pure distance test let the body (and its
    /// red neck disc) pop in right in front of the lens.
    fn fp_locked(&self) -> bool {
        self.rig.mode == CamMode::FirstPerson && self.rig.t >= 1.0 && self.cam.view.is_some()
    }

    /// True once the eye is inside the followed head (body should not be drawn).
    pub fn first_person(&self) -> bool {
        if self.fp_locked() {
            return true;
        }
        let Some(eye) = self.cam.view.and_then(|v| v.eye()) else { return false };
        (eye - self.subject().head).len() < FP_HIDE_RADIUS
    }

    fn subject(&self) -> Subject {
        let (x, y, z, yaw) = match self.follow.as_deref().and_then(|id| self.units.get(id)) {
            Some(u) => (u.pos.x, u.pos.y - self.cam_y, u.pos.z, u.yaw),
            None => (self.cam.cx, 0.0, self.cam.cz, 0.0),
        };
        let yaw = self.active_heading().unwrap_or(yaw);
        Subject {
            pos: v3(x, y, z),
            yaw: wrap_angle(yaw + self.yaw_bias),
            head: v3(x, y + HEAD_Y, z),
        }
    }

    fn step_camera(&mut self, dt: f32) {
        if self.rig.mode != CamMode::Iso {
            self.yaw_bias = wrap_angle(self.yaw_bias - self.look_yaw * self.rig.cfg.look_speed * dt);
        }
        let s = self.subject();
        let (w, h) = (self.cam.w, self.cam.h);
        self.rig.update(dt, self.look_pitch, &s, self.cam.cx, self.cam.cz, w, h);
        self.cam.view = match self.rig.view {
            Some(v) => {
                let (lift, _) = self.boom_clear_of_ground(v, 0.0);
                // Rise at once (no frame inside a hill), settle back smoothly.
                self.boom_lift = lift.max(self.boom_lift * (-dt * 3.0).exp());
                Some(self.boom_clear_of_ground(v, self.boom_lift).1)
            }
            None => {
                self.boom_lift = 0.0;
                None
            }
        };
        // Legacy iso follow lift uses `cam.persp`; keep it in sync with the 3D rail.
        // Only undo a persp the rig set, so a caller-set legacy blend survives in iso.
        if self.cam.view.is_some() {
            self.cam.persp = self.rig.r.min(1.0);
            self.rig_persp = true;
        } else if self.rig_persp {
            self.cam.persp = 0.0;
            self.rig_persp = false;
        }
    }

    /// Third-person boom collision: pull the eye in toward the target until
    /// the boom clears the terrain. Without it the eye sinks into hills and
    /// slopes and the frame shows sky (the inside of the heightfield) where
    /// the ground should be. Iso (`view == None`) never gets here.
    /// Returns the extra pitch the boom needs and the view with `lift` (at
    /// least) applied, pulled in if it is still blocked.
    fn boom_clear_of_ground(&self, v: stick_engine::camera::View, lift: f32) -> (f32, stick_engine::camera::View) {
        if v.inv_d <= 0.0 || (self.zone.is_none() && self.world.is_empty()) {
            return (0.0, v);
        }
        let d = 1.0 / v.inv_d;
        if !(0.5..=20.0).contains(&d) {
            // Past 20 m: iso -> tp dolly, the eye is still far above the scene.
            // Under 0.5 m: first person, the eye is the head.
            return (0.0, v);
        }
        const CLEAR: f32 = 0.35;
        const PAD: f32 = 0.4;
        // `pad` widens the probe at the eye so the near plane does not graze a wall.
        let ground = |x: f32, z: f32, pad: f32| {
            let mut m = self.zone_height(x, z);
            if pad > 0.0 {
                for (dx, dz) in [(pad, 0.0), (-pad, 0.0), (0.0, pad), (0.0, -pad)] {
                    m = m.max(self.zone_height(x + dx, z + dz));
                }
            }
            m - self.cam_y
        };
        // Longest clear boom length for a view direction.
        let clear_len = |v: &stick_engine::camera::View| {
            let f = v.fwd();
            let step = 0.1;
            let mut t = 0.3f32.min(d);
            while t < d + 1e-4 {
                let p = v.target - f * t.min(d);
                let pad = if t >= d - 1.0 { PAD } else { 0.0 };
                if p.y < ground(p.x, p.z, pad) + CLEAR {
                    return (t - step).max(0.3f32.min(d));
                }
                t += step;
            }
            d
        };
        let max_pitch = 80f32.to_radians();
        let lifted = |l: f32| {
            let mut w = v;
            w.pitch = (v.pitch + l).min(max_pitch.max(v.pitch));
            w
        };
        // First swing the boom up over the obstacle (keeps the framing
        // distance), then, under an overhang or in a cleft, pull it in.
        let mut need = 0.0;
        let mut best = (clear_len(&lifted(lift)), lift);
        if best.0 < d - 1e-4 {
            for k in 1..=16 {
                let l = lift.max(k as f32 * 5f32.to_radians());
                let len = clear_len(&lifted(l));
                if len > best.0 + 1e-4 {
                    best = (len, l);
                }
                if len >= d - 1e-4 {
                    break;
                }
            }
        }
        if best.1 > lift {
            need = best.1;
        } else if lift == 0.0 {
            need = 0.0;
        }
        let mut w = lifted(best.1);
        if best.0 < d - 1e-4 {
            w.scale *= d / best.0;
            w.inv_d = 1.0 / best.0;
        }
        (need, w)
    }

    pub fn tick(&mut self, dt: f32) {
        self.time += dt;
        self.weather_time += dt as f64;
        self.tick_weather(dt);
        self.vfx.tick(dt);
        if self.boot_menu {
            self.tick_boot_menu_vfx(dt);
            self.tick_boot_menu_units(dt);
            if let Some(u) = self.units.get("menu_hero") {
                let k = self.follow_lift_px / (2.0 * stick_engine::camera::ISO_Y);
                self.cam.cx = u.pos.x + k;
                self.cam.cz = u.pos.z + k;
                self.cam_y += (u.pos.y - self.cam_y) * (1.0 - (-6.0 * dt).exp());
            }
            self.step_camera(dt);
            return;
        }
        for f in &mut self.floaters {
            f.age += dt;
        }
        self.floaters.retain(|f| f.age < floaters::LIFE);
        let k = 1.0 - (-self.smoothing * dt).exp();
        let follow_id = self.follow.clone();
        let cam_y = self.cam_y;
        let heading = self.active_heading();
        for (id, u) in self.units.iter_mut() {
            if let Some(h) = heading.filter(|_| follow_id.as_deref() == Some(id.as_str())) {
                u.target_yaw = h;
            }
            let before = u.pos;
            if let Some(p) = u.pred.as_mut() {
                p.t += dt;
                if p.t >= p.dur + DASH_PRED_HOLD {
                    u.pred = None;
                    u.target = u.server_target;
                } else {
                    let k = dash_ease(p.t / p.dur);
                    u.target = v3(p.from.x + (p.to.x - p.from.x) * k, u.server_target.y, p.from.z + (p.to.z - p.from.z) * k);
                }
            }
            if !u.ghosts.is_empty() || u.anim == AnimState::Dash {
                for g in u.ghosts.iter_mut() {
                    g.1 -= dt;
                }
                u.ghosts.retain(|g| g.1 > 0.0);
                if u.anim == AnimState::Dash {
                    u.ghost_emit -= dt;
                    if u.ghost_emit <= 0.0 && u.ghosts.len() < 8 {
                        u.ghosts.push((u.pos, GHOST_LIFE));
                        u.ghost_emit = GHOST_EVERY;
                    }
                } else {
                    u.ghost_emit = 0.0;
                }
            }
            if u.snap {
                u.snap = false;
            } else {
                u.pos = u.pos.lerp(u.target, k);
                u.yaw += angle_diff(u.yaw, u.target_yaw) * k;
            }
            let moved = ((u.pos.x - before.x).powi(2) + (u.pos.z - before.z).powi(2)).sqrt();
            let measured = if dt > 0.0 { moved / dt } else { 0.0 };
            let want = (measured / 2.5).min(1.0);
            u.moving += (want - u.moving) * (1.0 - (-10.0 * dt).exp());
            u.gait += moved * 6.0 + dt * 1.5 * u.moving;
            if u.anim == AnimState::Dead { u.dead_t += dt / 0.45 } else { u.dead_t = 0.0 }
            // Base layer: idle clip blended into the engine's procedural gait.
            // The legs follow an eased speed. The raw frame delta surges every
            // snapshot and would make the stride speed up and slow down.
            u.leg_speed += (measured - u.leg_speed) * (1.0 - (-8.0 * dt).exp());
            let gait_speed = match u.anim {
                AnimState::Walk => u.leg_speed.max(1.6),
                AnimState::Run => u.leg_speed.max(4.5),
                AnimState::Harvest | AnimState::Mine | AnimState::Leathercraft | AnimState::Smithing | AnimState::Cooking | AnimState::Goldsmithing => 0.0,
                _ => u.leg_speed,
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
            if u.anim == AnimState::Leathercraft {
                figure::leathercraft_arm(&mut u.animator.pose, u.act_t);
            } else if u.anim == AnimState::Smithing {
                let prev_act = u.act_t - dt;
                figure::smithing_arm(&mut u.animator.pose, u.act_t);
                if figure::smithing_strike_impact(u.act_t, prev_act) {
                    let fk = rig::solve(&u.animator.pose, &body, u.pos, u.yaw, u.walk.sway);
                    let j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                    let at = figure::smithing_anvil_strike_world(&j, u.pos.y);
                    self.vfx.smithing_rod_burst(at);
                }
            } else if u.anim == AnimState::Cooking {
                let prev_act = u.act_t - dt;
                figure::cooking_arm(&mut u.animator.pose, u.act_t);
                let fk = rig::solve(&u.animator.pose, &body, u.pos, u.yaw, u.walk.sway);
                let j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                if (u.act_t * 8.0) as i32 != ((u.act_t - dt) * 8.0) as i32 {
                    self.vfx
                        .cooking_fire_flicker(figure::cooking_fire_world(&j, u.pos.y));
                }
                if figure::cooking_strike_impact(u.act_t, prev_act) {
                    let at = figure::cooking_pot_strike_world(&j, u.pos.y);
                    self.vfx.cooking_ember_burst(at);
                }
            } else if u.anim == AnimState::Goldsmithing {
                let prev_act = u.act_t - dt;
                figure::goldsmith_arm(&mut u.animator.pose, u.act_t);
                if figure::goldsmith_strike_impact(u.act_t, prev_act) {
                    let fk = rig::solve(&u.animator.pose, &body, u.pos, u.yaw, u.walk.sway);
                    let j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                    let at = figure::goldsmith_stake_strike_world(&j, u.pos.y);
                    self.vfx.goldsmith_spark_burst(at);
                }
            } else if matches!(u.anim, AnimState::Harvest | AnimState::Mine) {
                figure::dig_arm(&mut u.animator.pose, u.act_t, u.anim == AnimState::Mine);
            }
            if u.fx.weapon_edge == 1 {
                u.weapon_edge_emit += dt;
                const EDGE_EMIT: f32 = 0.07;
                while u.weapon_edge_emit >= EDGE_EMIT {
                    u.weapon_edge_emit -= EDGE_EMIT;
                    let draw_base = v3(u.pos.x, u.pos.y - cam_y, u.pos.z);
                    let fk = rig::solve(&u.animator.pose, &body, draw_base, u.yaw, u.walk.sway);
                    let j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                    let planted = u.anim == AnimState::Rest;
                    let swinging = matches!(u.anim, AnimState::Melee | AnimState::Cast);
                    let w = u
                        .garb
                        .weapon
                        .unwrap_or(crate::gear::WeaponLook::plain(u.preset.weapon));
                    let lay = figure::pixel_sword_layout(&w);
                    let pixel_sword = lay.is_some();
                    let frame = figure::sword_blade_frame(
                        &j,
                        draw_base.y,
                        planted,
                        swinging,
                        pixel_sword,
                        lay.as_ref(),
                    );
                    let to_world = |p: Vec3| v3(p.x, p.y + cam_y, p.z);
                    let (bh, bs) = lay
                        .map(|l| (l.blade_half, l.blade.0))
                        .unwrap_or((figure::SWORD_BLADE_HALF, figure::SWORD_BLADE.0));
                    let sources = figure::sword_forge_particle_sources(&frame, bh, bs);
                    for at in sources {
                        self.vfx.sword_edge_ember(to_world(at), frame.dir);
                    }
                    if (self.time * 11.0) as i32 % 3 == 0 {
                        let tip = sources[0];
                        self.vfx.sword_edge_spark(to_world(tip), frame.dir);
                    }
                }
            } else {
                u.weapon_edge_emit = 0.0;
            }
            if follow_id.as_deref() == Some(id.as_str()) {
                let fk = rig::solve(&u.animator.pose, &body, u.pos, u.yaw, u.walk.sway);
                let head = fk.get(stick_engine::rig::Joint::Head);
                crate::appearance::update_hair_spring(
                    self.player_appearance.style,
                    &mut self.player_hair_spring,
                    head,
                    dt,
                );
            }
        }
        if let Some(f) = self.follow.as_ref().and_then(|id| self.units.get(id)) {
            // Lift the followed unit above the engine's 55% line so the HUD
            // (hotbar + log along the bottom) does not cover the action.
            let k = follow_offset(self.follow_lift_px, self.cam.persp);
            self.cam.cx = f.pos.x + k;
            self.cam.cz = f.pos.z + k;
            let ty = f.pos.y;
            self.cam_y += (ty - self.cam_y) * (1.0 - (-6.0 * dt).exp());
        }
        self.step_camera(dt);
    }

    /// Screen pixel (framebuffer space) → ground point (x, z).
    pub fn pick_world(&self, sx: f32, sy: f32) -> (f32, f32) {
        if self.cam.view.is_some() {
            if let Some(hit) = self.ray_ground(sx, sy) {
                return hit;
            }
        }
        // Iterate: unproject at the reference plane, then correct by local relief.
        let (mut x, mut z) = self.cam.unproject_ground(sx, sy);
        for _ in 0..3 {
            let dy = self.zone_height(x, z) - self.cam_y;
            if self.cam.view.is_some() {
                let (nx, nz) = self.cam.unproject_ground(sx, sy + dy * stick_engine::camera::HEIGHT_PX);
                x = nx;
                z = nz;
                continue;
            }
            (x, z) = unproject_at_height(&self.cam, sx, sy, dy);
        }
        (x, z)
    }

    /// Ground under a pixel, or `None` when the pixel misses the ground (sky,
    /// or farther than the far plane) in a 3D view. Iso always hits.
    pub fn pick_ground_hit(&self, sx: f32, sy: f32) -> Option<(f32, f32)> {
        if self.cam.view.is_none() {
            return Some(self.pick_world(sx, sy));
        }
        if let Some(hit) = self.ray_ground(sx, sy) {
            return Some(hit);
        }
        // Mid-blend (iso skew still mixed in): the reference-plane pick.
        if self.cam.effective_view().skew >= 1e-3 {
            return self.cam.pick_ground(sx, sy).map(|_| self.pick_world(sx, sy));
        }
        None
    }

    /// Perspective pixel ray marched against the zone heightfield.
    fn ray_ground(&self, sx: f32, sy: f32) -> Option<(f32, f32)> {
        let v = self.cam.effective_view();
        if v.skew >= 1e-3 || v.inv_d <= 0.0 {
            return None;
        }
        let eye = v.eye()?;
        let (r, dn) = v.basis();
        let s2 = v.scale * v.scale;
        let q = v.target + r * ((sx - v.ax) / s2) + dn * ((sy - v.ay) / s2);
        let dir = (q - eye).norm();
        let above = |t: f32| {
            let p = eye + dir * t;
            p.y - (self.zone_height(p.x, p.z) - self.cam_y)
        };
        const STEP: f32 = 0.25;
        let mut t0 = stick_engine::camera::NEAR;
        if above(t0) <= 0.0 {
            return None;
        }
        while t0 < stick_engine::camera::FAR {
            let t1 = (t0 + STEP).min(stick_engine::camera::FAR);
            if above(t1) <= 0.0 {
                let (mut lo, mut hi) = (t0, t1);
                for _ in 0..10 {
                    let m = 0.5 * (lo + hi);
                    if above(m) > 0.0 { lo = m } else { hi = m }
                }
                let p = eye + dir * hi;
                return Some((p.x, p.z));
            }
            t0 = t1;
        }
        None
    }

    fn rel(&self, p: Vec3) -> Vec3 {
        v3(p.x, p.y - self.cam_y, p.z)
    }

    /// Screen position for fog thinning around the followed unit (~2 m).
    fn fog_clear_center(&self) -> Option<(f32, f32)> {
        let id = self.follow.as_deref()?;
        let u = self.units.get(id)?;
        let feet = self.cam.project(self.rel(u.pos));
        if feet.culled() {
            return None;
        }
        Some((feet.x, feet.y))
    }

    fn fog_clear_radius_px(&self) -> f32 {
        let Some(id) = self.follow.as_deref() else {
            return 0.0;
        };
        let Some(u) = self.units.get(id) else {
            return 0.0;
        };
        let p0 = self.cam.project(self.rel(u.pos));
        if p0.culled() {
            return 40.0;
        }
        let p1 = self.cam.project(self.rel(v3(u.pos.x + 2.0, u.pos.y, u.pos.z)));
        ((p1.x - p0.x).abs() * 1.15).max(28.0)
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
            // Figures are drawn scaled by s(v) in 3D; scale the click box to match (s = 1 in iso).
            let s = self.cam.scale_at(u.pos);
            let half_w = (body_radius(&u.preset.body) * 28.0).max(12.0) * s;
            let height = unit_height_px(u).max(24.0) * s;
            if (sx - feet.x).abs() <= half_w && sy <= feet.y + 6.0 * s && sy >= feet.y - height {
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
        let Some(z) = self.zone_at(u.pos.x, u.pos.z) else { return false };
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
        Some((feet.x, feet.y - unit_height_px(u) * self.cam.scale_at(u.pos), feet.y))
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
            if self.minimap.needs_bake() && !self.backdrop && !self.boot_menu {
                self.minimap.bake(z, &self.props);
            }
        }
        if !self.boot_menu {
            if self.backdrop {
                self.fb.color.fill(BACKDROP);
            } else if self.world.is_empty() {
                match &self.zone {
                    Some(z) => ground::draw_zone(&mut self.fb, &self.cam, z, self.cam_y, self.time),
                    None => draw_ground(&mut self.fb, &self.cam),
                }
            } else {
                self.fb.color.fill(crate::atmosphere::SKY);
                let foot = ground::view_world_rect(&self.fb, &self.cam);
                // North first, so a nearer southern zone paints over it.
                for z in self.world.iter().rev() {
                    if !ground::zone_overlaps_world_rect(z, foot.0, foot.1, foot.2, foot.3) {
                        continue;
                    }
                    ground::draw_zone_in(&mut self.fb, &self.cam, z, self.cam_y, self.time, false);
                }
            }
        }
        // Terrain is colour-only; reset depth before grass/props/units so nothing stale blocks draws.
        if self.boot_menu {
            self.lights.clear();
            self.fb.color.fill(BACKDROP);
            self.fb.clear_depth();
        } else if !self.backdrop {
            self.fb.clear_depth();
            let melting = crate::weather::snow_melting(
                self.weather_snow,
                self.weather_snow_target,
                self.weather_kind_to,
            );
            let snow = crate::weather::snow_cover_display(self.weather_snow, melting);
            let grass_breeze = self.grass_breeze();
            if self.world.is_empty() {
                if let Some(z) = &self.zone {
                    if self.cam.view.is_some() {
                        ground::draw_meadow_grass_view(
                            &mut self.fb,
                            &self.cam,
                            z,
                            self.cam_y,
                            self.time,
                            grass_breeze,
                        );
                    } else {
                        ground::draw_meadow_grass(
                            &mut self.fb,
                            &self.cam,
                            z,
                            self.cam_y,
                            self.time,
                            grass_breeze,
                        );
                    }
                    if snow > 0.0 {
                        crate::weather::draw_snow_ground(&mut self.fb, &self.cam, z, self.cam_y, snow, melting);
                    }
                }
            } else {
                let foot = ground::view_world_rect(&self.fb, &self.cam);
                for z in self.world.iter().rev() {
                    if !ground::zone_overlaps_world_rect(z, foot.0, foot.1, foot.2, foot.3) {
                        continue;
                    }
                    if self.cam.view.is_some() {
                        ground::draw_meadow_grass_view(
                            &mut self.fb,
                            &self.cam,
                            z,
                            self.cam_y,
                            self.time,
                            grass_breeze,
                        );
                    } else {
                        ground::draw_meadow_grass(
                            &mut self.fb,
                            &self.cam,
                            z,
                            self.cam_y,
                            self.time,
                            grass_breeze,
                        );
                    }
                    if snow > 0.0 {
                        crate::weather::draw_snow_ground(&mut self.fb, &self.cam, z, self.cam_y, snow, melting);
                    }
                }
            }
        }
        let cam = self.cam;
        let t = self.time;
        let placed = !self.world.is_empty();
        let props = if placed { &self.world_props } else { &self.props };
        if !self.boot_menu && (self.zone.is_some() || placed) {
            let melting = crate::weather::snow_melting(
                self.weather_snow,
                self.weather_snow_target,
                self.weather_kind_to,
            );
            let snow = crate::weather::snow_cover_display(self.weather_snow, melting);
            let snow_w = Self::precip_kind_blend(
                crate::weather::Kind::from_u8(self.weather_kind_from),
                crate::weather::Kind::from_u8(self.weather_kind_to),
                self.weather_blend,
                crate::weather::Kind::Snow,
            );
            props::draw(
                &mut self.fb,
                &cam,
                props,
                self.cam_y,
                t,
                snow,
                snow_w,
                melting,
            );
            props::draw_shadows(&mut self.fb, &cam, props, self.cam_y);
        }
        if !self.boot_menu {
            self.lights.clear();
        }
        if !self.boot_menu && (self.zone.is_some() || placed) {
            for p in props.iter().filter(|p| p.kind == props::kind::FIRE_PIT) {
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
                if fx.flags & FX_HOSTILE != 0 {
                    ring(&mut self.fb, &cam, c, size, FX_RING_HOSTILE, None);
                    ring(&mut self.fb, &cam, c, size + 0.08, FX_RING_HOSTILE, None);
                } else if fx.flags & FX_SELF != 0 {
                    ring(&mut self.fb, &cam, c, size, FX_RING_SELF, None);
                    ring(&mut self.fb, &cam, c, size + 0.08, FX_RING_SELF, None);
                } else if fx.flags & FX_MOB != 0 {
                    ring(&mut self.fb, &cam, c, size, FX_HOVER, Some(t * 1.5));
                } else {
                    ring(&mut self.fb, &cam, c, size, FX_RING_FRIEND, None);
                    ring(&mut self.fb, &cam, c, size + 0.08, FX_RING_FRIEND, None);
                }
            } else if fx.flags & FX_HOVERED != 0 {
                ring(&mut self.fb, &cam, c, size, FX_HOVER, Some(t * 1.5));
            }
            let p = cam.project(c);
            if !self.boot_menu
                && fx.fade > 0.35
                && !self.wading(u)
                && !matches!(u.preset.body, Body::Node { .. })
            {
                crate::dither::soft_shadow_on(&mut self.fb, p.x, p.y, 13.0 * size / 0.5, 6.0 * size / 0.5, 1.0, crate::dither::UNIT_CORE, Some(p.d));
            }
        }
        let pre_units = self.fb.color.clone();
        // Units back to front (depth buffer also resolves overlaps).
        // Iso depth is -(x+z); a perspective view sorts by view z instead.
        let follow = self.follow.clone();
        let fp_locked = self.fp_locked();
        let mut order: Vec<(&String, &Unit)> = self.units.iter().collect();
        order.sort_by(|a, b| {
            let key = |u: &Unit| if cam.view.is_some() { -cam.project(rel(u.pos)).d } else { u.pos.x + u.pos.z };
            key(b.1).partial_cmp(&key(a.1)).unwrap_or(std::cmp::Ordering::Equal).reverse()
        });
        for (id, u) in order {
            let base = rel(u.pos);
            let feet = cam.project(base);
            let bb = BBox::around(&self.fb, feet.x, feet.y, unit_height_px(u) + 24.0, 48.0);
            let saved = bb.save(&self.fb);
            match u.preset.body {
                Body::Biped => {
                    let is_me = follow.as_deref() == Some(id.as_str());
                    let mut look = if is_me {
                        self.player_appearance.look()
                    } else {
                        u.preset.look
                    };
                    let mut body = u.preset.props.body();
                    if is_me {
                        body.hair = self.player_appearance.style;
                    }
                    let mut fk = rig::solve(&u.animator.pose, &body, base, u.yaw, u.walk.sway);
                    if is_me {
                        fk.hair_sway = crate::appearance::hair_sway(&self.player_hair_spring);
                    }
                    let hair_rig = is_me.then_some((&fk, &body));
                    let mut j = crate::compat::Fig::from_joints(&fk, u.preset.props.sword);
                    if u.anim == AnimState::Dead {
                        figure::collapse(&mut j, base, u.yaw, u.dead_t);
                        look.accent = C_SHADOW;
                    }
                    let mut garb = u.garb;
                    if garb.weapon.is_none() {
                        garb.weapon = Some(crate::gear::WeaponLook::plain(u.preset.weapon));
                    }
                    let fp = follow.as_deref() == Some(id.as_str())
                        && (fp_locked
                            || cam.view.and_then(|v| v.eye()).is_some_and(|e| (e - j.head).len() < FP_HIDE_RADIUS));
                    if fp {
                        // First-person view model: the forearms and weapon sit
                        // in front of the eye. Held where the body stands, a
                        // staff head was drawn inches from the lens as a huge disc.
                        if let Some(v) = cam.view {
                            let f = v.fwd();
                            let push = v3(f.x, 0.0, f.z).norm() * FP_VIEWMODEL_FWD - v3(0.0, FP_VIEWMODEL_DOWN, 0.0);
                            for i in 0..2 {
                                j.elbow[i] = j.elbow[i] + push;
                                j.hand[i] = j.hand[i] + push;
                            }
                            j.sword_tip = j.sword_tip + push;
                        }
                    }
                    if !u.ghosts.is_empty() && !fp {
                        dash_ghosts(&mut self.fb, &cam, &j, u.pos, &u.ghosts);
                    }
                    let swinging = matches!(u.anim, AnimState::Melee | AnimState::Cast);
                    let tool = match u.anim {
                        AnimState::Harvest => figure::GatherTool::Shovel,
                        AnimState::Mine => figure::GatherTool::Pick,
                        AnimState::Leathercraft => figure::GatherTool::Leathercraft,
                        AnimState::Smithing => figure::GatherTool::Smithing,
                        AnimState::Cooking => figure::GatherTool::Cooking,
                        AnimState::Goldsmithing => figure::GatherTool::Goldsmithing,
                        _ => figure::GatherTool::None,
                    };
                    let planted = u.anim == AnimState::Rest;
                    figure::draw_garbed(
                        &mut self.fb,
                        &cam,
                        &j,
                        &u.preset.props,
                        &look,
                        &garb,
                        fp,
                        swinging,
                        tool,
                        planted,
                        base.y,
                        hair_rig,
                        u.fx.weapon_edge,
                        t,
                    );
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
        // Pixels the units painted (players, NPCs, mobs, gear, hair): lit by time of day.
        self.unit_px.clear();
        self.unit_px.extend(pre_units.iter().zip(&self.fb.color).map(|(&a, &b)| if a != b { b as u16 + 1 } else { 0 }));
        self.vfx.project(&cam, self.cam_y, &self.fb.depth, self.fb.w, self.fb.h);
        // Buff / ailment visuals over the bodies (#34).
        let bl: Vec<_> = self.buffs.iter().filter_map(|(id, b)| self.units.get(id).map(|u| (self.buff_anchor(id, u), *b))).collect();
        for (a, b) in &bl {
            crate::buffvfx::draw_body(&mut self.fb, &cam, a, b, t);
        }
        // Overlays without depth: level-up columns, HP and cast bars.
        for u in self.units.values() {
            if self.boot_menu {
                continue;
            }
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
        self.float_px.clear();
        let pre_float = if fl.is_empty() { None } else { Some(self.fb.color.clone()) };
        for f in &mut fl {
            if let Some((x, y, _)) = self.anchor(&f.unit) {
                f.at = Some((x, y));
            }
            if let Some((x, y)) = f.at {
                floaters::draw(&mut self.fb, f, x, y);
            }
        }
        self.floaters = fl;
        if let Some(pre) = pre_float {
            self.float_px.extend(
                pre.iter()
                    .zip(&self.fb.color)
                    .enumerate()
                    .filter(|(_, (&a, &b))| a != b && crate::palette::float_rgb(b).is_some())
                    .map(|(i, (_, &b))| (i as u32, b)),
            );
        }
        if !self.boot_menu && !self.backdrop && (self.zone.is_some() || placed) {
            let t = if self.weather_kind_from == self.weather_kind_to {
                1.0
            } else {
                smoothstep(self.weather_blend)
            };
            let from = crate::weather::Kind::from_u8(self.weather_kind_from);
            let to = crate::weather::Kind::from_u8(self.weather_kind_to);
            let rain = Self::precip_kind_blend(from, to, t, crate::weather::Kind::Rain);
            let snow = Self::precip_kind_blend(from, to, t, crate::weather::Kind::Snow);
            crate::weather::draw_precip(
                &mut self.fb,
                self.weather_time,
                self.weather_snow,
                rain,
                snow,
            );
        }
    }

    /// Wind in grass — still during rain (blends with weather transitions).
    fn grass_breeze(&self) -> f32 {
        let t = if self.weather_kind_from == self.weather_kind_to {
            1.0
        } else {
            smoothstep(self.weather_blend)
        };
        let from = crate::weather::Kind::from_u8(self.weather_kind_from);
        let to = crate::weather::Kind::from_u8(self.weather_kind_to);
        1.0 - Self::precip_kind_blend(from, to, t, crate::weather::Kind::Rain)
    }

    fn precip_kind_blend(
        from: crate::weather::Kind,
        to: crate::weather::Kind,
        t: f32,
        k: crate::weather::Kind,
    ) -> f32 {
        let f = from == k;
        let o = to == k;
        match (f, o) {
            (true, true) => 1.0,
            (false, true) => t,
            (true, false) => 1.0 - t,
            _ => 0.0,
        }
    }

    fn tick_weather(&mut self, dt: f32) {
        const BLEND_SECS: f32 = 4.0;
        if self.weather_blend < 1.0 {
            self.weather_blend = (self.weather_blend + dt / BLEND_SECS).min(1.0);
        }
        let melting = crate::weather::snow_melting(
            self.weather_snow,
            self.weather_snow_target,
            self.weather_kind_to,
        );
        let rate = if melting { 16.0 } else { 11.0 };
        let k = 1.0 - (-rate * dt).exp();
        self.weather_snow += (self.weather_snow_target - self.weather_snow) * k;
        // Snap to full cover so the blanket does not shimmer on the last step.
        if !melting && self.weather_snow_target >= 0.99 && self.weather_snow > 0.94 {
            self.weather_snow = self.weather_snow.max(self.weather_snow_target);
        }
        // Hold displayed melt steps steady (lerp between quant steps flickers tiles).
        if melting {
            let shown = crate::weather::snow_cover_display(self.weather_snow, true);
            if self.weather_snow > shown + 0.5 / 40.0 {
                // still falling toward the next dissolve step
            } else if self.weather_snow > self.weather_snow_target {
                self.weather_snow = shown.max(self.weather_snow_target);
            }
        }
    }

    /// Cycle local player hair style (`;` in the client).
    pub fn cycle_hair_style(&mut self, d: i32) {
        self.player_appearance.cycle_style(d);
    }

    /// Cycle local player hair colour (`'`).
    pub fn cycle_hair_color(&mut self, d: i32) {
        self.player_appearance.cycle_hair_color(d);
    }

    /// Cycle local player body colour (`L`) — same ramps as hair.
    pub fn cycle_body_color(&mut self, d: i32) {
        self.player_appearance.cycle_body_color(d);
    }

    /// Zone weather for Pale Hollow (kind 0..3, snow cover 0..1 from server).
    pub fn set_weather(&mut self, kind: u8, snow_cover: f32) {
        let kind = kind.min(3);
        let snow_cover = snow_cover.clamp(0.0, 1.0);
        if kind != self.weather_kind_to {
            self.weather_kind_from = if self.weather_blend >= 1.0 {
                self.weather_kind_to
            } else {
                self.weather_kind_from
            };
            self.weather_kind_to = kind;
            self.weather_blend = 0.0;
        }
        if (snow_cover - self.weather_snow_target).abs() > 0.2 {
            self.weather_snow = snow_cover;
        }
        self.weather_snow_target = snow_cover;
    }

    /// Time of day 0..1 (0 = midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset).
    /// Drives the third/first-person sky; iso is unchanged.
    pub fn set_time_of_day(&mut self, phase: f32) {
        self.day_phase = if phase.is_finite() { phase.rem_euclid(1.0) } else { 0.5 };
    }
    pub fn time_of_day(&self) -> f32 { self.day_phase }

    /// Character light for the current time of day and weather, all views.
    /// In 3D the world ambient already carries the night dim, so divide it out.
    fn light_units(&self, out: &mut [u8]) {
        if self.unit_px.len() != self.fb.color.len() {
            return;
        }
        let w = crate::sky::lerp_weather(
            crate::sky::sky_weather(crate::weather::Kind::from_u8(self.weather_kind_from)),
            crate::sky::sky_weather(crate::weather::Kind::from_u8(self.weather_kind_to)),
            smoothstep(self.weather_blend),
        );
        let mut m = crate::sky::unit_light(self.day_phase, w);
        if self.atmosphere && self.sky_ctx().is_some() {
            let a = crate::sky::ambient_scale(self.day_phase);
            for k in 0..3 {
                m[k] /= a[k];
            }
        }
        if m == [1.0; 3] {
            return;
        }
        for (i, (&u, &c)) in self.unit_px.iter().zip(&self.fb.color).enumerate() {
            // Skip pixels covered since (props, floaters, bars) and glowing ones.
            if u == 0 || u - 1 != c as u16 || crate::atmosphere::emissive(c) {
                continue;
            }
            let o = &mut out[i * 4..i * 4 + 3];
            for k in 0..3 {
                o[k] = (o[k] as f32 * m[k]).min(255.0) as u8;
            }
        }
    }

    /// Pixel sky context when the camera is a settled-enough 3D view.
    fn sky_ctx(&self) -> Option<crate::sky::SkyCtx> {
        if self.rig.mode == CamMode::Iso || self.boot_menu || self.backdrop {
            return None;
        }
        let v = self.cam.view?;
        if v.inv_d <= 0.0 || v.skew > 0.5 {
            return None;
        }
        let f = v.fwd();
        let (sy, cy) = v.yaw.sin_cos();
        let (sp, cp) = v.pitch.sin_cos();
        let w = crate::sky::lerp_weather(
            crate::sky::sky_weather(crate::weather::Kind::from_u8(self.weather_kind_from)),
            crate::sky::sky_weather(crate::weather::Kind::from_u8(self.weather_kind_to)),
            smoothstep(self.weather_blend),
        );
        Some(crate::sky::SkyCtx {
            fwd: [f.x, f.y, f.z],
            right: [-cy, 0.0, sy],
            down: [-sy * sp, -cp, -cy * sp],
            ax: v.ax,
            ay: v.ay,
            focal: v.scale / v.inv_d,
            phase: self.day_phase,
            weather: w,
            time: self.time,
        })
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
        // A zone without map data must not keep the previous zone's title.
        self.minimap.title.clear();
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
            let kind = if u.fx.flags & (FX_HOSTILE | FX_MOB) != 0 {
                1
            } else if u.preset.npc_mark.is_some() {
                2
            } else {
                3
            };
            marks.push(Marker { x: u.pos.x - self.map_ox, z: u.pos.z - self.map_oz, kind });
        }
        (cx - self.map_ox, cz - self.map_oz, yaw, marks)
    }

    /// Framebuffer as RGBA8 (ImageData layout).
    pub fn write_rgba(&self, out: &mut [u8]) {
        if self.atmosphere && (self.has_zone() || self.boot_menu) {
            let scroll = if self.boot_menu {
                0.0
            } else {
                (self.cam.cx - self.cam.cz) * stick_engine::camera::ISO_X
            };
            let params = if self.boot_menu {
                crate::atmosphere::FORGE_MENU
            } else {
                let base = crate::atmosphere::PALE_HOLLOW;
                let a = crate::atmosphere::pale_hollow_weather(
                    &base,
                    crate::weather::Kind::from_u8(self.weather_kind_from),
                );
                let b = crate::atmosphere::pale_hollow_weather(
                    &base,
                    crate::weather::Kind::from_u8(self.weather_kind_to),
                );
                crate::atmosphere::lerp_params(a, b, smoothstep(self.weather_blend))
            };
            let sky = self.sky_ctx();
            let mut params = params;
            if sky.is_some() {
                // Night dims the world and its haze in 3D, in step with the sky.
                let m = crate::sky::ambient_scale(self.day_phase);
                for k in 0..3 {
                    params.ambient[k] *= m[k];
                }
                let h = params.haze;
                let ch = |sh: u32, k: usize| ((((h >> sh) & 255) as f32 * m[k]) as u32).min(255) << sh;
                params.haze = ch(16, 0) | ch(8, 1) | ch(0, 2);
            }
            let ex = crate::atmosphere::Extra {
                sky,
                time: self.time,
                depth: Some(&self.fb.depth),
                clear_center: self.fog_clear_center(),
                clear_radius_px: self.fog_clear_radius_px(),
            };
            crate::atmosphere::write_rgba_key(
                &self.pal,
                &self.fb.color,
                self.fb.w,
                self.fb.h,
                &self.lights,
                &params,
                scroll,
                self.keylight,
                ex,
                out,
            );
        } else {
            palette::write_rgba(&self.pal, &self.fb.color, out);
        }
        if !self.boot_menu && !self.backdrop && self.has_zone() {
            self.light_units(out);
        }
        for &(i, c) in &self.float_px {
            if self.fb.color.get(i as usize) == Some(&c) {
                if let Some(rgb) = crate::palette::float_rgb(c) {
                    let o = &mut out[i as usize * 4..i as usize * 4 + 3];
                    o.copy_from_slice(&[(rgb >> 16) as u8, (rgb >> 8) as u8, rgb as u8]);
                }
            }
        }
        crate::vfx::blend(&self.vfx.sparks, self.fb.w, self.fb.h, out);
        if !self.backdrop && !self.boot_menu && self.zone.is_some() && self.minimap.on {
            let (cx, cz, yaw, marks) = self.map_view();
            self.minimap.composite(out, self.fb.w, self.fb.h, cx, cz, yaw, &marks);
        }
        if self.backdrop || self.boot_menu {
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

/// Exact inverse of the iso / persp-blend projection for a point `dy` above
/// the reference plane: sy - 0.55h = (v ISO_Y - dy HEIGHT_PX) / (1 - a v),
/// sx - 0.5w = u ISO_X / (1 - a v). In iso (a = 0) this is the old shift.
fn unproject_at_height(cam: &Camera, sx: f32, sy: f32, dy: f32) -> (f32, f32) {
    use stick_engine::camera::{HEIGHT_PX, ISO_X, ISO_Y, PERSP_K};
    let a = PERSP_K * cam.persp;
    let yy = sy - cam.h * 0.55;
    let v = (yy + dy * HEIGHT_PX) / (ISO_Y + a * yy);
    let inv_s = (1.0 - a * v).max(0.2);
    let u = (sx - cam.w * 0.5) * inv_s / ISO_X;
    (cam.cx + (u + v) * 0.5, cam.cz + (v - u) * 0.5)
}

/// World offset (added to x and z) that puts the followed unit `lift_px`
/// above the 55% line. Iso: v * ISO_Y = -lift. Under the persp blend the
/// screen offset is v * ISO_Y * s(v), s(v) = 1 / (1 - a v), so solve
/// y = v / (1 - a v) for v: v = y / (1 + a y).
pub(crate) fn follow_offset(lift_px: f32, persp: f32) -> f32 {
    let y = -lift_px / stick_engine::camera::ISO_Y;
    let a = stick_engine::camera::PERSP_K * persp;
    let v = y / (1.0 + a * y).max(0.2);
    -v * 0.5
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

/// Ease-out used by the server's dash (apps/server/src/dash.ts `dashPos`).
pub(crate) fn dash_ease(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    1.0 - (1.0 - t) * (1.0 - t)
}

/// Dash afterimages: the current figure's bones, shifted back to each trail
/// point. Lines only, so a ghost costs ~10 segments and no extra rig solve.
pub(crate) fn dash_ghosts(fb: &mut Framebuffer, cam: &Camera, j: &Fig, at: Vec3, ghosts: &[(Vec3, f32)]) {
    for &(g, life) in ghosts {
        // Older ghosts thin out: arms drop first as they fade.
        let fresh = life > GHOST_LIFE * 0.5;
        let o = v3(g.x - at.x, g.y - at.y, g.z - at.z);
        if o.len() < 0.05 {
            continue;
        }
        let seg = |fb: &mut Framebuffer, a: Vec3, b: Vec3| fb.line(cam.project(a + o), cam.project(b + o), FX_CAST);
        seg(fb, j.pelvis, j.chest);
        seg(fb, j.chest, j.head);
        for i in 0..2 {
            seg(fb, j.hip[i], j.knee[i]);
            seg(fb, j.knee[i], j.foot[i]);
            if fresh {
                seg(fb, j.shoulder[i], j.elbow[i]);
                seg(fb, j.elbow[i], j.hand[i]);
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

#[cfg(test)]
mod dash_tests {
    use super::*;

    fn me(x: f32, z: f32, anim: AnimState) -> UnitInput {
        UnitInput { x, y: 0.0, z, facing: 0.0, anim, preset: "player:default".into() }
    }

    #[test]
    fn dash_maps_to_stick_engine_lunge_clip() {
        assert_eq!(AnimState::parse("dash"), AnimState::Dash);
        assert_eq!(AnimState::Dash.action_clip(), Some("dash"));
        assert!(AnimLibrary::builtin().get("dash").is_some(), "stick-engine dash clip is builtin");
    }

    #[test]
    fn dash_leaves_a_fading_trail_and_draws_it() {
        let mut s = Scene::new(200, 160);
        s.atmosphere = false;
        s.upsert_unit("me", me(0.0, 0.0, AnimState::Idle));
        s.set_camera(0.0, 0.0);
        s.tick(1.0 / 60.0);
        s.draw();
        let still = s.fb.color.clone();
        s.upsert_unit("me", me(0.0, 0.0, AnimState::Dash));
        s.predict_dash("me", 0.0, 4.0, 0.24);
        for _ in 0..8 {
            s.tick(1.0 / 60.0);
        }
        let n = s.units["me"].ghosts.len();
        assert!((2..=8).contains(&n), "ghosts {n}");
        s.draw();
        assert!(s.fb.color.iter().any(|&c| c == FX_CAST), "afterimage drawn");
        assert_ne!(s.fb.color, still);
        // Back to idle: the trail fades out completely and nothing is left behind.
        s.upsert_unit("me", me(0.0, 4.0, AnimState::Idle));
        for _ in 0..40 {
            s.tick(1.0 / 60.0);
        }
        assert!(s.units["me"].ghosts.is_empty());
        assert!(s.units["me"].pred.is_none());
    }

    #[test]
    fn prediction_leads_the_server_and_takes_its_wall_clipped_landing() {
        let mut s = Scene::new(64, 48);
        s.upsert_unit("me", me(0.0, 0.0, AnimState::Idle));
        s.tick(1.0 / 60.0);
        s.predict_dash("me", 0.0, 4.0, 0.24);
        for _ in 0..6 {
            s.upsert_unit("me", me(0.0, 0.0, AnimState::Dash)); // server not there yet
            s.tick(1.0 / 60.0);
        }
        assert!(s.unit_pos("me").unwrap().2 > 1.0, "moves before the server confirms");
        // Server: a wall at z = 2.5.
        s.predict_dash("me", 0.0, 2.5, 0.24);
        for _ in 0..60 {
            s.upsert_unit("me", me(0.0, 2.5, AnimState::Idle));
            s.tick(1.0 / 60.0);
        }
        let z = s.unit_pos("me").unwrap().2;
        assert!((z - 2.5).abs() < 0.05, "settles on the server landing, got {z}");
        // A refused dash eases back to the server position.
        s.predict_dash("me", 0.0, 6.5, 0.24);
        for _ in 0..5 {
            s.tick(1.0 / 60.0);
        }
        s.cancel_dash("me");
        for _ in 0..60 {
            s.upsert_unit("me", me(0.0, 2.5, AnimState::Idle));
            s.tick(1.0 / 60.0);
        }
        assert!((s.unit_pos("me").unwrap().2 - 2.5).abs() < 0.05);
    }
}
