# ba-sdf-gear

Black Anvil **Unified SDF + RON Object Pipeline** · **v1.2**

- **Spec:** [`PIPELINE.md`](./PIPELINE.md)
- **Agent guide:** [`.cursor/skills/ba-sdf-object/SKILL.md`](../../.cursor/skills/ba-sdf-object/SKILL.md)

RON describes · SDF defines · extraction realizes · live game accepts.

**Next gate:** Spike 0 — extracted Jensen mesh as a native BA-Stick object (PIPELINE.md §9.1).
Capsule/Line/Disc and disc-cloud are optional/diagnostic backends, not targets.

## Current CLI

```powershell
cd tools/ba-sdf-gear
Remove-Item Env:CARGO_TARGET_DIR, Env:RUSTFLAGS -ErrorAction SilentlyContinue
cargo test --lib
cargo run --release -- generate assets/jensens_huang_v1.ron --out out/jensens_huang.obj
# Architecture fixture (hand SDF from art/gatehouse_front.png):
cargo run --release -- gatehouse --out out/gatehouse.obj
# Open doors (0..1) + dual-angle previews (yaw 0° / 90°):
cargo run --release -- gatehouse --door-open 0.85 --out out/gatehouse_open.obj
```

## Gatehouse fixture

- Art: `art/gatehouse_front.png`
- Object RON (intent): `assets/gatehouse_v1.ron`
- Analytic SDF: `src/gatehouse.rs`
  - Hollow towers + arrow-slit interiors
  - Hinged door leaves (`--door-open`)
  - Corbels, voussoirs, footing, plank grooves
- Extracted: `out/gatehouse.obj`
- Previews: `out/gatehouse_y000.png` (front), `out/gatehouse_y090.png` (side)

## Curtain wall + generative castle kit

Shared module dims in `src/castle.rs` (`CastleModule`, pitch = `2 * tower_sep`).
Adjacent bays share tower axes so posts merge.

```powershell
cargo run --release -- curtain-wall --out out/curtain_wall.obj
# Generative run: curtain | gate | gate:0.85
cargo run --release -- castle-run --bays "curtain,gate:0.85,curtain" --out out/castle_run.obj
```

- Art: `art/curtain_wall_front.png`
- RON: `assets/curtain_wall_v1.ron`
- Previews: `out/curtain_wall_y000.png`, `out/curtain_wall_y090.png`

## Ashen Bastion courtyard (BAM1)

Curtain + gatehouse + **house kit** + Vigil Walk → `out/bastion/ashen_bastion.bam`.

**Walls / gate** (sheet `art/anvilhold-castle/03-walls-gate-reference.png`):

- Curtain pitch **7.92** (3× old 2.64); silhouette at play grid (`res` 56 → `RES_PLAY=40`), not `RES_HI`.
- Gate uses `CastleModule::to_gatehouse(1.0)` — `arch_w` **1.85**, towers at **±2.55**, open doors; bastion layout places it at **x=0** and skips overlapping south curtains.

House archetypes (`src/house.rs`, kit sheet `art/anvilhold-castle/02-house-kit-reference.png`):

| Mesh | Sheet | Footprint |
|------|-------|-----------|
| `house_l` | A | Large L timber / stone |
| `house_tall` | B | Small 2-storey overhang |
| `house_workshop` | C | Stone 1-storey workshop |
| `house_shed` | D | Small plaster shed |
| `house_stone` | H | Stone + timber gables |

Doors ≥ **1.2 m** (`DOOR_WIDTH_M`); hollow interiors. Placements: `bastion.rs` `HOUSE_PLACES` ↔ `AB_HOUSE_PADS`.

```powershell
cargo run --release --manifest-path tools/ba-sdf-gear/Cargo.toml -- bastion --out tools/ba-sdf-gear/out/bastion
Copy-Item -Force tools/ba-sdf-gear/out/bastion/ashen_bastion.bam apps/stick-web/public/zones/
pnpm --filter @bellgrave/stick-web exec tsx scripts/bake-zones.ts ashen_bastion
```

House meshes use `res < 45` → `RES_COARSE=28` so many instances stay drawable.

Native in-game install still blocked on **Spike 0**.
