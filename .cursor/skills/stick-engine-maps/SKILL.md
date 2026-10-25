---
name: stick-engine-maps
description: >-
  Design, size, bake and wire a map area (zone) for BA-Stick on Stick Engine:
  heightfield grid (BAZ1), static props (BAP1), relief and footprint budgets,
  iso / perspective camera rules, server zone hand-off, minimap. Use when
  turning a reference map or area description into a playable zone, or when
  sizing a zone's footprint and elevation. Do not copy names from reference
  art. Do not start a zone without this skill, a reference image, and an area
  sheet. Connect areas with a travel zone between them.
---

# Stick Engine map building

A map area is one zone. One TypeScript config module is the single source of truth. The server calls its functions for walkability and height. A bake script turns the same functions into two binary files the client draws. Nothing is hand-painted.

```
packages/config/src/<zone>.ts   bounds, biome(), height(), walkable(), water, trails, bridges, gates, labels
        |                          (server imports it; bake imports it)
apps/stick-web/scripts/bake-zones.ts + bake-props.ts
        |  pnpm --filter @bellgrave/stick-web zones
apps/stick-web/public/zones/<id>.baz  (BAZ1 grid)   <id>.bap  (BAP1 props)      [gitignored]
        |  fetchZone / fetchProps  ->  loadZone / loadProps  (wasm)
engine/ba-stick-render/src/{zone,ground,props,minimap}.rs  ->  stick_engine raster (CPU, 640x360)
```

## 1. Ground truth

| Repo | Role |
|------|------|
| BlackAnvilNetwork/stick-engine | Standalone Rust engine (CPU pixel raster, WASM + native). Procedural stick figures, camera rig, data-driven anims. No game content, no networking. |
| BlackAnvilNetwork/ba-stick | The game. apps/stick-web client, apps/server WebSocket server (20 Hz), packages/config zones and world data, engine/ba-stick-render map/props/units renderer, engine/stick-engine = git subtree of the engine. Worn gear (`.ron` solids and pixel sheets) is `stick-gear-ron`, not this skill. |

Things people assume that are not true here:

No sprites, tile atlases or Y-sorted sprite painter. Ground is a heightfield of 0.5 m cells drawn back-to-front (increasing i + j) as shaded, dithered triangles. Props are procedural shapes written into the framebuffer's f32 depth buffer, and units are drawn into the same buffer, so occlusion is a depth test. There is no bounding-box slicing.

No P2P, WebRTC or IPFS in the client, server or engine. The engine is protocol-agnostic (PLAN.md non-goal). ba-stick is server-authoritative: WebSocket JSON at TICK_HZ = 20, and the client eases units toward their latest position (Scene.smoothing).

A zone boundary is a server event. The server sends a new you.zoneId. The client drops all units, fades (ZONE_FADE_MS = 450), fetches <id>.baz and <id>.bap, and loads both whole. There is no in-zone chunk streaming, so the whole grid sits in memory.

First-/third-person exist only in standalone stick-engine (CamRig: Iso, ThirdPerson, FirstPerson; V / Numpad 5; #cam=tp). Their ground is a flat procedural floor (GroundMap), not the heightfield. ba-stick ships iso plus an iso-to-perspective blend (setView3d, Camera.persp, PERSP_K = 0.045). That blend is a local patch in engine/stick-engine/.../camera.rs and is not in upstream, so git subtree pull will conflict there.

## 2. Coordinates and scale

World = x, z on the ground plane (metres), y up (metres). The iso camera looks toward -x, -z.

Iso projection, relative to the camera target: sx = 320 + 32(x - z), sy = 198 + 16(x + z) - 44y (ISO_X 32, ISO_Y 16, HEIGHT_PX 44, ISO_SCALE 45.25). Framebuffer is 640x360, integer-upscaled.

A 1 m tile is a 64x32 diamond. A 1.8 m figure is about 80 px tall.

One screen shows about 20 m on (x - z) by 22.5 m on (x + z), roughly 225 m^2 of ground. Use area / 225 as a "screens" measure.

1 m of height shifts 44 px, the same as 2.75 m of (x + z) depth. Relief hides ground.

Tall props cover units behind them, meaning smaller x + z (up-screen). Keep lanes and spawns out of that strip, or leave gaps.

ground.rs::draw_zone culls with margin_m = 4 + 12 * HEIGHT_PX / ISO_Y / 2 (about 20.5 m). That assumes at most ~12 m of relief around the followed unit. Stay inside it, or raise the margin.

Camera follows the unit; cam_y eases to the unit's y, so relief is relative, not absolute.

Perspective views (standalone only): NEAR 0.08 m, FAR 60 m, ordered-dither fog 18 m to 60 m.

## 3. Data formats (byte exact, little-endian)

BAZ1 (zone.rs::Zone::parse; the length check is exact: 24 + 4*w*h)

```
magic "BAZ1" | f32 minX | f32 minZ | f32 cell | u32 w | u32 h |
u8 biome[w*h] | u8 flags[w*h] | i16 heightCm[w*h]       index = j*w + i, x = minX + i*cell, z = minZ + j*cell
```

cell is 0.5 in every bake and in the code comments. Keep it.

Height is i16 centimetres (+-327.67 m hard limit; +-12 m practical, see section 2). height_at is bilinear.

Flags: 1 water, 2 trail, 4 bridge, 8 blocked, 16 stone trail. Bake rule: bridge wins over water. Trails are only stamped on cells that are neither water nor bridge.

deep_water_at (wading) needs the cell and its 4 neighbours to be water and none a bridge. A channel narrower than 3 cells (1.5 m) has no deep cell, so it is visual only.

Biomes are indices into BIOMES in bake-zones.ts, which must match BIOME_BASE in palette.rs: hub_indoor terrace farm river riverbank bridge ashbeam scrub quarry vine_cliff ore_seam crypt ash_road grass mountain meadow.

The cap is 16. Palette slots 16..63 are 16 + biome*3 + shade and slot 64 is TRAIL_DIRT, so a 17th biome means renumbering the palette.

Colours are global per index, not per zone. A new zone reuses these (forest floor = grass/meadow, blocked highland = mountain, dark understorey = vine_cliff), or adds per-zone palettes (open item).

BAP1 (props.rs::parse)

```
magic "BAP1" | u32 n | n x { u8 kind | u8 var | f32 x z y yaw s w h d }      34 bytes per prop
```

Kinds (bake-props.ts K must equal Rust props::kind): trees 0 pine, 1 spruce, 2 cypress, 3 ash_med, 4 ash_tall (s = height m) | cover 10..20 (long_grass, tall_patch, fern, tuft, bush, rock, stalk, reed, scrub, bloom, sapling) | structures 30..45 (wall_block, moss, fire_pit, tent, bedroll, crate, chest, lean_to, trainer, stall, weapon_rack, firewood, barrel, banner, stone, pebble) | 46 peak (s = max(0.7, h/8), h = height m, y = base stand height) | 47 river_wall (s length, w thickness, h height, d coping; consecutive segments auto-mitre via link_walls) | 48 bridge (s span, w deck width, h arch lift, y left end, d right end height, var = ramp fraction x 200).

## 4. Size and depth: the area sheet

Fill this in before writing any config. Every area must state all six.

| # | Field | Rule |
|---|-------|------|
| 1 | Bounds | minX maxX minZ maxZ in m. Area, screens (/225), bake bytes = 24 + 4*w*h with w = ceil(dx/0.5)+1. |
| 2 | Walkable mask | Irregular shapes fill the bounding box; outside cells are F_BLOCKED + mountain. They still cost 4 bytes each. State the walkable %. |
| 3 | Relief | min/max height, max slope, strata (lowland, bank, plateau, ridge, peak), water surface. Inside +-12 m. |
| 4 | Widths | Corridors, rivers, trails, bridges, in m. |
| 5 | Exits | Gate rects, soft level, blocked flag, destination zone. |
| 6 | Landmarks | Name, x, z, kind (area, camp, landmark, water). |

Reference zone, Pale Hollow (packages/config/src/pale-hollow.ts, docs/pale-hollow-area.md): bounds x -88..88, z -24..268 = 176 x 292 m = 51,392 m^2 (about 228 screens); grid 353 x 585 cells, 826,044 B (806.7 KiB); four bands 48-79 m deep; 15 peaks, h 5.5-9.0 m, r 14-22 m; hub pad floorY 3.0; river carve 1.35 m, water clearance PALE_HOLLOW_WATER_CLEARANCE 2.55; trail 3.3 m, bridge deck 3.9 m, main river half-width 6.8 m (banks to 14.5 m).

## 5. Worked example: sprawling branching forest basin

Source: a written description of a reference map (irregular branching footprint with finger-like peninsulas, narrow connecting corridors and wide expanses, high ground N / W / SE, a lake in a northern depression feeding a winding river south through a central lowland valley, dense tree valleys, narrow brooks on the southern fingers). Only the text was available, so every number below is a proposal, not a measurement. Adjust to the real map, then re-run the area sheet.

| Description | Engine representation | Proposed numbers |
|-------------|----------------------|------------------|
| Branching, finger-like footprint | Walkable mask = union of capsules along a branch graph (spine + fingers, per-edge width), same segDist idea as trails in bake-zones.ts. Outside = F_BLOCKED + mountain. | Bounds 320 x 320 m (102,400 m^2, about 455 screens), about 50% walkable (about 51k m^2, close to all of Pale Hollow). Bake 641 x 641 = 410,881 cells = 1,643,548 B (1.57 MiB). |
| Narrow corridors vs wide expanses | Corridor = capsule 4-8 m wide (8-16 cells). Expanse = discs 40-90 m across. | Corridor min 4 m so it still reads as a place, not a trail (trail is 3.3 m). |
| Many entry/exit paths | Soft-gate rects at corridor ends and finger tips, like PH_TIMBER_BRIDGE / PH_ASH_ROAD. Server owns destination zone ids. | 4-6 gates. Each rect >= 6 x 6 m. |
| Mountains N / W / SE | PH_MOUNTAINS-style {x, z, r, h} table drives both height and peak props. Ridge belts between peaks. | h 7-10 m, r 14-22 m, ridge crest <= 10 m. Whole zone <= 12 m relief. |
| Northern lake in a depression | Height bowl with a rim; F_WATER where surface > ground. | Rim 4-6 m, surface about 1.5 m, bed carve about 1.35 m, copying Pale Hollow's carve and clearance. |
| River winding south through a central valley | Centreline function like riverCenterX(z) (sum of sines: up to about 40 m swing, dominant wavelength about 57 m), or a spline for the branching map. Banks = riverbank, bank walls where it cuts the valley. | 6-14 m wide in the valley, surface falling about 1.5 m to 0 over about 250 m (about 0.6% grade). Bridges at corridor crossings. |
| Dense tree cover in valleys | Re-use the trees() scatter in bake-props.ts: jittered grid, biome-gated. | Grid about 5 x 5.5 m (Pale Hollow uses 7.5 x 8.5). 10,000 props = 340 KB. Measure frame cost before going denser. |
| Narrow brooks on southern fingers | F_WATER strips. | 1.5-3 m wide. Anything under 1.5 m is decoration with no wading. |

## 6. Camera and view rules for authors

| Mode | Where | Projection | What it reads from map data |
|------|-------|------------|-----------------------------|
| Iso | ba-stick, standalone | Orthographic, 2:1 dimetric | Heightfield cells, props, depth buffer. This is the only mode every zone must work in. |
| Iso to perspective blend | ba-stick (setView3d) | Same azimuth, per-depth scale 1/(1 - 0.045*persp*v) | Same data. Draw order and closed-form picking unchanged. |
| Third person | standalone only | Perspective, boom 6 m, pitch 30 deg | Flat floor today. |
| First person | standalone only | Perspective, eye at head, pitch +-60 deg | Flat floor today. |

Author in Y-up metres with real heights, never iso-only tricks, so true FP/TP can be added later.

If you build height-aware FP/TP, you need: a heightfield rasteriser for arbitrary yaw (draw_zone is iso-only, ordered by i + j, with closed-form unproject_ground); spring-arm and line-of-sight rays stepped at cell against Zone::height_at; prop fade for the boom. None of this exists yet.

Modes only change the view. The server and the unit y never depend on the camera.

## 7. Server hand-off and sync

The bake writes paleHollowStandHeight (the rendered terrain mesh). Server players use that same function for y. Server mobs, NPCs and nodes use paleHollowHeight, which bows above the mesh chords on hills, so they can hover a little. Use the stand height for every unit's feet in a new zone.

Per snapshot the client calls upsertUnit(id, x, y, z, facing, anim, preset). Anim states are idle walk run melee cast rest dead. The server sends state, not poses.

Walkability, gates, soft levels, nodes and mobs are server data in config (paleHollowWalkable, paleHollowGateSoftLevel, which looks the soft level up by z band, PH_ALL_MOBS, apps/server/src/pale-hollow-world.ts). The baked F_BLOCKED is a copy of walkable(), so regenerate it whenever that function changes.

Same-seed rule: any random placement (trees, clutter) must be deterministic. Use hash2(i, j) from bake-props.ts.

## 8. Build steps for a new zone

Config (lands in bichael first; packages/* and server code sync down): packages/config/src/<zone>.ts with BOUNDS, biome, height, standHeight, walkable, waterSurfaceY, inOpenWater, trails, bridges, mountains, gates, spawn, MAP_LABELS, ROAD_NAMES. Re-export from index.ts; add the id to ZONE_IDS and ZONES (and world.ts if it is a campaign area).

Bake: generalise bake-zones.ts (bakePaleHollow is hard-coded to Pale Hollow bounds, biome fn and trails) and add <zone>Props() plus encodeProps in bake-props.ts. Output public/zones/<id>.baz|.bap.

Register: apps/stick-web/src/zones.ts BAKED; minimap.ts mapDataFor (returns null for every zone except pale_hollow today). Label kinds: area 0, camp 1, landmark 2, water 3.

New prop kinds: add to props.rs (kind, draw_one, footprint, reach), K in bake-props.ts, and palette entries. Rebuild wasm with engine/build-wasm.sh (pnpm --filter @bellgrave/stick-web wasm).

Server world module like apps/server/src/pale-hollow-world.ts (mobs, nodes, respawns).

Tests: extend bake-props.test.ts / units.test.ts patterns; add Rust tests next to zone.rs / props.rs.

## 9. Verify before calling it done

- pnpm --filter @bellgrave/stick-web zones runs; .baz length == 24 + 4*w*h; Zone::parse accepts it.
- Spawn cell is not F_BLOCKED; every gate is reachable from spawn over unblocked cells (flood fill).
- Relief within +-12 m everywhere; no cell height outside i16 cm.
- Compare server stand height with Zone::height_at at 20 random walkable points and note the max error (bilinear sampling plus 1 cm quantisation; expect it to grow on steep slopes).
- Bridge fixture still matches (src/content/bridge-profile.json, bake-props.test.ts).
- pnpm --filter @bellgrave/stick-web test and pnpm typecheck pass.
- cargo test --manifest-path engine/Cargo.toml (set CARGO_TARGET_DIR=$PWD/engine/target).
- Demo: ?demo&zone=<id>&x=<x>&z=<z> and again with &view=3d; check each gate and the lake and river edges.
- Standalone engine changes: cargo test, cargo run --release -p stick_engine --example camshots -- out/.

## 10. Hygiene

Every new file under engine/ starts with the Black Anvil AGPL-3.0-or-later header; add it with node scripts/add-license-headers.mjs (CI runs --check). Mark modified third-party files with a dated notice.

Don't edit engine/stick-engine in ba-stick except to carry the existing persp patch. Land engine changes in stick-engine first, then git subtree pull --prefix engine/stick-engine https://github.com/BlackAnvilNetwork/stick-engine.git main --squash.

Original IP only: no trademarked game or place names in ids, comments, prompts or UI copy (same rule as bellgrave-sprites). Use neutral working ids such as forest_basin; keep a reference map's own names out of the repo.

Third-party art, fonts and snippets must be AGPL-compatible and commercially usable (CC0, CC-BY 4.0, MIT, BSD, Apache-2.0).

## Working rules

- Read this file before a new zone. Attach a reference image. Write the six-field area sheet first. The current chain is [plan.md](plan.md).
- Do not copy names, captions, or watermarks from reference art into ids, comments, or labels.
- A player crosses from one area to the next by walking a travel zone. Do not teleport two areas together with no ground between them.
- Pale Hollow files stay with the session that is already editing them. New zones are new modules.
