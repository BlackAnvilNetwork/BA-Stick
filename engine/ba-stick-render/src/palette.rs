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
