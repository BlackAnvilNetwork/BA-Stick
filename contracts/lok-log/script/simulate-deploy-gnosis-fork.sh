#!/usr/bin/env bash
# Dry-run the official DeployChiado package against a Gnosis mainnet fork.
# NO broadcast. NO mainnet txs. Requires a public (or Alchemy) Gnosis RPC.
#
# Usage:
#   GNOSIS_RPC_URL=https://rpc.gnosischain.com ./script/simulate-deploy-gnosis-fork.sh
#   # or: FORK_URL=... ANVIL_PORT=8547 ./script/simulate-deploy-gnosis-fork.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FORK_URL="${FORK_URL:-${GNOSIS_RPC_URL:-https://rpc.gnosischain.com}}"
ANVIL_PORT="${ANVIL_PORT:-8547}"
FORK_RPC="http://127.0.0.1:${ANVIL_PORT}"

# Placeholder roles — distinct; Safe-shaped admin. Not real keys.
export ADMIN="${SIM_ADMIN:-0x1111111111111111111111111111111111111111}"
export FEE_RECIPIENT="${SIM_FEE_RECIPIENT:-0x2222222222222222222222222222222222222222}"
export LISTING="${SIM_LISTING:-0x3333333333333333333333333333333333333333}"
export ROTATOR="${SIM_ROTATOR:-0x4444444444444444444444444444444444444444}"
export PROPOSER="${SIM_PROPOSER:-0x5555555555555555555555555555555555555555}"
export EMERGENCY="${SIM_EMERGENCY:-$ADMIN}"
export GUARDIAN="${SIM_GUARDIAN:-$ADMIN}"
export ITEMS="${SIM_ITEMS:-0x0000000000000000000000000000000000000000}"
export KEK="${SIM_KEK:-0x0000000000000000000000000000000000000000}"
export BASE_URI="${BASE_URI:-https://legendofkek.com/nft/}"
# 1 xDAI mint fee (DeployChiado default when unset)
unset MINT_FEE || true

echo "[simulate-deploy-gnosis-fork] fork=$FORK_URL anvil=:$ANVIL_PORT"
echo "[simulate-deploy-gnosis-fork] ADMIN=$ADMIN FEE=$FEE_RECIPIENT LISTING=$LISTING"

ANVIL_PID=""
cleanup() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

anvil --fork-url "$FORK_URL" --port "$ANVIL_PORT" --silent >/tmp/anvil-gnosis-fork.log 2>&1 &
ANVIL_PID=$!
sleep 2
if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "anvil failed to start; see /tmp/anvil-gnosis-fork.log" >&2
  cat /tmp/anvil-gnosis-fork.log >&2 || true
  exit 1
fi

# Anvil default first account broadcasts when --broadcast is omitted; we still
# only simulate (no --broadcast).
forge script script/DeployChiado.s.sol:DeployChiado \
  --rpc-url "$FORK_RPC" \
  --sig "run()" \
  -vv

echo "[simulate-deploy-gnosis-fork] SIMULATION COMPLETE (no broadcast)."
