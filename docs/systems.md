# Systems map

Start at the root [`README.md`](../README.md). This file names what each system owns and the file to open first. It does not deploy, propose a ruleset, or copy chain addresses.

| System | Open first | Owns |
| --- | --- | --- |
| Client | `apps/web/src/main.tsx` | React + Vite app. `apps/web/src/App.tsx` connects the socket and mounts the R3F scene in `apps/web/src/WorldScene.tsx`. |
| Client ↔ server | `apps/web/src/net.ts` | WebSocket JSON to `ws://<page-host>:8787` (override `VITE_WS_URL`). Messages are `@bellgrave/protocol` types from `packages/protocol/src/index.ts`. |
| Server loop | `apps/server/src/index.ts` | WebSocket server on port 8787 (`PORT`). `setInterval(tickSim, TICK_MS)` at 20 Hz (`TICK_HZ` in `packages/config/src/index.ts`). |
| Protocol | `packages/protocol/src/index.ts` | Zod `ClientMessageSchema` for client messages. `ServerMessage` is a TypeScript union in the same file. |
| Combat math | `packages/combat/src/index.ts` | Shared formulas and job kits. Kits live in `packages/combat/src/*-kit.ts`. Job list: `packages/combat/src/jobs.ts`. |
| Items | `packages/items/src/index.ts` | Item catalog (stats, craft, icons). Read [`packages/items/README.md`](../packages/items/README.md). |
| Config | `packages/config/src/index.ts` | Tick rate, hall, zones. Network profiles: `packages/config/src/network-profile.ts`. Campaign data: `packages/config/src/world.ts`. |
| Character log | `contracts/lok-log/engine/src/world.rs` | Rust `World`: one hash chain per character. `contracts/lok-log/engine/src/engine.rs` applies inputs for one character. |
| Engine wasm | `contracts/lok-log/engine/pkg/lok_engine.wasm` | Bundle the server loads. Loader: `apps/server/src/lok-engine.ts`. Game API: `apps/server/src/lok-world.ts` (`LokWorld`). |
| Ruleset pin | `apps/server/src/lok-vault.ts` | `LOCAL_RULESET_WASM_SHA256` is the checked-in wasm digest. A Gnosis ruleset propose can be stale relative to this pin. Read `deployments/gnosis.json` for the recorded propose. This map does not deploy or submit one. |
| Gold | `contracts/lok-log/engine/src/gold.rs` | In-game log currency (daily earn caps, spend, NPC sell). Not a token and not transferable. Server lock: `apps/server/src/gold-guard.ts`. Writes: `LokWorld.goldEarn`, `goldSpend`, `goldSell`. |
| KEK | `apps/server/src/lok-world.ts` | Custody is retired (`depositKek`, `withdrawKek`, `spendKek`, `sendKek`, and KEK-priced `fill` / `buy` return that). Historical events stay for replay. See [`contracts/lok-log/CONTRACTS.md`](../contracts/lok-log/CONTRACTS.md). |
| Bag ↔ log | `contracts/lok-log/engine/src/event.rs` | `Input::BagImport` and `Input::BagExport` move stacks between the bag and the log. They are not checkpoint mints. Server: `LokWorld.importFromBag`, `LokWorld.bagExport`. Play path: `handleLokImport` / `handleLokExport` in `apps/server/src/index.ts` (client `lok/import`, `lok/export`). |
| Chain item withdrawal | `LokWorld.exportItem` in `apps/server/src/lok-world.ts` | `Input::ExportItem` debits the log and is packed into checkpoint `exports`. `CharacterCheckpoint.exportsEnabled` defaults to false (`contracts/lok-log/src/CharacterCheckpoint.sol`). The play-path export calls `bagExport`, not `exportItem`. The progress reconciler's `exportItem` callback is also wired to `bagExport`. |
| Auction house | `apps/server/src/ah-escrow.ts` | Watches `AskFilled` and mirrors items with `LokWorld.chainFill`. Book asks: `LokWorld.ask`, then `openAskOnchain` in `apps/server/src/ah-escrow-tx.ts`. Contract: `contracts/lok-log/src/AhEscrow.sol`. Payment is on-chain native value; the log does not credit it. |
| Checkpoint | `contracts/lok-log/src/CharacterCheckpoint.sol` | One state root and log position per character. Item chain import is `importItem` (separate from bag import). Ruleset record: `contracts/lok-log/src/RulesetRegistry.sol`. ERC-1155: `contracts/lok-log/src/Items.sol`. |
| Character NFT | `contracts/lok-log/src/CharacterNFT.sol` | Ownership token. Mint path: `contracts/lok-log/src/CharacterFactory.sol`. Server: `apps/server/src/lok-vault.ts` (`linkCharacterNft`, `serverMintCharacterFor`, `readCharacterNftOwner`, `verifyCharacterNftOwner`). |
| Ownership gate | `apps/server/src/nft-owner-cache.ts` | Cached `ownerOf`. `requireLiveCharacterOwner` in `apps/server/src/index.ts` calls `sessionOwnsCharacter` for play messages other than `move`, `disengage`, `lok/explore`, and `party/*`. There is no `mint-link.ts`; coverage is `apps/server/src/mint-link.test.ts`. Local mint steps: [`docs/local-character-mint.md`](local-character-mint.md). |
| Character saves | `apps/server/src/player-progress.ts` | Bag, level, XP, equipment, learned abilities. Files: `<dataDir>/players/<charId>.json`, written by `rememberPlayer` in `apps/server/src/index.ts`. |
| Log persistence | `apps/server/src/lok-world.ts` | `lok-world.json`, `lok-world.jsonl`, and `lok-bind.json` under `defaultLokDir()` (`LOK_DATA_DIR`, or a `data` directory created next to the server at runtime). Snapshots and the other durable files go through `apps/server/src/durable-write.ts` (fsync, then rename). The journal fsyncs its own fd in `flushJournal`. |
| Campaign world | [`docs/world.md`](world.md) | Area/city order and replay rule. Data: `packages/config/src/world.ts`. Pale Hollow sim: `apps/server/src/pale-hollow-world.ts`. Layout data: `packages/config/src/pale-hollow.ts`. |
| Jobs / abilities | `packages/combat/src/jobs.ts` | Seven playable jobs. Server modules: `apps/server/src/tim-abilities.ts` (Time Mage), `apps/server/src/knight-abilities.ts`, `apps/server/src/rogue-abilities.ts`, `apps/server/src/cleric-abilities.ts`, `apps/server/src/sorcerer-abilities.ts`, `apps/server/src/fighter-abilities.ts`, `apps/server/src/battlemage-abilities.ts`. `apps/server/src/weapon-tp-abilities.ts` is shared weapon TP, not a job. |
| Chain config | `packages/config/src/network-profile.ts` | `gnosis` / `chiado` / `anvil` profiles. Gnosis `deployFile` is empty. Chiado names `deployments/chiado.json`, which is not in the repo. `apps/server/src/settlement-deploy.ts` fills blank `LOK_*` from a deploy JSON on chain 100 or 10200 only when that file exists, and it skips a `dry-run-only` file unless `LOK_ALLOW_DRY_RUN_DEPLOY=1`. Read `deployments/gnosis.json` and `deployments/gnosis-dryrun.json` in place. Runbooks: [`docs/gnosis-launch.md`](gnosis-launch.md), [`docs/mainnet-plan.md`](mainnet-plan.md). |

## Docs (do not restate)

- Engine and contracts: [`contracts/lok-log/engine/README.md`](../contracts/lok-log/engine/README.md), [`contracts/lok-log/README.md`](../contracts/lok-log/README.md), [`contracts/lok-log/CONTRACTS.md`](../contracts/lok-log/CONTRACTS.md)
- Economy and AH: [`docs/economy-weth-eez.md`](economy-weth-eez.md), [`docs/eez-ah-research.md`](eez-ah-research.md), [`docs/eez-sync-buy.md`](eez-sync-buy.md)
- Launch: [`docs/gnosis-launch.md`](gnosis-launch.md), [`docs/mainnet-plan.md`](mainnet-plan.md), [`docs/chiado-deploy.md`](chiado-deploy.md)
- World and items: [`docs/world.md`](world.md), [`docs/pale-hollow-area.md`](pale-hollow-area.md), [`packages/items/README.md`](../packages/items/README.md), [`docs/items-crafting-audit.md`](items-crafting-audit.md)
- Names: [`docs/black-anvil-rebrand.md`](black-anvil-rebrand.md)

`contracts/README.md` still calls inventory a mock stub. That is not the live model. Use `contracts/lok-log/`.

`docs/pale-hollow-area.md` still says crafting burns KEK. Live sinks spend gold (`contracts/lok-log/engine/src/gold.rs`, `LokWorld.goldSpend`).
