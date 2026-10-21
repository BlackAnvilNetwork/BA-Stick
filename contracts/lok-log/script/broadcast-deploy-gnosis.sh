#!/usr/bin/env bash
# Official Gnosis mainnet (100) DeployChiado broadcast (+ optional verify).
# HARD STOP: refuses --broadcast unless CONFIRM_BROADCAST=1.
#
# EOA admin (one-off): set ALLOW_EOA_ADMIN=1 — see docs/gnosis-launch.md.
# Deploys TimelockController first when TIMELOCK is unset.
#
# Usage:
#   set -a && source .env.gnosis && set +a
#   CONFIRM_BROADCAST=1 ./script/broadcast-deploy-gnosis.sh
#   CONFIRM_BROADCAST=1 VERIFY=1 ./script/broadcast-deploy-gnosis.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC_URL="${RPC_URL:-${GNOSIS_RPC_URL:-https://rpc.gnosischain.com}}"
: "${RPC_URL:?set RPC_URL or GNOSIS_RPC_URL}"

# Cloud shells often export a placeholder PRIVATE_KEY; prefer lok-log/.env when decode fails.
ensure_private_key() {
  if [[ -n "${PRIVATE_KEY:-}" ]] && cast wallet address --private-key "$PRIVATE_KEY" >/dev/null 2>&1; then
    return 0
  fi
  local env_file="${LOK_DEPLOY_ENV_FILE:-$ROOT/.env}"
  if [[ ! -f "$env_file" ]]; then
    echo "broadcast-deploy-gnosis: PRIVATE_KEY missing or invalid and no $env_file" >&2
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
  )" || {
    echo "broadcast-deploy-gnosis: could not read PRIVATE_KEY from $env_file" >&2
    exit 1
  }
  export PRIVATE_KEY
}
ensure_private_key
: "${ADMIN:?}"
: "${FEE_RECIPIENT:?}"
: "${LISTING:?}"
: "${ROTATOR:?}"
: "${PROPOSER:?}"

redact_rpc() {
  local u="$1"
  if [[ "$u" =~ ^(https?://[^/]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "(redacted)"
  fi
}
RPC_LOG="$(redact_rpc "$RPC_URL")"

if [[ "${CONFIRM_BROADCAST:-}" != "1" ]]; then
  echo "broadcast-deploy-gnosis: refusing --broadcast (set CONFIRM_BROADCAST=1 after go-ahead)." >&2
  exit 1
fi

export CHAIN_ID="${CHAIN_ID:-100}"
export FOUNDRY_ETH_RPC_URL="$RPC_URL"
DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"
export DEPLOYER
FORGE_BROADCAST_ARGS=(--private-key "$PRIVATE_KEY" --sender "$DEPLOYER")

if [[ -z "${TIMELOCK:-}" ]]; then
  echo "[broadcast-deploy-gnosis] deploying TimelockController to $RPC_LOG (from $DEPLOYER)"
  TL_LOG="$(mktemp)"
  forge script script/DeployTimelock.s.sol:DeployTimelock \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --slow \
    --sig "run()" \
    "${FORGE_BROADCAST_ARGS[@]}" \
    -vv | tee "$TL_LOG"
  export TIMELOCK="$(grep -E '^[[:space:]]*TimelockController[[:space:]]+0x' "$TL_LOG" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1 || true)"
  rm -f "$TL_LOG"
  if [[ -z "$TIMELOCK" ]]; then
    echo "broadcast-deploy-gnosis: could not parse TimelockController address from logs" >&2
    exit 1
  fi
  echo "[broadcast-deploy-gnosis] TIMELOCK=$TIMELOCK"
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo "[broadcast-deploy-gnosis] broadcasting DeployChiado to $RPC_LOG"
forge script script/DeployChiado.s.sol:DeployChiado \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow \
  --sig "run()" \
  "${FORGE_BROADCAST_ARGS[@]}" \
  -vv | tee "$LOG"

if [[ "${VERIFY:-}" != "1" ]]; then
  echo "[broadcast-deploy-gnosis] done (set VERIFY=1 to run Sourcify/Blockscout)."
  exit 0
fi

pick() {
  local label="$1"
  grep -E "^[[:space:]]*$label[[:space:]]+0x" "$LOG" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1 || true
}

export NFT_IMPL="$(pick nftImpl)"
export CHECKPOINT_IMPL="$(pick checkpointImpl)"
export FACTORY_IMPL="$(pick factoryImpl)"
export RULESETS_IMPL="$(pick rulesetsImpl)"
export AH_ESCROW="$(pick AhEscrow)"
export NFT_PROXY="$(pick CharacterNFT)"
export DEPLOYER="${DEPLOYER:-$(cast wallet address --private-key "$PRIVATE_KEY")}"
export FEE_RECIPIENT="${FEE_RECIPIENT}"
export CHAIN_ID="${CHAIN_ID:-100}"
export VERIFIERS="${VERIFIERS:-sourcify blockscout}"

missing=0
for v in NFT_IMPL CHECKPOINT_IMPL FACTORY_IMPL RULESETS_IMPL AH_ESCROW NFT_PROXY DEPLOYER; do
  if [[ -z "${!v:-}" ]]; then
    echo "broadcast-deploy-gnosis: could not parse $v from forge log — run verify-deploy.sh manually." >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "[broadcast-deploy-gnosis] verifying via script/verify-deploy.sh"
./script/verify-deploy.sh
