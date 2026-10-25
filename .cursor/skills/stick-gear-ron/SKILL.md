---
name: stick-gear-ron
description: >-
  Build, check, and ship BA-Stick worn gear and weapons as Stick Engine .ron:
  invisible structure, bone-attached solids, and pixel sheets. Use when adding
  or changing armor, cloth, leather, bone, helms, shields, weapons, or any
  gear/*.ron or *.plate.ron, or when the gear viewer, garb(), or
  ba-stick-render figure draw is involved. One accepted look per material
  family. Do not put game gear in stick-engine BUILTIN_GEAR. Do not start the
  next item until the current one is accepted.
---

# RON 3D Gear Pipeline: Agent Guide

Oct 22, 2026 · @guy

## Overview

Today's BA-Stick armor pieces are 1 to 4 KB of RON per file, and larger when a piece has more parts and detail. That text is a complete 3D object: it has volume, depth-correct occlusion, rig binding and animation. This guide tells an agent how to build, check and ship one.

Three ingredients, all declared in RON, make the 3D:

- Invisible structure. Lines, discs and rings that are never drawn. They place everything else and carry the physics-like behavior (follow a bone, take walk sway).
- Solids. Line, Capsule and Disc shapes attached to a bone, filled and shaded as volumes.
- Pixel sheets. A mesh made of strips between consecutive invisible rings, painted from a character grid in a `*.plate.ron`.

Size of today's shipped pieces, measured in the repo:

| Piece | Gear .ron | Plate .ron |
|---|---|---|
| ba_iron_helm | 0.5 KB | 0.8 KB |
| ba_cloth_hat | 0.4 KB | 0.7 KB |
| ba_leather_vest | 0.9 KB | 1.0 KB |
| ba_bone_harness | 1.8 KB | 1.0 KB |
| ba_iron_cuirass | 2.4 KB | 1.2 KB |
| ba_wizard_robe | 3.1 KB | 1.2 KB |
| Engine weapons (sword, greatsword, shield) | 0.5 to 0.8 KB | none |

Scope: worn gear and weapons for the isometric Rust raster (`engine/ba-stick-render`, with weapon primitives from stick-engine). Audience: agents and humans adding or changing gear. Content lives in `engine/ba-stick-render/assets/gear/`.

## Mental model

A gear piece is three layers in one frame: invisible structure places everything, solids fill volume, and pixel sheets build surfaces between invisible rings.

The rig and the two .ron files feed the structure. The structure produces solids and sheets, and both draw into one depth-tested framebuffer.

- Structure is never drawn. A disk's interior is never filled. Only the strips between consecutive rings become surface, so an opening is a region the strips do not cover. A screen-space disc cannot have a hole; this can.
- Solids are volumes on a bone. Capsule and Line stroke between two points. Disc is a filled circle at a projected point, a billboard rather than a disk lying in a 3D plane.
- Sheets are meshes, always attached to structure. Rings are bound to the skeleton or the attach frame, never free-floating, strips run between them, and each strip pixel looks up a letter in the plate grid by (u, v).
- One result. Pixels carry depth, so layers occlude each other correctly, and one silhouette is drawn around the whole asset.

## Frames, units and depth

Every gear .ron is written in one coordinate system, the attach frame, in joint-local metres.

- Origin and axes. The origin is the attach joint. +y is the normalized chest-minus-pelvis direction (for hands, the weapon direction). +x is y × up, the character's right. +z is x × y, forward. When the spine is vertical, x falls back to a fixed right vector. Do not "fix" this.
- Default attach by slot. MainHand `r_hand`, OffHand `l_hand`, Head `head`, Legs and Feet `pelvis`, every other slot `chest`. Set `attach` to override.
- Units. Positions and Disc.r are metres. A disc is drawn at r × HEIGHT_PX pixels. `thick` on Line and Capsule is a pixel radius, not metres.
- Scale. HEIGHT_PX is 44 in `stick_engine::camera`. Head radius is about 0.13 m. See the open questions for the on-screen figure height.
- Depth. In iso, d = -(x+z). The engine's plot keeps the smaller d, the nearer pixel; the viewer paints higher d last. Front ortho uses x = lx, y = -ly, d = lz. Side uses x = lz, y = -ly, d = lx. Do not "fix" iso d.
- Facing. At yaw 0.6 rad, frame.z points away from the iso eye. The sheet called "front" bulges along +frame.z.
- Weapons. The hand frame has +y along the blade. The example sword's grip spans y -0.10 to 0.06 and its blade runs 0.06 to 0.9.

## File schemas

A piece is one gear .ron, plus a `*.plate.ron` when it uses a pixel sheet. Unknown fields are ignored. An unknown ramp, bone or joint name fails the load.

### Gear .ron

| Field | Type | Meaning |
|---|---|---|
| id | string | Unique id, also the plate's id |
| slot | enum | Head, Shoulders, Chest, Hands, Legs, Feet, Back, MainHand, OffHand |
| attach | optional joint | Joint the frame hangs on, default by slot |
| material | optional ramp name | Real ramp only: steel, dust, leather, bone. "cloth" fails |
| thickness_mul | map bone to number | Scales the body's own limb thickness under the gear (spine, shoulders, l_upper_arm, ...) |
| stance | optional string | Weapons: 1h, 2h, staff; off hand: shield |
| reach | number, metres | Weapons: length of the striking part |
| swing_weight | number, default 1 | Weapons: multiplies action clip duration, so heavier is slower |
| shapes | list | Line, Capsule or Disc |

Shapes:

- Line(from, to, ramp, thick) and Capsule(from, to, ramp, thick). Points are attach-frame metres, thick is a pixel radius (default 1).
- Disc(at: Some("joint"), center, r, ramp). Either at a joint or center in the frame. r in metres.
- ramp is a ColorSlot: Material takes the item's material ramp, Trim is gold, Accent is red. The full list is Body, BodyFar, Outline, Accent, Material, Trim, Glow, Hair.

### Plate .ron

| Field | Meaning |
|---|---|
| x0, y0, x1, y1, z | Front quad in the chest frame, metres. z is the offset out of the chest |
| flow | Greater than 0: a long cloth sheet whose hem follows a foot. The rigid shapes are then not drawn |
| wrap | Skeleton v where a short mesh ends (0.32 for vest and harness). With wrap and flow both 0 the plate is a flat stamp, as on the cuirass |
| sleeve_drop | Cloth: how far bell sleeves hang below the hands |
| arm_from/arm_to/arm_thick, cuff_from/cuff_to/cuff_thick | Upper-arm guard and cuff, as fractions of the shoulder-to-elbow bone. Thickness in pixels |
| rows | The paint grid. Equal-width strings, top row first. The parser asserts equal widths |

### Plate letters

A cell is one letter. Use only these. No new palette slots, and never the sky index (141), the tint range (148 to 255), emissive indices as cloth, or #f4f7ff as a highlight.

| Letter | Meaning |
|---|---|
| . | Empty. Cuirass stamps only, where the steel underneath shows. A mesh plate must have none |
| g, r | Gold, red accent |
| k | Shadow, seam or black |
| e, i | Steel grey, dark steel |
| l, d | Leather, far leather |
| h, s | Bone hide, far hide |
| b, m, c | Blue, lighter blue, dark blue (robe) |

## Agent workflow

Build one piece at a time, and do not start the next until the owner accepts the current one. There is no size cap. Today's files run 1 to 4 KB, and a piece with more parts and detail will be larger.

1. Classify. Pick the slot and material family (metal body, cloth body, leather body, bone body, metal head, cloth head, weapon, shield). Each family has one accepted look. If the family exists, edit its piece; do not invent a variant.
2. Set the frame. Choose attach, material (a real ramp) and thickness_mul so the body thickens under the gear.
3. Place solids. Add Capsule, Line and Disc shapes in attach-frame metres. Overlap them so there are no gaps. Remember thick is pixels.
4. Choose the sheet mode when the piece needs a mesh, and bind it first: every ring must follow bones or sit in the attach frame. flow > 0 is a long cloth sheet. wrap is a short mesh that ends at skeleton v. Neither is a flat stamp.
5. Write the plate. Fill rows with the letters from the schema, equal widths, no . in a mesh plate.
6. Preview. Open http://localhost:5174/gear-viewer.html (use localhost, not 127.0.0.1). The viewer reads the .ron files live. Confirm the front and the side view.
7. Test. Run the Rust tests with CARGO_TARGET_DIR=engine/target and a single substring filter (iron_helm, gear_changes; not --exact). From apps/stick-web run `npx tsx --test src/gear-ron.test.ts` for the parser.
8. Accept, then build wasm. Only after the look is accepted, run `wasm-pack build --release --target web --out-dir pkg` in `engine/ba-stick-render`.

One limit on this path today: the look is chosen by material family in garb(), which sets plate, robe, vest, harness, helm, or hat. A sheet-bearing piece in a new family needs a Rust edit (a plate loader and a draw path). Every game piece, solids-only ones included, is compiled into the wasm with include_str!, so a .ron change reaches the game only after the wasm build. The viewer reads the files live while you iterate.

## Recipes by material family

Each family has one accepted look. Reuse its recipe; do not retune it unless the owner asks.

| Family | Piece | Recipe |
|---|---|---|
| Metal body | ba_iron_cuirass | Capsules and discs on the chest, plus a front-face stamp (wrap and flow both 0). . leaves the steel showing. Gold is pixels on the steel, not a second slab. Shoulder discs: steel r 0.075 with a gold r 0.028. Chainmail still wears this look |
| Cloth body | ba_wizard_robe | flow 0.72. A long blue sheet, with sleeves running shoulder, elbow, then a wrist disk on the hand. Top and bottom caps match the edge rows. Sheets stay outside the bones and must not cross the limbs |
| Leather body | ba_leather_vest | Short mesh of l, d, k with wrap 0.32, plus two shoulder-strap capsules. No buckle disc |
| Bone body | ba_bone_harness | Short hide mesh of h, s, k with wrap 0.32, plus ivory rib, breastbone and strap capsules. No discs |
| Metal head | ba_iron_helm | Invisible disks, then pixel strips: horizontal disks from the crown down to the face, then vertical disks stepping back to the occiput. The most dorsal disk is filled gold, the rest stay invisible |
| Cloth head | ba_cloth_hat | Pointed stack of horizontal disks from a tip down to a brim, strips between them. The tip disk is filled with the top row. The brim stays a ring, so the face stays open. Every cloth head piece wears this look |
| Weapon | sword, greatsword | Capsules in the hand frame: grip, crossguard, blade along +y. Set stance, reach and swing_weight |
| Shield | shield | OffHand, stance: Some("shield"). Two discs on z 0.05 and 0.07, the second as Trim |

Helm details that are easy to break:

- The shell is built on the back and turned 180 degrees about up, (-x, y, -z).
- Strips skip the face hole (z > 0 and inside the 0.13 face, plus the chin). The opening has no pixels, so the face stays.
- The plate uses e and g only. No i, no empty cells.
- The head disc is drawn first. Helm pixels are biased nearer (d -= 0.5), so the shell hides the head where it covers it.

Hat details that are easy to break:

- The stack is built in place on the head. Do not apply the helm's 180-degree flip.
- Disks, tip first, are (y, r): (0.58, 0.02), (0.44, 0.07), (0.30, 0.12), (0.18, 0.15), (0.10, 0.16), (0.07, 0.32). The last disk is the brim.
- Material is `dust`. `"cloth"` fails to load.
- The plate is one letter, `b`, on every cell. A lighter band (`m`), a darker band (`c`), or a black seam (`k`) reads as a hole even when the pixel alpha is 255. `k` (#18161f) sits on the canvas (#221f2a).
- Fill only the tip disk, with the top-row color. Filling the brim covers the face.
- The head disc is drawn first. Hat pixels use the same nearer bias as the helm (d -= 0.5).
- The viewer's fit bounds must include the tip and the brim, or the point is clipped.
- `garb()` sets `hat` when the head material is cloth.

Rules that apply to every sheet and silhouette:

- One silhouette goes around the whole asset, snapped after the body and before the gear, then edged. Not a black ring per primitive. Skip it if the box is empty or over 80,000 px.
- Do not cull the far cloth sheet, half-disks or keepSheet. Both sheets and full caps draw, and depth puts the back sheet behind.
- Do not restore faces_camera, ring_outward, cameraToward or sheetOutward.
- Do not route leather or bone capsules through the steel plate_color helper. Each family has its own color function.

## Physics and animation hooks

Gear moves because its structure is bound to the rig, not because it carries animation of its own. These are the hooks a .ron can use today.

- Rigid attach. Every shape lives in the attach frame, so it follows the attach joint. A Disc with at: Some("l_shoulder") follows that joint instead.
- Body thickening. thickness_mul multiplies the body's own bone thickness under the gear (spine, shoulders, l_upper_arm, r_upper_arm, and so on). The cuirass uses spine: 1.72 to read as a plate over a torso.
- Rings follow the legs and torso. Sheet rings are built by ring_at(frame, joints, v), where skeleton v runs 0 at the shoulder, 0.34 at the hip, 0.67 at the knee and 1 at the foot. The rim sits outside the limb capsules, so legs do not poke through. The hem ring (v = 1) is centered on the feet, so a stride carries it.
- Cloth sway. flow sets how far the hem follows a foot. robe_sway weights the offset by height, so the hem moves most and the chest not at all.
- Sleeves. Sleeve rings run from the shoulder through the elbow to a wrist disk on the hand, so the sleeve bends with the arm.
- Weapon timing. stance, reach and swing_weight feed the animation system. Stance combines per hand: none is unarmed, 1h plus shield is 1h_shield, 1h plus 1h is dual, otherwise the main-hand stance. Heavier swing_weight stretches clip duration.
- Color slots. Shapes that use ColorSlot ramps follow the figure's ramp map. In a hit flash, every slot except Outline draws from the white ramp.

Two cautions. Plate cells are plotted as fixed palette indices, so they do not follow the ramp map. I have not verified whether hit flash or palette swaps reach them. And a piece with flow > 0 skips its rigid shapes, so physics on such a piece comes from the rings alone.

Planned by the owner and not in the format yet: extra bones (tail, weapon and cape chains), verlet capes and four-legged body plans.

## Validation and hard rules

A piece is done when every box below is ticked. The last two are the owner's, not the agent's.

- [ ] The gear .ron loads. An unknown ramp, bone or joint name fails with a message that names the piece.
- [ ] The plate parses: finite numbers, equal-width rows, and no . in a mesh plate.
- [ ] The piece's Rust test passes, run with CARGO_TARGET_DIR=engine/target and one substring filter such as iron_helm.
- [ ] `npx tsx --test src/gear-ron.test.ts` passes from apps/stick-web.
- [ ] Front and side are checked in the gear viewer, with both sheets and full caps drawn.
- [ ] Every pixel sheet is attached to structure: its rings follow bones or sit in the attach frame.
- [ ] The owner accepts the look.
- [ ] The wasm is built, after acceptance only.

When reporting a finished piece, an agent gives: the files changed with their sizes, the test output, and front and side views from the viewer.

The sheet rule. A pixel sheet is always attached to structure. Its rings follow bones or sit in the attach frame; a sheet never floats free or sits in screen space.

Hard rules:

- Do not edit engine/stick-engine, except the existing perspective patch.
- Do not put game gear in the stick-engine BUILTIN_GEAR list.
- Do not ship a window.__view hook.
- Do not start the next item before the current one is accepted.
- Do not add palette slots. Do not use the sky index (141), the tint range (148 to 255), emissive indices as cloth, or #f4f7ff and C_TRAIL as a highlight core.
- Do not "fix" the attach-frame axes or the iso depth formula.
- Do not use "cloth" as a material. Use a real ramp.
- A new Garb field needs a Default. Explicit Garb literals end with ..Default().
- While the browser is locked, clicks on the viewer's list do not select a piece.

## Roadmap

The format already gives full 3D. These steps raise quality and remove the Rust edits from adding gear. Step 3 needs step 2, step 5 needs step 3 and step 6 needs 2 and 3; the others stand alone.

| # | Step | What changes | Blocked by |
|---|---|---|---|
| 1 | Lit sheets | Plate cells go straight to the framebuffer as fixed palette indices, so shading is painted in and highlights do not move when the figure turns. Compute a normal per sheet vertex (analytic for ring ellipses), shade by N·L, and let a letter mean material plus a shade bias. Dither the steps with the existing bayer4, anchored to (u,v) so it sticks to the surface | Palette room, see below |
| 2 | Runtime RON registry | Every piece is now an include_str!, a OnceLock accessor, a color function, a draw function and a Garb flag. Disk constants (CROWN_Y, DORSAL_Z, HELM_R, face_hole, HAT_DISKS) are in Rust. Move rings, openings and plates into RON keyed by id, with one generic sheet drawer | None |
| 3 | Ring data in RON | Per-ring rx, rz, a squareness exponent, tilt and an arc for open shells (breastplate, helm opening, cape). Rows per chain instead of one global sheet size. Each chain declares the structure it binds to, and a chain without one fails to load | Step 2 |
| 4 | Separate grids | Front, back and sleeves sample one plate today. Add back_rows and sleeve_rows | None |
| 5 | Remove dead data | The robe's 14 capsules are not drawn when flow > 0; a shape-count test keeps them alive. Move that silhouette into ring profiles and drop them | Step 3 |
| 6 | GLB baker, RON out | A small tool slices a GLB along a chain axis, fits rx and rz per slice and unwraps albedo into a plate. Flat gear becomes a chain of flat rings. The engine stays RON-only | Steps 2 and 3 |
| 7 | Contact-sheet tests | Render 8 yaws by 3 poses per piece and diff against golden images in CI | None |
| 8 | Chains | Cape and tail chains with verlet motion, on extra bones | Rig work |

Palette room for step 1. The BA palette is a full 256 entries: biomes 16 to 63, trails, bridge and water 64 to 76, gear 77 to 79, effects 80 to 99, props 100 to 131, floaters and masonry 132 to 140, canine 142 to 147, and three 36-entry tint blocks from 148 to 255. Gear materials are single indices (steel 8, dark steel 13, gold 11, leather 77 and 78, bone 79), so a lit ramp needs entries to be reclaimed, for example by shrinking a tint block. A zero-cost first version dithers between each material's existing near and far colors, which gives three perceived tones. The robe's blue letters already map to water-blue entries, per the gear skill file.

## Open questions

- Figure height. The owner says the character is 80 px tall. HEIGHT_PX in stick_engine::camera is 44, with cam.scale_at applied on top. Which on-screen height should gear detail be designed for?
- Frame fallback. The gear skill file says that with a vertical spine, x falls back to world +X. GearDef::frame falls back to the rig's right vector, while draw_wrapped uses +X. Are those meant to differ?
- Palette for lighting. Which tint block, if any, may shrink to make room for lit gear ramps, or is the dithered near/far version enough?
- Runtime loading. Should pieces load from the asset directory at runtime, so a new item needs no wasm rebuild?
- Recolor on plates. Do hit flash, team color and elemental tint need to reach plate cells? They are fixed palette indices today.
- Missing slots. Shipped looks are metal body, cloth body, leather body, bone body, metal head, cloth head, and weapons. Shoulders, Hands, Legs, Feet and Back have none. What is the build order?
