# Ashen Bastion — EAST / Hammergate Crown — gatehouse build sheet

**Sector:** local **x 16..50** (Hammergate Crown). First read from the SE approach.  
**Parent area:** `docs/maps/ashen-bastion-area.md` · config `packages/config/src/ashen-bastion.ts` · props `apps/stick-web/scripts/zone-props/ashen-bastion.ts`.  
**Kit:** `tools/ba-sdf-gear` — `CastleModule` / `GatehouseParams`: **pitch 2.64**, **tower_sep 1.32**.  
**Refs:** modular kit front (target look), Ashen Bastion floor plans + elevation, in-game greybox (flat `wallBlock` curtain + gap).  
**Rules:** no invented lore; **south-lip** travel gate stays walkable; **2.5D** (one height per cell — ramps/plateaus, not stacked floors on same XZ).

This sheet is massing + prop layout only. Do not implement SDF install here.

---

## 1. Gatehouse massing (exact numbers)

Origin of the gate bay = approach axis. North is **+z**. Curtain runs **along z ≈ 0**.

| Piece | World (m) | Notes |
|-------|-----------|--------|
| Gate bay origin | **x = 28**, **z = 0** | Matches approach centerline + spawn x |
| Curtain outer face | **z = 0.0** | Authoring line; greybox massing currently at **z = 0.4** |
| Curtain inner / rampart cheek | **z = 2.6** | Inner walk faces +z |
| West square tower center | **(22, 1)** | Flanks gate; half-plan **2.2**, height **5.5** above stand |
| East square tower center | **(34, 1)** | Mirror; same half / height |
| Tower–tower center sep | **12.0** | ≈ **4.545 × pitch** — widened vs kit single-bay `2 × tower_sep` so the approach road reads at iso |
| Curtain bay pitch | **2.64** | `AB_KIT_PITCH` = kit `pitch()` |
| Curtain east of east tower | **x = 36.64, 39.28, 41.92, 44.56…** (step 2.64) while **x ≤ 48** | Skip any bay whose center falls inside the gate cut |
| Curtain west into keep sector | **x = 19.36, 16.72…** (step −2.64) while **x ≥ 16** | Sector edge; west of 16 is Kettlestone |
| Gate prop cut (no curtain body) | **22 < x < 34** | Leave empty for passage + arch placeholder |
| Door / arch clear width | **3.2** | Area-sheet gate width; jambs ≈ **x = 26.4..29.6** centered on 28 |
| Arch spring / head (kit → world) | clear **~1.95** high at yard | Kit `arch_h = 1.95`; place arch base on **Y = AB_YARD_Y (2.0)** |
| Approach road | centerline **x = 28**, **z = −34 → −4**, half-width **2.4** (full ≈ **4.8**; sheet width **4.5**) | Trail id `approach`, biome `ash_road` |
| Spawn | **(28, −10)**, facing **π** (looks −z / toward approach south) | East gateyard |
| Landmark pin | Hammergate Crown **(30, 2)** | Label only |

### Kit ↔ world scale

| Kit local (`GatehouseParams` / `CastleModule`) | Value | World use |
|-----------------------------------------------|-------|-----------|
| `tower_sep` | 1.32 | Shared tower axis spacing **inside one kit bay**; world gate bay is **wider** (towers at 22 / 34) |
| `pitch` = `2 × tower_sep` | **2.64** | Curtain bay centers east/west of the gate cut |
| `tower_r` / crown | 0.52 / 0.66 | Kit cylinders → **square** `wallBlock` towers in-zone |
| `tower_h` + `crown_h` | 3.85 + 0.58 | Greybox shaft **h = 5.5** so towers clear the curtain (**h = 3.4**) |
| `wall_half` | (0.78, 1.55, 0.48) | Curtain body ≈ **w 2.4 × h 3.4 × d 1.35** (readable iso mass) |
| `arch_w` / `arch_h` | 0.50 / 1.95 | World clear **3.2** wide (road), **~1.95** high |
| Corbel period | 0.18 | Approximate with **small** `wallBlock` shelf (see §2) |
| Merlon `w` / `gap` | 0.15 / 0.13 | Approximate with parapet cheek blocks + spaced tops |

Square towers (not kit round shafts) are required for the modular-kit **front** look and the elevation’s central square tower.

---

## 2. Prop list (kit approximation — BAP1 kinds only)

Kinds allowed for this pass: **`K.wallBlock`**, **`K.riverWall`**, **`K.ruinArch`**, **`K.moss`**.  
`y` = `ashenBastionStandHeight(x,z)` unless noted (rampart pieces use **AB_RAMPART_Y**).  
Do **not** place props inside `south-lip` (`x 20..36`, `z −36..−28`).

### A. Footing course

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Curtain footing | `wallBlock` v0 | Along **z = 0.2**, x on pitch **except** `22 < x < 34` | **w 2.5, h 0.45, d 1.6**; `y = stand − 0.05` |
| Tower footing pads | `wallBlock` v1 | Under each tower face at **(22±2.2, 1)** / **(34±2.2, 1)** (four sides) | **w 2.8, h 0.55, d 1.5** |
| Moss at toe | `moss` | Sparse on footing + south scrapes **z < −8**, outside walk | `s ≈ 0.5..0.9` |

### B. Wall body (curtain + square towers)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Curtain bay body | `wallBlock` | **z = 0.4**, x = … − pitch … skip gate cut … | **w 2.4, h 3.4, d 1.35**, yaw 0 — current greybox |
| Optional long runs | `riverWall` | Same curtain line where a continuous mitred run reads better than discrete bays | `s` = bay length **2.64**, `w` thick ≈ **1.2**, `h` **3.4**, `d` cope ≈ **0.25** |
| Square tower faces | `wallBlock` v1 | Centers **(22,1)** and **(34,1)**; four faces at ±half | half **2.2**, face **w = 3.52**, **h 5.5**, **d 1.4** |
| Gate jamb cheeks | `wallBlock` | **(24.5, 0.4)** and **(31.5, 0.4)** | **w 1.2, h 3.6, d 1.5** — frame the **3.2** door clear |

### C. Corbel shelf (kit arcade → small blocks)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Curtain corbel row | `wallBlock` v0 | **z = 0.95**, y ≈ **AB_YARD_Y + 3.15** (under parapet), x on **~0.66** step (≈ ¼ pitch) outside gate cut | **w 0.55, h 0.35, d 0.45** — small shelf; not true arched brackets |
| Tower corbel band | `wallBlock` v0 | Ring just under tower crown (~ **y = stand + 4.6**) on each square face | **w 0.5, h 0.3, d 0.4**, spaced ~0.55 along face |

### D. Merlons / parapet

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Inner parapet cheek | `wallBlock` v1 | **z = 2.6**, y = **AB_RAMPART_Y − 0.15**, x on pitch skip gate | **w 2.2, h 1.1, d 0.85** — current greybox |
| Merlon teeth | `wallBlock` v0 | On cheek top, every **~0.55** along x (kit merlon+gap ≈ 0.28 scaled up) | **w 0.45, h 0.55, d 0.7** |
| Tower crown merlons | `wallBlock` | Four corners + mid-face on each tower top | **w 0.5, h 0.6, d 0.5** |

### E. Tower tops

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Crown slab | `wallBlock` v1 | **(22, 1)** / **(34, 1)** at **y ≈ stand + 5.2** | **w 4.6, h 0.4, d 4.6** — flat walkable visual; actual walk is heightfield rampart ring |
| Coping hint | `riverWall` | Short segment on south face of each crown | thin cope; optional |

### F. Door opening placeholder

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Arch stand-in | `ruinArch` v0 | **(28, 0.2)**, yaw 0, `y = AB_YARD_Y − 0.1` | **s ≈ 3.8** (rise), **w ≈ 3.4** (span cue) — **not** a true Roman arch |
| Threshold slabs | `wallBlock` | **x = 24..32** step 2, **z = −4**, y = **AB_YARD_Y − 0.05** | **w 1.6, h 0.35, d 1.2** — gateyard floor cue (existing) |

### G. Stairs (visual cheeks only; walk is heightfield)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| East stair cheeks | `wallBlock` | **(34.6, 1)** and **(37.4, 1)** | **w 0.7, h 2.8, d 3.2** — existing |
| Cheek moss | `moss` | Base of cheeks | light weathering |

---

## 3. Walkable (must keep)

2.5D plateaus / ramps from `ashen-bastion.ts` — props must not imply a second floor on the same XZ.

| Path | Rect / capsule | Y |
|------|----------------|--|
| Approach | seg **(28,−34)→(28,−4)** ≤ **2.4** | **AB_YARD_Y = 2.0** |
| Gate passage | **x 24..32**, **z −6..8** | **2.0** |
| Gate Spire yard | **x 16..44**, **z −8..12** | **2.0** |
| East stair → rampart | seg **(36,−2)→(36,4)** ≤ **1.0** | blend **2.0 → 5.2** |
| Rampart / Vigil Walk | **x −38..42**, **z 1.2..4.2** (east sector uses **16..42**) | **AB_RAMPART_Y = 5.2** |
| East tower ring walk | hypot**(x−34, z−2) ≤ 3.2** and **z ≥ −1** | **5.2** |
| **south-lip** travel | **x 20..36**, **z −36..−28**, softLevel 6 → `ring_ward` | stay **walkable / unblocked** |

Flood-fill from spawn **(28,−10)** must reach: south-lip center, gate passage, east stair top, rampart at ~**(30, 2.5)**.

---

## 4. What ONLY SDF / gatehouse mesh can do later

Prop kit can fake massing. These stay **out of** the BAP1 approximation:

1. **True Roman arch** — semicircle head + jambs (`sd_arch_cut`), voussoir face ring, gate buttresses.  
2. **Hinged door leaves** — wood panels, grooves, straps; `door_open` 0..1 → 0..90° outward (`door_sdf`).  
3. **Arrow slits** — embrasures into hollow tower / gallery interiors (`wall_shell` / cavity).  
4. **Arched corbel brackets** — polar / linear scooped corbels (`corbel_ring` / `corbel_line_x` period 0.18).  
5. **Uneven rubble footing SDF** — noisy pads under towers (`footing_sdf`).  
6. **Soft-union shared tower axes** when composing curtain bays at pitch 2.64 (`castle_wall_sdf`).

Until mesh install: walkable rectangular gate cut + `ruinArch` placeholder + square `wallBlock` towers.

---

## 5. Sector checklist (EAST only)

- [ ] Curtain bays snap to **pitch 2.64** outside **22 < x < 34**
- [ ] Square towers at **(22,1)** and **(34,1)**, taller than curtain
- [ ] Footing + corbel shelf + merlons + crown slabs from §2
- [ ] Door clear **3.2** on axis **x = 28**; approach from south intact
- [ ] Gate passage + east stair + rampart walkable; **south-lip** untouched
- [ ] No lore copy from floor-plan labels; keep BA names already in area sheet
- [ ] SDF arch / doors / slits deferred (§4)

**Demo aim:** `?demo&zone=ashen_bastion&x=28&z=-18` then walk +z through the gap and up the east stair to Vigil Walk.
