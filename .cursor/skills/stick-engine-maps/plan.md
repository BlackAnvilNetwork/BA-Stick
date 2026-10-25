# Zone chain

For session `9949e9b6-e0cc-461b-bf58-bc721c310dec`: do not add another exit from Pale Hollow. Its zone line is already `pale-to-hollow` in `packages/config/src/zone-links.ts` (gate `ash-road` to `hollow_road` at (0, 22)). `hollow_road` is the ground between Pale Hollow and Forest Basin. Leave the later gate rects alone.

Skill: `.cursor/skills/stick-engine-maps/SKILL.md`.

Pale Hollow (`packages/config/src/pale-hollow.ts` and its bake, landmarks, and server world) is being edited in session `9949e9b6-e0cc-461b-bf58-bc721c310dec`. Do not change those files. Forest Basin already exists and is the branching field. This plan adds the areas after it, with a travel zone between each pair.

North is +z. Each zone has its own origin. A gate rect is the trigger. The arrival spawn sits about 12 m inside the destination, outside that zone's return gate, so the player does not bounce.

No name from the reference images is used. The labeled multi-land chart is not a source: its captions are off limits, and it only shows that a world is many shores joined by travel.

## Order

```
pale_hollow --hollow_road--> forest_basin --spur_road--> ring_ward --islet_fords--> green_reach --coil_pass--> coil_ridge
```

| Zone | Role | Reference (structure only) |
|------|------|----------------------------|
| pale_hollow | The first field. Its north lip is the Ash Road. | Already built. |
| hollow_road | Travel. A scrub road from that lip to the basin's south finger. | The north road of the hollow, continued. |
| forest_basin | Branching woodland, northern mere, eastern spur camp. Already built. | Hand-drawn irregular woodland with a pond and a side camp. |
| spur_road | Travel. A scrub road. | The camp spur, extended into its own ground. |
| ring_ward | Concentric walled wards, west canal, south wharf. | Circular walled settlement, river on the west, water on the southeast. |
| islet_fords | Travel. Three islets and two fords. | Two shelves of islands cut by channels. |
| green_reach | One island, western claw, inland pools, three caps. | Green island with a western tail, inland water, and white caps. |
| coil_pass | Travel. A climbing switchback. | The south tongue of the spiral highland. |
| coil_ridge | Concentric ridges and a spiral channel. | Concentric highland, spiral water, southern peninsula. |

Parent `areaId` stays `pale_hollow` until a campaign chapter is designed. These are not new entries in `world.ts`.

## Links

Canonical table: `packages/config/src/zone-links.ts`.

| Id | From gate | To spawn |
|----|-----------|----------|
| pale-to-hollow | pale_hollow `ash-road` (-14..14, 468..500). The north lip. Open. | hollow_road (0, 22), facing 0 |
| hollow-to-pale | hollow_road `south-lip` (-6..6, 0..10) | pale_hollow (0, 456), facing Math.PI |
| hollow-to-basin | hollow_road `north-lip` (-6..6, 150..160) | forest_basin (8, -126), facing 0 |
| basin-to-hollow | forest_basin `south-lip` (2..14, -150..-138) | hollow_road (0, 138), facing Math.PI |
| basin-to-spur | forest_basin `southeast-gap` (124..136, -120..-108). Live rect; do not move it. | spur_road (0, 18), facing 0 |
| spur-to-basin | spur_road `south-lip` (-6..6, 0..10) | forest_basin (124, -96), facing Math.PI |
| spur-to-ring | spur_road `north-lip` (-6..6, 190..200) | ring_ward (0, 68), facing 0 |
| ring-to-spur | ring_ward `north-gap` (-8..8, 78..90) | spur_road (0, 182), facing Math.PI |
| ring-to-fords | ring_ward `wharf-gap` (52..64, -78..-66) | islet_fords (24, 0), facing 0 |
| fords-to-ring | islet_fords `west-lip` (2..14, -6..6) | ring_ward (48, -58), facing Math.PI |
| fords-to-reach | islet_fords `east-lip` (180..192, -8..4) | green_reach (-70, 8), facing 0 |
| reach-to-fords | green_reach `claw-lip` (-90..-78, 2..14) | islet_fords (166, -2), facing Math.PI |
| reach-to-pass | green_reach `north-lip` (-16..-4, 78..90) | coil_pass (0, 22), facing 0 |
| pass-to-reach | coil_pass `south-lip` (-8..8, 0..12) | green_reach (-10, 68), facing Math.PI |
| pass-to-ridge | coil_pass `north-lip` (-8..8, 168..180) | coil_ridge (0, -120), facing 0 |
| ridge-to-pass | coil_ridge `tongue-lip` (-8..8, -146..-134) | coil_pass (0, 156), facing Math.PI |

Facing 0 travels toward +z. Facing `Math.PI` travels toward -z. Soft level is 8 on travel lips and 6 on ring_ward. No gate is blocked.

## spur_road

1. Bounds: x -18..18, z 0..200. 7,200 m², 32 screens. Grid 73×401 = 29,273 cells. Bake 117,116 B.
2. Walkable: `|x| <= 8`, plus a disc r=14 at (0, 100). Outside is blocked mountain. About 45%.
3. Relief: road 1.4 m, mid rise smooth to 3.2 m at z=100, back to 1.6 m at the north lip. Max under 4 m.
4. Widths: road 16 m, mid pad 28 m, trail 3.3 m down the centre.
5. Exits: `south-lip`, `north-lip`. Spawn (0, 100).
6. Landmarks: Mid Rise (0, 100) camp.

## ring_ward

1. Bounds: x -100..100, z -100..100. 40,000 m², 178 screens. Grid 401×401 = 160,801 cells. Bake 643,228 B.
2. Walkable: disc r=86. Building annuli blocked except four 8 m radial gaps on the axes, the north gap, and the wharf gap. West canal is open water except the bridge. Target about 50% of the box.
3. Relief: streets 2.2 m, keep pad 4.2 m inside r=14, canal surface 0.6 with a 1.35 m carve, wharf surface 0.35. Max 6 m.
4. Widths: radial streets 8 m, ring streets 8 m, canal 12 m (centre x=-62, z=-40..70), bridge deck 3.9 m at z=20 spanning the canal, wharf water disc (70, -70) r=18.
5. Exits: `north-gap`, `wharf-gap`. Spawn (0, 68), which is the spur arrival.
6. Landmarks: Inner Keep (0, 0) landmark, Outer Ring (0, 74) area, West Canal (-62, 20) water, South Wharf (70, -70) water.

Building rings (blocked, biome `terrace`, not mountain): 18..28 and 40..58 and 72..82, with gaps where `min(|x|,|z|)` is not the smaller axis by more than 4 m (the four axis streets), plus the two gate rects always open. Keep r<14 is `hub_indoor` and walkable. Streets are `ash_road` or `terrace`. Parks in the outer street are `meadow`.

## islet_fords

1. Bounds: x -20..200, z -36..36. 15,840 m², 70 screens. Grid 441×145 = 63,945 cells. Bake 255,804 B.
2. Walkable: three discs and two ford capsules. Channel `|z| < 28` outside that mask is open water. `|z| >= 28` is blocked mountain. About 25% walkable.
3. Relief: islet pads 1.6 m, ford crests 0.9 m, water surface 0.3, bed 0.3-1.35. Max under 3 m.
4. Widths: islets r=16, 18, 16. Fords 7 m (half-width 3.5). Channel is wide enough for deep water off the fords.
5. Exits: `west-lip` on the west islet, `east-lip` on the east islet. Spawn (24, 0).
6. Landmarks: West Islet (16, 0) area, Mid Islet (100, 4) area, East Islet (176, -2) area.

Discs: (16, 0) r=16, (100, 4) r=18, (176, -2) r=16. Ford capsules between those centres.

## green_reach

1. Bounds: x -100..120, z -90..110. 44,000 m², 196 screens. Grid 441×401 = 176,841 cells. Bake 707,388 B.
2. Walkable: union of discs below, minus two pools and three peak cores (0.38×r). Outside is blocked mountain. About 40%.
3. Relief: shore 1.3 m, inland 2.4 m, pool surface 1.2 with a 1.35 m carve, caps 7.2–8.5 m. Hard cap 11 m.
4. Widths: claw necks are the overlaps of the discs (keep overlaps over 12 m). Pools r=10 and r=6. Trail 3.3 m from the claw to the north lip.
5. Exits: `claw-lip`, `north-lip`. Spawn (-70, 8).
6. Landmarks: Long Claw (-70, 8) area, Still Pool (25, 25) water, White Caps (40, 45) landmark, South Point (20, -60) area.

Discs: (30, 10) r=72, (-10, 60) r=36, (-55, 20) r=22, (-78, 8) r=14, (-40, -10) r=18, (20, -60) r=28, (80, 20) r=32. Pools: (25, 25) r=10, (55, -15) r=6. Peaks: (40, 45) r=16 h=8.5, (70, 30) r=12 h=7.2, (-20, 70) r=14 h=7.8.

## coil_pass

1. Bounds: x -22..22, z 0..180. 7,920 m², 35 screens. Grid 89×361 = 32,129 cells. Bake 128,540 B.
2. Walkable: capsule half-width 6 m along the switchback. Outside is blocked mountain. About 30%.
3. Relief: y = 2 + 6×(z/180) on the road, cut banks up to 3 m beside it. South 2 m, north 8 m. Max under 10 m.
4. Widths: road 12 m. Polyline (0, 8), (10, 40), (-10, 80), (10, 120), (0, 168).
5. Exits: `south-lip`, `north-lip`. Spawn (0, 22).
6. Landmarks: Switchback (0, 90) landmark.

## coil_ridge

1. Bounds: x -120..120, z -150..110. 62,400 m², 277 screens. Grid 481×521 = 250,601 cells. Bake 1,002,428 B.
2. Walkable: disc (0, 10) r=100, plus a south tongue capsule (0, -40) to (0, -130) half-width 14 and a tip disc (0, -130) r=18. Spiral channel is open water. Peak cores blocked. Outside is blocked mountain. About 45%.
3. Relief: floor 2 m, ridge rings up to 9 m, centre cap 10.5 m, tongue 2.4 m, water surface 1.0, carve 1.35 m. Hard cap 11.5 m.
4. Widths: tongue 28 m, spiral channel about 7–12 m (angular half-width 0.15 rad, radius 24..88 around (0, 10)). Trail 3.3 m up the tongue.
5. Exits: `tongue-lip`. Spawn (0, -120).
6. Landmarks: South Tongue (0, -120) area, Spiral Water (40, 10) water, Crown (0, 10) landmark.

Spiral water only for radius 24..88 and z > -50, so the tongue stays dry. Ridge height is a radial cosine, not a copied contour.

## Files each zone owns

Do not edit `pale-hollow.ts`, `pale-hollow-landmarks.ts`, `pale-hollow-world.ts`, `apps/server/src/index.ts`, `world.ts`, or `bake-props.ts`.

| Zone | Config | Props | Tests |
|------|--------|-------|-------|
| spur_road | `packages/config/src/spur-road.ts` | `apps/stick-web/scripts/zone-props/spur-road.ts` | `apps/stick-web/src/spur-road.test.ts`, `apps/server/src/spur-road-world.ts` (+ test) |
| ring_ward | `packages/config/src/ring-ward.ts` | `apps/stick-web/scripts/zone-props/ring-ward.ts` | same pattern |
| islet_fords | `packages/config/src/islet-fords.ts` | `apps/stick-web/scripts/zone-props/islet-fords.ts` | same pattern |
| green_reach | `packages/config/src/green-reach.ts` | `apps/stick-web/scripts/zone-props/green-reach.ts` | same pattern |
| coil_pass | `packages/config/src/coil-pass.ts` | `apps/stick-web/scripts/zone-props/coil-pass.ts` | same pattern |
| coil_ridge | `packages/config/src/coil-ridge.ts` | `apps/stick-web/scripts/zone-props/coil-ridge.ts` | same pattern |

Shared registration (`ZONE_IDS`, bake dispatch, minimap, `zones.ts`) is a follow-up, not part of the zone modules.

## Props

Import `{ K, hash2, type Prop }` from `../bake-props`. Do not import the zone prop modules from `bake-props.ts`.

Scatter is deterministic. Skip water, bridges, blocked ground, and building pads. City walls use `wall_block` on the outer ring, spaced about 4 m, with gaps at the gates. Canal edges use `river_wall`. One `bridge` at the canal crossing. Peaks use kind 46. Tree grids no tighter than 6 m. Keep each zone under 4,000 props.

## Tests

Follow `apps/stick-web/src/forest-basin.test.ts`: spawn walkable and dry, relief inside the sheet, flood fill from spawn to every open gate at step 2 m (step 4 m on ring_ward, green_reach, and coil_ridge). Import the config module by relative path. Call `bakeZoneGrid` from `../scripts/bake-zones` and assert `buffer.length === 24 + 4 * w * h`.

## Demo

`?demo&zone=<id>&x=<spawn x>&z=<spawn z>` and the same with `&view=3d`.
