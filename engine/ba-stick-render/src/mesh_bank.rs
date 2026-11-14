// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! BAM1 — Spike-0 static triangle meshes from the SDF pipeline.
//!
//! ```text
//! magic "BAM1"
//! u32 mesh_count
//! for each mesh:
//!   u32 vert_count
//!   u32 tri_count   (triangle count; indices = tri_count * 3)
//!   verts: vert_count × { f32 x, f32 y, f32 z, u8 palette, u8[3] pad }
//!   indices: tri_count × 3 × u32
//! u32 place_count
//! for each place:
//!   u32 mesh_index
//!   f32 x, y, z, yaw, sx, sy, sz
//! ```
//!
//! Drawn with the same depth-tested iso triangles as procedural props.

use stick_engine::camera::{Camera, P2};
use stick_engine::math::v3;
use stick_engine::raster::Framebuffer;

use crate::props;

#[derive(Clone, Debug)]
pub struct Mesh {
    pub positions: Vec<[f32; 3]>,
    pub colors: Vec<u8>,
    pub indices: Vec<u32>,
}

#[derive(Clone, Debug)]
pub struct Placement {
    pub mesh: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub sx: f32,
    pub sy: f32,
    pub sz: f32,
}

#[derive(Clone, Debug, Default)]
pub struct MeshBank {
    pub meshes: Vec<Mesh>,
    pub places: Vec<Placement>,
}

fn read_u32(bytes: &[u8], o: &mut usize) -> Result<u32, String> {
    if *o + 4 > bytes.len() {
        return Err("truncated BAM1".into());
    }
    let v = u32::from_le_bytes(bytes[*o..*o + 4].try_into().unwrap());
    *o += 4;
    Ok(v)
}

fn read_f32(bytes: &[u8], o: &mut usize) -> Result<f32, String> {
    if *o + 4 > bytes.len() {
        return Err("truncated BAM1".into());
    }
    let v = f32::from_le_bytes(bytes[*o..*o + 4].try_into().unwrap());
    *o += 4;
    Ok(v)
}

pub fn parse(bytes: &[u8]) -> Result<MeshBank, String> {
    if bytes.len() < 8 || &bytes[..4] != b"BAM1" {
        return Err("not a BAM1 mesh bank".into());
    }
    let mut o = 4;
    let mesh_count = read_u32(bytes, &mut o)? as usize;
    let mut meshes = Vec::with_capacity(mesh_count);
    for _ in 0..mesh_count {
        let vc = read_u32(bytes, &mut o)? as usize;
        let tc = read_u32(bytes, &mut o)? as usize;
        let vert_bytes = vc * 16;
        let idx_bytes = tc * 3 * 4;
        if o + vert_bytes + idx_bytes > bytes.len() {
            return Err("truncated BAM1 mesh".into());
        }
        let mut positions = Vec::with_capacity(vc);
        let mut colors = Vec::with_capacity(vc);
        for _ in 0..vc {
            let x = read_f32(bytes, &mut o)?;
            let y = read_f32(bytes, &mut o)?;
            let z = read_f32(bytes, &mut o)?;
            let col = bytes[o];
            o += 4; // palette + 3 pad
            positions.push([x, y, z]);
            colors.push(col);
        }
        let mut indices = Vec::with_capacity(tc * 3);
        for _ in 0..tc * 3 {
            indices.push(read_u32(bytes, &mut o)?);
        }
        meshes.push(Mesh {
            positions,
            colors,
            indices,
        });
    }
    let place_count = read_u32(bytes, &mut o)? as usize;
    let mut places = Vec::with_capacity(place_count);
    for _ in 0..place_count {
        let mesh = read_u32(bytes, &mut o)?;
        let x = read_f32(bytes, &mut o)?;
        let y = read_f32(bytes, &mut o)?;
        let z = read_f32(bytes, &mut o)?;
        let yaw = read_f32(bytes, &mut o)?;
        let sx = read_f32(bytes, &mut o)?;
        let sy = read_f32(bytes, &mut o)?;
        let sz = read_f32(bytes, &mut o)?;
        places.push(Placement {
            mesh,
            x,
            y,
            z,
            yaw,
            sx,
            sy,
            sz,
        });
    }
    Ok(MeshBank { meshes, places })
}

fn transform_point(p: [f32; 3], place: &Placement) -> (f32, f32, f32) {
    let (sx, sy, sz) = (place.sx, place.sy, place.sz);
    let c = place.yaw.cos();
    let s = place.yaw.sin();
    let lx = p[0] * sx;
    let ly = p[1] * sy;
    let lz = p[2] * sz;
    let wx = place.x + c * lx + s * lz;
    let wy = place.y + ly;
    let wz = place.z - s * lx + c * lz;
    (wx, wy, wz)
}

fn project(cam: &Camera, x: f32, y: f32, z: f32) -> P2 {
    cam.project(v3(x, y, z))
}

/// Draw every placement. Skips meshes whose AABB is outside the iso view box.
pub fn draw(fb: &mut Framebuffer, cam: &Camera, cam_y: f32, bank: &MeshBank) {
    if bank.places.is_empty() || bank.meshes.is_empty() {
        return;
    }
    let (vx0, vx1, vz0, vz1) = props::iso_view_box(cam);
    for place in &bank.places {
        let Some(mesh) = bank.meshes.get(place.mesh as usize) else {
            continue;
        };
        // Cheap reject: placement origin ± scaled radius (curtain bays span ~8 m).
        let r = 12.0 * place.sx.max(place.sz).max(1.0);
        if place.x + r < vx0 || place.x - r > vx1 || place.z + r < vz0 || place.z - r > vz1 {
            continue;
        }
        for tri in mesh.indices.chunks_exact(3) {
            let ia = tri[0] as usize;
            let ib = tri[1] as usize;
            let ic = tri[2] as usize;
            if ia >= mesh.positions.len() || ib >= mesh.positions.len() || ic >= mesh.positions.len() {
                continue;
            }
            let (ax, ay, az) = transform_point(mesh.positions[ia], place);
            let (bx, by, bz) = transform_point(mesh.positions[ib], place);
            let (cx, cy, cz) = transform_point(mesh.positions[ic], place);
            let a = project(cam, ax, ay - cam_y, az);
            let b = project(cam, bx, by - cam_y, bz);
            let c = project(cam, cx, cy - cam_y, cz);
            let col = mesh.colors.get(ia).copied().unwrap_or(116);
            props::tri(fb, a, b, c, col);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_bank() -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(b"BAM1");
        out.extend_from_slice(&1u32.to_le_bytes()); // mesh_count
        out.extend_from_slice(&3u32.to_le_bytes()); // verts
        out.extend_from_slice(&1u32.to_le_bytes()); // tris
        for (x, y, z, col) in [
            (0.0f32, 0.0f32, 0.0f32, 10u8),
            (1.0, 0.0, 0.0, 10),
            (0.0, 1.0, 0.0, 11),
        ] {
            out.extend_from_slice(&x.to_le_bytes());
            out.extend_from_slice(&y.to_le_bytes());
            out.extend_from_slice(&z.to_le_bytes());
            out.push(col);
            out.extend_from_slice(&[0, 0, 0]);
        }
        for i in [0u32, 1, 2] {
            out.extend_from_slice(&i.to_le_bytes());
        }
        out.extend_from_slice(&1u32.to_le_bytes()); // places
        out.extend_from_slice(&0u32.to_le_bytes());
        for f in [2.0f32, 0.0, 3.0, 0.0, 1.0, 1.0, 1.0] {
            out.extend_from_slice(&f.to_le_bytes());
        }
        out
    }

    #[test]
    fn bam1_round_trip_counts() {
        let bank = parse(&sample_bank()).expect("parse");
        assert_eq!(bank.meshes.len(), 1);
        assert_eq!(bank.meshes[0].positions.len(), 3);
        assert_eq!(bank.meshes[0].indices.len(), 3);
        assert_eq!(bank.places.len(), 1);
        assert_eq!(bank.places[0].x, 2.0);
        assert_eq!(bank.places[0].z, 3.0);
    }
}
