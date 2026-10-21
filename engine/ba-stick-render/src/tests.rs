use crate::*;
use crate::compat::PALETTE;

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
    s.follow_lift_px = 0.0;
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
    let body = PALETTE[crate::compat::C_BODY as usize];
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

#[test]
fn every_archetype_and_role_draws() {
    use crate::preset::{MOB_ARCHETYPES, NPC_ROLES};
    let keys: Vec<String> = MOB_ARCHETYPES.iter().map(|a| format!("mob:{a}"))
        .chain(NPC_ROLES.iter().map(|r| format!("npc:{r}")))
        .chain(["knight", "fighter", "rogue", "cleric", "sorcerer", "time_mage", "battle_mage"].iter().map(|j| j.to_string()))
        .collect();
    for key in &keys {
        for anim in ["idle", "walk", "melee", "cast", "dead"] {
            let mut s = Scene::new(160, 160);
            s.upsert_unit("u", unit(0.0, 0.0, anim, key));
            s.tick(0.1);
            s.draw();
            let lit = s.fb.color.iter().filter(|&&c| c != 0 && c != 2 && c != 3 && c != 15 && c != C_SHADOW_IDX).count();
            assert!(lit > 30, "{key} {anim}: only {lit} px");
        }
    }
}
const C_SHADOW_IDX: u8 = crate::compat::C_SHADOW;

#[test]
fn npc_roles_are_distinguishable() {
    use crate::preset::NPC_ROLES;
    let mut seen = std::collections::HashSet::new();
    for r in NPC_ROLES {
        let p = RigPreset::resolve(&format!("npc:{r}"));
        seen.insert((p.look.accent, p.npc_mark, p.weapon as u8));
    }
    assert_eq!(seen.len(), NPC_ROLES.len());
}

#[test]
fn fx_bars_rings_fade_and_anchor() {
    use crate::palette::*;
    let mut s = Scene::new(200, 200);
    s.upsert_unit("m", unit(0.0, 0.0, "cast", "mob:ruin_dweller"));
    s.tick(0.0);
    assert!(!s.set_fx("nope", UnitFx::default()));
    assert!(s.set_fx("m", UnitFx { hp: 0.5, cast: 0.5, aoe: 2.0, flags: crate::scene::FX_SELECTED | crate::scene::FX_HOSTILE, fade: 1.0, level_up: 0.3 }));
    s.draw();
    let has = |c: u8| s.fb.color.iter().any(|&x| x == c);
    for c in [FX_HP, FX_CAST, FX_TELL, FX_RING_HOSTILE, FX_LEVEL] {
        assert!(has(c), "missing colour {c}");
    }
    assert!(s.fb.color.iter().any(|&c| (TINT_CAST..TINT_CAST + 36).contains(&c)), "cast tint");
    let (x, head, feet) = s.anchor("m").unwrap();
    assert!(head < feet && (x - 100.0).abs() < 1.0);
    // Fully faded unit leaves no body pixels.
    let mut s2 = Scene::new(200, 200);
    s2.upsert_unit("d", unit(0.0, 0.0, "idle", "knight"));
    s2.tick(0.0);
    s2.set_fx("d", UnitFx { fade: 0.0, ..UnitFx::default() });
    s2.draw();
    assert!(!s2.fb.color.iter().any(|&c| c == crate::compat::C_BODY));
}

#[test]
fn creatures_animate_with_movement() {
    let mut s = Scene::new(160, 160);
    s.upsert_unit("h", unit(0.0, 0.0, "walk", "mob:dust_hare"));
    s.tick(0.0);
    s.draw();
    let a = s.fb.color.clone();
    s.upsert_unit("h", unit(0.4, 0.0, "walk", "mob:dust_hare"));
    for _ in 0..5 { s.tick(1.0 / 30.0); }
    s.set_camera(0.4, 0.0);
    s.draw();
    assert_ne!(a, s.fb.color);
}

#[test]
fn telegraph_radius_matches_cast_aoe() {
    use crate::palette::FX_TELL;
    let mut s = Scene::new(400, 300);
    s.upsert_unit("m", unit(0.0, 0.0, "cast", "mob:pale_slime"));
    s.tick(0.0);
    let aoe = 3.0;
    s.set_fx("m", UnitFx { cast: 0.5, aoe, flags: crate::scene::FX_HOSTILE, ..UnitFx::default() });
    s.draw();
    let near = |x: f32, z: f32| {
        let p = s.cam.project(stick_engine::math::v3(x, 0.0, z));
        let mut hit = false;
        for dy in -1..=1 {
            for dx in -1..=1 {
                let (px, py) = (p.x as i32 + dx, p.y as i32 + dy);
                if px >= 0 && py >= 0 && (px as usize) < s.fb.w && (py as usize) < s.fb.h {
                    hit |= s.fb.color[py as usize * s.fb.w + px as usize] == FX_TELL;
                }
            }
        }
        hit
    };
    // Outer ring passes through every point at distance `aoe` (sample the
    // near-camera half, the far half can sit behind the body).
    for k in 0..8 {
        let a = std::f32::consts::FRAC_PI_4 * k as f32 * 0.5;
        assert!(near(a.cos() * aoe, a.sin() * aoe), "ring missing at angle {a}");
    }
    assert!(!near(aoe + 0.6, 0.0));
}

#[test]
fn wading_hides_legs_in_water_but_not_on_bridges() {
    // left half water, a bridge strip at i == 5
    let bytes = tiny_zone(40, 40, |i, _| (13, if i == 5 { zone::F_WATER | zone::F_BRIDGE } else if i < 10 { zone::F_WATER } else { 0 }, 0));
    let mut s = Scene::new(320, 180);
    s.load_zone(&bytes).unwrap();
    // zone x = -2 + i*0.5 → i 0..9 water, i 5 bridge (x 0.5..1.0)
    s.upsert_unit("w", unit(0.0, 5.0, "idle", "knight"));
    s.upsert_unit("b", unit(0.75, 8.0, "idle", "knight"));
    s.upsert_unit("d", unit(10.0, 5.0, "idle", "knight"));
    s.tick(0.0);
    assert!(s.is_wading("w"));
    assert!(!s.is_wading("b"));
    assert!(!s.is_wading("d"));
    // the wading unit draws fewer body pixels than the same unit on dry land
    let count = |s: &Scene, id: &str| {
        let (x, top, feet) = s.anchor(id).unwrap();
        let mut n = 0;
        for y in top.max(0.0) as usize..(feet as usize + 2).min(s.fb.h) {
            for xx in (x - 10.0).max(0.0) as usize..(x + 10.0) as usize {
                if s.fb.depth[y * s.fb.w + xx] < f32::INFINITY { n += 1; }
            }
        }
        n
    };
    s.follow(Some("w"));
    for _ in 0..30 { s.tick(1.0 / 60.0); }
    s.draw();
    let wet = count(&s, "w");
    s.follow(Some("d"));
    for _ in 0..30 { s.tick(1.0 / 60.0); }
    s.draw();
    let dry = count(&s, "d");
    assert!(wet < dry, "wet={wet} dry={dry}");
}
