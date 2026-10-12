# Gnosis official launch runbook

**Dry-run note:** The 2026-10-12 deploy on chain 100 (`deployments/gnosis.json`) was a dry-run mainnet launch. It wired **MockItems** and collapsed roles onto one EOA — do **not** treat it as production. A production server must **never** use that Checkpoint (open `setMinter` on MockItems). Official launch must use this runbook + the hardened `Deploy` script.

## Dry-run MockItems (never for production)

| Fact | Detail |
|------|--------|
| File | `deployments/gnosis.json` (`status: "dry-run-only"`) |
| Gap | `CharacterCheckpoint` points at **MockItems** (`contracts.MockItems`) — anyone can `setMinter` |
| Also wrong | Single EOA held admin + listing + fee + all roles |
| Server behavior | `applySettlementDeployFile` **refuses** to fill `LOK_NFT` / `LOK_FACTORY` / `LOK_CHECKPOINT` / … from a `dry-run-only` file unless `LOK_ALLOW_DRY_RUN_DEPLOY=1` (inspection only). `MockItems` is never copied into `LOK_ITEMS`. |
| Production path | Official `DeployChiado` + real `Items.sol` (or `ITEMS=0x0`), new deploy JSON without `dry-run-only`, set `LOK_DEPLOY_BLOCK`, then start the server |

Do not set `LOK_CHECKPOINT` / `LOK_ITEMS` by hand to the dry-run addresses. Do not run a public game against that Checkpoint.

## Env profile

| Knob | Values | Effect |
|------|--------|--------|
| `NETWORK` / `LOK_NETWORK` (server) | `gnosis` \| `chiado` \| `anvil` | Fills blank `LOK_CHAIN_ID`, RPC list, confirmations, explorers |
| `VITE_NETWORK` (web) | same | Selects AppKit default chain + RPC defaults |

Profiles live in `@bellgrave/config` (`NETWORK_PROFILES`). Explicit `LOK_*` / `VITE_*` always win.

**Hard stops:** no broadcast without go-ahead; no merge without go-ahead; no admin txs on the dry-run deployment unless explicitly requested.

## Addresses / keys you must supply

Copy `contracts/lok-log/.env.gnosis.example` → `.env.gnosis` (gitignored).

| You supply | Role | Env var | Notes |
|------------|------|---------|-------|
| **Safe multisig address** | Admin (+ emergency/guardian default) | `ADMIN` | Optional `EMERGENCY` / `GUARDIAN` if split |
| **Treasury address** | Fee recipient | `FEE_RECIPIENT` | ≠ Safe, ≠ server EOAs |
| **Listing EOA address + key** | AhEscrow `LISTING_ROLE` | `LISTING` + server `LOK_LISTING_KEY` | Fund minimal xDAI for gas; sweep after ops |
| **Rotator EOA address + key** | Checkpoint signers | `ROTATOR` | Distinct from listing/proposer |
| **Proposer EOA address + key** | Ruleset propose | `PROPOSER` | Distinct from listing/rotator |
| **Deployer EOA key** | One-shot broadcast | `PRIVATE_KEY` | Ephemeral; fund minimal; sweep before delete |
| **Items address** (or `0x0`) | ERC-1155 exports | `ITEMS` | Real `Items.sol` from DeployItems — never MockItems |
| Public Gnosis RPC | Read/sim | `RPC_URL` / `GNOSIS_RPC_URL` | Profile defaults exist |

On chainid ≠ 31337 the script **reverts** if listing/rotator/proposer are not pairwise distinct, or if any equals admin or feeRecipient, or if feeRecipient equals admin.

## Items / KEK (HIGH)

- Pass a **real access-controlled** `Items` ERC-1155 as `ITEMS`, **or** `ITEMS=0x000…000` (imports/exports stay off via `NotConfigured`).
- **Never** run `DeployChiadoMocks` / wire `MockItems` / `MockKEK` on 100 or 10200. Those mocks expose open `setMinter`. The deploy script calls `isBellgraveTestMock()` and reverts on non-anvil if a mock is passed.
- Craft / catalog: off-chain defs stay on small-int ids + slugs (`@bellgrave/items` craft + catalog). Chain export/import/AH use `chainFungibleId(slug)` (= `ItemIds.fungible`). Launch seed = all `kind: "base"` mats (`EXPORTABLE_BASE_SLUGS`, ~65 slugs).
- Print seed CSV:
  ```bash
  pnpm --filter @bellgrave/items print-seed
  ```
- Simulate DeployItems (anvil or any RPC; **no broadcast**):
  ```bash
  # start anvil in another shell if needed: anvil
  ADMIN=0x…A1 CHECKPOINT=0x…C1 ./contracts/lok-log/script/simulate-deploy-items.sh
  # or:
  # ITEMS_SEED_SLUGS="$(pnpm --filter @bellgrave/items print-seed)" \
  #   forge script script/DeployItems.s.sol:DeployItems --rpc-url "$RPC_URL" --sig "run()"
  ```
- After Items + character stack (broadcast only with go-ahead): Safe `items.grantRole(MINTER_ROLE, checkpoint)` (if not set at deploy), `checkpoint.setItems(items)`, then `registerFungible` for any later slugs. **No Items redeploy** for new types.

## Mint fee

- Official Gnosis / Chiado entrypoint (`DeployChiado`): default **1 xDAI** (`MINT_FEE` unset → `1 ether` wei).
- Anvil (`Deploy`): default `0.001 ether`.

## Deploy + verify

### Fork dry-run (recommended before go-ahead)

Spins up `anvil --fork-url` against Gnosis and runs `DeployChiado` **without `--broadcast`**:

```bash
cd contracts/lok-log
GNOSIS_RPC_URL=https://rpc.gnosischain.com ./script/simulate-deploy-gnosis-fork.sh
```

Uses placeholder distinct role addresses (`SIM_*` overridable). Confirms role guards + 1 xDAI mint fee path on a live fork tip. No mainnet txs.

### Fork e2e: mint (1 xDAI) + AH list/buy

Automated test (local anvil fork only; never broadcasts to public RPCs):

```bash
# optional: GNOSIS_RPC_URL=https://rpc.gnosischain.com
pnpm --filter @bellgrave/server exec tsx --test src/gnosis-fork-mint-ah.test.ts
```

Deploys `GnosisForkMintAhFixture` onto the fork, mints two characters at **1 xDAI**, `openAsk` + `buyAsk`, and asserts gnosisscan URL shaping. Web unit coverage: `pnpm --filter @bellgrave/web test` (AppKit/xDAI labels + explorer links).

### Simulation against your filled `.env.gnosis` (still no broadcast)

```bash
cd contracts/lok-log
set -a && source .env.gnosis && set +a   # gitignored; no secrets in git

forge script script/DeployChiado.s.sol:DeployChiado --rpc-url "$RPC_URL" --sig "run()"

# Broadcast only with go-ahead
# forge script script/DeployChiado.s.sol:DeployChiado --rpc-url "$RPC_URL" --broadcast --slow --sig "run()"

# Verify implementations (from Deploy console logs)
NFT_IMPL=0x... CHECKPOINT_IMPL=0x... FACTORY_IMPL=0x... RULESETS_IMPL=0x... \
AH_ESCROW=0x... DEPLOYER=0x... NFT_PROXY=0x... FEE_RECIPIENT=0x... \
CHAIN_ID=100 VERIFIERS="sourcify blockscout" \
  ./script/verify-deploy.sh
```

## Ruleset proposal (48h timelock)

`RulesetRegistry` is initialized with **`minDelay = 48 hours`**.

1. Proposer EOA (or Safe if you re-assign) calls:
   `rulesets.propose(rulesetHash, delay, uri)` with `delay >= minDelay` (typically `48 hours`).
2. Wait until `activatesAt` (propose time + delay). Do **not** point production checkpoints at the hash before activation.
3. Engine wasm pin must match the proposed ruleset (see `LOCAL_RULESET_WASM_SHA256` / pin tests). For mainnet, propose a **new** hash bound to the audited wasm.
4. Emergency role (Safe) can cancel a pending ruleset if needed.

## Post-deploy checklist

1. Roles: admin = Safe; listing/rotator/proposer = intended EOAs; feeRecipient correct; deployer admin/listing dropped.
2. `factory.setStartingJob(job, true)` for each starting job.
3. Items: `MINTER_ROLE` → checkpoint; `setItems`; register launch slugs (if `ITEMS != 0`).
4. Ruleset propose + 48h wait.
5. Sourcify/Blockscout green on all four impls + AhEscrow (+ Items).
6. Fund listing/rotator with minimal xDAI; sweep leftovers to treasury after ops.
7. Server: copy `apps/server/.env.gnosis.example` → `.env.local` (`NETWORK=gnosis`, `LOK_LISTING_KEY`, `LOK_DEPLOY_BLOCK`). Blank `LOK_NFT`/`LOK_FACTORY`/`LOK_AH_ESCROW` fill from deploy JSON **only after official deploy** — never the dry-run MockItems Checkpoint. Web: `VITE_WALLETCONNECT_PROJECT_ID` + `VITE_NETWORK=gnosis` (or `VITE_CHAIN_ID=100`).
8. Confirmations: profile default 2 blocks (~10s); override with `LOK_CONFIRMATIONS`. RPC fallbacks: `LOK_CHAIN_RPC_URLS` (comma list from the gnosis profile).

## Ops (production server)

| Probe | URL | Meaning |
|-------|-----|---------|
| Liveness | `GET /health` | Process up (always 200 when listening) |
| Readiness | `GET /ready` | Lok data dir open; RPC not stuck in hard fail |
| Status | `GET /status` | JSON: network, RPC stats, watcher lags, dropped-cancel + quarantine counts, recent structured alerts |

Same `PORT` as the WebSocket game server (default `8787`).

**Structured alerts** — stderr JSON lines (`event`: `watcher_lag`, `nft_transfer_cancel_dropped`, `ask_filled_quarantine`). Lag threshold: `LOK_WATCHER_LAG_ALERT_BLOCKS` (default 50). Durable files under `LOK_DATA_DIR`:

- `nft-transfer-cancel-dropped.json`
- `lok-ask-filled-quarantine.json`

**Backups** (cron recommended, e.g. hourly):

```bash
cd apps/server
LOK_DATA_DIR=./data BACKUP_ROOT=./backups RETAIN=48 ./scripts/backup-data-dir.sh
```

Keys are never in the data dir — only rotate/sweep EOAs separately.

## Dry-run stuck funds (2026-10-12)

Ephemeral deployer + smoke wallets still hold ~2.15 xDAI; private keys were deleted from the agent VM and could not be recovered. Addresses in `deployments/gnosis.json` → `stuckFunds`. No further admin txs on that deploy unless asked.
