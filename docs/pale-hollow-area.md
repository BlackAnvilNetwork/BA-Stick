# Pale Hollow — First Area Design

**Region level band:** 1–20 (catalyst: Pale Dust) · **Hub:** The Shard Dwellings  
**Structure:** Soft-gated **northbound segments** inside a **wide open basin** (Reisenjima-style room to roam east/west). Soft level advice + bridges remain; hard canyon walls do not.

**Playable bounds:** `PALE_HOLLOW_BOUNDS` x −220…260, z −70…500 (`packages/config/src/pale-hollow.ts`). Mountain peaks ring the fringe; meadows/grass fill the flanks; chalk run + east tributary use a soft-edged flow ribbon (`PaleHollowRivers`, Water2-style dual normals) over wet riverbed terrain.

**Sources:** item manifest, `packages/config/src/pale-hollow.ts`, ambientCG CC0 albedos formerly under `apps/web/public/textures/pale-hollow/` (removed with the three.js client in #38; Stick Engine uses palette-shaded tiles instead).

**Related OSS (design / water):** LDtk + Tiled (level layout), Godot / Bevy (full engines — reference, not this stack), three.js `Water`/`Water2` + Valve flow-map paper, `@react-three/drei` (`useDepthBuffer`, `MeshReflectorMaterial`). Runtime stack stays R3F + Three.

Onchain: field gather/drop = **base mats → Character NFT**. Crafting at the Craft Master costs **gold** (per-recipe `recipe.gold` in the item catalog) + mats. KEK is not used in the game.

---

## Design rule

| Wrong | Right |
|-------|--------|
| Narrow corridor you never leave the road | **Open basin** — roam flanks; soft gates tip recommended level |
| Soft “recommended level” only with no landmarks | Soft advice **plus** bridges / cuts / tunnel as landmarks (still crossable) |

Content focus stays northbound by segment, but the heightfield and biomes fill the whole rectangle so the world feels open.

---

## Corridor overview (content focus)

```
S  THE SHARD DWELLINGS (safe hub — always)
        │  terrace gate
        ▼
┌─────────────────────────┐
│  SEGMENT A · Lv 1–5     │  Dustgrain Terraces + Chalk Run + meadows
│  “Hollow Steps”         │  wide farm/meadow flanks
└───────────┬─────────────┘
            │  Timber Bridge (quest / Lv5 soft gate)
            ▼
┌─────────────────────────┐
│  SEGMENT B · Lv 5–10    │  Ashbeam groves in open grassland
│  “Ashbeam Reach”        │  multiple groves, not a tree tunnel
└───────────┬─────────────┘
            │  Quarry Cut bridge / winch lift (Lv10)
            ▼
┌─────────────────────────┐
│  SEGMENT C · Lv 10–15   │  Hollow Quarry landmark + grass marches
│  “Chalkworks”           │  vine cliffs on far east/west
└───────────┬─────────────┘
            │  Seam Tunnel (Lv15)
            ▼
┌─────────────────────────┐
│  SEGMENT D · Lv 15–20   │  Copper Seams + Shard Crypt + Ash Road
│  “Pale Marches”         │  grass/scrub marches to blocked Ash Road
└───────────┬─────────────┘
            │
            ▼
N  Ashlands / Obsidia (Lv21+)
```

**Return path:** soft bridges stay crossable so players can retreat to the Dwellings to craft (gold + mats).

---

## Segment A — Hollow Steps (Lv 1–5)

**Theme:** Quiet chalk terraces and open meadow flanks. Learn gather, optional combat, first craft.

| | |
|--|--|
| **Size** | Wide band ~±70 × z 10–58 — farm strip + meadows + river |
| **Mobs** | Dust Hare (safe/flee), Pale Slime (proximity, river / tributary) |
| **Nodes** | dustgrain, pale-dust blooms, potters-clay, fossil-minnow, starter copper nugget |
| **Structures** | Dustgrain silos, clay bank, fishing pools |
| **Aggro feel** | Almost peaceful. Hares don’t fight first. Slimes only if you wade in. |

**Bridge out — Timber Bridge:** soft gate Lv5 (`PH_TIMBER_BRIDGE.softLevel`); underleveled players can still cross with a warning.

---

## Segment B — Ashbeam Reach (Lv 5–10)

**Theme:** Scattered ashbeam groves in open grassland; scrub only at the far rim.

| | |
|--|--|
| **Size** | ~80×55 |
| **Mobs** | Hollow Scavenger (sight + link), Ashbeam Boar (sound), Hares on edges |
| **Nodes** | ashbeam-log, bark-strip, dead-fiber, antidote-root (sparse), pale-dust |
| **Structures** | Shrine stump checkpoint, scavenger camp, boar wallow |
| **Aggro feel** | Walk calm past boars; scavenger camps face the road. Side paths safer. |

**Bridge out — Quarry Cut:** winch lift / stone arch. Lv10 soft gate (`PH_QUARRY_CUT`). Visual: you look down into the Chalkworks for the first time.

---

## Segment C — Chalkworks (Lv 10–15)

**Theme:** Working quarry and vine walls. Sight-cone pulls, vertical gather.

| | |
|--|--|
| **Size** | ~85×60 |
| **Mobs** | Ruin Dweller (sight), Cliff Adder (proximity ambush), Scavenger lookouts |
| **Nodes** | cobble, limestone (mine), climbing-cord (cliffs), pale-dust |
| **Structures** | Broken crane landmark, quarry shelves, vine cliff face |
| **Aggro feel** | Dwellers watch lanes; adders punish hugging walls. No sound-boars here. |

**Bridge out — Seam Tunnel:** torchlit cut into the north cliff. Lv15 soft gate (`PH_SEAM_TUNNEL`).

---

## Segment D — Pale Marches (Lv 15–20)

**Theme:** Ore dark, crypt mouth, road to Ashlands.

| | |
|--|--|
| **Size** | ~90×65 |
| **Mobs** | Seam Golem (sight, slow), Shard Wight (sight + link), Ruin Dweller at crypt fringe |
| **Nodes** | copper-ore + tin-ore veins, rare pale-dust crystals |
| **Structures** | Seam lanterns, crypt gate arch, Ash Road cairn |
| **Aggro feel** | Careful pulls. Crypt is the first “don’t link the room” space. |

**Exit — Ash Road:** Lv18 soft gate (`PH_ASH_ROAD`). Ashlands / Obsidia are defined in `world.ts` but have no field map yet; the playable chain continues north through Hollow Road → Forest Basin → Spur Road → Ring Ward → Islet Fords → Green Reach → Coil Pass → Coil Ridge (`ZONE_LINKS`), terrain only for now.

---

## Why this isn’t “one giant zone”

| Segment | Playable footprint | Content focus | Time-to-clear (rough) |
|---------|-------------------|---------------|------------------------|
| A 1–5 | Small | Tutorial gather/craft | 30–60 min |
| B 5–10 | Medium | Combat literacy | 1–2 hrs |
| C 10–15 | Medium | Mining + vertical | 1–2 hrs |
| D 15–20 | Medium | Ore + mini-dungeon | 1–2 hrs |

Hub is shared. Streaming: load **hub + current segment + previous segment** (for retreat); unload the far band. Greybox can ship **A alone**, then bolt B/C/D.

---

## Aggro (unchanged principle, per segment)

| Mode | Who |
|------|-----|
| **Safe** | Hub; Dust Hares |
| **Sight** | Scavengers, Dwellers, Golems, Wights |
| **Sound** | Boars (segment B) — sprint/combat ping |
| **Proximity** | Slimes, Cliff Adders |
| **Link** | Scavenger pairs; Dweller pairs; Wight packs |

Hub suppresses combat AI sound.

---

## Gathering ↔ segment (manifest)

| Mat | Segment |
|-----|---------|
| dustgrain, pale-dust (common), clay, fossil-minnow, starter copper | **A** |
| ashbeam-log, bark-strip, dead-fiber, antidote-root | **B** |
| cobble, limestone, climbing-cord | **C** |
| copper-ore, tin-ore (full veins), pale-dust crystals | **D** |
| Combat drops (linen-scrap, hides, cracked-brick, bone-chip, slime-oil, …) | Follow mob segment |

---

## Quests (code: `PH_QUESTS` in `packages/config/src/pale-hollow.ts`)

Bridges are soft level gates, not quest locks. Quests are kill tasks on specific mob ids, paid in gold:

| Quest | Giver | Task | Gold |
|---|---|---|---|
| Skirt of the Camp | Campaign Herald | 6 Dust Hares by the camp | 25 |
| Slick Landing | Span Keeper | 2 Pale Slimes at the landing | 40 |
| Out of the Rows | Terrace Keeper | 4 Dust Hares in the rows | 50 |
| Off the Clay | Clay Ward | 2 Pale Slimes on the clay | 60 |
| Taken Stacks | Grove Cutter | 4 Hollow Scavengers | 80 |
| The Wallow | Grove Hunter | 3 Ashbeam Boars | 100 |
| Off the Shelves | Cut Foreman | 4 Ruin Dwellers | 140 |
| At the Cord | Cord Cutter | 3 Cliff Adders | 150 |
| The Night Shift | Seam Ward | 2 Seam Golems | 180 |
| Shut the Mouth | Crypt Watch | 3 Shard Wights at the crypt | 200 |
| On the Lip | Road Warden | 2 Ruin Dwellers at the cairn | 220 |

Fishing is bait-gated: a `fish` node needs an equipped fishing rod and consumes the cheapest bait (`apps/server/src/fishing.ts`).

---

## City — The Shard Dwellings

Always reachable from every unlocked segment (south). Hub NPCs (`PH_HUB_NPCS` + `TRAINER`): Shard Elder, Campaign Herald, Job Master, Trainer, Craft Master, Provisioner. Safe zone.

---

## Implementation order

1. Greybox **hub + Segment A** only (shippable vertical slice).  
2. Timber Bridge + Segment B.  
3. Quarry Cut + Segment C.  
4. Seam Tunnel + Segment D + Ash Road.  
5. Art / streaming polish.

---

## Locked / open

**Locked by this revision:** Pale Hollow = corridor of four ~5-level segments with bridges — not one open 1–20 field.

**Still open:**
1. Crypt: instance vs seamless pocket in D.  
2. Cliff fall damage in C.  
3. Hares forever Safe vs later frenzy.
