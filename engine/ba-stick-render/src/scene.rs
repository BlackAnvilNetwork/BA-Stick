//! The renderable scene: units keyed by server id, a following camera, and a
//! framebuffer.
use std::collections::BTreeMap;

use stick_engine::anim::{AnimLibrary, Animator};
use stick_engine::camera::Camera;
use stick_engine::math::{angle_diff, v3, Vec3};
use stick_engine::raster::*;
use stick_engine::rig;

use crate::preset::{AnimState, RigPreset};

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

struct Unit {
    pos: Vec3,
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
        let k = 1.0 - (-self.smoothing * dt).exp();
        for u in self.units.values_mut() {
            if u.snap {
                u.snap = false;
            } else {
                u.pos = u.pos.lerp(u.target, k);
                u.yaw += angle_diff(u.yaw, u.target_yaw) * k;
            }
            u.animator.update(&self.lib, dt, 1.0);
        }
        if let Some(f) = self.follow.as_ref().and_then(|id| self.units.get(id)) {
            self.cam.cx = f.pos.x;
            self.cam.cz = f.pos.z;
        }
    }

    /// Screen pixel (framebuffer space) → ground point (x, z).
    pub fn pick_world(&self, sx: f32, sy: f32) -> (f32, f32) {
        self.cam.unproject_ground(sx, sy)
    }

    /// Topmost unit whose body box contains the screen pixel.
    pub fn pick_unit(&self, sx: f32, sy: f32) -> Option<&str> {
        let mut best: Option<(&str, f32)> = None;
        for (id, u) in &self.units {
            let feet = self.cam.project(u.pos);
            let half_w = 14.0;
            let height = (u.preset.props.thigh + u.preset.props.shin + u.preset.props.spine) * stick_engine::camera::HEIGHT_PX + 16.0;
            if (sx - feet.x).abs() <= half_w && sy <= feet.y + 4.0 && sy >= feet.y - height {
                if best.map_or(true, |(_, d)| feet.d < d) {
                    best = Some((id.as_str(), feet.d));
                }
            }
        }
        best.map(|(id, _)| id)
    }

    /// Draw the ground and all units into the framebuffer.
    pub fn draw(&mut self) {
        draw_ground(&mut self.fb, &self.cam);
        self.fb.clear_depth();
        let cam = self.cam;
        for u in self.units.values() {
            let p = cam.project(u.pos);
            self.fb.shadow_ellipse(p.x, p.y, 13.0, 6.0, C_SHADOW);
        }
        for u in self.units.values() {
            let mut look = u.preset.look;
            if u.anim == AnimState::Dead {
                look = rig::Look { body: C_DUST, far: C_DUST, accent: C_SHADOW };
            }
            let j = rig::solve(&u.animator.pose, &u.preset.props, u.pos, u.yaw);
            rig::draw(&mut self.fb, &cam, &j, &u.preset.props, &look);
        }
    }

    /// Framebuffer as RGBA8 (ImageData layout).
    pub fn write_rgba(&self, out: &mut [u8]) {
        self.fb.write_rgba(out);
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
