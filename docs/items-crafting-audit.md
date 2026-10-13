# Items / crafting audit fixes (stacked on #212)

Applied from the Black Anvil crafting audit + 103-row stat CSV, plus support-review fixes for PR #222.

## Launch Items seed

- `LIVE_BASE_SLUGS` / `EXPORTABLE_BASE_SLUGS` = **24** Pale Hollow obtainable bases (23 live + `desiccated-hide`).
- Equipment has **no** chain Items id yet; log-bag export still uses catalog ids. `catalogIdToChainFungibleId` only resolves live bases (mint/withdraw path not wired).
- Heart Ring is goldsmithing **L12** (Rare) so it is obtainable on the live ladder.

## Engine craft validation

- Known catalog recipes require craft skill rank (`BadCraftLevel`) on **new appends** and logged crafts at/after the per-network cutoff.
- **Anvil / legacy local:** cutoff **175** (pre-#222 seq 0..=174 skip the check). **Chiado / Gnosis:** cutoff **0** (every logged craft validates). Override with `LOK_CRAFT_VALIDATE_MIN_SEQ`.
- Invalid `output_qty` is `BadCraftRecipe` (materials stay server-side so Harvest roots stay identical).
- Recipe table embeds `output_qty` for pack crafts; filler ladder recipes restored for progression past ~L10.
- `craft_refund` gold earns skip daily caps. Progress craft ranks sync into the log on character load.

## NPC sell prices

- Unit prices are **pinned** in `npc_price_data.rs` / `npc-sell-units.generated.ts` (Potion stays 20, etc.).
- `gen-npc-prices.mjs` keeps existing ids; only new catalog ids use `NPC_SELL_GOLD_BASIS=1000`.

## Server craft vs log

- `handleCraft` appends the Craft event **before** granting the item; on log refusal, materials undo and gold refunds via `craft_refund`.

## Replay

- Pre-#206 `ItemDrop` fixtures still credit under `HISTORICAL_ITEM_DROP_MAX_SEQ`.
- Ruleset hash is derived as `keccak256(utf8(LOCAL_RULESET_WASM_SHA256))` (`0x609dbdea…`). **Proposed on Gnosis** (tx `0x42ff771b…`, block 48729492, activatesAt 1792037555) — see `deployments/gnosis.json` on #221. Do not bump the pin without a new propose.
