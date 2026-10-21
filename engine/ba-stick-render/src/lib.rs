//! BA-Stick renderer: a host-agnostic scene of server-driven units drawn as
//! procedural stick figures with Stick Engine. The game loop, input and
//! networking live in the TS shell (`apps/stick-web`); this crate only takes
//! unit state in and produces pixels.
//!
//! Units mirror `UnitSnapshot` from `packages/protocol`: an id, a kind, a
//! world position (x, y, z), a facing, a server `anim` state and a rig preset
//! (job / mob archetype / NPC role).

pub mod atmosphere;
pub mod vfx;
pub mod buffvfx;
pub mod compat;
pub mod creature;
pub mod dither;
pub mod figure;
pub mod gear;
pub mod floaters;
pub mod ground;
pub mod palette;
pub mod preset;
pub mod props;
pub mod scene;
pub mod zone;
#[cfg(target_arch = "wasm32")]
mod web;

pub use preset::{AnimState, RigPreset};
pub use scene::{Scene, UnitFx, UnitInput};

#[cfg(test)]
mod tests;
