# Items / crafting audit fixes (stacked on #212)

Applied from the Black Anvil crafting audit + 103-row stat CSV.

## Launch Items seed

- `LIVE_BASE_SLUGS` / `EXPORTABLE_BASE_SLUGS` = **24** Pale Hollow obtainable bases (23 live + `desiccated-hide`).
- Equipment is **not** chain-exportable at launch (`isLaunchExportableEquipment` → false). Unique instance ids deferred.
- Server export maps catalog id → `catalogIdToChainFungibleId` for live bases; equipment stays log-local.

## Engine craft validation

- Known catalog recipes require craft skill rank (`BadCraftLevel`).
- Unknown item ids stay counter-only (tests / legacy).
- **Material burn** stays server-authoritative so committed historical `Harvest` state roots remain bit-identical. Recipe table embeds `output_qty` for pack crafts.

## Replay

- Pre-#206 `ItemDrop` fixtures still credit under `HISTORICAL_ITEM_DROP_MAX_SEQ`.
- Local ruleset hash + wasm pin bumped with this engine change.
