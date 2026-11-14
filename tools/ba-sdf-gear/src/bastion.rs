// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Ashen Bastion courtyard — curtain ring, south gate, rampart walkways, interior houses.

use crate::castle::{CastleBay, CastleModule};
use crate::house::{HouseKind, HouseParams};
use serde::Serialize;

/// Instance transform in world metres (yard floor y = 0 in layout; writer lifts by yard stand).
#[derive(Clone, Debug, Serialize)]
pub struct Placement {
    pub mesh: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub sx: f32,
    pub sy: f32,
    pub sz: f32,
}

#[derive(Clone, Debug)]
pub struct BastionConfig {
    /// Outer wall span east–west (metres). Matches heightfield curtain (±56 → 112).
    pub span_x: f32,
    /// Outer wall span north–south (metres). Matches curtain z −14..50 → 64.
    pub span_z: f32,
    /// World origin of the courtyard centre (curtain mid).
    pub origin_x: f32,
    pub origin_z: f32,
    /// Rampart deck height above yard floor (AB_RAMPART_Y − AB_YARD_Y = 3.2).
    pub walk_y: f32,
    pub module: CastleModule,
    pub house: HouseParams,
}

impl Default for BastionConfig {
    fn default() -> Self {
        Self {
            span_x: 112.0,
            span_z: 64.0,
            origin_x: 0.0,
            origin_z: 18.0,
            walk_y: 3.2,
            module: CastleModule::default(),
            house: HouseParams::default(),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct BastionLayoutStats {
    pub curtain_bays: u32,
    pub gates: u32,
    pub houses: u32,
    pub walkways: u32,
}

#[derive(Clone, Debug)]
pub struct BastionLayout {
    pub placements: Vec<Placement>,
    pub stats: BastionLayoutStats,
}

/// Courtyard house instances: (x, z, yaw, kind).
/// Centres align with expanded `AB_HOUSE_PADS` in ashen-bastion.ts.
/// Doors face inward streets / yard (yaw rotates local +Z door).
const HOUSE_PLACES: &[(f32, f32, f32, HouseKind)] = &[
    // West inner wall — doors face +X (courtyard).
    (-48.0, 10.0, -std::f32::consts::FRAC_PI_2, HouseKind::TimberL),
    (-48.0, 22.0, -std::f32::consts::FRAC_PI_2, HouseKind::Overhang),
    (-48.0, 34.0, -std::f32::consts::FRAC_PI_2, HouseKind::StoneGable),
    // West mid street — workshop + shed cluster (market feel).
    (-34.0, 10.0, -std::f32::consts::FRAC_PI_2, HouseKind::Workshop),
    (-34.0, 34.0, -std::f32::consts::FRAC_PI_2, HouseKind::Shed),
    (-28.0, 22.0, std::f32::consts::PI, HouseKind::Overhang),
    // East mid street — doors face −X.
    (28.0, 10.0, std::f32::consts::FRAC_PI_2, HouseKind::Overhang),
    (34.0, 22.0, 0.0, HouseKind::Shed),
    (34.0, 34.0, std::f32::consts::FRAC_PI_2, HouseKind::Workshop),
    // East inner wall.
    (48.0, 12.0, std::f32::consts::FRAC_PI_2, HouseKind::TimberL),
    (48.0, 24.0, std::f32::consts::FRAC_PI_2, HouseKind::Overhang),
    (48.0, 36.0, std::f32::consts::FRAC_PI_2, HouseKind::StoneGable),
    // North curtain (south of keep pads) — doors face −Z into yard.
    (-20.0, 44.0, std::f32::consts::PI, HouseKind::Overhang),
    (20.0, 44.0, std::f32::consts::PI, HouseKind::Shed),
    // South-east / south-west yard corners (clear of gate ±x); doors +Z.
    (-40.0, 0.0, 0.0, HouseKind::Shed),
    (40.0, 0.0, 0.0, HouseKind::StoneGable),
];

/// Bay origins along an axis from `start` to `end` (exclusive of duplicate corner post).
fn wall_bays_along(
    out: &mut Vec<Placement>,
    mesh: &str,
    start: f32,
    end: f32,
    fixed: f32,
    axis: char,
    yaw: f32,
    pitch: f32,
    bays: &[CastleBay],
    ox: f32,
    oz: f32,
) {
    let len = (end - start).abs();
    let n_fit = (len / pitch).floor() as usize;
    let n = n_fit.max(1).min(bays.len());
    let used_len = (n as f32 - 1.0).max(0.0) * pitch;
    let margin = (len - used_len) * 0.5;
    let dir = if end >= start { 1.0 } else { -1.0 };
    let origin0 = start + dir * margin;

    for (i, bay) in bays.iter().take(n).enumerate() {
        let along = origin0 + dir * (i as f32) * pitch;
        let mesh_name = match bay {
            CastleBay::Curtain => mesh.to_string(),
            CastleBay::Gate { .. } => "gatehouse".to_string(),
        };
        let (x, z) = match axis {
            'x' => (along, fixed),
            'z' => (fixed, along),
            _ => (along, fixed),
        };
        out.push(Placement {
            mesh: mesh_name,
            x: x + ox,
            y: 0.0,
            z: z + oz,
            yaw,
            sx: 1.0,
            sy: 1.0,
            sz: 1.0,
        });
    }
}

fn walk_bays_along(
    out: &mut Vec<Placement>,
    start: f32,
    end: f32,
    fixed: f32,
    axis: char,
    yaw: f32,
    pitch: f32,
    y: f32,
    ox: f32,
    oz: f32,
    inset: f32,
) {
    let len = (end - start).abs();
    let n = ((len / pitch).floor() as usize).max(1);
    let used_len = (n as f32 - 1.0).max(0.0) * pitch;
    let margin = (len - used_len) * 0.5;
    let dir = if end >= start { 1.0 } else { -1.0 };
    let origin0 = start + dir * margin;
    // Inset toward courtyard so the deck sits on the Vigil Walk strip.
    let (fx, fz) = match axis {
        'x' => (0.0, inset),
        'z' => (inset, 0.0),
        _ => (0.0, inset),
    };
    for i in 0..n {
        let along = origin0 + dir * (i as f32) * pitch;
        let (x, z) = match axis {
            'x' => (along, fixed + fz),
            'z' => (fixed + fx, along),
            _ => (along, fixed + fz),
        };
        out.push(Placement {
            mesh: "walkway".to_string(),
            x: x + ox,
            y,
            z: z + oz,
            yaw,
            sx: 1.0,
            sy: 1.0,
            sz: 1.0,
        });
    }
}

/// Half-span of the wide south gatehouse (towers + arch) — skip curtains inside this.
fn gate_footprint_half(cfg: &BastionConfig) -> f32 {
    let g = cfg.module.to_gatehouse(1.0);
    g.tower_sep + g.tower_r * 1.15 + 0.35
}

/// Build perimeter placements: south gate on −Z face; courtyard at `origin_*`.
pub fn bastion_layout(cfg: &BastionConfig) -> BastionLayout {
    let pitch = cfg.module.pitch();
    let hx = cfg.span_x * 0.5;
    let hz = cfg.span_z * 0.5;
    let ox = cfg.origin_x;
    let oz = cfg.origin_z;
    let mut placements = Vec::new();
    let mut stats = BastionLayoutStats::default();

    // South twin-tower gate centred on approach axis (x≈0), doors fully open.
    placements.push(Placement {
        mesh: "gatehouse".to_string(),
        x: ox,
        y: 0.0,
        z: -hz + oz,
        yaw: std::f32::consts::PI,
        sx: 1.0,
        sy: 1.0,
        sz: 1.0,
    });
    stats.gates += 1;

    // South curtains on pitch, skipping the wide gatehouse footprint around x≈0.
    let gate_half = gate_footprint_half(cfg);
    {
        let len = cfg.span_x;
        let n = ((len / pitch).floor() as usize).max(1);
        let used_len = (n as f32 - 1.0).max(0.0) * pitch;
        let margin = (len - used_len) * 0.5;
        let origin0 = -hx + margin;
        for i in 0..n {
            let along = origin0 + (i as f32) * pitch;
            if (along + ox).abs() < gate_half {
                continue;
            }
            placements.push(Placement {
                mesh: "curtain".to_string(),
                x: along + ox,
                y: 0.0,
                z: -hz + oz,
                yaw: std::f32::consts::PI,
                sx: 1.0,
                sy: 1.0,
                sz: 1.0,
            });
            stats.curtain_bays += 1;
        }
    }

    let north_n = ((cfg.span_x / pitch).round() as usize).max(3);
    let north_bays = vec![CastleBay::Curtain; north_n];
    wall_bays_along(
        &mut placements,
        "curtain",
        -hx,
        hx,
        hz,
        'x',
        0.0,
        pitch,
        &north_bays,
        ox,
        oz,
    );
    stats.curtain_bays += north_n as u32;

    let east_n = (cfg.span_z / pitch).round() as usize;
    let east_n = east_n.max(3);
    let east_bays = vec![CastleBay::Curtain; east_n];
    wall_bays_along(
        &mut placements,
        "curtain",
        -hz,
        hz,
        hx,
        'z',
        -std::f32::consts::FRAC_PI_2,
        pitch,
        &east_bays,
        ox,
        oz,
    );
    stats.curtain_bays += east_n as u32;

    let west_bays = vec![CastleBay::Curtain; east_n];
    wall_bays_along(
        &mut placements,
        "curtain",
        -hz,
        hz,
        -hx,
        'z',
        std::f32::consts::FRAC_PI_2,
        pitch,
        &west_bays,
        ox,
        oz,
    );
    stats.curtain_bays += east_n as u32;

    // Vigil Walk — SDF decks inset along the inner curtain face (thicker 3× walls).
    let walk_inset = 2.45;
    let before = placements.len();
    // South inner: place decks then drop those over the gate clear.
    {
        let walk_before = placements.len();
        walk_bays_along(
            &mut placements,
            -hx + pitch,
            hx - pitch,
            -hz,
            'x',
            std::f32::consts::PI,
            pitch,
            cfg.walk_y,
            ox,
            oz,
            walk_inset,
        );
        placements.retain(|p| {
            !(p.mesh == "walkway"
                && (p.z - (-hz + oz + walk_inset)).abs() < 0.05
                && p.x.abs() < gate_half)
        });
        let _ = walk_before;
    }
    walk_bays_along(
        &mut placements,
        -hx + pitch,
        hx - pitch,
        hz,
        'x',
        0.0,
        pitch,
        cfg.walk_y,
        ox,
        oz,
        -walk_inset,
    );
    walk_bays_along(
        &mut placements,
        -hz + pitch,
        hz - pitch,
        hx,
        'z',
        -std::f32::consts::FRAC_PI_2,
        pitch,
        cfg.walk_y,
        ox,
        oz,
        -walk_inset,
    );
    walk_bays_along(
        &mut placements,
        -hz + pitch,
        hz - pitch,
        -hx,
        'z',
        std::f32::consts::FRAC_PI_2,
        pitch,
        cfg.walk_y,
        ox,
        oz,
        walk_inset,
    );
    stats.walkways += (placements.len() - before) as u32;

    for &(x, z, yaw, kind) in HOUSE_PLACES {
        placements.push(Placement {
            mesh: kind.mesh_name().to_string(),
            x,
            y: 0.0,
            z,
            yaw,
            sx: 1.0,
            sy: 1.0,
            sz: 1.0,
        });
        stats.houses += 1;
    }

    BastionLayout { placements, stats }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bastion_has_gate_houses_walkways() {
        let layout = bastion_layout(&BastionConfig::default());
        assert!(layout.stats.gates >= 1, "need at least one gate");
        assert!(layout.stats.houses >= 12, "houses={}", layout.stats.houses);
        let kinds = [
            "house_l",
            "house_tall",
            "house_workshop",
            "house_shed",
            "house_stone",
        ];
        for name in kinds {
            assert!(
                layout.placements.iter().any(|p| p.mesh == name),
                "missing mesh {name}"
            );
        }
        assert!(
            layout.stats.walkways >= 8,
            "walkways={}",
            layout.stats.walkways
        );
        // Pitch 7.92 → ~14 bays/long side, ~8/short; fewer than the old 2.64 kit.
        assert!(
            layout.stats.curtain_bays >= 28 && layout.stats.curtain_bays <= 55,
            "curtains={}",
            layout.stats.curtain_bays
        );
        let gate_count = layout
            .placements
            .iter()
            .filter(|p| p.mesh == "gatehouse")
            .count();
        assert!(gate_count >= 1);
        // South gate on curtain south (−14) centred on approach (x≈0).
        let gate = layout
            .placements
            .iter()
            .find(|p| p.mesh == "gatehouse")
            .unwrap();
        assert!((gate.z - (-14.0)).abs() < 0.05, "gate z={}", gate.z);
        assert!(gate.x.abs() < 0.05, "gate x={}", gate.x);
        let near_gate_curtain = layout.placements.iter().any(|p| {
            p.mesh == "curtain" && p.z < 0.0 && p.x.abs() < 3.0
        });
        assert!(!near_gate_curtain, "curtain must not overlap gate arch");
    }
}
