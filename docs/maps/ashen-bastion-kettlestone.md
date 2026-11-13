# Ashen Bastion — CENTRAL KEEP / Kettlestone Crown Spindle — KEEP build sheet

**Sector:** local **x −6..16** (Kettlestone Crown Spindle). South approach reads the spindle from the curtain inner face.  
**Parent area:** `docs/maps/ashen-bastion-area.md` · config `packages/config/src/ashen-bastion.ts` · props `apps/stick-web/scripts/zone-props/ashen-bastion.ts`.  
**Kit:** `tools/ba-sdf-gear` — pitch **2.64**, `tower_sep` 1.32.  
**Refs:** modular kit massing, CENTRAL KEEP floor plans + elevation, in-game greybox (flat `wallBlock` slabs + south gap).  
**Rules:** no invented lore; BA names only (**Kettlestone Crown**, **Bellhammer Rise**, **Bellhook Walk**); **2.5D** (one height per cell — double-height feast = tall wall props + mid pad, not stacked floors on the same XZ).

Sheet only. SDF not installed live.

---

## 1. KEEP massing (exact numbers)

North is **+z**. Sector hand-off: west edge **x = −6** → Sablefolio Ledge; east edge **x = 16** → Hammergate Crown.

| Piece | World (m) | Notes |
|-------|-----------|--------|
| Sector bounds | **x −6..16**, z uses yard/keep pads below | Area-sheet central keep |
| Feast hall footprint | **x −4..10**, **z −2..8** | Checkered main-hall pad on plan; walk @ **Y = 2.0** |
| Feast shell center | **(4, 4)** | Square keep mass; half-plan **~4.5** |
| Feast double-height volume | props on feast pad, **h ≈ 6.0..6.5** | Reads as tall hall to tip ≈ **8.0..8.5**; **not** a second walkable floor |
| Bellhammer Rise (stair) | centerline **x = 4**, **z 6 → 14**, half-width **≤ 1.15** | Plan stair between feast and upper decks |
| Sleep tiers pad | **x −2..10**, **z 6..12** | Plan “sleep” block → **one** mid plateau @ **8.4** with partition props |
| Crown ring / top pad | **x 0..8**, **z 10..16** | Upper keep walk @ **11.0** |
| Crown ring wall | round ring center **(4, 12)**, **r ≈ 2.6..3.0** | Or keep ring on **(4, 8)** if feast shell shares shaft |
| East bridge abutment | **x 10..14**, **z 8..12** | Bellhook Walk west landing inside KEEP |
| Bellhook Walk (east span) | seg **(12, 10) → (22, 8)** ≤ **1.55** | Deck @ **5.2**; east half is Hammergate |
| Landmark pin | Kettlestone Crown **(4, 6)** | Label only |
| South curtain in sector | **z ≈ 0.4..0.55**, x on pitch **−6..16** | Shared Vigil Walk cheek behind |

### Plan / elevation → 2.5D plateaus

Floor plans show stacked halls; elevation shows cliff-stepped wings. v0 compresses to four heights (area sheet). **No sub-basement walk** in KEEP — crypt/sub-base stays visual only (blocked or non-authored).

| Plan / elevation cue | Engine role | Y |
|----------------------|-------------|---|
| Feast / main-hall floor (checkered) | Feast pad walkable | **2.0** (`AB_YARD_Y`) |
| Double-height feast hall volume | Tall `wallBlock` shell on feast pad | prop tip ≈ **8.0..8.5** (no mid-floor walk inside shell) |
| Bridge / abutment decks | Bellhook landing + span | **5.2** (`AB_RAMPART_Y`) |
| Sleep-tier rooms (Grand Hall plan west block) | Single mid pad + stub partitions | **8.4** (`AB_KEEP_MID_Y`) |
| Living quarters / upper gallery / crown | Top pad + crown ring | **11.0** (`AB_KEEP_TOP_Y`) |
| Needle spire (elevation) | `K.peak` on crown — non-walkable silhouette | base on **11.0** (or mid roof) |

### Heights mapped to 2.0 / 5.2 / 8.4 / 11.0

| Stratum | Constant | KEEP use |
|---------|----------|----------|
| **2.0** | `AB_YARD_Y` | Feast hall floor; south apron into curtain |
| **5.2** | `AB_RAMPART_Y` | East abutment; Bellhook Walk deck; Vigil Walk strip through sector |
| **8.4** | `AB_KEEP_MID_Y` | Sleep-tiers plateau (one pad, not stacked rooms) |
| **11.0** | `AB_KEEP_TOP_Y` | Crown ring walk / upper keep |

**Bellhammer Rise blends:**  
1. **(4, 6) → (4, 10)** · **2.0 → 8.4** (feast → sleep pad)  
2. **(4, 10) → (4, 14)** · **8.4 → 11.0** (sleep → crown)  

Optional short lip from abutment **5.2 → 8.4** on **x ≈ 10..12**, **z ≈ 9..11** if flood-fill from Bellhook cannot reach mid without it.

---

## 2. Prop placement list (existing K kinds only)

Kinds for this sector: **`K.wallBlock`**, **`K.bridge`**, **`K.peak`**, **`K.moss`**, **`K.banner`**, **`K.weaponRack`**, **`K.crate`**, **`K.barrel`**, **`K.bedroll`**, **`K.stone`**, **`K.ruinArch`**.  
`y` = `ashenBastionStandHeight(x,z)` unless noted.  
Do **not** invent kinds. Do **not** place solid props in the Bellhammer Rise capsule or abutment clear strip (≥ **1.8** m).

### A. Feast hall footprint

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Feast shell body | `wallBlock` v1 | Center **(4, 4)** or **(4, 6)** | half **~4.5**, **h 6.2**, crown slab **h 0.9** — double-height hall mass |
| South feast face | `wallBlock` | **z ≈ −1.5..0**, **x −3..9** on pitch, leave door cut toward curtain | **w 2.2, h 3.4..6.0, d 1.2** |
| North feast lip (under stairs) | `wallBlock` | **z ≈ 7.5**, flanking Bellhammer | cheeks only; keep stair clear |
| Feast door cut cue | `ruinArch` | **(4, −1)** or south face center | optional; walkable opening on yard |
| Floor clutter | `weaponRack` / `crate` / `barrel` | Inside feast pad, e.g. **(6, 4)** | existing clutter pattern; stay on **Y = 2.0** |
| Banner pair | `banner` | South face of shell | optional heraldry cue |

### B. Bellhammer Rise (stair)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Stair cheeks | `wallBlock` | **(2.6, 8)** and **(5.4, 8)** (and again near **z = 11**) | **w 0.7, h 2.8..3.4, d 2.4** — visual only; walk is heightfield |
| Cheek moss | `moss` | Base of cheeks | light weathering |

Walk = `onKeepStair` capsule + `stairBlend` (see §4). No deck props on the ramp centerline.

### C. Sleep tiers (mid pad @ 8.4)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Outer shell stub | `wallBlock` | Ring or box around **x −2..10**, **z 6..12** | **h 2.2..2.8** on mid stand — reads as room storey without a second floor |
| Partition stubs | `wallBlock` | 3–4 short walls along **z ≈ 8** and **z ≈ 10**, gaps for corridor | **w 1.2, h 1.6, d 0.5** — plan’s ~14 cells → **cues**, not full maze |
| Bedroll cues | `bedroll` | 2–4 on mid pad (e.g. **(−1, 8)**, **(7, 9)**) | sleep-tier read; keep corridor clear **x ≈ 3..5** |
| Mid crown slab | `wallBlock` | **(4, 9)** | thin **h 0.4** roof cue under top pad |

**2.5D rule:** partitions sit on the **8.4** pad. Do not author a second walkable sleep floor above feast on the same XZ.

### D. Crown ring (top @ 11.0)

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Round crown ring | `wallBlock` | Center **(4, 12)** or **(4, 8)**, **n ≈ 10..12**, **r 2.6..3.0** | **w 1.35, h 3.5..4.0, d 1.05** + crown disc |
| Merlon / crown teeth | `wallBlock` | On ring top | **w 0.5, h 0.6, d 0.5** |
| Top pad edge cheeks | `wallBlock` | Around **x 0..8**, **z 10..16** | low parapet **h 0.9** |

### E. East bridge abutment + Bellhook Walk

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Abutment cheeks | `wallBlock` | **(10.5, 10)** and **(13.5, 10)** | **w 0.8, h 2.4, d 2.0** — frame landing |
| Abutment deck cue | `wallBlock` | **(12, 10)**, y = **AB_RAMPART_Y − 0.05** | **w 3.0, h 0.25, d 2.2** |
| Bellhook Walk deck | `bridge` | Center **≈ (17, 9)**, yaw `atan2(−2, 10)`≈`atan2(10,−2)` as authored, span **12**, deck **w 3.0** | Existing east span; KEEP owns west abutment only |
| Abutment moss | `moss` | Cliff face under abutment **z > 10** scrapes | optional |

### F. Spire / peak (elevation needle)

Elevation shows a **needle** on the upper keep / east high mass. KEEP owns the spindle tip.

| Prop | Kind | Placement | Size / notes |
|------|------|-----------|--------------|
| Crown needle | `K.peak` | **(4, 12)** preferred (or **(4, 8)** if shared with feast shaft) | **`h ≈ 5.5..6.5`**, `s = max(0.7, h/8)`, **`y = AB_KEEP_TOP_Y`** (or mid roof **8.4** if top pad is open) |
| Base rocks | `stone` | 1–2 at needle toe outside walk | small; do not block crown ring |

`K.peak` is silhouette only — **not** walkable. Do not put the peak on the Bellhammer capsule.

### G. Shared curtain through sector (hand-off)

South curtain bays at pitch **2.64** for **x ∈ [−6, 16]** are authored with the zone curtain pass (Hammergate sheet owns gate cut). KEEP does not re-own curtain; keep Vigil Walk clear behind battlements (**z 1.2..4.2** @ **5.2**).

---

## 3. Walkable mask edits

Target: flood-fill from feast pad reaches Bellhammer top, crown ring, east abutment, and Bellhook toward Hammergate — still **one height per cell**.

| Mask | Current (`ashen-bastion.ts`) | KEEP edit |
|------|------------------------------|-----------|
| Feast / keep yard | `onYard` Ember rect **x −4..14**, **z −2..14** @ **2.0** | **Tighten** to feast **x −4..10**, **z −2..8**; stop bleeding into Hammergate (**x ≥ 16**) and into mid pad XZ |
| Sleep / mid | `onKeepMid` **x −2..10**, **z 6..14** @ **8.4** | Prefer **z 6..12**; leave **z 12..14** to stair/top hand-off |
| Crown / top | `onKeepTop` **x 0..8**, **z 10..16** @ **11.0** | Keep; ensure non-overlap preference vs mid (top wins via `Math.max` in stand height — OK) |
| Bellhammer Rise | `onKeepStair` seg **(4,8)→(4,14)** ≤ **1.15** | Extend south start to **(4, 6)** so ramp meets feast pad; keep blends **2.0→8.4** then **8.4→11.0** |
| East abutment | *(none dedicated)* | **Add** rect **x 10..14**, **z 8..12** walkable @ **5.2** (or capsule onto Bellhook) |
| Bellhook Walk | `onSpireBridge` seg **(12,10)→(22,8)** ≤ **1.15..1.55** @ **5.2** | Keep; KEEP tests west landing **(12, 10)** |
| Rampart strip | `onRampartWalk` **z 1.2..4.2** through sector | Keep ≥ **1.8** m clear behind curtain props |
| Soft shelf apron | broad shelf walk | Optional: **exclude** feast/mid/top interiors from soft apron override so plateau Y wins cleanly |

### Stand-height notes

- Feast cells → **2.0**  
- Abutment + Bellhook → **5.2**  
- Sleep pad → **8.4**  
- Crown pad → **11.0**  
- Bellhammer: two `stairBlend` segments as in §1  
- If abutment@5.2 and mid@8.4 share edge cells, prefer a **short ramp** capsule rather than a cliff step > player climb

### Biome (KEEP)

| Pad | Biome |
|-----|-------|
| Feast @ 2.0 | `hub_indoor` |
| Mid / top / abutment | `terrace` |
| Bellhook | `bridge` |
| Outside walkable | `mountain` |

---

## 4. Spire / peak suggestion

Elevation needle on the spindle → **one `K.peak`**:

```
kind: K.peak
x: 4, z: 12
y: AB_KEEP_TOP_Y          // 11.0
h: 6.0                    // needle read; s = max(0.7, h/8) ≈ 0.75
```

If the feast square shell already fills **(4, 6..8)**, place the peak on the **crown disc** above the round ring so iso does not bury the hall door. Do **not** add a second peak for the east elevation needle inside Hammergate — that sector owns its own tip if needed.

---

## 5. Sector checklist (KEEP only)

- [ ] Feast footprint **x −4..10**, **z −2..8** @ **2.0** with tall shell props (double-height, not stacked floor)
- [ ] Bellhammer Rise centerline **x = 4**, **z 6→14**, blends **2.0 → 8.4 → 11.0** + cheek walls
- [ ] Sleep tiers = **one** mid pad @ **8.4** + partition / bedroll cues
- [ ] Crown ring pad @ **11.0** + round `wallBlock` ring
- [ ] East abutment **x 10..14**, **z 8..12** @ **5.2** feeding Bellhook Walk
- [ ] Heights only **2.0 / 5.2 / 8.4 / 11.0** (+ stair blends)
- [ ] Props from existing **K** kinds only (§2)
- [ ] Walkable mask edits applied in config (§3); flood-fill feast → crown → abutment
- [ ] `K.peak` needle on crown (§4)
- [ ] No lore copied from plan labels; BA names only

**Demo aim:** `?demo&zone=ashen_bastion&x=4&z=-4` → feast → Bellhammer Rise → crown ring → east abutment onto Bellhook Walk.
