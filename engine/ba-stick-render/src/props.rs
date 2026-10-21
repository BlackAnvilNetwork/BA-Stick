//! Static zone props (BAP1 from apps/stick-web/scripts/bake-props.ts): trees,
//! ground cover, the hub encampment, rock wall and mountain peaks, drawn
//! procedurally into the depth buffer so units sort in front of / behind them.
use stick_engine::camera::{Camera, P2, HEIGHT_PX};
use stick_engine::math::{v3, Vec3};
use stick_engine::raster::Framebuffer;
use crate::compat::*;

use crate::palette::*;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Prop {
    pub kind: u8,
    pub var: u8,
    pub x: f32,
    pub z: f32,
    pub y: f32,
    pub yaw: f32,
    pub s: f32,
    pub w: f32,
    pub h: f32,
    pub d: f32,
    /// Runtime-only joint data for river-wall runs (see [`link_walls`]):
    /// [miter at start, miter at end, base dy at start, base dy at end,
    /// top dy at start, top dy at end].
    /// A miter `k` moves the end corner at lateral offset `rx` to `fz ± s/2 + rx*k`.
    pub j: [f32; 6],
}

pub mod kind {
    pub const PINE: u8 = 0;
    pub const SPRUCE: u8 = 1;
    pub const CYPRESS: u8 = 2;
    pub const ASH_MED: u8 = 3;
    pub const ASH_TALL: u8 = 4;
    pub const LONG_GRASS: u8 = 10;
    pub const TALL_PATCH: u8 = 11;
    pub const FERN: u8 = 12;
    pub const TUFT: u8 = 13;
    pub const BUSH: u8 = 14;
    pub const ROCK: u8 = 15;
    pub const STALK: u8 = 16;
    pub const REED: u8 = 17;
    pub const SCRUB: u8 = 18;
    pub const BLOOM: u8 = 19;
    pub const SAPLING: u8 = 20;
    pub const WALL_BLOCK: u8 = 30;
    pub const MOSS: u8 = 31;
    pub const FIRE_PIT: u8 = 32;
    pub const TENT: u8 = 33;
    pub const BEDROLL: u8 = 34;
    pub const CRATE: u8 = 35;
    pub const CHEST: u8 = 36;
    pub const LEAN_TO: u8 = 37;
    pub const TRAINER: u8 = 38;
    pub const STALL: u8 = 39;
    pub const WEAPON_RACK: u8 = 40;
    pub const FIREWOOD: u8 = 41;
    pub const BARREL: u8 = 42;
    pub const BANNER: u8 = 43;
    pub const STONE: u8 = 44;
    pub const PEBBLE: u8 = 45;
    pub const PEAK: u8 = 46;
    /// Bank retaining wall run: s = length, w = thickness, h = height, d = coping.
    pub const RIVER_WALL: u8 = 47;
    /// Stone bridge: s = span, w = deck width, h = flat-deck lift over the end-to-end lerp,
    /// y = left end, d = right end height, var = ramp fraction x 200 (trapezoid profile).
    pub const BRIDGE: u8 = 48;
}

pub fn parse(bytes: &[u8]) -> Result<Vec<Prop>, String> {
    if bytes.len() < 8 || &bytes[..4] != b"BAP1" {
        return Err("not a BAP1 prop file".into());
    }
    let n = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
    const REC: usize = 2 + 4 * 8;
    if bytes.len() < 8 + n * REC {
        return Err("truncated BAP1".into());
    }
    let f = |o: usize| f32::from_le_bytes(bytes[o..o + 4].try_into().unwrap());
    Ok((0..n)
        .map(|i| {
            let o = 8 + i * REC;
            Prop {
                kind: bytes[o],
                var: bytes[o + 1],
                x: f(o + 2), z: f(o + 6), y: f(o + 10), yaw: f(o + 14),
                s: f(o + 18), w: f(o + 22), h: f(o + 26), d: f(o + 30),
                j: [0.0; 6],
            }
        })
        .collect::<Vec<_>>())
    .map(|mut v| {
        link_walls(&mut v);
        v
    })
}

/// Joins consecutive river-wall segments: where one segment's end meets
/// another's, both ends are mitered on the bisector of the two directions and
/// their bases meet at the average height. The run then reads as one wall with
/// clean corners, instead of overlapping boxes with stepped copings.
pub fn link_walls(props: &mut [Prop]) {
    const TOL: f32 = 0.12;
    let idx: Vec<usize> = (0..props.len()).filter(|&i| props[i].kind == kind::RIVER_WALL).collect();
    // (prop, end 0 = start / 1 = end, x, z, direction pointing out of the segment through that end)
    let ends: Vec<(usize, usize, f32, f32, f32, f32)> = idx
        .iter()
        .flat_map(|&i| {
            let p = props[i];
            let (fx, fz) = (p.yaw.sin(), p.yaw.cos());
            let h = p.s * 0.5;
            [(i, 0, p.x - fx * h, p.z - fz * h, -fx, -fz), (i, 1, p.x + fx * h, p.z + fz * h, fx, fz)]
        })
        .collect();
    for a in 0..ends.len() {
        let (i, ei, x, z, ox, oz) = ends[a];
        let best = ends
            .iter()
            .filter(|e| e.0 != i)
            .map(|e| (e, (e.2 - x).hypot(e.3 - z)))
            .filter(|(_, d)| *d < TOL)
            .min_by(|a, b| a.1.total_cmp(&b.1));
        let Some((&(j, _, _, _, px, pz), _)) = best else { continue };
        // travel into the joint along (ox, oz), leave it along -(px, pz)
        let (bx, bz) = (ox - px, oz - pz);
        let bl = bx.hypot(bz);
        if bl < 1e-3 {
            continue; // folded back on itself
        }
        let (bx, bz) = (bx / bl, bz / bl);
        let p = props[i];
        let (fx, fz) = (p.yaw.sin(), p.yaw.cos());
        let (rx, rz) = (p.yaw.cos(), -p.yaw.sin());
        let fb = fx * bx + fz * bz;
        if fb.abs() < 0.3 {
            continue; // too sharp to miter cleanly; leave the plain end
        }
        let k = (-(rx * bx + rz * bz) / fb).clamp(-2.0, 2.0);
        let dy = (props[j].y - p.y) * 0.5;
        props[i].j[ei] = k;
        props[i].j[2 + ei] = dy;
        // tops meet too (walls are raised locally to clear the water line)
        props[i].j[4 + ei] = (props[j].y + props[j].h - p.y - p.h) * 0.5;
    }
}

/// Rough world-space reach (for culling).
fn reach(p: &Prop) -> f32 {
    match p.kind {
        kind::PEAK => 6.0 * p.s,
        0..=4 => p.s * 0.5,
        kind::WALL_BLOCK => p.w.max(p.d),
        kind::RIVER_WALL => p.s,
        kind::BRIDGE => p.s * 0.5 + 1.0,
        _ => 2.0,
    }
}

/// Depth-tested triangle with interpolated depth.
pub fn tri(fb: &mut Framebuffer, a: P2, b: P2, c: P2, col: u8) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb.w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb.h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-4 {
        return;
    }
    let inv = 1.0 / area;
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
            let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
            let w2 = 1.0 - w0 - w1;
            if w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0 {
                fb.plot(x, y, a.d * w0 + b.d * w1 + c.d * w2, col);
            }
        }
    }
}

struct Ctx<'a> {
    fb: &'a mut Framebuffer,
    cam: &'a Camera,
    base: Vec3,
    f: Vec3,
    r: Vec3,
}

impl Ctx<'_> {
    /// Local (right, up, forward) → projected point.
    fn p(&self, rx: f32, uy: f32, fz: f32) -> P2 {
        self.cam.project(self.base + self.r * rx + v3(0.0, uy, 0.0) + self.f * fz)
    }
    fn quad(&mut self, a: P2, b: P2, c: P2, d: P2, col: u8) {
        tri(self.fb, a, b, c, col);
        tri(self.fb, a, c, d, col);
    }
    fn edge(&mut self, a: P2, b: P2) {
        self.fb.line(P2 { d: a.d - 0.02, ..a }, P2 { d: b.d - 0.02, ..b }, C_OUTLINE);
    }
    /// Oriented box centred at local (cx, cz), base at y0.
    #[allow(clippy::too_many_arguments)]
    fn boxy(&mut self, cx: f32, y0: f32, cz: f32, w: f32, h: f32, d: f32, top: u8, lit: u8, dark: u8) {
        let (hw, hd) = (w * 0.5, d * 0.5);
        let c = |sx: f32, y: f32, sz: f32| (cx + sx * hw, y, cz + sz * hd);
        let corners = [c(-1.0, 0.0, -1.0), c(1.0, 0.0, -1.0), c(1.0, 0.0, 1.0), c(-1.0, 0.0, 1.0)];
        let lo: Vec<P2> = corners.iter().map(|&(x, y, z)| self.p(x, y0 + y, z)).collect();
        let hi: Vec<P2> = corners.iter().map(|&(x, _, z)| self.p(x, y0 + h, z)).collect();
        // Side faces: draw all four; depth keeps the visible ones. Shade by facing.
        for i in 0..4 {
            let j = (i + 1) % 4;
            let col = if (hi[i].x + hi[j].x) * 0.5 > (hi[0].x + hi[2].x) * 0.5 { lit } else { dark };
            self.quad(lo[i], lo[j], hi[j], hi[i], col);
        }
        self.quad(hi[0], hi[1], hi[2], hi[3], top);
        for i in 0..4 {
            let j = (i + 1) % 4;
            self.edge(hi[i], hi[j]);
            self.edge(lo[i], hi[i]);
        }
    }
    /// A river-wall segment as a prism mitered at its joints (`Prop::j`).
    /// Joined end faces and their outlines are skipped, so a run has no seams.
    #[allow(clippy::too_many_arguments)]
    /// `coping` rides on the (joined) wall top at both ends; the body runs from
    /// the joined base to the joined top.
    #[allow(clippy::too_many_arguments)]
    fn wall_run(&mut self, p: &Prop, w: f32, y0: f32, h: f32, top: u8, lit: u8, dark: u8, coping: bool) {
        let hw = w * 0.5;
        let hs = p.s * 0.5;
        let [k0, k1, b0, b1, t0, t1] = p.j;
        let joined = [k0 != 0.0 || b0 != 0.0 || t0 != 0.0, k1 != 0.0 || b1 != 0.0 || t1 != 0.0];
        let (lo0, lo1) = if coping { (t0, t1) } else { (b0, b1) };
        // corners in boxy order: (-r,start) (+r,start) (+r,end) (-r,end)
        let cs = [(-hw, -hs - hw * k0, lo0, t0), (hw, -hs + hw * k0, lo0, t0), (hw, hs + hw * k1, lo1, t1), (-hw, hs - hw * k1, lo1, t1)];
        let lo: Vec<P2> = cs.iter().map(|&(rx, fz, dl, _)| self.p(rx, y0 + dl, fz)).collect();
        let hi: Vec<P2> = cs.iter().map(|&(rx, fz, _, dt)| self.p(rx, y0 + h + dt, fz)).collect();
        let mid = (hi[0].x + hi[2].x) * 0.5;
        for i in 0..4 {
            let j = (i + 1) % 4;
            // faces 0 (start) and 2 (end) are the joint faces
            if (i == 0 && joined[0]) || (i == 2 && joined[1]) {
                continue;
            }
            let col = if (hi[i].x + hi[j].x) * 0.5 > mid { lit } else { dark };
            self.quad(lo[i], lo[j], hi[j], hi[i], col);
        }
        self.quad(hi[0], hi[1], hi[2], hi[3], top);
        for i in 0..4 {
            let j = (i + 1) % 4;
            let joint_face = (i == 0 && joined[0]) || (i == 2 && joined[1]);
            if !joint_face {
                self.edge(hi[i], hi[j]);
                self.edge(lo[i], lo[j]);
            }
            // vertical edge at corner i is a seam if it sits on a joined end
            let end = if i == 0 || i == 1 { 0 } else { 1 };
            if !joined[end] {
                self.edge(lo[i], hi[i]);
            }
        }
    }
    /// Continuous strip along local forward: stations (fz, y_lo, y_hi), centred
    /// at local right offset `rx` with half-width `hw`. Outlined only on its
    /// silhouette (long edges and end caps), never between stations.
    #[allow(clippy::too_many_arguments)]
    fn ribbon(&mut self, rx: f32, hw: f32, st: &[(f32, f32, f32)], top: u8, lit: u8, dark: u8) {
        if st.len() < 2 {
            return;
        }
        let at = |c: &Self, side: f32, y: f32, fz: f32| c.p(rx + side * hw, y, fz);
        let ll: Vec<P2> = st.iter().map(|&(fz, lo, _)| at(self, -1.0, lo, fz)).collect();
        let lh: Vec<P2> = st.iter().map(|&(fz, _, hi)| at(self, -1.0, hi, fz)).collect();
        let rl: Vec<P2> = st.iter().map(|&(fz, lo, _)| at(self, 1.0, lo, fz)).collect();
        let rh: Vec<P2> = st.iter().map(|&(fz, _, hi)| at(self, 1.0, hi, fz)).collect();
        // the side further right on screen catches the light
        let right_lit = rh[st.len() / 2].x >= lh[st.len() / 2].x;
        let (lc, rc) = if right_lit { (dark, lit) } else { (lit, dark) };
        for i in 0..st.len() - 1 {
            let j = i + 1;
            self.quad(ll[i], ll[j], lh[j], lh[i], lc);
            self.quad(rl[i], rl[j], rh[j], rh[i], rc);
            self.quad(lh[i], rh[i], rh[j], lh[j], top);
        }
        let k = st.len() - 1;
        self.quad(ll[0], rl[0], rh[0], lh[0], dark);
        self.quad(ll[k], rl[k], rh[k], lh[k], dark);
        for i in 0..k {
            for e in [&ll, &lh, &rl, &rh] {
                self.edge(e[i], e[i + 1]);
            }
        }
        for i in [0, k] {
            self.edge(lh[i], rh[i]);
            self.edge(ll[i], lh[i]);
            self.edge(rl[i], rh[i]);
            self.edge(ll[i], rl[i]);
        }
    }
    fn cap(&mut self, a: P2, b: P2, r: f32, col: u8) {
        self.fb.capsule(a, b, r, col, Some(C_OUTLINE));
    }
}

fn hash(a: f32, b: f32) -> f32 {
    let s = (a * 127.1 + b * 311.7).sin() * 43758.547;
    s - s.floor()
}

/// Ramp fraction of a bridge prop: `var` carries it in 1/200 steps (the bake
/// quantises `paleHollowBridgeGeom().ramp` the same way); 0 = default 0.3.
pub fn bridge_ramp(p: &Prop) -> f32 {
    if p.var == 0 { 0.3 } else { p.var as f32 / 200.0 }
}

/// Deck height of a bridge prop at span parameter `t`, relative to its left end
/// (`p.y`): the straight lerp to the right end (`p.d`) plus `p.h` times the
/// trapezoid profile. Mirrors `paleHollowBridgeCurveY` in @bellgrave/config.
pub fn bridge_curve(p: &Prop, t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    let r = bridge_ramp(p);
    (p.d - p.y) * t + p.h.max(0.0) * (t / r).min((1.0 - t) / r).min(1.0)
}

pub fn draw(fb: &mut Framebuffer, cam: &Camera, props: &[Prop], cam_y: f32, time: f32) {
    let (w, h) = (fb.w as f32, fb.h as f32);
    for p in props {
        let base = v3(p.x, p.y - cam_y, p.z);
        let sp = cam.project(base);
        let pad = reach(p) * 40.0 + 40.0;
        let tall = match p.kind { kind::BRIDGE => 120.0 + p.s * 16.0, kind::PEAK => p.h * HEIGHT_PX + 40.0, 0..=4 => p.s * HEIGHT_PX + 20.0, _ => 120.0 };
        if sp.x < -pad || sp.x > w + pad || sp.y < -pad || sp.y - tall > h + pad {
            continue;
        }
        let f = v3(p.yaw.sin(), 0.0, p.yaw.cos());
        let r = v3(p.yaw.cos(), 0.0, -p.yaw.sin());
        let mut c = Ctx { fb, cam, base, f, r };
        draw_one(&mut c, p, time);
    }
}

fn draw_one(c: &mut Ctx, p: &Prop, time: f32) {
    let s = p.s;
    let up = |c: &Ctx, y: f32| c.p(0.0, y, 0.0);
    match p.kind {
        kind::RIVER_WALL => {
            // body sunk a little into the bank, darker coping course on top;
            // mitered into its neighbours so joints and corners meet cleanly
            c.wall_run(p, p.w, -0.2, p.h + 0.2, BANK_L, BANK, BANK_D, false);
            c.wall_run(p, p.w + 0.06, p.h, p.d, BANK, BANK_D, BANK_DD, true);
        }
        kind::BRIDGE => {
            // Ramp up from the bank, flat deck over the river, ramp down: the same
            // trapezoid as @bellgrave/config `paleHollowBridgeCurveY` (the server's
            // walk height). The ramps sit on solid abutments that meet each bank.
            let r = bridge_ramp(p);
            let curve = |t: f32| bridge_curve(p, t);
            let ts = [0.0, r, 1.0 - r, 1.0];
            let st = |lo: f32, hi: f32| -> Vec<(f32, f32, f32)> {
                ts.iter().map(|&t| (-p.s * 0.5 + p.s * t, curve(t) + lo, curve(t) + hi)).collect()
            };
            // deck top in the stone-trail colour: walkable surfaces share the trail palette,
            // so it reads apart from the (blocked) wall copings and parapets
            c.ribbon(0.0, p.w * 0.5, &st(-0.22, 0.0), TRAIL_STONE, BANK, BANK_D);
            for side in [-1.0f32, 1.0] {
                c.ribbon(side * (p.w * 0.5 - 0.12), 0.12, &st(0.0, 0.42), BANK, BANK_D, BANK_DD);
            }
            // abutments: a solid wedge under each ramp, from the bank grass up to the deck
            for (t0, t1, foot) in [(0.0f32, r, curve(0.0)), (1.0 - r, 1.0, curve(1.0))] {
                let ab: Vec<(f32, f32, f32)> =
                    [t0, t1].iter().map(|&t| (-p.s * 0.5 + p.s * t, foot - 0.3, curve(t) - 0.22)).collect();
                c.ribbon(0.0, p.w * 0.5 - 0.02, &ab, BANK, BANK_D, BANK_DD);
            }
            // pier under mid-span down to the river bed
            let mid = curve(0.5);
            c.boxy(0.0, -1.2, 0.0, p.w * 0.8, mid + 1.0, 0.7, BANK, BANK_D, BANK_DD);
        }
        kind::PINE | kind::SPRUCE | kind::CYPRESS => {
            let (d, m, l) = match p.kind {
                kind::CYPRESS => (CYP_D, CYP, PINE),
                kind::SPRUCE => (PINE_D, PINE_D, PINE),
                _ => (PINE_D, PINE, PINE_L),
            };
            let trunk_top = s * 0.3;
            let (a, b) = (up(c, 0.0), up(c, trunk_top));
            c.cap(a, b, 1.6 + s * 0.15, WOOD_D);
            let tiers = if p.kind == kind::CYPRESS { 2 } else { 3 };
            let width = if p.kind == kind::CYPRESS { 0.22 } else { 0.42 };
            for t in 0..tiers {
                let k = t as f32 / tiers as f32;
                let y0 = trunk_top * 0.6 + (s - trunk_top * 0.6) * k * 0.78;
                let y1 = y0 + (s - y0) * (if p.kind == kind::CYPRESS { 1.0 } else { 0.62 });
                let rad = s * width * (1.0 - k * 0.45);
                let apex = up(c, y1);
                let lft = c.p(-rad, y0, 0.0);
                let rgt = c.p(rad, y0, 0.0);
                let fr = c.p(0.0, y0 - rad * 0.12, rad * 0.4);
                // camera-facing silhouette with a lit right half
                let mid = P2 { x: apex.x, y: (lft.y + rgt.y) * 0.5 + 2.0, d: fr.d };
                tri(c.fb, apex, lft, mid, d);
                tri(c.fb, apex, mid, rgt, if t == tiers - 1 { l } else { m });
                c.edge(apex, lft);
                c.edge(apex, rgt);
                c.edge(lft, mid);
                c.edge(mid, rgt);
            }
        }
        kind::ASH_MED | kind::ASH_TALL => {
            let top = s * 0.62;
            c.cap(up(c, 0.0), up(c, top), 1.8 + s * 0.2, WOOD_D);
            c.cap(up(c, top * 0.7), c.p(s * 0.18, top * 0.95, 0.0), 1.2, WOOD_D);
            let blobs = [(0.0, 0.78, 0.26, ASH_D), (-0.17, 0.66, 0.2, ASH), (0.17, 0.7, 0.21, ASH), (0.06, 0.88, 0.17, ASH_L), (-0.08, 0.84, 0.15, ASH)];
            for (dx, dy, rr, col) in blobs {
                let q = c.p(dx * s, dy * s, 0.0);
                c.fb.disc(P2 { d: q.d - 0.3, ..q }, rr * s * 26.0, col, Some(C_OUTLINE));
            }
        }
        kind::LONG_GRASS | kind::TALL_PATCH | kind::TUFT | kind::REED | kind::STALK | kind::SCRUB | kind::FERN => {
            let (n, hgt, col, col2, spread) = match p.kind {
                kind::LONG_GRASS => (5, 0.32, GRASS, GRASS_L, 0.22),
                kind::TALL_PATCH => (7, 0.45, GRASS_D, GRASS, 0.3),
                kind::TUFT => (4, 0.22, GRASS_L, GRASS, 0.12),
                kind::REED => (5, 0.75, REED_C, GRASS_D, 0.18),
                kind::STALK => (4, 0.62, STALK_C, SCRUB_C, 0.16),
                kind::SCRUB => (6, 0.3, SCRUB_C, WOOD_L, 0.28),
                _ => (7, 0.3, ASH, ASH_L, 0.3),
            };
            let n = n + p.var as usize;
            for i in 0..n {
                let a = hash(p.x + i as f32, p.z) - 0.5;
                let b = hash(p.z, p.x + i as f32) - 0.5;
                let sway = (time * 1.4 + p.x * 0.3 + i as f32).sin() * 0.03 * s;
                let root = c.p(a * spread * s, 0.0, b * spread * s);
                let tip = c.p(a * spread * s * 1.8 + sway, hgt * s * (0.75 + 0.5 * hash(i as f32, p.x)), b * spread * s * 1.5);
                c.fb.line(root, tip, if i % 2 == 0 { col } else { col2 });
                if p.kind == kind::STALK {
                    c.fb.disc(tip, 1.2, STALK_C, None);
                }
            }
        }
        kind::BLOOM => {
            for i in 0..3 {
                let q = c.p((i as f32 - 1.0) * 0.12 * s, 0.12 * s + i as f32 * 0.02, 0.0);
                c.fb.line(c.p((i as f32 - 1.0) * 0.1 * s, 0.0, 0.0), q, GRASS);
                c.fb.disc(q, 1.3, BLOOM_C, None);
            }
        }
        kind::BUSH => {
            for (dx, dy, rr, col) in [(0.0, 0.25, 0.3, GRASS_D), (-0.2, 0.18, 0.22, GRASS), (0.2, 0.2, 0.22, GRASS), (0.05, 0.35, 0.18, GRASS_L)] {
                let q = c.p(dx * s, dy * s, 0.0);
                c.fb.disc(q, rr * s * 20.0, col, Some(C_OUTLINE));
            }
        }
        kind::SAPLING => {
            c.cap(up(c, 0.0), up(c, s * 0.7), 1.0, WOOD);
            let q = up(c, s * 0.75);
            c.fb.disc(q, s * 6.0, ASH, Some(C_OUTLINE));
        }
        kind::ROCK | kind::STONE | kind::PEBBLE => {
            let col = if p.var == 1 { ROCK_D } else { ROCK };
            let rr = s * 0.5;
            c.boxy(0.0, 0.0, 0.0, rr * 1.4, rr * 0.8, rr * 1.1, ROCK_L, col, ROCK_D);
        }
        kind::WALL_BLOCK => {
            let (top, lit, dark) = if p.var == 1 { (WALL_L, WALL, WALL_D) } else { (WALL, WALL_D, ROCK_D) };
            c.boxy(0.0, 0.0, 0.0, p.w, p.h * 0.9, p.d, top, lit, dark);
        }
        kind::MOSS => {
            let q = c.p(0.0, 2.0, 0.0);
            c.fb.disc(P2 { d: q.d - 1.0, ..q }, s * 14.0, MOSS_C, None);
        }
        kind::FIRE_PIT => {
            for i in 0..12 {
                let a = i as f32 / 12.0 * std::f32::consts::TAU;
                let q = c.p(a.cos() * 1.0, 0.12, a.sin() * 1.0);
                c.fb.disc(q, 3.0, if i % 2 == 0 { ROCK } else { ROCK_D }, Some(C_OUTLINE));
            }
            for (i, (lx, lz, yaw)) in [(0.55, 0.18, 0.4), (-0.48, 0.38, 1.9), (0.14, -0.55, 0.1), (-0.32, -0.32, 2.4), (0.42, -0.22, 1.2), (-0.12, 0.5, 3.0)].iter().enumerate() {
                let (dx, dz) = (f32::cos(*yaw) * 0.25, f32::sin(*yaw) * 0.25);
                let a = c.p(lx - dx, 0.1, lz - dz);
                let b = c.p(lx + dx, 0.3, lz + dz);
                c.cap(a, b, 2.0, if i % 2 == 0 { WOOD_D } else { WOOD });
            }
            let glow = c.p(0.0, 0.15, 0.0);
            c.fb.disc(P2 { d: glow.d - 0.5, ..glow }, 6.0, COAL, None);
            for i in 0..5 {
                let a = time * 2.0 + i as f32 * 1.3;
                let q = c.p(a.cos() * 0.25, 0.18, a.sin() * 0.25);
                c.fb.plot(q.x as i32, q.y as i32, q.d - 1.0, EMBER);
            }
            // flame tongues (old CampfireVolumetricFlame) + rising embers
            for i in 0..5 {
                let ph = time * 9.0 + i as f32 * 2.1;
                let (ox, oz) = ((i as f32 * 1.7).cos() * 0.22, (i as f32 * 1.7).sin() * 0.22);
                let hgt = 0.55 + 0.25 * (ph.sin() * 0.5 + 0.5) - (i % 2) as f32 * 0.15;
                let a = c.p(ox, 0.15, oz);
                let b = c.p(ox * 0.4 + (ph * 0.7).sin() * 0.06, 0.15 + hgt, oz * 0.4);
                let r = 2.6 - (i % 3) as f32 * 0.5;
                c.fb.capsule(P2 { d: a.d - 0.6, ..a }, P2 { d: b.d - 0.6, ..b }, r, COAL, None);
                let m = c.p(ox * 0.7, 0.15 + hgt * 0.45, oz * 0.7);
                c.fb.capsule(P2 { d: a.d - 0.7, ..a }, P2 { d: m.d - 0.7, ..m }, r * 0.6, EMBER, None);
            }
            for i in 0..8 {
                let life = ((time * 0.6 + hash(i as f32, 3.0)) % 1.0 + 1.0) % 1.0;
                let sx = (hash(i as f32, 7.0) - 0.5) * 0.6 + (time * 2.0 + i as f32).sin() * 0.08 * life;
                let q = c.p(sx, 0.4 + life * 2.2, (hash(i as f32, 9.0) - 0.5) * 0.6);
                if life < 0.85 {
                    c.fb.plot(q.x as i32, q.y as i32, q.d - 1.0, if life < 0.4 { EMBER } else { COAL });
                }
            }
        }
        kind::TENT => {
            let (cl, cd) = if p.var == 1 { (BEIGE, BEIGE_D) } else { (OLIVE, OLIVE_D) };
            let (hw, hl, rh) = (1.25, 1.5, 1.7);
            let r0 = c.p(0.0, rh, -hl);
            let r1 = c.p(0.0, rh, hl);
            let l0 = c.p(-hw, 0.0, -hl);
            let l1 = c.p(-hw, 0.0, hl);
            let g0 = c.p(hw, 0.0, -hl);
            let g1 = c.p(hw, 0.0, hl);
            c.quad(l0, l1, r1, r0, cd);
            c.quad(g0, g1, r1, r0, cl);
            tri(c.fb, l0, g0, r0, cd);
            tri(c.fb, l1, g1, r1, OLIVE_D);
            // open flap: dark doorway on the front gable
            let door = c.p(0.0, 0.0, hl + 0.01);
            let dt = c.p(0.0, rh * 0.75, hl + 0.01);
            let dl = c.p(-0.45, 0.0, hl + 0.01);
            let dr = c.p(0.45, 0.0, hl + 0.01);
            tri(c.fb, dl, dr, dt, C_OUTLINE);
            let _ = door;
            for (a, b) in [(l0, r0), (r0, g0), (l1, r1), (r1, g1), (r0, r1)] {
                c.edge(a, b);
            }
            c.cap(c.p(0.0, 0.0, hl + 0.05), c.p(0.0, rh + 0.25, hl + 0.05), 1.0, WOOD_D);
        }
        kind::BEDROLL => {
            let col = if p.var == 1 { BEIGE_D } else { OLIVE_D };
            c.boxy(0.0, 0.0, 0.0, 0.6, 0.12, 1.6, col, col, WOOD_D);
            c.boxy(0.0, 0.12, 0.65, 0.5, 0.1, 0.25, BEIGE, BEIGE, BEIGE_D);
        }
        kind::CRATE => {
            c.boxy(0.0, 0.0, 0.0, p.w, p.h, p.d, WOOD_L, WOOD, WOOD_D);
            let a = c.p(-p.w * 0.5, p.h * 0.5, p.d * 0.51);
            let b = c.p(p.w * 0.5, p.h * 0.5, p.d * 0.51);
            c.fb.line(a, b, IRON_C);
        }
        kind::CHEST => {
            c.boxy(0.0, 0.0, 0.0, 0.95, 0.5, 0.6, WOOD_L, WOOD, WOOD_D);
            c.boxy(0.0, 0.5, 0.0, 0.95, 0.18, 0.6, WOOD_L, WOOD_L, WOOD);
            let lock = c.p(0.0, 0.45, 0.31);
            c.fb.disc(P2 { d: lock.d - 0.2, ..lock }, 1.6, C_GOLD, None);
            for sx in [-0.3f32, 0.3] {
                c.fb.line(c.p(sx, 0.0, 0.31), c.p(sx, 0.68, 0.31), IRON_C);
            }
        }
        kind::LEAN_TO => {
            for (x, zz, hh) in [(-1.1, -0.7, 1.9), (1.1, -0.7, 1.9), (-1.1, 0.8, 1.1), (1.1, 0.8, 1.1)] {
                c.cap(c.p(x, 0.0, zz), c.p(x, hh, zz), 1.3, WOOD_D);
            }
            let (a, b, cc, d) = (c.p(-1.25, 2.0, -0.85), c.p(1.25, 2.0, -0.85), c.p(1.25, 1.15, 0.95), c.p(-1.25, 1.15, 0.95));
            c.quad(a, b, cc, d, OLIVE);
            for (x, y) in [(a, b), (b, cc), (cc, d), (d, a)] {
                c.edge(x, y);
            }
            c.boxy(0.0, 0.0, -0.3, 1.4, 0.75, 0.55, WOOD_L, WOOD, WOOD_D);
            let anvil = c.p(0.6, 0.85, -0.3);
            c.fb.disc(anvil, 2.5, IRON_C, Some(C_OUTLINE));
        }
        kind::TRAINER => {
            c.boxy(0.0, 0.34, 0.0, 1.15, 0.08, 0.48, WOOD_L, WOOD, WOOD_D);
            for (x, zz) in [(-0.45, -0.15), (0.45, -0.15), (-0.45, 0.15), (0.45, 0.15)] {
                c.cap(c.p(x, 0.0, zz), c.p(x, 0.34, zz), 1.0, WOOD_D);
            }
            // books / scroll
            c.boxy(-0.25, 0.42, 0.0, 0.3, 0.08, 0.22, ACCENT_BOOK, C_ACCENT, WOOD_D);
            let orb = c.p(0.3, 0.55, 0.0);
            c.fb.disc(P2 { d: orb.d - 0.2, ..orb }, 2.2, C_DASH, Some(C_OUTLINE));
        }
        kind::STALL => {
            c.boxy(0.0, 0.0, 0.0, 1.8, 0.8, 0.7, WOOD_L, WOOD, WOOD_D);
            for (x, zz) in [(-0.9, -0.35), (0.9, -0.35), (-0.9, 0.35), (0.9, 0.35)] {
                c.cap(c.p(x, 0.8, zz), c.p(x, 1.9, zz), 1.0, WOOD_D);
            }
            let (a, b, cc, d) = (c.p(-1.05, 2.05, -0.45), c.p(1.05, 2.05, -0.45), c.p(1.05, 1.8, 0.6), c.p(-1.05, 1.8, 0.6));
            c.quad(a, b, cc, d, BEIGE);
            for (x, y) in [(a, b), (b, cc), (cc, d), (d, a)] {
                c.edge(x, y);
            }
            for (i, col) in [C_ACCENT, FX_HP, C_GOLD].iter().enumerate() {
                let q = c.p(-0.5 + i as f32 * 0.5, 0.9, 0.1);
                c.fb.disc(P2 { d: q.d - 0.2, ..q }, 2.2, *col, Some(C_OUTLINE));
            }
        }
        kind::WEAPON_RACK => {
            c.cap(c.p(-0.5, 0.0, 0.0), c.p(-0.5, 1.2, 0.0), 1.2, WOOD_D);
            c.cap(c.p(0.5, 0.0, 0.0), c.p(0.5, 1.2, 0.0), 1.2, WOOD_D);
            c.cap(c.p(-0.6, 1.15, 0.0), c.p(0.6, 1.15, 0.0), 1.0, WOOD);
            for i in 0..3 {
                let x = -0.3 + i as f32 * 0.3;
                c.fb.capsule(c.p(x, 0.3, 0.06), c.p(x, 1.25, 0.06), 0.8, C_STEEL, Some(C_OUTLINE));
                c.fb.capsule(c.p(x - 0.08, 0.9, 0.06), c.p(x + 0.08, 0.9, 0.06), 0.7, C_GOLD, None);
            }
        }
        kind::FIREWOOD => {
            for i in 0..4 {
                let y = 0.12 + i as f32 * 0.1;
                let a = i as f32 * 0.7;
                let (dx, dz) = (a.cos() * 0.35, a.sin() * 0.35);
                c.cap(c.p(-dx, y, -dz + i as f32 * 0.08), c.p(dx, y, dz + i as f32 * 0.08), 1.8, if i % 2 == 0 { WOOD } else { WOOD_D });
            }
        }
        kind::BARREL => {
            c.boxy(0.0, 0.0, 0.0, 0.55, 0.72, 0.55, WOOD_L, WOOD, WOOD_D);
            for y in [0.15f32, 0.55] {
                c.fb.line(c.p(-0.28, y, 0.28), c.p(0.28, y, 0.28), IRON_C);
            }
        }
        kind::BANNER => {
            c.cap(up(c, 0.0), up(c, 2.2), 1.2, WOOD_D);
            let sway = (time * 1.8).sin() * 0.06;
            let (a, b, cc, d) = (c.p(0.05, 2.0, 0.0), c.p(0.75 + sway, 1.95, 0.0), c.p(0.7 + sway * 1.5, 1.1, 0.0), c.p(0.05, 1.15, 0.0));
            c.quad(a, b, cc, d, C_ACCENT);
            for (x, y) in [(a, b), (b, cc), (cc, d)] {
                c.edge(x, y);
            }
            let top = up(c, 2.25);
            c.fb.disc(top, 1.8, C_GOLD, Some(C_OUTLINE));
        }
        kind::PEAK => {
            let sc = p.s;
            let apex = up(c, 7.2 * sc * 0.75);
            let rad = 5.2 * sc;
            let l = c.p(-rad, 0.0, 0.0);
            let rr = c.p(rad, 0.0, 0.0);
            let fr = c.p(0.0, 0.0, rad);
            tri(c.fb, apex, l, fr, ROCK_D);
            tri(c.fb, apex, fr, rr, ROCK);
            let snow_y = 7.2 * sc * 0.75 * 0.78;
            let sl = c.p(-rad * 0.22, snow_y, 0.0);
            let sr = c.p(rad * 0.22, snow_y, 0.0);
            let sf = c.p(0.0, snow_y, rad * 0.22);
            tri(c.fb, P2 { d: apex.d - 0.5, ..apex }, P2 { d: sl.d - 0.5, ..sl }, P2 { d: sf.d - 0.5, ..sf }, ROCK_L);
            tri(c.fb, P2 { d: apex.d - 0.5, ..apex }, P2 { d: sf.d - 0.5, ..sf }, P2 { d: sr.d - 0.5, ..sr }, C_BODY);
            for (a, b) in [(apex, l), (apex, rr), (apex, fr)] {
                c.edge(a, b);
            }
            // side peak
            let side = c.p(2.4 * sc, 4.2 * sc * 0.7, 1.6 * sc);
            let sl2 = c.p(2.4 * sc - 2.8 * sc, 0.0, 1.6 * sc);
            let sr2 = c.p(2.4 * sc + 2.8 * sc, 0.0, 1.6 * sc);
            let sf2 = c.p(2.4 * sc, 0.0, 1.6 * sc + 2.8 * sc);
            tri(c.fb, side, sl2, sf2, ROCK);
            tri(c.fb, side, sf2, sr2, ROCK_L);
            c.edge(side, sl2);
            c.edge(side, sr2);
        }
        _ => {}
    }
}

const ACCENT_BOOK: u8 = C_ACCENT;

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(kind: u8, x: f32, z: f32) -> Vec<u8> {
        let mut v = vec![kind, 0];
        for f in [x, z, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0] {
            v.extend_from_slice(&f.to_le_bytes());
        }
        v
    }

    #[test]
    fn parse_roundtrip_and_rejects_bad_magic() {
        let mut b = b"BAP1".to_vec();
        b.extend_from_slice(&2u32.to_le_bytes());
        b.extend(rec(kind::TENT, 1.0, 2.0));
        b.extend(rec(kind::PINE, -3.0, 4.0));
        let p = parse(&b).unwrap();
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].kind, kind::TENT);
        assert_eq!(p[1].x, -3.0);
        assert!(parse(b"NOPE\0\0\0\0").is_err());
        assert!(parse(&b[..b.len() - 1]).is_err());
    }
}
