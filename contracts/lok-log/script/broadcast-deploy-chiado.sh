#!/usr/bin/env bash
# Official DeployChiado broadcast (+ optional Sourcify verify).
# HARD STOP: refuses --broadcast unless CONFIRM_BROADCAST=1 (explicit go-ahead).
#
# Usage (after filling .env.gnosis — never commit secrets):
#   set -a && source .env.gnosis && set +a
#   CONFIRM_BROADCAST=1 ./script/broadcast-deploy-chiado.sh
#   CONFIRM_BROADCAST=1 VERIFY=1 ./script/broadcast-deploy-chiado.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC_URL="${RPC_URL:-${GNOSIS_RPC_URL:-}}"
: "${RPC_URL:?set RPC_URL or GNOSIS_RPC_URL}"
: "${PRIVATE_KEY:?}"
: "${ADMIN:?}"
: "${FEE_RECIPIENT:?}"
: "${LISTING:?}"
: "${ROTATOR:?}"
: "${PROPOSER:?}"

# scheme://host only — never echo API keys in the path
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
  echo "broadcast-deploy-chiado: refusing --broadcast (set CONFIRM_BROADCAST=1 after go-ahead)." >&2
  echo "Dry-run instead: forge script script/DeployChiado.s.sol:DeployChiado --rpc-url \"\$RPC_URL\" --sig 'run()' -vv" >&2
  exit 1
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo "[broadcast-deploy-chiado] broadcasting DeployChiado to $RPC_LOG"
forge script script/DeployChiado.s.sol:DeployChiado \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow \
  --sig "run()" \
  -vv | tee "$LOG"

if [[ "${VERIFY:-}" != "1" ]]; then
  echo "[broadcast-deploy-chiado] done (set VERIFY=1 to run Sourcify after broadcast)."
  exit 0
fi

# Parse implementation / proxy addresses from Deploy console logs.
pick() {
  local label="$1"
  grep -E "^[[:space:]]*$label[[:space:]]+0x" "$LOG" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1 || true
}

export NFT_IMPL="$(pick NFT_IMPL || pick 'NFT impl' || true)"
export CHECKPOINT_IMPL="$(pick CHECKPOINT_IMPL || pick 'Checkpoint impl' || true)"
export FACTORY_IMPL="$(pick FACTORY_IMPL || pick 'Factory impl' || true)"
export RULESETS_IMPL="$(pick RULESETS_IMPL || pick 'Rulesets impl' || true)"
export AH_ESCROW="$(pick AhEscrow || pick AH_ESCROW || true)"
export NFT_PROXY="$(pick CharacterNFT || pick NFT_PROXY || pick 'NFT proxy' || true)"
export DEPLOYER="$(pick Deployer || pick DEPLOYER || true)"
export FEE_RECIPIENT="${FEE_RECIPIENT}"
export CHAIN_ID="${CHAIN_ID:-100}"
export VERIFIERS="${VERIFIERS:-sourcify blockscout}"

missing=0
for v in NFT_IMPL CHECKPOINT_IMPL FACTORY_IMPL RULESETS_IMPL AH_ESCROW NFT_PROXY DEPLOYER; do
  if [[ -z "${!v:-}" ]]; then
    echo "broadcast-deploy-chiado: could not parse $v from forge log — run verify-deploy.sh manually." >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "[broadcast-deploy-chiado] verifying via script/verify-deploy.sh"
./script/verify-deploy.sh
