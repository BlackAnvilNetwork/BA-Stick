// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! BA-Stick renderer: a host-agnostic scene of server-driven units drawn as
//! procedural stick figures with Stick Engine. The game loop, input and
//! networking live in the TS shell (`apps/stick-web`); this crate only takes
//! unit state in and produces pixels.
//!
//! Units mirror `UnitSnapshot` from `packages/protocol`: an id, a kind, a
//! world position (x, y, z), a facing, a server `anim` state and a rig preset
//! (job / mob archetype / NPC role).

pub mod appearance;
pub mod weather;
pub mod atmosphere;
pub mod boot_forge;
pub mod boot_forge_blots;
pub mod buffvfx;
pub mod compat;
pub mod creature;
pub mod dither;
pub mod figure;
pub mod floaters;
pub mod gear;
pub mod ground;
pub mod mapfont;
pub mod minimap;
pub mod palette;
pub mod preset;
pub mod props;
pub mod scene;
pub mod structure;
pub mod tree;
pub mod vfx;
#[cfg(target_arch = "wasm32")]
mod web;
pub mod zone;

pub use preset::{AnimState, RigPreset};
pub use scene::{Scene, UnitFx, UnitInput};

#[cfg(test)]
mod tests;
