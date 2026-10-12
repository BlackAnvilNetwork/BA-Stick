# EEZ × Auction house — research and UX

How [eez-core-protocol](https://github.com/eez-association/eez-core-protocol) can let players **buy AH listings with ETH that still sits on L1 (or another EEZ rollup)**, without a long-lived “deposit into Bellgrave” step. Complements `docs/economy-weth-eez.md`.

Sources: upstream `docs/CORE_PROTOCOL_SPEC.md`, `docs/CAVEATS.md`, `src/periphery/Bridge.sol` (test-only), e2e `bridge` scenario, [EVMcrispr EEZ guide](https://next-docs.evmcrispr.com/guides/eez/).

---

## 1. What EEZ is (and is not)

EEZ is **sync-rollup composability** for based rollups that share an L1 sequencer:

- State transitions are pre-computed off-chain, proven, then executed on L1 via `postAndVerifyBatch`.
- Cross-chain calls run **atomically with the sending side** inside one L1 block (same-tx UX when the RPC/composer path is wired).
- Identity across chains is a **deterministic `CrossChainProxy`** per `(address, rollupId)`. On the far chain, `msg.sender` is that proxy, not the EOA.

It is **not**:

- A game escrow or marketplace product.
- A general bridge to arbitrary L2s (only EEZ-registered rollups in the same economic zone).
- Production-ready: early-stage, unaudited; interfaces still in flux (upstream README).

Upstream `src/periphery/` (Bridge, WrappedToken, defi mocks) is **explicitly test-only** and outside audit scope. Do not ship it as Bellgrave’s custody layer.

---

## 2. How value moves (critical for AH)

### Native ETH is the protocol unit

L1 `EEZ.sol` tracks per-rollup:

- `etherBalance` — ETH held on behalf of that rollup  
- `RollupUpdate.etherDelta` — signed ETH change for an entry  

Cross-chain calls carry `uint256 value`. Successful outbound value transfers adjust `_entryEtherDelta`; at entry end, `totalEtherDelta` must match (`EtherDeltaMismatch`). Static calls **cannot** carry value (`StaticCallWithValue`).

So the sync path the protocol actually optimizes is:

> **Wallet / contract on chain A pays `msg.value` → proxy → destination on chain B receives ETH in the same sync window.**

### WETH is a product choice on top

If a player “has WETH” on an EEZ-connected chain:

1. **Best for EEZ:** unwrap WETH → native ETH, then sync-call with `value` (matches protocol accounting).
2. **ERC-20 path:** lock/mint style `bridgeTokens` exists only in **test periphery**; if we need ERC-20 settlement on the game rollup, we own a first-party wrap/escrow that mints/wraps **after** native ETH arrives, or we accept a separate non-EEZ bridge for foreign WETH.

Product language “ETH for AH” matches the protocol better than “must be WETH ERC-20 everywhere.” Keep 18-decimal wei math either way.

### What “without moving it into the game” means

| Myth | Reality |
|------|---------|
| ETH never leaves L1 | For a buy, value **does** transfer into the rollup’s EEZ ETH accounting for that entry; it is not a free remote charge on L1 balance without effect. |
| No escrow needed | Listings still need item escrow; fills still need payment to land somewhere. |
| Works from any chain with WETH | Only **EEZ-connected** domains in the zone. Arbitrary Arbitrum/Base WETH needs a classic bridge (or that chain joining EEZ). |

Honest framing: **no pre-deposit / no park-for-days vault balance.** The buy itself is the transfer, atomically with the fill.

---

## 3. Mapping onto Bellgrave AH

Today (engine): asks escrow **items**; bids/fills debit the settlement balance (`Key::Kek`, product = ETH). Server appends log events after custody moves.

Target with EEZ:

```
Home chain (L1 or rollup H)          Bellgrave game rollup (G)
───────────────────────────          ─────────────────────────
Player EOA / Safe                    AhEscrow + item escrow
     │                                      ▲
     │  sync call + value                   │
     └──► CrossChainProxy(G) ───────────────┘
              msg.sender = PlayerProxy_H
              pays ask, receives item credit
```

**Buyer identity on G** is the buyer’s cross-chain proxy for home rollup H. Character binding must accept “wallet W on H” ↔ `tokenId` (NFT owner or signed link), and AH must treat `msg.sender == proxy(W,H)` as W.

**Seller** listed on G already (items escrowed on G). On fill:

- Preferred UX: same batch pays seller’s home-chain wallet (or seller proxy on H) with ETH — buyer never left a balance on G, seller never had to withdraw from G.
- Simpler v1: ETH credits seller’s spendable settlement on G; seller withdraws / sync-sends home later.

**Log:** on-chain fill is source of truth for custody; server appends a new settlement event (or watches a first-party escrow) — client still cannot invent credits (#206 discipline). Fresh wipe + ruleset bump when this ships.

---

## 4. UX options (best → fallback)

### A. One-click “Buy with ETH on &lt;chain&gt;” (recommended north star)

1. Client shows ask in ETH; detects which EEZ-connected chain holds enough **native ETH** (and offers unwrap if balance is WETH-only).
2. Optional: sync **static** read of ask validity / remaining qty (`staticCrossChainCall` / `@eez:on` style) before sending.
3. User signs **one** home-chain transaction:
   - Wallet path: `eez:on` / proxy call with `--value` (EVMcrispr model), or  
   - App path: our relay+composer posts the batch after an EIP-712 intent + permit/session.
4. Atomic result: ask filled, item in inbox/bag binding, ETH to seller (home or G), **no deposit UI**.
5. Failure: whole entry reverts — no half-fill, no stranded park (composer eviction / entry revert semantics).

**Why best:** Matches how EEZ is sold (atomic cross-chain in one tx). Removes vault mental model for buyers. Sellers can still list from in-game.

### B. Intent + relayer (best when wallets lack EEZ)

User signs “buy listing X max price P from chain H.” Relayer/composer builds the EEZ batch, funds gas, pulls value from user’s home balance (or user pre-approves a pull contract). Same atomic settle as A; worse trust/ops until decentralized.

### C. Quote → confirm (two-step, still no deposit)

Static cross-chain quote of book → modal “Pay 0.02 ETH from Ethereum” → mutable sync fill. Slightly more clicks; clearer for first-time users; still no vault.

### D. Outside the EEZ zone (no deposit fallback)

| Player funds | Path |
|--------------|------|
| ETH on EEZ home (L1 / zone rollup) | A / B sync buy |
| WETH on EEZ home | Unwrap helper in the same batch, then A |
| WETH / ETH **outside** the zone | Player moves ETH onto a zone chain themselves (wallet/bridge of their choice). **We do not offer a game vault deposit.** |

### E. What not to build

- **Park then play:** deposit → watcher → bid. **Removed.** The log does not custody player ETH.
- **Deposit fallback for “other chains.”** **Removed.** Zone membership (or the player bridging in) is the gate.
- **Pretend periphery Bridge is production.** Own `AhEscrow` that accepts `value` from proxies.
- **Reinterpret old `bid`/`depositKek` meaning** — wipe + ruleset bump; Kek names stay for replay only.

---

## 5. Better overall UX enabled by EEZ (beyond AH buy)

If sync calls are first-class, several surfaces get simpler:

1. **AH buy (above)** — biggest win vs deposit UX.  
2. **AH sell payout** — pay seller on their home chain in the fill batch (no “claim vault”).  
3. **PvP bounty** — stake from home ETH; release/slash atomically with match result posting.  
4. **Character mint fee** — keep 0.001 ETH on L1 factory; gold only for extra slots (E4 option 1), consistent with “ETH stays where it is until the action.”  
5. **Cross-chain read of bag / asks** — static calls for “can I afford this?” without a tx.  
6. **Safe / smart-account whales** — assert home balance then act (EVMcrispr Safe pattern); good for high-value listings.

Gold stays log-only for training/craft — EEZ does not need to touch it.

---

## 6. Constraints to design around

| Constraint | Implication |
|------------|-------------|
| Same-zone based rollups only | Product copy: “Buy with ETH on Ethereum / &lt;zone L2&gt;”, not “any WETH”. |
| Composer + prover required | Browser wallets need EEZ RPC/composer or our relayer; plain `eth_sendTransaction` to a foreign AH address is not enough. |
| Proxy `msg.sender` | Auth and character binding must understand proxies; never assume EOA == `msg.sender` on G. |
| Static ≠ value | Price checks can be static; payment cannot. |
| Gas / nesting cost | Deep L1↔L2↔L1 hops get expensive; keep buy path to one hop when possible. |
| Unaudited / flux | Feature-flag EEZ buys until zone + `AhEscrow` are production; do **not** re-enable vault deposit while waiting. |
| L2 funding inventory | Node/circuit policy for pooled ETH — ops concern when Bellgrave is the L2. |
| Log must not hold spendable ETH | AH/PvP payment never credits `Key::Kek` for new play; item escrow and gold stay on the log. |

---

## 7. Recommended Bellgrave shape

**Locked:** no player vault deposit/withdraw/send-ETH. Log = game; chain = funds.

**Phase 0 (now):** Gold sinks; refuse client deposit/withdraw/send-ETH/log-balance buy/bid; docs lock EEZ-only pay.

**Phase 1 — first-party `AhEscrow` on game domain:**  
`buyAsk{value}` / `fillAsk{value}` keyed by buyer proxy; item out on log; ETH never enters the log as a balance. Mirror fill **item** effects with new events if needed.

**Phase 2 — EEZ sync buy from L1 (or home rollup):**  
Client “Pay from Ethereum”; unwrap WETH if needed; one sync call with value.

**Phase 3 — seller home payout + PvP stakes** in the same batch model.

**Phase 4 — EEZ zone expansion** as more rollups register; still no claim of universal WETH.

---

## 8. Open product questions

1. Is Bellgrave’s AH escrow on an **EEZ L2** we register, or on **L1** with rollups as homes? (L2-game + L1-home is the natural “play on L2, pay from L1 ETH” story.)  
2. Seller payout: always home-chain, or opt-in?  
3. Relayer vs wallet-native EEZ for v1.  
4. AH fee in ETH (still undecided in CONTRACTS.md).  
5. Character ↔ proxy binding ceremony (NFT owner on which chain?).

---

## 9. Done when (EEZ AH slice)

- Research accepted; **deposit path removed** from product (this doc + CONTRACTS.md).  
- `AhEscrow` accepts native ETH from EEZ proxies and settles an ask atomically.  
- Client can complete a buy from L1 ETH with **no** vault deposit (devnet).  
- Log never holds a spendable settlement balance for new play.  
- Ruleset/wipe without reinterpreting historical KEK events.
