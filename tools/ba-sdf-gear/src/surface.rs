// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Sample an SDF on a padded grid and extract a mesh with surface nets.

use crate::mesh::MeshData;
use crate::sdf::{heat_at, staff_sdf, StaffParams};
use fast_surface_nets::ndshape::{ConstShape, ConstShape3u32};
use fast_surface_nets::{surface_nets, SurfaceNetsBuffer};
use glam::Vec3;

/// Default padded chunk resolution (interior RES^3 + 1-voxel border → RES+2).
const RES: u32 = 112;
/// Higher grid for architecture fixtures.
const RES_HI: u32 = 144;
/// Playable zone bank — CPU triangle draw; keep denser only for OBJ previews.
const RES_PLAY: u32 = 40;
/// Courtyard house archetypes — many instances; keep tris modest.
const RES_COARSE: u32 = 28;
type ChunkShape = ConstShape3u32<{ RES + 2 }, { RES + 2 }, { RES + 2 }>;
type ChunkShapeHi = ConstShape3u32<{ RES_HI + 2 }, { RES_HI + 2 }, { RES_HI + 2 }>;
type ChunkShapePlay = ConstShape3u32<{ RES_PLAY + 2 }, { RES_PLAY + 2 }, { RES_PLAY + 2 }>;
type ChunkShapeCoarse = ConstShape3u32<{ RES_COARSE + 2 }, { RES_COARSE + 2 }, { RES_COARSE + 2 }>;

pub struct MeshOptions {
    /// World AABB min (x,y,z).
    pub min: Vec3,
    /// World AABB max (x,y,z).
    pub max: Vec3,
    /// Time for heat pulse attribute bake.
    pub time: f32,
    /// Grid resolution along each axis (`<45` → coarse 28, `<80` → play 40, `≥144` → hi 144, else 112).
    pub res: u32,
}

impl Default for MeshOptions {
    fn default() -> Self {
        Self {
            min: Vec3::new(-0.32, -0.16, -0.32),
            max: Vec3::new(0.32, 2.55, 0.32),
            time: 0.0,
            res: RES,
        }
    }
}

/// Mesh an arbitrary SDF field with a per-vertex attribute (heat / material).
pub fn mesh_field(
    sdf: impl Fn(Vec3) -> f32,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
) -> MeshData {
    if opts.res >= RES_HI {
        extract_hi(sdf, attr, opts)
    } else if opts.res < 45 {
        extract_coarse(sdf, attr, opts)
    } else if opts.res < 80 {
        extract_play(sdf, attr, opts)
    } else {
        extract_lo(sdf, attr, opts)
    }
}

fn finish(
    buffer: &SurfaceNetsBuffer,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
    inv: Vec3,
) -> MeshData {
    let mut positions = Vec::with_capacity(buffer.positions.len());
    let mut normals = Vec::with_capacity(buffer.normals.len());
    let mut heats = Vec::with_capacity(buffer.positions.len());

    for (i, pos) in buffer.positions.iter().enumerate() {
        let voxel = Vec3::new(pos[0], pos[1], pos[2]);
        let world = opts.min
            + Vec3::new(
                (voxel.x - 1.0) / inv.x,
                (voxel.y - 1.0) / inv.y,
                (voxel.z - 1.0) / inv.z,
            );
        positions.push([world.x, world.y, world.z]);
        let n = buffer.normals.get(i).copied().unwrap_or([0.0, 1.0, 0.0]);
        normals.push(n);
        heats.push(attr(world));
    }

    MeshData {
        positions,
        normals,
        indices: buffer.indices.clone(),
        heats,
        colors: None,
    }
}

fn extract_coarse(
    sdf: impl Fn(Vec3) -> f32,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
) -> MeshData {
    let extent = opts.max - opts.min;
    let inv = Vec3::new(
        (RES_COARSE as f32) / extent.x.max(1e-6),
        (RES_COARSE as f32) / extent.y.max(1e-6),
        (RES_COARSE as f32) / extent.z.max(1e-6),
    );
    let mut field = vec![1.0f32; ChunkShapeCoarse::USIZE];
    for i in 0u32..ChunkShapeCoarse::SIZE {
        let [ix, iy, iz] = ChunkShapeCoarse::delinearize(i);
        let p = opts.min
            + Vec3::new(
                (ix as f32 - 1.0) / inv.x,
                (iy as f32 - 1.0) / inv.y,
                (iz as f32 - 1.0) / inv.z,
            );
        field[i as usize] = sdf(p);
    }
    let mut buffer = SurfaceNetsBuffer::default();
    surface_nets(
        &field,
        &ChunkShapeCoarse {},
        [0; 3],
        [RES_COARSE + 1, RES_COARSE + 1, RES_COARSE + 1],
        &mut buffer,
    );
    finish(&buffer, attr, opts, inv)
}

fn extract_play(
    sdf: impl Fn(Vec3) -> f32,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
) -> MeshData {
    let extent = opts.max - opts.min;
    let inv = Vec3::new(
        (RES_PLAY as f32) / extent.x.max(1e-6),
        (RES_PLAY as f32) / extent.y.max(1e-6),
        (RES_PLAY as f32) / extent.z.max(1e-6),
    );
    let mut field = vec![1.0f32; ChunkShapePlay::USIZE];
    for i in 0u32..ChunkShapePlay::SIZE {
        let [ix, iy, iz] = ChunkShapePlay::delinearize(i);
        let p = opts.min
            + Vec3::new(
                (ix as f32 - 1.0) / inv.x,
                (iy as f32 - 1.0) / inv.y,
                (iz as f32 - 1.0) / inv.z,
            );
        field[i as usize] = sdf(p);
    }
    let mut buffer = SurfaceNetsBuffer::default();
    surface_nets(
        &field,
        &ChunkShapePlay {},
        [0; 3],
        [RES_PLAY + 1, RES_PLAY + 1, RES_PLAY + 1],
        &mut buffer,
    );
    finish(&buffer, attr, opts, inv)
}

fn extract_lo(
    sdf: impl Fn(Vec3) -> f32,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
) -> MeshData {
    let extent = opts.max - opts.min;
    let inv = Vec3::new(
        (RES as f32) / extent.x.max(1e-6),
        (RES as f32) / extent.y.max(1e-6),
        (RES as f32) / extent.z.max(1e-6),
    );
    let mut field = vec![1.0f32; ChunkShape::USIZE];
    for i in 0u32..ChunkShape::SIZE {
        let [ix, iy, iz] = ChunkShape::delinearize(i);
        let p = opts.min
            + Vec3::new(
                (ix as f32 - 1.0) / inv.x,
                (iy as f32 - 1.0) / inv.y,
                (iz as f32 - 1.0) / inv.z,
            );
        field[i as usize] = sdf(p);
    }
    let mut buffer = SurfaceNetsBuffer::default();
    surface_nets(
        &field,
        &ChunkShape {},
        [0; 3],
        [RES + 1, RES + 1, RES + 1],
        &mut buffer,
    );
    finish(&buffer, attr, opts, inv)
}

fn extract_hi(
    sdf: impl Fn(Vec3) -> f32,
    attr: impl Fn(Vec3) -> f32,
    opts: &MeshOptions,
) -> MeshData {
    let extent = opts.max - opts.min;
    let inv = Vec3::new(
        (RES_HI as f32) / extent.x.max(1e-6),
        (RES_HI as f32) / extent.y.max(1e-6),
        (RES_HI as f32) / extent.z.max(1e-6),
    );
    let mut field = vec![1.0f32; ChunkShapeHi::USIZE];
    for i in 0u32..ChunkShapeHi::SIZE {
        let [ix, iy, iz] = ChunkShapeHi::delinearize(i);
        let p = opts.min
            + Vec3::new(
                (ix as f32 - 1.0) / inv.x,
                (iy as f32 - 1.0) / inv.y,
                (iz as f32 - 1.0) / inv.z,
            );
        field[i as usize] = sdf(p);
    }
    let mut buffer = SurfaceNetsBuffer::default();
    surface_nets(
        &field,
        &ChunkShapeHi {},
        [0; 3],
        [RES_HI + 1, RES_HI + 1, RES_HI + 1],
        &mut buffer,
    );
    finish(&buffer, attr, opts, inv)
}

/// Mesh a staff SDF. Positions are in metres (same frame as Stick hand +y shaft).
pub fn mesh_sdf(params: &StaffParams, opts: &MeshOptions) -> MeshData {
    mesh_field(
        |p| staff_sdf(p, params),
        |p| heat_at(p, params, opts.time),
        opts,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sdf::StaffParams;

    #[test]
    fn meshing_produces_triangles() {
        let params = StaffParams::default();
        let mesh = mesh_sdf(&params, &MeshOptions::default());
        assert!(!mesh.indices.is_empty(), "expected triangles");
        assert!(mesh.positions.len() > 100, "expected a real silhouette");
        assert_eq!(mesh.heats.len(), mesh.positions.len());
    }
}
