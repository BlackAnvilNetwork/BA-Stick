# Locked product decisions

These decisions are locked for the lok-log package.

## Current lock (gold + WETH / EEZ)

- **Two units.** **Gold** is in-game only (log counter). **WETH** is the settlement asset for the auction house, settlement sends, and PvP bounties. There is no new game token. Gold never converts directly to WETH; the route is item → AH → WETH.
- **Gold** funds training, crafting, respec, NPC shops, and other soft sinks. It enters via quests, drops, harvest, and NPC buy-back. It has no vault path and no player-to-player `Send` in v1. Earn/spend use new log events only (see `docs/economy-weth-eez.md` and epic E1).
- **ETH** is the AH / PvP / player-send unit (18-decimal wei). EEZ’s protocol unit is **native ETH call `value`**, not ERC-20 WETH (unwrap WETH on the home chain when needed). Engine event names (`depositKek`, `sendKek`, `bid`, …) and `Key::Kek` stay for replay. Zone buyers should fund fills via EEZ sync calls without a long-lived vault park; deposit remains a fallback for non-zone funds. See [`docs/eez-ah-research.md`](../../docs/eez-ah-research.md). Trainer / craft / respec spend **gold**, not ETH.
- **EEZ caveats are binding.** Upstream is early-stage and unaudited. Upstream `src/periphery/` (Bridge, WrappedToken, defi mocks) is test-only and must not be treated as the production bridge. Game-facing wrap/escrow contracts are first-party.
- **In-game transfers and the auction house remain lok-engine log events** for balances the engine tracks. Listing still escrows the item in the log so it cannot be transferred, exported, or listed again until cancel or settle. On-chain WETH escrow must stay consistent with those events; the client cannot invent custody.
- **Goal:** prove in-game events cheaply with an event-sourced rules engine and a hash-chained log. Gold is mintable only by engine rules (faucets with daily caps). WETH enters via EEZ-funded escrow (and any explicit wrap path we own). Items can still be minted out as NFTs (exports) and brought back (import).
- **New events only.** Do not change the meaning or serialization of any existing event. Historical KEK events stay for replay of old fixtures. Fresh log + anvil wipe on the batched redeploy; bump `LOCAL_RULESET_HASH` and the wasm pin together.
- **AH fee:** still undecided. The previous lock said “no auction fee.” If a fee ships, it is in WETH and this file must be updated before merge.
- **Known MVP limits** stay as the package README already states: no k-of-n signer threshold, no fraud proofs, no on-chain Merkle proof yet, and unique-item supply of 1 is not enforced in the items contract.

Design narrative and implementation order: [`docs/economy-weth-eez.md`](../../docs/economy-weth-eez.md).

## Superseded (KEK deposit era — replay only)

These applied to the KEK vault play path. They remain true for **replaying committed KEK events** and for code that has not yet been migrated. They are **not** the target product for new AH/PvP/training spend.

- KEK was deposit-only from Robinhood L2 (`0x5a3544a0328afD50A9979e03404F35c555B88c00`), not earnable in-game, no faucet. Trainer and craft spent deposited KEK via `spendKek`. Dust was not the spend currency.
- `KekVault` per-token withdrawal caps, 24h default delay (1h–30d admin bounds), inbound nonces shared by `depositKek` / on-chain `importItem`, bag imports outside `inboundConsumed`, and “no client `lok/deposit`” were the custody rules for that era.
- `lok/withdrawKek` stayed disabled on the server while the engine `WithdrawKek` op remained.

Do not reinterpret those events. Do not extend the KEK play path for AH or PvP.

---

This directory is a standalone Foundry project. It is not a pnpm workspace package. The game (`apps/*`, `packages/*`) does not compile these Solidity files.
