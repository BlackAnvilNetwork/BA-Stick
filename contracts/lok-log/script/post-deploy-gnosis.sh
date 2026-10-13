#!/usr/bin/env bash
# Post-deploy: setStartingJob(1), role checks, write deployments/gnosis.json from broadcast logs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
cd "$ROOT"

RPC_URL="${RPC_URL:-${GNOSIS_RPC_URL:-https://rpc.gnosischain.com}}"
: "${RPC_URL:?}"

ensure_private_key() {
  if [[ -n "${PRIVATE_KEY:-}" ]] && cast wallet address --private-key "$PRIVATE_KEY" >/dev/null 2>&1; then
    return 0
  fi
  local env_file="${LOK_DEPLOY_ENV_FILE:-$ROOT/.env}"
  if [[ ! -f "$env_file" ]]; then
    echo "post-deploy-gnosis: PRIVATE_KEY missing or invalid and no $env_file" >&2
    exit 1
  fi
  PRIVATE_KEY="$(
    python3 - <<'PY' "$env_file"
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r"^PRIVATE_KEY=(.*)$", text, re.M)
if not m:
    sys.exit(1)
print(m.group(1).strip().strip('"').strip("'"))
PY
  )" || exit 1
  export PRIVATE_KEY
}
ensure_private_key
: "${ADMIN:?}"
: "${LISTING:?}"
: "${ROTATOR:?}"
: "${PROPOSER:?}"
: "${FEE_RECIPIENT:?}"

NFT="${NFT_PROXY:-${CHARACTER_NFT:-}}"
FACTORY="${FACTORY_PROXY:-${CHARACTER_FACTORY:-}}"
CHECKPOINT="${CHECKPOINT_PROXY:-${CHARACTER_CHECKPOINT:-}}"
RULESETS="${RULESET_REGISTRY:-}"
AH="${AH_ESCROW:-}"

if [[ -z "$NFT" || -z "$FACTORY" || -z "$CHECKPOINT" || -z "$RULESETS" || -z "$AH" ]]; then
  echo "post-deploy-gnosis: set NFT_PROXY, FACTORY_PROXY, CHECKPOINT_PROXY, RULESET_REGISTRY, AH_ESCROW" >&2
  exit 1
fi

echo "[post-deploy] factory.setStartingJob(1, true)"
cast send "$FACTORY" "setStartingJob(uint8,bool)" 1 true \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --json | jq -r '.transactionHash // .hash // empty'

DEFAULT_ADMIN="0x0000000000000000000000000000000000000000000000000000000000000000"
LISTING_ROLE="$(cast call "$AH" "LISTING_ROLE()(bytes32)" --rpc-url "$RPC_URL")"
PROPOSER_ROLE="$(cast call "$RULESETS" "PROPOSER_ROLE()(bytes32)" --rpc-url "$RPC_URL")"

check_role() {
  local contract="$1" role="$2" holder="$3" label="$4"
  local ok
  ok="$(cast call "$contract" "hasRole(bytes32,address)(bool)" "$role" "$holder" --rpc-url "$RPC_URL")"
  echo "$label hasRole($holder)=$ok"
}

echo "[post-deploy] role checks"
check_role "$NFT" "$DEFAULT_ADMIN" "$ADMIN" "CharacterNFT DEFAULT_ADMIN"
check_role "$AH" "$LISTING_ROLE" "$LISTING" "AhEscrow LISTING"
check_role "$RULESETS" "$PROPOSER_ROLE" "$PROPOSER" "RulesetRegistry PROPOSER"
check_role "$CHECKPOINT" "$DEFAULT_ADMIN" "$ADMIN" "Checkpoint DEFAULT_ADMIN"

BROADCAST_JSON="$ROOT/broadcast/DeployChiado.s.sol/100/run-latest.json"
if [[ -z "${DEPLOY_BLOCK:-}" && -f "$BROADCAST_JSON" ]] && command -v jq >/dev/null; then
  DEPLOY_BLOCK="$(jq -r '.receipts[0].blockNumber // empty' "$BROADCAST_JSON" | python3 -c "import sys; s=sys.stdin.read().strip(); print(int(s,16) if s.startswith('0x') else s)" 2>/dev/null || true)"
fi
DEPLOY_BLOCK="${DEPLOY_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"
TXS='[]'
if [[ -f "$BROADCAST_JSON" ]] && command -v jq >/dev/null; then
  TXS="$(jq '[.transactions[]?.hash // empty] | map(select(. != null))' "$BROADCAST_JSON")"
fi

OUT="$REPO/deployments/gnosis.json"
mkdir -p "$(dirname "$OUT")"
jq -n \
  --arg network "gnosis" \
  --argjson chainId 100 \
  --arg deployedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg admin "$ADMIN" \
  --arg feeRecipient "$FEE_RECIPIENT" \
  --arg listing "$LISTING" \
  --arg rotator "$ROTATOR" \
  --arg proposer "$PROPOSER" \
  --arg timelock "${TIMELOCK:-}" \
  --arg nft "$NFT" \
  --arg checkpoint "$CHECKPOINT" \
  --arg factory "$FACTORY" \
  --arg rulesets "$RULESETS" \
  --arg ah "$AH" \
  --arg deployBlock "$DEPLOY_BLOCK" \
  --argjson txs "$TXS" \
  '{
    network: $network,
    chainId: $chainId,
    explorer: "https://gnosisscan.io",
    blockscout: "https://gnosis.blockscout.com",
    deployedAt: $deployedAt,
    deployBlock: ($deployBlock | tonumber),
    mintFeeWei: "1000000000000000000",
    mintFee: "1 xDAI",
    admin: $admin,
    feeRecipient: $feeRecipient,
    timelock: (if $timelock == "" then null else $timelock end),
    listingRole: $listing,
    rotator: $rotator,
    proposer: $proposer,
    allowEoaAdmin: true,
    contracts: {
      CharacterNFT: $nft,
      CharacterCheckpoint: $checkpoint,
      CharacterFactory: $factory,
      RulesetRegistry: $rulesets,
      AhEscrow: $ah
    },
    roles: {
      DEFAULT_ADMIN_ROLE: $admin,
      LISTING_ROLE: $listing,
      PROPOSER_ROLE: $proposer
    },
    transactions: {
      deployPackage: $txs
    }
  }' > "$OUT"

echo "[post-deploy] wrote $OUT"
