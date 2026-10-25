// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Floating combat numbers (#45): pixel-font text that rises above a unit
//! and dithers out. Drawn as an overlay (no depth test).
use crate::compat::C_OUTLINE;
use stick_engine::raster::Framebuffer;

use crate::palette::{FN_CRIT, FN_DMG, FN_HEAL, FN_MISS, FN_SELF};

/// Floater styles (host passes the number).
pub mod kind {
    pub const DAMAGE: u8 = 0;
    pub const SELF_DAMAGE: u8 = 1;
    pub const HEAL: u8 = 2;
    pub const CRIT: u8 = 3;
    pub const MISS: u8 = 4;
}

pub const LIFE: f32 = 1.1;
const RISE_PX: f32 = 18.0;

pub struct Floater {
    pub unit: String,
    /// Last known framebuffer anchor (x, head-top y), used once the unit is gone.
    pub at: Option<(f32, f32)>,
    pub text: Vec<u8>,
    pub kind: u8,
    pub age: f32,
    pub dx: f32,
}

/// 3×5 glyphs, one row per u8 (bits 2..0 = left..right).
fn glyph(c: u8) -> [u8; 5] {
    match c {
        b'0' => [7, 5, 5, 5, 7],
        b'1' => [2, 6, 2, 2, 7],
        b'2' => [7, 1, 7, 4, 7],
        b'3' => [7, 1, 3, 1, 7],
        b'4' => [5, 5, 7, 1, 1],
        b'5' => [7, 4, 7, 1, 7],
        b'6' => [7, 4, 7, 5, 7],
        b'7' => [7, 1, 1, 2, 2],
        b'8' => [7, 5, 7, 5, 7],
        b'9' => [7, 5, 7, 1, 7],
        b'+' => [0, 2, 7, 2, 0],
        b'-' => [0, 0, 7, 0, 0],
        b'!' => [2, 2, 2, 0, 2],
        b'M' => [5, 7, 7, 5, 5],
        b'I' => [7, 2, 2, 2, 7],
        b'S' => [7, 4, 7, 1, 7],
        _ => [0; 5],
    }
}

/// Text for a floater of `kind` with `value`.
pub fn text_for(kind: u8, value: u32) -> Vec<u8> {
    match kind {
        kind::MISS => b"MISS".to_vec(),
        kind::HEAL => format!("+{value}").into_bytes(),
        kind::CRIT => format!("{value}!").into_bytes(),
        _ => value.to_string().into_bytes(),
    }
}

fn colour(kind: u8) -> u8 {
    match kind {
        kind::SELF_DAMAGE => FN_SELF,
        kind::HEAL => FN_HEAL,
        kind::CRIT => FN_CRIT,
        kind::MISS => FN_MISS,
        _ => FN_DMG,
    }
}

/// Width in px of `text` at `scale`.
pub fn text_width(text: &[u8], scale: i32) -> i32 {
    (text.len() as i32 * 4 - 1).max(0) * scale
}

/// Draw one floater whose anchor (head top) is at (ax, ay).
pub fn draw(fb: &mut Framebuffer, f: &Floater, ax: f32, ay: f32) {
    let t = (f.age / LIFE).clamp(0.0, 1.0);
    let scale = if f.kind == kind::CRIT { 2 } else { 1 };
    // ease-out rise; crits pop a little higher
    let rise = (1.0 - (1.0 - t).powi(2)) * RISE_PX * if scale == 2 { 1.2 } else { 1.0 };
    let w = text_width(&f.text, scale);
    let x0 = (ax + f.dx).round() as i32 - w / 2;
    let y0 = (ay - 18.0 - rise).round() as i32 - 5 * scale;
    // ordered-dither fade over the last 40%
    let fade = ((t - 0.6) / 0.4).clamp(0.0, 1.0);
    let col = colour(f.kind);
    let px = |fb: &mut Framebuffer, x: i32, y: i32, c: u8| {
        if x < 0 || y < 0 || x >= fb.w as i32 || y >= fb.h as i32 {
            return;
        }
        let bayer = [0.0, 0.5, 0.75, 0.25][((x & 1) + (y & 1) * 2) as usize];
        if fade > bayer + 0.01 {
            return;
        }
        fb.color[y as usize * fb.w + x as usize] = c;
    };
    // pass 0: outline, pass 1: fill
    for pass in 0..2 {
        for (i, &ch) in f.text.iter().enumerate() {
            let g = glyph(ch);
            let gx = x0 + i as i32 * 4 * scale;
            for (row, bits) in g.iter().enumerate() {
                for col_i in 0..3 {
                    if bits & (4 >> col_i) == 0 {
                        continue;
                    }
                    for sy in 0..scale {
                        for sx in 0..scale {
                            let (x, y) = (gx + col_i * scale + sx, y0 + row as i32 * scale + sy);
                            if pass == 0 {
                                for (ox, oy) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
                                    px(fb, x + ox, y + oy, C_OUTLINE);
                                }
                            } else {
                                px(fb, x, y, col);
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_and_width() {
        assert_eq!(text_for(kind::HEAL, 12), b"+12");
        assert_eq!(text_for(kind::CRIT, 40), b"40!");
        assert_eq!(text_for(kind::MISS, 0), b"MISS");
        assert_eq!(text_width(b"12", 1), 7);
        assert_eq!(text_width(b"12", 2), 14);
    }

    #[test]
    fn draws_then_fades_out() {
        let mut fb = Framebuffer::new(64, 64);
        let count = |fb: &Framebuffer| fb.color.iter().filter(|&&c| c == FN_DMG).count();
        let mut f = Floater {
            unit: "u".into(),
            at: None,
            text: b"8".to_vec(),
            kind: kind::DAMAGE,
            age: 0.0,
            dx: 0.0,
        };
        draw(&mut fb, &f, 32.0, 50.0);
        let fresh = count(&fb);
        assert!(fresh >= 7);
        let mut fb = Framebuffer::new(64, 64);
        f.age = LIFE;
        draw(&mut fb, &f, 32.0, 50.0);
        assert_eq!(count(&fb), 0);
    }
}
