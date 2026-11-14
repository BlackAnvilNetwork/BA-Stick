# Ashen Bastion — area sheet (test castle)

Reference art: `tools/ba-sdf-gear/art/castle-refs/` · **Anvilhold castle images:** [`docs/maps/anvilhold-castle/`](./anvilhold-castle/). **Do not copy reference labels into ids.**

Modular SDF kit (`tools/ba-sdf-gear`): curtain + gate bays, pitch **7.92 m** (`tower_sep` 3.96, 3× old 2.64). Curtain towers **r≈1.55**, exterior buttresses, hollow gallery + postern cue. South **twin-tower gatehouse** keeps `arch_w` **1.85** → **3.7 m** clear (doors open `1.0`, centred at **x=0** / **z=−14**); nearby curtain bays skipped. **Castle architecture** ships in **`public/zones/ashen_bastion.bam`** (gatehouse, curtain, houses, Vigil Walk decks) — zone walkability is heightfield-only; BAP1 is bridges + light clutter only (no wallBlock massing).

**Sector sheets:** [`ashen-bastion-smolder.md`](./ashen-bastion-smolder.md) · [`ashen-bastion-sablefolio.md`](./ashen-bastion-sablefolio.md) · [`ashen-bastion-kettlestone.md`](./ashen-bastion-kettlestone.md) · [`ashen-bastion-hammergate.md`](./ashen-bastion-hammergate.md)

## Six fields

| # | Field | Value |
|---|-------|-------|
| 1 | Bounds | x **-72..72**, z **-48..64**. **144×112 m** = **16 128 m²** (~72 screens). Grid **289×225** @ 0.5 m → bake **260 124 B (≈254.0 KiB)** BAZ1. |
| 2 | Walkable mask | Closed curtain footprint (**x ±56**, **z −14..50**); **south gate** at **x≈0** (clear **3.6**); inner courtyard + **3.0** street grid; **16** SDF house floor pads (kit A/B/C/D/H along inner walls / streets); continuous **Vigil Walk** rampart (**≥1.8** clear); **SE/SW** yard→rampart stairs; central keep pads; **Smolder-Ledge** west lip; **Ash Span** + **Bellhook Walk** bridges; south **approach**. Outside = blocked mountain. |
| 3 | Relief | Yard / house **2.0**; rampart / bridge **5.2**; keep mid **8.4**; keep top **11.0**; south scrapes **~0.4**. Cap **12**. |
| 4 | Widths | Approach **4.5**; gate **3.6**; courtyard streets **3.0**; rampart **≥1.8** (authored 2.0); stair **1.8**; house door **≥1.2** (`DOOR_WIDTH_M` in `house.rs`). |
| 5 | Exits | `south-lip` **x −8..8**, **z −46..−38** → `ring_ward`. Return `ring_ward` `east-gap`. Spawn **(0, −20)**, facing **π**. |
| 6 | Landmarks | Smolder-Ledge **(−62, 26)**, Sablefolio Ledge **(−36, 22)**, Kettlestone Crown **(0, 36)**, Hammergate Crown **(0, −8)**, Ash Span, Bellhook Walk. |

## Sectors (logical wards inside the expanded footprint)

| Ward | BA name | Local x (approx) | Notes |
|------|---------|------------------|-------|
| West lip | **Smolder-Ledge** | −68..−54 | West terrace + Ash Span abutment |
| West inner | **Sablefolio Ledge** | −48..−34 | Archive strip on inner street grid |
| Keep | **Kettlestone Crown** | −6..6 @ z 30..44 | Bellhammer Rise stair north from yard |
| Gate | **Hammergate Crown** | **x≈0**, z −14..−4 | South gate passage + approach |
| East | Curtain east + Bellhook | 42..56 | East rampart + bridge to keep abutment |

v0 heightfield compresses multi-storey plan into yard / rampart / keep-mid / keep-top plateaus (2.5D).

## Walkability rules

- One height per cell (2.5D): **ramps and plateaus**, not stacked floors on the same XZ.
- Spawn flood-fill must reach **south-lip**, **courtyard center**, **rampart**, **≥1 house pad**, **keep top**, bridges.
- Rampart clear strip **≥1.8 m** along inside curtain face.
- Travel gate **south-lip** stays walkable and unblocked.

## Generative kit mapping

| Blueprint piece | Kit / prop |
|-----------------|------------|
| Curtain + towers | **BAM1** SDF curtain ring (hollow gallery, exterior buttresses, merlons) |
| Gate bay | Wide SDF twin-tower gatehouse @ **x=0**, doors open, arch clear **≥3.6** |
| Walkways | SDF Vigil Walk decks on rampart |
| Houses | SDF kit on `AB_HOUSE_PADS`: `house_l` (A), `house_tall` (B), `house_workshop` (C), `house_shed` (D), `house_stone` (H); hollow interiors + doors |
| Stairs | Heightfield ramp (SE/SW + Bellhammer Rise) |
| Bridge | `K.bridge` + walkable deck |
| Clutter | BAP1 light props only |

## Wiring checklist

- [x] `packages/config/src/ashen-bastion.ts` + `ZONE_FIELDS` / `ZONE_IDS` / `ZONES`
- [x] `zone-layout` BANDS + `zone-links` ridge↔bastion
- [x] `ring_ward` `east-gap` (east street outer ring); bastion entry spawn on south approach
- [x] stick-web `BAKED` + `zone-props/ashen-bastion.ts` + bake
- [x] Tests: `ashen-bastion.test.ts`; chain bounce via `ZONE_LINKS`
