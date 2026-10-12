# Economy: gold + WETH (EEZ), not KEK

Product direction for the gold/stable epic. Settlement asset is **WETH**, funded through **[eez-core-protocol](https://github.com/eez-association/eez-core-protocol)** so players can pay AH and PvP with ETH that never needs a long-lived “deposit into the game” balance.

## Locked here

| Role | Asset | Where it lives |
|------|--------|----------------|
| Training, crafting, respec, NPC shops, gold sinks | **Gold** | Log only (`Key` + earn/spend events). No token, no vault. |
| Auction house, player sends of settlement, PvP bounties | **WETH** (18 decimals) | Escrow / settle on the game rollup; player ETH stays on L1 (or home rollup) until an EEZ sync call moves value for that action. |

- No new game token.
- No USDT0 / Robinhood-KEK as the AH unit.
- Gold never converts directly to WETH. Bridge is **item → AH → WETH** (or PvP payout in WETH).
- Existing KEK log events keep their meaning for replay; new gold / WETH events only. Fresh log + anvil wipe on the batched redeploy.

## Why EEZ

[eez-core-protocol](https://github.com/eez-association/eez-core-protocol) is sync-rollup infrastructure: L1 `EEZ.sol` tracks per-rollup roots and **ETH accounting** (`etherDelta`); batches prove and execute cross-chain calls that can carry **`value`**. Atomic L1↔rollup (and rollup↔rollup) calls in one L1 block mean a wallet can bid or stake using ETH that still lives on L1 / another EEZ rollup, without a separate custodial deposit UX into `KekVault`.

Intended player story:

1. Hold ETH on L1 (or an EEZ-connected home chain).
2. Open AH bid / PvP bounty from the client.
3. Wallet signs one flow that EEZ executes as a sync cross-chain call with value (wrap to WETH on the game side if the settle surface is ERC-20).
4. Escrow holds WETH for the listing / match duration; settle or cancel releases it. No “park KEK in Bellgrave for days” step to play the market.

Caveats (do not paper over):

- EEZ is **early-stage, unaudited**; interfaces and storage layout are still in flux (upstream README).
- Upstream `src/periphery/` (Bridge, WrappedToken, defi mocks) is **test-only**, not a production bridge. Game-facing wrap/escrow must be first-party contracts we own, composed with EEZ managers — not a copy of periphery as if it were supported product.
- Multi-chain still means deploying / registering Bellgrave on each EEZ-connected domain we care about; WETH+EEZ removes the Robinhood-KEK token lock-in, not the need for rollup registration and watchers.

## How this reshapes lok-log

### Keep for replay (do not reinterpret)

`DepositKek`, `WithdrawKek`, `SpendKek`, `SendKek`, vault caps, inbound nonces — leave serialization and meaning alone for historical fixtures. After the wipe, new play does not credit KEK for AH/PvP.

### Replace for new play

| Old (KEK era) | New |
|---------------|-----|
| Trainer / craft / respec → `spendKek` | → gold spend events (E1) |
| AH list/bid/settle / `SendKek` in KEK | → WETH escrow + settle; engine events for WETH balances/escrow (new events if meaning changes) |
| `KekVault` deposit watcher as the only inbound | → EEZ-funded WETH escrow; optional short-lived rollup WETH balance if needed for UX, not a deposit-only KEK vault |
| PvP stakes | → WETH via same escrow path |

### Engine / ruleset

- New gold `Key` (next free tag after CraftSkill 13 / Drop 14) and gold events as in the epic (E1).
- WETH settlement events are separate from gold; no gold `Send` in v1.
- Bump `LOCAL_RULESET_HASH` + wasm pin together with the wipe (E7).
- AH fee: still an open decision; if yes, fee is in WETH and CONTRACTS.md must say so.

## Integration sketch (implementation order)

1. **Docs / CONTRACTS.md** — this file; unlock KEK-as-spend; lock gold + WETH + EEZ (done).
2. **E1 gold ledger** — engine `GoldEarn` / `GoldSpend` / `GoldSell` with daily caps; trainer, craft, and respec spend gold; harvest credits a placeholder gold faucet (tune in E5).
3. **Game-side WETH escrow** — first-party contracts: bid/list/PvP stake hold WETH; settle pays seller / winner. Prefer WETH ERC-20 on the game rollup for AH book math; wrap native `value` from EEZ calls at the edge.
4. **EEZ wiring** — register Bellgrave rollup (or host AH/PvP contracts where EEZ can target them); client builds sync calls so L1 ETH funds escrow without a pre-deposit. Do not depend on upstream periphery Bridge for production.
5. **Engine log** — append-only WETH credit/debit/escrow events mirroring on-chain escrow outcomes the server is allowed to trust (same discipline as today’s deposit watcher: client cannot invent custody).
6. **Anvil / EEZ e2e** — deposit-free bid → settle → seller can exit value back via EEZ; golden replay of gold + WETH fixtures on a fresh log.

## Open decisions (unchanged or narrowed)

1. Character creation path (E4) — ETH mint fee vs gold for #2+.
2. AH fee yes/no and size (WETH if yes).
3. ~~Stable and chain~~ → **closed: WETH + EEZ**, not USDT0/KEK.
4. Gold per character or per account.
5. NPC buy-back % and daily caps (E3, E5).
6. Whether any **persistent** rollup WETH balance is allowed for convenience, or every AH/PvP action is strictly pull-from-L1-via-EEZ at action time (stricter “never move into the game”).

## Done when

Gold earns/spends/NPC-sells in the log with caps; AH and PvP settle in WETH funded by EEZ sync value (no KEK vault play path); fresh-log anvil (+ EEZ e2e when available) replays clean; CONTRACTS.md matches this doc.
