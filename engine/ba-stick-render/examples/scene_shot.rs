// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Offline scene render for review shots (zone + props + units, game renderer).
//! cargo run --release --example scene_shot -- <zone.baz|-> <zone.bap|-> <units.txt> <iso|tp> <w> <h> <out.ppm>
//! units.txt: one unit per line: `id x z facing preset anim` (y from the zone; first line is followed).
//! Optional 8th arg, a light mood: `r,g,b,playerRadius,playerStrength,glow` (lighting overhaul).
//! Optional 9th arg, extra lights: `x,z,kind[,radius];...` (world metres, kind as `addLight`).
use ba_stick_render::preset::AnimState;
use ba_stick_render::scene::{Scene, UnitInput};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (w, h): (usize, usize) = (a[5].parse().unwrap(), a[6].parse().unwrap());
    let mut s = Scene::new(w, h);
    if a[1] != "-" {
        s.load_zone(&std::fs::read(&a[1]).unwrap()).unwrap();
        let wfl = std::path::Path::new(&a[1]).with_extension("wfl");
        match std::fs::read(&wfl) {
            Ok(bytes) => {
                if let Err(e) = s.load_water_layout(&bytes, 0.0, 0.0) {
                    eprintln!("wfl {}: {e}", wfl.display());
                }
            }
            Err(e) => eprintln!("wfl {}: {e}", wfl.display()),
        }
    }
    if a[2] != "-" {
        s.load_props(&std::fs::read(&a[2]).unwrap()).unwrap();
    }
    let text = std::fs::read_to_string(&a[3]).unwrap();
    let mut first: Option<String> = None;
    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let f: Vec<&str> = line.split_whitespace().collect();
        let (x, z, facing): (f32, f32, f32) = (f[1].parse().unwrap(), f[2].parse().unwrap(), f[3].parse().unwrap());
        let anim = match f.get(5).copied().unwrap_or("idle") {
            "walk" => AnimState::Walk,
            _ => AnimState::Idle,
        };
        let y = if s.has_zone() { s.zone_height(x, z) } else { 0.0 };
        s.upsert_unit(f[0], UnitInput { x, y, z, facing, anim, preset: f[4].to_string() });
        if first.is_none() {
            first = Some(f[0].to_string());
        }
    }
    s.follow(first.as_deref());
    if let Some(m) = a.get(8) {
        let v: Vec<f32> = m.split(',').map(|x| x.parse().unwrap()).collect();
        let mood = ba_stick_render::lighting::Mood { ambient: [v[0], v[1], v[2]], warm: [1.0, 0.6, 0.25], player_r: v[3], player_k: v[4], glow: v[5], night: v.get(6).copied().unwrap_or(1.0) };
        s.set_light_mood(mood, true);
    }
    if let Some(l) = a.get(9) {
        for e in l.split(';').filter(|e| !e.is_empty()) {
            let v: Vec<f32> = e.split(',').map(|x| x.parse().unwrap()).collect();
            s.add_light(v[0], f32::NAN, v[1], v[2] as u8, v.get(3).copied().unwrap_or(0.0), 0);
        }
    }
    s.set_cam_mode(&a[4]);
    // Time of day 0..1 (0 midnight, 0.5 noon) for night shots (`SHOT_PHASE=0.02`).
    if let Some(p) = std::env::var("SHOT_PHASE").ok().and_then(|p| p.parse().ok()) {
        s.set_time_of_day(p);
    }
    // `SHOT_TICKS` (default 120) steps the clock, for frame sequences.
    let ticks: u32 = std::env::var("SHOT_TICKS").ok().and_then(|v| v.parse().ok()).unwrap_or(120);
    for _ in 0..ticks {
        s.tick(1.0 / 60.0);
    }
    // A spell flash at the followed unit for the effect-light shot (`SHOT_FLASH=1`).
    if std::env::var("SHOT_FLASH").is_ok() {
        if let Some(id) = first.as_deref() {
            s.spawn_vfx(ba_stick_render::vfx::Prim::Burst, id, Some(id), 0x8fc8ff, 12, 1.2, 0);
            for _ in 0..4 {
                s.tick(1.0 / 60.0);
            }
        }
    }
    s.draw();
    let mut rgba = vec![0u8; w * h * 4];
    s.write_rgba(&mut rgba);
    let mut out = format!("P6\n{} {}\n255\n", w, h).into_bytes();
    for p in rgba.chunks(4) {
        out.extend_from_slice(&p[..3]);
    }
    std::fs::write(&a[7], out).unwrap();
}
