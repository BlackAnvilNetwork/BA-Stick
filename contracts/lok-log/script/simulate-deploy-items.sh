#!/usr/bin/env bash
# Simulate DeployItems against a local anvil or $RPC_URL (no broadcast).
# Seeds all kind=base catalog slugs from @bellgrave/items.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/contracts/lok-log"

# Prefer SIM_* so a shell with production ADMIN/CHECKPOINT does not get reused.
export ADMIN="${SIM_ADMIN:-${ADMIN:-0x00000000000000000000000000000000000000A1}}"
export ITEMS_BASE_URI="${ITEMS_BASE_URI:-https://legendofkek.com/items/}"
export CHECKPOINT="${SIM_CHECKPOINT:-0x00000000000000000000000000000000000000C1}"
if [[ -z "${ITEMS_SEED_SLUGS:-}" ]]; then
  ITEMS_SEED_SLUGS="$(pnpm --filter @bellgrave/items print-seed)"
  export ITEMS_SEED_SLUGS
fi

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
echo "[simulate-deploy-items] ADMIN=$ADMIN CHECKPOINT=$CHECKPOINT"
echo "[simulate-deploy-items] seed slugs: $(echo "$ITEMS_SEED_SLUGS" | awk -F, '{print NF}')"
echo "[simulate-deploy-items] forge script (no --broadcast) rpc=$RPC_URL"

forge script script/DeployItems.s.sol:DeployItems \
  --rpc-url "$RPC_URL" \
  --sig "run()" \
  -vv
