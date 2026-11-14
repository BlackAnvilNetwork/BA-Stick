// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

use ba_sdf_gear::gatehouse::{gatehouse_mat, gatehouse_sdf, stone_rgb, GatehouseParams};
use ba_sdf_gear::{
    bastion_layout, castle_wall_bounds, castle_wall_mat, castle_wall_sdf, curtain_stone_rgb,
    curtain_wall_mat, curtain_wall_sdf, house_mat, house_sdf, house_stone_rgb, load_object_ron, mesh,
    mesh_field, mesh_sdf, object::object_to_staff_params, parse_bays, walkway_mat, walkway_sdf,
    walkway_stone_rgb, write_obj, BamPlacement, BastionConfig, CastleModule, HouseKind, HouseParams,
    MeshData, MeshOptions, Placement, StaffParams, WalkwayParams,
};
use clap::{Parser, Subcommand};
use glam::Vec3;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(
    name = "ba-sdf-gear",
    about = "SDF Object pipeline — generate / extract meshes from Object graphs"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Mesh a staff Object RON graph to OBJ (vertex colors = heat).
    Generate {
        ron: PathBuf,
        #[arg(long, default_value = "out/staff.obj")]
        out: PathBuf,
        #[arg(long, default_value_t = 0.0)]
        time: f32,
    },
    /// Mesh the built-in default staff params (no RON).
    Default {
        #[arg(long, default_value = "out/default_staff.obj")]
        out: PathBuf,
    },
    /// Mesh the gatehouse architecture fixture (towers + curtain + arch).
    Gatehouse {
        #[arg(long, default_value = "out/gatehouse.obj")]
        out: PathBuf,
        /// Door open amount: 0 = closed, 1 = 90° outward.
        #[arg(long, default_value_t = 0.0)]
        door_open: f32,
        /// Skip yaw 0° / 90° preview PNGs (written by default).
        #[arg(long, default_value_t = false)]
        no_preview: bool,
    },
    /// Mesh one curtain-wall bay (twin towers + solid wall + slits).
    CurtainWall {
        #[arg(long, default_value = "out/curtain_wall.obj")]
        out: PathBuf,
        #[arg(long, default_value_t = false)]
        no_preview: bool,
    },
    /// Generative castle wall from bay list: curtain,gate,gate:0.85,curtain
    CastleRun {
        /// Comma-separated bays: curtain | gate | gate:0..1
        #[arg(long, default_value = "curtain,gate:0.0,curtain")]
        bays: String,
        #[arg(long, default_value = "out/castle_run.obj")]
        out: PathBuf,
        #[arg(long, default_value_t = false)]
        no_preview: bool,
    },
    /// Ashen Bastion courtyard: extract archetype meshes + BAM1 + placements.json.
    Bastion {
        #[arg(long, default_value = "out/bastion")]
        out: PathBuf,
    },
    /// Bake a temporary Stick disc-cloud RON (diagnostic TEMP only).
    ToStick {
        ron: PathBuf,
        #[arg(long, default_value = "out/ba_jensens_huang.sdf_preview.ron")]
        out: PathBuf,
        #[arg(long, default_value_t = 0.4)]
        time: f32,
        #[arg(long, default_value_t = 0.045)]
        cell: f32,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Generate { ron, out, time } => {
            let obj = load_object_ron(&ron)?;
            let params = object_to_staff_params(&obj);
            run_staff(&params, &out, time)?;
        }
        Cmd::Default { out } => {
            run_staff(&StaffParams::default(), &out, 0.0)?;
        }
        Cmd::Gatehouse {
            out,
            door_open,
            no_preview,
        } => {
            run_gatehouse(&out, door_open, !no_preview)?;
        }
        Cmd::CurtainWall { out, no_preview } => {
            run_curtain_wall(&out, !no_preview)?;
        }
        Cmd::CastleRun {
            bays,
            out,
            no_preview,
        } => {
            run_castle_run(&bays, &out, !no_preview)?;
        }
        Cmd::Bastion { out } => {
            run_bastion(&out)?;
        }
        Cmd::ToStick {
            ron,
            out,
            time,
            cell,
        } => {
            let obj = load_object_ron(&ron)?;
            let params = object_to_staff_params(&obj);
            let top = params
                .halo
                .as_ref()
                .map(|h| h.y + h.shard_orbit * 0.55 + h.minor)
                .unwrap_or(params.length + 0.35);
            let opts = MeshOptions {
                min: Vec3::new(-0.34, -0.16, -0.34),
                max: Vec3::new(0.34, top + 0.1, 0.34),
                time,
                ..Default::default()
            };
            let t0 = Instant::now();
            let mesh_data = mesh_sdf(&params, &opts);
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent)?;
            }
            mesh::write_stick_disc_ron(&out, &mesh_data, &params, cell)?;
            println!(
                "wrote TEMP Stick preview {}  (from {} verts) in {:.2?}",
                out.display(),
                mesh_data.positions.len(),
                t0.elapsed()
            );
        }
    }
    Ok(())
}

fn run_staff(
    params: &StaffParams,
    out: &PathBuf,
    time: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let top = params
        .halo
        .as_ref()
        .map(|h| h.y + h.shard_orbit * 0.55 + h.minor)
        .unwrap_or(params.length + 0.35);
    let opts = MeshOptions {
        min: Vec3::new(-0.34, -0.16, -0.34),
        max: Vec3::new(0.34, top + 0.1, 0.34),
        time,
        ..Default::default()
    };
    let t0 = Instant::now();
    let mesh = mesh_sdf(params, &opts);
    write_obj(out, &mesh)?;
    println!(
        "wrote {}  verts={}  tris={}  in {:.2?}",
        out.display(),
        mesh.positions.len(),
        mesh.indices.len() / 3,
        t0.elapsed()
    );
    Ok(())
}

fn run_gatehouse(
    out: &PathBuf,
    door_open: f32,
    preview: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut params = GatehouseParams::default();
    params.door_open = door_open.clamp(0.0, 1.0);
    // Fixed bounds sized for fully open doors so closed/open share voxel density.
    let opts = MeshOptions {
        min: Vec3::new(-2.2, -0.22, -1.55),
        max: Vec3::new(2.2, 4.7, 1.55),
        time: 0.0,
        res: 144,
    };
    let t0 = Instant::now();
    let mut mesh = mesh_field(
        |p| gatehouse_sdf(p, &params),
        |p| gatehouse_mat(p, &params),
        &opts,
    );
    let colors: Vec<[f32; 3]> = mesh.heats.iter().copied().map(stone_rgb).collect();
    mesh.colors = Some(colors);
    write_obj(out, &mesh)?;
    println!(
        "wrote gatehouse {}  verts={}  tris={}  door_open={:.2}  in {:.2?}",
        out.display(),
        mesh.positions.len(),
        mesh.indices.len() / 3,
        params.door_open,
        t0.elapsed()
    );
    write_previews(out, preview);
    Ok(())
}

fn write_previews(out: &PathBuf, preview: bool) {
    if !preview {
        return;
    }
    let preview_dir = out.parent().unwrap_or_else(|| std::path::Path::new("out"));
    let prefix = out
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("preview");
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/preview_obj.py");
    let status = std::process::Command::new("python")
        .arg(&script)
        .arg(out)
        .arg("--out-dir")
        .arg(preview_dir)
        .arg("--prefix")
        .arg(prefix)
        .arg("--angles")
        .arg("0,90")
        .status();
    match status {
        Ok(s) if s.success() => {}
        Ok(s) => eprintln!("preview script exited {s}"),
        Err(e) => eprintln!("preview script failed to launch: {e}"),
    }
}

fn run_curtain_wall(out: &PathBuf, preview: bool) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let m = CastleModule::default();
    let opts = MeshOptions {
        min: Vec3::new(-2.2, -0.22, -1.55),
        max: Vec3::new(2.2, 4.7, 1.55),
        time: 0.0,
        res: 144,
    };
    let t0 = Instant::now();
    let mut mesh = mesh_field(
        |p| curtain_wall_sdf(p, &m),
        |p| curtain_wall_mat(p, &m),
        &opts,
    );
    let colors: Vec<[f32; 3]> = mesh.heats.iter().copied().map(curtain_stone_rgb).collect();
    mesh.colors = Some(colors);
    write_obj(out, &mesh)?;
    println!(
        "wrote curtain-wall {}  verts={}  tris={}  pitch={:.2}  in {:.2?}",
        out.display(),
        mesh.positions.len(),
        mesh.indices.len() / 3,
        m.pitch(),
        t0.elapsed()
    );
    write_previews(out, preview);
    Ok(())
}

fn mesh_house_kind(kind: HouseKind) -> MeshData {
    let house = HouseParams::from_kind(kind);
    let half = house.half_extents();
    // res 48 → RES_PLAY=40: gables/roofs readable without blowing the CPU triangle budget.
    let opts = MeshOptions {
        min: Vec3::new(-half.x, -0.12, -half.z),
        max: Vec3::new(half.x, half.y, half.z),
        time: 0.0,
        res: 48,
    };
    let mut mesh = mesh_field(
        |p| house_sdf(p, &house),
        |p| house_mat(p, &house),
        &opts,
    );
    mesh.colors = Some(mesh.heats.iter().copied().map(house_stone_rgb).collect());
    mesh
}

fn run_bastion(out_dir: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    std::fs::create_dir_all(out_dir)?;
    let cfg = BastionConfig::default();
    let layout = bastion_layout(&cfg);
    let m = cfg.module.clone();
    let gate_params = m.to_gatehouse(1.0);
    let walk = WalkwayParams::default();

    // Keep voxel density on the play grid (res < 80 → RES_PLAY=40).
    let gate_r = gate_params.tower_sep + gate_params.tower_r * 1.35;
    let gate_top = gate_params.tower_h + gate_params.crown_h + gate_params.battlement + 0.5;
    let gate_z = gate_params.wall_half.z + gate_params.tower_r * 0.55;
    // res ∈ [45, 80) → RES_PLAY=40; res < 45 → coarse 28.
    let gate_opts = MeshOptions {
        min: Vec3::new(-gate_r, -0.35, -gate_z),
        max: Vec3::new(gate_r, gate_top, gate_z),
        time: 0.0,
        res: 56,
    };
    let wall_r = m.tower_sep + m.tower_r * 1.35;
    let wall_top = m.tower_h + m.crown_h + m.battlement + 0.5;
    let wall_z = m.wall_half.z + m.tower_r * 0.45;
    let wall_opts = MeshOptions {
        min: Vec3::new(-wall_r, -0.35, -wall_z),
        max: Vec3::new(wall_r, wall_top, wall_z),
        time: 0.0,
        res: 56,
    };
    let walk_half = walk.half_extents();
    let walk_opts = MeshOptions {
        min: Vec3::new(-walk_half.x, -0.2, -walk_half.z),
        max: Vec3::new(walk_half.x, walk_half.y, walk_half.z),
        time: 0.0,
        res: 40,
    };

    let t0 = Instant::now();
    let mut curtain = mesh_field(
        |p| curtain_wall_sdf(p, &m),
        |p| curtain_wall_mat(p, &m),
        &wall_opts,
    );
    curtain.colors = Some(
        curtain
            .heats
            .iter()
            .copied()
            .map(curtain_stone_rgb)
            .collect(),
    );

    let mut gate = mesh_field(
        |p| gatehouse_sdf(p, &gate_params),
        |p| gatehouse_mat(p, &gate_params),
        &gate_opts,
    );
    gate.colors = Some(
        gate.heats
            .iter()
            .copied()
            .map(|h| {
                if h < 0.25 {
                    stone_rgb(h)
                } else {
                    curtain_stone_rgb(h)
                }
            })
            .collect(),
    );

    let house_kinds = HouseKind::all();
    let house_meshes: Vec<MeshData> = house_kinds.iter().copied().map(mesh_house_kind).collect();

    let mut walk_mesh = mesh_field(
        |p| walkway_sdf(p, &walk),
        |p| walkway_mat(p, &walk),
        &walk_opts,
    );
    walk_mesh.colors = Some(
        walk_mesh
            .heats
            .iter()
            .copied()
            .map(walkway_stone_rgb)
            .collect(),
    );

    let mut named: Vec<(&str, &MeshData)> = vec![("gatehouse", &gate), ("curtain", &curtain)];
    for (kind, mesh) in house_kinds.iter().zip(house_meshes.iter()) {
        named.push((kind.mesh_name(), mesh));
    }
    named.push(("walkway", &walk_mesh));
    for (name, data) in &named {
        let obj = out_dir.join(format!("{name}.obj"));
        write_obj(&obj, data)?;
        println!(
            "  {name}: verts={} tris={}",
            data.positions.len(),
            data.indices.len() / 3
        );
    }

    let stats = layout.stats;
    let placement_refs: Vec<Placement> = layout.placements;
    // Yard stand height in-zone is 2.0 — lift SDF local y=0 onto the pad.
    // Walkway layout y is already rampart-relative (3.2); +YARD_Y → AB_RAMPART_Y.
    const YARD_Y: f32 = 2.0;
    // Mesh bank: 0 gatehouse, 1 curtain, 2..6 house kinds, last walkway.
    let house_base: u32 = 2;
    let walkway_ix = house_base + house_kinds.len() as u32;
    let mesh_index = |name: &str| -> u32 {
        match name {
            "gatehouse" => 0,
            "curtain" => 1,
            "walkway" => walkway_ix,
            other => HouseKind::all()
                .iter()
                .position(|k| k.mesh_name() == other)
                .map(|i| house_base + i as u32)
                .unwrap_or(0),
        }
    };
    let bam_places: Vec<BamPlacement> = placement_refs
        .iter()
        .map(|p| BamPlacement {
            mesh: mesh_index(&p.mesh),
            x: p.x,
            y: p.y + YARD_Y,
            z: p.z,
            yaw: p.yaw,
            sx: p.sx,
            sy: p.sy,
            sz: p.sz,
        })
        .collect();

    let mut bam_meshes: Vec<MeshData> = Vec::with_capacity(2 + house_meshes.len() + 1);
    bam_meshes.push(gate.clone());
    bam_meshes.push(curtain.clone());
    bam_meshes.extend(house_meshes.iter().cloned());
    bam_meshes.push(walk_mesh.clone());

    let bam_path = out_dir.join("ashen_bastion.bam");
    ba_sdf_gear::write_bam1_with_places(&bam_path, &bam_meshes, &bam_places)?;

    let placements_path = out_dir.join("placements.json");
    let json = serde_json::to_string_pretty(&placement_refs)?;
    std::fs::write(&placements_path, json)?;

    println!(
        "bastion → {}\n  ashen_bastion.bam ({} meshes + {} places)\n  gates={} curtains={} houses={} walkways={}\n  {:.2?}",
        out_dir.display(),
        bam_meshes.len(),
        bam_places.len(),
        stats.gates,
        stats.curtain_bays,
        stats.houses,
        stats.walkways,
        t0.elapsed()
    );
    Ok(())
}

fn run_castle_run(
    bays_spec: &str,
    out: &PathBuf,
    preview: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bays = parse_bays(bays_spec).map_err(|e| e)?;
    let m = CastleModule::default();
    let door_pad = bays
        .iter()
        .map(|b| match b {
            ba_sdf_gear::CastleBay::Gate { door_open } => door_open * 0.55,
            _ => 0.0,
        })
        .fold(0.0_f32, f32::max);
    let (min, max) = castle_wall_bounds(&m, bays.len(), door_pad);
    let opts = MeshOptions {
        min,
        max,
        time: 0.0,
        res: 144,
    };
    let t0 = Instant::now();
    let mut mesh = mesh_field(
        |p| castle_wall_sdf(p, &m, &bays),
        |p| castle_wall_mat(p, &m, &bays),
        &opts,
    );
    let colors: Vec<[f32; 3]> = mesh
        .heats
        .iter()
        .copied()
        .map(|h| {
            if h < 0.25 {
                stone_rgb(h)
            } else {
                curtain_stone_rgb(h)
            }
        })
        .collect();
    mesh.colors = Some(colors);
    write_obj(out, &mesh)?;
    println!(
        "wrote castle-run {}  bays={}  pitch={:.2}  verts={}  tris={}  in {:.2?}",
        out.display(),
        bays_spec,
        m.pitch(),
        mesh.positions.len(),
        mesh.indices.len() / 3,
        t0.elapsed()
    );
    write_previews(out, preview);
    Ok(())
}
