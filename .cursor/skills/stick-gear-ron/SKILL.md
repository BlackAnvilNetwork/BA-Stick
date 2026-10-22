---
name: stick-gear-ron
description: >-
  Build BA-Stick worn gear as Stick Engine .ron: bone-attached solids (disc,
  capsule, line) and pixel sheets on invisible disks. Use when adding or
  changing armor, cloth, leather, bone, helms, or any gear/*.ron or
  *.plate.ron, or when the gear viewer, garb(), or ba-stick-render figure
  draw is involved. One accepted look per material family. Do not put game
  gear in stick-engine BUILTIN_GEAR. Do not start the next item until the
  current one is accepted.
---

# Gear .ron — solids and pixel sheets

Two tools, used together. Solids are volumes stuck to a bone. A pixel sheet is a mesh: invisible disks, strips between them. That is the 3D toolkit. A screen-space disc cannot have a hole; an opening is either "draw the face after" (rejected for helms) or strips that simply do not cover that region.

Content lives in `engine/ba-stick-render/assets/gear/`. The viewer reads those files live. The game raster is `engine/ba-stick-render/src/figure.rs`. Do not edit `engine/stick-engine` except the existing perspective patch.

Preview: `http://localhost:5174/gear-viewer.html` (use `localhost`, not `127.0.0.1`). While the browser is locked, list clicks do not select. Do not ship a `window.__view` hook.

## Frame

Attach frame: origin at the bone (`chest` or `head`). `+y` is `(chest − pelvis)` normalized, `+x` is `y × up` (character right), `+z` is `x × y` (forward). When the spine is vertical, `x` falls back to world +X. Do not "fix" this. Measured at yaw 0.6 rad, `frame.z` points away from the iso eye; the sheet called "front" bulges along `+frame.z`.

Iso depth `d = -(x+z)`. Engine `plot` keeps the smaller `d` (nearer). The viewer paints higher `d` last. Front ortho: screen `x = lx`, `y = -ly`, `d = lz`. Side: screen `x = lz`, `y = -ly`, `d = lx`. Do not "fix" iso `d`.

Head radius is about 0.13 m in the viewer (engine `pr.head_r`, often 0.13–0.14). `HEIGHT_PX` is 44.

## Solids

`Shape` is `Line`, `Capsule`, or `Disc`. `material` must be a real ramp name (`steel`, `dust`, `leather`, `bone`). `"cloth"` fails `from_ron`. Unknown fields are ignored.

`fb.disc` is a filled circle at the projected point. Radius in pixels is `r` metres × `HEIGHT_PX`. It is a billboard, not a disk lying in a 3D plane. Capsule `thick` is a pixel radius. Viewer capsules use `lineWidth = thick * 2 * fit`. Lines stay `thick * fit`. Do not thicken limb strokes to match.

`ColorSlot`: Trim → gold, Accent → red, else the material color. Do not route leather or bone capsules through the steel `plate_color` helper.

One silhouette around the whole asset, snapped after the body and before the gear, then edged. Not a black ring per primitive. Skip if the box is empty or over 80_000 px.

## Pixel sheets

Invisible rings. The disk interior is never filled. Strips are quads between consecutive rings, sampled from a `*.plate.ron`.

Plate letters (no new palette slots; `SKY` 141 is not a color; do not steal tint 148–255; do not use emissive indices as cloth or they glow; do not use `#f4f7ff` / `C_TRAIL` as a highlight core):

| Letter | Use |
|---|---|
| `.` | Empty. Cuirass only: leaves the steel underneath. A mesh plate must have no `.` or the cell becomes dust. |
| `g` `r` | Gold, red accent |
| `k` | Shadow |
| `e` `i` | Steel grey `#9aa6b8`, dark steel `#4a4458` |
| `l` `d` | Leather, far leather |
| `h` `s` | Bone hide, far hide |
| `b` `m` `c` | Water blues, dark water |

`flow > 0` is a long cloth sheet (front and back share the side edges and the hem disk). The viewer skips the rigid shapes when `flow > 0`. `wrap` is where a short mesh ends (vest and harness use `0.32`). `wrap == 0` and `flow == 0` is a flat stamp (cuirass), not a wrap. Helm is neither: its own draw path, keyed by id.

Do not cull the far cloth sheet, half-disks, or `keepSheet`. Both sheets and full caps draw. Depth already puts the back sheet behind. Do not restore `faces_camera`, `ring_outward`, `cameraToward`, or `sheetOutward`.

## Accepted looks

One look per material family. Do not retune these unless asked.

- **Metal body** (`ba_iron_cuirass`): capsules and discs on the chest, plus a front-face stamp. `.` leaves steel. Gold is pixels on the steel, not a second slab. Chainmail still wears this.
- **Cloth body** (`ba_wizard_robe`): long blue sheet, sleeves from shoulder through elbow to a wrist disk on the hand. Top and bottom caps match the edge rows. Sheets stay outside the bones and must not cross the limbs. The rigid capsules in the `.ron` are not drawn (`flow > 0`); leave them so the shape-count test still passes.
- **Leather body** (`ba_leather_vest`): short mesh (`l`/`d`/`k`, wrap 0.32) plus two shoulder-strap capsules. No buckle disc.
- **Bone body** (`ba_bone_harness`): short hide mesh (`h`/`s`/`k`) plus ivory rib, breastbone, and strap capsules. No discs.
- **Metal head** (`ba_iron_helm`): invisible disks, then pixel strips. The most dorsal disk is filled gold; the others stay invisible. Horizontal disks from the crown down to the face, then vertical disks stepping back to the occiput. The shell is built on the back and turned 180° around up: `(-x, y, -z)`. Strips skip the face hole (`z > 0` and inside the 0.13 face, plus the chin). Plate is steel `e` and gold `g` only — no `i`, no empty cells. The head disc is drawn first; helm pixels are biased nearer (`d -= 0.5`) so the shell hides the head where it covers it. The opening has no pixels, so the face stays. In the viewer the head is filled before the gear layer and is not redrawn on top.

`garb()` sets `plate`, `robe`, `vest`, `harness`, `helm` from the body or head material. Adding a bool with `Default` is safe. Explicit `Garb` literals use `..Default()`.

## Check

`CARGO_TARGET_DIR` must be `engine/target`. `cargo test` takes one substring filter (`iron_helm`, `gear_changes`), not `--exact` short names. Parser: `npx tsx --test src/gear-ron.test.ts` from `apps/stick-web`. Wasm, only after the look is accepted: `wasm-pack build --release --target web --out-dir pkg` in `engine/ba-stick-render`.

Confirm front and side in the gear viewer before calling a piece done.
