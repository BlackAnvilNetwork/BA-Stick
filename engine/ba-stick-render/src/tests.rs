use crate::*;
use stick_engine::raster::PALETTE;

fn unit(x: f32, z: f32, anim: &str, preset: &str) -> UnitInput {
    UnitInput { x, y: 0.0, z, facing: 0.0, anim: AnimState::parse(anim), preset: preset.into() }
}

#[test]
fn upsert_and_remove() {
    let mut s = Scene::new(320, 180);
    s.upsert_unit("p1", unit(0.0, 0.0, "idle", "knight"));
    s.upsert_unit("m1", unit(2.0, 1.0, "walk", "mob:ashboar"));
    assert_eq!(s.unit_count(), 2);
    s.upsert_unit("p1", unit(1.0, 0.0, "walk", "knight"));
    assert_eq!(s.unit_count(), 2);
    assert!(s.remove_unit("m1"));
    assert!(!s.remove_unit("m1"));
    assert_eq!(s.unit_count(), 1);
}

#[test]
fn anim_mapping() {
    assert_eq!(AnimState::parse("melee").clip(), "swing");
    assert_eq!(AnimState::parse("walk").clip(), "walk");
    assert_eq!(AnimState::parse("bogus"), AnimState::Idle);
    let mut s = Scene::new(64, 64);
    s.upsert_unit("a", unit(0.0, 0.0, "idle", "rogue"));
    s.upsert_unit("a", unit(0.0, 0.0, "melee", "rogue"));
    assert_eq!(s.unit_clip("a"), Some("swing"));
}

#[test]
fn new_units_snap_then_interpolate() {
    let mut s = Scene::new(64, 64);
    s.upsert_unit("a", unit(5.0, 5.0, "idle", "cleric"));
    s.tick(1.0 / 60.0);
    assert_eq!(s.unit_pos("a"), Some((5.0, 0.0, 5.0)));
    s.upsert_unit("a", unit(6.0, 5.0, "walk", "cleric"));
    s.tick(1.0 / 60.0);
    let (x, _, _) = s.unit_pos("a").unwrap();
    assert!(x > 5.0 && x < 6.0, "x={x}");
    for _ in 0..120 { s.tick(1.0 / 60.0); }
    assert!((s.unit_pos("a").unwrap().0 - 6.0).abs() < 1e-3);
}

#[test]
fn camera_follow_and_pick() {
    let mut s = Scene::new(320, 180);
    s.upsert_unit("me", unit(10.0, -4.0, "idle", "time_mage"));
    s.follow(Some("me"));
    s.tick(0.016);
    assert_eq!((s.cam.cx, s.cam.cz), (10.0, -4.0));
    let p = s.cam.project(stick_engine::math::v3(12.0, 0.0, 3.0));
    let (x, z) = s.pick_world(p.x, p.y);
    assert!((x - 12.0).abs() < 1e-3 && (z - 3.0).abs() < 1e-3);
    let feet = s.cam.project(stick_engine::math::v3(10.0, 0.0, -4.0));
    assert_eq!(s.pick_unit(feet.x, feet.y - 30.0), Some("me"));
    assert_eq!(s.pick_unit(feet.x + 100.0, feet.y), None);
}

#[test]
fn draws_stick_figure_pixels() {
    let mut s = Scene::new(320, 180);
    s.draw();
    let empty = s.fb.color.clone();
    s.upsert_unit("me", unit(0.0, 0.0, "idle", "knight"));
    s.tick(0.016);
    s.draw();
    let changed = s.fb.color.iter().zip(&empty).filter(|(a, b)| a != b).count();
    assert!(changed > 200, "only {changed} pixels changed");
    let mut rgba = vec![0u8; 320 * 180 * 4];
    s.write_rgba(&mut rgba);
    let body = PALETTE[stick_engine::raster::C_BODY as usize];
    assert!(rgba.chunks(4).any(|p| p[0] == (body >> 16) as u8 && p[1] == (body >> 8) as u8));
}

#[test]
fn presets_resolve() {
    let k = RigPreset::resolve("knight");
    let r = RigPreset::resolve("rogue");
    assert!(k.props.limb_px > r.props.limb_px);
    let pep = RigPreset::resolve("cleric/pepeka");
    assert!(pep.props.head_r > RigPreset::resolve("cleric").props.head_r);
    let _ = RigPreset::resolve("npc:vendor");
    let _ = RigPreset::resolve("unknown-thing");
}

fn tiny_zone(w: u32, h: u32, f: impl Fn(u32, u32) -> (u8, u8, i16)) -> Vec<u8> {
    let mut b = b"BAZ1".to_vec();
    for v in [-2.0f32, -2.0, 0.5] { b.extend_from_slice(&v.to_le_bytes()); }
    b.extend_from_slice(&w.to_le_bytes());
    b.extend_from_slice(&h.to_le_bytes());
    let n = (w * h) as usize;
    let (mut bio, mut fl, mut hg) = (vec![0u8; n], vec![0u8; n], Vec::new());
    for j in 0..h { for i in 0..w {
        let (a, c, d) = f(i, j);
        bio[(j * w + i) as usize] = a; fl[(j * w + i) as usize] = c; hg.extend_from_slice(&d.to_le_bytes());
    } }
    b.extend(bio); b.extend(fl); b.extend(hg);
    b
}

#[test]
fn zone_parse_and_height() {
    let bytes = tiny_zone(9, 9, |i, _| (13, 0, (i as i16) * 100));
    let mut s = Scene::new(320, 180);
    assert!(s.load_zone(b"nope").is_err());
    s.load_zone(&bytes).unwrap();
    assert!(s.has_zone());
    // x = -2 + i*0.5 → h = i metres
    assert!((s.zone_height(-1.0, 0.0) - 2.0).abs() < 1e-4);
    assert!((s.zone_height(-0.75, 0.0) - 2.5).abs() < 1e-4);
}

#[test]
fn zone_draws_biome_colours_and_units_stand_on_it() {
    let bytes = tiny_zone(40, 40, |i, j| (13, if i == j { zone::F_TRAIL } else { 0 }, 300));
    let mut s = Scene::new(320, 180);
    s.load_zone(&bytes).unwrap();
    s.upsert_unit("me", UnitInput { x: 5.0, y: 3.0, z: 5.0, facing: 0.0, anim: AnimState::Idle, preset: "knight".into() });
    s.follow(Some("me"));
    for _ in 0..120 { s.tick(1.0 / 60.0); }
    assert!((s.cam_y - 3.0).abs() < 0.05, "cam_y={}", s.cam_y);
    s.draw();
    let grass = palette::BIOME0 + 13 * 3 + 1;
    let trail = palette::TRAIL_DIRT + 1;
    assert!(s.fb.color.iter().filter(|&&c| c == grass).count() > 1000);
    assert!(s.fb.color.iter().any(|&c| c == trail));
    // Picking the unit's feet on relief returns the unit position.
    let feet = s.cam.project(stick_engine::math::v3(5.0, 0.0, 5.0));
    let (x, z) = s.pick_world(feet.x, feet.y);
    assert!((x - 5.0).abs() < 0.05 && (z - 5.0).abs() < 0.05, "{x},{z}");
}
