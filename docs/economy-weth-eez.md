# Economy: gold + WETH (EEZ), not KEK

Product direction for the gold/stable epic. Settlement asset is **ETH** (wei; WETH only as a wrap/unwrap convenience), paid **only** through **[eez-core-protocol](https://github.com/eez-association/eez-core-protocol)** sync calls into first-party escrow. The character log does not custody funds — no vault deposit path. Deep dive: [`docs/eez-ah-research.md`](eez-ah-research.md).

## Locked here

| Role | Asset | Where it lives |
|------|--------|----------------|
| Training, crafting, respec, NPC shops, gold sinks | **Gold** | Log only (`GoldEarn` / `GoldSpend` / `GoldSell`). No token, no vault. |
| Auction house, PvP bounties | **ETH** (18 decimals wei) | **On-chain only** via EEZ sync `value` into first-party escrow. The log does **not** custody ETH. |

- No new game token.
- **No player vault deposit** — not even as a fallback. The log governs the game (items, gold, character); the chain governs funds.
- No USDT0 / Robinhood-KEK as the AH unit.
- Gold never converts directly to ETH. Bridge is **item → AH (chain pay) → ETH**.
- Existing KEK log events keep their meaning for replay only. Fresh log + anvil wipe on the batched redeploy.

## Why EEZ

[eez-core-protocol](https://github.com/eez-association/eez-core-protocol) is sync-rollup infrastructure: L1 `EEZ.sol` tracks per-rollup roots and **native ETH** (`etherBalance` / `etherDelta`); batches prove and execute cross-chain calls that can carry **`value`**. Atomic L1↔rollup calls in one L1 block mean a wallet can fill an ask from home-chain ETH without a prior vault deposit. Details and UX options: [`eez-ah-research.md`](eez-ah-research.md).

Intended player story (north star):

1. Hold ETH (or WETH to unwrap) on L1 or another **EEZ-zone** chain.
2. Click **Buy** on an ask; client picks the funded home chain.
3. One sync transaction: proxy call with `value` = price → `AhEscrow` fills on the game domain; item to buyer, ETH to seller (ideally seller’s home chain in the same batch).
4. No deposit / watcher / park step. Non-zone funds: player brings ETH into the zone themselves — we never custody it on the log.

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
| `KekVault` deposit watcher / log settlement balance | → **Removed.** EEZ + first-party `AhEscrow` only; log mirrors **item** outcomes, never spendable ETH |
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
4. **AhEscrow + EEZ** — `AhEscrow.sol` `buyAsk{value}` (done); register Bellgrave rollup and client sync calls so L1 ETH funds the fill. Do not depend on upstream periphery Bridge.
5. **Engine log** — `chainFill` mirrors item inbox only after a trusted `AskFilled` (done). No spendable ETH on the log. Client cannot invent custody.
6. **Anvil / EEZ e2e** — sync buy with `value` → item to buyer / ETH to seller; golden replay of gold + historical KEK fixtures on a fresh wipe.

## Open decisions (unchanged or narrowed)

1. Character creation path (E4) — **native ETH** mint fee via `CharacterFactory`
   (`msg.value`, same unit as AhEscrow/EEZ — not WETH). Mint-first: pay then
   spawn with the minted token id (`createCharacterFor` for log-bound retries).
2. AH fee yes/no and size (WETH if yes).
3. ~~Stable and chain~~ → **closed: WETH + EEZ**, not USDT0/KEK.
4. Gold per character or per account.
5. NPC buy-back % and daily caps (E3, E5).
6. Whether any **persistent** rollup WETH balance is allowed for convenience, or every AH/PvP action is strictly pull-from-L1-via-EEZ at action time (stricter “never move into the game”).

## Done when

Gold earns/spends/NPC-sells in the log with caps; AH and PvP settle in ETH funded by EEZ sync value with **no** vault deposit; the log never holds spendable settlement ETH; fresh-log anvil (+ EEZ e2e when available) replays clean; CONTRACTS.md matches this doc.
