// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Content-aware per-pixel water. `WaterField` is baked once from the zone
//! (shore distance + flow). Each water-cell pixel is shaded at its world (x, z).

use stick_engine::camera::P2;
use stick_engine::raster::Framebuffer;

use crate::palette::WATER;
use crate::zone::{Zone, F_BRIDGE, F_WATER};

#[derive(Clone, Copy)]
pub struct Params {
    pub speed: f32,
    pub stretch: f32,
    pub warp: f32,
    pub scale: f32,
    pub foam: f32,
    pub glint: f32,
    pub contrast: f32,
    pub veins: f32,
    pub shore: f32,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Mode {
    Still,
    Stream,
    Rush,
    Buffet,
}

impl Mode {
    pub fn params(self) -> Params {
        match self {
            Mode::Still => Params {
                speed: 1.2, stretch: 1.0, warp: 0.3, scale: 2.6, foam: 0.0, glint: 0.08, contrast: 0.28, veins: 0.0, shore: 0.25,
            },
            Mode::Stream => Params {
                speed: 4.0, stretch: 6.2, warp: 0.18, scale: 2.6, foam: 0.05, glint: 0.12, contrast: 0.55, veins: 0.40, shore: 0.55,
            },
            Mode::Rush => Params {
                speed: 12.0, stretch: 7.0, warp: 0.28, scale: 2.3, foam: 0.22, glint: 0.22, contrast: 1.10, veins: 0.55, shore: 0.85,
            },
            Mode::Buffet => Params {
                speed: 6.0, stretch: 2.2, warp: 1.1, scale: 1.9, foam: 0.32, glint: 0.22, contrast: 1.05, veins: 0.45, shore: 0.85,
            },
        }
    }

    pub fn params_iso(self) -> Params {
        self.params()
    }
}

pub fn mode_from_grade(drop: f32, pour: bool, incoming: bool) -> Mode {
    if pour || incoming {
        Mode::Buffet
    } else if drop >= 0.015 {
        Mode::Rush
    } else if drop >= 0.002 {
        Mode::Stream
    } else {
        Mode::Still
    }
}

pub fn mode_from_flow(fl: f32, fall: bool) -> Mode {
    if fall {
        Mode::Buffet
    } else if fl >= 0.85 {
        Mode::Rush
    } else if fl >= 0.28 {
        Mode::Stream
    } else {
        Mode::Still
    }
}

#[inline]
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
#[inline]
fn smooth(t: f32) -> f32 {
    t * t * (3.0 - 2.0 * t)
}
#[inline]
fn sstep(a: f32, b: f32, x: f32) -> f32 {
    smooth(((x - a) / (b - a)).clamp(0.0, 1.0))
}
#[inline]
fn hash(mut x: u32, y: u32, seed: u32) -> f32 {
    x = x.wrapping_mul(0x27d4eb2d) ^ y.wrapping_mul(0x165667b1) ^ seed.wrapping_mul(0x9e3779b9);
    x ^= x >> 15;
    x = x.wrapping_mul(0x85ebca6b);
    x ^= x >> 13;
    x = x.wrapping_mul(0xc2b2ae35);
    x ^= x >> 16;
    (x & 0xffffff) as f32 / 0xffffff as f32
}
#[inline]
fn vnoise(x: f32, y: f32, seed: u32) -> f32 {
    let (xi, yi) = (x.floor(), y.floor());
    let (fx, fy) = (smooth(x - xi), smooth(y - yi));
    let (xi, yi) = (xi as i32 as u32, yi as i32 as u32);
    let a = hash(xi, yi, seed);
    let b = hash(xi.wrapping_add(1), yi, seed);
    let c = hash(xi, yi.wrapping_add(1), seed);
    let d = hash(xi.wrapping_add(1), yi.wrapping_add(1), seed);
    lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}
/// Two-octave fbm. Same lattice as the old oct-3 call's first two octaves;
/// the dropped 0.125 band is below the 4-color Bayer ramp at iso.
#[inline]
fn fbm2(x: f32, y: f32, seed: u32) -> f32 {
    let a = vnoise(x, y, seed);
    let b = vnoise(x * 2.03 + 17.1, y * 2.03 + 3.7, seed.wrapping_add(131));
    a * 0.5 + b * 0.25
}

const DIRS: [(i32, i32); 8] = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)];
const LIGHT: [f32; 2] = [-0.7, -0.7];
const LIGHT_X: f32 = -0.70710677;
const LIGHT_Z: f32 = -0.70710677;
const FALL_DROP: f32 = 1.5; // min surface drop (m) to count as a fall
const FALL_REACH: i32 = 6; // max non-water cells between upper and lower water

/// Something in the water: a wading unit, a splash.
#[derive(Clone, Copy)]
pub struct Ripple {
    pub x: f32,
    pub z: f32,
    pub vx: f32,
    pub vz: f32,
    pub radius: f32,
}

/// `base` is 0..6 on the water ramp; `hi` (0 = none) is a hard highlight (6/7/8).
#[derive(Clone, Copy)]
pub struct Shade {
    pub base: f32,
    pub hi: u8,
}

const BAYER4: [[f32; 4]; 4] = [
    [0.0, 8.0, 2.0, 10.0],
    [12.0, 4.0, 14.0, 6.0],
    [3.0, 11.0, 1.0, 9.0],
    [15.0, 7.0, 13.0, 5.0],
];

pub fn quantize(s: Shade, px: i32, py: i32, strength: f32) -> usize {
    if s.hi > 0 {
        return s.hi as usize;
    }
    let b = BAYER4[(py & 3) as usize][(px & 3) as usize] / 16.0 - 0.5;
    (s.base + b * strength).floor().clamp(0.0, 5.0) as usize
}

fn to_ramp(idx: usize) -> u8 {
    WATER
        + match idx {
            0 | 1 => 0,
            2 | 3 => 1,
            4 | 5 => 2,
            _ => 3,
        }
}

pub struct FieldCfg {
    pub x0: f32,
    pub z0: f32,
    pub w: usize,
    pub h: usize,
    pub res: f32,
}

pub struct WaterField {
    cfg: FieldCfg,
    ground: Vec<f32>,
    sdist: Vec<f32>,
    flow: Vec<[f32; 2]>,
    pub falls: Vec<FallSpan>,
    /// Union bounding box of every fall face (x0, z0, x1, z1), so the
    /// per-land-cell fall test rejects almost every cell in one compare.
    fall_box: [f32; 4],
}

fn falls_box(falls: &[FallSpan]) -> [f32; 4] {
    let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
    for f in falls {
        let r = f.lip_w.max(f.pool_w) + 1.0;
        for p in [f.lip, f.pool] {
            b[0] = b[0].min(p[0] - r);
            b[1] = b[1].min(p[1] - r);
            b[2] = b[2].max(p[0] + r);
            b[3] = b[3].max(p[1] + r);
        }
    }
    b
}

#[derive(Clone, Copy)]
pub struct FallSpan {
    pub lip: [f32; 3],
    pub lip_w: f32,
    pub pool: [f32; 3],
    pub pool_w: f32,
}

#[derive(Clone, Default)]
pub struct WaterLayout {
    pub segs: Vec<[f32; 6]>,
    pub falls: Vec<FallSpan>,
}

impl WaterLayout {
    pub fn parse(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < 8 || &bytes[0..4] != b"WFL1" {
            return Err("not WFL1".into());
        }
        let nseg = u16::from_le_bytes([bytes[4], bytes[5]]) as usize;
        let nfall = u16::from_le_bytes([bytes[6], bytes[7]]) as usize;
        let need = 8 + nseg * 24 + nfall * 32;
        if bytes.len() < need {
            return Err("WFL1 truncated".into());
        }
        let f32s = |o: usize| {
            f32::from_le_bytes([bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]])
        };
        let mut o = 8;
        let mut segs = Vec::with_capacity(nseg);
        for _ in 0..nseg {
            segs.push([f32s(o), f32s(o + 4), f32s(o + 8), f32s(o + 12), f32s(o + 16), f32s(o + 20)]);
            o += 24;
        }
        let mut falls = Vec::with_capacity(nfall);
        for _ in 0..nfall {
            falls.push(FallSpan {
                lip: [f32s(o), f32s(o + 4), f32s(o + 8)],
                lip_w: f32s(o + 12),
                pool: [f32s(o + 16), f32s(o + 20), f32s(o + 24)],
                pool_w: f32s(o + 28),
            });
            o += 32;
        }
        Ok(WaterLayout { segs, falls })
    }

    pub fn offset(&mut self, ox: f32, oz: f32) {
        for s in &mut self.segs {
            s[0] += ox;
            s[1] += oz;
            s[3] += ox;
            s[4] += oz;
        }
        for f in &mut self.falls {
            f.lip[0] += ox;
            f.lip[1] += oz;
            f.pool[0] += ox;
            f.pool[1] += oz;
        }
    }
}

#[derive(Clone, Copy)]
pub struct Sample {
    pub ground: f32,
    pub sdist: f32,
    pub flow: [f32; 2],
}

fn chamfer(src: &[bool], w: usize, h: usize) -> Vec<f32> {
    let mut d: Vec<f32> = src.iter().map(|&s| if s { 0.0 } else { 1e4 }).collect();
    let at = |d: &Vec<f32>, x: i32, y: i32| {
        if x < 0 || y < 0 || x >= w as i32 || y >= h as i32 {
            1e4
        } else {
            d[y as usize * w + x as usize]
        }
    };
    for y in 0..h as i32 {
        for x in 0..w as i32 {
            let m = d[y as usize * w + x as usize]
                .min(at(&d, x - 1, y) + 1.0)
                .min(at(&d, x, y - 1) + 1.0)
                .min(at(&d, x - 1, y - 1) + 1.414)
                .min(at(&d, x + 1, y - 1) + 1.414);
            d[y as usize * w + x as usize] = m;
        }
    }
    for y in (0..h as i32).rev() {
        for x in (0..w as i32).rev() {
            let m = d[y as usize * w + x as usize]
                .min(at(&d, x + 1, y) + 1.0)
                .min(at(&d, x, y + 1) + 1.0)
                .min(at(&d, x + 1, y + 1) + 1.414)
                .min(at(&d, x - 1, y + 1) + 1.414);
            d[y as usize * w + x as usize] = m;
        }
    }
    d
}

fn blur(v: &mut [f32], w: usize, h: usize) {
    let src = v.to_vec();
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            let mut n = 0.0;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let (xx, yy) = (x as i32 + dx, y as i32 + dy);
                    if xx >= 0 && yy >= 0 && xx < w as i32 && yy < h as i32 {
                        s += src[yy as usize * w + xx as usize];
                        n += 1.0;
                    }
                }
            }
            v[y * w + x] = s / n;
        }
    }
}

/// 3×3 blur that only writes water cells so land stays 0 and is not treated as current.
fn blur_water(v: &mut [f32], water: &[bool], w: usize, h: usize) {
    let src = v.to_vec();
    for y in 0..h {
        for x in 0..w {
            let k = y * w + x;
            if !water[k] {
                continue;
            }
            let mut s = 0.0;
            let mut n = 0.0;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let (xx, yy) = (x as i32 + dx, y as i32 + dy);
                    if xx >= 0 && yy >= 0 && xx < w as i32 && yy < h as i32 {
                        s += src[yy as usize * w + xx as usize];
                        n += 1.0;
                    }
                }
            }
            v[k] = s / n;
        }
    }
}

/// Upper water → first water cell found along a cardinal direction that is
/// lower by FALL_DROP, across a gap no higher than the upper surface (a cliff
/// face, not a ridge). Adjacent edge cells merge into one span.
fn detect_falls(zone: &Zone, water: &[bool]) -> Vec<FallSpan> {
    let (w, h) = (zone.w as i32, zone.h as i32);
    let cell = zone.cell.max(0.01);
    const CARD: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    // (dir, line, steps, run, i, j, h_up, h_low)
    let mut hits: Vec<(usize, i32, i32, i32, i32, i32, f32, f32)> = Vec::new();
    for j in 0..h {
        for i in 0..w {
            let k = (j * w + i) as usize;
            if !water[k] {
                continue;
            }
            let hu = zone.height[k];
            for (d, (di, dj)) in CARD.iter().enumerate() {
                let mut gap_max = f32::MIN;
                for s in 1..=FALL_REACH {
                    let (ni, nj) = (i + di * s, j + dj * s);
                    if ni < 0 || nj < 0 || ni >= w || nj >= h {
                        break;
                    }
                    let nk = (nj * w + ni) as usize;
                    if !water[nk] {
                        gap_max = gap_max.max(zone.height[nk]);
                        continue;
                    }
                    let hl = zone.height[nk];
                    if hu - hl >= FALL_DROP && gap_max <= hu + 0.3 {
                        let (line, run) = if *di != 0 { (i, j) } else { (j, i) };
                        hits.push((d, line, s, run, i, j, hu, hl));
                    }
                    break;
                }
            }
        }
    }
    hits.sort_by_key(|h| (h.0, h.1, h.2, h.3));
    let mut out = Vec::new();
    let mut n = 0;
    while n < hits.len() {
        let first = hits[n];
        let mut last = first;
        let (mut hu, mut hl, mut cnt) = (first.6, first.7, 1.0f32);
        let mut m = n + 1;
        while m < hits.len() {
            let c = hits[m];
            if c.0 == first.0 && c.1 == first.1 && c.2 == first.2 && c.3 == last.3 + 1 {
                hu += c.6;
                hl += c.7;
                cnt += 1.0;
                last = c;
                m += 1;
            } else {
                break;
            }
        }
        let (di, dj) = CARD[first.0];
        let s = first.2;
        let ci = (first.4 + last.4) as f32 * 0.5;
        let cj = (first.5 + last.5) as f32 * 0.5;
        let lx = zone.min_x + (ci + 0.5) * cell;
        let lz = zone.min_z + (cj + 0.5) * cell;
        let half = cnt * cell * 0.5;
        out.push(FallSpan {
            lip: [lx, lz, hu / cnt],
            lip_w: half,
            pool: [lx + (di * s) as f32 * cell, lz + (dj * s) as f32 * cell, hl / cnt],
            pool_w: half,
        });
        n = m;
    }
    out
}

/// Current from water connectivity, not from the bed.
///
/// Every water cell gets its geodesic distance (through water cells only, 8-way,
/// bed height ignored so falls just connect) to the nearest outlet: the
/// downstream ends of the authored river spines. The current runs down that
/// distance field, is relaxed over water neighbours so adjacent cells agree
/// through bends and junctions, and its strength follows mass conservation:
/// speed ~ 1 / channel width, so narrows run fast and lakes barely drift from
/// inlet to outlet. Water with no outlet stays still.
fn connected_flow(
    zone: &Zone,
    layout: Option<&WaterLayout>,
    water: &[bool],
    sd: &[f32],
    w: usize,
    h: usize,
    res: f32,
) -> Vec<[f32; 2]> {
    use std::cmp::Reverse;
    use std::collections::BinaryHeap;
    let mut flow = vec![[0.0f32; 2]; w * h];
    let cell = 1.0 / res;
    // Label connected water bodies (8-way, bed height ignored).
    let mut comp = vec![u32::MAX; w * h];
    let mut ncomp = 0u32;
    for k0 in 0..w * h {
        if !water[k0] || comp[k0] != u32::MAX {
            continue;
        }
        let mut stack = vec![k0];
        comp[k0] = ncomp;
        while let Some(k) = stack.pop() {
            let (i, j) = ((k % w) as i32, (k / w) as i32);
            for (di, dj) in DIRS {
                let (ni, nj) = (i + di, j + dj);
                if ni < 0 || nj < 0 || ni >= w as i32 || nj >= h as i32 {
                    continue;
                }
                let nk = nj as usize * w + ni as usize;
                if water[nk] && comp[nk] == u32::MAX {
                    comp[nk] = ncomp;
                    stack.push(nk);
                }
            }
        }
        ncomp += 1;
    }
    // Outlet per body: the lowest spine end that no segment continues from
    // (a tributary ending in a river is a junction, not an outlet).
    let mut outlet: Vec<Option<(f32, f32, f32)>> = vec![None; ncomp as usize];
    if let Some(lay) = layout {
        for s in &lay.segs {
            let (ex, ez, ey) = (s[3], s[4], s[5]);
            if lay.segs.iter().any(|t| (t[0] - ex).abs() < 0.05 && (t[1] - ez).abs() < 0.05) {
                continue;
            }
            let (ci, cj) = (((ex - zone.min_x) * res) as i32, ((ez - zone.min_z) * res) as i32);
            let r = (4.0 * res) as i32;
            let mut c = None;
            'find: for rr in 0..=r {
                for dj in -rr..=rr {
                    for di in -rr..=rr {
                        let (i, j) = (ci + di, cj + dj);
                        if i >= 0 && j >= 0 && (i as usize) < w && (j as usize) < h && water[j as usize * w + i as usize] {
                            c = Some(comp[j as usize * w + i as usize]);
                            break 'find;
                        }
                    }
                }
            }
            if let Some(c) = c {
                let o = &mut outlet[c as usize];
                if o.map_or(true, |o| ey < o.2) {
                    *o = Some((ex, ez, ey));
                }
            }
        }
    }
    let mut seeds: Vec<usize> = Vec::new();
    for (c, o) in outlet.iter().enumerate() {
        let Some((ex, ez, _)) = *o else { continue };
        let (ci, cj) = (((ex - zone.min_x) * res) as i32, ((ez - zone.min_z) * res) as i32);
        let r = (4.0 * res) as i32;
        for dj in -r..=r {
            for di in -r..=r {
                let (i, j) = (ci + di, cj + dj);
                if i >= 0 && j >= 0 && (i as usize) < w && (j as usize) < h {
                    let k = j as usize * w + i as usize;
                    if water[k] && comp[k] == c as u32 {
                        seeds.push(k);
                    }
                }
            }
        }
    }
    if seeds.is_empty() {
        return flow;
    }
    // Geodesic distance to outlet over water only (Dijkstra, 8-neighbour).
    let mut dist = vec![f32::INFINITY; w * h];
    let mut heap = BinaryHeap::new();
    for &k in &seeds {
        dist[k] = 0.0;
        heap.push(Reverse((0u32, k)));
    }
    while let Some(Reverse((dq, k))) = heap.pop() {
        let d = dq as f32 / 1000.0;
        if d > dist[k] + 1e-4 {
            continue;
        }
        let (i, j) = ((k % w) as i32, (k / w) as i32);
        for (di, dj) in DIRS {
            let (ni, nj) = (i + di, j + dj);
            if ni < 0 || nj < 0 || ni >= w as i32 || nj >= h as i32 {
                continue;
            }
            let nk = nj as usize * w + ni as usize;
            if !water[nk] {
                continue;
            }
            let nd = d + if di != 0 && dj != 0 { 1.4142 } else { 1.0 } * cell;
            if nd < dist[nk] {
                dist[nk] = nd;
                heap.push(Reverse(((nd * 1000.0) as u32, nk)));
            }
        }
    }
    // Downhill direction of the distance field (central differences where the
    // neighbour is reachable water, one-sided otherwise).
    let mut fx = vec![0.0f32; w * h];
    let mut fz = vec![0.0f32; w * h];
    for j in 1..h - 1 {
        for i in 1..w - 1 {
            let k = j * w + i;
            if !dist[k].is_finite() {
                continue;
            }
            let d = |kk: usize| if dist[kk].is_finite() { dist[kk] } else { dist[k] };
            let gx = d(k + 1) - d(k - 1);
            let gz = d(k + w) - d(k - w);
            let m = gx.hypot(gz);
            if m > 1e-5 {
                fx[k] = -gx / m;
                fz[k] = -gz / m;
            }
        }
    }
    // Relax the unit directions over water neighbours so the current is one
    // continuous sheet (no per-cell 45-degree jitter, smooth round bends).
    let reach: Vec<bool> = dist.iter().map(|d| d.is_finite()).collect();
    for _ in 0..20 {
        blur_water(&mut fx, &reach, w, h);
        blur_water(&mut fz, &reach, w, h);
        for k in 0..w * h {
            let m = fx[k].hypot(fz[k]);
            if m > 1e-5 {
                fx[k] /= m;
                fz[k] /= m;
            }
        }
    }
    // Channel width: twice the deepest bank distance nearby (a few max passes
    // spread the centre-line value out to the banks).
    let mut half: Vec<f32> = (0..w * h).map(|k| if water[k] { sd[k].max(0.25) } else { 0.0 }).collect();
    let pass = (14.0 * res).max(1.0) as usize;
    for _ in 0..pass {
        let src = half.clone();
        for j in 1..h - 1 {
            for i in 1..w - 1 {
                let k = j * w + i;
                if !water[k] {
                    continue;
                }
                let mut m = src[k];
                for kk in [k - 1, k + 1, k - w, k + w] {
                    if water[kk] {
                        m = m.max(src[kk]);
                    }
                }
                half[k] = m;
            }
        }
    }
    const REF_WIDTH: f32 = 8.0; // m; a channel this wide runs at strength 1
    for k in 0..w * h {
        if !reach[k] {
            continue;
        }
        let width = 2.0 * half[k];
        let mut s = (REF_WIDTH / width.max(0.5)).clamp(0.0, 1.6);
        // Aspect: long geodesic to outlet = river, even when the sheet is wide.
        // Closed meres have no outlet (`reach` false) and stay still above.
        let aspect = dist[k] / width.max(1.0);
        let river = sstep(2.0, 5.5, aspect);
        let lake_damp = 0.88 * sstep(14.0, 28.0, width);
        let river_damp = 0.28 * sstep(28.0, 48.0, width);
        s *= 1.0 - lerp(lake_damp, river_damp, river);
        s *= 0.6 + 0.4 * sstep(0.0, 1.5, sd[k]);
        flow[k] = [fx[k] * s, fz[k] * s];
    }
    flow
}

fn wet_cell(zone: &Zone, i: i32, j: i32) -> bool {
    if i < 0 || j < 0 || i >= zone.w as i32 || j >= zone.h as i32 {
        return false;
    }
    zone.flags[zone.idx(i, j)] & (F_WATER | F_BRIDGE) == F_WATER
}

impl WaterField {
    pub fn from_zone(zone: &Zone, layout: Option<&WaterLayout>) -> Self {
        let (w, h) = (zone.w, zone.h);
        let res = 1.0 / zone.cell.max(0.01);
        let mut g = vec![0.0f32; w * h];
        let mut water = vec![false; w * h];
        for j in 0..h {
            for i in 0..w {
                let k = j * w + i;
                g[k] = zone.height[k];
                water[k] = wet_cell(zone, i as i32, j as i32);
            }
        }
        // Signed bank distance (m): positive in water. Used for the shore
        // shading and to read channel width, never for current direction.
        let land: Vec<bool> = water.iter().map(|&b| !b).collect();
        let d_land = chamfer(&land, w, h);
        let d_water = chamfer(&water, w, h);
        let mut sd: Vec<f32> = (0..w * h)
            .map(|i| if water[i] { d_land[i] - 0.5 } else { -(d_water[i] - 0.5) })
            .collect();
        blur(&mut sd, w, h);
        for v in sd.iter_mut() {
            *v /= res;
        }
        let flow_out = connected_flow(zone, layout, &water, &sd, w, h, res);
        let (zx1, zz1) = (zone.min_x + w as f32 * zone.cell, zone.min_z + h as f32 * zone.cell);
        let mut falls: Vec<FallSpan> = layout
            .map(|l| {
                l.falls
                    .iter()
                    .copied()
                    .filter(|f| f.lip[0] >= zone.min_x && f.lip[0] < zx1 && f.lip[1] >= zone.min_z && f.lip[1] < zz1)
                    .collect()
            })
            .unwrap_or_default();
        if falls.is_empty() {
            falls.extend(detect_falls(zone, &water));
        }
        WaterField {
            cfg: FieldCfg { x0: zone.min_x, z0: zone.min_z, w, h, res },
            ground: g,
            sdist: sd,
            flow: flow_out,
            fall_box: falls_box(&falls),
            falls,
        }
    }

    /// Downhill unit flow if (x, z) is on a punched fall face (not the lip/pool).
    pub fn fall_flow_at(&self, x: f32, z: f32) -> Option<[f32; 2]> {
        let b = &self.fall_box;
        if x < b[0] || z < b[1] || x > b[2] || z > b[3] {
            return None;
        }
        for f in &self.falls {
            let (dx, dz) = (f.pool[0] - f.lip[0], f.pool[1] - f.lip[1]);
            let len2 = dx * dx + dz * dz;
            if len2 < 0.01 {
                continue;
            }
            let t = ((x - f.lip[0]) * dx + (z - f.lip[1]) * dz) / len2;
            if t <= 0.02 || t >= 0.98 {
                continue;
            }
            let px = f.lip[0] + dx * t;
            let pz = f.lip[1] + dz * t;
            let d = ((x - px) * (x - px) + (z - pz) * (z - pz)).sqrt();
            let w = f.lip_w + (f.pool_w - f.lip_w) * t + 1.0;
            if d <= w {
                let inv = 1.0 / len2.sqrt();
                return Some([dx * inv, dz * inv]);
            }
        }
        None
    }

    pub fn contains(&self, x: f32, z: f32) -> bool {
        let (fx, fz) = ((x - self.cfg.x0) * self.cfg.res, (z - self.cfg.z0) * self.cfg.res);
        fx >= 0.0 && fz >= 0.0 && fx < self.cfg.w as f32 && fz < self.cfg.h as f32
    }

    pub fn sample(&self, x: f32, z: f32) -> Sample {
        let fx = ((x - self.cfg.x0) * self.cfg.res - 0.5).clamp(0.0, self.cfg.w as f32 - 1.001);
        let fz = ((z - self.cfg.z0) * self.cfg.res - 0.5).clamp(0.0, self.cfg.h as f32 - 1.001);
        let i = fx as usize;
        let j = fz as usize;
        let a = fx - i as f32;
        let b = fz - j as f32;
        let w = self.cfg.w;
        let k00 = j * w + i;
        let k10 = k00 + 1;
        let k01 = k00 + w;
        let k11 = k01 + 1;
        let ia = 1.0 - a;
        let ib = 1.0 - b;
        let w00 = ia * ib;
        let w10 = a * ib;
        let w01 = ia * b;
        let w11 = a * b;
        Sample {
            ground: self.ground[k00] * w00 + self.ground[k10] * w10 + self.ground[k01] * w01 + self.ground[k11] * w11,
            sdist: self.sdist[k00] * w00 + self.sdist[k10] * w10 + self.sdist[k01] * w01 + self.sdist[k11] * w11,
            flow: [
                self.flow[k00][0] * w00 + self.flow[k10][0] * w10 + self.flow[k01][0] * w01 + self.flow[k11][0] * w11,
                self.flow[k00][1] * w00 + self.flow[k10][1] * w10 + self.flow[k01][1] * w01 + self.flow[k11][1] * w11,
            ],
        }
    }

    #[inline]
    fn ground_at(&self, x: f32, z: f32) -> f32 {
        let fx = ((x - self.cfg.x0) * self.cfg.res).clamp(0.0, self.cfg.w as f32 - 1.001);
        let fz = ((z - self.cfg.z0) * self.cfg.res).clamp(0.0, self.cfg.h as f32 - 1.001);
        self.ground[fz as usize * self.cfg.w + fx as usize]
    }

    fn shadowed(&self, x: f32, z: f32, y0: f32, slope: f32) -> bool {
        let mut sx = x + LIGHT_X * 0.35;
        let mut sz = z + LIGHT_Z * 0.35;
        let mut r = 0.35;
        for _ in 0..10 {
            if !self.contains(sx, sz) {
                break;
            }
            if self.ground_at(sx, sz) > y0 + r * slope {
                return true;
            }
            sx += LIGHT_X * 0.35;
            sz += LIGHT_Z * 0.35;
            r += 0.35;
        }
        false
    }

    fn surf(&self, x: f32, z: f32, dir: [f32; 2], p: &Params, t: f32, seed: u32) -> f32 {
        // Time only ever moves the pattern downstream (+along). Any time term on
        // the across axis reads as water sliding side to side over the channel.
        // `t` here is already scaled by the local current (0 in still water).
        // Body field stays nearly isotropic. Any real stretch turns fbm into
        // full-width iso scanlines on east-west rivers; flow read is the lane overlay.
        let st = p.stretch.min(1.0);
        let along = x * dir[0] + z * dir[1];
        let across = -x * dir[1] + z * dir[0];
        let nx = across / p.scale;
        let ny = along / (p.scale * st);
        let wx = fbm2(nx * 0.9, ny * 0.9 - t * 0.02, seed ^ 11);
        let wy = fbm2(nx * 0.9 + 9.1, ny * 0.9 - t * 0.015, seed ^ 23);
        let qx = nx + p.warp * (wx - 0.5);
        let qy = ny + p.warp * (wy - 0.5) / st.max(1.0).sqrt();
        let base = fbm2(qx, qy, seed);
        // Stretch detail with the current so short across-grain cannot salt the iso pixel.
        let detail = vnoise(
            across / (p.scale * 0.70) + (wx - 0.5) * p.warp,
            along / (p.scale * st * 1.15) + (wy - 0.5) * p.warp * 0.5,
            seed ^ 5,
        );
        let dwt = if st > 2.0 { 0.14 } else { 0.28 };
        base * (1.0 - dwt) + detail * dwt
    }

    pub fn shade(&self, x: f32, z: f32, t: f32, p: &Params, ripples: &[Ripple], light: [f32; 2], seed: u32) -> Option<Shade> {
        let s = self.sample(x, z);
        if s.sdist <= 0.0 {
            return None;
        }
        Some(self.tone(x, z, t, p, ripples, light, seed, s, false))
    }

    /// Air-gap sheet: same tone, forced downstream, no shore test.
    pub fn shade_fall(&self, x: f32, z: f32, t: f32, p: &Params, flow: [f32; 2], ripples: &[Ripple], light: [f32; 2], seed: u32) -> Shade {
        let g = self.sample(x, z).ground;
        let mut p = *p;
        p.foam = p.foam.min(0.12);
        p.glint = p.glint.min(0.18);
        p.shore = 0.0;
        p.stretch = p.stretch.max(6.0);
        self.tone(x, z, t, &p, ripples, light, seed, Sample { ground: g, sdist: 2.4, flow }, true)
    }

    fn tone(&self, x: f32, z: f32, t: f32, p: &Params, ripples: &[Ripple], light: [f32; 2], seed: u32, s: Sample, fall: bool) -> Shade {
        let u = p.scale / 2.6;
        let depth = (s.sdist * 0.2 + 0.35).max(0.0);
        let fl = (s.flow[0] * s.flow[0] + s.flow[1] * s.flow[1]).sqrt();
        let dir = if fl > 0.02 {
            let up = self.sample(x - s.flow[0] / fl * 1.4, z - s.flow[1] / fl * 1.4);
            let [ax, az] = [s.flow[0] + up.flow[0], s.flow[1] + up.flow[1]];
            let am = ax.hypot(az);
            if am > 1e-5 {
                [ax / am, az / am]
            } else {
                [s.flow[0] / fl, s.flow[1] / fl]
            }
        } else {
            [0.0, 1.0]
        };
        let speed = p.speed * fl;
        let still = p.veins <= 0.01 && p.foam <= 0.01;
        // River UV: across the channel, along the current. Overlay rides this,
        // never world-x or the light axis (those read as rain/static).
        let along0 = x * dir[0] + z * dir[1];
        let across = -x * dir[1] + z * dir[0];
        let along = along0 - t * speed;
        // Still water (no current) gets no drift at all; moving water a slow
        // downstream creep on top of the flow-map advection below.
        let t_half = if fl > 0.02 { t * 0.5 } else { 0.0 };
        // Long cycle: the pattern mostly translates; the crossfade that hides
        // the reset is slow enough not to read as pulsing/morphing.
        let cycle = 5.0;
        let ph0 = (t / cycle).fract();
        let w0 = 1.0 - (2.0 * ph0 - 1.0).abs();
        let w1 = 1.0 - w0;
        let o0 = ph0 * speed * cycle;
        let dual = speed >= 0.45;
        let sample_h = |dx: f32, dz: f32| {
            let a = self.surf(x + dx - dir[0] * o0, z + dz - dir[1] * o0, dir, p, t_half, seed);
            if !dual {
                return a;
            }
            let ph1 = (ph0 + 0.5).fract();
            let o1 = ph1 * speed * cycle;
            let b = self.surf(x + dx - dir[0] * o1, z + dz - dir[1] * o1, dir, p, t_half, seed ^ 0x51);
            0.5 + (a * w0 + b * w1 - 0.5) / (w0 * w0 + w1 * w1).sqrt()
        };
        let mut h = sample_h(0.0, 0.0);
        let mut foam = 0.0f32;
        for r in ripples {
            let dx = x - r.x;
            let dz = z - r.z;
            let d2 = dx * dx + dz * dz;
            let wake = r.radius * 8.0;
            if d2 > wake * wake {
                continue;
            }
            let sp = (r.vx * r.vx + r.vz * r.vz).sqrt();
            if sp < 0.12 {
                continue;
            }
            let d = d2.sqrt();
            let fall = (-d / (r.radius * 2.6)).exp();
            h += (d / r.radius * 5.0 - t * 7.0).sin() * fall * 0.035 * p.contrast;
            let (vx, vz) = (r.vx / sp, r.vz / sp);
            let behind = -(dx * vx + dz * vz);
            let side = (dx * vz - dz * vx).abs();
            let len = r.radius * (2.2 + 3.0 * sp.min(1.5));
            if behind > 0.0 && behind < len {
                let wdt = r.radius * (0.35 + 0.55 * behind / len);
                let k = (1.0 - side / wdt).max(0.0) * (1.0 - behind / len);
                let n = 0.5 + vnoise(side * 4.0 / u, behind * 3.0 / u - t * 2.0, seed ^ 9);
                foam += k * n * 0.45;
                h += k * 0.05;
            }
        }
        let ll = (light[0] * light[0] + light[1] * light[1]).sqrt().max(1e-5);
        let inv_ll = 1.0 / ll;
        let (lx, lz) = (light[0] * inv_ll, light[1] * inv_ll);
        let eps = p.scale * 0.1;
        let lit = (sample_h(lx * eps, lz * eps) - h) / eps * p.scale * 2.4 * p.contrast;
        // Depth must stay inside one palette step or a stone/island paints
        // concentric sdist rings (Hartstep). Surf contrast stays low so a
        // quantized fbm cannot close into C-islands (Stillmere / Shallows).
        let dn = sstep(0.0, 1.0, (s.sdist / (14.0 * u)).min(depth / (3.0 * u) + 0.0001).clamp(0.0, 1.0));
        let mut vv = if still {
            lerp(0.38, 0.32, dn) + (h - 0.5) * 0.06 * p.contrast
        } else {
            lerp(0.50, 0.38, dn) + (h - 0.5) * 0.38 * p.contrast + lit * 0.08
        };
        let shadow = !still && self.shadowed(x, z, s.ground, 1.3);
        if shadow {
            vv -= 0.10;
        }
        let mut base = (vv * 6.0).clamp(0.0, 5.99);
        if p.veins > 0.01 && fl > 0.02 {
            let ia = (along / 1.35).floor() as i32 as u32;
            let ic = (across / 0.85).floor() as i32 as u32;
            let n = hash(ia, ic, seed ^ 303);
            let nxt = hash(ia.wrapping_add(1), ic, seed ^ 303);
            if n > 0.91 {
                base = base.max(4.0).min(5.4);
                if n > 0.965 { base = base.max(4.8).min(5.8); }
            }
            if n > 0.91 && nxt > 0.88 {
                base = base.max(4.2).min(5.5);
            }
        }
        if !still && s.sdist < 2.4 {
            let ia = (along / 1.7).floor() as i32 as u32;
            let ic = (across / 1.1).floor() as i32 as u32;
            let n = hash(ia, ic, seed ^ 707);
            let side = hash(ia, ic.wrapping_add(1), seed ^ 707);
            if n > 0.86 { base = base.max(3.8).min(5.2); }
            if n > 0.94 && side > 0.80 { base = base.max(4.3).min(5.5); }
            if s.sdist < 0.85 && hash(ia.wrapping_mul(3), ic, seed ^ 19) > 0.78 {
                base = base.max(4.0).min(5.0);
            }
        }
        let mut hi = 0u8;
        // Pale foam only on an already-lit mid (WATER+2), never on navy.
        // Hash is 1-D along flow so survivors are dashes, not salt.
        let tw = (t * 1.1 + hash((along0 / (u * 1.6)) as i32 as u32, seed ^ 4242, seed ^ 7) * 6.28).sin();
        let thr = 2.35 - 0.45 * p.glint + 0.12 * tw;
        if !shadow && !still && base >= 4.0 {
            if lit > thr {
                base = base.max(4.6).min(5.99);
            }
            if lit > thr + 0.85 && p.glint > 0.2 {
                hi = 6;
            }
        }
        if p.foam > 0.01 && !fall {
            // Specks along the current. Thresholding h made closed foam ovals.
            let foam_along = along0 - t * speed * 0.35;
            let speck = vnoise(across / (u * 0.7), foam_along / (u * 1.1), seed ^ 19);
            if speck > 0.78 {
                foam += p.foam * fl;
            }
        }
        if fall {
            // Streaks stay on the navy→mid ramp. Foam is specks, never a white sheet.
            let streak = fbm2(across / (p.scale * 0.28), along / (p.scale * p.stretch * 0.65), seed ^ 71);
            if streak > 0.50 {
                base = (base + 1.15).min(4.5);
            }
            if streak > 0.68 {
                base = (base + 0.55).min(4.8);
            }
            hi = 0;
            let speck = vnoise(across / (u * 0.28), along / (u * 0.9), seed ^ 29);
            if streak > 0.80 && speck > 0.80 {
                hi = 6;
            }
        } else {
            if foam > 0.70 {
                base = base.max(4.2).min(5.99);
            }
            if foam > 0.88 && fl > 0.35 {
                hi = hi.max(6);
            }
            // Lap is broken WATER+2, not a white rim that traces the cell diamonds.
            let lap = (t * (1.0 + speed * 0.15) * 1.2 + along0 * 0.55 / u + vnoise(x / u * 0.5, z / u * 0.5, seed ^ 3) * 2.2).sin()
                * 0.5
                + 0.5;
            let reach = (0.04 + 0.10 * lap) * u * p.shore;
            let broken = vnoise(along0 / (u * 0.55) + t * 0.2, across / (u * 0.45), seed ^ 29);
            if s.sdist < reach && broken > 0.82 {
                base = base.max(4.2).min(5.99);
            } else if s.sdist < reach + 0.35 * u {
                base = base.max(3.6).min(5.99);
            }
        }
        if still {
            hi = 0;
            let ix = x.floor() as i32 as u32;
            let iz = z.floor() as i32 as u32;
            let tick = (t * 0.45).floor() as i32 as u32;
            let g = hash(ix, iz, seed ^ 17);
            base = (base + (g - 0.5) * 0.22).clamp(0.0, 3.8);
            if hash(ix, iz, seed ^ tick) > 0.984 {
                base = 4.15; // WATER+1 only
            }
        }
        if hi > 0 && base < 4.0 {
            hi = 0;
            base = base.max(4.3);
        }
        Shade { base, hi }
    }
}

/// Walk pixel centers inside the triangle; `plot(x, y, w0, w1)` gets barycentric A/B.
fn for_tri_pixels(fb_w: i32, fb_h: i32, a: P2, b: P2, c: P2, mut plot: impl FnMut(i32, i32, f32, f32)) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb_w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb_h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-6 {
        return;
    }
    let inv = 1.0 / area;
    let dw0x = (b.y - c.y) * inv;
    let dw1x = (c.y - a.y) * inv;
    let dw0y = (c.x - b.x) * inv;
    let dw1y = (a.x - c.x) * inv;
    let px0 = min_x as f32 + 0.5;
    let py0 = min_y as f32 + 0.5;
    let mut row_w0 = ((b.x - px0) * (c.y - py0) - (b.y - py0) * (c.x - px0)) * inv;
    let mut row_w1 = ((c.x - px0) * (a.y - py0) - (c.y - py0) * (a.x - px0)) * inv;
    for y in min_y..=max_y {
        let mut w0 = row_w0;
        let mut w1 = row_w1;
        let mut x = min_x;
        while x <= max_x && (w0 < 0.0 || w1 < 0.0 || 1.0 - w0 - w1 < 0.0) {
            w0 += dw0x;
            w1 += dw1x;
            x += 1;
        }
        while x <= max_x && w0 >= 0.0 && w1 >= 0.0 && 1.0 - w0 - w1 >= 0.0 {
            plot(x, y, w0, w1);
            w0 += dw0x;
            w1 += dw1x;
            x += 1;
        }
        row_w0 += dw0y;
        row_w1 += dw1y;
    }
}

#[allow(clippy::too_many_arguments)]
pub fn fill_tri(
    fb: &mut Framebuffer,
    a: P2,
    b: P2,
    c: P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    ox: f32,
    oz: f32,
    cell: f32,
    time: f32,
    p: Params,
    field: Option<&WaterField>,
    ripples: &[Ripple],
    land: u8,
) {
    let w = fb.w;
    let Some(field) = field else {
        for_tri_pixels(fb.w as i32, fb.h as i32, a, b, c, |x, y, _, _| {
            fb.color[y as usize * w + x as usize] = WATER + 1;
        });
        return;
    };
    let du0 = ua.0 - uc.0;
    let du1 = ub.0 - uc.0;
    let dv0 = ua.1 - uc.1;
    let dv1 = ub.1 - uc.1;
    for_tri_pixels(fb.w as i32, fb.h as i32, a, b, c, |x, y, w0, w1| {
        let u = uc.0 + w0 * du0 + w1 * du1;
        let v = uc.1 + w0 * dv0 + w1 * dv1;
        let wx = ox + u * cell;
        let wz = oz + v * cell;
        let sm = field.sample(wx, wz);
        if sm.sdist <= 0.0 {
            fb.color[y as usize * w + x as usize] = land;
            return;
        }
        if sm.sdist < 0.28 {
            let b = BAYER4[(y & 3) as usize][(x & 3) as usize] / 16.0;
            if sm.sdist / 0.28 < b {
                fb.color[y as usize * w + x as usize] = land;
                return;
            }
        }
        fb.color[y as usize * w + x as usize] =
            to_ramp(quantize(field.tone(wx, wz, time, &p, ripples, LIGHT, 7, sm, false), x, y, 0.32));
    });
}

#[allow(clippy::too_many_arguments)]
pub fn fill_wet_lip(
    fb: &mut Framebuffer,
    a: P2,
    b: P2,
    c: P2,
    ua: (f32, f32),
    ub: (f32, f32),
    uc: (f32, f32),
    ox: f32,
    oz: f32,
    cell: f32,
    time: f32,
    field: &WaterField,
    ripples: &[Ripple],
    land: u8,
    ys: [f32; 3],
    level: f32,
) {
    let w = fb.w;
    let du0 = ua.0 - uc.0;
    let du1 = ub.0 - uc.0;
    let dv0 = ua.1 - uc.1;
    let dv1 = ub.1 - uc.1;
    // Above this the bank is dry ground, whatever the smoothed mask says.
    const LIP_RISE: f32 = 0.08;
    if ys[0].min(ys[1]).min(ys[2]) > level + LIP_RISE {
        return;
    }
    for_tri_pixels(fb.w as i32, fb.h as i32, a, b, c, |x, y, w0, w1| {
        let gy = ys[0] * w0 + ys[1] * w1 + ys[2] * (1.0 - w0 - w1);
        if gy > level + LIP_RISE {
            return;
        }
        let u = uc.0 + w0 * du0 + w1 * du1;
        let v = uc.1 + w0 * dv0 + w1 * dv1;
        let wx = ox + u * cell;
        let wz = oz + v * cell;
        let sm = field.sample(wx, wz);
        if sm.sdist > 0.0 {
            let fl = (sm.flow[0] * sm.flow[0] + sm.flow[1] * sm.flow[1]).sqrt();
            let p = mode_from_flow(fl, false).params_iso();
            fb.color[y as usize * w + x as usize] =
                to_ramp(quantize(field.tone(wx, wz, time, &p, ripples, LIGHT, 7, sm, false), x, y, 0.32));
            return;
        }
        if sm.sdist < -2.0 {
            return;
        }
        let t = 1.0 - sstep(-2.0, 0.0, sm.sdist);
        let bth = BAYER4[(y & 3) as usize][(x & 3) as usize] / 16.0;
        if t < 0.35 + 0.4 * bth {
            return;
        }
        let col = if t > 0.82 && bth > 0.7 { WATER + 3 } else { land };
        fb.color[y as usize * w + x as usize] = col;
    });
}

/// Shade a triangle from world (x, z) at each vertex. `fall` skips the shore
/// test and uses `flow` so an air-gap sheet still reads as rushing water.
#[allow(clippy::too_many_arguments)]
pub fn fill_tri_xz(
    fb: &mut Framebuffer,
    a: P2,
    b: P2,
    c: P2,
    wa: (f32, f32),
    wb: (f32, f32),
    wc: (f32, f32),
    time: f32,
    p: Params,
    field: Option<&WaterField>,
    ripples: &[Ripple],
    fall: bool,
    flow: [f32; 2],
) {
    let Some(field) = field else {
        return;
    };
    let w = fb.w;
    let dx0 = wa.0 - wc.0;
    let dx1 = wb.0 - wc.0;
    let dz0 = wa.1 - wc.1;
    let dz1 = wb.1 - wc.1;
    for_tri_pixels(fb.w as i32, fb.h as i32, a, b, c, |x, y, w0, w1| {
        let wx = wc.0 + w0 * dx0 + w1 * dx1;
        let wz = wc.1 + w0 * dz0 + w1 * dz1;
        let s = if fall {
            field.shade_fall(wx, wz, time, &p, flow, ripples, LIGHT, 7)
        } else {
            let sm = field.sample(wx, wz);
            if sm.sdist <= 0.0 {
                return;
            }
            field.tone(wx, wz, time, &p, ripples, LIGHT, 7, sm, false)
        };
        fb.color[y as usize * w + x as usize] = to_ramp(quantize(s, x, y, 0.32));
    });
}

fn shade_fall_uv(across: f32, down: f32, v: f32, t: f32, p: &Params, seed: u32) -> Shade {
    let u = p.scale / 2.6;
    let spd = 6.0;
    // fbm2 tops out at 0.75, so normalise.
    let sn = fbm2(across / (0.30 * u), (down - t * spd) / (1.8 * u), seed ^ 71) * 1.333;
    let fine = vnoise(across / (0.12 * u), (down - t * spd * 1.4) / (0.8 * u), seed ^ 72);
    let mut base = 1.2 + sn * 3.0 + (fine - 0.5) * 0.8;
    let mut hi = 0u8;
    if v < 0.10 {
        base += (1.0 - v / 0.10) * 1.0;
    }
    if sn > 0.88 && fine > 0.75 {
        hi = 6;
    }
    if v > 0.80 {
        let k = (v - 0.80) / 0.20;
        let f = vnoise(across / (0.22 * u), t * 7.0, seed ^ 73) * (0.5 + k);
        if f > 0.9 {
            hi = 7;
        } else if f > 0.6 {
            hi = 6;
        }
    }
    Shade { base: base.clamp(0.0, 4.9), hi }
}

/// Corners match draw_fall_sheets: a = lip−, b = lip+, c = pool+, d = pool−.
pub fn fill_fall_quad(fb: &mut Framebuffer, a: P2, b: P2, c: P2, d: P2, span: &FallSpan, time: f32, p: Params) {
    let width = (span.lip_w.max(span.pool_w) * 2.0).max(0.3);
    let drop_h = (span.lip[2] - span.pool[2]).abs().max(0.2);
    let fw = fb.w;
    let tris = [
        (a, b, c, (0.0f32, 0.0f32), (1.0f32, 0.0f32), (1.0f32, 1.0f32)),
        (a, c, d, (0.0, 0.0), (1.0, 1.0), (0.0, 1.0)),
    ];
    for (pa, pb, pc, ua, ub, uc) in tris {
        let (du0, du1, dv0, dv1) = (ua.0 - uc.0, ub.0 - uc.0, ua.1 - uc.1, ub.1 - uc.1);
        for_tri_pixels(fb.w as i32, fb.h as i32, pa, pb, pc, |x, y, w0, w1| {
            let u = uc.0 + w0 * du0 + w1 * du1;
            let v = uc.1 + w0 * dv0 + w1 * dv1;
            // Ragged side edges so the sheet doesn't read as a hard rectangle.
            let edge = u.min(1.0 - u) * width;
            if edge < 0.16 {
                let bth = BAYER4[(y & 3) as usize][(x & 3) as usize] / 16.0;
                if edge / 0.16 < bth {
                    return;
                }
            }
            let s = shade_fall_uv((u - 0.5) * width, v * drop_h, v, time, &p, 7);
            fb.color[y as usize * fw + x as usize] = to_ramp(quantize(s, x, y, 0.32));
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wfl1_parses_one_fall() {
        let mut b = vec![b'W', b'F', b'L', b'1', 0, 0, 1, 0];
        for n in [-93.0f32, 118.4, 15.6, 2.0, -93.5, 114.6, 10.4, 2.4] {
            b.extend_from_slice(&n.to_le_bytes());
        }
        let l = WaterLayout::parse(&b).expect("WFL1");
        assert_eq!(l.falls.len(), 1);
        assert!((l.falls[0].lip[0] + 93.0).abs() < 0.01);
        assert!((l.falls[0].pool[1] - 114.6).abs() < 0.01);
        let field = WaterField {
            cfg: FieldCfg { x0: -160.0, z0: -160.0, w: 2, h: 2, res: 2.0 },
            ground: vec![0.0; 4],
            sdist: vec![-1.0; 4],
            flow: vec![[0.0, 0.0]; 4],
            fall_box: falls_box(&l.falls),
            falls: l.falls,
        };
        let f = field.fall_flow_at(-93.25, 116.5).expect("veil face");
        assert!(f[1] < 0.0, "downhill is south");
        assert!(field.fall_flow_at(-93.0, 118.4).is_none(), "lip is not the face");
    }

    /// The surface pattern must drift downstream (+flow), not across it.
    #[test]
    fn pattern_drifts_downstream() {
        let field = WaterField {
            cfg: FieldCfg { x0: -160.0, z0: -160.0, w: 2, h: 2, res: 2.0 },
            ground: vec![0.0; 4],
            sdist: vec![5.0; 4],
            flow: vec![[0.0, 0.0]; 4],
            fall_box: falls_box(&[]),
            falls: vec![],
        };
        let p = Mode::Stream.params();
        let n = 48;
        let step = 0.25;
        let img = |t: f32| -> Vec<f32> {
            let mut v = Vec::with_capacity(n * n);
            for j in 0..n {
                for i in 0..n {
                    let (x, z) = (10.0 + i as f32 * step, 10.0 + j as f32 * step);
                    let s = Sample { ground: 0.0, sdist: 5.0, flow: [0.0, 0.8] };
                    // h only (pre-quantise): shade base before the vein overlay
                    v.push(field.tone(x, z, t, &p, &[], LIGHT, 7, s, false).base);
                }
            }
            v
        };
        let (a, b) = (img(0.2), img(0.5));
        let mut best = (f32::MAX, 0i32, 0i32);
        for dj in -6i32..=6 {
            for di in -6i32..=6 {
                let mut e = 0.0;
                for j in 8..n as i32 - 8 {
                    for i in 8..n as i32 - 8 {
                        let d = b[((j + dj) * n as i32 + i + di) as usize] - a[(j * n as i32 + i) as usize];
                        e += d * d;
                    }
                }
                if e < best.0 {
                    best = (e, di, dj);
                }
            }
        }
        eprintln!("drift cells (across x, along z) = ({}, {})", best.1, best.2);
        assert!(best.2 >= 0, "pattern runs upstream");
        assert!(best.1.abs() <= best.2.abs().max(0), "pattern slides across the channel");
    }

    fn dummy_field() -> WaterField {
        WaterField {
            cfg: FieldCfg { x0: -160.0, z0: -160.0, w: 2, h: 2, res: 2.0 },
            ground: vec![0.0; 4],
            sdist: vec![8.0; 4],
            flow: vec![[0.0, 0.0]; 4],
            fall_box: falls_box(&[]),
            falls: vec![],
        }
    }

    #[test]
    fn still_never_emits_water_plus_3() {
        let field = dummy_field();
        let p = Mode::Still.params();
        let n = 48;
        let mut hi = 0usize;
        for j in 0..n {
            for i in 0..n {
                let s = Sample { ground: 0.0, sdist: 12.0, flow: [0.0, 0.0] };
                let sh = field.tone(8.0 + i as f32 * 0.3, 8.0 + j as f32 * 0.3, 1.4, &p, &[], LIGHT, 7, s, false);
                if sh.hi > 0 {
                    hi += 1;
                }
            }
        }
        assert_eq!(hi, 0, "still lake emitted WATER+3 ({hi} hi pixels)");
    }

    #[test]
    fn highlight_sits_on_mid_not_navy() {
        let field = dummy_field();
        let p = Mode::Stream.params();
        let n = 48;
        for j in 0..n {
            for i in 0..n {
                let s = Sample { ground: 0.0, sdist: 5.0, flow: [0.0, 0.8] };
                let sh = field.tone(8.0 + i as f32 * 0.3, 8.0 + j as f32 * 0.3, 0.9, &p, &[], LIGHT, 7, s, false);
                if sh.hi > 0 {
                    assert!(sh.base >= 4.0, "isolated hi on navy (base {})", sh.base);
                }
            }
        }
        assert!(mode_from_flow(0.28, false) == Mode::Stream);
        assert!(mode_from_flow(0.27, false) == Mode::Still);
    }
}
