// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Boot menu backdrop — color blots (reference layout) + slow content-aware drift pixels.
use stick_engine::raster::Framebuffer;

use crate::atmosphere::Light;
use crate::palette::*;

const VOID: u8 = crate::atmosphere::SKY;

struct Blot {
    nx: f32,
    ny: f32,
    rx: f32,
    ry: f32,
    c: u8,
    w: f32,
}

/// Normalized screen ellipses — tuned to cavern reference (left monolith, right lava portal, mesa).
const BLOTS: &[Blot] = &[
    // Void / vignette
    Blot { nx: 0.50, ny: 0.06, rx: 0.64, ry: 0.13, c: VOID, w: 1.0 },
    Blot { nx: 0.50, ny: 0.94, rx: 0.72, ry: 0.16, c: VOID, w: 0.9 },
    Blot { nx: 0.03, ny: 0.50, rx: 0.12, ry: 0.58, c: VOID, w: 0.8 },
    Blot { nx: 0.97, ny: 0.48, rx: 0.12, ry: 0.58, c: VOID, w: 0.8 },
    // Ceiling teeth
    Blot { nx: 0.38, ny: 0.14, rx: 0.22, ry: 0.08, c: ROCK_D, w: 0.65 },
    Blot { nx: 0.58, ny: 0.12, rx: 0.26, ry: 0.09, c: ROCK_D, w: 0.7 },
    Blot { nx: 0.72, ny: 0.16, rx: 0.18, ry: 0.07, c: ROCK_D, w: 0.55 },
    // Foreground mesa + hero footing
    Blot { nx: 0.38, ny: 0.88, rx: 0.62, ry: 0.22, c: ROCK_D, w: 1.2 },
    Blot { nx: 0.26, ny: 0.82, rx: 0.20, ry: 0.14, c: ROCK, w: 0.75 },
    Blot { nx: 0.30, ny: 0.78, rx: 0.14, ry: 0.10, c: ROCK_L, w: 0.45 },
    Blot { nx: 0.22, ny: 0.86, rx: 0.11, ry: 0.09, c: ROCK_D, w: 0.85 },
    Blot { nx: 0.36, ny: 0.84, rx: 0.10, ry: 0.08, c: ROCK_D, w: 0.75 },
    Blot { nx: 0.28, ny: 0.74, rx: 0.08, ry: 0.06, c: COAL, w: 0.35 },
    // Left monolith + arch glow
    Blot { nx: 0.14, ny: 0.50, rx: 0.16, ry: 0.42, c: ROCK_D, w: 1.05 },
    Blot { nx: 0.20, ny: 0.38, rx: 0.10, ry: 0.34, c: ROCK, w: 0.7 },
    Blot { nx: 0.24, ny: 0.40, rx: 0.13, ry: 0.28, c: COAL, w: 0.9 },
    Blot { nx: 0.22, ny: 0.43, rx: 0.08, ry: 0.24, c: EMBER, w: 1.15 },
    Blot { nx: 0.26, ny: 0.48, rx: 0.05, ry: 0.20, c: EMBER, w: 0.85 },
    Blot { nx: 0.19, ny: 0.32, rx: 0.06, ry: 0.14, c: COAL, w: 0.6 },
    Blot { nx: 0.17, ny: 0.36, rx: 0.04, ry: 0.18, c: EMBER, w: 0.65 },
    Blot { nx: 0.21, ny: 0.52, rx: 0.04, ry: 0.16, c: COAL, w: 0.55 },
    // Circuit veins (left pillar)
    Blot { nx: 0.18, ny: 0.34, rx: 0.025, ry: 0.10, c: EMBER, w: 0.7 },
    Blot { nx: 0.20, ny: 0.42, rx: 0.022, ry: 0.12, c: COAL, w: 0.65 },
    Blot { nx: 0.16, ny: 0.46, rx: 0.02, ry: 0.11, c: EMBER, w: 0.6 },
    Blot { nx: 0.22, ny: 0.36, rx: 0.02, ry: 0.09, c: EMBER, w: 0.55 },
    // Main lava portal (right)
    Blot { nx: 0.70, ny: 0.37, rx: 0.32, ry: 0.38, c: COAL, w: 1.05 },
    Blot { nx: 0.72, ny: 0.35, rx: 0.22, ry: 0.28, c: EMBER, w: 1.45 },
    Blot { nx: 0.68, ny: 0.39, rx: 0.14, ry: 0.20, c: EMBER, w: 1.2 },
    Blot { nx: 0.76, ny: 0.33, rx: 0.11, ry: 0.16, c: EMBER, w: 1.0 },
    Blot { nx: 0.64, ny: 0.41, rx: 0.10, ry: 0.14, c: COAL, w: 0.85 },
    Blot { nx: 0.74, ny: 0.42, rx: 0.08, ry: 0.22, c: EMBER, w: 0.75 },
    Blot { nx: 0.80, ny: 0.38, rx: 0.07, ry: 0.18, c: COAL, w: 0.6 },
    // Portal frame / right wall
    Blot { nx: 0.86, ny: 0.42, rx: 0.14, ry: 0.44, c: ROCK_D, w: 0.9 },
    Blot { nx: 0.78, ny: 0.28, rx: 0.12, ry: 0.12, c: ROCK, w: 0.55 },
    // Mid-chamber haze
    Blot { nx: 0.50, ny: 0.46, rx: 0.40, ry: 0.26, c: COAL, w: 0.38 },
    Blot { nx: 0.44, ny: 0.52, rx: 0.28, ry: 0.18, c: ROCK_D, w: 0.32 },
    Blot { nx: 0.58, ny: 0.28, rx: 0.20, ry: 0.11, c: ROCK_D, w: 0.48 },
    Blot { nx: 0.46, ny: 0.30, rx: 0.14, ry: 0.09, c: COAL, w: 0.35 },
    // Distant warm floor reflection
    Blot { nx: 0.62, ny: 0.58, rx: 0.22, ry: 0.12, c: COAL, w: 0.28 },
    Blot { nx: 0.40, ny: 0.62, rx: 0.18, ry: 0.10, c: ROCK_D, w: 0.25 },
    // Terminals (dark pads)
    Blot { nx: 0.14, ny: 0.80, rx: 0.08, ry: 0.07, c: ROCK_D, w: 0.7 },
    Blot { nx: 0.40, ny: 0.81, rx: 0.09, ry: 0.07, c: ROCK_D, w: 0.65 },
];

fn hash2(x: f32, y: f32, t: f32) -> f32 {
    let s = (x * 12.9898 + y * 78.233 + t * 0.017).sin() * 43758.547;
    s - s.floor()
}

fn blot_weight(b: &Blot, nx: f32, ny: f32) -> f32 {
    let dx = (nx - b.nx) / b.rx;
    let dy = (ny - b.ny) / b.ry;
    let d2 = dx * dx + dy * dy;
    if d2 >= 1.0 {
        return 0.0;
    }
    let t = 1.0 - d2;
    b.w * t * t
}

fn vote_top2(nx: f32, ny: f32) -> (u8, f32, u8, f32) {
    let mut best = (VOID, 0.0f32);
    let mut second = (VOID, 0.0f32);
    for b in BLOTS {
        let w = blot_weight(b, nx, ny);
        if w > best.1 {
            second = best;
            best = (b.c, w);
        } else if w > second.1 {
            second = (b.c, w);
        }
    }
    (best.0, best.1, second.0, second.1)
}

/// Neighbor-aware mix so pixels pick up adjacent blot colors (grass-style transitions).
fn sample_content_aware(px: f32, py: f32, w: f32, h: f32, t: f32) -> u8 {
    let nx = px / w;
    let ny = py / h;
    let (c0, w0, c1, w1) = vote_top2(nx, ny);
    if w0 < 0.015 {
        return VOID;
    }
    if c1 != c0 && w1 > w0 * 0.38 {
        let edge = (w0 / (w0 + w1 + 1e-4)).clamp(0.0, 1.0);
        if hash2(px, py, t) > edge {
            return c1;
        }
    }
    let r = 16.0 / w.min(h);
    let mut alt = c0;
    let mut alt_w = 0.0f32;
    for (dx, dy) in [(r, 0.0), (-r, 0.0), (0.0, r), (0.0, -r), (r * 0.65, r * 0.65), (-r * 0.65, r * 0.65)]
    {
        let (c, ww, _, _) = {
            let (a, aw, _, _) = vote_top2(nx + dx, ny + dy);
            (a, aw, VOID, 0.0)
        };
        if c != c0 && ww > alt_w {
            alt_w = ww;
            alt = c;
        }
    }
    if alt != c0 && alt_w > w0 * 0.65 {
        let edge = (w0 / (w0 + alt_w + 1e-4)).clamp(0.0, 1.0);
        if hash2(px + 3.0, py - 2.0, t + nx) > edge {
            return alt;
        }
    }
    c0
}

fn heat_class(c: u8) -> bool {
    c == EMBER || c == COAL
}

fn heat_weight(nx: f32, ny: f32) -> f32 {
    let mut h = 0.0f32;
    for b in BLOTS {
        if !heat_class(b.c) {
            continue;
        }
        h += blot_weight(b, nx, ny);
    }
    h
}

fn brighten_mote(base: u8, px: f32, py: f32, t: f32) -> u8 {
    if base == EMBER {
        return EMBER;
    }
    if base == COAL && hash2(px * 0.7, py * 0.9, t) > 0.48 {
        return EMBER;
    }
    if base == ROCK && hash2(px, py, t + 3.0) > 0.78 {
        return COAL;
    }
    base
}

fn base_step(fb: &Framebuffer) -> usize {
    let w = fb.w as f32;
    if w >= 1280.0 {
        2
    } else if w >= 640.0 {
        2
    } else {
        1
    }
}

fn paint_blot_base(fb: &mut Framebuffer) {
    let w = fb.w as f32;
    let h = fb.h as f32;
    let step = base_step(fb);
    let mut y = 0usize;
    while y < fb.h {
        let mut x = 0usize;
        while x < fb.w {
            let c = sample_content_aware(x as f32 + 0.5, y as f32 + 0.5, w, h, 0.0);
            for dy in 0..step {
                for dx in 0..step {
                    let xx = x + dx;
                    let yy = y + dy;
                    if xx < fb.w && yy < fb.h {
                        fb.color[yy * fb.w + xx] = c;
                    }
                }
            }
            x += step;
        }
        y += step;
    }
}

fn paint_drift_pixels(fb: &mut Framebuffer, t: f32, layer: u32) {
    let w = fb.w as f32;
    let h = fb.h as f32;
    let step = if layer == 0 { 2usize } else { 3usize };
    let time = t * (0.55 + layer as f32 * 0.15);
    let spawn_cutoff = if layer == 0 { 0.54f32 } else { 0.72f32 };
    let mut y = layer as usize;
    while y < fb.h {
        let mut x = (layer * 7) as usize % step;
        while x < fb.w {
            let h0 = hash2(x as f32 + layer as f32 * 17.0, y as f32, time);
            if h0 > spawn_cutoff {
                x += step;
                continue;
            }
            let drift_x = (time * 0.09 + h0 * 6.28).sin() * (1.4 + layer as f32 * 0.5)
                + (time * 0.04 + x as f32 * 0.018).cos() * 0.7;
            let drift_y = -time * (1.6 + layer as f32 * 0.35) - h0 * 3.5
                + (time * 0.06 + y as f32 * 0.012).sin() * 0.9;
            let px = x as f32 + 0.5 + drift_x;
            let py = y as f32 + 0.5 + drift_y;
            if px < 0.0 || py < 0.0 || px >= w || py >= h {
                x += step;
                continue;
            }
            let nx = px / w;
            let ny = py / h;
            let hw = heat_weight(nx, ny);
            let base = sample_content_aware(px, py, w, h, time);
            if hw < 0.08 && !heat_class(base) && hash2(px, py, time) > 0.28 {
                x += step;
                continue;
            }
            let c = brighten_mote(base, px, py, time);
            fb.plot(px as i32, py as i32, -0.5 - layer as f32 * 0.01, c);
            if layer == 1 && hw > 0.35 && hash2(px, py, time + 1.0) > 0.82 {
                fb.plot(px as i32 + 1, py as i32, -0.52, EMBER);
            }
            x += step;
        }
        y += step;
    }
}

/// Vertical ember streaks on the left monolith (circuit read).
fn paint_vein_pixels(fb: &mut Framebuffer, t: f32) {
    let w = fb.w as f32;
    let h = fb.h as f32;
    for i in 0..120 {
        let s = i as f32;
        let nx = 0.17 + hash2(s, 2.0, 0.0) * 0.08;
        let ny = 0.30 + (s / 120.0) * 0.38 + (t * 0.025 + s * 0.08).sin() * 0.008;
        let px = nx * w;
        let py = ny * h;
        let c = sample_content_aware(px, py, w, h, t + s);
        if !heat_class(c) && c != ROCK {
            continue;
        }
        let col = if hash2(s, t, px) > 0.4 { EMBER } else { COAL };
        fb.plot(px as i32, py as i32, -0.48, col);
        if hash2(s, px, t) > 0.7 {
            fb.plot(px as i32, (py + 1.0) as i32, -0.47, col);
        }
    }
}

fn push_blot_lights(fb: &Framebuffer, t: f32, lights: &mut Vec<Light>) {
    let w = fb.w as f32;
    let h = fb.h as f32;
    let flick = 1.0 + 0.1 * (t * 8.0).sin() + 0.06 * (t * 4.7).sin();
    let mut ranked: Vec<(f32, f32, f32, f32)> = Vec::new();
    for b in BLOTS {
        if b.c != EMBER || b.w < 0.75 {
            continue;
        }
        ranked.push((b.w * b.rx * b.ry, b.nx * w, b.ny * h, b.rx * w * 1.2));
    }
    ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    for (_, x, y, r) in ranked.into_iter().take(5) {
        lights.push(Light { x, y, r: r * flick, k: 0.92 * flick });
    }
    lights.push(Light {
        x: 0.24 * w,
        y: 0.42 * h,
        r: 140.0 * flick,
        k: 0.55 * flick,
    });
}

/// Full-screen forge composition (blots + drifting pixels); hero draws on top in `scene`.
pub fn draw(fb: &mut Framebuffer, t: f32, lights: &mut Vec<Light>) {
    fb.color.fill(VOID);
    paint_blot_base(fb);
    paint_drift_pixels(fb, t, 0);
    paint_drift_pixels(fb, t, 1);
    paint_vein_pixels(fb, t);
    push_blot_lights(fb, t, lights);
}
