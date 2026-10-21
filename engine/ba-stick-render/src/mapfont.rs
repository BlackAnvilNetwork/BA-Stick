// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Compact variable-width 5-row pixel font for minimap labels (uppercase,
//! digits, a little punctuation). Glyphs are 1..5 columns wide.

/// Rows top to bottom; bit (w-1-col) set = ink. Returns (width, rows).
pub fn glyph(c: u8) -> (u8, [u8; 5]) {
    let c = c.to_ascii_uppercase();
    let g = |s: &str| -> (u8, [u8; 5]) {
        let rows: Vec<&str> = s.split('|').collect();
        let w = rows[0].len() as u8;
        let mut out = [0u8; 5];
        for (r, row) in rows.iter().enumerate().take(5) {
            out[r] = row.bytes().fold(0u8, |a, b| (a << 1) | (b == b'#') as u8);
        }
        (w, out)
    };
    match c {
        b'A' => g(".#.|#.#|###|#.#|#.#"),
        b'B' => g("##.|#.#|##.|#.#|##."),
        b'C' => g(".##|#..|#..|#..|.##"),
        b'D' => g("##.|#.#|#.#|#.#|##."),
        b'E' => g("###|#..|##.|#..|###"),
        b'F' => g("###|#..|##.|#..|#.."),
        b'G' => g(".##|#..|#.#|#.#|.##"),
        b'H' => g("#.#|#.#|###|#.#|#.#"),
        b'I' => g("###|.#.|.#.|.#.|###"),
        b'J' => g("..#|..#|..#|#.#|.#."),
        b'K' => g("#.#|#.#|##.|#.#|#.#"),
        b'L' => g("#..|#..|#..|#..|###"),
        b'M' => g("#...#|##.##|#.#.#|#...#|#...#"),
        b'N' => g("#..#|##.#|#.##|#..#|#..#"),
        b'O' => g(".#.|#.#|#.#|#.#|.#."),
        b'P' => g("##.|#.#|##.|#..|#.."),
        b'Q' => g(".#.|#.#|#.#|#.#|.##"),
        b'R' => g("##.|#.#|##.|#.#|#.#"),
        b'S' => g(".##|#..|.#.|..#|##."),
        b'T' => g("###|.#.|.#.|.#.|.#."),
        b'U' => g("#.#|#.#|#.#|#.#|###"),
        b'V' => g("#.#|#.#|#.#|#.#|.#."),
        b'W' => g("#...#|#...#|#.#.#|##.##|#...#"),
        b'X' => g("#.#|#.#|.#.|#.#|#.#"),
        b'Y' => g("#.#|#.#|.#.|.#.|.#."),
        b'Z' => g("###|..#|.#.|#..|###"),
        b'0' => g("###|#.#|#.#|#.#|###"),
        b'1' => g(".#.|##.|.#.|.#.|###"),
        b'2' => g("##.|..#|.#.|#..|###"),
        b'3' => g("##.|..#|.#.|..#|##."),
        b'4' => g("#.#|#.#|###|..#|..#"),
        b'5' => g("###|#..|##.|..#|##."),
        b'6' => g(".##|#..|###|#.#|###"),
        b'7' => g("###|..#|.#.|.#.|.#."),
        b'8' => g("###|#.#|###|#.#|###"),
        b'9' => g("###|#.#|###|..#|##."),
        b'\'' => g("#|#|.|.|."),
        b'.' => g(".|.|.|.|#"),
        b'-' => g("..|..|##|..|.."),
        b' ' => (2, [0; 5]),
        _ => (2, [0; 5]),
    }
}

/// Pixel width of `s` at `scale` with 1-pixel letter spacing.
pub fn width(s: &str, scale: usize) -> usize {
    width_spaced(s, scale, 1)
}

/// Pixel width with `gap` pixels between letters.
pub fn width_spaced(s: &str, scale: usize, gap: usize) -> usize {
    if s.is_empty() {
        return 0;
    }
    s.bytes().map(|c| glyph(c).0 as usize + gap).sum::<usize>() * scale - gap * scale
}

/// Calls `ink(x, y)` for every lit pixel of `s` placed with its top-left at (0, 0).
pub fn raster(s: &str, scale: usize, ink: impl FnMut(usize, usize)) {
    raster_spaced(s, scale, 1, ink)
}

/// [`raster`] with `gap` pixels between letters.
pub fn raster_spaced(s: &str, scale: usize, gap: usize, mut ink: impl FnMut(usize, usize)) {
    let mut ox = 0;
    for c in s.bytes() {
        let (w, rows) = glyph(c);
        for (r, bits) in rows.iter().enumerate() {
            for col in 0..w as usize {
                if bits >> (w as usize - 1 - col) & 1 != 0 {
                    for sy in 0..scale {
                        for sx in 0..scale {
                            ink(ox + col * scale + sx, r * scale + sy);
                        }
                    }
                }
            }
        }
        ox += (w as usize + gap) * scale;
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_letter_and_digit_has_ink() {
        for c in (b'A'..=b'Z').chain(b'0'..=b'9') {
            let (w, rows) = super::glyph(c);
            assert!(w >= 3 && rows.iter().any(|&r| r != 0), "{}", c as char);
        }
        assert_eq!(super::width("AB", 1), 7);
    }
}
