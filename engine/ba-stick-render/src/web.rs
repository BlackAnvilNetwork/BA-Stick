// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! wasm-bindgen surface used by `apps/stick-web`.
use wasm_bindgen::prelude::*;
use wasm_bindgen::{Clamped, JsCast};
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, ImageData};

use crate::{AnimState, Scene, UnitFx, UnitInput};

#[wasm_bindgen]
pub struct StickRenderer {
    scene: Scene,
    ctx: CanvasRenderingContext2d,
    rgba: Vec<u8>,
}

#[wasm_bindgen]
impl StickRenderer {
    /// Attach to a canvas. The canvas backing store is set to the internal
    /// framebuffer size; CSS scales it up with `image-rendering: pixelated`.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, width: u32, height: u32) -> Result<StickRenderer, JsValue> {
        canvas.set_width(width);
        canvas.set_height(height);
        let ctx: CanvasRenderingContext2d = canvas.get_context("2d")?.ok_or("no 2d context")?.dyn_into()?;
        let (w, h) = (width as usize, height as usize);
        Ok(StickRenderer { scene: Scene::new(w, h), ctx, rgba: vec![0; w * h * 4] })
    }

    /// Load a baked zone (`BAZ1` bytes from apps/stick-web/public/zones).
    #[wasm_bindgen(js_name = loadZone)]
    pub fn load_zone(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        self.scene.load_zone(bytes).map_err(|e| JsValue::from_str(&e))
    }

    /// Load static props (`BAP1` bytes); returns the prop count.
    #[wasm_bindgen(js_name = loadProps)]
    pub fn load_props(&mut self, bytes: &[u8]) -> Result<usize, JsValue> {
        self.scene.load_props(bytes).map_err(|e| JsValue::from_str(&e))
    }

    /// Floating combat number over a unit. kind: 0 damage, 1 damage to self,
    /// 2 heal, 3 crit, 4 miss.
    #[wasm_bindgen(js_name = addFloater)]
    pub fn add_floater(&mut self, id: &str, kind: u8, value: u32) {
        self.scene.add_floater(id, kind, value);
    }

    /// True when the unit is standing in open water (legs hidden to the shin).
    #[wasm_bindgen(js_name = isWading)]
    pub fn is_wading(&self, id: &str) -> bool {
        self.scene.is_wading(id)
    }

    /// Ability VFX step (#13): prim 0 projectile, 1 line, 2 burst, 3 ring.
    /// `to` empty = on the caster. flags: 1 rise, 2 from sky.
    #[wasm_bindgen(js_name = spawnVfx)]
    #[allow(clippy::too_many_arguments)]
    pub fn spawn_vfx(&mut self, prim: u8, from: &str, to: &str, color: u32, count: u32, radius: f32, flags: u32) -> bool {
        let to = if to.is_empty() { None } else { Some(to) };
        self.scene.spawn_vfx(crate::vfx::Prim::from_u8(prim), from, to, color, count, radius, flags)
    }

    #[wasm_bindgen(js_name = vfxCount)]
    pub fn vfx_count(&self) -> usize {
        self.scene.vfx_count()
    }

    /// Equipment look (#14). family: 0 keep, 1 sword, 2 greatsword, 3 dagger,
    /// 4 axe, 5 staff, 6 club, 7 knuckles. Materials: 0 none, 1 cloth,
    /// 2 leather, 3 metal, 4 wood, 5 bone, 6 gold. Seeds = catalog item ids.
    #[wasm_bindgen(js_name = setGear)]
    #[allow(clippy::too_many_arguments)]
    pub fn set_gear(&mut self, id: &str, family: u8, wmat: u8, wseed: u32, body: u8, bseed: u32, head: u8, hseed: u32, legs: u8, lseed: u32) -> bool {
        self.scene.set_gear(id, crate::gear::garb(family, wmat, wseed, body, bseed, head, hseed, legs, lseed))
    }

    /// Preview mode (#37): no ground, transparent background.
    #[wasm_bindgen(js_name = setBackdrop)]
    pub fn set_backdrop(&mut self, on: bool) {
        self.scene.backdrop = on;
    }

    /// Toggle lighting / haze / skyline / vignette (#26).
    /// Blend the camera to 3D perspective (true) or back to iso (false).
    #[wasm_bindgen(js_name = setView3d)]
    pub fn set_view3d(&mut self, on: bool) {
        self.scene.view3d = on;
    }

    /// L2 directional key light (off by default).
    #[wasm_bindgen(js_name = setKeylight)]
    pub fn set_keylight(&mut self, on: bool) {
        self.scene.keylight = on;
    }

    #[wasm_bindgen(js_name = setAtmosphere)]
    pub fn set_atmosphere(&mut self, on: bool) {
        self.scene.atmosphere = on;
    }

    #[wasm_bindgen(js_name = clearZone)]
    pub fn clear_zone(&mut self) { self.scene.clear_zone(); }

    #[wasm_bindgen(js_name = zoneHeight)]
    pub fn zone_height(&self, x: f32, z: f32) -> f32 { self.scene.zone_height(x, z) }

    #[wasm_bindgen(js_name = setCamera)]
    pub fn set_camera(&mut self, x: f32, z: f32) { self.scene.set_camera(x, z); }

    pub fn follow(&mut self, id: Option<String>) { self.scene.follow(id.as_deref()); }

    /// `anim`: idle|walk|run|melee|cast|rest|dead. `preset`: job id,
    /// `npc:<role>` or `mob:<archetype>`, optional `/female` or `/pepeka`.
    #[wasm_bindgen(js_name = upsertUnit)]
    #[allow(clippy::too_many_arguments)]
    pub fn upsert_unit(&mut self, id: &str, x: f32, y: f32, z: f32, facing: f32, anim: &str, preset: &str) {
        self.scene.upsert_unit(id, UnitInput { x, y, z, facing, anim: AnimState::parse(anim), preset: preset.to_owned() });
    }

    /// Per-frame effect state. `hp`/`cast`/`levelUp` < 0 hide; `flags` are
    /// FX bits (1 selected, 2 hovered, 4 shiny, 8 hostile, 16 self,
    /// 32 player cast, 64 petrified); `fade` 0..1 opacity.
    #[wasm_bindgen(js_name = setFx)]
    #[allow(clippy::too_many_arguments)]
    pub fn set_fx(&mut self, id: &str, hp: f32, cast: f32, aoe: f32, flags: u32, fade: f32, level_up: f32) -> bool {
        self.scene.set_fx(id, UnitFx { hp, cast, aoe, flags, fade, level_up })
    }

    /// Buff / ailment visuals (#34): `mask` = `buffvfx` bits, `td` / `burst`
    /// = Temporal Distortion impact and resonance burst life 0..1 (< 0 none).
    #[wasm_bindgen(js_name = setBuffs)]
    pub fn set_buffs(&mut self, id: &str, mask: u32, td: f32, burst: f32) -> bool {
        self.scene.set_buffs(id, crate::buffvfx::BuffFx { mask, td, burst })
    }

    /// `[x, headY, feetY]` in framebuffer pixels, or empty if unknown.
    pub fn anchor(&self, id: &str) -> Vec<f32> {
        self.scene.anchor(id).map_or(vec![], |(x, a, b)| vec![x, a, b])
    }

    /// `[x, y]` framebuffer pixel of a world point.
    #[wasm_bindgen(js_name = worldToScreen)]
    pub fn world_to_screen(&self, x: f32, y: f32, z: f32) -> Vec<f32> {
        let (sx, sy) = self.scene.world_to_screen(x, y, z);
        vec![sx, sy]
    }

    #[wasm_bindgen(js_name = removeUnit)]
    pub fn remove_unit(&mut self, id: &str) -> bool { self.scene.remove_unit(id) }

    #[wasm_bindgen(js_name = unitCount)]
    pub fn unit_count(&self) -> usize { self.scene.unit_count() }

    /// Returns `[x, z]` on the ground under a framebuffer pixel.
    #[wasm_bindgen(js_name = pickWorld)]
    pub fn pick_world(&self, sx: f32, sy: f32) -> Vec<f32> {
        let (x, z) = self.scene.pick_world(sx, sy);
        vec![x, z]
    }

    #[wasm_bindgen(js_name = pickUnit)]
    pub fn pick_unit(&self, sx: f32, sy: f32, skip: Option<String>) -> Option<String> {
        self.scene.pick_unit_except(sx, sy, skip.as_deref()).map(str::to_owned)
    }

    pub fn tick(&mut self, dt: f32) { self.scene.tick(dt); }

    /// Render and blit to the canvas.
    pub fn draw(&mut self) -> Result<(), JsValue> {
        self.scene.draw();
        self.scene.write_rgba(&mut self.rgba);
        let img = ImageData::new_with_u8_clamped_array_and_sh(Clamped(&self.rgba), self.scene.width() as u32, self.scene.height() as u32)?;
        self.ctx.put_image_data(&img, 0.0, 0.0)
    }
}
