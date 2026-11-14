// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Staff SDF pass 3 (vs reference):
//! 1. Molten *ribbons* in valleys (not Worley freckles on crests)
//! 2. Detached floating halo above claw tips (hard union + air gap)
//! 3. Thicker strands + stronger bark displacement
//! 4. Readable leather grip (heat kill) + gold pommel ferrule

use glam::{Vec2, Vec3};

const TAU: f32 = std::f32::consts::TAU;

/// Polynomial smooth-min (IQ). Soft-blends two distances without hard seams.
pub fn smin(a: f32, b: f32, k: f32) -> f32 {
    if k <= 1e-6 {
        return a.min(b);
    }
    let h = (0.5 + 0.5 * (b - a) / k).clamp(0.0, 1.0);
    b + (a - b) * h - k * h * (1.0 - h)
}

fn smax(a: f32, b: f32, k: f32) -> f32 {
    -smin(-a, -b, k)
}

/// Piecewise-linear taper curve: list of (t, scale) knots, t in 0..1.
#[derive(Clone, Debug)]
pub struct Curve {
    pub knots: Vec<(f32, f32)>,
}

impl Curve {
    pub fn linear(a: f32, b: f32) -> Self {
        Self {
            knots: vec![(0.0, a), (1.0, b)],
        }
    }

    pub fn eval(&self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        if self.knots.is_empty() {
            return 1.0;
        }
        if t <= self.knots[0].0 {
            return self.knots[0].1;
        }
        for w in self.knots.windows(2) {
            let (t0, v0) = w[0];
            let (t1, v1) = w[1];
            if t <= t1 {
                let u = if (t1 - t0).abs() < 1e-6 {
                    0.0
                } else {
                    (t - t0) / (t1 - t0)
                };
                return v0 + (v1 - v0) * u;
            }
        }
        self.knots.last().map(|k| k.1).unwrap_or(1.0)
    }
}

#[derive(Clone, Debug)]
pub struct StaffParams {
    pub length: f32,
    pub strands: u32,
    pub twist_turns: f32,
    pub braid_radius: f32,
    pub strand_radius: f32,
    pub core_radius: f32,
    pub blend: f32,
    pub taper: Curve,
    pub bark_scale: f32,
    pub bark_strength: f32,
    pub horns: Option<HornParams>,
    pub grip: Option<GripParams>,
    pub ring: Option<RingParams>,
    pub halo: Option<HaloParams>,
}

#[derive(Clone, Debug)]
pub struct HornParams {
    pub count: u32,
    pub length: f32,
    pub curl: f32,
    pub radius: f32,
}

#[derive(Clone, Debug)]
pub struct GripParams {
    /// Centre of wrap along shaft, 0..1.
    pub t: f32,
    pub half_height: f32,
    pub radius: f32,
}

#[derive(Clone, Debug)]
pub struct RingParams {
    pub y: f32,
    pub major: f32,
    pub minor: f32,
}

#[derive(Clone, Debug)]
pub struct HaloParams {
    pub y: f32,
    pub major: f32,
    pub minor: f32,
    pub shards: u32,
    pub shard_orbit: f32,
}

impl Default for StaffParams {
    fn default() -> Self {
        Self {
            length: 1.85,
            strands: 2,
            // Slightly slower twist → thicker readable eyes, less wire lattice.
            twist_turns: 3.6,
            braid_radius: 0.062,
            strand_radius: 0.034,
            // Fat molten channel that fills the valley between strands.
            core_radius: 0.022,
            // Deep valleys without melting strands into one sausage.
            blend: 0.012,
            taper: Curve {
                knots: vec![(0.0, 1.12), (0.35, 1.05), (0.7, 0.92), (0.9, 0.7), (1.0, 0.48)],
            },
            bark_scale: 11.0,
            bark_strength: 0.014,
            horns: Some(HornParams {
                count: 3,
                length: 0.28,
                curl: 0.95,
                radius: 0.02,
            }),
            grip: Some(GripParams {
                t: 0.26,
                half_height: 0.085,
                radius: 0.052,
            }),
            ring: Some(RingParams {
                y: -0.035,
                major: 0.062,
                minor: 0.014,
            }),
            // Clear air gap above claw tips (~2.15) → halo floats.
            halo: Some(HaloParams {
                y: 2.38,
                major: 0.11,
                minor: 0.022,
                shards: 9,
                shard_orbit: 0.17,
            }),
        }
    }
}

fn hash31(p: Vec3) -> f32 {
    let n = p.dot(Vec3::new(127.1, 311.7, 74.7));
    (n.sin() * 43758.5453).fract().abs()
}

fn value_noise(p: Vec3) -> f32 {
    let i = p.floor();
    let f = p.fract();
    let u = f * f * (3.0 - 2.0 * f);
    let a = hash31(i);
    let b = hash31(i + Vec3::X);
    let c = hash31(i + Vec3::Y);
    let d = hash31(i + Vec3::new(1.0, 1.0, 0.0));
    let e = hash31(i + Vec3::Z);
    let g = hash31(i + Vec3::new(1.0, 0.0, 1.0));
    let h = hash31(i + Vec3::new(0.0, 1.0, 1.0));
    let j = hash31(i + Vec3::ONE);
    let x1 = a + (b - a) * u.x;
    let x2 = c + (d - c) * u.x;
    let y1 = x1 + (x2 - x1) * u.y;
    let x3 = e + (g - e) * u.x;
    let x4 = h + (j - h) * u.x;
    let y2 = x3 + (x4 - x3) * u.y;
    y1 + (y2 - y1) * u.z
}

pub fn fbm_ridged(p: Vec3) -> f32 {
    let mut amp = 0.5;
    let mut freq = 1.0;
    let mut sum = 0.0;
    let mut norm = 0.0;
    for _ in 0..5 {
        let n = 1.0 - (2.0 * value_noise(p * freq) - 1.0).abs();
        sum += n * n * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.15;
    }
    if norm > 0.0 {
        sum / norm
    } else {
        0.0
    }
}

fn capsule_sdf(p: Vec3, a: Vec3, b: Vec3, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = (pa.dot(ba) / ba.dot(ba).max(1e-8)).clamp(0.0, 1.0);
    (pa - ba * h).length() - r
}

fn torus_xz(p: Vec3, y: f32, major: f32, minor: f32) -> f32 {
    let q = Vec2::new(Vec2::new(p.x, p.z).length() - major, p.y - y);
    q.length() - minor
}

fn ellipsoid(p: Vec3, r: Vec3) -> f32 {
    let q = Vec3::new(p.x / r.x, p.y / r.y, p.z / r.z);
    let k0 = q.length();
    let k1 = Vec3::new(q.x / r.x, q.y / r.y, q.z / r.z).length();
    k0 * (k0 - 1.0) / k1.max(1e-6)
}

/// Approximate claw tip Y so halo can sit above with an air gap.
pub fn horns_tip_y(s: &StaffParams) -> f32 {
    let Some(ref horns) = s.horns else {
        return s.length;
    };
    // Matches horns_sdf: base ≈ length-0.02, out.y≈0.45, + Y*(0.45*length).
    s.length - 0.02 + horns.length * 0.45 + horns.length * 0.45
}

fn horns_sdf(p: Vec3, s: &StaffParams, horns: &HornParams) -> f32 {
    let tip_y = s.length;
    let mut d = f32::MAX;
    let n = horns.count.max(1);
    for i in 0..n {
        let a0 = TAU * (i as f32) / (n as f32) + 0.35;
        let base = Vec3::new(
            a0.cos() * s.braid_radius * 1.05,
            tip_y - 0.02,
            a0.sin() * s.braid_radius * 1.05,
        );
        let out = {
            let v = Vec3::new(a0.cos(), 0.72, a0.sin());
            let len = v.length();
            if len > 1e-6 {
                v / len
            } else {
                Vec3::X
            }
        };
        let end = base + out * horns.length + Vec3::Y * (horns.length * 0.45);
        let mid = base.lerp(end, 0.45) + out * (horns.curl * 0.08);
        d = d.min(capsule_sdf(p, base, mid, horns.radius));
        d = d.min(capsule_sdf(p, mid, end, horns.radius * 0.45));
    }
    d
}

fn halo_sdf(p: Vec3, h: &HaloParams) -> f32 {
    // Cracked molten ring — noise displaces the torus into irregular stone.
    let mut d = torus_xz(p, h.y, h.major, h.minor);
    d += (fbm_ridged(p * 22.0) - 0.5) * 0.012;
    let n = h.shards.max(1);
    for i in 0..n {
        let a = TAU * (i as f32) / (n as f32) + i as f32 * 0.41;
        let bob = ((i as f32) * 1.9).sin() * 0.035;
        let orbit = h.shard_orbit * (0.85 + 0.2 * ((i % 3) as f32 * 0.5));
        let c = Vec3::new(a.cos() * orbit, h.y + bob, a.sin() * orbit);
        let r = Vec3::new(0.022, 0.014, 0.012) * (0.65 + 0.4 * ((i % 4) as f32 * 0.25));
        d = d.min(ellipsoid(p - c, r));
    }
    d
}

fn pommel_sdf(p: Vec3, ring: &RingParams) -> f32 {
    let mut d = torus_xz(p, ring.y, ring.major, ring.minor);
    // Three-pointed ferrule above the ring (reference gold mount).
    for i in 0..3 {
        let a = TAU * (i as f32) / 3.0 + 0.2;
        let tip = Vec3::new(
            a.cos() * ring.major * 0.35,
            ring.y + 0.075,
            a.sin() * ring.major * 0.35,
        );
        let base = Vec3::new(0.0, ring.y + 0.01, 0.0);
        d = d.min(capsule_sdf(p, base, tip, 0.01));
    }
    // Small boss through the ring centre.
    d = d.min(capsule_sdf(
        p,
        Vec3::new(0.0, ring.y - 0.01, 0.0),
        Vec3::new(0.0, ring.y + 0.04, 0.0),
        0.016,
    ));
    d
}

fn grip_sdf(p: Vec3, g: &GripParams, len: f32) -> f32 {
    let gy = g.t * len;
    let gy_d = (p.y - gy).abs() - g.half_height;
    let gr = Vec2::new(p.x, p.z).length() - g.radius;
    let mut grip = smax(gr, gy_d, 0.018);
    // Overlapping leather cord ridges (readable at mesh res).
    let ridge = ((p.y - gy) * 42.0).sin().abs() * 0.007;
    let spiral = (p.z.atan2(p.x) * 3.0 + (p.y - gy) * 28.0).sin().abs() * 0.004;
    let mask = (1.0 - (gy_d / 0.025).clamp(0.0, 1.0)).max(0.0);
    grip += (ridge + spiral) * mask;
    grip
}

/// Braid-frame helpers shared by SDF and heat (valley = molten channel).
fn braid_frame(p: Vec3, s: &StaffParams) -> (f32, Vec2, f32, f32) {
    let len = s.length.max(0.1);
    let t = (p.y / len).clamp(0.0, 1.0);
    let ang = s.twist_turns * TAU * t;
    let (sn, cs) = ang.sin_cos();
    let q = Vec2::new(p.x * cs - p.z * sn, p.x * sn + p.z * cs);
    let strands = s.strands.max(1) as f32;
    let sector = TAU / strands;
    let a = (q.y.atan2(q.x) + sector * 0.5).rem_euclid(sector) - sector * 0.5;
    let r = q.length();
    let local = Vec2::new(r * a.cos(), r * a.sin());
    (t, local, a, sector)
}

/// Distance to the fused braid staff. Domain twist is moderate — mesh, don't raymarch hard.
pub fn staff_sdf(p: Vec3, s: &StaffParams) -> f32 {
    let len = s.length.max(0.1);
    let (t, local, _a, _sector) = braid_frame(p, s);

    let taper = s.taper.eval(t);
    let strand_r = s.strand_radius * (0.6 + 0.4 * taper);
    let strand = (local - Vec2::new(s.braid_radius * taper.sqrt(), 0.0)).length() - strand_r;
    // Molten core fills the eye / valley — thicker than pass 2.
    let core = Vec2::new(p.x, p.z).length() - s.core_radius * taper;

    let mut body = smin(strand, core, s.blend);
    let ends = (-p.y).max(p.y - len);
    body = smax(body, ends, 0.04);

    if let Some(ref horns) = s.horns {
        body = smin(body, horns_sdf(p, s, horns), s.blend * 1.2);
    }

    if let Some(ref g) = s.grip {
        body = smin(body, grip_sdf(p, g, len), 0.02);
    }

    if let Some(ref ring) = s.ring {
        body = smin(body, pommel_sdf(p, ring), 0.018);
    }

    // Halo is *detached*: hard min, no smin — preserves the air gap.
    if let Some(ref halo) = s.halo {
        body = body.min(halo_sdf(p, halo));
    }

    // Bark: stronger ridged crust on the dark strands (halo/ring get less).
    let bark_mask = if s.halo.as_ref().map(|h| (p.y - h.y).abs() < 0.08).unwrap_or(false) {
        0.25
    } else {
        1.0
    };
    body + fbm_ridged(p * s.bark_scale) * s.bark_strength * bark_mask
}

/// How deep we sit in a braid valley (1 = between strands / molten channel).
///
/// In the polar-repeat frame the strand sits at `a ≈ 0`; the groove is at the
/// sector edge `|a| → sector/2`. Earlier passes inverted this and lit the crests.
pub fn valley_factor(p: Vec3, s: &StaffParams) -> f32 {
    let (_t, local, a, sector) = braid_frame(p, s);
    let mid = (sector * 0.5).max(1e-4);
    // 0 on strand crest, 1 in the groove between strands.
    let ang_v = (a.abs() / mid).clamp(0.0, 1.0).powf(1.35);
    // Prefer the channel near the braid radius (not the hollow core axis alone).
    let radial = 1.0
        - ((local.length() - s.braid_radius * 0.75).abs() / (s.strand_radius * 2.4)).clamp(0.0, 1.0);
    (ang_v * 0.8 + radial * 0.2).clamp(0.0, 1.0)
}

pub fn worley2(p: Vec2) -> (f32, f32) {
    let i = p.floor();
    let f = p.fract();
    let mut f1 = 8.0f32;
    let mut f2 = 8.0f32;
    for y in -1..=1 {
        for x in -1..=1 {
            let g = Vec2::new(x as f32, y as f32);
            let o = Vec2::new(
                hash31(Vec3::new(i.x + g.x, i.y + g.y, 0.3)),
                hash31(Vec3::new(i.x + g.x, i.y + g.y, 7.1)),
            );
            let d = (g + o - f).length();
            if d < f1 {
                f2 = f1;
                f1 = d;
            } else if d < f2 {
                f2 = d;
            }
        }
    }
    (f1, f2)
}

fn in_grip(p: Vec3, s: &StaffParams) -> f32 {
    let Some(ref g) = s.grip else {
        return 0.0;
    };
    let gy = g.t * s.length;
    let d = (p.y - gy).abs() / g.half_height.max(1e-3);
    (1.0 - d).clamp(0.0, 1.0)
}

/// Heat pass 3: continuous molten *ribbons* in valleys; grip kills; halo/pommel gold-hot.
pub fn heat_at(p: Vec3, s: &StaffParams, time: f32) -> f32 {
    let len = s.length.max(0.1);
    let t = (p.y / len).clamp(0.0, 1.0);
    let twist = s.twist_turns * TAU * t;
    let ang = p.z.atan2(p.x) - twist;

    // Helix-aligned UV for subtle crack *detail* on the ribbon (not freckles on bark).
    let uv = Vec2::new(ang * (s.strands.max(1) as f32) * 1.2, p.y * 5.5);
    let warp = Vec2::new(value_noise(p * 2.4), value_noise(p * 2.4 + Vec3::splat(11.0))) * 0.15;
    let (f1, f2) = worley2(uv + warp);
    let edge = ((f2 - f1) / 0.09).clamp(0.0, 1.0);
    let crack_detail = (1.0 - edge).powf(1.8);

    let valley = valley_factor(p, s);
    let pulse = 0.62 + 0.38 * (p.y * 4.2 - time * 2.0).sin();

    // Primary: continuous lava ribbon locked to the groove.
    let ribbon = valley.powf(1.65);
    // Secondary: sparse cracks only *inside* the ribbon.
    let mut heat = ribbon * (0.72 + 0.28 * pulse) + crack_detail * ribbon * 0.35;

    // Crest bark stays near-black.
    let crest = 1.0 - valley;
    heat *= 1.0 - crest.powf(1.2) * 0.92;
    heat = heat.max(0.02);

    // Leather wrap interrupts the glow (reference).
    let g = in_grip(p, s);
    heat *= 1.0 - g * 0.88;

    // Halo + shards: white-hot focus.
    if let Some(ref h) = s.halo {
        let hd = torus_xz(p, h.y, h.major, h.minor);
        let near = (1.0 - (hd / 0.06).clamp(0.0, 1.0)).powf(1.35);
        heat = heat.max(near * (0.95 + 0.05 * pulse));
        for i in 0..h.shards.max(1) {
            let a = TAU * (i as f32) / (h.shards.max(1) as f32) + i as f32 * 0.41;
            let orbit = h.shard_orbit * (0.85 + 0.2 * ((i % 3) as f32 * 0.5));
            let c = Vec3::new(a.cos() * orbit, h.y, a.sin() * orbit);
            let sd = (p - c).length();
            heat = heat.max((1.0 - (sd / 0.045).clamp(0.0, 1.0)) * 0.98);
        }
    }

    // Pommel gold.
    if let Some(ref r) = s.ring {
        let rd = torus_xz(p, r.y, r.major, r.minor);
        heat = heat.max((1.0 - (rd / 0.04).clamp(0.0, 1.0)) * 0.82);
        // Ferrule tips.
        if p.y < r.y + 0.09 && p.y > r.y {
            let xz = Vec2::new(p.x, p.z).length();
            if xz < r.major * 0.55 {
                heat = heat.max(0.7);
            }
        }
    }

    // Claw tips stay darker bark with a little bleed from the channel.
    if p.y > len - 0.05 && p.y < s.halo.as_ref().map(|h| h.y - 0.12).unwrap_or(len + 0.3) {
        heat = heat.max(valley * 0.4);
    }

    heat.clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interior_of_core_is_negative() {
        let s = StaffParams::default();
        let d = staff_sdf(Vec3::new(0.0, s.length * 0.5, 0.0), &s);
        assert!(d < 0.0, "core center should be inside, d={d}");
    }

    #[test]
    fn far_point_is_positive() {
        let s = StaffParams::default();
        let d = staff_sdf(Vec3::new(5.0, s.length * 0.5, 0.0), &s);
        assert!(d > 0.5, "far point outside, d={d}");
    }

    #[test]
    fn smin_between_min_and_blend() {
        let a = 0.1;
        let b = 0.2;
        let m = smin(a, b, 0.05);
        assert!(m <= a.min(b) + 1e-4);
        assert!(m >= a.min(b) - 0.05);
    }

    fn world_from_braid_local(s: &StaffParams, y: f32, local: Vec2) -> Vec3 {
        let t = (y / s.length.max(0.1)).clamp(0.0, 1.0);
        let ang = s.twist_turns * TAU * t;
        let (sn, cs) = ang.sin_cos();
        // Inverse of braid_frame's xz rotation.
        let x = local.x * cs + local.y * sn;
        let z = -local.x * sn + local.y * cs;
        Vec3::new(x, y, z)
    }

    #[test]
    fn valley_hotter_than_strand_crest() {
        let s = StaffParams::default();
        let y = s.length * 0.55;
        // Crest = outer surface of a strand (local +x). Valley = mid-sector groove (local +y).
        let crest_p = world_from_braid_local(
            &s,
            y,
            Vec2::new(s.braid_radius + s.strand_radius * 0.85, 0.0),
        );
        let valley_p =
            world_from_braid_local(&s, y, Vec2::new(0.0, s.braid_radius * 0.55));
        let crest = heat_at(crest_p, &s, 0.0);
        let valley = heat_at(valley_p, &s, 0.0);
        assert!(
            valley > crest + 0.08,
            "molten ribbon in valley (valley={valley}, crest={crest})"
        );
    }

    #[test]
    fn halo_floats_above_claws() {
        let s = StaffParams::default();
        let tip = horns_tip_y(&s);
        let halo_y = s.halo.as_ref().unwrap().y;
        assert!(
            halo_y > tip + 0.08,
            "halo must clear claw tips (halo={halo_y}, tip={tip})"
        );
        // Air gap: midpoint should be outside the SDF.
        let mid = Vec3::new(0.0, (tip + halo_y) * 0.5, 0.0);
        let d = staff_sdf(mid, &s);
        assert!(d > 0.02, "air gap between claws and halo, d={d}");
    }

    #[test]
    fn grip_kills_heat() {
        let s = StaffParams::default();
        let g = s.grip.as_ref().unwrap();
        let y_grip = g.t * s.length;
        let y_above = y_grip + g.half_height * 2.4;
        let groove = Vec2::new(0.0, s.braid_radius * 0.75);
        let on_grip = heat_at(world_from_braid_local(&s, y_grip, groove), &s, 0.0);
        let above = heat_at(world_from_braid_local(&s, y_above, groove), &s, 0.0);
        assert!(
            above > on_grip + 0.12,
            "grip should interrupt heat (grip={on_grip}, above={above})"
        );
    }
}
