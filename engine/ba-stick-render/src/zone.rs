//! Baked zone grid (`BAZ1`, produced by apps/stick-web/scripts/bake-zones.ts from
//! @bellgrave/config): per-cell biome, flags and stand height.

pub const F_WATER: u8 = 1;
pub const F_TRAIL: u8 = 2;
pub const F_BRIDGE: u8 = 4;
pub const F_BLOCKED: u8 = 8;
pub const F_STONE: u8 = 16;

#[derive(Clone, Debug)]
pub struct Zone {
    pub min_x: f32,
    pub min_z: f32,
    pub cell: f32,
    pub w: usize,
    pub h: usize,
    pub biome: Vec<u8>,
    pub flags: Vec<u8>,
    /// Height in metres.
    pub height: Vec<f32>,
}

impl Zone {
    pub fn parse(b: &[u8]) -> Result<Zone, String> {
        if b.len() < 24 || &b[0..4] != b"BAZ1" {
            return Err("not a BAZ1 zone".into());
        }
        let f = |o: usize| f32::from_le_bytes(b[o..o + 4].try_into().unwrap());
        let u = |o: usize| u32::from_le_bytes(b[o..o + 4].try_into().unwrap()) as usize;
        let (w, h) = (u(16), u(20));
        let n = w * h;
        if b.len() != 24 + n * 4 {
            return Err(format!("zone size mismatch: {} vs {}", b.len(), 24 + n * 4));
        }
        let biome = b[24..24 + n].to_vec();
        let flags = b[24 + n..24 + 2 * n].to_vec();
        let height = b[24 + 2 * n..]
            .chunks_exact(2)
            .map(|c| i16::from_le_bytes([c[0], c[1]]) as f32 / 100.0)
            .collect();
        Ok(Zone { min_x: f(4), min_z: f(8), cell: f(12), w, h, biome, flags, height })
    }

    #[inline]
    pub fn idx(&self, i: i32, j: i32) -> usize {
        let i = i.clamp(0, self.w as i32 - 1) as usize;
        let j = j.clamp(0, self.h as i32 - 1) as usize;
        j * self.w + i
    }

    /// Cell coords for a world point.
    pub fn cell_of(&self, x: f32, z: f32) -> (i32, i32) {
        (((x - self.min_x) / self.cell).floor() as i32, ((z - self.min_z) / self.cell).floor() as i32)
    }

    /// Bilinear stand height at a world point (clamped to the grid).
    pub fn height_at(&self, x: f32, z: f32) -> f32 {
        let u = (x - self.min_x) / self.cell;
        let v = (z - self.min_z) / self.cell;
        let (i, j) = (u.floor() as i32, v.floor() as i32);
        let (fu, fv) = (u - i as f32, v - j as f32);
        let h = |a, b| self.height[self.idx(a, b)];
        let top = h(i, j) * (1.0 - fu) + h(i + 1, j) * fu;
        let bot = h(i, j + 1) * (1.0 - fu) + h(i + 1, j + 1) * fu;
        top * (1.0 - fv) + bot * fv
    }

    pub fn flags_at(&self, x: f32, z: f32) -> u8 {
        let (i, j) = self.cell_of(x, z);
        self.flags[self.idx(i, j)]
    }
}
