# Mainnet plan (PR #212 → Gnosis settlement)

**Status:** planning + redeploy-ready escrow/app work; **no deploy / no merge** without go-ahead.  
**Hard stops:** no merge to `main`; no Chiado / Gnosis redeploy without explicit user go-ahead.  
**Credentials:** operator keys / `PRIVATE_KEY` / WalletConnect project ids live in gitignored `.env` only — never commit.

## Settlement domain (locked)

**Gnosis Chain** is Bellgrave’s settlement domain (mainnet later). Real EEZ testing targets **Gnosis Chiado**.

| Network | Chain ID | Role |
|---------|----------|------|
| Gnosis Chain | **100** | Production settlement (later) |
| Gnosis Chiado | **10200** | Testnet settlement + EEZ L1 |
| EEZ Rollup 0 L2 (Chiado) | **10201** | Public EEZ composer path |
| Local anvil | **31337** | Dev only |

These contracts live on the **settlement chain** (Chiado now / Gnosis 100 later):

| Contract / surface | On Gnosis / Chiado |
|--------------------|--------------------|
| `CharacterNFT` | yes |
| `CharacterFactory` (mint fee) | yes |
| `AhEscrow` (AH pay / 1% fee) | yes |
| Item exports (checkpoint → ERC-1155 mint to `ownerOf`) | yes |
| `CharacterCheckpoint` + `RulesetRegistry` | yes |

**v1 player home chain = Ethereum mainnet.** Players stay on Ethereum for login (sign-only). Value reaches Gnosis via **EEZ** (Chiado path first). **No player wallet needs to connect to the game/settlement chain** for login.

Server keys pay **settlement-chain gas in native xDAI** for `openAsk` / `cancelAsk` / transfer-cancels / checkpoints — xDAI gas on Gnosis/Chiado is cheap.

---

## Currency (locked): native xDAI on Gnosis

**Decision:** use **native xDAI** on Gnosis / Chiado for now. Mint fee, AH ask prices, and the **1% marketplace fee** are all `msg.value` in native settlement currency.

| Concern | Choice |
|---------|--------|
| Token | Native `msg.value` only — **no WETH, no wrap, no approve** |
| Escrow / factory | Stay native-value (unchanged ABI shape) |
| UI label | **xDAI** on chain 100 / 10200; **ETH** on 31337 |
| Decimals | 18 (same as ETH) |
| Later ETH via EEZ | Point settlement at an ETH-native zone or retarget labels; **no contract rewrite** for currency unit |

Per-chain config lives in `@bellgrave/config` (`SETTLEMENT_BY_CHAIN`) and is exposed on snapshot `ahEscrow.currency` / `characterMint.currency`.

### Mint fee recommendation — **flag for product**

| Chain | Default mint fee | Rough USD |
|-------|------------------|-----------|
| Chiado / Gnosis (100, 10200) | **1 xDAI** (`10^18` wei) | ≈ **$1.00** |
| Anvil (31337) | 0.001 ETH | ~$2–4 (varies) |

**Rationale:** xDAI tracks $1, so **1 xDAI** is a clear, dollar-ish character fee and is in the same ballpark as the old 0.001 ETH local default without forcing players to think in fractional ETH. Override at deploy with `MINT_FEE` (wei). **Please confirm or override** before Chiado broadcast.

Example AH list placeholder: **1 xDAI** on Gnosis/Chiado; **0.001 ETH** on anvil.

---

## Design rules (locked)

| # | Rule | v1 (Ethereum home → Gnosis settle) |
|---|------|-------------------------------------|
| 1 | Character creation reads connected address, takes native fee, mints NFT to that address | Fee in **native settlement currency** (xDAI on Gnosis); NFT minted on settlement chain to that address (EEZ sync) |
| 2 | Listing seller = `ownerOf(character)`; owner change **cancels** open listings | Unchanged (settlement NFT + Transfer watcher) |
| 3 | Buys paid from buyer’s home; seller paid at **current `ownerOf`** at fill | Pay via EEZ into settlement `buyAsk`; pays `ownerOf` + 1% fee in **native xDAI** |
| 4 | Claims / payouts → `ownerOf` at claim time — never client-supplied | Unchanged |
| 5 | Login = signed message, **no chain switch**; WC 31337 **dev-only** | Wallet stays on Ethereum (or home); **never required to add Gnosis for login** |
| 6 | Item exports mint to the **owner** address | On settlement chain via checkpoint |

---

## 1. Gaps vs current code

| Rule | Status | Notes |
|------|--------|--------|
| **1** Mint → Gnosis / Chiado | **PARTIAL** | Native-value factory ready. Need Chiado deploy + EEZ path so the payer can stay on Ethereum home. |
| **2** List / owner change | **APP DONE** | `ownerOf` at list; Transfer cancel-only + pending retry. |
| **3** Buy → settlement | **CONTRACT READY** / path pending | Redeploy-ready `buyAsk` → `ownerOf` + 1% in native value. EEZ sync buy from Ethereum TBD. |
| **4** Claims → `ownerOf` | **OK** | Checkpoint + AH fill. |
| **5** Login / WC | **APP DONE** | Sign-only; settlement chain not required for login. |
| **6** Export → owner | **OK** | Unchanged. |

### App / contract work in this branch (not deployed)

- `AhEscrow`: immutable `characterNft`, `feeRecipient`, `FEE_BPS = 100`; `buyAsk` pays `ownerOf` then 1% fee (**native value**).
- Forge tests + UI fee copy; AskFilled `feeWei` decode.
- Transfer-cancel watcher: pending retries (re-read+merge before write, persist-before-cursor, backoff/cap), confirmations, skip self-transfers, AskCancelled classify, list re-checks `ownerOf` after `openAsk` and queues failed cancels. Max-attempt drops are appended to `nft-transfer-cancel-dropped.json` (ops alert file) plus console ALERT.
- Per-chain currency labels / defaults (`xDAI` vs `ETH`); WalletConnect optionalChains from `SETTLEMENT_BY_CHAIN`.
- Chiado deploy script + `.env.chiado.example` (**not broadcast**).
- **Pre-fee AskFilled topic:** intentionally **not** watched. The feeWei (8-arg) topic is the only watcher. Acceptable while nothing is deployed on Chiado/Gnosis; drain/cancel any pre-fee asks before a future upgrade that replaces a live escrow.

### Mint fee (locked)

**1 xDAI** (`MINT_FEE=1e18`) on Gnosis / Chiado — confirmed.

### Still needs go-ahead / redeploy / out-of-band

- **Chiado broadcast go-ahead** from the user (code side ready per support re-test of 9432083+).
- **Multisig + fee recipient addresses** (DeployChiado `MULTISIG` / AhEscrow fee recipient).
- Chiado (then Gnosis 100) deploy of the package in §4.
- EEZ wiring against public Chiado rollup0 (see §2).
- Production WalletConnect project id.
- Decision **(7)** redeploy timing.

---

## 2. EEZ on Chiado — what’s live

Public EEZ work targets **Gnosis Chiado**, not Ethereum mainnet L1 alone.

| Piece | Detail |
|-------|--------|
| L1 | Chiado **10200** |
| L2 (Rollup 0) | **10201** |
| Stack | `eez-core-protocol` / `eez-rollup0`: `CrossChainProxy`, sequencer, composer (`eez_composerInfo`) |
| Value | Sync batches forward **native value** — on Chiado L1 that is **xDAI**; when EEZ later settles in ETH zones, the same native-value contracts accept ETH without a rewrite |

**v1 play path:** exercise mint + `buyAsk` through EEZ on Chiado before Gnosis mainnet. Local anvil keeps ETH labels for 31337.

### Relayer / gas model

| Actor | Pays | Unit |
|-------|------|------|
| Player (home) | Mint fee / AH price via EEZ sync | Home ETH → settles as native on Chiado/Gnosis |
| Server listing / cancel / checkpoint keys | Settlement gas | **xDAI** on 100 / 10200 |
| Fee recipient (multisig) | Receives 1% of fills | Native xDAI |

Fund operator keys with Chiado xDAI before any smoke test. Do **not** put player ETH onto the game chain.

---

## 3. Gnosis chain IDs, RPC, finality

| | Gnosis mainnet | Chiado |
|--|----------------|--------|
| Chain ID | 100 | 10200 |
| Native | xDAI | xDAI (test) |
| Typical RPC | `https://rpc.gnosischain.com` | `https://rpc.chiado.gnosis.gateway.fm` (or public Chiado RPC) |
| Explorer | https://gnosisscan.io | https://gnosis-chiado.blockscout.com |
| Block time | ~5s | ~5s |
| Watcher depth | Prefer `safe` / `finalized` tags; confirm ≥2 behind tip (current Transfer watcher uses `latest - 2`) | same |
| Env | `LOK_CHAIN_ID=100` | `LOK_CHAIN_ID=10200` |

Server: `LOK_CHAIN_RPC` (operator) + `LOK_PUBLIC_RPC` (browser-reachable). Currency symbol comes from chain id via `settlementCurrency(chainId)`.

---

## 4. Redeploy package (Chiado first)

Order (forge `Deploy` / `DeployChiado`; see `docs/chiado-deploy.md`):

1. `CharacterNFT` (UUPS)
2. `CharacterCheckpoint` (UUPS)
3. `CharacterFactory` with `MINT_FEE` (**default 1 ether = 1 xDAI** on Chiado)
4. `RulesetRegistry` (UUPS)
5. `AhEscrow(admin, nft, feeRecipient)` — fee to multisig; `FEE_BPS = 100`
6. Roles: factory minter on NFT; listing role on escrow; items minter on checkpoint; starting jobs; first ruleset propose

**Post-deploy env (server):** `LOK_CHAIN_ID`, `LOK_CHAIN_RPC`, `LOK_PUBLIC_RPC`, `LOK_AH_ESCROW`, `LOK_CHARACTER_NFT`, `LOK_CHARACTER_FACTORY`, `LOK_LISTING_KEY` (xDAI-funded), WalletConnect **production** project id.

**Do not broadcast** until user go-ahead.

---

## 5. Locked decisions / still open

| # | Topic | Status |
|---|-------|--------|
| 1 | AH payout → `ownerOf` at fill | **Locked** |
| 2 | Owner change → cancel-only | **Locked** |
| 3 | Home = Ethereum mainnet v1 | **Locked** |
| 4 | Mint UX = player-signed home sync (EEZ) | **Locked** (path TBD) |
| 5 | AH fee = 1% floor to multisig/admin | **Locked** |
| 6 | Settlement = **Gnosis** (Chiado test) | **Locked** |
| — | Currency = **native xDAI** on Gnosis | **Locked** |
| — | Mint fee default **1 xDAI** | **Proposed — confirm** |
| 7 | Redeploy timing + multisig | **Open** |
| 8 | WC production project id | **Locked** (out-of-band) |

---

## 6. Do-nots

- Do **not** merge this branch without go-ahead.
- Do **not** deploy to Chiado or Gnosis without go-ahead.
- Do **not** introduce WETH wrap/approve for AH or mint on Gnosis.
- Do **not** require players to add Gnosis for login.
- Do **not** commit secrets or production WC project ids.
