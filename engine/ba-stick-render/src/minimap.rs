// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Engine-drawn minimap. The static layer (terrain, water, walls, bridges,
//! props, translucent roads and labels) is baked once per zone into an RGBA
//! texture in the same iso orientation as the main view; each frame is one
//! window blit plus a few dynamic markers composited over the final RGBA.
use crate::mapfont;
use crate::props::{kind, Prop};
use crate::zone::{Zone, F_BLOCKED, F_BRIDGE, F_STONE, F_TRAIL, F_WATER};

/// Texels per metre of world.
pub const PX_PER_M: f32 = 1.0;
/// Panel size in framebuffer pixels.
pub const PANEL_W: usize = 148;
pub const PANEL_H: usize = 104;
pub const MARGIN: usize = 6;

pub mod label {
    pub const AREA: u8 = 0;
    pub const CAMP: u8 = 1;
    pub const LANDMARK: u8 = 2;
    pub const WATER: u8 = 3;
}

#[derive(Clone, Debug)]
pub struct Road {
    pub name: String,
    pub pts: Vec<(f32, f32)>,
}

#[derive(Clone, Debug)]
pub struct Label {
    pub text: String,
    pub x: f32,
    pub z: f32,
    pub kind: u8,
}

/// Marker for the dynamic pass: 0 player (arrow), 1 hostile, 2 npc, 3 other player.
#[derive(Clone, Copy, Debug)]
pub struct Marker {
    pub x: f32,
    pub z: f32,
    pub kind: u8,
}

#[derive(Default)]
pub struct Minimap {
    pub on: bool,
    /// Panel fills the framebuffer. The corner control toggles this.
    pub full: bool,
    pub title: String,
    pub roads: Vec<Road>,
    pub labels: Vec<Label>,
    dirty: bool,
    tex: Vec<[u8; 4]>,
    tw: usize,
    th: usize,
    /// Map-space offset: texel = (x - z) * K - ox, (x + z) * K - oy.
    ox: f32,
    oy: f32,
    /// Labels actually placed by the last bake (after collision culling).
    pub placed: Vec<String>,
    pub bakes: u32,
}

const K: f32 = PX_PER_M * std::f32::consts::FRAC_1_SQRT_2;
const BG: [u8; 4] = [24, 22, 20, 255];
const INK: [u8; 3] = [16, 14, 12];

fn rgb(c: u32) -> [u8; 3] {
    [(c >> 16) as u8, (c >> 8) as u8, c as u8]
}

fn mul(c: [u8; 3], k: f32) -> [u8; 3] {
    c.map(|v| (v as f32 * k).clamp(0.0, 255.0) as u8)
}

fn mix(a: [u8; 3], b: [u8; 3], t: f32) -> [u8; 3] {
    [0, 1, 2].map(|i| (a[i] as f32 + (b[i] as f32 - a[i] as f32) * t).round() as u8)
}

impl Minimap {
    pub fn new() -> Minimap {
        Minimap {
            on: true,
            ..Default::default()
        }
    }

    pub fn invalidate(&mut self) {
        self.dirty = true;
    }

    pub fn clear(&mut self) {
        self.roads.clear();
        self.labels.clear();
        self.tex.clear();
        self.tw = 0;
        self.th = 0;
        self.dirty = false;
    }

    pub fn needs_bake(&self) -> bool {
        self.dirty
    }

    pub fn baked(&self) -> bool {
        !self.tex.is_empty()
    }

    pub fn tex_size(&self) -> (usize, usize) {
        (self.tw, self.th)
    }

    /// World point to texel.
    pub fn to_tex(&self, x: f32, z: f32) -> (f32, f32) {
        ((x - z) * K - self.ox, (x + z) * K - self.oy)
    }

    fn to_world(&self, tx: f32, ty: f32) -> (f32, f32) {
        let u = (tx + self.ox) / K;
        let v = (ty + self.oy) / K;
        ((u + v) * 0.5, (v - u) * 0.5)
    }

    /// Bake the static layer. Called once per zone (and when map data changes).
    pub fn bake(&mut self, zone: &Zone, props: &[Prop]) {
        self.dirty = false;
        self.bakes += 1;
        let (x0, z0) = (zone.min_x, zone.min_z);
        let (x1, z1) = (
            x0 + zone.w as f32 * zone.cell,
            z0 + zone.h as f32 * zone.cell,
        );
        let us = [x0 - z0, x0 - z1, x1 - z0, x1 - z1];
        let vs = [x0 + z0, x0 + z1, x1 + z0, x1 + z1];
        let fmin = |a: &[f32; 4]| a.iter().cloned().fold(f32::MAX, f32::min);
        let fmax = |a: &[f32; 4]| a.iter().cloned().fold(f32::MIN, f32::max);
        self.ox = fmin(&us) * K;
        self.oy = fmin(&vs) * K;
        self.tw = ((fmax(&us) * K - self.ox).ceil() as usize).max(1);
        self.th = ((fmax(&vs) * K - self.oy).ceil() as usize).max(1);
        let (tw, th) = (self.tw, self.th);
        self.tex = vec![BG; tw * th];

        // Terrain: biome colour, NW hillshade, height contours, water, bridges, walls.
        let sun = (
            -std::f32::consts::FRAC_1_SQRT_2,
            std::f32::consts::FRAC_1_SQRT_2,
        ); // light from the NW (shared SUN_DIR)
        let water_c = rgb(0x2f6a86);
        let shore_c = rgb(0x5d97ad);
        let bridge_c = rgb(0xa89a7e);
        let stone_c = rgb(0x8e877a);
        let wall_c = rgb(0x3a3631);
        for ty in 0..th {
            for tx in 0..tw {
                let (x, z) = self.to_world(tx as f32 + 0.5, ty as f32 + 0.5);
                if x < x0 || z < z0 || x >= x1 || z >= z1 {
                    continue;
                }
                let (i, j) = zone.cell_of(x, z);
                let id = zone.idx(i, j);
                let f = zone.flags[id];
                let b = zone.biome[id] as usize & 15;
                // Irregular zones mark the outside of the land mask as blocked
                // crypt. Leave the parchment empty so the footprint can branch.
                if f & F_BLOCKED != 0 && b == 11 {
                    continue;
                }
                let h = zone.height_at(x, z);
                let c = if f & F_BRIDGE != 0 {
                    bridge_c
                } else if f & F_WATER != 0 {
                    let shore = [(2, 0), (-2, 0), (0, 2), (0, -2)]
                        .iter()
                        .any(|&(di, dj)| zone.flags[zone.idx(i + di, j + dj)] & F_WATER == 0);
                    if shore {
                        shore_c
                    } else {
                        water_c
                    }
                } else {
                    let base = rgb(crate::palette::BIOME_BASE[b]);
                    let hs =
                        zone.height_at(x + sun.0, z + sun.1) - zone.height_at(x - sun.0, z - sun.1);
                    let mut k = (1.0 + hs * 0.35).clamp(0.62, 1.32);
                    let band = |hh: f32| (hh / 1.5).floor();
                    if band(zone.height_at(x + 0.7, z)) != band(h)
                        || band(zone.height_at(x, z + 0.7)) != band(h)
                    {
                        k *= 0.86;
                    }
                    let mut c = mul(base, k);
                    if f & F_STONE != 0 {
                        c = mix(c, stone_c, 0.5);
                    } else if f & F_TRAIL != 0 {
                        c = mix(c, rgb(0x8a7a5c), 0.35);
                    }
                    if f & F_BLOCKED != 0 {
                        c = mix(c, wall_c, 0.55);
                    }
                    c
                };
                self.tex[ty * tw + tx] = [c[0], c[1], c[2], 255];
            }
        }

        // Props: canopy dots, rocks, walls, bridges, camp gear.
        for p in props {
            match p.kind {
                0..=4 => {
                    let r = (0.9 + p.s * 0.25).min(2.2) * PX_PER_M * 0.5;
                    self.disc(p.x, p.z, r, mul(rgb(0x2c3a26), 1.0), 0.85);
                    let (tx, ty) = self.to_tex(p.x - 0.3, p.z + 0.3);
                    self.put(tx as i32, ty as i32, rgb(0x56704a), 0.9);
                }
                kind::ROCK | kind::STONE | kind::PEAK => {
                    let r = if p.kind == kind::PEAK {
                        (p.w.max(p.s) * 0.3).clamp(1.0, 6.0)
                    } else {
                        0.7
                    };
                    self.disc(p.x, p.z, r * PX_PER_M * 0.5, rgb(0x7d7871), 0.8);
                }
                kind::WALL_BLOCK => self.obox(
                    p.x,
                    p.z,
                    p.yaw,
                    p.w.max(0.5),
                    p.d.max(0.5),
                    rgb(0x46413a),
                    1.0,
                ),
                kind::RIVER_WALL => self.obox(
                    p.x,
                    p.z,
                    p.yaw,
                    p.w.max(0.6),
                    p.s.max(0.5),
                    rgb(0x55504a),
                    1.0,
                ),
                kind::BRIDGE => {
                    self.obox(p.x, p.z, p.yaw, p.w + 0.8, p.s + 0.4, rgb(0x2e2a25), 1.0);
                    self.obox(p.x, p.z, p.yaw, p.w, p.s, rgb(0xb8aa8c), 1.0);
                }
                kind::TENT | kind::LEAN_TO | kind::STALL | kind::TRAINER => {
                    self.obox(p.x, p.z, p.yaw, 2.0, 2.0, rgb(0x8c6a44), 1.0)
                }
                kind::FIRE_PIT => {
                    self.disc(p.x, p.z, 2.5, rgb(0xf0a040), 0.35);
                    self.disc(p.x, p.z, 1.2, rgb(0xffd070), 1.0);
                }
                _ => {}
            }
        }

        // Roads: translucent ribbons with a soft dark edge, blended once per texel.
        let mut mask = vec![0u8; tw * th];
        let core = (3.3 * PX_PER_M * 0.5).max(1.7);
        let roads = std::mem::take(&mut self.roads);
        for r in &roads {
            for s in r.pts.windows(2) {
                let (ax, ay) = self.to_tex(s[0].0, s[0].1);
                let (bx, by) = self.to_tex(s[1].0, s[1].1);
                let n = ((bx - ax).hypot(by - ay)).ceil().max(1.0) as usize;
                for k in 0..=n {
                    let t = k as f32 / n as f32;
                    let (cx, cy) = (ax + (bx - ax) * t, ay + (by - ay) * t);
                    let rr = core + 1.0;
                    for yy in (cy - rr).floor() as i32..=(cy + rr).ceil() as i32 {
                        for xx in (cx - rr).floor() as i32..=(cx + rr).ceil() as i32 {
                            if xx < 0 || yy < 0 || xx >= tw as i32 || yy >= th as i32 {
                                continue;
                            }
                            let d = (xx as f32 + 0.5 - cx).hypot(yy as f32 + 0.5 - cy);
                            let m = if d <= core {
                                2
                            } else if d <= rr {
                                1
                            } else {
                                0
                            };
                            let o = &mut mask[yy as usize * tw + xx as usize];
                            *o = (*o).max(m);
                        }
                    }
                }
            }
        }
        let road_c = rgb(0xf7e6b5);
        for (i, &m) in mask.iter().enumerate() {
            let a = match m {
                2 => 0.62,
                1 => 0.4,
                _ => continue,
            };
            let c = if m == 2 { road_c } else { INK };
            let p = &mut self.tex[i];
            let q = mix([p[0], p[1], p[2]], c, a);
            *p = [q[0], q[1], q[2], 255];
        }

        // Labels: camps and areas first, then landmarks, roads, water; skip overlaps.
        let mut placed: Vec<(i32, i32, i32, i32)> = Vec::new();
        self.placed.clear();
        let labels = std::mem::take(&mut self.labels);
        let mut order: Vec<&Label> = labels.iter().collect();
        let pri = |k: u8| match k {
            label::CAMP => 0,
            label::AREA => 1,
            label::LANDMARK => 2,
            _ => 4,
        };
        order.sort_by_key(|l| pri(l.kind));
        let mut queue: Vec<(String, Vec<(f32, f32)>, u8)> = Vec::new();
        for l in order.iter().filter(|l| pri(l.kind) < 4) {
            queue.push((l.text.to_uppercase(), vec![self.to_tex(l.x, l.z)], l.kind));
        }
        for r in roads.iter().filter(|r| !r.name.is_empty()) {
            let c: Vec<(f32, f32)> = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]
                .iter()
                .filter_map(|&t| self.road_at(r, t))
                .collect();
            queue.push((r.name.to_uppercase(), c, 9));
        }
        for l in order.iter().filter(|l| pri(l.kind) == 4) {
            queue.push((l.text.to_uppercase(), vec![self.to_tex(l.x, l.z)], l.kind));
        }
        for (text, anchors, kind) in queue {
            let gap = if kind == label::AREA { 2 } else { 1 };
            let w = mapfont::width_spaced(&text, 1, gap) as i32;
            let h = 5;
            let icon = matches!(kind, label::CAMP | label::LANDMARK);
            // Candidate spots: each anchor as given, then nudged above/below and sideways.
            let nudges: &[(i32, i32)] = if kind == 9 {
                &[(0, -6), (0, 6), (0, -11), (0, 11)]
            } else {
                &[(0, 0), (0, -9), (0, 9), (w / 2 + 4, 0), (-w / 2 - 4, 0)]
            };
            let mut spot = None;
            'find: for &(tx, ty) in &anchors {
                for &(nx, ny) in nudges {
                    let (ax, ay) = (tx.round() as i32, ty.round() as i32);
                    let lx = ax + nx - w / 2;
                    let ly = if icon && nx == 0 && ny == 0 {
                        ay + 4
                    } else {
                        ay + ny - h / 2
                    };
                    let rect = (lx - 2, ly - 2, lx + w + 2, ly + h + 2);
                    let mut all = vec![rect];
                    if icon {
                        all.push((ax - 4, ay - 4, ax + 5, ay + 3));
                    }
                    if all.iter().all(|q| {
                        !placed
                            .iter()
                            .any(|r| q.0 < r.2 && r.0 < q.2 && q.1 < r.3 && r.1 < q.3)
                    }) {
                        spot = Some((ax, ay, lx, ly, all));
                        break 'find;
                    }
                }
            }
            let Some((ax, ay, lx, ly, rects)) = spot else {
                continue;
            };
            placed.extend(rects);
            if icon {
                self.icon(ax, ay, kind);
            }
            let col = match kind {
                label::AREA => rgb(0xfff3d0),
                label::CAMP => rgb(0xf6c95a),
                label::LANDMARK => rgb(0xe9e6dc),
                label::WATER => rgb(0xa9dcf0),
                _ => rgb(0xf6e7bd),
            };
            self.text(&text, lx, ly, 1, gap, col);
            self.placed.push(text);
        }
        self.roads = roads;
        self.labels = labels;
    }

    /// Texel at fraction `f` of a road's length.
    fn road_at(&self, r: &Road, f: f32) -> Option<(f32, f32)> {
        let segs: Vec<f32> = r
            .pts
            .windows(2)
            .map(|s| (s[1].0 - s[0].0).hypot(s[1].1 - s[0].1))
            .collect();
        let total: f32 = segs.iter().sum();
        if total <= 0.0 {
            return None;
        }
        let mut acc = 0.0;
        for (i, &l) in segs.iter().enumerate() {
            if acc + l >= total * f {
                let t = (total * f - acc) / l.max(1e-6);
                let (x, z) = (
                    r.pts[i].0 + (r.pts[i + 1].0 - r.pts[i].0) * t,
                    r.pts[i].1 + (r.pts[i + 1].1 - r.pts[i].1) * t,
                );
                return Some(self.to_tex(x, z));
            }
            acc += l;
        }
        None
    }

    fn put(&mut self, x: i32, y: i32, c: [u8; 3], a: f32) {
        if x < 0 || y < 0 || x >= self.tw as i32 || y >= self.th as i32 {
            return;
        }
        let p = &mut self.tex[y as usize * self.tw + x as usize];
        let q = mix([p[0], p[1], p[2]], c, a);
        *p = [q[0], q[1], q[2], 255];
    }

    fn disc(&mut self, x: f32, z: f32, r: f32, c: [u8; 3], a: f32) {
        let (cx, cy) = self.to_tex(x, z);
        let r = r.max(0.6);
        for yy in (cy - r).floor() as i32..=(cy + r).ceil() as i32 {
            for xx in (cx - r).floor() as i32..=(cx + r).ceil() as i32 {
                if (xx as f32 + 0.5 - cx).hypot(yy as f32 + 0.5 - cy) <= r {
                    self.put(xx, yy, c, a);
                }
            }
        }
    }

    /// Oriented box: `len` along (sin yaw, cos yaw), `wid` across, in metres.
    #[allow(clippy::too_many_arguments)]
    fn obox(&mut self, x: f32, z: f32, yaw: f32, wid: f32, len: f32, c: [u8; 3], a: f32) {
        let (fx, fz) = (yaw.sin(), yaw.cos());
        let (cx, cy) = self.to_tex(x, z);
        let rr = (wid.hypot(len) * 0.5 * PX_PER_M).ceil() as i32 + 1;
        for yy in cy as i32 - rr..=cy as i32 + rr {
            for xx in cx as i32 - rr..=cx as i32 + rr {
                let (wx, wz) = self.to_world(xx as f32 + 0.5, yy as f32 + 0.5);
                let (dx, dz) = (wx - x, wz - z);
                let along = dx * fx + dz * fz;
                let across = dx * fz - dz * fx;
                if along.abs() <= len * 0.5 && across.abs() <= wid * 0.5 {
                    self.put(xx, yy, c, a);
                }
            }
        }
    }

    fn icon(&mut self, x: i32, y: i32, kind: u8) {
        if kind == label::CAMP {
            // Tent: filled triangle with an ink outline.
            for r in 0..5i32 {
                for dx in -r..=r {
                    let edge = dx.abs() == r || r == 4;
                    self.put(
                        x + dx,
                        y - 3 + r,
                        if edge { INK } else { rgb(0xf6c95a) },
                        1.0,
                    );
                }
            }
        } else {
            for (dx, dy) in [
                (0i32, -2i32),
                (-1, -1),
                (0, -1),
                (1, -1),
                (-2, 0),
                (-1, 0),
                (0, 0),
                (1, 0),
                (2, 0),
                (-1, 1),
                (0, 1),
                (1, 1),
                (0, 2),
            ] {
                let edge = dx.abs() + dy.abs() == 2;
                self.put(x + dx, y + dy, if edge { INK } else { rgb(0xe9e6dc) }, 1.0);
            }
        }
    }

    fn text(&mut self, s: &str, x: i32, y: i32, scale: usize, gap: usize, c: [u8; 3]) {
        let mut ink = Vec::new();
        mapfont::raster_spaced(s, scale, gap, |px, py| {
            ink.push((x + px as i32, y + py as i32))
        });
        for &(px, py) in &ink {
            for (dx, dy) in [
                (-1, 0),
                (1, 0),
                (0, -1),
                (0, 1),
                (1, 1),
                (-1, -1),
                (1, -1),
                (-1, 1),
            ] {
                self.put(px + dx, py + dy, INK, 0.72);
            }
        }
        for &(px, py) in &ink {
            self.put(px, py, c, 1.0);
        }
    }

    /// Panel origin (top-left) in framebuffer pixels: top-right corner.
    pub fn panel_origin(fw: usize) -> (usize, usize) {
        (fw.saturating_sub(PANEL_W + MARGIN), MARGIN)
    }

    fn panel_size(&self, fw: usize, fh: usize) -> (usize, usize) {
        if self.full {
            (fw.saturating_sub(MARGIN * 2), fh.saturating_sub(MARGIN * 2))
        } else {
            (PANEL_W, PANEL_H)
        }
    }

    fn origin(&self, fw: usize, pw: usize) -> (usize, usize) {
        if self.full {
            (MARGIN, MARGIN)
        } else {
            (fw.saturating_sub(pw + MARGIN), MARGIN)
        }
    }

    /// True when the point is inside the drawn panel.
    pub fn panel_hit(&self, fw: usize, fh: usize, sx: f32, sy: f32) -> bool {
        if !self.on || self.tex.is_empty() {
            return false;
        }
        let (pw, ph) = self.panel_size(fw, fh);
        let (px, py) = self.origin(fw, pw);
        if pw < 16 || ph < 16 || px + pw > fw || py + ph > fh {
            return false;
        }
        let x = sx.round() as i32;
        let y = sy.round() as i32;
        x >= px as i32 && y >= py as i32 && x < (px + pw) as i32 && y < (py + ph) as i32
    }

    /// Top-left control on the panel. False when the minimap is hidden.
    pub fn button_hit(&self, fw: usize, fh: usize, sx: f32, sy: f32) -> bool {
        if !self.panel_hit(fw, fh, sx, sy) {
            return false;
        }
        let (pw, _) = self.panel_size(fw, fh);
        let (px, py) = self.origin(fw, pw);
        let x = sx.round() as i32 - px as i32;
        let y = sy.round() as i32 - py as i32;
        (2..12).contains(&x) && (1..10).contains(&y)
    }

    /// Composite the minimap over the final RGBA frame: one window blit
    /// centred on (cx, cz), the frame, a north tick and the markers.
    #[allow(clippy::too_many_arguments)]
    pub fn composite(
        &self,
        out: &mut [u8],
        fw: usize,
        fh: usize,
        cx: f32,
        cz: f32,
        yaw: f32,
        marks: &[Marker],
    ) {
        let (pw, ph) = self.panel_size(fw, fh);
        let (px, py) = self.origin(fw, pw);
        if !self.on || self.tex.is_empty() || pw < 16 || ph < 16 || px + pw > fw || py + ph > fh {
            return;
        }
        let (ctx, cty) = self.to_tex(cx, cz);
        // Expanded map shows the whole basin, scaled to the panel, the way a
        // region map shows the land with the camp as a small place on it.
        let (fit_s, fit_ox, fit_oy) = if self.full {
            let s = (pw as f32 / self.tw.max(1) as f32).min(ph as f32 / self.th.max(1) as f32);
            let dw = self.tw as f32 * s;
            let dh = self.th as f32 * s;
            (s, (pw as f32 - dw) * 0.5, (ph as f32 - dh) * 0.5)
        } else {
            (1.0, 0.0, 0.0)
        };
        let sx = ctx.round() as i32 - pw as i32 / 2;
        let sy = cty.round() as i32 - ph as i32 / 2;
        for y in 0..ph {
            let o = ((py + y) * fw + px) * 4;
            let row = &mut out[o..o + pw * 4];
            if self.full {
                for (x, p) in row.chunks_exact_mut(4).enumerate() {
                    let tx = ((x as f32 + 0.5 - fit_ox) / fit_s) as i32;
                    let ty = ((y as f32 + 0.5 - fit_oy) / fit_s) as i32;
                    let t = if tx < 0 || ty < 0 || tx >= self.tw as i32 || ty >= self.th as i32 {
                        BG
                    } else {
                        self.tex[ty as usize * self.tw + tx as usize]
                    };
                    p.copy_from_slice(&t);
                }
                continue;
            }
            let ty = sy + y as i32;
            if ty < 0 || ty >= self.th as i32 {
                for p in row.chunks_exact_mut(4) {
                    p.copy_from_slice(&BG);
                }
                continue;
            }
            let base = ty as usize * self.tw;
            for (x, p) in row.chunks_exact_mut(4).enumerate() {
                let tx = sx + x as i32;
                let t = if tx < 0 || tx >= self.tw as i32 {
                    BG
                } else {
                    self.tex[base + tx as usize]
                };
                p.copy_from_slice(&t);
            }
        }
        macro_rules! put {
            ($x:expr, $y:expr, $c:expr) => {{
                let (x, y, c): (i32, i32, [u8; 3]) = ($x, $y, $c);
                if x >= 0 && y >= 0 && (x as usize) < pw && (y as usize) < ph {
                    let o = ((py + y as usize) * fw + px + x as usize) * 4;
                    out[o..o + 4].copy_from_slice(&[c[0], c[1], c[2], 255]);
                }
            }};
        }
        // Markers relative to the panel centre.
        let half = (pw as f32 * 0.5, ph as f32 * 0.5);
        for m in marks.iter().filter(|m| m.kind != 0) {
            let (mx, my) = self.to_tex(m.x, m.z);
            let (x, y) = if self.full {
                (
                    (fit_ox + mx * fit_s).round() as i32,
                    (fit_oy + my * fit_s).round() as i32,
                )
            } else {
                (
                    (mx - ctx + half.0).round() as i32,
                    (my - cty + half.1).round() as i32,
                )
            };
            let c = match m.kind {
                1 => rgb(0xe0543e),
                2 => rgb(0xf2d36b),
                _ => rgb(0x7fd0ff),
            };
            for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                put!(x + dx, y + dy, c);
            }
        }
        // Player arrow: forward (sin yaw, cos yaw) in map space.
        let (fx, fz) = (yaw.sin(), yaw.cos());
        let (dx, dy) = ((fx - fz) * K, (fx + fz) * K);
        let l = dx.hypot(dy).max(1e-6);
        let (ux, uy) = (dx / l, dy / l);
        let (cx0, cy0) = if self.full {
            let (px0, py0) = self.to_tex(cx, cz);
            (fit_ox + px0 * fit_s, fit_oy + py0 * fit_s)
        } else {
            (half.0, half.1)
        };
        let tip = (cx0 + ux * 6.0, cy0 + uy * 6.0);
        let lft = (cx0 - ux * 3.0 - uy * 3.5, cy0 - uy * 3.0 + ux * 3.5);
        let rgt = (cx0 - ux * 3.0 + uy * 3.5, cy0 - uy * 3.0 - ux * 3.5);
        let back = (cx0 - ux * 1.5, cy0 - uy * 1.5);
        let inside = |p: (f32, f32), a: (f32, f32), b: (f32, f32), c: (f32, f32)| {
            let s = |p: (f32, f32), q: (f32, f32), r: (f32, f32)| {
                (p.0 - r.0) * (q.1 - r.1) - (q.0 - r.0) * (p.1 - r.1)
            };
            let (d1, d2, d3) = (s(p, a, b), s(p, b, c), s(p, c, a));
            !((d1 < 0.0 || d2 < 0.0 || d3 < 0.0) && (d1 > 0.0 || d2 > 0.0 || d3 > 0.0))
        };
        let tri = |p: (f32, f32)| inside(p, tip, lft, back) || inside(p, tip, back, rgt);
        for y in cy0 as i32 - 7..=cy0 as i32 + 7 {
            for x in cx0 as i32 - 7..=cx0 as i32 + 7 {
                let p = (x as f32 + 0.5, y as f32 + 0.5);
                if tri(p) {
                    put!(x, y, rgb(0xffffff));
                } else if [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)]
                    .iter()
                    .any(|d: &(f32, f32)| tri((p.0 + d.0, p.1 + d.1)))
                {
                    put!(x, y, INK);
                }
            }
        }
        // North badge in the bottom-left corner (+z points down-left in this view).
        for y in ph as i32 - 12..ph as i32 - 2 {
            for x in 2..12 {
                put!(x, y, INK);
            }
        }
        let mut ink = Vec::new();
        mapfont::raster("N", 1, |x, y| ink.push((x as i32, y as i32)));
        for &(x, y) in &ink {
            put!(5 + x, ph as i32 - 9 + y, rgb(0xf6c95a));
        }
        // Tick from the badge toward the corner it names.
        put!(3, ph as i32 - 3, rgb(0xf6c95a));
        put!(2, ph as i32 - 2, rgb(0xf6c95a));
        // Title strip and frame.
        if !self.title.is_empty() {
            let t = self.title.to_uppercase();
            let w = mapfont::width(&t, 1) as i32;
            for y in 0..8 {
                for x in 0..pw as i32 {
                    let o = ((py + y) * fw + px + x as usize) * 4;
                    for c in 0..3 {
                        out[o + c] = (out[o + c] as f32 * 0.35) as u8;
                    }
                }
            }
            let tx = pw as i32 / 2 - w / 2;
            let mut ink = Vec::new();
            mapfont::raster(&t, 1, |x, y| ink.push((x as i32, y as i32)));
            for &(x, y) in &ink {
                put!(tx + x, 2 + y, rgb(0xe8dcb8));
            }
        }
        for x in 0..pw as i32 {
            for (y, c) in [
                (0, INK),
                (1, rgb(0x9a7d45)),
                (ph as i32 - 2, rgb(0x9a7d45)),
                (ph as i32 - 1, INK),
            ] {
                if (1..pw as i32 - 1).contains(&x) || y == 0 || y == ph as i32 - 1 {
                    put!(x, y, c);
                }
            }
        }
        for y in 0..ph as i32 {
            for (x, c) in [
                (0, INK),
                (1, rgb(0x9a7d45)),
                (pw as i32 - 2, rgb(0x9a7d45)),
                (pw as i32 - 1, INK),
            ] {
                if (1..ph as i32 - 1).contains(&y) || x == 0 || x == pw as i32 - 1 {
                    put!(x, y, c);
                }
            }
        }
        // Top-left control. Corners mean expand; an X means shrink.
        let gold = rgb(0xf6c95a);
        if self.full {
            for i in 0..7 {
                put!(3 + i, 2 + i, gold);
                put!(9 - i, 2 + i, gold);
            }
        } else {
            for (ox, oy, dx, dy) in [
                (3, 2, 1, 1),
                (9, 2, -1, 1),
                (3, 8, 1, -1),
                (9, 8, -1, -1),
            ] {
                for i in 0..3 {
                    put!(ox + dx * i, oy, gold);
                    put!(ox, oy + dy * i, gold);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flat() -> Zone {
        let (w, h) = (80, 80);
        let mut flags = vec![0u8; w * h];
        for j in 0..h {
            for i in 30..36 {
                flags[j * w + i] = F_WATER;
            }
        }
        Zone {
            min_x: -20.0,
            min_z: -20.0,
            cell: 0.5,
            w,
            h,
            biome: vec![13; w * h],
            flags,
            height: vec![0.0; w * h],
        }
    }

    #[test]
    fn bakes_once_and_projects_like_the_iso_view() {
        let mut m = Minimap::new();
        m.roads.push(Road {
            name: "Test Road".into(),
            pts: vec![(-10.0, -10.0), (10.0, 10.0)],
        });
        m.labels.push(Label {
            text: "Camp".into(),
            x: 0.0,
            z: 0.0,
            kind: label::CAMP,
        });
        m.invalidate();
        m.bake(&flat(), &[]);
        assert_eq!(m.bakes, 1);
        assert!(!m.needs_bake());
        assert!(m.placed.iter().any(|s| s == "CAMP") && m.placed.iter().any(|s| s == "TEST ROAD"));
        // Screen x grows with (x - z), screen y with (x + z), like the camera.
        let (a, b) = (m.to_tex(0.0, 0.0), m.to_tex(1.0, 0.0));
        assert!(b.0 > a.0 && b.1 > a.1);
        let c = m.to_tex(0.0, 1.0);
        assert!(c.0 < a.0 && c.1 > a.1);
        // Round trip.
        let (x, z) = m.to_world(a.0 + 3.0, a.1 + 5.0);
        let back = m.to_tex(x, z);
        assert!((back.0 - a.0 - 3.0).abs() < 1e-3 && (back.1 - a.1 - 5.0).abs() < 1e-3);
        // Composite writes only the panel.
        let (fw, fh) = (640, 360);
        let mut out = vec![7u8; fw * fh * 4];
        m.composite(
            &mut out,
            fw,
            fh,
            0.0,
            0.0,
            0.0,
            &[Marker {
                x: 3.0,
                z: 3.0,
                kind: 1,
            }],
        );
        assert_eq!(out[0], 7);
        let (px, py) = Minimap::panel_origin(fw);
        assert_ne!(out[((py + PANEL_H / 2) * fw + px + PANEL_W / 2) * 4], 7);
        assert!(m.button_hit(fw, fh, (px + 4) as f32, (py + 3) as f32));
        assert!(!m.button_hit(fw, fh, (px + 40) as f32, (py + 40) as f32));
        m.full = true;
        let mut big = vec![7u8; fw * fh * 4];
        m.composite(&mut big, fw, fh, 0.0, 0.0, 0.0, &[]);
        assert_eq!(big[0], 7);
        assert_ne!(big[((MARGIN + 40) * fw + MARGIN + 40) * 4], 7);
        assert!(m.button_hit(fw, fh, (MARGIN + 4) as f32, (MARGIN + 3) as f32));
        assert!(m.panel_hit(fw, fh, (fw / 2) as f32, (fh / 2) as f32));
        assert!(!m.panel_hit(fw, fh, 0.0, 0.0));
    }
}
