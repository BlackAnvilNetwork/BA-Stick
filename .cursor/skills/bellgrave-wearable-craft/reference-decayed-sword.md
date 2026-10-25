# Reference: Decayed Sword (1064)

Use as a file touch-list when adding a similar **bonecraft main-hand sword**.

## Catalog & regen

| File | Role |
|------|------|
| `packages/items/src/catalog.json` | Source entry |
| `packages/items/src/catalog.generated.ts` | Auto — `sync-catalog-json-to-ts.py` |
| `packages/combat/src/weapon-tokens.generated.ts` | Auto — main → `sword` |
| `contracts/lok-log/engine/src/craft_recipe_data.rs` | Auto — `gen-craft-recipes.py` |

## Game logic (no item-specific code required if stats/slots are generic)

| File | Role |
|------|------|
| `packages/items/src/index.ts` | `aggregateEquipmentStats`, craft helpers |
| `apps/server/src/index.ts` | `handleEquip`, `snapshotFor` after equip |
| `packages/client-core/src/state.ts` | Same-tick equip snapshot merge |
| `apps/stick-web/src/StickWorld.tsx` | `gearArgs` → `setGear` on change |

## In-world + viewer art

| File | Role |
|------|------|
| `engine/ba-stick-render/src/gear.rs` | `DECAYED_SWORD_ITEM = 1064` |
| `engine/ba-stick-render/src/figure.rs` | `pixel_sword_palette` arm (all-dark palette) |
| `engine/ba-stick-render/assets/gear/ba_decayed_sword.ron` | Viewer/wiki; copy of iron sword layout, new `id` |
| `apps/stick-web/src/gear.ts` | `familyOf` → sword; `materialOf` → bonecraft → bone mat |
| `apps/stick-web/src/pixel-sword.ts` | `ba_decayed_sword`, `decayed` colors |
| `apps/stick-web/src/gear-viewer-mesh.ts` | `ba_decayed_sword: "ba_iron_sword"` |
| `apps/stick-web/src/gear-viewer.ts` | `decayed` material ramp `#18161f` |
| `apps/stick-web/src/wiki-gear.ts` | `GEAR_RON_IDS` |

## Tests

| File | Asserts |
|------|---------|
| `packages/items/src/craft-wiki.test.ts` | bonecraft, L2, dustgrain×5 |
| `apps/stick-web/src/gear.test.ts` | sword family, seed 1064 |
| `apps/stick-web/src/gear-ron.test.ts` | same capsules as iron sword |
| `apps/stick-web/src/gear-viewer-mesh.test.ts` | mesh alias |
| `apps/stick-web/src/wiki-gear.test.ts` | `gearRonForSlug` |
| `engine/ba-stick-render/src/figure.rs` | `decayed_sword_is_one_hand_sword_not_great_axe` |

## Commands (typical session)

```bash
python scripts/sync-catalog-json-to-ts.py
python scripts/gen-craft-recipes.py
pnpm exec tsx --test src/craft-wiki.test.ts          # packages/items
pnpm exec tsx --test src/gear.test.ts               # apps/stick-web
cargo test -p ba_stick_render decayed_sword
# WASM rebuild — see SKILL.md Step 7
```
