# Seam rest critique

Iso frames, 640×360, from `scene_shot`. A fighter stands idle at each coordinate and the camera follows that stand. The `.baz` and `.bap` copies used for these frames are in `docs/worldgen/shots/`. Every zone below had a `.baz`. Forest Basin and Pale Hollow were not rendered.

One screen is about 20 m across. A crest, shore, or ring that sits farther out than that is absent from the picture even when the zone contains it.

## Signed off

- **Mid Camp** (hollow_road, 0, 80) — `hollow_road-mid-camp.png`. A dirt pad, a paved trail through the middle, two tents, and a fire. The ground in view sits at about 2.2 m. It reads as a camp.
- **South lip** (hollow_road, 0, 22) — `hollow_road-south-lip.png`. The paved trail runs to the top of the frame, with scrub and grass on the shoulders. It reads as the south road.
- **South lip** (spur_road, 0, 18) — `spur_road-south-lip.png`. The same kind of paved trail, with grass filling the upper part of the frame. It reads as the south road.
- **North lip** (spur_road, 0, 182) — `spur_road-north-lip.png`. The paved trail continues off the bottom of the frame between gray shoulders, with one small bush. It reads as the upper road.
- **Spawn** (ring_ward, 0, 68) — `ring_ward-spawn.png`. A paved crossing, grass beside it, and gray wall blocks in the foreground across the road. It reads as the north entrance.
- **West Canal** (ring_ward, -62, 20) — `ring_ward-west-canal.png`. A deck with green edges crosses the frame, and blue water lies on both sides of it. It reads as the canal crossing.
- **South lip** (coil_pass, 0, 22) — `coil_pass-south.png`. A grass bank fills the left of the frame, the paved trail runs down the right, the figure stands on the meadow between them, and a fire sits at the lower left. It reads as the low end of the road.

## Fixes

- **Mid Rise** (spur_road, 0, 100) — `spur_road-mid-rise.png`, checked again after the shelf bake as `spur_road-mid-rise-rebake.png`. The frame is still a dirt pad, a cobbled trail, tents, and a fire. The banks start at `|x| = 8`, which is the edge of this iso view from the camp stand, so the 3.2 m shelf has no visible step. Mid Rise does not read as a shelf from (0, 100).
- **Inner Keep** (ring_ward, 0, 0) — `ring_ward-inner-keep.png`. Packed dirt fills the frame, with a stone cross through the middle and a few small props at the edges. The pad is flat at 4.2 m. The drop to the surrounding street (about 2 m, near 15 m out) is outside the picture. Inner Keep does not read as a keep.
- **South Wharf** (ring_ward, 70, -70) — `ring_ward-south-wharf.png`. Zigzag blue water fills the frame and the figure stands in it. The only land is a dark wedge in the upper left. South Wharf does not read as a wharf.
- **West Islet** (islet_fords, stand 24, 0) — `islet_fords-west.png`. Grass, a paved trail, one pine, and a small rock. The ground in view is flat at 1.6 m and contains no water. The bank toward the channel begins near x=34, off the right of the frame. West Islet does not read as an islet.
- **Mid Islet** (islet_fords, 100, 4) — `islet_fords-mid.png`. Grass, a paved trail, a tree, and a stall. No shore and no water in the frame. Mid Islet does not read as an islet.
- **East Islet** (islet_fords, 176, -2) — `islet_fords-east.png`. Grass, a paved trail, and a tree. No shore and no water in the frame. East Islet does not read as an islet.
- **Long Claw** (green_reach, -70, 8) — `green_reach-long-claw.png`. Open meadow, a short paved trail under the figure, and pines. The line from x=-90 to x=-50 stays meadow and road, between about 1.5 m and 2.1 m. Long Claw does not read as a claw.
- **Still Pool** (green_reach, 25, 25) — `green_reach-still-pool.png`. Zigzag water fills the frame and the figure stands in it. A gray peak cuts across the lower left, and no rim is in view. The east-west line from x=15 to x=35 at z=25 is all river at 1.2 m. Still Pool does not read as a contained pool.
- **White Caps** (green_reach, 40, 45) — `green_reach-white-caps.png`. A gray peak fills the center and the figure stands inside it. Grass and paving show at the sides, and a strip of the pool shows along the top. The frame has no white. White Caps does not read as white caps.
- **Switchback** (coil_pass, 0, 90) — `coil_pass-switchback.png`. A straight paved strip runs up the left side. The figure stands in grass. The right side rises from 5 m to about 8 m into a bank. This stand is the middle of the leg from (-10, 80) to (10, 120). Switchback does not read as a bend.
- **South Tongue** (coil_ridge, 0, -120) — `coil_ridge-south-tongue.png`. A paved trail through grass, with a lean-to at the bottom edge. Both shoulders are the same grass, and the ground in view only spans about 0.4 m. South Tongue does not read as a peninsula.
- **Crown** (coil_ridge, 0, 10) — `coil_ridge-crown.png`. The figure stands in a flat pond at 8.2 m. A meadow bank rises on the right to about 9.9 m. Water runs from at least x=-16 to the stand. Crown does not read as a height.
- **Spiral Water** (coil_ridge, 40, 10) — `coil_ridge-spiral-water.png`. Grass on the left, a paved trail through the middle, trees at the sides. The line from x=24 to x=56 at z=10 is dry meadow, road, and scrub around 9.8 m. Spiral Water does not read as water.
