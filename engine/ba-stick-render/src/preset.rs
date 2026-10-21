//! Rig presets and server-anim → clip mapping.
use stick_engine::raster::*;
use stick_engine::rig::{Look, Proportions};

/// Server `UnitSnapshot.anim` plus `run` (derived from speed by the host).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AnimState {
    Idle,
    Walk,
    Run,
    Melee,
    Cast,
    Rest,
    Dead,
}

impl AnimState {
    pub fn parse(s: &str) -> AnimState {
        match s {
            "walk" => AnimState::Walk,
            "run" => AnimState::Run,
            "melee" => AnimState::Melee,
            "cast" => AnimState::Cast,
            "rest" => AnimState::Rest,
            "dead" => AnimState::Dead,
            _ => AnimState::Idle,
        }
    }
    /// Builtin Stick Engine clip used for this state. `cast`, `rest` and
    /// `dead` fall back until dedicated clips land (M2).
    pub fn clip(self) -> &'static str {
        match self {
            AnimState::Walk => "walk",
            AnimState::Run => "run",
            AnimState::Melee | AnimState::Cast => "swing",
            AnimState::Idle | AnimState::Rest | AnimState::Dead => "idle",
        }
    }
    pub fn restarts(self) -> bool {
        matches!(self, AnimState::Melee | AnimState::Cast)
    }
}

/// Visual preset for a unit: proportions plus palette indices.
#[derive(Clone, Copy, Debug)]
pub struct RigPreset {
    pub props: Proportions,
    pub look: Look,
}

fn with(f: impl FnOnce(&mut Proportions, &mut Look)) -> RigPreset {
    let mut props = Proportions::default();
    let mut look = Look::default();
    f(&mut props, &mut look);
    RigPreset { props, look }
}

impl RigPreset {
    /// Resolve a preset key: a Black Anvil job id (`knight`, `time_mage`...),
    /// `npc:<role>`, `mob:<archetype>`, optionally suffixed `/female` or
    /// `/pepeka`. Unknown keys get the default stick fighter.
    pub fn resolve(key: &str) -> RigPreset {
        let (base, variant) = key.split_once('/').unwrap_or((key, ""));
        let mut p = match base {
            "knight" => with(|p, l| { p.limb_px = 2.8; p.shoulder_w = 0.22; l.accent = C_STEEL; }),
            "fighter" => with(|p, l| { p.limb_px = 2.6; l.accent = C_ACCENT; }),
            "rogue" => with(|p, l| { p.limb_px = 1.9; p.sword = 0.55; l.accent = C_SHADOW; }),
            "cleric" => with(|p, l| { p.sword = 0.6; l.accent = C_GOLD; }),
            "sorcerer" => with(|p, l| { p.limb_px = 1.9; p.sword = 1.1; l.accent = C_DASH; }),
            "time_mage" => with(|p, l| { p.limb_px = 2.0; p.sword = 1.0; l.accent = C_GOLD; l.body = C_TRAIL; }),
            "battle_mage" => with(|p, l| { p.limb_px = 2.4; l.accent = C_DASH; l.far = C_STEEL; }),
            b if b.starts_with("npc:") => with(|p, l| { p.sword = 0.0; l.accent = C_GOLD; l.body = C_DUST; l.far = C_STONE_FAR; }),
            b if b.starts_with("mob:") => with(|p, l| { p.limb_px = 2.6; p.head_r = 0.17; l.accent = C_ACCENT; l.body = C_STONE; l.far = C_STONE_FAR; }),
            _ => RigPreset { props: Proportions::default(), look: Look::default() },
        };
        match variant {
            "female" => { p.props.shoulder_w *= 0.88; p.props.limb_px *= 0.9; }
            "pepeka" => {
                p.props.thigh *= 0.7; p.props.shin *= 0.7; p.props.spine *= 0.8;
                p.props.head_r *= 1.5; p.props.limb_px *= 1.1;
            }
            _ => {}
        }
        p
    }
}

/// Darker stone tone (palette 13) reused for far limbs of mobs/NPCs.
pub const C_STONE_FAR: u8 = 13;
pub const C_STONE: u8 = 12;
