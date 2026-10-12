# Mainnet plan (PR #212 → EEZ / home-chain players)

**Status:** planning + redeploy-ready escrow/app work; **no deploy / no merge** without go-ahead.  
**Hard stops:** no merge to `main`; no shared-anvil or mainnet redeploy without explicit user go-ahead.  
**Credentials:** operator keys / `PRIVATE_KEY` / WalletConnect project ids live in gitignored `.env` only — never commit.

Players **never** connect a wallet to the Bellgrave game chain for value. They stay on Ethereum or other **home chains**. All value moves through **EEZ**. The game chain still hosts character NFTs, AhEscrow, and checkpoints; the **server / listing relayer** pays game-chain gas.

## Design rules (locked)

| # | Rule |
|---|------|
| 1 | Character creation reads the connected address, takes the ETH fee on the **home chain through EEZ**, and mints the character NFT to that address. |
| 2 | An auction listing’s seller is the **current `ownerOf(character)`**, read at listing time. An owner change **cancels** open listings (cancel-only; no rebind). |
| 3 | Buys are paid on the buyer’s home chain through EEZ to escrow; the seller is paid at the character’s **current owner** address **at fill**. |
| 4 | Claims and payouts always go to `ownerOf(character)` at claim time — **never** a client-supplied address. |
| 5 | Login is a **signed message** from the owner address with **no chain switch**. WalletConnect **31337** is **dev-only**. |
| 6 | Item exports mint to the **owner** address. |

---

## 1. Gaps vs current code

| Rule | Status | Notes |
|------|--------|--------|
| **1** Mint via EEZ | **PARTIAL** | Game-chain mint-first today. Live EEZ home-chain fee + mint still needs zone registration (redeploy/integration). |
| **2** List / owner change | **APP DONE** | List ignores client payout; NFT `Transfer` cancels open asks. Cancel-only is **locked**. |
| **3** Buy home + pay current owner | **CONTRACT READY** / live EEZ pending | Redeploy-ready `AhEscrow.buyAsk` pays `ownerOf(sellerTokenId)` + 1% fee. Live EEZ sync buy still out of band. |
| **4** Claims → `ownerOf` | **OK** (checkpoint) + AH via (3) | Checkpoint exports already use `ownerOf`. AH fill uses `ownerOf` after redeploy. |
| **5** Login no switch; 31337 dev-only | **APP DONE** | WC sign-only; anvil WC gated. |
| **6** Export → owner | **OK** | Unchanged. |

### App / contract work in this branch (not deployed)

- `AhEscrow`: immutable `characterNft`, `feeRecipient`, `FEE_BPS = 100` (1%), `buyAsk` pays `ownerOf` then fee; `openAsk` no longer stores a payout address.
- Forge tests: ownerOf-at-fill, fee rounding floor, fuzz partition, Deploy wiring.
- Protocol `ahFeeSplit` + UI fee copy on list and buy.
- AskFilled topic/decode updated for `feeWei` (server watcher).
- Transfer-cancel watcher: persisted pending cancels + retry; confirmation depth; skip self-transfers; `alreadyClosed` uses AskCancelled/AskFilled classify (same as boot reconcile); list path re-checks `ownerOf` after `openAsk`.

### Still needs go-ahead / redeploy / out-of-band

- Real EEZ zones + CrossChainProxy (mint fee + AH buy); **Ethereum mainnet home only for v1**.
- Batched redeploy of escrow (+ NFT factory / vault drop / wasm pin as listed below).
- Production WalletConnect project id (separate from preview).

---

## 2. Real EEZ integration

Local path today: `MockEezSyncBuy` on 31337 (`docs/eez-sync-buy.md`). Production path:

1. **Zones** — Register Bellgrave game domain + **Ethereum mainnet** as the only player home chain for v1. Other EEZ L2s later.
2. **Proxies** — First-party entrypoints only (`AhEscrow.buyAsk`, factory mint). Upstream `periphery/Bridge.sol` stays **test-only**.
3. **Proven outcomes** — Prefer proven sync batches: ask filled + seller paid + fee paid + item mirrored (`AskFilled` → `chainFill`) in one atomic success, or full revert.
4. **Price / refund policy**  
   - **Exact-price preferred** for client-built sync calls (`value == priceWei`).  
   - **Pull-refund allowed** when a proxy overshoots (`msg.value > priceWei` → refund excess to `msg.sender`).  
   - Underpay always reverts (`WrongPrice`).
5. **Mint UX (locked)** — **Player-signed home sync tx only** for v1. No intent+relayer path yet.

---

## 3. Relayer / gas model (game chain)

| Who pays | What |
|----------|------|
| **Player (Ethereum mainnet)** | Mint fee, AH buy `value`, home-chain gas for the EEZ sync tx. |
| **Server listing key (`LOK_LISTING_KEY`)** | Game-chain `openAsk` / `cancelAsk` (and transfer-driven cancels). |
| **Server rotator / checkpoint signers** | Checkpoint submit gas (existing model). |
| **Players** | **Do not** need game-chain ETH for play, login, or listing. |

---

## 4. Redeploy package (batched — needs go-ahead)

Do **not** run until the user approves. One wipe window:

| Piece | Action |
|-------|--------|
| **AhEscrow** | Fresh deploy with `(admin, characterNft, feeRecipient)`; `LISTING_ROLE` to listing EOA; fee recipient = multisig (admin can `setFeeRecipient`). `buyAsk` pays `ownerOf(sellerTokenId)` + 1% fee. |
| **CharacterFactory** | New proxy with `createCharacterFor`; mint fee in native ETH; EEZ-callable mint path when ready. |
| **CharacterNFT / Checkpoint** | Redeploy or upgrade per Deploy.s.sol; **drop KekVault / deposit custody** wiring for new play. |
| **RulesetRegistry** | Propose **new** ruleset hash after wasm bump; wait timelock; accept. |
| **Reproducible wasm** | Remapped rebuild; commit `pkg/lok_engine.wasm` + `LOCAL_RULESET_WASM_SHA256` + `LOCAL_RULESET_HASH` together. |
| **Historical ItemDrop allowlist** | Keep `HISTORICAL_ITEM_DROP_MAX_SEQ` for wipe/replay. |
| **Env / clients** | Point `LOK_*` + Vite env at new addresses; production WC project id; disable `LOK_DEV_*` on mainnet. |
| **EEZ** | Zone IDs for Bellgrave + Ethereum mainnet; mock flag off. |

Deploy script baseline: `contracts/lok-log/script/Deploy.s.sol`.

---

## 5. Decisions

### Locked (user via Grok Bot)

| # | Decision |
|---|----------|
| 1 | **AH fill payout:** `buyAsk` pays `ownerOf(sellerTokenId)` (NFT wired into escrow). Redeploy package. |
| 2 | **Owner change:** **cancel-only** (app Transfer watcher). No rebind / auto-relist. |
| 3 | **Home chains:** **Ethereum mainnet only** for v1; L2s later. |
| 4 | **Mint UX:** **player-signed home sync tx only**; no intent+relayer for v1. |
| 5 | **AH fee:** **1%** of sale price in ETH, taken in escrow at fill (`fee = price * 100 / 10000` floor); seller gets the rest; fee → `feeRecipient` (multisig/admin). Show in UI before buy and list; rounding covered by forge + `ahFeeSplit` tests. |
| 8 | **WalletConnect:** use a **separate production project id** (not the preview `.env` id). |

### Still TBD (ask through Grok Bot when needed)

| # | Open |
|---|------|
| **6** | **Settlement chain:** which chain id / RPC is Bellgrave’s game domain for NFT + escrow? |
| **7** | **Redeploy timing** and **who holds the MULTISIG**? |

---

## 6. Verification checklist (before asking to redeploy)

- [x] Rules 2/4/5 app paths (list ignores client payout; WC login no switch; 31337 gated).
- [x] Transfer → cancel asks (unit tests).
- [x] Escrow `ownerOf` + 1% fee forge tests (incl. rounding).
- [x] UI fee display on list + buy.
- [ ] Mock EEZ e2e green on throwaway anvil after ABI change.
- [ ] `check-wasm-pin.mjs --no-build` matches committed pin (no surprise bump).
- [ ] User explicit go-ahead for merge and for redeploy (separate).
- [ ] Settlement chain (6) + multisig/timing (7) answered.
