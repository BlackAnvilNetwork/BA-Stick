// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

//! Offline minimap render through the game's own Minimap::bake (worldgen review).
//! cargo run --example minimap_png -- <zone.baz> <zone.bap> <out.ppm>
use ba_stick_render::{minimap::Minimap, props, zone::Zone};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let zone = Zone::parse(&std::fs::read(&a[1]).unwrap()).unwrap();
    let pr = props::parse(&std::fs::read(&a[2]).unwrap()).unwrap();
    let mut m = Minimap::new();
    m.bake(&zone, &pr);
    let (w, h) = m.tex_size();
    let mut out = format!("P6\n{} {}\n255\n", w, h).into_bytes();
    for t in m.texels() { out.extend_from_slice(&t[..3]); }
    std::fs::write(&a[3], out).unwrap();
    println!("{}x{}", w, h);
}
