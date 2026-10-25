---
name: bellgrave-wearable-craft
description: >-
  Add a new Bellgrave/BA-Stick catalog item that players can craft and equip:
  catalog.json entry, recipe regen, combat stats, in-world visuals (pixel sword
  or gear RON), icons, wiki/crafting UI, and equip snapshot behavior. Use when
  creating or extending a craftable weapon, armor piece, ring, or other
  equipment, or when crafting wiki / in-game craft fails after a catalog change.
  Pair with stick-gear-ron for full 3D RON weapons; this skill covers the full
  game-data and client pipeline. Do not finish until craft, equip, and visuals
  are verified.
---

# Wearable craftable catalog item

End-to-end pipeline for **one new item** that appears in the craft panel, wiki, bag, and paperdoll, and updates the stick figure when equipped.

Reference walkthrough: **Decayed Sword** (`id` 1064, `decayed-sword`, bonecraft L2, main-hand sword).

## Before you start

Collect from the request (or infer from a sibling item):

| Field | Notes |
|--------|--------|
| **name / slug** | kebab slug drives icon path and `ba_*` gear id |
| **catalog id** | Stable int; append in `catalog.json` or regen from manifest |
| **kind** | `equipment` for wearables |
| **craftSkill + craftLevel** | Gates craft UI and stat scaling (`craftLevel` ≈ iLv) |
| **recipe** | `gold`, `materialsText` — use real **`×`** (U+00D7), UTF-8 |
| **slot** | `main`, `body`, `ring`, etc. (only one **paperdoll** ring slot in catalog: `ring`; game also has `ring2`) |
| **weaponFamily** | Required for `main` weapons: `sword`, `dagger`, `greatsword`, … |
| **stats / delayMs / jobRestrict** | Combat + equip rules |
| **look** | Pixel palette vs copy existing RON vs new RON (see Visuals) |

Copy stats/recipe shape from the closest existing item, then adjust.

## Pipeline overview

```
catalog.json  ──sync──► catalog.generated.ts, weapon-tokens.generated.ts
       │
       └──gen-craft──► contracts/.../craft_recipe_data.rs
       │
       ├── @bellgrave/items (craft wiki, equip stats, bag)
       ├── @bellgrave/combat (weapon TP / family map)
       ├── server handleEquip + aggregateEquipmentStats
       └── stick-web gearArgs + WASM figure (catalog id = wseed)
```

**Never** hand-edit `catalog.generated.ts` or mojibake `materialsText` (breaks **all** recipe parsing). **Always** regen from JSON with UTF-8 scripts below.

## Step 1 — Catalog entry

Edit **`packages/items/src/catalog.json`** only (unless doing a full manifest regen).

Minimal **craftable main-hand weapon** template:

```json
{
  "id": 1064,
  "name": "Decayed Sword",
  "description": "…",
  "icon": "/icons/items/decayed-sword.png",
  "slug": "decayed-sword",
  "kind": "equipment",
  "craftLevel": 2,
  "craftSkill": "bonecraft",
  "recipe": {
    "gold": 250,
    "materialsText": "Dustgrain×5"
  },
  "stats": { "atk": 9 },
  "delayMs": 2400,
  "slot": "main",
  "jobRestrict": ["knight", "fighter", "battlemage"],
  "weaponFamily": "sword",
  "rarity": "Common"
}
```

**Armor / ring / etc.:** same pattern; set `slot`, omit `weaponFamily` unless `main`. Rings use catalog `"slot": "ring"` only.

## Step 2 — Regenerate derived data (required)

From repo root, **UTF-8**:

```bash
python scripts/sync-catalog-json-to-ts.py
python scripts/gen-craft-recipes.py
```

Confirm console: item count synced; recipe count includes your id in `craft_recipe_data.rs`.

Optional full manifest regen (xlsx source of truth): `python scripts/build-item-catalog.py` — then run the two commands above again.

## Step 3 — Icon

Path: **`apps/stick-web/public/icons/items/{slug}.png`** (96×96, magenta key).

```bash
python scripts/bake-item-icons.py
```

Or add art manually at the path referenced by `icon` in catalog.

## Step 4 — In-world visuals (equipped look)

In play, **`apps/stick-web/src/gear.ts`** → `gearArgs()` sends `(family, material, catalogId, …)` to WASM **`setGear`**. The **catalog id** is the stable look seed.

Choose one path:

### A — Pixel sword / dagger (most 1H blades)

No per-frame RON required in WASM. Wire **palette by catalog id** in Rust:

1. **`engine/ba-stick-render/src/gear.rs`** — `pub const YOUR_ITEM: u32 = <id>;`
2. **`engine/ba-stick-render/src/figure.rs`** — `pixel_sword_palette(item_id)` match arm for that id (copy layout from `Weapon::Sword` + `layout_1h()`).
3. Rebuild WASM (see Step 7).

Optional **gear viewer / wiki** (2D mesh preview):

- **`engine/ba-stick-render/assets/gear/ba_<slug>.ron`** — often copy sibling (e.g. `ba_iron_sword.ron`) with new `id`.
- **`apps/stick-web/src/pixel-sword.ts`** — `PIXEL_SWORD_GEAR_IDS`, `swordArtForGearId`, `SWORD_ART_COLORS`.
- **`apps/stick-web/src/gear-viewer-mesh.ts`** — mesh alias if capsules match a sibling.
- **`apps/stick-web/src/wiki-gear.ts`** — add `ba_<slug>` to `GEAR_RON_IDS`.
- **`apps/stick-web/src/gear-viewer.ts`** — material ramp if new palette name (e.g. `decayed`).

**Do not** assume WASM loads `ba_*.ron` for in-world draw — pixel path uses **id + palette**.

### B — Full 3D RON (helm, body, shield, …)

Follow **`.cursor/skills/stick-gear-ron/SKILL.md`**. Map catalog id in `gear.rs` / `figure.rs` (`helm_item`, `plate`, `vest`, etc.) as existing pieces do.

### C — Stats-only / reuse generic mesh

If look can stay generic, still set correct **`weaponFamily`** + **craftSkill** so `materialOf()` / `familyOf()` in `gear.ts` produce sane defaults. Unique art still needs Step 4A or 4B for player-visible difference.

## Step 5 — Combat & equip (usually automatic)

After regen, verify:

| Layer | What to check |
|--------|----------------|
| **`packages/combat/src/weapon-tokens.generated.ts`** | Main-hand id → `weaponFamily` |
| **`packages/items`** | `recipeMaterialsComplete`, `craftablesForSkill`, `aggregateEquipmentStats` |
| **Server** | `handleEquip` + `itemFitsEquipSlot`; **`send(p.ws, snapshotFor(p))`** after equip so client updates same tick |
| **Client** | `packages/client-core/src/state.ts` accepts same-tick snapshot when equip/inventory changed; **`StickWorld`** applies `setGear` when gear args change |

**Rings:** catalog slot `ring`; paperdoll also has **`ring2`**. Two copies in bag required for two rings (`canEquipAnotherCopy`).

## Step 6 — Tests (add or extend)

| Area | Example |
|------|---------|
| Craft wiki | `packages/items/src/craft-wiki.test.ts` — skill, level, mats slug |
| Gear args | `apps/stick-web/src/gear.test.ts` — `familyOf`, `gearArgs` seed |
| Pixel / RON | `gear-ron.test.ts`, `gear-viewer-mesh.test.ts`, `wiki-gear.test.ts` |
| Rust | `figure.rs` test — `WeaponLook::new(…, YOUR_ITEM)`, not great axe / wrong layout |
| Equip client | `packages/client-core/src/snapshot-equip.test.ts` pattern |

Run:

```bash
pnpm exec tsx --test src/craft-wiki.test.ts    # packages/items
pnpm exec tsx --test src/gear.test.ts          # apps/stick-web
cargo test -p ba_stick_render decayed_sword    # or your test name
```

## Step 7 — WASM rebuild (after Rust figure/gear changes)

```bash
# from engine/ (Windows: set CARGO_TARGET_DIR if needed)
cargo build --release --target wasm32-unknown-unknown -p ba_stick_render
wasm-bindgen --target web --out-dir ba-stick-render/pkg \
  target/wasm32-unknown-unknown/release/ba_stick_render.wasm
```

Or `pnpm --filter @bellgrave/stick-web wasm` when bash is available.

**Hard refresh** the browser so Vite loads new `engine/ba-stick-render/pkg`.

## Step 8 — Runtime verification

1. Restart **game server** (8787) after catalog/server changes.
2. **Vite** (5174) for UI + WASM.
3. Craft item in bonecraft (or relevant skill) — wiki and panel list recipe.
4. Equip — paperdoll + **world figure** update immediately (black/custom sword, not previous main).
5. Combat smoke: atk / weapon TP / job restrict if applicable.

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| Craft wiki empty / all recipes broken | `catalog.generated.ts` mojibake — regen with `sync-catalog-json-to-ts.py` UTF-8 |
| Recipe missing on chain log | Forgot `gen-craft-recipes.py` |
| Craft works, figure unchanged | Stale WASM; or same-tick snapshot dropped (server must push snapshot on equip); or wrong/missing `pixel_sword_palette` id |
| Looks like wrong weapon (e.g. axe) | Wrong `weaponFamily`; or dagger vs sword layout — add Rust test |
| Gear viewer wrong, in-game OK | Viewer-only paths (`pixel-sword.ts`, mesh alias) not updated |
| Ring 2 | Need second stack in bag; UI uses `RING_EQUIP_SLOTS` |

## Completion checklist

Copy and mark done:

```
- [ ] catalog.json entry (UTF-8 materialsText with ×)
- [ ] sync-catalog-json-to-ts.py + gen-craft-recipes.py
- [ ] icon at public/icons/items/{slug}.png
- [ ] weapon-tokens / craft-wiki tests pass
- [ ] Visual: Rust id constant + pixel_sword_palette (and/or RON + stick-gear-ron)
- [ ] wiki-gear + pixel-sword + viewer alias if sword-like
- [ ] WASM rebuilt; browser hard refresh
- [ ] In-game craft + equip + figure update verified
```

## Related skills

- **`stick-gear-ron`** — authoritative 3D gear RON authoring.
- **`stick-engine-maps`** — zones/NPCs (not items).

## Deep reference

Item-level file map for Decayed Sword: [reference-decayed-sword.md](reference-decayed-sword.md).
