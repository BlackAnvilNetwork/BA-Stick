# Seam Country population: monsters, drops, quests, structures
_Status: **DRAFT, open to Map and World Builder's input.** Nothing is committed or pushed. It is built so a swap is a one-row change: every mob family, drop list, quest and camp is one table row and one data row in code._
_Author: New Bot. Sources: packages/config (branch feat/procedural-worldgen, local tip e89513e), packages/items catalog, lore-bible §12, civilization-layer.md, regions-and-peoples.md, continent-geography.md, ids-to-names.md, fields-report.md._

## 0. What the code says (constraints found)
- **Levels.** `AREAS.pale_hollow.levelBand` is 1–20; Ashlands is 21–40. Pale Hollow's mobs run Lv 1–18 (the Lip dwellers by the Ash Road are 15–16). **The eight fields have no level band in code.** Their gates' `softLevel` values (6–15) are placeholders, not bands. **Flag:** the ramp in §1 is my proposal.
- **Runtime.** The server spawns mobs, credits kills and runs quests **only for Pale Hollow** (`pale-hollow-world.ts`, and `zoneId === "pale_hollow"` checks in `apps/server/src/index.ts`). Field mobs and quests therefore need a small server change: run the same mob and quest loop per field zone, reading new config data. **This is beyond "data and config", so it needs Macks's approval before I build it.** The proposed change is to generalise the existing Pale Hollow loop by zone id, with no new rules.
- **Quests are kill quests** (`need` kills from a fixed list of mob ids, gold on turn-in). "Read the fragment at the POI" is not wired anywhere (world-pois.ts is data only). Each fragment beat below is therefore a kill quest whose story ends at the POI, and the POI is the quest structure. A true "visit/read" objective would be a second server change; flagged.
- **Models.** The renderer knows ten mob rigs (`MOB_ARCHETYPES` in engine/ba-stick-render/src/preset.rs). A new rig means a new preset there, plus a wasm rebuild.
- **Mayflower** (Pale Hollow's eastern spur, where the six town givers live) is not on this branch yet. Its quests are written here and can be wired once it lands. Until then, every field quest has a field giver.

## 1. Level ramp (proposed; flagged)
In zone-link order, overlapping by one level so each field hands off to the next, ending at Ashlands' Lv 21.

| Field | Levels | Elite / named |
|---|---|---|
| Hollow Road | 13–14 | — |
| Forest Basin | 14–15 | 16 |
| Spur Road | 15–16 | — |
| Ring Ward | 16–17 | 18 |
| Islet Fords | 17–18 | — |
| Green Reach | 18–19 | 20 |
| Coil Pass | 19–20 | 20 |
| The Broken Stair | 20–21 | 22 (Hollow, Ashmouth, Sootkin) |

HP follows Pale Hollow's curve (about 12.5 × level: Lv 16 ≈ 200, Lv 18 ≈ 225), elites ×2.5.

## 2. Mob families per field
"Reuse" means an existing rig with a new tint and scale (no renderer change). "New" means a new procedural stick-figure rig in the same style.

| Field | Mob (display name) | Lv | Aggro | Model | Lore hook |
|---|---|---|---|---|---|
| Hollow Road | **Tithe-Taker** | 13–14 | sight, linked | **New: Crown Soldier** (tabard, pike) | Collects the Tithe of Hands at the road; one work in seven goes up the King's Way. |
| Hollow Road | **Toll Hound** | 13 | sound | Reuse: canine (Hollow Scavenger rig), grey tint | The tithe patrol's dogs. |
| Forest Basin | **Mere Wolf** | 14–15 | sight, packs of 3 | Reuse: canine, dark tint, ×1.15 | Basin wildlife, hunting the replanted wood. |
| Forest Basin | **Blightback Boar** | 14–15 | sound | Reuse: Ashbeam Boar, ash-grey with pale spines | A boar that grazed on the burn scar. |
| Forest Basin | **Rootsick Stag** | 15 | proximity | **New: Stag** | Corrupted beast that drinks from the Drowned Spoke and won't leave the mere. |
| Forest Basin (elite) | **The Merewick Hart** | 16 | sight | New Stag, ×1.4, antler glow | The stag the drowned village used to count as its own. |
| Spur Road | **Crown Outrider** | 15–16 | sight, linked | New Crown Soldier (mounted look not needed; spear) | Patrols the spur so the free hold's boundary stones stay "lost". |
| Spur Road | **Spur Adder** | 15 | proximity | Reuse: Cliff Adder, ochre | Nests under the Toll-Keeper's Cairn. |
| Ring Ward | **Wharf Drowned** | 16–17 | proximity | **New: Drowned One** (bloated, weed-hung stick figure, slow) | Wharf hands lost when the canal was cut. |
| Ring Ward | **Canal Crab** | 16 | safe | Reuse: Clay Crab, ×1.5 | Crabs on the West Canal Steps. |
| Ring Ward | **Crown Wharfwarden** | 17 | sight | New Crown Soldier (lantern) | Chisels the old sevens off the wharf stones and cuts tens. |
| Ring Ward (elite) | **The Lockkeeper Drowned** | 18 | sight | New Drowned One, ×1.4 | The lockkeeper who kept the old sevens cut on the wharf, drowned with his keys. |
| Islet Fords | **Ford Drowned** | 17–18 | proximity | New Drowned One | Ferrymen from the West Cairn graves. |
| Islet Fords | **Causeway Lamprey** | 17 | proximity | **New: Lamprey** (low, segmented, bank-only) | River things that hunt the dry causeway edges. Never spawned in water. |
| Islet Fords | **Ford Crab** | 17 | safe | Reuse: Clay Crab, blue-grey | — |
| Green Reach | **Banded Grazer** | 18 | safe | New Stag (hornless doe variant) | Wild herd; the drovers' cattle went feral. |
| Green Reach | **Ringblight Wolf** | 18–19 | sight, packs | Reuse: canine, pale banded tint | Corrupted near the Ungrazed Ring: *"Grass that grows in bands isn't for eating."* |
| Green Reach | **Cord Adder** | 19 | proximity | Reuse: Cliff Adder | Guards the cord on the cap ledges. |
| Green Reach (elite) | **Old Banding** | 20 | sight | New Stag, ×1.5 | A stag that only grazes in rings. |
| Coil Pass | **Seam Drover** | 19–20 | sight, linked | **New: Drover** (hooded, crook-staff, satchel) | Bandit drovers who run cattle and contraband over the switchbacks. |
| Coil Pass | **Drover Mastiff** | 19 | sound | Reuse: canine, brindle, ×1.2 | — |
| Coil Pass (elite) | **Crook Maddoc, Drover Chief** | 20 | sight | New Drover, ×1.2, red hood | Holds the switchback toll the Kings forgot to collect. |
| The Broken Stair | **Stair Haunt** | 20–21 | proximity | Reuse: Shard Wight, ash tint | Ruin-haunts of the Toppled Gatehouse. |
| The Broken Stair | **Scarp Revenant** | 20–21 | sight | Reuse: Ruin Dweller, glassed tint | Bones from the Mirror Tarn, still standing. |
| The Broken Stair | **Penitent Whitener** | 21 | sight, linked | **New: Penitent** (grey robe, white-stained hands, brush) | The first outriders of the Cultists of the Seven, whitewashing the Stele Field. |
| The Broken Stair (named) | **Hollow**, **Ashmouth**, **Sootkin** | 22 | sight | New Penitent, ×1.2, named tints | Named Penitent elites from the bible's roll. The full cult stays in the Citadel dungeon. |

**New rigs (6):** Crown Soldier, Stag, Drowned One, Lamprey, Drover, Penitent. All are built from the existing stick-figure parts in preset.rs (humanoid, quadruped and serpent bodies), with no new body type unless the Lamprey needs one; I'll try the serpent body first.

## 3. Drop tables (real catalog materials)
Level-appropriate: Pale Hollow tier materials (tier 1) throughout, with Ashlands tier (tier 2) starting from Lv 18. Every mob also rolls the existing 65% material roll; ash dust is the zone-wide catalyst only on The Broken Stair.

| Mob | Drops |
|---|---|
| Tithe-Taker, Crown Outrider, Crown Wharfwarden | linen scrap, metal scrap, dried ration scrap; **parchment** (Wharfwarden only) |
| Toll Hound, Mere Wolf, Drover Mastiff | soft pelt, desiccated hide, horn |
| Ringblight Wolf | soft pelt, horn, **giant femur** |
| Blightback Boar | horn, desiccated hide, pale dust |
| Rootsick Stag, Banded Grazer | soft pelt, horn, bark strip |
| The Merewick Hart, Old Banding | horn ×2 (fixed), soft pelt, **giant femur** |
| Spur Adder, Cord Adder | poison sac, desiccated hide |
| Wharf Drowned, Ford Drowned | bone chip, slime oil, linen scrap |
| The Lockkeeper Drowned | bone chip, **parchment** ×2 (fixed) |
| Canal Crab, Ford Crab | clay crab, river sand |
| Causeway Lamprey | slime oil, poison sac, **stone scale** |
| Seam Drover, Crook Maddoc | linen scrap, dried ration scrap, **shade cotton**, copper ore |
| Stair Haunt | bone chip, **skull plate** (rare 10%), ash dust |
| Scarp Revenant | cracked brick, metal scrap, **giant femur** |
| Penitent Whitener, Hollow, Ashmouth, Sootkin | linen scrap, **parchment**, **ink salt**, ash dust |

## 4. Quests
Gold follows Pale Hollow's scaling (25 gold at Lv 1 up to 220 at Lv 16), extended at about +25 per level: 240 at Lv 13 to 420 at Lv 21. Fragment beats pay ×1.5.
Each field's **fragment beat** (from the 13-fragment trail) uses its POI as the quest structure. Craft quests go to Brann Coldiron, supply quests to Maudry Saltpenny, fragment and lore quests to Orrin Haltmark or Ilse Morrowglass. Until Mayflower lands, a field figure gives each quest and points back to the Mayflower giver.

| Field | Quest | Giver | Objective | Gold | Structure / lore |
|---|---|---|---|---|---|
| Hollow Road | **The Seventh Post** (fragment 5) | Orrin Haltmark, via **Wick Tallow, Roadside Hermit** | Drive off 5 Tithe-Takers at the Seven Posts | 360 | The Seven Posts; the seventh stone is broken on purpose. |
| Hollow Road | **One in Seven** | Maudry Saltpenny, via Wick | Kill 4 Toll Hounds harrying carts | 240 | **Tithe Booth** (Crown camp). |
| Forest Basin | **The Drowned Spoke** (fragment 6) | Ilse Morrowglass, via **Sister Ondine of the Graves** | Lay down 3 Rootsick Stags and the Merewick Hart | 390 | Drowned Spoke; Merewick is still on the tithe map. |
| Forest Basin | **Hides for the Halls** | Brann Coldiron, via **Gerd Halloway, Basin Trapper** | Kill 6 Mere Wolves | 260 | **Trapper's Lean-to**. |
| Spur Road | **Bounded in Sevens** (fragment 7) | Orrin, via **Old Hesk, Last Freeholder** | Kill 5 Crown Outriders | 405 | Seven-Stone Bench. |
| Spur Road | **Under the Cairn** | Maudry, via Hesk | Kill 4 Spur Adders | 280 | Toll-Keeper's Cairn; old tolls were paid in labour. |
| Ring Ward | **Older Than the Walls** (fragment 8) | Ilse, via **Marrow Quaylan, Wharf Lampman** | Lay down 4 Wharf Drowned and the Lockkeeper Drowned | 435 | Older Paving. |
| Ring Ward | **Seven Courses** | Brann, via Marrow | Kill 3 Crown Wharfwardens | 300 | **Wharfwarden's Post** (Crown camp). |
| Islet Fords | **The Ring Held** (fragment 9) | Orrin, via **Ferryman Tobin Reed** | Lay down 5 Ford Drowned | 450 | Islet Ring; the river moved and the ring held. |
| Islet Fords | **Eels on the Causeway** | Maudry, via Tobin | Kill 5 Causeway Lampreys | 320 | **Ferry Stage** by the Broken Causeway. The ferry runs only in the May snowmelt flood; the rest of the year Tobin keeps the safe stones of the wadeable fords. |
| Green Reach | **The View of Seven** (fragment 10) | Ilse, via **Drover-Widow Annet** | Kill 4 Ringblight Wolves and Old Banding, then climb to White Caps Summit | 465 | White Caps Summit, by the White Caps Stair. |
| Green Reach | **Strays of the Reach** | Brann, via Annet | Kill 6 Banded Grazers | 340 | **Herders' Fold**. |
| Coil Pass | **Crown Stones** (fragment 11) | Orrin, via **Brother Lantern, Pass Pilgrim** | Kill 5 Seam Drovers and Crook Maddoc | 480 | Crown Stones. |
| Coil Pass | **Contraband Hides** | Maudry, via Brother Lantern | Kill 4 Drover Mastiffs | 360 | **Drover Camp** (bandit camp). |
| The Broken Stair | **The Scriveners' Oath** (fragment 12) | Ilse, via **Ashen Wenlo, Stair Hermit** | Lay down 5 Stair Haunts | 495 | Scarp Cave Shrine, by the cave climb. |
| The Broken Stair | **Seven Hands** (fragment 13) | Orrin, via Wenlo | Defeat Hollow, Ashmouth and Sootkin | 630 | Scarp Head Ring; the trail points on to the Citadel. |
| The Broken Stair | **Whitewash** | Brann, via Wenlo | Kill 6 Penitent Whiteners | 400 | **Penitents' Whitewash Camp** at the Stele Field edge. |

Fragment quests `require` the previous fragment quest, matching the trail order.

## 5. Structures and placement
- **Quest structures** are the existing POIs. I add no prop on top of a POI.
- **New camps** (one or two per field) use the existing camp/yard prop kit (tent, fire, crates) and sit at least 10 m from any POI:
  - Tithe Booth (Hollow Road, in a scrub bay off the road, south of the Mid Camp)
  - Trapper's Lean-to (Forest Basin, a glade west of the Valley Cross Graves)
  - Spur Watch Fire (Spur Road, a side bay north of the spawn)
  - Wharfwarden's Post (Ring Ward, the far wharf shelf)
  - Ferry Stage (Islet Fords, beside the Broken Causeway; a spring-flood ferry, used only when the May snowmelt drowns the fords)
  - Herders' Fold (Green Reach, the side valley south of the spawn)
  - Drover Camp (Coil Pass, a ledge off the switchback)
  - Penitents' Whitewash Camp (The Broken Stair, the ruin shelf beside the Stele Field)
- **Field givers** stand at their camp, 2–3 m from the fire.
- **Placement rules** (enforced in code and tests, not by hand):
  - Walkable, BFS-reachable from the field spawn, never in water or on a bridge.
  - At least 6 m from trail centrelines, 8 m from gates, 12 m from the warp circle, 10 m from POIs (camps) or 4 m (mobs), and outside an 8 m disc at each ascent mouth and summit lookout (White Caps Stair, East Cap Ledge, Hollow Stair Cave, Scarp Cave, West Ridge Cave, Corner Stair, Westwatch Climb).
  - Pale Hollow is untouched, including its eastern spur (Mayflower).
  - Mobs sit on a deterministic grid inside per-family boxes (the same `stamp` and `take` approach as Pale Hollow), so moving a camp means editing one box.
- **Validation:** check-anchors.ts runs over the new anchors (outputs go to /workspace/ba-anchor-audit only), plus a new repo test like world-pois.test.ts covering every spawn, NPC and camp.

## 6. Implementation plan (after approval)
1. New `packages/config/src/seam-country-field.ts`: per-field mob, NPC, quest and camp data in Pale Hollow's shapes, keyed by zone id.
2. Add the new archetypes to the mob archetype type, and the 6 rigs to preset.rs.
3. **Server (needs approval):** run the Pale Hollow mob and quest loop for each field zone too.
4. Tests, local CI (typecheck, tests, rust, build-wasm), and screenshots, on the local server and anvil 31337 only.

## 7. Open questions
1. Approve the level ramp 13–21? (No band exists in code.)
2. Approve the server change to run mobs and quests in the fields?
3. Should fragment quests get a real "read at POI" objective (a second server change), or stay as kill quests?
4. Should Mayflower givers hand out these quests directly once Mayflower lands, replacing the field figures?
5. Map and World Builder: are the camp spots right, and which named Penitents should appear (I picked Hollow, Ashmouth, Sootkin)?

## 8. New names for Grok Bot (lore-bible.md)
- **Mobs:** Tithe-Taker, Toll Hound, Mere Wolf, Blightback Boar, Rootsick Stag, the Merewick Hart, Crown Outrider, Spur Adder, Wharf Drowned, Canal Crab, Crown Wharfwarden, the Lockkeeper Drowned, Ford Drowned, Causeway Lamprey, Ford Crab, Banded Grazer, Ringblight Wolf, Cord Adder, Old Banding, Seam Drover, Drover Mastiff, Crook Maddoc (Drover Chief), Stair Haunt, Scarp Revenant. Penitent Whitener, Hollow, Ashmouth and Sootkin are already in the bible.
- **Field figures:** Wick Tallow (Roadside Hermit), Sister Ondine of the Graves, Gerd Halloway (Basin Trapper), Old Hesk (Last Freeholder), Marrow Quaylan (Wharf Lampman), Ferryman Tobin Reed, Drover-Widow Annet, Brother Lantern (Pass Pilgrim), Ashen Wenlo (Stair Hermit).
- **Quests:** The Seventh Post, One in Seven, The Drowned Spoke, Hides for the Halls, Bounded in Sevens, Under the Cairn, Older Than the Walls, Seven Courses, The Ring Held, Eels on the Causeway, The View of Seven, Strays of the Reach, Crown Stones, Contraband Hides, The Scriveners' Oath, Seven Hands, Whitewash.
- **Structures:** Tithe Booth, Trapper's Lean-to, Spur Watch Fire, Wharfwarden's Post, Ferry Stage, Herders' Fold, Drover Camp, Penitents' Whitewash Camp.

## Appendix (internal ids only, not player-facing)
New id prefixes follow the zone prefixes already used in world-pois.ts: hr-, fb-, sr-, rw-, if-, gr-, cp-, cr-. New archetypes: crown_soldier, stag, drowned_one, lamprey, seam_drover, penitent.

## Build notes (as implemented on populate-seam-country)

- **Friendly camps (a giver stands there):** Wick's Lean-to (HR), Trapper's Lean-to and Grave-Lamp (FB), Freeholder's Hearth (SR), Lampman's Stoop (RW), Ferry Stage (IF), Herders' Fold (GR), Pilgrim Shelter (CP), Wenlo's Cell (CR).
- **Hostile camps (mob dens):** Tithe Booth (HR), Spur Watch Fire (SR), Wharfwarden's Post (RW), Drover Camp (CP), Penitents' Whitewash Camp (CR).
- **Ring Ward:** the wharf shelf is not walkable, so the drowned dens sit in the inner ring lanes; quest text says the drowned "climbed into the inner lanes" and the warden post is "in the south-west lanes".
- **Reused rigs** (Toll Hound, Mere Wolf, Drover Mastiff, Ringblight Wolf use hollow_scavenger; boars, adders, crabs, haunts, revenants likewise) render as the existing model with no tint or scale variant.
- **Clearances (metres, mob / camp / NPC):** trail 6/6/3.5 (mob trail clearance 3.5 in Ring Ward, 4.5 in Coil Pass), gate 8, warp circle 12, POI 4/10/6, ascent ends 8, ascent path 3, spawn and arrivals 14/8/6; mobs keep 14 m from friendly camps, 4 m from hostile camps, 6.5 m from each other.
- **Reading a landmark** is done on site (within 4.5 m); the stone tells its story and the step is remembered for any active quest that names it.
- **No-crypto rule:** no ledgers, tallies-as-records, chains or networks in any quest, mob, NPC or camp string. History is erased by edict, fire and chisel; it is remembered by the land, songs and people.
