# Anvilhold castle images

Reference pack for the Ashen Bastion / Anvilhold courtyard build. **Do not copy reference labels into game ids.**

| File | Role |
|------|------|
| [`01-current-heightfield.png`](./01-current-heightfield.png) | **Now** — zoomed iso of the live heightfield curtain / yard / keep pads |
| [`02-house-kit-reference.png`](./02-house-kit-reference.png) | **Houses kit** — timber / stone house archetypes to build via `ba-sdf-gear` SDF; walk-in doors + interiors |
| [`03-walls-gate-reference.png`](./03-walls-gate-reference.png) | **Walls + gate** — low-poly curtain, towers, gatehouse; match with existing SDF kit |
| [`04-target-full-build.png`](./04-target-full-build.png) | **Target** — filled courtyard (houses, market feel, banners); composition goal |

Mirrored under `tools/ba-sdf-gear/art/anvilhold-castle/` for the SDF pipeline.

## Zone wiring

Playable zone id remains `ashen_bastion` (`packages/config/src/ashen-bastion.ts`). BAM1 meshes ship as `apps/stick-web/public/zones/ashen_bastion.bam`.

## Courtyard houses (SDF)

Kit sheet [`02-house-kit-reference.png`](./02-house-kit-reference.png) → `tools/ba-sdf-gear/src/house.rs` archetypes (chapel deferred):

| Mesh | Sheet | Notes |
|------|-------|-------|
| `house_l` | A | Large L timber, stone base, half-timber upper |
| `house_tall` | B | Small 2-storey, cantilevered upper |
| `house_workshop` | C | Stone 1-storey, wide door |
| `house_shed` | D | Small plaster shed + quoins |
| `house_stone` | H | Small stone + timber gables |

Doors ≥ **1.2 m** (`DOOR_WIDTH_M`); hollow shell interiors. Placements in `bastion.rs` `HOUSE_PLACES` aligned with `AB_HOUSE_PADS`.

```bash
cargo run --release --manifest-path tools/ba-sdf-gear/Cargo.toml -- bastion --out tools/ba-sdf-gear/out/bastion
# then copy tools/ba-sdf-gear/out/bastion/ashen_bastion.bam → apps/stick-web/public/zones/
pnpm --filter @bellgrave/stick-web exec tsx scripts/bake-zones.ts ashen_bastion
```
