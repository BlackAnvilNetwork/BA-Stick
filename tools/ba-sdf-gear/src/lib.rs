// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Headless SDF Object pipeline. No Bevy — field, extract, export.

pub mod bastion;
pub mod castle;
pub mod gatehouse;
pub mod house;
pub mod mesh;
pub mod object;
pub mod sdf;
pub mod surface;
pub mod walkway;

pub use bastion::{bastion_layout, BastionConfig, BastionLayout, Placement};
pub use castle::{
    castle_wall_bounds, castle_wall_mat, castle_wall_sdf, curtain_stone_rgb, curtain_wall_mat,
    curtain_wall_sdf, parse_bays, CastleBay, CastleModule,
};
pub use gatehouse::{gatehouse_mat, gatehouse_sdf, gatehouse_stone_sdf, GatehouseParams};
pub use house::{
    house_mat, house_sdf, house_stone_rgb, HouseKind, HouseParams, DOOR_HALF_W, DOOR_WIDTH_M,
};
pub use mesh::{
    write_bam1, write_bam1_with_places, write_obj, write_stick_disc_ron, BamPlacement, MeshData,
    BAM_PALETTE_STONE, BAM_PALETTE_STONE_L, BAM_PALETTE_WOOD,
};
pub use object::{load_object_ron, ObjectDef};
pub use sdf::{staff_sdf, StaffParams};
pub use surface::{mesh_field, mesh_sdf, MeshOptions};
pub use walkway::{walkway_mat, walkway_sdf, walkway_stone_rgb, WalkwayParams};
