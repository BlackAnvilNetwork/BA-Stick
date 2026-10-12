# Mainnet plan (PR #212 → Ethereum L1 settlement)

**Status:** planning + redeploy-ready escrow/app work; **no deploy / no merge** without go-ahead.  
**Hard stops:** no merge to `main`; no shared-anvil or mainnet redeploy without explicit user go-ahead.  
**Credentials:** operator keys / `PRIVATE_KEY` / WalletConnect project ids live in gitignored `.env` only — never commit.

## Settlement domain (locked)

**Ethereum mainnet (L1)** is Bellgrave’s settlement domain. These live on L1:

| Contract / surface | On L1 |
|--------------------|-------|
| `CharacterNFT` | yes |
| `CharacterFactory` (mint fee) | yes |
| `AhEscrow` (AH pay / 1% fee) | yes |
| Item exports (checkpoint → ERC-1155 mint to `ownerOf`) | yes |
| `CharacterCheckpoint` + `RulesetRegistry` | yes |

Players with an **Ethereum home wallet** for v1 never leave L1 for mint or buy: those are **plain same-chain txs**. They do **not** need EEZ. EEZ is reserved for **future L2 home chains** that must reach L1 escrow/mint without a vault deposit.

The **game log** (items, gold, character progress) stays on the **server** and is **anchored** to L1 via signed checkpoints (see §3c).

---

## Design rules (locked)

| # | Rule | v1 (Ethereum home) | Later (L2 home) |
|---|------|--------------------|-----------------|
| 1 | Character creation reads the connected address, takes the ETH mint fee, mints NFT to that address | **Same-chain** `createCharacterFor{value}` on L1 | EEZ sync `value` → L1 factory |
| 2 | Listing seller = current `ownerOf(character)`; owner change **cancels** open listings (cancel-only) | unchanged | unchanged |
| 3 | Buys paid from buyer’s home; seller paid at **current `ownerOf`** at fill | **Same-chain** `buyAsk{value}` on L1 | EEZ sync → L1 `AhEscrow` |
| 4 | Claims / payouts → `ownerOf(character)` at claim time — never client-supplied | unchanged | unchanged |
| 5 | Login = signed message, **no chain switch**; WC 31337 **dev-only** | unchanged | unchanged |
| 6 | Item exports mint to the **owner** address | L1 checkpoint | unchanged |

---

## 1. Gaps vs current code

| Rule | Status | Notes |
|------|--------|--------|
| **1** Mint | **PARTIAL** | Mint-first on configured chain today. Point contracts + client at **L1**; no EEZ for v1 Ethereum-home. |
| **2** List / owner change | **APP DONE** | `ownerOf` at list; Transfer cancel-only + pending retry. |
| **3** Buy + pay current owner | **CONTRACT READY** | Redeploy-ready `buyAsk` → `ownerOf` + 1% fee. v1 = direct L1 `buyAsk`; EEZ mock stays for future L2 tests. |
| **4** Claims → `ownerOf` | **OK** | Checkpoint + AH fill. |
| **5** Login / WC | **APP DONE** | Sign-only; 31337 gated. |
| **6** Export → owner | **OK** | Unchanged. |

### App / contract work in this branch (not deployed)

- `AhEscrow`: immutable `characterNft`, `feeRecipient`, `FEE_BPS = 100`; `buyAsk` pays `ownerOf` then 1% fee; no frozen payout in `openAsk`.
- Forge tests: ownerOf-at-fill, fee rounding, Deploy wiring.
- Protocol `ahFeeSplit` + UI fee copy on list and buy.
- Transfer-cancel watcher: pending cancels + retry; confirmations; skip self-transfers; AskCancelled classify; list re-checks `ownerOf` after `openAsk`.

### Still needs go-ahead / redeploy / out-of-band

- Batched L1 redeploy of the package in §4.
- Production WalletConnect project id.
- Decision **(7)** redeploy timing + multisig holder.

---

## 2. EEZ — when it applies

| Phase | Player home | Mint / AH buy path |
|-------|-------------|--------------------|
| **v1** | Ethereum mainnet | **Plain L1 txs** to factory / `AhEscrow`. **No EEZ.** |
| **Later** | EEZ-zone L2s | EEZ sync `value` into the **same** L1 contracts. |

Local `MockEezSyncBuy` on 31337 remains a throwaway stand-in for the L2 path — not a v1 production dependency.

Upstream `periphery/Bridge.sol` stays **test-only**. Price policy unchanged: exact-price preferred; pull-refund on overshoot; underpay reverts.

---

## 3. Relayer / gas model (all L1)

### 3a. Who pays what (v1)

| Who | Pays |
|-----|------|
| **Player (L1)** | Mint fee + mint gas; AH `buyAsk` value + buy gas; login is sign-only (no gas). |
| **Server `LOK_LISTING_KEY`** | L1 `openAsk` / `cancelAsk` / transfer-driven cancels. |
| **Server rotator / checkpoint submitter** | L1 `checkpoint(...)` gas. |
| **Players** | Do **not** need a separate “game chain” — settlement **is** L1. Listing today is server-paid so players need no listing gas. |

### 3b. Rough L1 gas (forge averages on current AhEscrow / Checkpoint)

Measured execution gas (not including L1 base fee / priority fee volatility):

| Call | ~gas (forge) | At 20 gwei, ETH≈$2.5k (illustrative) |
|------|--------------|--------------------------------------|
| `openAsk` | ~138k | ~$6.9 |
| `cancelAsk` | ~30k | ~$1.5 |
| `buyAsk` (player-paid) | ~80–130k | ~$4–6.5 + sale value |
| `checkpoint` (median) | ~70k (wide range; exports inflate) | ~$3.5 (can spike) |

**Ops load (order of magnitude):**  
100 lists/day ≈ 14M gas ≈ **~$0.7k/mo** at 20 gwei if ETH is $2.5k — or **several $k/mo** if gas is hot. Transfer cancels and reclaim cancels add ~30k each. Checkpoints scale with how often the server commits character ranges (exports make them expensive).

These USD figures are **illustrative only**; treat them as a planning band, not a quote.

### 3c. Where the game log and checkpoints anchor

| Layer | Location | Role |
|-------|----------|------|
| **Character log** (items, gold, asks, fills) | **Server data dir** (`lok-world` journal + wasm engine) | Authoritative for gameplay. |
| **Checkpoint** | **Ethereum L1** `CharacterCheckpoint` | Commits log roots / exports / inbound consumption so the chain can mint exports and verify progress. |
| **AH / mint value** | **Ethereum L1** factory + `AhEscrow` | Funds never credit the log. |

v1: one domain — L1 holds NFTs, escrow, and checkpoint anchors; the server holds the mutable log and pays L1 gas to open/cancel asks and to submit checkpoints.

### 3d. `ownerOf` reads stay cheap for the server

`ownerOf` is an **`eth_call`** (view): **no L1 gas**, only RPC latency/rate limits. Used at list time, after `openAsk` (race check), at fill inside `buyAsk` (on-chain, paid by the buyer’s tx), and by the Transfer watcher (log scan + view calls). Safe to call often; bottleneck is RPC quota, not ETH.

---

## 3e. Ways to cut server L1 gas (tradeoffs for the user)

| Option | Idea | Saves | Tradeoffs |
|--------|------|-------|-----------|
| **A. Status quo** | Server `LISTING_ROLE` opens/cancels every ask immediately | — | Predictable UX; **server pays all list/cancel gas** on L1. |
| **B. Seller-signed listing, opened lazily at buy** | Seller signs an EIP-712 ask; first buyer (or relayer) submits `openAsk`+`buyAsk` (or a combined entrypoint) | Almost all `openAsk` gas moves off the server (or into the buyer’s tx) | More contract surface; cancel/expiry must be signature-aware; Transfer-cancel must invalidate signed asks off-chain; worse “browse live book” unless the server still indexes intents. |
| **C. Seller pays `openAsk`** | Seller’s wallet submits `openAsk` (or server sponsors only when seller deposits a listing bond) | Shifts gas to sellers | Needs wallet UX + L1 ETH in the seller wallet; breaks “list with one click while on any chain” for L2-era players. |
| **D. Batch open/cancel** | Multicall / batch `openAsk`/`cancelAsk` in one tx | Amortizes base fee across N asks | Complexity; failure atomicity; Transfer-cancel still may need per-id cancels. |
| **E. Fewer checkpoints / export-gated** | Checkpoint only when exporting or on a slow cadence | Cuts rotator gas | Longer unanchored log window; export UX must trigger a checkpoint. |
| **F. Keep server-paid lists for v1, revisit at L2** | Ship A now; design B when EEZ L2 homes appear | Lowest short-term eng cost | Accept L1 listing OpEx until volume forces a change. |

**Recommendation to discuss:** ship **F** for v1 (server-paid immediate lists on L1) with metering/alerts on the listing key; prototype **B** before L2 homes if list volume or gas spikes. Ask through Grok Bot which option to lock.

---

## 4. Redeploy package (batched — needs go-ahead)

Do **not** run until the user approves. Target: **Ethereum mainnet**.

| Piece | Action |
|-------|--------|
| **AhEscrow** | Deploy with `(admin, characterNft, feeRecipient)`; `LISTING_ROLE`; fee recipient = multisig; `buyAsk` → `ownerOf` + 1%. |
| **CharacterFactory** | `createCharacterFor`; native ETH mint fee on L1. |
| **CharacterNFT / Checkpoint** | Per Deploy.s.sol; drop KekVault custody for new play. |
| **RulesetRegistry** | New ruleset after wasm bump; timelock; accept. |
| **Reproducible wasm** | Remapped rebuild; pin `LOCAL_RULESET_WASM_SHA256` + `LOCAL_RULESET_HASH`. |
| **Historical ItemDrop allowlist** | Keep `HISTORICAL_ITEM_DROP_MAX_SEQ`. |
| **Env / clients** | `LOK_CHAIN_ID=1`, L1 RPCs, production WC project id; disable `LOK_DEV_*`. |
| **EEZ** | **Not required for v1.** Keep mock path for future L2 work only. |

---

## 5. Decisions

### Locked (user via Grok Bot)

| # | Decision |
|---|----------|
| 1 | **AH fill payout:** `buyAsk` pays `ownerOf(sellerTokenId)`. |
| 2 | **Owner change:** **cancel-only**. |
| 3 | **Home chains (v1):** Ethereum mainnet only; L2s later. |
| 4 | **Mint UX:** player-signed tx only (v1 = L1 same-chain; no intent+relayer). |
| 5 | **AH fee:** 1% floor in escrow at fill; UI shows it; fee → multisig/admin recipient. |
| **6** | **Settlement domain:** **Ethereum mainnet.** NFT, factory, AhEscrow, exports, checkpoints on L1. v1 Ethereum-home mint/buy = **same-chain** (no EEZ). EEZ only for future L2 homes. |
| 8 | **WalletConnect:** separate production project id. |

### Still TBD (ask through Grok Bot when needed)

| # | Open |
|---|------|
| **7** | **Redeploy timing** and **who holds the MULTISIG**? |
| **Gas cut** | Confirm v1 listing model: **F** (server-paid) vs **B/C/D** above. |

---

## 6. Verification checklist (before asking to redeploy)

- [x] Rules 2/4/5 app paths.
- [x] Transfer → cancel (pending retry, confirmations, self-transfer skip).
- [x] Escrow `ownerOf` + 1% fee forge tests + UI fee display.
- [x] Plan reflects L1 settlement + same-chain v1 (this revision).
- [ ] `check-wasm-pin.mjs --no-build` matches committed pin.
- [ ] User go-ahead for merge and for L1 redeploy (separate).
- [ ] Decision **(7)** multisig + timing answered.
- [ ] Listing gas model (**F** vs alternatives) confirmed.
