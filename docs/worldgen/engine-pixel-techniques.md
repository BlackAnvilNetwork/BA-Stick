# Engine pixel techniques for land authors

Ground is a heightfield. Cells are 0.5 m. Each cell is two triangles, drawn back to front (increasing i + j) in `ground::draw_zone`. There are no sprites and no tile atlas. A colour is one of 16 global biome indices, then one of three slope steps. One metre of height is 44 px in the iso view (`HEIGHT_PX`). Relief past about 12 m hides ground: `draw_zone` culls with a margin that assumes that much relief around the followed unit, and the camera eases to the unit's own height, so the limit is relative.

Forest is not a ground colour. Woodland, boreal, and temperate forest all bake as `grass` (see the 16-biome note in `docs/worldgen/fields-report.md`). The canopy is tree props.

Water drawing is left as it is. This note only says how a crossing is authored in zone data so the existing water pass can show it.

## What a cell already is

`palette::BIOME_BASE` and `BIOMES` in `apps/stick-web/scripts/bake-zones.ts` are the same 16 names, in this order:

| index | name | base | what it is for |
|---|---|---|---|
| 0 | hub_indoor | `#6b5a45` | packed floor; bake keeps the edge exact |
| 1 | terrace | `#b3ab92` | pale built ground, building footprints |
| 2 | farm | `#8a7a3c` | tilled parcels |
| 3 | river | `#2f5f7a` | hidden wherever `F_WATER` is set |
| 4 | riverbank | `#6e6650` | dry bank and dry ford deck |
| 5 | bridge | `#7a5a3a` | hidden on a real deck (`F_BRIDGE` paints the stone-trail ramp) |
| 6 | ashbeam | `#4b4a3a` | grove floor under ash props |
| 7 | scrub | `#6f6a45` | open scrub; no grass blades |
| 8 | quarry | `#8b8478` | scree, broken paving |
| 9 | vine_cliff | `#4f5a3f` | dark green; blades still draw |
| 10 | ore_seam | `#5c5560` | dark rock |
| 11 | crypt | `#3c3846` | blocked outside that the minimap leaves blank |
| 12 | ash_road | `#5a534a` | worn dirt with no cobble |
| 13 | grass | `#4f6b38` | woodland floor; blades draw |
| 14 | mountain | `#6a6560` | blocked highland |
| 15 | meadow | `#6d8a46` | open green; blades draw |

Slots 16..63 of the 256-colour palette are `16 + biome * 3 + shade`. Shade multipliers are 1.14, 1.0, and 0.8 (`palette::SHADES`). After that come the trail ramps (`TRAIL_DIRT` 64, `TRAIL_STONE` 67), the water ramp (`WATER` 70), and the bridge ramp (`BRIDGE` 74). Those indices are global. A new zone reuses them.

Flags (`zone.rs`): `F_WATER` 1, `F_TRAIL` 2, `F_BRIDGE` 4, `F_BLOCKED` 8, `F_STONE` 16. `bakeZoneGrid` writes them. Bridge-over-dry-deck wins as `F_BRIDGE` when `waterSurfaceY` is null on the deck (Ring Ward does this: `ringWardInOpenWater` is false on the span, so the deck is not wet). Trails stamp only on cells that are neither water nor bridge.

`cell_color` picks the ramp. A water cell uses the water ramp. A bridge cell uses `TRAIL_STONE` plus the shade step. A trail cell would use `TRAIL_DIRT` or `TRAIL_STONE`. Anything else is the biome ramp. The iso pass then replaces trail cells with cobbles (below). The biome index under a water, trail, or bridge flag is not what the triangles show.

## Tricks that apply to every feature

**Slope steps.** `ground::slope_shade` takes one normal per 2×2 cells (1 m) against `atmosphere::SUN_DIR` (light from the north-west). Flat ground is step 1. Brighter than `SHADE_LIT` (0.78) is step 0. Darker than `SHADE_DARK` (0.62) is step 2. A cross-slope of about a quarter — Spur Road's shoulder, 2.5 m of lift over 10 m at the south lip — steps off mid: lit on the sun face, shadow on the other. A crest of under a metre over 10 m stays mid. A one-cell notch does not read; the normal is shared across a metre.

**Edge dither.** Where two plain biomes meet, or two shade steps meet, `fill_tri_edge` mixes them over half a cell (`EDGE_BAND` 0.5, coverage up to `EDGE_MAX` 0.5) with `dither::on`. The pattern is anchored to the world origin of the zone, so it stays put when the camera moves. `dither::bayer4` is a 4×4 Bayer matrix. No new colours: the neighbour pixel is that biome's own ramp, at the same shade step.

**Grain.** About one plain cell in twelve (`FLECK_EVERY`) gets a 2 px fleck one ramp step darker (`dither::darker`). Trails, water, and bridges skip it.

**Blades.** `ground::draw_meadow_grass` plants short lines on biome indices 9, 13, and 15 only (`GREEN_GROUND`: vine cliff, grass, meadow). Trails, water, and bridges stay bare. The blade colours are the meadow ramp (`MEADOW_DEEP`..`MEADOW_BLUE`), from `grass_field`, not the biome base. Scrub, ash road, mountain, and quarry do not get blades.

**Props, not tiles.** Cover, walls, peaks, and trees are procedural meshes in `props::draw_one`, depth-tested into the same buffer as the ground. Kinds are `props::kind` and must match `K` in `bake-props.ts`. `props::draw_shadows` calls `dither::soft_shadow`, which darkens bare ground one ramp step. Bushes, rocks, standing stones, cairns, trees, and wall blocks have a footprint. Scrub stalks, pebbles, banners, peaks, and bridges cast none.

**Bake-only breakup.** `naturalBiome` / `edgeWarp` feather biome borders (hub floor, bridge, and river stay exact; wet cells stay put). `ecoMosaic` then breaks soft classes by moisture, slope, and distance to a trail. `naturalMaskDist` only bulges a walk mask outward. None of this is a renderer change. The server still sees the config biome; the warp is in the baked grid.

## Roads

A road that should read as stones is a trail polyline.

`bakeZoneGrid` walks `trails[]` with `segDist` and stamps `F_TRAIL` inside `trailVerge` (the half-width, wobbling about ±0.35 m, with a small dither). `surface: "stone"` also sets `F_STONE`. Spur Road's centre line is `spurRoadTrails` (`center-road`, dirt, width `SR_TRAIL_WIDTH` 3.3). Ring Ward's streets are the same call with `surface: "stone"` (`ringWardTrails`).

In the iso pass every trail cell, dirt or stone, is drawn by `fill_tri_cobble` → `ground::cobble`. Stones are about 0.56 m (`COBBLE_PITCH`), so a 3.3 m road is about six stones across. Grout is `CR_NOSE`. Bodies cycle rock, wood, and wall colours. The shade step shifts which stone is picked. The fringe dithers into the neighbouring plain biome over `TRAIL_BAND` (a quarter of the cell, coverage up to a half). The grass side does not paint a dirt fringe back onto the road.

`F_STONE` does not change that cobble. It changes `cell_color` (the flat colour used by the 3D far pass) and the minimap mix in `minimap.rs` (stone tint versus a dirt tint).

Worn dirt that is not a cobble road is the `ash_road` biome, with no trail flag. `ecoMosaic` already paints it beside a trail: a walkable grass, meadow, scrub, or farm cell within roughly a metre of the verge becomes `ash_road`. Spur Road also paints `|x| <= 2.4` as `ash_road` in `spurRoadBiome`, and the mid pad as `hub_indoor` (that disc is exact, so the warp will not eat it). `ash_road` is a flat three-step ramp, edge-dithered, and it gets no blades.

A deck is `onBridge` plus a null water surface on the span, so the bake writes `F_BRIDGE` and the stand height stays the deck. Triangles are flat `TRAIL_STONE` plus shade, not cobbles. The arch, parapet, and abutments are prop kind `BRIDGE` (48), drawn in `draw_one` with a `TRAIL_STONE` deck and the masonry ramp (`BANK`..`BANK_DD`). Ring Ward places one in `bridgeProp`.

## Scrub

Scrub ground is biome 7. It is an olive ramp with slope steps, edge dither, and flecks. It is not in `GREEN_GROUND`, so the shoulders stay free of meadow blades. That is the open-country read.

The plants are props. Kind `SCRUB` (18) is six stalks in `SCRUB_C` / `WOOD_L` (`draw_one`). Kind `BUSH` (14) is a cluster of grass-coloured discs. `spurRoadProps` already alternates those two on an 8 m shoulder grid, off the centre line and off the mid pad. Pale Hollow's `clutter` in `bake-props.ts` uses the same kinds, gated on the scrub biome via `naturalSample`.

`ecoMosaic` will not leave a solid scrub field. On a scrub cell it can return grass where the moisture field is high, mountain where the broad noise is high, and quarry on the fine noise. Steep grass (slope above about 0.6) becomes scrub. Dry meadow becomes scrub. Blocked mountain that is gentle can become scrub. Count on a mosaic, and scatter props from the baked class if the scatter should follow it (`naturalSample`).

A woodland pocket on the same road is `grass` or `meadow` (blades) plus pine, spruce, cypress, or ash props (kinds 0..4, `draw_conifer` / the ash discs). `ashbeam` is the dark floor under ash. `vine_cliff` is the darker green, and it still receives blades. None of these is a new palette entry.

## Wards

A ward is a ring of existing classes and props. Ring Ward is the worked example.

- **Paving that is not cobble.** `ringStreetBand` and `ringWardAxisStreet` return `ash_road`. The keep floor is `hub_indoor` (exact edge). Building footprints are `terrace`. Grazing inside the ring is `meadow`. Outside the walk mask is `mountain`.
- **Streets that are cobble.** `ringWardTrails` are stone polylines, including `dryRingStreet`, which drops the samples that sit in open water so the bake does not try to stamp a trail on a wet cell.
- **The wall.** `outerWalls` in `apps/stick-web/scripts/zone-props/ring-ward.ts` places kind `WALL_BLOCK` (30) on a circle, with gaps at the axes and the gates. `draw_one` draws a shaded box (`WALL_L` / `WALL` / `WALL_D`, or the darker var). Walls cast a contact shadow. They also occlude: a tall prop covers units with smaller x + z. Leave the road out of that strip, or leave gaps, which the ring already does.
- **Standing stones.** Kind `STONE` (44) and `ROCK` (15) are the same shaded box as a pebble, larger, with one dithered crack (`dither_line`). Kind `CAIRN` (50) is `draw_cairn` (stacked rock tiers). Kind `PEBBLE` (45) is the small box and casts no shadow. Kind `BANNER` (43) is a cloth marker. The hub camp in `bake-props.ts` places stones, pebbles, and a banner; a ward uses the same kinds on a circle. Put `y` on the stand height.
- **Trees inside the ring.** `parkTrees` places ash and cypress only on baked meadow, outside the inner radius, off the trails. The meadow floor plus those props is the grove. There is no ward-green biome.

`ringWardOnTrail` treats the `ash_road` bands as trail for gameplay clearance. The picture of those bands is still the flat ash-road ramp, until a polyline also stamps `F_TRAIL`.

## Fords

Two crossings already exist. Both are data. Neither needs a change to the water pass.

**Dry bar.** Islet Fords keeps the crossing inside the walk mask and outside `isletFordsInOpenWater`. `terrainY` drops the bar to `IF_CREST` (0.9 m) while the pads sit at 1.6 m and the water surface is 0.3 m, so the bar is dry ground above the surface. `isletFordsBiome` paints that bar `riverbank`. The channel beside it is `river` plus `F_WATER`. The ford trail (`isletFordsTrails`, dirt) stamps only on the dry cells, so the bar cobbles and the water does not. Water cells next to that land already get the shore band in `draw_zone` (`SHORE_BAND`, foam on the south-east edges). Author the mask, the height, and the biome. Leave the foam and the swell alone.

**Shallow wade.** Coil Ridge's brook and tarn shelf set a water surface and a bed, and `coilRidgeWalkable` stays true while `surf - bed` is within `WADE_DEPTH` (0.4 m). The bake still flags those cells `F_WATER` and sets the mesh to the surface, so they draw as water, not as stones. `Zone::deep_water_at` is the wade test: the cell and its four neighbours must all be water and none a bridge. A channel narrower than three cells (1.5 m) has no deep cell. Islet Fords says this outright: off the fords the channel is wider than 1.5 m, so it can wade; the fords themselves are the dry bars.

A bridge across deep water is the Ring Ward pattern above: deck flagged `F_BRIDGE`, prop kind `BRIDGE`, banks as kind `RIVER_WALL` (47, mitered by `link_walls`).

Spur Road has no water surface (`spurRoadWaterSurfaceY` is null). A saddle there is a dry bar: a dip in `spurRoadStandHeight`, `riverbank` or `ash_road` on the dip, and either the centre trail or a few `PEBBLE` / `ROCK` props. That uses the ground pass only.

## Ridges

The mesh is the ridge. `spurRoadStandHeight` is the small version: the road follows `roadY` (1.4 m at the south lip, 3.2 m on the mid rise, 1.6 m at the north lip), and outside the mask the ground lifts toward `SR_CAP` (3.9 m) over 10 m. Blocked cells are `mountain`. The minimap darkens `F_BLOCKED` and draws a hillshade plus a contour every 1.5 m.

Keep the whole zone inside about 12 m of relief. Coil Ridge clamps stand height at 11.5 m for this reason. One metre is 44 px, the same shift as 2.75 m of ground-plane depth, so a 4 m crest already moves the far side by 176 px. Past the cull margin the ground behind the crest is simply not drawn.

`ecoMosaic` turns a slope steeper than about 1.1 into `mountain` or `quarry` (scree). A blocked mountain apron can break into quarry. Quarry is only a colour in the frame: `draw_forge_ambient` is not called from the scene.

The skyline above the mesh is prop kind `PEAK` (46). `draw_one` builds a rock cone (scale `s`, height about `7.2 * s`) plus a side peak. `peakRockScale` in `bake-props.ts` sets `s = max(0.7, h/8)` and stores the authored height in `h`. Pale Hollow's `peaks` and Green Reach's peak list place them on the high stand height. A peak does not cast a contact shadow, and it does cover the lane behind it. Put peaks off the road.

A crest marker that should not hide the road is a `CAIRN` or a `STONE`, not a peak. Switchbacks are a stone or dirt trail on the slope (Coil Ridge's stair polylines) plus the height function. The trail cobbles; the shade steps follow the grade.

## Must wait

These need an engine change. They are out of scope for a land pass.

- **A 17th biome.** The 16 names fill slots 16..63. `fields-report.md` already records that forest, woodland, and boreal share `grass`, and that a forest floor colour needs a palette change. Adding a slot renumbers `BIOME_BASE`, `BIOMES`, `GREEN_GROUND`, and every baked index.
- **A new water look, including further animated water.** The swell, the shore foam, and the water ramp already run. Retuning them is a renderer change, and that rendering belongs to the basin work. Author crossings with the dry bar, the shallow wade, or a bridge, as above.
- **A dirt trail that is not cobble in the iso view.** `fill_tri_cobble` ignores `F_STONE`. A flat dirt road is the `ash_road` biome with no trail flag. A separate dirt-trail fill would be a ground-pass change.
- **Embers on quarry.** `draw_forge_ambient` exists and is not called. Wiring it is a scene change. Until then, quarry and ore seam are ordinary ramps.

## Spur Road, with no engine change

The zone is already inside the budget: no water, cap 3.9 m, biomes `hub_indoor`, `ash_road`, `scrub`, and `mountain`. A land author can:

1. **Keep or bend the cobble centre.** Edit the polyline in `spurRoadTrails`. Width stays `SR_TRAIL_WIDTH` (3.3). The bake stamps `F_TRAIL` through `trailVerge`. The iso view cobbles it. `surface: "stone"` only changes the minimap tint.
2. **Leave worn dirt as `ash_road`.** The `|x| <= 2.4` strip, plus the automatic `ecoMosaic` verge on nearby scrub, is the flat ramp. It is not cobble, and it grows no blades. The strip is not an exact biome, so `naturalBiome` feathers its edge. The mid pad stays `hub_indoor`, which the warp will not move.
3. **Let scrub be biome 7 plus props.** `spurRoadProps` already plants `K.scrub` and `K.bush` on the shoulders. Add `K.rock` the same way. Bushes and rocks darken the ground (`draw_shadows`); scrub stalks do not. Expect `ecoMosaic` to sprinkle grass, mountain, and quarry into the scrub field.
4. **Shape the shoulders with height.** `spurRoadStandHeight` lifts blocked `mountain` toward 3.9 m. A couple of metres over about 10 m is enough for `slope_shade` to leave mid. Stay under about 12 m. A crest mark is `K.cairn` or `K.stone`. A `K.peak` is for a skyline off the road.
5. **Cut a dry saddle if a ford is needed.** Dip the stand height, paint `riverbank` or `ash_road`, and keep the centre trail or drop pebbles. Do not add a water surface to get a new water colour.
6. **Read a grove through props.** Paint a pocket `grass` or `meadow` so `draw_meadow_grass` runs, and place pine, ash, or cypress. That is the forest. There is no extra ground colour for it.
