// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Composable Object RON graph → StaffParams (extensible; start with braid staff).

use crate::sdf::{Curve, GripParams, HaloParams, HornParams, RingParams, StaffParams};
use serde::Deserialize;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ObjectError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("ron: {0}")]
    Ron(#[from] ron::error::SpannedError),
}

#[derive(Debug, Deserialize)]
#[serde(rename = "Object")]
pub struct ObjectDef {
    pub seed: u32,
    pub shape: ShapeNode,
    #[serde(default)]
    pub modifiers: Vec<ModifierNode>,
    #[serde(default)]
    pub surface: Option<SurfaceNode>,
    #[serde(default)]
    pub attachments: Vec<AttachmentNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ShapeNode {
    SmoothUnion {
        blend: f32,
        parts: Vec<ShapeNode>,
    },
    Braid {
        strands: u32,
        twist_turns: f32,
        radius: f32,
        #[serde(default = "default_strand_r")]
        strand_radius: f32,
        /// Knots `(t, scale)`; empty = default linear taper.
        #[serde(default)]
        taper: Vec<(f32, f32)>,
    },
    Tube {
        radius: f32,
    },
    Horns {
        count: u32,
        length: f32,
        curl: f32,
        #[serde(default = "default_horn_r")]
        radius: f32,
    },
}

fn default_strand_r() -> f32 {
    0.028
}
fn default_horn_r() -> f32 {
    0.016
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ModifierNode {
    RidgedNoise {
        scale: f32,
        strength: f32,
        #[serde(default = "default_octaves")]
        octaves: u32,
    },
}

fn default_octaves() -> u32 {
    4
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum SurfaceNode {
    Layers(Vec<SurfaceLayer>),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum SurfaceLayer {
    Bark {
        cells: f32,
        roughness: f32,
    },
    Cracks {
        width: f32,
        intensity: f32,
        #[serde(default)]
        pulse: Option<PulseDef>,
    },
}

#[derive(Debug, Deserialize)]
pub struct PulseDef {
    pub speed: f32,
    pub wavelength: f32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum AttachmentNode {
    Wrap {
        region: (f32, f32),
        material: String,
        #[serde(default = "default_one")]
        strands: u32,
    },
    Ring {
        at: String,
        radius: f32,
        material: String,
    },
    Halo {
        at: String,
        radius: f32,
        #[serde(default)]
        lightning: bool,
        #[serde(default)]
        shards: u32,
    },
}

fn default_one() -> u32 {
    1
}

pub fn load_object_ron(path: &Path) -> Result<ObjectDef, ObjectError> {
    let text = fs::read_to_string(path)?;
    Ok(ron::from_str(&text)?)
}

/// Lower the graph into StaffParams for the current mesher.
pub fn object_to_staff_params(obj: &ObjectDef) -> StaffParams {
    let mut p = StaffParams::default();
    let _ = obj.seed;
    collect_shape(&obj.shape, &mut p);
    for m in &obj.modifiers {
        match m {
            ModifierNode::RidgedNoise { scale, strength, .. } => {
                p.bark_scale = *scale;
                p.bark_strength = *strength;
            }
        }
    }
    for a in &obj.attachments {
        match a {
            AttachmentNode::Wrap { region, .. } => {
                let t = (region.0 + region.1) * 0.5;
                let half = (region.1 - region.0).abs() * 0.5 * p.length;
                p.grip = Some(GripParams {
                    t,
                    half_height: half.max(0.06),
                    radius: (p.braid_radius + p.strand_radius) * 1.35,
                });
            }
            AttachmentNode::Ring { at, radius, .. } => {
                let y = if at.eq_ignore_ascii_case("bottom") {
                    -0.035
                } else {
                    p.length + 0.02
                };
                p.ring = Some(RingParams {
                    y,
                    major: (*radius * 0.6).clamp(0.04, 0.09),
                    minor: (*radius * 0.14).clamp(0.01, 0.02),
                });
            }
            AttachmentNode::Halo { at, radius, shards, .. } => {
                // Float above claw tips with an intentional air gap (pass 3).
                let y = if at.eq_ignore_ascii_case("top") {
                    crate::sdf::horns_tip_y(&p) + 0.18
                } else {
                    -0.1
                };
                p.halo = Some(HaloParams {
                    y,
                    major: (*radius * 0.2).clamp(0.08, 0.14),
                    minor: 0.022,
                    shards: (*shards).max(4),
                    shard_orbit: (*radius * 0.3).clamp(0.12, 0.2),
                });
            }
        }
    }
    p
}

fn collect_shape(node: &ShapeNode, p: &mut StaffParams) {
    match node {
        ShapeNode::SmoothUnion { blend, parts } => {
            p.blend = *blend;
            for part in parts {
                collect_shape(part, p);
            }
        }
        ShapeNode::Braid {
            strands,
            twist_turns,
            radius,
            strand_radius,
            taper,
        } => {
            p.strands = *strands;
            p.twist_turns = *twist_turns;
            p.braid_radius = *radius;
            p.strand_radius = *strand_radius;
            if !taper.is_empty() {
                p.taper = Curve {
                    knots: taper.clone(),
                };
            }
        }
        ShapeNode::Tube { radius } => {
            p.core_radius = *radius;
        }
        ShapeNode::Horns {
            count,
            length,
            curl,
            radius,
        } => {
            p.horns = Some(HornParams {
                count: *count,
                length: *length,
                curl: *curl,
                radius: *radius,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_jensen_ron_fixture() {
        let text = r#"
Object(
    seed: 1337,
    shape: SmoothUnion(blend: 0.04, parts: [
        Braid(strands: 2, twist_turns: 3.5, radius: 0.045, strand_radius: 0.028,
              taper: [(0.0, 1.0), (1.0, 0.35)]),
        Tube(radius: 0.018),
        Horns(count: 3, length: 0.22, curl: 0.55, radius: 0.016),
    ]),
    modifiers: [ RidgedNoise(scale: 9.0, strength: 0.008, octaves: 4) ],
    surface: Some(Layers([
        Bark(cells: 6.0, roughness: 0.8),
        Cracks(width: 0.08, intensity: 6.0, pulse: Some((speed: 2.0, wavelength: 1.5))),
    ])),
    attachments: [
        Wrap(region: (0.15, 0.4), material: "Leather", strands: 1),
        Ring(at: "Bottom", radius: 0.12, material: "Gold"),
        Halo(at: "Top", radius: 0.5, lightning: true, shards: 12),
    ],
)
"#;
        let obj: ObjectDef = ron::from_str(text).expect("parse");
        let p = object_to_staff_params(&obj);
        assert_eq!(p.strands, 2);
        assert!((p.twist_turns - 3.5).abs() < 1e-5);
        assert!(p.horns.is_some());
        assert!(p.grip.is_some());
        assert!(p.ring.is_some());
        assert!(p.halo.is_some());
        assert_eq!(p.halo.as_ref().unwrap().shards, 12);
    }
}
