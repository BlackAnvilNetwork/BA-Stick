//! 256-entry palette: indices 0..16 are Stick Engine's palette (used by the rig),
//! 16.. are zone colours (biome × shade, trails, water, bridge).
use stick_engine::raster::PALETTE as ENGINE;

/// Biome order must match `BIOMES` in apps/stick-web/scripts/bake-zones.ts.
const BIOME_BASE: [u32; 16] = [
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
    for &(i, c) in FX.iter() {
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
