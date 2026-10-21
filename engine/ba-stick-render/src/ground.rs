//! Height-aware iso ground: painter's-order quads over the baked zone grid.
use stick_engine::camera::{Camera, P2, HEIGHT_PX, ISO_Y};
use stick_engine::math::v3;
use stick_engine::raster::Framebuffer;

use crate::palette::*;
use crate::zone::*;

/// Fill a triangle into the colour buffer (no depth).
pub fn fill_tri(fb: &mut Framebuffer, a: P2, b: P2, c: P2, col: u8) {
    let min_x = a.x.min(b.x).min(c.x).floor().max(0.0) as i32;
    let max_x = a.x.max(b.x).max(c.x).ceil().min(fb.w as f32 - 1.0) as i32;
    let min_y = a.y.min(b.y).min(c.y).floor().max(0.0) as i32;
    let max_y = a.y.max(b.y).max(c.y).ceil().min(fb.h as f32 - 1.0) as i32;
    if min_x > max_x || min_y > max_y {
        return;
    }
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if area.abs() < 1e-6 {
        return;
    }
    let s = area.signum();
    let w = fb.w;
    for y in min_y..=max_y {
        let py = y as f32 + 0.5;
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let w0 = ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)) * s;
            let w1 = ((c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x)) * s;
            let w2 = ((a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x)) * s;
            if w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0 {
                fb.color[y as usize * w + x as usize] = col;
            }
        }
    }
}

fn cell_color(z: &Zone, i: i32, j: i32, time: f32) -> u8 {
    let k = z.idx(i, j);
    let f = z.flags[k];
    let h00 = z.height[k];
    let h11 = z.height[z.idx(i + 1, j + 1)];
    // Slopes facing the viewer (+x+z) read lit; away read shadow.
    let d = h00 - h11;
    let shade = if d > 0.18 { 0 } else if d < -0.18 { 2 } else { 1 };
    if f & F_WATER != 0 {
        let wave = ((i as f32 * 0.7 + j as f32 * 0.4 + time * 2.2).sin() * 1.6 + 1.6) as u8;
        return WATER + wave.min(3);
    }
    if f & F_BRIDGE != 0 {
        return BRIDGE + shade;
    }
    if f & F_TRAIL != 0 {
        return if f & F_STONE != 0 { TRAIL_STONE + shade } else { TRAIL_DIRT + shade };
    }
    let b = z.biome[k].min(15);
    BIOME0 + b * 3 + shade
}

/// Draw the zone. `cam_y` is subtracted from all heights so the camera's
/// reference height sits at the screen centre line.
pub fn draw_zone(fb: &mut Framebuffer, cam: &Camera, zone: &Zone, cam_y: f32, time: f32) {
    fb.color.fill(crate::atmosphere::SKY);
    // Visible world rectangle at reference height, plus a margin for relief.
    let margin_m = 4.0 + 12.0 * HEIGHT_PX / ISO_Y / 2.0;
    let corners = [(0.0, 0.0), (fb.w as f32, 0.0), (0.0, fb.h as f32), (fb.w as f32, fb.h as f32)];
    let (mut x0, mut x1, mut z0, mut z1) = (f32::MAX, f32::MIN, f32::MAX, f32::MIN);
    for (sx, sy) in corners {
        let (x, z) = cam.unproject_ground(sx, sy);
        x0 = x0.min(x);
        x1 = x1.max(x);
        z0 = z0.min(z);
        z1 = z1.max(z);
    }
    let (i0, j0) = zone.cell_of(x0 - margin_m, z0 - margin_m);
    let (i1, j1) = zone.cell_of(x1 + margin_m, z1 + margin_m);
    let i0 = i0.max(0);
    let j0 = j0.max(0);
    let i1 = i1.min(zone.w as i32 - 2);
    let j1 = j1.min(zone.h as i32 - 2);
    if i0 > i1 || j0 > j1 {
        return;
    }
    let c = zone.cell;
    let pt = |i: i32, j: i32| {
        let h = zone.height[zone.idx(i, j)] - cam_y;
        cam.project(v3(zone.min_x + i as f32 * c, h, zone.min_z + j as f32 * c))
    };
    // Back to front: increasing i + j.
    for s in (i0 + j0)..=(i1 + j1) {
        let ilo = i0.max(s - j1);
        let ihi = i1.min(s - j0);
        for i in ilo..=ihi {
            let j = s - i;
            let (p00, p10, p01, p11) = (pt(i, j), pt(i + 1, j), pt(i, j + 1), pt(i + 1, j + 1));
            if p11.y < -2.0 || p00.y > fb.h as f32 + 2.0 + 300.0 {
                continue;
            }
            let col = cell_color(zone, i, j, time);
            fill_tri(fb, p00, p10, p11, col);
            fill_tri(fb, p00, p11, p01, col);
        }
    }
}
