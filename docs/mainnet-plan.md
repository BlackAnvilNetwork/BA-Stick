# Mainnet plan (PR #212 → EEZ / home-chain players)

**Status:** planning + non-redeploy code fixes only.  
**Hard stops:** no merge to `main`; no shared-anvil or mainnet redeploy without explicit user go-ahead.  
**Credentials:** operator keys / `PRIVATE_KEY` / `VITE_WALLETCONNECT_PROJECT_ID` live in gitignored `.env` only — never commit.

Players **never** connect a wallet to the Bellgrave game chain for value. They stay on Ethereum or other **home chains**. All value moves through **EEZ**. The game chain still hosts character NFTs, AhEscrow, and checkpoints; the **server / listing relayer** pays game-chain gas.

## Design rules (locked)

| # | Rule |
|---|------|
| 1 | Character creation reads the connected address, takes the ETH fee on the **home chain through EEZ**, and mints the character NFT to that address. |
| 2 | An auction listing’s seller is the **current `ownerOf(character)`**, read at listing time. An owner change **cancels or rebinds** open listings. |
| 3 | Buys are paid on the buyer’s home chain through EEZ to escrow; the seller is paid at the character’s **current owner** address. |
| 4 | Claims and payouts always go to `ownerOf(character)` at claim time — **never** a client-supplied address. |
| 5 | Login is a **signed message** from the owner address with **no chain switch**. WalletConnect **31337** is **dev-only**. |
| 6 | Item exports mint to the **owner** address. |

---

## 1. Gaps vs current code

| Rule | Status | Current behavior | Gap |
|------|--------|------------------|-----|
| **1** Mint via EEZ | **PARTIAL** | Mint-first `createCharacterFor` on the **game chain** (`character-mint.ts` + factory `msg.value`). EIP-191 mint claims bind payer ↔ auth wallet. | No live EEZ home-chain fee → game-chain mint. Needs zone registration, mint proxy/path, and client pay-from-home UX. Redeploy/integration. |
| **2** List seller = `ownerOf` | **FIXED in app (this PR)** / contract still freezes payout | Was: client `sellerPayout` or auth wallet frozen into `AhEscrow.openAsk`. | App now ignores client payout and reads `ownerOf` at list; NFT `Transfer` watcher cancels open asks. **Rebind** (update payout without cancel) needs escrow change → redeploy. |
| **3** Buy home + pay current owner | **PARTIAL** | Local `MockEezSyncBuy` + `buyAsk{value}`; live EEZ not wired. Seller paid to **frozen** `sellerPayout` from `openAsk`. | Live EEZ sync buy; ideally `buyAsk` pays `ownerOf(sellerTokenId)` (or cancel+relist on transfer — app cancel path is interim). Redeploy for on-fill `ownerOf`. |
| **4** Claims → `ownerOf` | **PARTIAL** | `CharacterCheckpoint` exports / claims use `nft.ownerOf(tokenId)`. AH proceeds still use frozen escrow payout. | AH aligned with rule 3 after redeploy or strict cancel-on-transfer. Never accept client payout addresses (app-side done). |
| **5** Login no switch; 31337 dev-only | **FIXED in app (this PR)** | Was: WC `connect` always `wallet_switchEthereumChain` to `VITE_CHAIN_ID`; `optionalChains` always included 31337. | Sign-only WC login; anvil WC gated behind `import.meta.env.DEV` or `VITE_ALLOW_ANVIL_WC=1`. |
| **6** Export → owner | **OK** | Checkpoint `items.mint(player, …)` where `player = nft.ownerOf(tokenId)`. Bag `lok/export` stays log-side until checkpoint. | Keep; do not add client recipient. |

### Non-redeploy work in this tip

- Ignore client `sellerPayout` / `preferredPayoutWallet` on list; server uses `ownerOf(character)`.
- Cancel open book asks when the character NFT transfers.
- WalletConnect login: no forced chain switch; 31337 optional only in dev / explicit flag.
- Plan doc (this file) + PR pointer.

### Still needs redeploy / out-of-band

- Real EEZ zones + CrossChainProxy (mint fee + AH buy).
- Optional escrow change: pay `ownerOf` at fill (and/or rebind open asks).
- New factory (if mint UX changes), drop KekVault wiring, new ruleset hash + remapped wasm pin, historical `ItemDrop` allowlist pin for wipe/replay.
- Shared anvil / mainnet deploy of the package below.

---

## 2. Real EEZ integration

Local path today: `MockEezSyncBuy` on 31337 (`docs/eez-sync-buy.md`). Production path:

1. **Zones** — Register Bellgrave game domain + each player home chain (Ethereum L1 first; other EEZ-zone rollups later). Product copy: home chains we actually register, not “any WETH.”
2. **Proxies** — First-party entrypoints only (`AhEscrow.buyAsk`, factory mint). Upstream `periphery/Bridge.sol` stays **test-only**. EEZ `CrossChainProxy` (or equivalent) must present `msg.value` into those entrypoints; `msg.sender` on the game domain is the proxy — auth/mint binding must treat the **intent signer / home payer**, not assume EOA == game `msg.sender`.
3. **Proven outcomes** — Prefer proven sync batches: ask filled + seller paid + item mirrored (`AskFilled` → `chainFill`) in one atomic success, or full revert. Do not “park then play.”
4. **Price / refund policy (locked recommendation)**  
   - **Exact-price preferred** for client-built sync calls (`value == priceWei`).  
   - **Pull-refund allowed** at the escrow/mock edge when a proxy **overshoots** (`msg.value > priceWei` → refund excess to `msg.sender`), matching current `AhEscrow.buyAsk` / `MockEezSyncBuy`.  
   - Underpay always reverts (`WrongPrice`). No partial fills; no stranded escrow balance for the player.

Mint fee (rule 1): same policy — home-chain sync `value == mintFee` into a mint entrypoint that mints to the **connected / claim-bound** address.

---

## 3. Relayer / gas model (game chain)

| Who pays | What |
|----------|------|
| **Player (home chain)** | Mint fee, AH buy `value`, home-chain gas for the EEZ sync tx. |
| **Server listing key (`LOK_LISTING_KEY`)** | Game-chain `openAsk` / `cancelAsk` (and transfer-driven cancels). |
| **Server rotator / checkpoint signers** | Checkpoint submit gas (existing model). |
| **Players** | **Do not** need game-chain ETH for play, login, or listing. |

Ops notes:

- Fund and monitor the listing EOA; alert on low balance.
- Owner-key queue (`owner-tx-queue`) remains the serialization point for listing txs.
- Intent+relayer (research option B) is optional later for wallets that cannot build EEZ batches; not required for first mainnet cut if wallets can sign home-chain sync txs.

---

## 4. Redeploy package (batched — needs go-ahead)

Do **not** run until the user approves. One wipe window:

| Piece | Action |
|-------|--------|
| **AhEscrow** | Fresh deploy; grant `LISTING_ROLE` to listing EOA. Consider paying `ownerOf(sellerTokenId)` inside `buyAsk` (needs NFT address immutably set) **or** keep frozen payout + mandatory cancel-on-transfer. |
| **CharacterFactory** | New proxy with `createCharacterFor`; mint fee in native ETH; EEZ-callable mint path when ready. |
| **CharacterNFT / Checkpoint** | Redeploy or upgrade per Deploy.s.sol; **drop KekVault / deposit custody** wiring for new play. Exports continue to mint to `ownerOf`. |
| **RulesetRegistry** | Propose **new** ruleset hash after wasm bump; wait timelock; accept. |
| **Reproducible wasm** | Rebuild with path remapping (`check-wasm-pin.mjs` RUSTFLAGS `--remap-path-prefix`); commit `pkg/lok_engine.wasm` + update `LOCAL_RULESET_WASM_SHA256` + `LOCAL_RULESET_HASH` together. CI hard-gates `--no-build` until that bump. |
| **Historical ItemDrop allowlist** | Keep `HISTORICAL_ITEM_DROP_MAX_SEQ` (and any fixture allowlist) so replay of pre-wipe logs stays meaningful; new appends stay `ClosedMint`. Confirm seq pin against the wipe cut. |
| **Env / clients** | Point `LOK_*` + Vite mint/AH/EEZ env at new addresses; disable `LOK_DEV_*` faucet/server-mint on mainnet. |
| **EEZ** | Zone IDs, mock flag off, real proxy addresses, home RPC map. |

Deploy script baseline: `contracts/lok-log/script/Deploy.s.sol` (MULTISIG, ROTATOR, GUARDIAN, PROPOSER, LISTING, ITEMS, KEK, BASE_URI).

---

## 5. Open decisions for the user

1. **AH fill payout:** keep frozen `sellerPayout` + cancel-on-transfer (simpler escrow), or change `buyAsk` to `ownerOf` at fill (stronger rule 3/4, needs NFT wired into escrow)?
2. **Owner change:** cancel-only (current app path) vs cancel+auto-relist to new owner vs on-chain rebind?
3. **First home chains:** Ethereum mainnet only for v1, or Ethereum + specific EEZ L2s on day one?
4. **Mint UX:** player-signed home sync tx only, or also an intent+relayer path?
5. **AH fee:** yes/no and size (ETH), taken where (escrow vs EEZ batch)?
6. **Mainnet game domain:** which chain id / RPC is Bellgrave’s settlement domain for NFT+escrow?
7. **Wipe timing:** when to run the redeploy package and cut over env (and who holds MULTISIG)?
8. **WalletConnect project:** production project id vs current `.env` preview id?

---

## 6. Verification checklist (before asking to redeploy)

- [ ] Rules 2/4/5 app paths covered by tests (list ignores client payout; WC login no switch; 31337 gated).
- [ ] Transfer → cancel asks covered (unit + optional anvil support).
- [ ] Mock EEZ e2e still green on throwaway anvil.
- [ ] `check-wasm-pin.mjs --no-build` matches committed pin (no surprise bump).
- [ ] Audit highs that are redeploy-scoped called out again at cutover (H3 touch-set, vault drop, etc.).
- [ ] User explicit go-ahead for merge and for redeploy (separate).
