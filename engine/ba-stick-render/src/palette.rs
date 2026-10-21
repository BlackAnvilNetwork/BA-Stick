//! 256-entry palette: indices 0..16 are Stick Engine's palette (used by the rig),
//! 16.. are zone colours (biome × shade, trails, water, bridge).
use crate::compat::PALETTE as ENGINE;

/// Biome order must match `BIOMES` in apps/stick-web/scripts/bake-zones.ts.
pub const BIOME_BASE: [u32; 16] = [
    0x6b5a45, // hub_indoor packed dirt
    0xb3ab92, // terrace chalk
    0x8a7a3c, // farm
    0x2f5f7a, // river
    0x6e6650, // riverbank
    0x7a5a3a, // bridge
    0x4b4a3a, // ashbeam
    0x6f6a45, // scrub
    0x8b8478, // quarry
    0x4f5a3f, // vine_cliff
    0x5c5560, // ore_seam
    0x3c3846, // crypt
    0x5a534a, // ash_road
    0x4f6b38, // grass
    0x6a6560, // mountain
    0x6d8a46, // meadow
];
/// Shade multipliers: lit, mid, shadow.
const SHADES: [f32; 3] = [1.14, 1.0, 0.8];

pub const BIOME0: u8 = 16; // 16 + biome*3 + shade
pub const TRAIL_DIRT: u8 = 64; // +shade
pub const TRAIL_STONE: u8 = 67; // +shade
pub const WATER: u8 = 70; // +0..3 animated
pub const BRIDGE: u8 = 74; // +shade

/// Effect / creature colours (80..). Kept in one table so tests can check them.
pub const FX: [(u8, u32); 20] = [
    (FX_TELL, 0xd9483b),
    (FX_TELL_DARK, 0x7a2224),
    (FX_RING_SELF, 0xd9a441),
    (FX_RING_HOSTILE, 0xe0543e),
    (FX_RING_FRIEND, 0x6fd08c),
    (FX_HP, 0x5ec26a),
    (FX_HP_LOW, 0xd04a3a),
    (FX_BAR_BG, 0x14121a),
    (FX_CAST, 0xb48cff),
    (FX_LEVEL, 0xffe27a),
    (FX_HOVER, 0xf4f0e0),
    (CR_HARE, 0xb59a74),
    (CR_HARE_FAR, 0x8a7356),
    (CR_BOAR, 0x5a3f30),
    (CR_BOAR_FAR, 0x3e2b21),
    (CR_SLIME, 0xc9d9c0),
    (CR_SLIME_FAR, 0x93a88e),
    (CR_ADDER, 0x6b7a3a),
    (CR_WIGHT, 0x9fc4d6),
    (CR_TUSK, 0xe8dcc0),
];
pub const FX_TELL: u8 = 80;
pub const FX_TELL_DARK: u8 = 81;
pub const FX_RING_SELF: u8 = 82;
pub const FX_RING_HOSTILE: u8 = 83;
pub const FX_RING_FRIEND: u8 = 84;
pub const FX_HP: u8 = 85;
pub const FX_HP_LOW: u8 = 86;
pub const FX_BAR_BG: u8 = 87;
pub const FX_CAST: u8 = 88;
pub const FX_LEVEL: u8 = 89;
pub const FX_HOVER: u8 = 90;
pub const CR_HARE: u8 = 91;
pub const CR_HARE_FAR: u8 = 92;
pub const CR_BOAR: u8 = 93;
pub const CR_BOAR_FAR: u8 = 94;
pub const CR_SLIME: u8 = 95;
pub const CR_SLIME_FAR: u8 = 96;
pub const CR_ADDER: u8 = 97;
pub const CR_WIGHT: u8 = 98;
pub const CR_TUSK: u8 = 99;
/// Floating combat numbers (#45).
pub const FN_DMG: u8 = 132;
pub const FN_SELF: u8 = 133;
pub const FN_HEAL: u8 = 134;
pub const FN_CRIT: u8 = 135;
pub const FN_MISS: u8 = 136;
/// Cool-grey river masonry (bank walls, bridges).
pub const BANK_DD: u8 = 137;
pub const BANK_D: u8 = 138;
pub const BANK: u8 = 139;
pub const BANK_L: u8 = 140;
/// Gear materials (#14).
pub const GEAR_LEATHER: u8 = 77;
pub const GEAR_LEATHER_FAR: u8 = 78;
pub const GEAR_BONE: u8 = 79;
pub const GEAR: [(u8, u32); 3] = [(GEAR_LEATHER, 0x7a5233), (GEAR_LEATHER_FAR, 0x553823), (GEAR_BONE, 0xd8cfb4)];
/// Canine (scavenger dog): orange-brown strokes, golden-tan fill, dark spot.
pub const CR_DOG: u8 = 142;
pub const CR_DOG_FAR: u8 = 143;
pub const CR_DOG_FILL: u8 = 144;
pub const CR_DOG_SPOT: u8 = 145;
pub const CR_TEETH: u8 = 146;
pub const CR_NOSE: u8 = 147;
pub const CANINE: [(u8, u32); 6] = [(CR_DOG, 0xc4561c), (CR_DOG_FAR, 0x8e3c14), (CR_DOG_FILL, 0xb8860e), (CR_DOG_SPOT, 0x9a3a12), (CR_TEETH, 0xf4f1e6), (CR_NOSE, 0x141014)];
pub const MASONRY: [(u8, u32); 4] = [(BANK_DD, 0x4e575c), (BANK_D, 0x6f7a80), (BANK, 0x8e9a9e), (BANK_L, 0xa8b2b6)];
pub const FLOAT: [(u8, u32); 5] = [(FN_DMG, 0xf6eedc), (FN_SELF, 0xe8503c), (FN_HEAL, 0x72e07c), (FN_CRIT, 0xffa832), (FN_MISS, 0xa6a2b4)];

/// Prop colours (100..148): foliage, ground cover, stone, wood, cloth, fire.
pub const PROP: [(u8, u32); 32] = [
    (PINE_D, 0x1f3a2c), (PINE, 0x2e5238), (PINE_L, 0x46704a),
    (ASH_D, 0x4a5a32), (ASH, 0x6b7c45), (ASH_L, 0x8fa060),
    (CYP_D, 0x24382a), (CYP, 0x34503a),
    (GRASS_D, 0x5a6a34), (GRASS, 0x7d8c46), (GRASS_L, 0xa3ad62),
    (SCRUB_C, 0x8a7a4a), (REED_C, 0x8e9a58), (STALK_C, 0xc9a85a), (BLOOM_C, 0xe8e0f0),
    (ROCK_D, 0x6e675e), (ROCK, 0x9a9283), (ROCK_L, 0xc2baa8),
    (WALL_D, 0x8f8268), (WALL, 0xb8a888), (WALL_L, 0xd2c4a2), (MOSS_C, 0x5f7040),
    (WOOD_D, 0x4a3a2a), (WOOD, 0x7a6850), (WOOD_L, 0x9c8a6a),
    (OLIVE_D, 0x4a5238), (OLIVE, 0x7a8458), (BEIGE_D, 0x7a6c54), (BEIGE, 0xb5a484),
    (IRON_C, 0x5a5f66), (COAL, 0xd07030), (EMBER, 0xffc060),
];
pub const PINE_D: u8 = 100; pub const PINE: u8 = 101; pub const PINE_L: u8 = 102;
pub const ASH_D: u8 = 103; pub const ASH: u8 = 104; pub const ASH_L: u8 = 105;
pub const CYP_D: u8 = 106; pub const CYP: u8 = 107;
pub const GRASS_D: u8 = 108; pub const GRASS: u8 = 109; pub const GRASS_L: u8 = 110;
pub const SCRUB_C: u8 = 111; pub const REED_C: u8 = 112; pub const STALK_C: u8 = 113; pub const BLOOM_C: u8 = 114;
pub const ROCK_D: u8 = 115; pub const ROCK: u8 = 116; pub const ROCK_L: u8 = 117;
pub const WALL_D: u8 = 118; pub const WALL: u8 = 119; pub const WALL_L: u8 = 120; pub const MOSS_C: u8 = 121;
pub const WOOD_D: u8 = 122; pub const WOOD: u8 = 123; pub const WOOD_L: u8 = 124;
pub const OLIVE_D: u8 = 125; pub const OLIVE: u8 = 126; pub const BEIGE_D: u8 = 127; pub const BEIGE: u8 = 128;
pub const IRON_C: u8 = 129; pub const COAL: u8 = 130; pub const EMBER: u8 = 131;

/// Tinted copies of the tintable colours (engine 0..16 and FX/creature 80..100):
/// cast glow, stone (petrify / dead) and shiny gold, 36 entries each.
pub const TINT_CAST: u8 = 148;
pub const TINT_STONE: u8 = 184;
pub const TINT_SHINY: u8 = 220;
const TINT_N: usize = 36;

/// Slot of a colour inside a tint block, if it is tintable.
pub fn tint_slot(c: u8) -> Option<u8> {
    match c {
        0..=15 => Some(c),
        80..=99 => Some(16 + c - 80),
        _ => None,
    }
}

/// Remap a colour into tint block `base` (one of `TINT_*`).
pub fn tinted(c: u8, base: u8) -> u8 {
    tint_slot(c).map_or(c, |s| base + s)
}

fn lerp_rgb(a: u32, b: u32, t: f32) -> u32 {
    let ch = |s: u32| {
        let (x, y) = (((a >> s) & 255) as f32, ((b >> s) & 255) as f32);
        (x + (y - x) * t).round().clamp(0.0, 255.0) as u32
    };
    (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

fn mul(c: u32, m: f32) -> u32 {
    let ch = |s: u32| (((c >> s) & 255) as f32 * m).round().clamp(0.0, 255.0) as u32;
    (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

pub fn palette() -> [u32; 256] {
    let mut p = [0u32; 256];
    p[..16].copy_from_slice(&ENGINE);
    for (b, &base) in BIOME_BASE.iter().enumerate() {
        for (s, &m) in SHADES.iter().enumerate() {
            p[BIOME0 as usize + b * 3 + s] = mul(base, m);
        }
    }
    for (s, &m) in SHADES.iter().enumerate() {
        p[TRAIL_DIRT as usize + s] = mul(0x8c7556, m);
        p[TRAIL_STONE as usize + s] = mul(0x8e8a80, m);
        p[BRIDGE as usize + s] = mul(0x8a6440, m);
    }
    for (k, c) in [0x2c5d78u32, 0x336a86, 0x3b7792, 0x336a86].iter().enumerate() {
        p[WATER as usize + k] = *c;
    }
    for &(i, c) in FX.iter().chain(PROP.iter()).chain(FLOAT.iter()).chain(MASONRY.iter()).chain(CANINE.iter()).chain(GEAR.iter()) {
        p[i as usize] = c;
    }
    for c in (0u8..16).chain(80..100) {
        let s = tint_slot(c).unwrap() as usize;
        let src = p[c as usize];
        p[TINT_CAST as usize + s] = lerp_rgb(src, 0xb48cff, 0.45);
        p[TINT_STONE as usize + s] = lerp_rgb(mul(src, 0.55), 0x7d7486, 0.6);
        p[TINT_SHINY as usize + s] = lerp_rgb(src, 0xffd65a, 0.5);
    }
    debug_assert!(TINT_SHINY as usize + TINT_N <= 256);
    p
}

pub fn write_rgba(pal: &[u32; 256], color: &[u8], out: &mut [u8]) {
    for (i, &c) in color.iter().enumerate() {
        let p = pal[c as usize];
        out[i * 4] = (p >> 16) as u8;
        out[i * 4 + 1] = (p >> 8) as u8;
        out[i * 4 + 2] = p as u8;
        out[i * 4 + 3] = 255;
    }
}
