// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;

use crate::sdf::StaffParams;

/// BAM1 binary mesh bank for BA-Stick (`mesh_bank.rs`):
/// ```text
/// magic "BAM1" | u32 mesh_count
/// per mesh: u32 vert_count | u32 tri_count
///   verts: vert_count × { f32 x,y,z | u8 palette | u8[3] pad }
///   indices: tri_count×3 × u32
/// u32 place_count
/// per place: u32 mesh_index | f32 x,y,z,yaw,sx,sy,sz
/// ```
#[derive(Clone, Debug)]
pub struct BamPlacement {
    pub mesh: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub sx: f32,
    pub sy: f32,
    pub sz: f32,
}

/// Stone wall palette index in ba-stick-render (`WALL` = 119).
pub const BAM_PALETTE_STONE: u8 = 119;
/// Lighter stone (`WALL_L` = 120).
pub const BAM_PALETTE_STONE_L: u8 = 120;
/// Wood mid (`WOOD` = 123).
pub const BAM_PALETTE_WOOD: u8 = 123;

pub fn write_bam1(path: &Path, meshes: &[MeshData]) -> std::io::Result<()> {
    write_bam1_with_places(path, meshes, &[])
}

pub fn write_bam1_with_places(
    path: &Path,
    meshes: &[MeshData],
    places: &[BamPlacement],
) -> std::io::Result<()> {
    let mut w = BufWriter::new(File::create(path)?);
    w.write_all(b"BAM1")?;
    write_u32(&mut w, meshes.len() as u32)?;
    for mesh in meshes {
        let vert_count = mesh.positions.len() as u32;
        let tri_count = (mesh.indices.len() / 3) as u32;
        write_u32(&mut w, vert_count)?;
        write_u32(&mut w, tri_count)?;
        for (i, p) in mesh.positions.iter().enumerate() {
            write_f32(&mut w, p[0])?;
            write_f32(&mut w, p[1])?;
            write_f32(&mut w, p[2])?;
            let heat = mesh.heats.get(i).copied().unwrap_or(0.35);
            let pal = if heat < 0.2 {
                BAM_PALETTE_WOOD
            } else if heat > 0.65 {
                BAM_PALETTE_STONE_L
            } else {
                BAM_PALETTE_STONE
            };
            w.write_all(&[pal, 0, 0, 0])?;
        }
        for idx in &mesh.indices {
            write_u32(&mut w, *idx)?;
        }
    }
    write_u32(&mut w, places.len() as u32)?;
    for p in places {
        write_u32(&mut w, p.mesh)?;
        write_f32(&mut w, p.x)?;
        write_f32(&mut w, p.y)?;
        write_f32(&mut w, p.z)?;
        write_f32(&mut w, p.yaw)?;
        write_f32(&mut w, p.sx)?;
        write_f32(&mut w, p.sy)?;
        write_f32(&mut w, p.sz)?;
    }
    w.flush()
}

fn write_u32(w: &mut impl Write, v: u32) -> std::io::Result<()> {
    w.write_all(&v.to_le_bytes())
}

fn write_f32(w: &mut impl Write, v: f32) -> std::io::Result<()> {
    w.write_all(&v.to_le_bytes())
}

#[derive(Clone, Debug, Default)]
pub struct MeshData {
    pub positions: Vec<[f32; 3]>,
    pub normals: Vec<[f32; 3]>,
    pub indices: Vec<u32>,
    /// Per-vertex heat / material attribute 0..1.
    pub heats: Vec<f32>,
    /// Optional explicit RGB (overrides heat_rgb when writing OBJ).
    pub colors: Option<Vec<[f32; 3]>>,
}

fn heat_rgb(h: f32) -> [f32; 3] {
    // Charred bark → amber ribbon → white-hot core (reference magma).
    let h = h.clamp(0.0, 1.0);
    if h < 0.1 {
        let u = h / 0.1;
        [0.03 + 0.05 * u, 0.02 + 0.02 * u, 0.015]
    } else if h < 0.45 {
        let u = (h - 0.1) / 0.35;
        [0.08 + 0.92 * u, 0.03 + 0.38 * u, 0.01 + 0.03 * u]
    } else if h < 0.75 {
        let u = (h - 0.45) / 0.3;
        [1.0, 0.48 + 0.32 * u, 0.05 + 0.2 * u]
    } else {
        let u = (h - 0.75) / 0.25;
        [1.0, 0.8 + 0.2 * u, 0.25 + 0.7 * u]
    }
}

/// Wavefront OBJ with vertex colors (Meshlab / Blender / three.js compatible).
pub fn write_obj(path: &Path, mesh: &MeshData) -> std::io::Result<()> {
    let f = File::create(path)?;
    let mut w = BufWriter::new(f);
    writeln!(w, "# ba-sdf-gear")?;
    writeln!(w, "# verts={} tris={}", mesh.positions.len(), mesh.indices.len() / 3)?;
    for (i, p) in mesh.positions.iter().enumerate() {
        let c = if let Some(ref cols) = mesh.colors {
            cols.get(i).copied().unwrap_or([0.5, 0.5, 0.5])
        } else {
            heat_rgb(mesh.heats.get(i).copied().unwrap_or(0.0))
        };
        writeln!(
            w,
            "v {} {} {} {} {} {}",
            p[0], p[1], p[2], c[0], c[1], c[2]
        )?;
    }
    for n in &mesh.normals {
        writeln!(w, "vn {} {} {}", n[0], n[1], n[2])?;
    }
    for tri in mesh.indices.chunks_exact(3) {
        // OBJ is 1-based; include normals.
        let a = tri[0] + 1;
        let b = tri[1] + 1;
        let c = tri[2] + 1;
        writeln!(w, "f {a}//{a} {b}//{b} {c}//{c}")?;
    }
    Ok(())
}

/// Temporary Stick Engine gear RON: decimated surface discs in hand frame.
///
/// Stick has no triangle meshes — this is a preview stand-in so the SDF staff
/// can be equipped in-game. Capsule RON remains the production path until accept.
pub fn write_stick_disc_ron(
    path: &Path,
    mesh: &MeshData,
    params: &StaffParams,
    cell: f32,
) -> std::io::Result<()> {
    let grip_y = params
        .grip
        .as_ref()
        .map(|g| g.t * params.length)
        .unwrap_or(params.length * 0.28);
    // Fit SDF height into the existing staff hand span (~pommel -0.9 → halo +1.0).
    let sdf_span = params
        .halo
        .as_ref()
        .map(|h| h.y + 0.08)
        .unwrap_or(params.length + 0.3)
        + 0.1;
    let scale = 1.9 / sdf_span.max(1.0);

    let cell = cell.max(0.02);
    let inv = 1.0 / cell;
    let mut best: HashMap<(i32, i32, i32), (usize, f32)> = HashMap::new();
    for (i, p) in mesh.positions.iter().enumerate() {
        let h = mesh.heats.get(i).copied().unwrap_or(0.0);
        let key = (
            (p[0] * inv).floor() as i32,
            (p[1] * inv).floor() as i32,
            (p[2] * inv).floor() as i32,
        );
        match best.get(&key) {
            Some(&(_, old_h)) if old_h >= h => {}
            _ => {
                best.insert(key, (i, h));
            }
        }
    }

    let mut pts: Vec<(f32, f32, f32, f32)> = best
        .values()
        .map(|&(i, h)| {
            let p = mesh.positions[i];
            let sx = p[0] * scale;
            let sy = (p[1] - grip_y) * scale;
            let sz = p[2] * scale;
            (sx, sy, sz, h)
        })
        .collect();
    // Prefer hot / extreme points when still dense.
    pts.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));
    const MAX_DISCS: usize = 720;
    if pts.len() > MAX_DISCS {
        pts.truncate(MAX_DISCS);
    }

    let f = File::create(path)?;
    let mut w = BufWriter::new(f);
    writeln!(
        w,
        "// TEMPORARY SDF preview disc-cloud for Jensen's Huang — NOT the accepted capsule art."
    )?;
    writeln!(
        w,
        "// Generated by ba-sdf-gear to-stick. Restore capsule from backups/jensens-huang-2026-11-13/ or ba_jensens_huang.capsule.ron"
    )?;
    writeln!(
        w,
        "// Copyright (c) 2026 Black Anvil Network\n// SPDX-License-Identifier: AGPL-3.0-or-later"
    )?;
    writeln!(
        w,
        "(\n    id: \"ba_jensens_huang\",\n    slot: MainHand,\n    attach: Some(\"r_hand\"),\n    stance: Some(\"staff\"),\n    reach: 0.95,\n    swing_weight: 1.35,\n    material: Some(\"dust\"),\n    shapes: ["
    )?;
    for (x, y, z, h) in &pts {
        let (ramp, r) = if *h < 0.14 {
            ("Material", 0.016)
        } else if *h < 0.55 {
            ("Glow", 0.014)
        } else {
            ("Trim", 0.015)
        };
        writeln!(
            w,
            "        Disc(at: None, center: ({x:.5}, {y:.5}, {z:.5}), r: {r}, ramp: {ramp}),"
        )?;
    }
    writeln!(w, "    ],\n)")?;
    Ok(())
}
