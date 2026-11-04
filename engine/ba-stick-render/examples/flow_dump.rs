use ba_stick_render::pixel_water::{WaterField, WaterLayout};
use ba_stick_render::zone::Zone;
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let z = Zone::parse(&std::fs::read(&a[1]).unwrap()).unwrap();
    let l = WaterLayout::parse(&std::fs::read(std::path::Path::new(&a[1]).with_extension("wfl")).unwrap()).unwrap();
    let f = WaterField::from_zone(&z, Some(&l));
    let (cx, cz, st): (f32, f32, f32) = (a[2].parse().unwrap(), a[3].parse().unwrap(), a.get(4).map(|s| s.parse().unwrap()).unwrap_or(1.5));
    for j in (-12..=12).rev() {
        let mut row = String::new();
        for i in -30..=30 {
            let s = f.sample(cx + i as f32 * st, cz + j as f32 * st);
            row.push(if s.sdist <= 0.0 { '.' } else {
                let m = s.flow[0].hypot(s.flow[1]);
                if m < 0.03 { 'o' } else {
                    let ang = s.flow[1].atan2(s.flow[0]).to_degrees();
                    let c = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'][(((ang + 22.5).rem_euclid(360.0)) / 45.0) as usize % 8];
                    if m > 0.8 { c } else if m > 0.25 { c } else { '·' }
                }
            });
        }
        println!("{row}");
    }
}
