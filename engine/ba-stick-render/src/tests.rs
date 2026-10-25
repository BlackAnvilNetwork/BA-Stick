// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

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
    assert_eq!(AnimState::parse("rest").action_clip(), Some("rest"));
    assert_eq!(AnimState::parse("bogus"), AnimState::Idle);
    let mut s = Scene::new(64, 64);
    s.upsert_unit("a", unit(0.0, 0.0, "idle", "rogue"));
    s.upsert_unit("a", unit(0.0, 0.0, "melee", "rogue"));
    assert_eq!(s.unit_clip("a"), Some("swing"));
}

#[test]
fn rest_clip_is_a_heros_rest() {
    use stick_engine::anim::{Ch, Clip, MaskKind};
    use stick_engine::body::{BodyParams, Sex};
    use stick_engine::math::v3;
    use stick_engine::rig::{solve, Joint};
    let clip = Clip::from_ron(include_str!("../assets/clips/rest.ron")).unwrap();
    assert!(clip.meta.looping);
    assert_eq!(clip.meta.mask, MaskKind::Full);
    let pose = clip.sample(0.0);
    assert!(pose.get(Ch::Bob) < -0.4, "the hips drop to the ground");
    assert!(pose.get(Ch::Head) > 15.0, "the head bows");
    assert!(pose.get(Ch::RWpnPitch) < -60.0, "the sword aims down");
    let j = solve(&pose, &BodyParams::preset(Sex::Male), v3(0.0, 0.0, 0.0), 0.0, 0.0);
    let lk = j.get(Joint::LKnee);
    let rk = j.get(Joint::RKnee);
    let lf = j.get(Joint::LFoot);
    let rf = j.get(Joint::RFoot);
    let hand = j.get(Joint::RHand);
    let where_ = format!(
        "Lknee {:.2} Rknee {:.2}@{:.2} Lfoot {:.2} Rfoot {:.2}@{:.2} hand {:.2} wpn.y {:.2} head.z {:.2} neck.z {:.2}",
        lk.y, rk.y, rk.z, lf.y, rf.y, rf.z, hand.y, j.wpn_dir[1].y, j.get(Joint::Head).z, j.get(Joint::Neck).z
    );
    assert!(lk.y > rk.y + 0.15, "one knee is up — {where_}");
    assert!(lf.y < 0.1 && lf.y > -0.08, "the raised foot is planted — {where_}");
    assert!(rf.y < 0.12 && rf.y > -0.08, "the other foot rests on the ground — {where_}");
    assert!(rf.z > rk.z + 0.2, "the resting leg reaches forward — {where_}");
    let hip = j.get(Joint::Pelvis);
    let t = (rk.z - hip.z) / (rf.z - hip.z).max(1e-3);
    let line_y = hip.y + t * (rf.y - hip.y);
    assert!(rk.y > line_y + 0.03, "the resting knee bends up, not back — {where_}");
    assert!(j.wpn_dir[1].y < -0.7, "the sword points into the ground — {where_}");
    assert!(j.get(Joint::Head).z > j.get(Joint::Neck).z, "the head is forward of the neck — {where_}");
    let breath = clip.sample(1.6);
    assert!(breath.get(Ch::Bob) < pose.get(Ch::Bob), "the breath settles");
    let mut s = Scene::new(64, 64);
    s.upsert_unit("a", unit(0.0, 0.0, "rest", "fighter"));
    assert_eq!(s.unit_clip("a"), Some("rest"));
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
fn rain_weather_keeps_figure_and_meadow_grass() {
    let bytes = tiny_zone(40, 40, |_, _| (15, 0, 200));
    let mut s = Scene::new(320, 180);
    s.load_zone(&bytes).unwrap();
    s.upsert_unit("me", unit(5.0, 5.0, "idle", "knight"));
    s.follow(Some("me"));
    for _ in 0..60 {
        s.tick(1.0 / 60.0);
    }
    s.set_weather(1, 0.0); // rain
    for _ in 0..300 {
        s.tick(1.0 / 60.0);
    }
    s.draw();
    let meadow = crate::palette::MEADOW;
    assert!(s.fb.color.iter().filter(|&&c| c == meadow).count() > 80, "meadow blades");
    let body = crate::compat::C_BODY;
    assert!(s.fb.color.iter().filter(|&&c| c == body).count() > 40, "figure pixels");
    let rain_px = s
        .fb
        .color
        .iter()
        .filter(|&&c| c == crate::palette::ROCK || c == crate::palette::ROCK_L)
        .count();
    assert!(rain_px > 20, "rain streaks ({rain_px})");
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
    assert!(s.set_fx(
        "m",
        UnitFx {
            hp: 0.5,
            cast: 0.5,
            aoe: 2.0,
            flags: crate::scene::FX_SELECTED | crate::scene::FX_HOSTILE,
            fade: 1.0,
            level_up: 0.3,
            weapon_edge: 0,
        },
    ));
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
    // (a full cell away from the bridge and the shore: water on every side, F18)
    s.upsert_unit("w", unit(-1.0, 5.0, "idle", "knight"));
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

#[test]
fn gather_nodes_draw_per_method_and_dim_when_depleted() {
    for m in ["mine", "harvest", "fish"] {
        let mut s = Scene::new(320, 180);
        s.upsert_unit("n", unit(0.0, 0.0, "idle", &format!("gather:{m}")));
        s.tick(0.1);
        s.draw();
        let ready: Vec<u8> = s.fb.color.clone();
        assert!(ready.iter().any(|&c| c == crate::compat::C_GOLD), "{m}: glow");
        s.set_fx("n", UnitFx { flags: crate::scene::FX_DEPLETED, ..UnitFx::default() });
        s.draw();
        assert!(!s.fb.color.iter().any(|&c| c == crate::compat::C_GOLD), "{m}: depleted has no glow");
    }
}

#[test]
fn scavenger_is_a_dog_that_trots_and_lunges() {
    use crate::palette::{CR_DOG, CR_DOG_FILL, CR_NOSE, CR_TEETH};
    assert!(matches!(RigPreset::resolve("mob:hollow_scavenger").body, crate::preset::Body::Canine { .. }));
    // lunge: winds back, then snaps forward with the jaw open, then settles
    let (back, _, _) = creature::lunge(0.15);
    let (fwd, _, jaw) = creature::lunge(0.65);
    assert!(back < 0.0 && fwd > 0.2 && jaw > 0.8);
    assert_eq!(creature::lunge(1.0), (0.0, 0.0, 0.0));
    let mut s = Scene::new(200, 200);
    s.upsert_unit("d", unit(0.0, 0.0, "idle", "mob:hollow_scavenger"));
    s.tick(0.0);
    s.draw();
    let idle = s.fb.color.clone();
    for c in [CR_DOG, CR_DOG_FILL, CR_NOSE, CR_TEETH] {
        assert!(idle.contains(&c), "colour {c} missing");
    }
    s.upsert_unit("d", unit(0.0, 0.0, "melee", "mob:hollow_scavenger"));
    s.tick(0.2);
    s.draw();
    assert_ne!(idle, s.fb.color);
}


#[test]
fn vfx_primitives_spawn_glow_and_expire() {
    use crate::vfx::Prim;
    let mut s = Scene::new(240, 200);
    s.upsert_unit("a", unit(0.0, 0.0, "cast", "job:sorcerer"));
    s.upsert_unit("b", unit(3.0, 0.0, "idle", "mob:dust_hare"));
    s.tick(0.0);
    for (i, prim) in [Prim::Projectile, Prim::Line, Prim::Burst, Prim::Ring].into_iter().enumerate() {
        assert!(s.spawn_vfx(prim, "a", Some("b"), 0xff8a2a, 60, 1.5, (i as u32) & 1));
    }
    assert!(!s.spawn_vfx(Prim::Burst, "nobody", None, 0xffffff, 10, 1.0, 0));
    for _ in 0..3 { s.tick(1.0 / 30.0); }
    s.draw();
    assert!(s.vfx.sparks.len() > 50, "sparks {}", s.vfx.sparks.len());
    let mut plain = vec![0u8; 240 * 200 * 4];
    let saved = std::mem::take(&mut s.vfx.sparks);
    s.write_rgba(&mut plain);
    s.vfx.sparks = saved;
    let mut lit = vec![0u8; 240 * 200 * 4];
    s.write_rgba(&mut lit);
    let brighter = plain.iter().zip(&lit).filter(|(a, b)| b > a).count();
    assert!(brighter > 50);
    for _ in 0..60 { s.tick(1.0 / 30.0); }
    assert_eq!(s.vfx_count(), 0);
}

#[test]
fn vfx_500_particles_stay_capped_and_cheap() {
    use crate::vfx::Prim;
    let mut s = Scene::new(640, 360);
    s.upsert_unit("a", unit(0.0, 0.0, "idle", "job:knight"));
    s.tick(0.0);
    for _ in 0..10 { s.spawn_vfx(Prim::Ring, "a", None, 0x5fe0f0, 50, 3.0, 1); }
    assert!(s.vfx_count() >= 500);
    for _ in 0..100 { s.spawn_vfx(Prim::Burst, "a", None, 0x5fe0f0, 400, 1.0, 0); }
    assert!(s.vfx_count() <= crate::vfx::MAX_PARTICLES);
}

#[test]
fn gear_changes_the_figure_and_seeds_are_stable() {
    use crate::gear::{garb, WeaponLook, Mat};
    use crate::preset::Weapon;
    assert_eq!(WeaponLook::new(Weapon::Sword, Mat::Metal, 42), WeaponLook::new(Weapon::Sword, Mat::Metal, 42));
    let looks: std::collections::HashSet<String> = (1..40).map(|s| format!("{:?}", WeaponLook::new(Weapon::Sword, Mat::Metal, s))).collect();
    assert!(looks.len() > 10, "seeds should vary looks");
    let render = |g: Option<crate::gear::Garb>| {
        let mut s = Scene::new(160, 160);
        s.upsert_unit("p", unit(0.0, 0.0, "idle", "knight"));
        if let Some(g) = g { assert!(s.set_gear("p", g)); }
        s.tick(0.0);
        s.draw();
        s.fb.color.clone()
    };
    let plain = render(None);
    let axe = render(Some(garb(4, 3, 7, 0, 0, 0, 0, 0, 0)));
    let armour = render(Some(garb(0, 0, 0, 2, 5, 3, 9, 2, 5)));
    assert_ne!(plain, axe);
    assert_ne!(plain, armour);
    assert!(armour.contains(&crate::palette::GEAR_LEATHER));
    let plate = render(Some(garb(0, 0, 0, 3, 5, 0, 0, 0, 0)));
    assert_ne!(plain, plate);
    assert!(plate.contains(&crate::compat::C_STEEL));
    assert!(plate.contains(&crate::compat::C_GOLD));
    let robe = render(Some(garb(0, 0, 0, 1, 2, 0, 0, 0, 0)));
    assert_ne!(plain, robe);
    assert!(robe.contains(&crate::compat::C_SHADOW));
    assert!(robe.contains(&crate::palette::WATER));
    let vest = render(Some(garb(0, 0, 0, 2, 7, 0, 0, 0, 0)));
    assert_ne!(plain, vest);
    assert!(vest.contains(&crate::palette::GEAR_LEATHER));
    assert!(vest.contains(&crate::palette::GEAR_LEATHER_FAR));
    assert!(vest.contains(&crate::compat::C_SHADOW));
    let harness = render(Some(garb(0, 0, 0, 5, 327, 0, 0, 0, 0)));
    assert_ne!(plain, harness);
    assert!(harness.contains(&crate::palette::GEAR_BONE));
    assert!(harness.contains(&crate::palette::CR_HARE));
    assert!(harness.contains(&crate::compat::C_SHADOW));
    let helm = render(Some(garb(0, 0, 0, 0, 0, 3, crate::gear::IRON_HELM_ITEM, 0, 0)));
    assert_ne!(plain, helm);
    assert!(helm.contains(&crate::compat::C_STEEL));
    assert!(helm.contains(&crate::compat::C_GOLD));
    assert!(helm.contains(&crate::compat::C_BODY));
    let band = render(Some(garb(0, 0, 0, 0, 0, 1, crate::gear::LINEN_HELM_ITEM, 0, 0)));
    assert_ne!(plain, band);
    assert!(band.contains(&crate::palette::GEAR_LEATHER));
    assert!(band.contains(&crate::compat::C_BODY));
    let hat = render(Some(garb(0, 0, 0, 0, 0, 1, 0, 0, 0)));
    assert_ne!(plain, hat);
    assert!(hat.contains(&crate::palette::WATER));
    assert!(hat.contains(&crate::compat::C_BODY));
    let mut shield = garb(0, 0, 0, 0, 0, 0, 0, 0, 0);
    shield.shield = true;
    let faced = render(Some(shield));
    assert_ne!(plain, faced);
    assert!(faced.contains(&crate::compat::C_STEEL));
    assert!(faced.contains(&crate::compat::C_GOLD));
    let mut kite = garb(0, 0, 0, 0, 0, 0, 0, 0, 0);
    kite.kite = true;
    let pointed = render(Some(kite));
    assert_ne!(plain, pointed);
    assert!(pointed.contains(&crate::compat::C_STEEL));
    assert!(pointed.contains(&crate::compat::C_GOLD));
    let cuisses = render(Some(garb(0, 0, 0, 0, 0, 0, 0, 3, 1)));
    assert_ne!(plain, cuisses);
    assert!(cuisses.contains(&crate::compat::C_STEEL));
    assert!(cuisses.contains(&crate::compat::C_GOLD));
    for fam in 1..=7 { render(Some(garb(fam, 3, fam as u32, 1, 1, 1, 1, 1, 1))); }
}

#[test]
fn preview_backdrop_is_transparent_around_the_figure() {
    let mut s = Scene::new(80, 110);
    s.backdrop = true;
    s.upsert_unit("p", unit(0.0, 0.0, "idle", "cleric/female"));
    s.set_camera(0.0, 0.0);
    s.tick(0.0);
    s.draw();
    let mut out = vec![0u8; 80 * 110 * 4];
    s.write_rgba(&mut out);
    assert_eq!(out[3], 0, "corner transparent");
    let opaque = out.chunks(4).filter(|p| p[3] == 255).count();
    assert!(opaque > 150, "figure drawn ({opaque} px)");
}

#[test]
fn camera_3d_roundtrip_and_blend() {
    use stick_engine::camera::Camera;
    use stick_engine::math::v3;
    let mut cam = Camera::new(640, 360);
    for persp in [0.0, 0.5, 1.0] {
        cam.persp = persp;
        for (x, z) in [(0.0, 0.0), (3.0, -2.0), (-8.0, -9.0), (4.0, 5.0)] {
            let p = cam.project(v3(x, 0.0, z));
            let (ux, uz) = cam.unproject_ground(p.x, p.y);
            assert!((ux - x).abs() < 1e-3 && (uz - z).abs() < 1e-3, "{persp} {x} {z} -> {ux} {uz}");
        }
    }
    // Far things shrink, near things grow in 3D.
    assert!(cam.scale_at(v3(-8.0, 0.0, -8.0)) < 1.0);
    assert!(cam.scale_at(v3(3.0, 0.0, 3.0)) > 1.0);
    let mut s = crate::scene::Scene::new(640, 360);
    s.view3d = true;
    for _ in 0..60 { s.tick(1.0 / 60.0); }
    assert_eq!(s.cam.persp, 1.0);
}

#[test]
fn river_wall_joints_are_mitered_and_flush() {
    use crate::props::{kind, link_walls, Prop};
    // Two 2 m segments meeting at (0, 0) with a 30-degree turn, plus a loose one.
    let seg = |x0: f32, z0: f32, yaw: f32, y: f32| {
        let (fx, fz) = (yaw.sin(), yaw.cos());
        Prop { kind: kind::RIVER_WALL, var: 0, x: x0 + fx, z: z0 + fz, y, yaw, s: 2.0, w: 0.5, h: 1.0, d: 0.1, j: [0.0; 6] }
    };
    let a = seg(0.0, -2.0, 0.0, 1.0);
    let b = seg(0.0, 0.0, 0.5236, 1.2);
    let loose = seg(10.0, 10.0, 0.0, 0.0);
    let mut v = [a, b, loose];
    link_walls(&mut v);
    assert_eq!(v[2].j, [0.0; 6], "an unjoined segment keeps square ends");
    assert!(v[0].j[0] == 0.0 && v[1].j[1] == 0.0, "free ends stay square");
    assert!(v[0].j[1] != 0.0 && v[1].j[0] != 0.0, "the shared joint is mitered");
    // Corners on each side of the joint coincide, and the bases meet at one height.
    let corner = |p: &Prop, end: usize, rx: f32| {
        let (fx, fz, rxv, rzv) = (p.yaw.sin(), p.yaw.cos(), p.yaw.cos(), -p.yaw.sin());
        let along = if end == 0 { -p.s * 0.5 } else { p.s * 0.5 } + rx * p.j[end];
        (p.x + fx * along + rxv * rx, p.z + fz * along + rzv * rx, p.y + p.j[2 + end])
    };
    for rx in [-0.25f32, 0.25] {
        let (ax, az, ay) = corner(&v[0], 1, rx);
        let (bx, bz, by) = corner(&v[1], 0, rx);
        assert!((ax - bx).abs() < 1e-3 && (az - bz).abs() < 1e-3, "corner {rx}: ({ax},{az}) vs ({bx},{bz})");
        assert!((ay - by).abs() < 1e-4, "base heights meet");
    }
}
#[test]
fn bridge_deck_is_one_continuous_ribbon() {
    use crate::palette::TRAIL_STONE;
    use crate::props::{draw, kind, Prop};
    use stick_engine::camera::Camera;
    use stick_engine::math::v3;
    use stick_engine::raster::Framebuffer;
    let cam = Camera::new(640, 360);
    let mut fb = Framebuffer::new(640, 360);
    // 10 m span along z, 3.9 m deck, 0.6 m flat-deck lift, level ends, 0.3 ramps
    let p = Prop { kind: kind::BRIDGE, var: 0, x: 0.0, z: 0.0, y: 0.0, yaw: 0.0, s: 10.0, w: 3.9, h: 0.6, d: 0.0, j: [0.0; 6] };
    draw(&mut fb, &cam, &[p], 0.0, 0.0, 0.0, 0.0);
    // Walk the deck centre line: every sample is lit deck, with no slab seam or
    // step outline crossing the walkway (the old 12-slab bridge had 11).
    let mut seams = 0;
    for i in 1..40 {
        let t = i as f32 / 40.0;
        let y = crate::props::bridge_curve(&p, t);
        let q = cam.project(v3(0.0, y + 0.01, -5.0 + 10.0 * t));
        let c = fb.color[q.y as usize * fb.w + q.x as usize];
        if c != TRAIL_STONE {
            seams += 1;
        }
    }
    assert_eq!(seams, 0, "deck centre line crosses {seams} non-deck pixels");
}


#[test]
fn l1_slope_shade_follows_sun() {
    use crate::zone::Zone;
    let (w, h) = (8usize, 8usize);
    let mut z = Zone { min_x: 0.0, min_z: 0.0, cell: 0.5, w, h, biome: vec![0; w * h], flags: vec![0; w * h], height: vec![0.0; w * h] };
    assert_eq!(crate::ground::slope_shade(&z, 1, 1), 1, "flat = mid");
    // Rise toward +x: face tilts toward -x (NW sun) => lit.
    for j in 0..z.h { for i in 0..z.w { let k = z.idx(i as i32, j as i32); z.height[k] = i as f32 * 0.4; } }
    assert_eq!(crate::ground::slope_shade(&z, 1, 1), 0);
    for j in 0..z.h { for i in 0..z.w { let k = z.idx(i as i32, j as i32); z.height[k] = -(i as f32) * 0.4; } }
    assert_eq!(crate::ground::slope_shade(&z, 1, 1), 2);
}

#[test]
fn l2_keylight_warms_lit_cools_shadow() {
    use crate::atmosphere::*;
    let pal = crate::palette::palette();
    let run = |c: u8, key: bool| {
        let mut o = [0u8; 4];
        write_rgba_key(
            &pal,
            &[c],
            1,
            1,
            &[],
            &PALE_HOLLOW,
            0.0,
            key,
            crate::atmosphere::Extra::NONE,
            &mut o,
        );
        o
    };
    let lit = crate::palette::BIOME0;
    let dark = crate::palette::BIOME0 + 2;
    assert!(run(lit, true)[0] >= run(lit, false)[0]);
    assert!(run(dark, true)[0] <= run(dark, false)[0]);
}

#[test]
fn bridge_mesh_matches_server_walk_height() {
    // apps/stick-web/src/content/bridge-profile.json holds, per Pale Hollow bridge,
    // the baked prop and the server's stand height (@bellgrave/config) along the span.
    use crate::props::{bridge_curve, kind, Prop};
    let raw = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../apps/stick-web/src/content/bridge-profile.json")).unwrap();
    // The fixture is pretty-printed one key per line; read `"key": number` pairs in order.
    let kv = raw.lines().filter_map(|l| {
        let (k, v) = l.trim().trim_end_matches(',').split_once(": ")?;
        Some((k.trim_matches('"').to_string(), v.parse::<f64>().ok()?))
    });
    let mut p = Prop { kind: kind::BRIDGE, var: 0, x: 0.0, z: 0.0, y: 0.0, yaw: 0.0, s: 0.0, w: 0.0, h: 0.0, d: 0.0, j: [0.0; 6] };
    let (mut n, mut t) = (0, 0.0f32);
    for (k, v) in kv {
        let v32 = v as f32;
        match k.as_str() {
            "v" => p.var = v as u8,
            "s" => p.s = v32,
            "w" => p.w = v32,
            "h" => p.h = v32,
            "d" => p.d = v32,
            "t" => t = v32,
            "stand" => {
                let mesh = p.y + bridge_curve(&p, t);
                assert!((mesh - v32).abs() < 1e-3, "bridge #{} t={t}: mesh {mesh} vs server {v32}", n / 21);
                n += 1;
            }
            // `y` is the prop's left-end height before the samples, a deck sample after `t`
            "y" if t == 0.0 => p.y = v32,
            _ => {}
        }
        if k == "stand" && n % 21 == 0 {
            t = 0.0;
        }
    }
    assert!(n >= 2 * 21);
}

#[test]
fn boot_menu_renders_transparent_overlay() {
    let (w, h) = (640usize, 360usize);
    let mut s = Scene::new(w, h);
    s.set_boot_menu(true);
    for _ in 0..30 {
        s.tick(1.0 / 60.0);
    }
    s.draw();
    let mut rgba = vec![0u8; w * h * 4];
    s.write_rgba(&mut rgba);
    assert_eq!(s.unit_count(), 0, "photo backdrop — no menu hero in WASM");
    let transparent = rgba.chunks(4).filter(|p| p[3] == 0).count();
    assert!(
        transparent > w * h * 9 / 10,
        "boot WASM layer should be mostly keyed out, got {transparent}/{}",
        w * h
    );
    if std::env::var("BOOT_MENU_PPM").is_ok() {
        let mut rgb = Vec::with_capacity(w * h * 3);
        for p in rgba.chunks(4) {
            rgb.extend_from_slice(&p[0..3]);
        }
        let mut out = format!("P6\n{w} {h}\n255\n").into_bytes();
        out.extend(rgb);
        let _ = std::fs::write("target/boot_menu.ppm", out);
    }
}
