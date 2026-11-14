# Anvilhold parallel passes

Run castle work as **disjoint specialists + one integrator**. Every specialist ends with the locked distant shot (`SHOT.md`). No freestyle cameras.

## Frozen kit contract (do not change without integrator)

| Lever | Value |
|-------|--------|
| Zone id | `ashen_bastion` |
| Curtain pitch | **7.92** (`tower_sep` 3.96) — `AB_KIT_PITCH` |
| Courtyard origin | world `(0, 2140)`; shot focus `(0, 2158)` |
| Gate clear | `arch_w` 1.85 → **3.7 m**; south face `z = -14` |
| BAM path | `apps/stick-web/public/zones/ashen_bastion.bam` |
| Shot | zoom **0.15**, `setCamera(0, 2158)` — see `SHOT.md` |
| Palette | cool `ROCK` / `ROCK_D` / `ROCK_L`, timber `WOOD_D`, plaster `GEAR_BONE` — not warm `WALL` |

Refs: `02-house-kit-reference.png`, `03-walls-gate-reference.png`, `04-target-full-build.png`.

## Roles

| Role | Owns (only) | Must not touch |
|------|-------------|----------------|
| **Walls** | `tools/ba-sdf-gear/src/castle.rs`, `gatehouse.rs` | `house.rs`, `bastion.rs` layout coords, `mesh.rs` palette |
| **Houses** | `tools/ba-sdf-gear/src/house.rs` (+ house tests) | `castle.rs`, `gatehouse.rs`, pitch / `AB_KIT_PITCH` |
| **Palette / walk** | `mesh.rs` BAM palette, `walkway.rs`, `mesh_bank.rs` cull/draw | SDF geometry dims / pitch |
| **Integrator** | `bastion.rs`, `main.rs` mesh AABB/res, `ashen-bastion.ts`, BAM assemble, merge, canonical shot | N/A — merges one slice at a time |

## Specialist loop (one pass)

1. Read this file + `SHOT.md` + your owned sources + the matching ref PNG.
2. Change **one** visual lever (silhouette, merlon/buttress rhythm, roof/gable, color band).
3. `cargo test --lib --manifest-path tools/ba-sdf-gear/Cargo.toml`
4. Rebuild only what you need:
   - Walls: `cargo run --release --manifest-path tools/ba-sdf-gear/Cargo.toml -- bastion --out tools/ba-sdf-gear/out/bastion`
   - Then copy BAM → `apps/stick-web/public/zones/ashen_bastion.bam`
5. Capture distant shot per `SHOT.md`. Save:
   - `docs/maps/anvilhold-castle/passes/<UTC>-distant.png`
   - `/opt/cursor/artifacts/anvilhold-<role>-distant.png`
6. Write `docs/maps/anvilhold-castle/passes/<UTC>-<role>.md` (3–6 lines): goal, files, before/after judgment, blockers.
7. **Stop.** Do not start a second lever until integrator merges.

## Integrator loop

1. Merge **one** specialist branch (prefer smallest diff).
2. Resolve only ownership violations (wrong file edits → revert those hunks).
3. Rebuild bastion BAM; copy to `public/zones/`.
4. Canonical distant shot → `distant-overview.png` + `passes/<stamp>-distant.png` + artifacts.
5. Pull next specialist.

## Contention rules

- **One Vite :3000 owner** per machine (integrator or the specialist currently shooting).
- **Never** two agents copy `ashen_bastion.bam` at the same time on a shared checkout — use **separate worktrees / cloud VMs**.
- Pitch / `BastionConfig` span / house pad coords stay integrator-owned.
- If draw freezes at zoom 0.15, empty the mesh bank only for diagnosis; ship with BAM loaded.

## Accept rubric (distant shot)

- Curtain reads as **long spans**, not a comb of tiny towers (pitch 7.92).
- Towers still chunky; gate arch clear on south.
- Houses: pitched roof + gables readable from iso; not flat boxes.
- Stone cool grey, not beige/green mush; timber dark; plaster light.
- Same framing as previous `distant-overview.png` (apples to apples).
