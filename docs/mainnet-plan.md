# Mainnet plan (PR #212 → MegaETH settlement)

**Status:** planning + redeploy-ready escrow/app work; **no deploy / no merge** without go-ahead.  
**Hard stops:** no merge to `main`; no shared-anvil / MegaETH redeploy without explicit user go-ahead.  
**Credentials:** operator keys / `PRIVATE_KEY` / WalletConnect project ids live in gitignored `.env` only — never commit.

## Settlement domain (locked)

**MegaETH** is Bellgrave’s settlement domain. These contracts live on MegaETH:

| Contract / surface | On MegaETH |
|--------------------|------------|
| `CharacterNFT` | yes |
| `CharacterFactory` (mint fee) | yes |
| `AhEscrow` (AH pay / 1% fee) | yes |
| Item exports (checkpoint → ERC-1155 mint to `ownerOf`) | yes |
| `CharacterCheckpoint` + `RulesetRegistry` | yes |

**v1 player home chain = Ethereum mainnet.** Players stay on Ethereum for login (sign-only) and for paying mint fees / AH buys. Value reaches MegaETH via **EEZ if/when MegaETH is an EEZ zone**, otherwise via a **bridge + sponsored MegaETH tx** fallback. **No player wallet needs MegaETH** (no chain switch for login, mint, or buy).

Server keys pay **MegaETH gas** for `openAsk` / `cancelAsk` / transfer-cancels / checkpoints — gas is cheap on MegaETH (base fee ≈ 0.001 gwei).

---

## Design rules (locked)

| # | Rule | v1 (Ethereum home → MegaETH settle) |
|---|------|-------------------------------------|
| 1 | Character creation reads connected address, takes ETH fee, mints NFT to that address | Fee paid **from Ethereum**; NFT minted on **MegaETH** to that address (EEZ sync or bridge+sponsor) |
| 2 | Listing seller = `ownerOf(character)`; owner change **cancels** open listings | Unchanged (MegaETH NFT + Transfer watcher) |
| 3 | Buys paid from buyer’s home; seller paid at **current `ownerOf`** at fill | Pay **from Ethereum**; `buyAsk` on **MegaETH** pays `ownerOf` + 1% fee |
| 4 | Claims / payouts → `ownerOf` at claim time — never client-supplied | Unchanged |
| 5 | Login = signed message, **no chain switch**; WC 31337 **dev-only** | Wallet stays on Ethereum (or whatever home); **never required to add MegaETH** |
| 6 | Item exports mint to the **owner** address | On MegaETH via checkpoint |

---

## 1. Gaps vs current code

| Rule | Status | Notes |
|------|--------|--------|
| **1** Mint from Ethereum → MegaETH | **PARTIAL** | Mint-first on configured chain today. Need MegaETH deploy + EEZ or bridge+sponsor path so the payer never switches to MegaETH. |
| **2** List / owner change | **APP DONE** | `ownerOf` at list; Transfer cancel-only + pending retry (MegaETH RPC). |
| **3** Buy from Ethereum → MegaETH | **CONTRACT READY** / path pending | Redeploy-ready `buyAsk` → `ownerOf` + 1% fee on MegaETH. Client/sponsor path from Ethereum TBD (EEZ or bridge). |
| **4** Claims → `ownerOf` | **OK** | Checkpoint + AH fill. |
| **5** Login / WC | **APP DONE** | Sign-only; no MegaETH in required chains. |
| **6** Export → owner | **OK** | Unchanged. |

### App / contract work in this branch (not deployed)

- `AhEscrow`: immutable `characterNft`, `feeRecipient`, `FEE_BPS = 100`; `buyAsk` pays `ownerOf` then 1% fee.
- Forge tests + UI fee copy; AskFilled `feeWei` decode.
- Transfer-cancel watcher: pending retries, confirmations, skip self-transfers, AskCancelled classify, list re-checks `ownerOf` after `openAsk`.

### Still needs go-ahead / redeploy / out-of-band

- MegaETH deploy of the package in §4.
- EEZ registration **or** bridge+sponsor wiring (see §2).
- Production WalletConnect project id.
- Decision **(7)** redeploy timing + multisig holder.

---

## 2. EEZ support for MegaETH — check + fallback

### What EEZ requires

[eez-core-protocol](https://github.com/eez-association/eez-core-protocol) only sync-composes **registered EEZ rollups** in the same economic zone (deterministic `CrossChainProxy`, proven batches, native ETH `value`). It is **not** a general bridge to arbitrary L2s. Upstream is early / unaudited; live public path today is roughly **Chiado testnet Rollup 0**, not production MegaETH.

### Does EEZ support MegaETH today?

| Check | Finding (as of this plan) |
|-------|---------------------------|
| MegaETH listed as EEZ Alliance / registered zone | **No** — not in published alliance/member lists; no public MegaETH rollup id in EEZ docs |
| Sync calls Eth ↔ MegaETH with proven outcomes | **Not available** publicly |
| Proven atomic fill (Eth pay → MegaETH `buyAsk` / mint in one sync window) | **Blocked** until MegaETH is an EEZ zone with a live composer/prover |

**Verdict:** treat EEZ→MegaETH as **aspirational / out of band**. Do **not** block MegaETH redeploy on EEZ readiness.

### Fallback when EEZ does not support MegaETH

Constraint: **player wallets must not need MegaETH**.

| Step | Who | Where |
|------|-----|--------|
| 1. Player signs mint/buy intent (and/or pays escrow on Ethereum) | Player | Ethereum |
| 2. ETH moved Eth → MegaETH | Bridge (e.g. official MegaETH bridge / rabbithole) + **server/relayer** | Eth → MegaETH |
| 3. `createCharacterFor` / `buyAsk` submitted | **Server listing/relayer key** (sponsors MegaETH gas) | MegaETH |
| 4. NFT / fill / fee land; item mirrored via `AskFilled` → `chainFill` | Contracts + watcher | MegaETH + server log |

Tradeoffs vs EEZ: not atomic with the Ethereum payment in one proven sync window; need bridge finality + reconciliation; more custody/ops in the relayer. Prefer EEZ if MegaETH ever joins; ship fallback so v1 can launch on MegaETH without waiting.

Local `MockEezSyncBuy` on 31337 remains a **dev stand-in** for a future sync path — not a MegaETH production dependency.

Price policy (either path): exact-price preferred; pull-refund on overshoot; underpay reverts.

---

## 3. MegaETH chain parameters + watchers

### 3a. Network (verify against [MegaETH docs](https://docs.megaeth.com/user-guide/connect) before deploy)

| | Mainnet | Testnet |
|--|---------|---------|
| **Chain ID** | **4326** (`0x10e6`) | **6343** (`0x18c7`) |
| **RPC** | `https://mainnet.megaeth.com/rpc` | `https://carrot.megaeth.com/rpc` |
| **WS** | `wss://mainnet.megaeth.com/ws` | `wss://carrot.megaeth.com/ws` |
| **Native gas** | ETH, 18 decimals | same |
| **Base fee** | ≈ **0.001 gwei** (adjustment effectively disabled) | same |
| **Block time** | Mini-blocks ≈ **10ms**; EVM blocks ≈ **1s** | same |

Env target after redeploy: `LOK_CHAIN_ID=4326`, `LOK_CHAIN_RPC` / `LOK_PUBLIC_RPC` → MegaETH mainnet (or testnet for dry run).

### 3b. Finality and reorg depth (for AskFilled / Transfer watchers)

| Layer | Meaning |
|-------|---------|
| **Mini-block / `latest`** | Sequencer **preconfirmation** (~10ms). Signed commitment; **not** L1 finality. |
| **EVM block** | Sealed ~1s; still MegaETH-local until posted. |
| **L1-finalized** | Full finality once the containing batch/anchor is finalized on Ethereum. L1 reorgs can roll back MegaETH state (rare but documented — apps must handle rollbacks). |

**Watcher policy (recommended):**

- Do **not** treat mini-block tip as final for irreversible log effects (`chainFill`, permanent cancel).
- Scan / apply using **EVM block** numbers with a confirmation lag, then optionally tighten to an L1-safe tag when the RPC exposes one.
- Current code defaults (`ASK_FILL_CONFIRMATIONS = 2`, `NFT_TRANSFER_CONFIRMATIONS = 2`) are fine for anvil; on MegaETH raise to a depth that survives short reorgs / RPC skew — **start at ≥ 12 EVM blocks (~12s)** for production, and revisit once an L1-finalized/safe block tag is wired.
- Pending-cancel retries already cover “preconfirm then rollback then reappear” better than cursor-only advance.

### 3c. Gas model (server on MegaETH)

| Who | Pays |
|-----|------|
| **Player (Ethereum)** | Mint/buy **value** (via EEZ or bridge escrow) + Ethereum gas for the Eth-side tx / intent. **No MegaETH gas.** |
| **Server `LOK_LISTING_KEY`** | MegaETH `openAsk` / `cancelAsk` / transfer-cancels (~138k / ~30k gas — **cheap** at 0.001 gwei). |
| **Server rotator / checkpoint** | MegaETH `checkpoint` gas (also cheap). |
| **Relayer (fallback path)** | MegaETH mint/`buyAsk` gas when sponsoring; bridge fees as applicable. |

No separate L1-gas-reduction program: MegaETH fees make server-paid listing/cancel/checkpoint the default v1 model.

### 3d. Wallets never need MegaETH

| Flow | Player wallet chain |
|------|---------------------|
| Login | Home (Ethereum) — **sign only**, no switch |
| Mint / AH buy | Ethereum payment / intent; MegaETH execution by EEZ proxy or server sponsor |
| List | In-game only; server opens ask on MegaETH |
| WalletConnect optionalChains | Ethereum (+ Robinhood/dev as today); **do not require** 4326 for play |

`ownerOf` and other reads are `eth_call` against MegaETH RPC — **no gas**, server-side only.

### 3e. Where the game log anchors

| Layer | Location |
|-------|----------|
| Character log (items, gold, asks) | **Server** |
| Checkpoint / NFT / escrow / exports | **MegaETH** |
| Player funds (v1) | **Ethereum** until EEZ/bridge moves value into MegaETH escrow/mint |

---

## 4. Redeploy package (batched — needs go-ahead)

Do **not** run until the user approves. Target: **MegaETH** (testnet dry-run optional).

| Piece | Action |
|-------|--------|
| **AhEscrow** | Deploy with `(admin, characterNft, feeRecipient)`; `LISTING_ROLE`; 1% fee; `buyAsk` → `ownerOf`. |
| **CharacterFactory** | `createCharacterFor`; native ETH mint fee on MegaETH. |
| **CharacterNFT / Checkpoint** | Per Deploy.s.sol; drop KekVault custody for new play. |
| **RulesetRegistry** | New ruleset after wasm bump; timelock; accept. |
| **Reproducible wasm** | Remapped rebuild; pin hash + wasm sha256. |
| **Historical ItemDrop allowlist** | Keep `HISTORICAL_ITEM_DROP_MAX_SEQ`. |
| **Env / clients** | `LOK_CHAIN_ID=4326`, MegaETH RPCs, production WC id; disable `LOK_DEV_*`. |
| **EEZ / bridge** | Prefer EEZ when MegaETH is a zone; else ship bridge+sponsor. Mock EEZ stays local-only. |

---

## 5. Decisions

### Locked (user via Grok Bot)

| # | Decision |
|---|----------|
| 1 | **AH fill payout:** `buyAsk` pays `ownerOf(sellerTokenId)`. |
| 2 | **Owner change:** **cancel-only**. |
| 3 | **Home chains (v1):** Ethereum mainnet; L2 homes later. |
| 4 | **Mint UX:** player-signed from home; no intent+relayer **required** for EEZ path; fallback may use sponsor/relayer so wallet stays off MegaETH. |
| 5 | **AH fee:** 1% floor in escrow; UI shows it; fee → multisig/admin. |
| **6** | **Settlement domain:** **MegaETH** (NFT, factory, AhEscrow, exports, checkpoints). Players stay on Ethereum; value via EEZ **or** bridge if EEZ lacks MegaETH. |
| 8 | **WalletConnect:** separate production project id. |

### Still TBD (ask through Grok Bot when needed)

| # | Open |
|---|------|
| **7** | **Redeploy timing** and **who holds the MULTISIG**? |
| **EEZ vs bridge** | Confirm fallback sponsor/bridge vendor for Eth→MegaETH until EEZ supports MegaETH. |
| **Watcher depth** | Confirm production confirmation count / L1-safe tag on MegaETH RPC. |

---

## 6. Verification checklist (before asking to redeploy)

- [x] Rules 2/4/5 app paths + transfer-cancel hardening + escrow fee/`ownerOf`.
- [x] Plan reflects **MegaETH** settlement + Ethereum home + EEZ/bridge fallback (this revision).
- [ ] MegaETH testnet dry-run of Deploy + mint + `buyAsk` + watchers.
- [ ] `check-wasm-pin.mjs --no-build` matches committed pin.
- [ ] User go-ahead for merge and for MegaETH redeploy (separate).
- [ ] Decision **(7)** multisig + timing answered.
- [ ] EEZ registration status re-checked; bridge+sponsor path specified if still unsupported.
