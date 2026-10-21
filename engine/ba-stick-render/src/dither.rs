//! Shared ordered dither (round 1 polish). Screen- or world-anchored 4×4 Bayer
//! thresholds plus the palette "one shade step darker" lookup used by contact
//! shadows. No new palette entries: darkening reuses each ground ramp's own
//! shadow step.
use crate::compat::C_SHADOW;
use crate::palette::*;

const BAYER4: [u8; 16] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/// Threshold in [0, 1) for pixel (x, y). Works for negative coords.
#[inline]
pub fn bayer4(x: i32, y: i32) -> f32 {
    (BAYER4[((y & 3) * 4 + (x & 3)) as usize] as f32 + 0.5) / 16.0
}

/// True when a pixel should take the "on" colour at coverage `level` (0..1).
#[inline]
pub fn on(x: i32, y: i32, level: f32) -> bool {
    level > bayer4(x, y)
}

/// Ground ramps laid out as base + shade (0 lit, 1 mid, 2 shadow).
#[inline]
fn ramp3(c: u8) -> Option<(u8, u8)> {
    match c {
        BIOME0..=63 => Some((c - (c - BIOME0) % 3, (c - BIOME0) % 3)),
        TRAIL_DIRT..=69 => Some((c - (c - TRAIL_DIRT) % 3, (c - TRAIL_DIRT) % 3)),
        _ => None,
    }
}

/// Ramp step (0 lit, 1 mid, 2 shadow) of a ground-ramp index.
#[inline]
pub fn shade_step(c: u8) -> Option<u8> {
    ramp3(c).map(|(_, s)| s)
}

/// One step darker on the same ramp; the darkest step falls to `C_SHADOW`.
/// Colours outside the ground ramps are returned unchanged (`None`).
#[inline]
pub fn darker(c: u8) -> Option<u8> {
    let (base, shade) = ramp3(c)?;
    Some(if shade < 2 { base + 2 } else { C_SHADOW })
}

/// Soft contact shadow: an ellipse that darkens ground pixels one ramp step.
/// Solid core (AO) inside ~60% radius, ordered-dither falloff outside. Only
/// pixels with no depth (bare ground) are touched, so props and units stay clean.
pub fn soft_shadow(fb: &mut stick_engine::raster::Framebuffer, cx: f32, cy: f32, rx: f32, ry: f32, strength: f32) {
    soft_shadow_on(fb, cx, cy, rx, ry, strength, None);
}

/// Depth window (world units of x+z) for S4: a unit's shadow may land on
/// drawn geometry (bridge decks) whose depth is this close to its feet, as
/// long as that pixel is on a ground/deck ramp.
pub const DECK_TOL: f32 = 0.6;

/// `soft_shadow` that, with `foot = Some(depth)`, also darkens deck pixels
/// near the unit's foot depth (S4: shadows on bridges).
#[allow(clippy::too_many_arguments)]
pub fn soft_shadow_on(fb: &mut stick_engine::raster::Framebuffer, cx: f32, cy: f32, rx: f32, ry: f32, strength: f32, foot: Option<f32>) {
    if rx < 0.5 || ry < 0.5 {
        return;
    }
    let (w, h) = (fb.w as i32, fb.h as i32);
    let (x0, x1) = (((cx - rx) as i32).max(0), ((cx + rx) as i32).min(w - 1));
    let (y0, y1) = (((cy - ry) as i32).max(0), ((cy + ry) as i32).min(h - 1));
    let (irx, iry) = (1.0 / rx, 1.0 / ry);
    for y in y0..=y1 {
        let ny = (y as f32 + 0.5 - cy) * iry;
        let row = y as usize * fb.w;
        for x in x0..=x1 {
            let nx = (x as f32 + 0.5 - cx) * irx;
            let n = nx * nx + ny * ny;
            if n > 1.0 {
                continue;
            }
            let i = row + x as usize;
            let dz = fb.depth[i];
            if dz != f32::INFINITY && !foot.is_some_and(|f| (dz - f).abs() < DECK_TOL) {
                continue;
            }
            let cov = if n < 0.36 { 1.0 } else { (1.0 - n) * 1.5625 } * strength;
            if on(x, y, cov) {
                if let Some(d) = darker(fb.color[i]) {
                    fb.color[i] = d;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bayer_covers_levels_evenly() {
        let n = |lv: f32| (0..4).flat_map(|y| (0..4).map(move |x| (x, y))).filter(|&(x, y)| on(x, y, lv)).count();
        assert_eq!(n(0.0), 0);
        assert_eq!(n(0.5), 8);
        assert_eq!(n(1.0), 16);
        assert_eq!(bayer4(-1, -1), bayer4(3, 3));
    }
    #[test]
    fn darker_stays_on_ramp() {
        assert_eq!(darker(BIOME0), Some(BIOME0 + 2));
        assert_eq!(darker(BIOME0 + 4), Some(BIOME0 + 5));
        assert_eq!(darker(BIOME0 + 5), Some(C_SHADOW));
        assert_eq!(darker(TRAIL_STONE), Some(TRAIL_STONE + 2));
        assert_eq!(darker(WATER), None);
    }
    #[test]
    fn s4_shadow_reaches_deck_only_near_foot_depth() {
        let mut fb = stick_engine::raster::Framebuffer::new(16, 16);
        fb.color.fill(TRAIL_STONE);
        fb.clear_depth();
        for d in fb.depth.iter_mut().take(128) { *d = 5.0; } // top half: deck at depth 5
        soft_shadow_on(&mut fb, 8.0, 8.0, 6.0, 6.0, 1.0, Some(5.2));
        assert!(fb.color[..128].iter().any(|&c| c == TRAIL_STONE + 2), "deck near foot gets shadow");
        let mut fb2 = stick_engine::raster::Framebuffer::new(16, 16);
        fb2.color.fill(TRAIL_STONE);
        for d in fb2.depth.iter_mut() { *d = 9.0; }
        soft_shadow_on(&mut fb2, 8.0, 8.0, 6.0, 6.0, 1.0, Some(5.2));
        assert!(fb2.color.iter().all(|&c| c == TRAIL_STONE), "far geometry untouched");
    }
}
