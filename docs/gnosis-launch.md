# Gnosis official launch runbook

**Dry-run note:** The 2026-10-12 deploy on chain 100 (`deployments/gnosis.json`) was a dry-run mainnet launch. It wired **MockItems** and collapsed roles onto one EOA — do **not** treat it as production. Official launch must use this runbook + the hardened `Deploy` script.

**Hard stops:** no broadcast without go-ahead; no merge without go-ahead; no admin txs on the dry-run deployment unless explicitly requested.

## Role separation (required)

| Role | Who | Env |
|------|-----|-----|
| `ADMIN` (+ default `EMERGENCY`, `GUARDIAN`) | Safe multisig | `ADMIN` (optional `EMERGENCY` / `GUARDIAN`, default = ADMIN) |
| `FEE_RECIPIENT` | Treasury (distinct from Safe + server keys) | `FEE_RECIPIENT` |
| `LISTING` | Server EOA (`openAsk` / `cancelAsk`) | `LISTING` |
| `ROTATOR` | Server EOA (checkpoint signers) | `ROTATOR` |
| `PROPOSER` | Server EOA (ruleset proposes) | `PROPOSER` |

On chainid ≠ 31337 the script **reverts** if listing/rotator/proposer are not pairwise distinct, or if any equals admin or feeRecipient, or if feeRecipient equals admin.

## Items / KEK (HIGH)

- Pass a **real access-controlled** ERC-1155 as `ITEMS`, **or** `ITEMS=0x000…000` (imports/exports stay off via `NotConfigured`).
- **Never** run `DeployChiadoMocks` / wire `MockItems` / `MockKEK` on 100 or 10200. Those mocks expose open `setMinter`. The deploy script calls `isBellgraveTestMock()` and reverts on non-anvil if a mock is passed.
- After a real items deploy: Safe calls `items.setMinter(checkpoint, true)`.

## Mint fee

- Official Gnosis / Chiado entrypoint (`DeployChiado`): default **1 xDAI** (`MINT_FEE` unset → `1 ether` wei).
- Anvil (`Deploy`): default `0.001 ether`.

## Deploy + verify

```bash
cd contracts/lok-log
set -a && source .env.gnosis && set +a   # gitignored; no secrets in git

# Simulation first
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
3. Items minter (if `ITEMS != 0`).
4. Ruleset propose + 48h wait.
5. Sourcify/Blockscout green on all four impls + AhEscrow.
6. Fund listing/rotator with minimal xDAI; sweep leftovers to treasury after ops.
7. Server env: `LOK_CHAIN_ID=100`, RPCs, escrow/nft/factory addresses, listing key — **never** commit keys.

## Dry-run stuck funds (2026-10-12)

Ephemeral deployer + smoke wallets still hold ~2.15 xDAI; private keys were deleted from the agent VM and could not be recovered. Addresses in `deployments/gnosis.json` → `stuckFunds`. No further admin txs on that deploy unless asked.
