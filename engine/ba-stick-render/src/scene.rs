//! The renderable scene: units keyed by server id, a following camera, and a
//! framebuffer.
use std::collections::BTreeMap;

use stick_engine::anim::{AnimLibrary, Animator};
use stick_engine::camera::{Camera, P2};
use stick_engine::math::{angle_diff, v3, Vec3};
use stick_engine::raster::*;
use stick_engine::rig;

use crate::preset::{AnimState, Body, RigPreset};
use crate::palette::*;
use crate::zone::Zone;
use crate::{creature, figure, ground, palette, props};

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
    animator: Animator,
    snap: bool,
}

pub struct Scene {
    pub fb: Framebuffer,
    pub cam: Camera,
    lib: AnimLibrary,
    units: BTreeMap<String, Unit>,
    follow: Option<String>,
    /// Exponential smoothing rate for positions (1/s). 20 Hz snapshots →
    /// ~15 hides the step without visible lag.
    pub smoothing: f32,
    zone: Option<Zone>,
    props: Vec<props::Prop>,
    /// Reference height subtracted from everything so the followed unit sits mid-screen.
    pub cam_y: f32,
    /// Pixels the followed unit sits above the camera's default anchor.
    pub follow_lift_px: f32,
    time: f32,
    pal: [u32; 256],
}

impl Scene {
    pub fn new(w: usize, h: usize) -> Scene {
        Scene {
            fb: Framebuffer::new(w, h),
            cam: Camera::new(w, h),
            lib: AnimLibrary::builtin(),
            units: BTreeMap::new(),
            follow: None,
            smoothing: 15.0,
            zone: None,
            props: Vec::new(),
            cam_y: 0.0,
            follow_lift_px: 40.0,
            time: 0.0,
            pal: palette::palette(),
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
        Ok(())
    }

    pub fn clear_zone(&mut self) {
        self.zone = None;
        self.props.clear();
    }

    /// Load static props (BAP1). Replaces any previous set.
    pub fn load_props(&mut self, bytes: &[u8]) -> Result<usize, String> {
        self.props = props::parse(bytes)?;
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
                if e.anim != u.anim || u.anim.restarts() && e.animator.finished(&self.lib) {
                    e.animator.play(u.anim.clip(), 0.12, u.anim.restarts());
                    e.anim = u.anim;
                }
            }
            None => {
                let mut animator = Animator::new(u.anim.clip());
                animator.update(&self.lib, 0.0, 1.0);
                self.units.insert(id.to_owned(), Unit {
                    pos: target,
                    target,
                    yaw: u.facing,
                    target_yaw: u.facing,
                    anim: u.anim,
                    preset: RigPreset::resolve(&u.preset),
                    preset_key: u.preset,
                    animator,
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
        self.units.remove(id).is_some()
    }

    /// Unit's current (interpolated) world position.
    pub fn unit_pos(&self, id: &str) -> Option<(f32, f32, f32)> {
        self.units.get(id).map(|u| (u.pos.x, u.pos.y, u.pos.z))
    }

    pub fn unit_clip(&self, id: &str) -> Option<&str> {
        self.units.get(id).map(|u| u.animator.clip.as_str())
    }

    /// Advance interpolation and animation by `dt` seconds.
    pub fn tick(&mut self, dt: f32) {
        self.time += dt;
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
            u.animator.update(&self.lib, dt, 1.0);
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
    pub fn set_fx(&mut self, id: &str, fx: UnitFx) -> bool {
        match self.units.get_mut(id) {
            Some(u) => { u.fx = fx; true }
            None => false,
        }
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

    /// Draw the ground and all units into the framebuffer.
    pub fn draw(&mut self) {
        match &self.zone {
            Some(z) => ground::draw_zone(&mut self.fb, &self.cam, z, self.cam_y, self.time),
            None => draw_ground(&mut self.fb, &self.cam),
        }
        self.fb.clear_depth();
        let cam = self.cam;
        let t = self.time;
        props::draw(&mut self.fb, &cam, &self.props, self.cam_y, t);
        let cy = self.cam_y;
        let rel = |p: Vec3| v3(p.x, p.y - cy, p.z);
        // Ground decals: telegraphs, selection / hover rings, shadows.
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
            if fx.fade > 0.35 {
                shadow(&mut self.fb, p.x, p.y, 13.0 * size / 0.5, 6.0 * size / 0.5);
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
                    let mut j = rig::solve(&u.animator.pose, &u.preset.props, base, u.yaw);
                    if u.anim == AnimState::Dead {
                        figure::collapse(&mut j, base, u.yaw, u.dead_t);
                        look.accent = C_SHADOW;
                    }
                    figure::draw(&mut self.fb, &cam, &j, &u.preset.props, &look, u.preset.weapon);
                }
                ref body => {
                    let pose = creature::Pose {
                        pos: base,
                        yaw: u.yaw,
                        phase: u.gait,
                        moving: u.moving,
                        dead: if u.anim == AnimState::Dead { u.dead_t.min(1.0) } else { 0.0 },
                        time: t + u.gait * 0.01,
                    };
                    creature::draw(&mut self.fb, &cam, body, &pose);
                }
            }
            let tint = if u.fx.flags & FX_PETRIFIED != 0 || u.anim == AnimState::Dead {
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
    }

    /// Framebuffer as RGBA8 (ImageData layout).
    pub fn write_rgba(&self, out: &mut [u8]) {
        palette::write_rgba(&self.pal, &self.fb.color, out);
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

/// Unit shadow on the ground only (skips pixels already covered by props).
fn shadow(fb: &mut Framebuffer, cx: f32, cy: f32, rx: f32, ry: f32) {
    for y in (cy - ry) as i32..=(cy + ry) as i32 {
        for x in (cx - rx) as i32..=(cx + rx) as i32 {
            if x < 0 || y < 0 || x >= fb.w as i32 || y >= fb.h as i32 {
                continue;
            }
            let (nx, ny) = ((x as f32 + 0.5 - cx) / rx, (y as f32 + 0.5 - cy) / ry);
            let i = y as usize * fb.w + x as usize;
            if nx * nx + ny * ny <= 1.0 && fb.depth[i] == f32::INFINITY {
                fb.color[i] = C_SHADOW;
            }
        }
    }
}
