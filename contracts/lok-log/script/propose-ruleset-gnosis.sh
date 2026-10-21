#!/usr/bin/env bash
# Propose the #212 / a24ea88 production ruleset on Gnosis RulesetRegistry.
# HARD STOP: refuses --broadcast unless CONFIRM_BROADCAST=1.
# Requires PROPOSER_KEY for 0x82DC7FF0f2E199799a1028fE3c5702dF6Fe6f697 (never commit).
# Does not fund the proposer — exits if balance is too low.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC_URL="${RPC_URL:-${GNOSIS_RPC_URL:-https://rpc.gnosischain.com}}"
RULESETS="${RULESETS:-${RULESET_REGISTRY:-0xdd7B66451529918273fe4E0d9f9fdf261194a6e0}}"
# Opaque id from apps/server/src/lok-vault.ts (LOCAL_RULESET_HASH) at a24ea88 / #212
RULESET_HASH="${RULESET_HASH:-0xb7e4d1c9a8f6520e3d7c6b5a49382716f0e1d2c3b4a5968778695a4b3c2d1e0f}"
WASM_SHA256="${WASM_SHA256:-bbf77ab29b31bc869891028d83ab1ee85f4d84a9137f8631d05c4c0876496510}"
URI="${RULESET_URI:-blackanvil/ruleset/${WASM_SHA256}}"
DELAY="${RULESET_DELAY:-172800}" # 48h == registry minDelay
EXPECTED_PROPOSER="${EXPECTED_PROPOSER:-0x82DC7FF0f2E199799a1028fE3c5702dF6Fe6f697}"

if [[ "${CONFIRM_BROADCAST:-}" != "1" ]]; then
  echo "propose-ruleset-gnosis: refusing broadcast (set CONFIRM_BROADCAST=1)." >&2
  exit 1
fi

: "${PROPOSER_KEY:?set PROPOSER_KEY (private key for EXPECTED_PROPOSER)}"

FROM="$(cast wallet address --private-key "$PROPOSER_KEY")"
if [[ "${FROM,,}" != "${EXPECTED_PROPOSER,,}" ]]; then
  echo "propose-ruleset-gnosis: PROPOSER_KEY derives to $FROM, expected $EXPECTED_PROPOSER" >&2
  exit 1
fi

BAL_WEI="$(cast balance "$FROM" --rpc-url "$RPC_URL")"
# ~84k gas * headroom; require at least 0.001 xDAI
MIN_WEI=1000000000000000
if [[ "$(python3 -c "print(1 if int('$BAL_WEI') < $MIN_WEI else 0)")" == "1" ]]; then
  echo "propose-ruleset-gnosis: PROPOSER $FROM has ${BAL_WEI} wei (~$(cast --from-wei "$BAL_WEI" ether) xDAI)." >&2
  echo "Fund with ~0.01 xDAI for gas, then re-run. This script will not fund the wallet." >&2
  exit 1
fi

if [[ "$(cast call "$RULESETS" "isAccepted(bytes32)(bool)" "$RULESET_HASH" --rpc-url "$RPC_URL")" == "true" ]]; then
  echo "propose-ruleset-gnosis: $RULESET_HASH already accepted" >&2
  exit 0
fi

# Already proposed? activatesAt != 0
# No public getter for activatesAt alone via isAccepted; try propose and let AlreadyProposed revert.

echo "[propose-ruleset-gnosis] proposing $RULESET_HASH delay=$DELAY uri=$URI from $FROM"
TX="$(cast send "$RULESETS" "propose(bytes32,uint64,string)" "$RULESET_HASH" "$DELAY" "$URI" \
  --rpc-url "$RPC_URL" \
  --private-key "$PROPOSER_KEY" \
  --json)"
HASH="$(echo "$TX" | jq -r '.transactionHash // .hash // empty')"
echo "tx=$HASH"

# Decode activatesAt from receipt logs if possible (topic RulesetProposed)
BLOCK_TS="$(cast block "$(echo "$TX" | jq -r '.blockNumber')" --rpc-url "$RPC_URL" --field timestamp)"
ACTIVATES_AT=$((BLOCK_TS + DELAY))
echo "rulesetHash=$RULESET_HASH"
echo "delaySeconds=$DELAY"
echo "activatesAt=$ACTIVATES_AT ($(date -u -d "@$ACTIVATES_AT" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$ACTIVATES_AT" +%Y-%m-%dT%H:%M:%SZ))"
echo "activation: wait until activatesAt; no further tx — isAccepted becomes true automatically."
echo "wasmPin=$WASM_SHA256"
