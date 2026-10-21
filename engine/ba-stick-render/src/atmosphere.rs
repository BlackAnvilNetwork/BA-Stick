//! Atmosphere (#26): per-pixel light at RGB conversion time. Cool ambient,
//! warm radial campfire pools with flicker, distance haze toward the
//! horizon colour, a pixel skyline behind the zone edge, and a vignette.
//! Emissive palette entries (fire, FX, floaters) skip the ambient/haze so they
//! read as "glow" without a bloom pass.
use crate::palette::*;

/// Shared sun direction (round 1 polish): unit vector pointing *toward* the
/// sun, from the screen's upper-left (NW) and above. Light falls on NW faces;
/// shadows fall SE (screen lower-right). Read by contact shadows (S2) and
/// terrain/prop shading.
pub const SUN_DIR: [f32; 3] = [-0.6835, 0.7071, -0.1810];

/// Ground-plane offset (x, z) for a contact shadow of footprint radius `r`:
/// a fraction of `r` along -SUN_DIR projected onto the ground.
pub fn shadow_offset(r: f32) -> (f32, f32) {
    let (x, z) = (-SUN_DIR[0], -SUN_DIR[2]);
    let l = (x * x + z * z).sqrt();
    (x / l * r * 0.25, z / l * r * 0.25)
}

/// Framebuffer index left where no terrain was drawn (sky / beyond bounds).
pub const SKY: u8 = 141;

#[derive(Clone, Copy, Debug)]
pub struct Light {
    pub x: f32,
    pub y: f32,
    /// Radius in px (horizontal; vertical is halved for the iso ground).
    pub r: f32,
    pub k: f32,
}

pub struct Params {
    pub ambient: [f32; 3],
    pub warm: [f32; 3],
    pub haze: u32,
    pub sky_top: u32,
    pub vignette: f32,
}

pub const PALE_HOLLOW: Params = Params {
    ambient: [0.82, 0.86, 0.98],
    warm: [0.62, 0.34, 0.08],
    haze: 0x6e6a7c,
    sky_top: 0x1e1b2c,
    vignette: 0.32,
};

fn emissive(c: u8) -> bool {
    matches!(c, 9 | 11 | 14) || (80..=90).contains(&c) || c == COAL || c == EMBER || (FN_DMG..=FN_MISS).contains(&c) || c == BLOOM_C
}

fn rgb(c: u32) -> [f32; 3] {
    [((c >> 16) & 255) as f32, ((c >> 8) & 255) as f32, (c & 255) as f32]
}

fn hash(n: i32) -> f32 {
    let s = (n as f32 * 12.9898).sin() * 43758.547;
    s - s.floor()
}

/// Smooth 1-D value noise.
fn noise(x: f32) -> f32 {
    let i = x.floor();
    let f = x - i;
    let (a, b) = (hash(i as i32), hash(i as i32 + 1));
    a + (b - a) * f * f * (3.0 - 2.0 * f)
}

/// Height (px above `base`) of a skyline layer at screen column `x`.
fn ridge(x: f32, scroll: f32, scale: f32, amp: f32, seed: f32) -> f32 {
    let u = (x + scroll) / scale + seed;
    amp * (0.6 * noise(u) + 0.3 * noise(u * 2.3) + 0.1 * noise(u * 5.1))
}

/// Convert indexed colour to RGBA with lighting. `scroll` = camera screen
/// offset in px (for skyline parallax).
#[allow(clippy::too_many_arguments)]
pub fn write_rgba(pal: &[u32; 256], color: &[u8], w: usize, h: usize, lights: &[Light], p: &Params, scroll: f32, out: &mut [u8]) {
    write_rgba_key(pal, color, w, h, lights, p, scroll, false, out);
}

/// Key-light strength (L2): lit ramp steps warm up, shadow steps cool down.
pub const KEY_LIT: [f32; 3] = [1.07, 1.06, 1.03];
pub const KEY_SHADE: [f32; 3] = [0.93, 0.94, 0.98];

/// Ramp step of a palette index for the key light: Some(0) lit, Some(2)
/// shadow, Some(1) mid, None = not on a known ramp (unchanged).
pub fn key_step(c: u8) -> Option<u8> {
    if let Some(s) = crate::dither::shade_step(c) {
        return Some(s);
    }
    match c {
        PINE_L | ASH_L | GRASS_L | ROCK_L | WALL_L | WOOD_L | BANK_L => Some(0),
        PINE_D | ASH_D | CYP_D | GRASS_D | ROCK_D | WALL_D | WOOD_D | BANK_D | BANK_DD | OLIVE_D | BEIGE_D => Some(2),
        _ => None,
    }
}

/// `write_rgba` with an optional directional key light (L2). The key light is
/// folded into the per-index colour table, so it costs no per-pixel work.
#[allow(clippy::too_many_arguments)]
pub fn write_rgba_key(pal: &[u32; 256], color: &[u8], w: usize, h: usize, lights: &[Light], p: &Params, scroll: f32, key: bool, out: &mut [u8]) {
    let haze = rgb(p.haze);
    let top = rgb(p.sky_top);
    let (cx, cy) = (w as f32 * 0.5, h as f32 * 0.5);
    // per-index colour and emissive flag
    let mut lut = [[0f32; 3]; 256];
    let mut emis = [false; 256];
    for c in 0..256 {
        lut[c] = rgb(pal[c]);
        emis[c] = emissive(c as u8);
        if key && !emis[c] {
            let m = match key_step(c as u8) { Some(0) => KEY_LIT, Some(2) => KEY_SHADE, _ => [1.0; 3] };
            for k in 0..3 {
                lut[c][k] *= m[k];
            }
        }
    }
    // separable vignette
    let vx: Vec<f32> = (0..w).map(|x| ((x as f32 - cx) / cx).powi(2)).collect();
    // warm-light buffer, only filled inside each light's box
    let mut warm = vec![0f32; w * h];
    for l in lights {
        let (rx, ry) = (l.r, l.r * 0.55);
        let (x0, x1) = ((l.x - rx).max(0.0) as usize, ((l.x + rx) as usize + 1).min(w));
        let (y0, y1) = ((l.y - ry).max(0.0) as usize, ((l.y + ry) as usize + 1).min(h));
        for y in y0..y1 {
            let dy = (y as f32 - l.y) / ry;
            for x in x0..x1 {
                let dx = (x as f32 - l.x) / rx;
                let d2 = dx * dx + dy * dy;
                if d2 < 1.0 {
                    warm[y * w + x] += l.k * (1.0 - d2) * (1.0 - d2);
                }
            }
        }
    }
    let horizon = h as f32 * 0.55;
    let ridges: Vec<(f32, f32)> = (0..w)
        .map(|x| {
            let fx = x as f32;
            (horizon - ridge(fx, scroll * 0.15, 60.0, 70.0, 3.0), horizon + 30.0 - ridge(fx, scroll * 0.35, 38.0, 80.0, 11.0))
        })
        .collect();
    for y in 0..h {
        let fy = y as f32;
        let far = (1.0 - fy / h as f32).powi(2) * 0.28; // top of screen = far
        let vy = ((fy - cy) / cy).powi(2);
        let t = (fy / h as f32).clamp(0.0, 1.0);
        let sky = [top[0] + (haze[0] - top[0]) * t, top[1] + (haze[1] - top[1]) * t, top[2] + (haze[2] - top[2]) * t];
        for x in 0..w {
            let i = y * w + x;
            let c = color[i];
            let v = if c == SKY {
                let (far_r, near_r) = ridges[x];
                if fy > near_r {
                    [sky[0] * 0.55, sky[1] * 0.55, sky[2] * 0.62]
                } else if fy > far_r {
                    [sky[0] * 0.78, sky[1] * 0.78, sky[2] * 0.84]
                } else {
                    sky
                }
            } else {
                let mut v = lut[c as usize];
                if !emis[c as usize] {
                    let wm = warm[i];
                    for k in 0..3 {
                        v[k] *= p.ambient[k] + wm * p.warm[k];
                        v[k] += (haze[k] - v[k]) * far;
                    }
                }
                v
            };
            let r2 = (vx[x] + vy) * 0.5;
            let vg = 1.0 - p.vignette * if r2 >= 1.0 { 1.0 } else { r2 * r2.sqrt() };
            let o = &mut out[i * 4..i * 4 + 4];
            o[0] = (v[0] * vg).clamp(0.0, 255.0) as u8;
            o[1] = (v[1] * vg).clamp(0.0, 255.0) as u8;
            o[2] = (v[2] * vg).clamp(0.0, 255.0) as u8;
            o[3] = 255;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn campfire_warms_and_ambient_cools() {
        let pal = palette();
        let (w, h) = (64, 36);
        let color = vec![BIOME0 + 13 * 3 + 1; w * h];
        let mut lit = vec![0u8; w * h * 4];
        let light = [Light { x: 32.0, y: 18.0, r: 20.0, k: 1.0 }];
        write_rgba(&pal, &color, w, h, &light, &PALE_HOLLOW, 0.0, &mut lit);
        let px = |b: &[u8], x: usize, y: usize| { let i = (y * w + x) * 4; (b[i] as i32, b[i + 1] as i32, b[i + 2] as i32) };
        let (c, e) = (px(&lit, 32, 18), px(&lit, 2, 18));
        assert!(c.0 > e.0 + 20, "warm pool is brighter red: {c:?} vs {e:?}");
        assert!(c.0 - c.2 > e.0 - e.2, "pool is warmer");
        // emissive colours skip the ambient multiply
        let mut col2 = color.clone();
        col2[18 * w + 32] = EMBER;
        let mut out2 = vec![0u8; w * h * 4];
        write_rgba(&pal, &col2, w, h, &[], &PALE_HOLLOW, 0.0, &mut out2);
        assert!(px(&out2, 32, 18).0 >= 240);
    }

    #[test]
    fn sky_fills_void() {
        let pal = palette();
        let (w, h) = (32, 32);
        let color = vec![SKY; w * h];
        let mut out = vec![0u8; w * h * 4];
        write_rgba(&pal, &color, w, h, &[], &PALE_HOLLOW, 0.0, &mut out);
        // top darker than bottom
        assert!(out[(16) * 4 + 2] < out[((h - 1) * w + 16) * 4 + 2] || out[(16) * 4] < out[((h - 1) * w + 16) * 4]);
    }
}
