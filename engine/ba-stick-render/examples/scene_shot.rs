// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Offline scene render for review shots (zone + props + units, game renderer).
//! cargo run --release --example scene_shot -- <zone.baz|-> <zone.bap|-> <units.txt> <iso|tp> <w> <h> <out.ppm>
//! units.txt: one unit per line: `id x z facing preset anim` (y from the zone; first line is followed).
use ba_stick_render::preset::AnimState;
use ba_stick_render::scene::{Scene, UnitInput};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (w, h): (usize, usize) = (a[5].parse().unwrap(), a[6].parse().unwrap());
    let mut s = Scene::new(w, h);
    if a[1] != "-" {
        s.load_zone(&std::fs::read(&a[1]).unwrap()).unwrap();
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
    s.set_cam_mode(&a[4]);
    for _ in 0..120 {
        s.tick(1.0 / 60.0);
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
