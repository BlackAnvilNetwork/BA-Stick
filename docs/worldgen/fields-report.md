# Grand Cartographic Engine: fields report (wg-0.2, branch feat/procedural-worldgen, not pushed)

## 1. Pale Hollow fixes (server water footprint unchanged)
- **Creeks:** traced along D8 flow lines, Chaikin-smoothed ×3, width set by catchment, and they branch. Uphill links: 0. 10 heads drain to the river or lake and 2 leave the map. 25 heads end in the two playa sinks at (30,119) and (58,135), which is endorheic by design.
- **Pads:** yard/gate soft pads now have a warped outline, soft radii of 16–18 m and a 0.72 blend weight, plus hillslope dissection. All anchors stay reachable (audit: 278 checked, 0 FAIL). The NE yard still shows a faint terrace edge on the minimap and could use another pass.
- **Farms:** ragged parcels that follow the terrain, with hedge gaps (no straight edges).
- **Biomes:** Whittaker check (temperature × precipitation) is 100% consistent. The dominant biome is 42.4%, under the 45% cap. There are ecotone transitions.
- **Left as is:** the circular lake and the tributary gap (1,355 isolated legacy water cells). See §2.

## 2. Proposal (not applied): server water-footprint change for Pale Hollow
File: packages/config/src/pale-hollow.ts.
1. Replace the PH_LAKE circle test in `paleHollowInOpenWater`, `paleHollowWaterSurfaceY` and the lake branch of `paleHollowWalkable` with a closed shoreline polygon (about 40 vertices). Take it from the generator's flooded lake mask (`out/pale_hollow.lake.json`, to be emitted), with radius varying ±25% and a delta lobe on the inflow side. Keep the surface Y unchanged.
2. Add a tributary channel polyline running from the isolated legacy water to the main stem near (-4,198). It needs a width of about 3 m and a surface that falls monotonically to the stem's Y at the junction. Wire it into the same three functions and mark it shallow/walkable (ford ≤0.5 m) wherever a trail crosses it.
3. Then re-validate:
   - mob spawn positions, diffed by id (biome-placed mobs near the shore may shift);
   - the nav-grid rebuild, watching the 8000-step cap and the 12 m snap;
   - check-anchors `pale_hollow --strict`, including npc-ph-chronomancer;
   - the server and client terrain hash (still missing; reported, not fixed);
   - re-bake.

## 3. Fields (zone-link order), continent and validation
Continent coords are the game's own `ZONE_ORIGINS` (zone-layout.ts: every band stacked north at x=0). I chose these over my gate-consistent placement because the client already draws the bands together. The relief, climate and noise fields are continuous in world coordinates, so the scenery is continuous across the bands.

**Contract, per field:**
- every walkable cell keeps the legacy stand height (0 mismatches);
- the blocked flags are identical (0 mismatches);
- legacy water surfaces are identical (0 mismatches);
- trails and bridges are unchanged;
- legacy props are kept verbatim.

Only blocked scenery is generated: relief, dissection, creeks, Whittaker biomes and vegetation. Outputs are `public/zones/<id>_gen.{baz,bap}`. The legacy files are untouched, so the old maps can be restored.

| field | world z0 | hard fails | anchor audit | hydrology | depth/bridges | warp circle | warnings |
|---|---|---|---|---|---|---|---|
| hollow_road | 500 | 0 | 6/6 PASS, 0 FAIL | 0 creeks, uphill 0 | deep 0, deepWalkable 0, bridges 0 | (0,68) 12 m from anchors | dominant biome meadow 62% |
| forest_basin | 820 | 0 | 6/10 PASS, 0 FAIL | 1 creeks, uphill 0 | deep 15344, deepWalkable 0, bridges 1 | (-10,-137) 19 m from anchors | dominant biome grass 75% |
| spur_road | 980 | 0 | 6/6 PASS, 0 FAIL | 0 creeks, uphill 0 | deep 0, deepWalkable 0, bridges 0 | (0,68) 32 m from anchors | dominant biome meadow 71% |
| ring_ward | 1280 | 0 | 6/6 PASS, 0 FAIL | 2 creeks, uphill 0 | deep 15049, deepWalkable 0, bridges 1 | (-33,56) 35 m from anchors | - |
| islet_fords | 1416 | 0 | 6/6 PASS, 0 FAIL | 0 creeks, uphill 0 | deep 35868, deepWalkable 0, bridges 0 | (92,-1) 68 m from anchors | dominant biome river 56% |
| green_reach | 1542 | 0 | 6/6 PASS, 0 FAIL | 3 creeks, uphill 0 | deep 1698, deepWalkable 0, bridges 0 | (-30,22) 42 m from anchors | dominant biome grass 90% |
| coil_pass | 1652 | 0 | 6/6 PASS, 0 FAIL | 0 creeks, uphill 0 | deep 0, deepWalkable 0, bridges 0 | (6,112) 44 m from anchors | dominant biome meadow 71% |
| coil_ridge | 1982 | 0 | 4/4 PASS, 0 FAIL | 7 creeks, uphill 0 | deep 3563, deepWalkable 0, bridges 0 | (2,-87) 33 m from anchors | dominant biome grass 56% |
Notes:
- **forest_basin:** 4 audit WARNs, all legacy: north-pass is blocked, and west-gap, northwest-gap and southwest-gap have no ZONE_LINKS row. Its blocked filler was "crypt", the minimap's "outside land mask" convention; it is now repainted as natural scenery.
- **Fords:** no field has walkable water. Legacy crossings are dry causeways or decks (islet_fords too). Every bridge lands on banks on both sides and spans deep water, with no warnings.
- **Biome dominance warnings** come from the fixed 16-entry BIOMES palette: forest, woodland and boreal all map to "grass", and the forest reads through props instead. Fixing this needs a palette or engine change, which is out of scope.
- **Limit (blocker for full naturalisation):** the gameplay footprints are geometric by design in config: straight roads, discs plus spokes, rings, a spiral, islets. The "no straight lines/arcs" rule can only be met in the scenery without changing walkability or stand in packages/config. I made no such change.

## 4. Continent draft (continent-geography.md) — zone table changes
- §6 places coil_pass/coil_ridge on the Seam Ridge. That is wrong: every field lies north of the Ash Road gate, and the Seam Ridge is Pale Hollow's northern wall (z≈470).
- Proposed rows:
  - **"Seam Country"**, the valley between the Seam Ridge and the Ember Crown, walled west by the Westwall. Westerlies spill through the Coil Gap (z≈820), so the country is wetter west and north; the Seam Water drains east to the Smirch.
  - hollow_road = the Seam Ridge north flank.
  - forest_basin = the Coil Gap rain basin.
  - spur_road / ring_ward = the East Spur.
  - islet_fords = the Seam Water braid.
  - green_reach = the north-bank floodplain.
  - coil_pass / coil_ridge = the Ember Crown's southern foothills (the Westwall–Ember Crown junction), overlooking the Ashlands.
- **Gate geometry is not spatially consistent** with a stacked layout. forest_basin's southeast-gap leads to spur_road, yet spur_road sits due north in ZONE_ORIGINS. Gate-faithful offsets (§5 of PROGRESS) exist as a proposal only.

## 5. Feature / landmark library (siting rules)
| feature | siting rule |
|---|---|
| Time Mage warp circle | walkable r≥5.5 disc, dry, ≥12 m from spawn/arrivals/gates, ≥6.5 m from props; scored toward entry arrival (per-field distance) and ≤7 m from a trail |
| ford | shallow ≤0.7 m where a trail meets a creek or river; prefer over bridges |
| bridge | only over deep water; must touch ≥2 distinct dry bank clusters |
| old-shore quay / strandline | on a former lake rim above the present surface (receding-water lore) |
| pass saddle shrine | lowest col on a range crest along a road |
| defaced stele | road junction with ≥3 branches |
| dry millrace | largest side-creek mouth on a main stem |
| cairn | ridge crest or a viewpoint with ≥40 m sightline |
| ruin footprint | flat (slope <0.15) shelf above the flood line, near water, off trails |
| grove / old tree | highest-moisture woodland cell at ≥10 m from floor |
| scree / talus fan | foot of slopes >0.8 |
| playa / salt flat | closed-basin sink cells (endorheic) |

## 6. Lore hooks per region ("The Kings rewrote the world. The land remembers.")
- **pale_hollow:** old-shore quays above a lake the census calls ancient; defaced stele; a millrace in a hollow that "never milled"; the warp circle mapped as a "sheepfold".
- **hollow_road:** the road shoulders are dressed stone (the pass was cut, not found). Seven "mile posts" form the circle.
- **forest_basin:** a spoke trail dead-ends at the pond where royal maps show a village. In the Counting Ring, the trees are all one age.
- **spur_road:** boundary stones that no charter records.
- **ring_ward:** a paving circle older than the walls; the walls bend around it.
- **islet_fords:** the river moved, the ring did not.
- **green_reach:** the ring shepherds won't graze.
- **coil_pass:** stones aligned to the Ember Crown summit.
- **coil_ridge:** the ring's north face is fused to glass, a witness to the Ember Crown.
- The community layer is mentioned only.

## 7. Warp-circle wiring plan (proposal only; nothing wired)
1. **Data:** add `WARP_CIRCLES` in packages/config (id, zoneId, x, z, radius 5) from `out/<id>.lore.json`.
2. **Unlock:** a per-character flag set by the Time Mage (npc-ph-chronomancer, server index.ts:2000) dialogue or quest, plus discovery (enter r5 once).
3. **Travel:** a server-validated action that is only allowed when standing in an unlocked circle. Its target is a discovered circle, and it reuses `applyTravel` with a TravelStep to the circle centre, offset 3 m outward.
4. **Client:** circle glyphs on the minimap and a ring VFX.
5. **Tests:** anchor audit entries for each circle (walkable, reachable, clear of anchors).

## 8. Next steps
- dungeons (crypt interiors);
- cities (Shard Dwellings expansion);
- tavern/interior reference (cities/01M5VS8S9DBFTNXWAA4Z4VBXGY.png);
- night lighting;
- Time Mage warp circles (unlockable), per §7;
- the PH water footprint, per §2;
- naturalising field footprints in config (needs approval);
- a forest/conifer biome palette entry;
- a server/client terrain hash;
- the nav-grid lineClear bug (nav-grid.ts:86), reported earlier and not fixed.

## Milestone 3 (2026-10-26): coil_ridge replaced, lakes naturalised

**coil_ridge → "The Broken Stair"** (proposed display name; zone id `coil_ridge` unchanged).
The spiral is gone. A ruin-strewn scarp: a sloped apron below the `tongue-lip` gate (spawn 0,-120 unchanged; feet 2.61 m, was 2.4),
the King's Stair (switchbacks up the scarp), and a broken highland shelf rising north toward the Ember Crown flank.
Water: the Stele Brook (shallow, wadeable) feeds the Mirror Tarn (irregular shore, wadeable shelf, deep core ~3 m), which drains by
the Sundered Gorge race (deep, 1.4 m, surface falling monotonically 8.05 → 0.8 m) to the SE corner. The Kingsbridge spans the race.
Ruins: Stele Field, Toppled Gatehouse, Scarp Head. Lore: the stair the chroniclers say was "always there" is cut through older stones.
Warp circle (data only, unwired): Scarp Head (-3,-40), the crossroads at the top of the stair.
Trail `tongue-track` removed; new trails `kings-stair`, `stele-way`, `gatehouse-way`.

**Lakes.** Shared `natural-shore.ts` (harmonic shoreline, tiers: wadeable fringe ρ≥0.8 ≤0.5 m, deep, deeper core).
Applied to the forest_basin North Mere, the green_reach pools and the ring_ward wharf basin. Pale Hollow lake: irregular shoreline, wadeable
east fringe, tributary/main-stem confluence opened near (-4,198). islet_fords: its water is a strait with round islets (land discs, not water); left as is.
Pale Hollow golems were pinned to their old positions so the lake change does not reshuffle `ph-golem-*` ids (golem-1 now reads riverbank, still dry).
Guard run-2 fixes: the Seam Tunnel gate (-6,412) stays dry (shore capped in that sector). pale_hollow_gen now writes the server stand height on every dry walkable cell, so it matches the config contract.
Warp circles: pale_hollow (84,216); coil_ridge (-3,-40).

## Natural edges (all surfaces)

- `apps/stick-web/scripts/natural-edges.ts`: domain-warped (12 m/90 m + 5 m/30 m + 1.8 m/7 m) and dithered biome borders with outlier tufts. This is applied to the BAZ biome in the legacy bake, generate-field and prop scatter (PH, FB, ring_ward). It is visual only: the server still uses the config biome. Exact biomes (hub_indoor, bridge, river) and wet cells never move.
- Trail flag verge is dithered (`trailVerge`, ±0.35 m around the half-width).
- Land masks in hollow_road, spur_road (amp 8), islet_fords, green_reach, forest_basin and coil_pass (amp 4) are wrapped by `naturalMaskDist`. It only bulges outward, so every previously walkable cell stays walkable. `*Raw` exports keep the geometric versions.
- The forest_basin lake gets a per-angle `cap` (no more straight clip). The PH gen terrace ring around the lake uses a warped lake distance.
- Left built/straight on purpose: ring_ward city, bridges, hub interiors, zone bounds.

## Natural areas (pass 2)

- `ecoMosaic` (natural-edges.ts) is a visual-only ecology pass run after the edge warp in the legacy bake (`bake-zones.ts`, second pass with slope, elevation and trail distance) and in `generate-field.ts`. It does the following:
  - Far-warps region borders (±~45 m), so disc and rectangle regions become lobes.
  - Splits classes along moisture (noise minus elevation): wet lowland meadow, dry upland scrub.
  - Adds groves (ashbeam) in grass, clearings and glades in ashbeam, copses in meadow, and fallow or hedgerow strips in farms.
  - Puts scree (mountain/quarry) on steep ground and scree aprons around mountains.
  - Adds worn dirt (ash_road) along trail verges.
  - Water, bridges, hub floors, riverbank and parchment-outside cells are never changed.
- Props in coil_ridge, green_reach and islet_fords follow the warped biome (`naturalSample`). Tests are updated to match.
- Pale Hollow Ash Pit west shelf (`phWestShelf`, config): the bed within ~5 m of the west shore (|angle| > 2.2 rad) is lifted to 0.12–0.48 m below the surface. This adds ~1,100 wadeable shallows cells. It only raises the bed and leaves the lake surface unchanged.
