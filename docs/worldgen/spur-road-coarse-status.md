# Spur Road coarse land

Tile `spur_road`. Owner: land molder. Lock: `docs/worldgen/locks/spur-road-coarse.lock`.

Bounds stay x -18..18, z 0..200. Spawn stays (0, 100). Both gate rects and destinations are unchanged (`south-lip` → forest_basin, `north-lip` → ring_ward). No water, no bridge, no new props. Not baked. Not committed.

## What changed

The centerline is still one smooth hump: 1.4 m at the south lip, 3.2 m at z=100, 1.6 m at the north lip. The south lip (x -6..6, z 0..10) is that grade, flat across the gate, so the meeting with Forest Basin is unmoved. Arrival on the lip at (0, 18) is 1.554 m.

Camp shelf: the disc r=8 at (0, 100) is level at 3.2 m, so the camp props share one height. It eases back to the hump over 4 m. Along the road that lift is only a few centimetres, because the hump is already flat at the crest.

Banks: outside the 16 m road (`|x| > 8`). The first 4 m rises by up to 1.0 m (two 0.5 m strokes). At the crest the cap leaves 0.7 m of room, and that whole 0.7 m is spent inside the first 4 m (3.2 m on the shelf, 3.9 m at `|x| = 12`). Farther out, later strokes are 0.5 m per 4 m until the cap. A change under about 0.5 m would not show at 44 px per metre; these banks clear that.

## Height

Sampled on the 0.5 m grid over the bounds.

| | metres | where |
|---|---|---|
| min | 1.4 | south lip, first at (-8, 0) |
| max | 3.9 | cap, first at (-18, 44.5) |

Relief stays under 4 m.

## Test

`pnpm --filter @bellgrave/stick-web exec tsx --test src/spur-road.test.ts`

7 pass, 0 fail. Walkable fraction 0.571. Spawn dry, both gates reachable, bake length unchanged.
