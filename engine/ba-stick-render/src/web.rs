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

    /// Add a zone to the world without unloading the others. `ox`/`oz` are its world origin.
    #[wasm_bindgen(js_name = placeZone)]
    pub fn place_zone(&mut self, bytes: &[u8], ox: f32, oz: f32) -> Result<(), JsValue> {
        self.scene.place_zone(bytes, ox, oz).map_err(|e| JsValue::from_str(&e))
    }

    /// Props for a placed zone, shifted by the same origin.
    #[wasm_bindgen(js_name = placeProps)]
    pub fn place_props(&mut self, bytes: &[u8], ox: f32, oz: f32) -> Result<usize, JsValue> {
        self.scene.place_props(bytes, ox, oz).map_err(|e| JsValue::from_str(&e))
    }

    /// Local origin of the zone currently shown on the minimap.
    #[wasm_bindgen(js_name = setMapOrigin)]
    pub fn set_map_origin(&mut self, ox: f32, oz: f32) {
        self.scene.set_map_origin(ox, oz);
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

    /// Boot menu forge embers over a host-provided still image.
    #[wasm_bindgen(js_name = setBootMenu)]
    pub fn set_boot_menu(&mut self, on: bool) {
        self.scene.set_boot_menu(on);
    }

    /// Toggle lighting / haze / skyline / vignette (#26).
    /// `iso` (default), `tp` / `third` / `3d`, or `fp` / `first`.
    #[wasm_bindgen(js_name = setCamMode)]
    pub fn set_cam_mode(&mut self, mode: &str) { self.scene.set_cam_mode(mode); }

    #[wasm_bindgen(js_name = camMode)]
    pub fn cam_mode(&self) -> String { self.scene.cam_mode().to_owned() }

    /// Held numpad look, −1..1. Positive yaw turns right; positive pitch looks down.
    #[wasm_bindgen(js_name = setLook)]
    pub fn set_look(&mut self, yaw: f32, pitch: f32) { self.scene.set_look(yaw, pitch); }

    /// Right-drag look in framebuffer pixels.
    #[wasm_bindgen(js_name = addLook)]
    pub fn add_look(&mut self, dx: f32, dy: f32) { self.scene.add_look(dx, dy); }

    /// True when the eye is inside the followed character's head.
    #[wasm_bindgen(js_name = firstPerson)]
    pub fn first_person(&self) -> bool { self.scene.first_person() }

    /// Legacy toggle: true = third person, false = isometric.
    #[wasm_bindgen(js_name = setView3d)]
    pub fn set_view3d(&mut self, on: bool) {
        self.scene.set_cam_mode(if on { "tp" } else { "iso" });
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

    /// Pale Hollow weather: kind 0 clear, 1 rain, 2 fog, 3 snow; snowCover 0..1.
    #[wasm_bindgen(js_name = setWeather)]
    pub fn set_weather(&mut self, kind: u8, snow_cover: f32) {
        self.scene.set_weather(kind, snow_cover);
    }

    /// Local player cosmetics: cycle hair style (`;`), hair colour (`'`), body colour (`L`).
    #[wasm_bindgen(js_name = cycleHairStyle)]
    pub fn cycle_hair_style(&mut self, delta: i32) {
        self.scene.cycle_hair_style(delta);
    }

    #[wasm_bindgen(js_name = cycleHairColor)]
    pub fn cycle_hair_color(&mut self, delta: i32) {
        self.scene.cycle_hair_color(delta);
    }

    #[wasm_bindgen(js_name = cycleBodyColor)]
    pub fn cycle_body_color(&mut self, delta: i32) {
        self.scene.cycle_body_color(delta);
    }

    /// Minimap (engine-drawn). Title shown on the panel strip.
    #[wasm_bindgen(js_name = setMapTitle)]
    pub fn set_map_title(&mut self, t: &str) { self.scene.set_map_title(t); }

    /// Road polyline as flat [x0, z0, x1, z1, ...] world metres.
    #[wasm_bindgen(js_name = addMapRoad)]
    pub fn add_map_road(&mut self, name: &str, pts: &[f32]) { self.scene.add_map_road(name, pts); }

    /// kind: 0 area, 1 camp, 2 landmark, 3 water.
    #[wasm_bindgen(js_name = addMapLabel)]
    pub fn add_map_label(&mut self, text: &str, x: f32, z: f32, kind: u8) { self.scene.add_map_label(text, x, z, kind); }

    #[wasm_bindgen(js_name = clearMapData)]
    pub fn clear_map_data(&mut self) { self.scene.clear_map_data(); }

    #[wasm_bindgen(js_name = setMinimap)]
    pub fn set_minimap(&mut self, on: bool) { self.scene.minimap.on = on; }

    /// Expand the minimap over the framebuffer. The corner control toggles this.
    #[wasm_bindgen(js_name = setMinimapFull)]
    pub fn set_minimap_full(&mut self, on: bool) { self.scene.minimap.full = on; }

    #[wasm_bindgen(js_name = minimapFull)]
    pub fn minimap_full(&self) -> bool { self.scene.minimap.full }

    /// True when (sx, sy) is the top-left control on the minimap.
    #[wasm_bindgen(js_name = minimapButton)]
    pub fn minimap_button(&self, sx: f32, sy: f32) -> bool {
        self.scene.minimap.button_hit(self.scene.width(), self.scene.height(), sx, sy)
    }

    /// True when (sx, sy) is inside the minimap panel.
    #[wasm_bindgen(js_name = minimapPanel)]
    pub fn minimap_panel(&self, sx: f32, sy: f32) -> bool {
        self.scene.minimap.panel_hit(self.scene.width(), self.scene.height(), sx, sy)
    }

    /// Number of static-layer bakes so far (perf check: one per zone).
    #[wasm_bindgen(js_name = minimapBakes)]
    pub fn minimap_bakes(&self) -> u32 { self.scene.minimap.bakes }

    /// Labels placed by the last bake, '|' separated (others were culled as overlaps).
    #[wasm_bindgen(js_name = minimapLabels)]
    pub fn minimap_labels(&self) -> String { self.scene.minimap.placed.join("|") }

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
    pub fn set_fx(
        &mut self,
        id: &str,
        hp: f32,
        cast: f32,
        aoe: f32,
        flags: u32,
        fade: f32,
        level_up: f32,
        weapon_edge: u8,
    ) -> bool {
        self.scene.set_fx(
            id,
            UnitFx {
                hp,
                cast,
                aoe,
                flags,
                fade,
                level_up,
                weapon_edge,
            },
        )
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
