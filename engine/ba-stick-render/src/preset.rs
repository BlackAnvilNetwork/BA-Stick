//! Rig presets and server-anim → clip mapping.
use crate::compat::*;

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
    /// Action-layer clip (None = base idle/gait layer only).
    pub fn action_clip(self) -> Option<&'static str> {
        match self {
            AnimState::Melee | AnimState::Cast => Some("swing"),
            _ => None,
        }
    }
    pub fn restarts(self) -> bool {
        matches!(self, AnimState::Melee | AnimState::Cast)
    }
}

/// Body plan. Bipeds use the Stick Engine rig; the rest are drawn by
/// `creature.rs` from the same unit position/yaw/gait phase.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Body {
    Biped,
    /// Four legs; `hop` = arc-hop gait (Dust Hare), else trot. `size` scales.
    Quadruped { size: f32, hop: bool, tusks: bool, body: u8, far: u8 },
    /// Ground snake (Cliff Adder).
    Serpent { size: f32, body: u8 },
    /// Bouncing blob (Pale Slime).
    Blob { size: f32, body: u8, far: u8 },
    /// Gather node marker (#30): 0 mine (ore rock), 1 harvest (herb), 2 fish (ripples).
    Node { method: u8 },
}

/// What a biped holds (`JOB_WEAPON` in packages/combat).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Weapon {
    Sword,
    Staff,
    None,
}

/// Visual preset for a unit: proportions plus palette indices.
#[derive(Clone, Copy, Debug)]
pub struct RigPreset {
    pub props: Proportions,
    pub look: Look,
    pub body: Body,
    pub weapon: Weapon,
    /// Extra marker drawn above NPC heads (role glyph colour), if any.
    pub npc_mark: Option<u8>,
}

fn with(f: impl FnOnce(&mut Proportions, &mut Look)) -> RigPreset {
    let mut props = Proportions::default();
    let mut look = Look::default();
    f(&mut props, &mut look);
    RigPreset { props, look, body: Body::Biped, weapon: Weapon::Sword, npc_mark: None }
}

fn staff(mut p: RigPreset) -> RigPreset {
    p.weapon = Weapon::Staff;
    p
}

/// Every mob archetype in packages/config (`PaleHollowArchetype`) plus the
/// legacy hall guard. Exposed for tests.
pub const MOB_ARCHETYPES: [&str; 9] = [
    "dust_hare", "pale_slime", "hollow_scavenger", "ashbeam_boar", "ruin_dweller",
    "cliff_adder", "seam_golem", "shard_wight", "guard",
];
/// Every `npcRole` in packages/protocol.
pub const NPC_ROLES: [&str; 6] = ["job_master", "spell_trainer", "guide", "quest_giver", "crafter", "vendor"];

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
            "battle_mage" => with(|p, l| { p.limb_px = 2.4; l.accent = C_DASH; l.far = C_STEEL; }),
            "cleric" => staff(with(|p, l| { p.sword = 0.0; l.accent = C_GOLD; })),
            "sorcerer" => staff(with(|p, l| { p.limb_px = 1.9; p.sword = 0.0; l.accent = C_DASH; })),
            "time_mage" => staff(with(|p, l| { p.limb_px = 2.0; p.sword = 0.0; l.accent = C_GOLD; l.body = C_TRAIL; })),
            b if b.starts_with("npc:") => npc(&b[4..]),
            b if b.starts_with("mob:") => mob(&b[4..]),
            b if b.starts_with("gather:") => {
                let method = match &b[7..] { "harvest" => 1, "fish" => 2, _ => 0 };
                RigPreset { body: Body::Node { method }, weapon: Weapon::None, ..with(|_, _| {}) }
            }
            _ => with(|_, _| {}),
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

fn npc(role: &str) -> RigPreset {
    // Robed, unarmed townsfolk; the role reads from accent + head marker.
    let (accent, mark, wpn) = match role {
        "job_master" => (C_STEEL, C_STEEL, Weapon::Sword),
        "spell_trainer" => (C_DASH, C_DASH, Weapon::Staff),
        "guide" => (C_GOLD, C_GOLD, Weapon::Staff),
        "quest_giver" => (C_ACCENT, C_GOLD, Weapon::None),
        "crafter" => (C_HILT, C_HILT, Weapon::None),
        "vendor" => (crate::palette::FX_HP, crate::palette::FX_HP, Weapon::None),
        _ => (C_GOLD, C_GOLD, Weapon::None),
    };
    let mut p = with(|p, l| { p.sword = 0.0; p.limb_px = 2.4; l.accent = accent; l.body = C_DUST; l.far = C_STONE_FAR; });
    p.weapon = wpn;
    p.npc_mark = Some(mark);
    p
}

fn mob(arch: &str) -> RigPreset {
    use crate::palette::*;
    let biped = |f: &dyn Fn(&mut Proportions, &mut Look)| with(|p, l| f(p, l));
    match arch {
        "dust_hare" => RigPreset { body: Body::Quadruped { size: 0.95, hop: true, tusks: false, body: CR_HARE, far: CR_HARE_FAR }, weapon: Weapon::None, ..with(|_, _| {}) },
        "ashbeam_boar" => RigPreset { body: Body::Quadruped { size: 1.35, hop: false, tusks: true, body: CR_BOAR, far: CR_BOAR_FAR }, weapon: Weapon::None, ..with(|_, _| {}) },
        "pale_slime" => RigPreset { body: Body::Blob { size: 1.3, body: CR_SLIME, far: CR_SLIME_FAR }, weapon: Weapon::None, ..with(|_, _| {}) },
        "cliff_adder" => RigPreset { body: Body::Serpent { size: 1.5, body: CR_ADDER }, weapon: Weapon::None, ..with(|_, _| {}) },
        "hollow_scavenger" => {
            let mut p = biped(&|p, l| { p.limb_px = 2.0; p.sword = 0.5; p.spine *= 0.9; l.body = C_DUST; l.far = C_STONE_FAR; l.accent = C_HILT; });
            p.weapon = Weapon::Sword;
            p
        }
        "ruin_dweller" => biped(&|p, l| { p.limb_px = 2.4; p.sword = 0.7; l.body = C_STONE; l.far = C_STONE_FAR; l.accent = C_ACCENT; }),
        "seam_golem" => {
            let mut p = biped(&|p, l| {
                p.limb_px = 4.2; p.shoulder_w = 0.3; p.thigh *= 1.15; p.shin *= 1.15; p.spine *= 1.2; p.head_r = 0.12; p.sword = 0.0;
                l.body = C_STONE; l.far = C_STONE_FAR; l.accent = C_DASH;
            });
            p.weapon = Weapon::None;
            p
        }
        "shard_wight" => {
            let mut p = biped(&|p, l| { p.limb_px = 1.6; p.spine *= 1.1; p.sword = 0.0; l.body = CR_WIGHT; l.far = C_STONE_FAR; l.accent = C_DASH; });
            p.weapon = Weapon::Staff;
            p
        }
        "guard" => biped(&|p, l| { p.limb_px = 2.8; p.shoulder_w = 0.22; l.body = C_STONE; l.far = C_STONE_FAR; l.accent = C_STEEL; }),
        _ => biped(&|p, l| { p.limb_px = 2.6; p.head_r = 0.17; l.accent = C_ACCENT; l.body = C_STONE; l.far = C_STONE_FAR; }),
    }
}

/// Darker stone tone (palette 13) reused for far limbs of mobs/NPCs.
pub const C_STONE_FAR: u8 = 13;
pub const C_STONE: u8 = 12;
