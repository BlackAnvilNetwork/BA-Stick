#!/usr/bin/env bash
# Verify UUPS implementations (+ AhEscrow) on Sourcify and optionally Blockscout.
# Usage (from contracts/lok-log):
#   NFT_IMPL=0x... CHECKPOINT_IMPL=0x... FACTORY_IMPL=0x... RULESETS_IMPL=0x... \
#   AH_ESCROW=0x... DEPLOYER=0x... NFT_PROXY=0x... FEE_RECIPIENT=0x... \
#   CHAIN_ID=100 ./script/verify-deploy.sh
#
# Or: ./script/verify-deploy.sh ../../deployments/gnosis-dryrun.json
# (JSON path mode needs `jq` and implementation addresses in the JSON — prefer env after Deploy logs.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHAIN_ID="${CHAIN_ID:-100}"
VERIFIERS="${VERIFIERS:-sourcify}" # space-separated: sourcify blockscout

if [[ "${1:-}" == *.json ]]; then
  echo "JSON helper: export impl addresses from Deploy console logs into env, then re-run."
  echo "Provided: $1"
  exit 1
fi

: "${NFT_IMPL:?}"
: "${CHECKPOINT_IMPL:?}"
: "${FACTORY_IMPL:?}"
: "${RULESETS_IMPL:?}"
: "${AH_ESCROW:?}"
: "${DEPLOYER:?}"
: "${NFT_PROXY:?}"
: "${FEE_RECIPIENT:?}"

BLOCKSCOUT_URL="${BLOCKSCOUT_URL:-https://gnosis.blockscout.com/api/}"

verify_one() {
  local addr="$1"
  local contract="$2"
  local ctor_args="${3:-}"
  local v
  for v in $VERIFIERS; do
    echo "==> verify $contract at $addr via $v"
    if [[ "$v" == "sourcify" ]]; then
      if [[ -n "$ctor_args" ]]; then
        forge verify-contract --chain-id "$CHAIN_ID" --verifier sourcify \
          --constructor-args "$ctor_args" "$addr" "$contract" || true
      else
        forge verify-contract --chain-id "$CHAIN_ID" --verifier sourcify \
          "$addr" "$contract" || true
      fi
    elif [[ "$v" == "blockscout" ]]; then
      if [[ -n "$ctor_args" ]]; then
        forge verify-contract --chain-id "$CHAIN_ID" --verifier blockscout \
          --verifier-url "$BLOCKSCOUT_URL" \
          --constructor-args "$ctor_args" "$addr" "$contract" || true
      else
        forge verify-contract --chain-id "$CHAIN_ID" --verifier blockscout \
          --verifier-url "$BLOCKSCOUT_URL" "$addr" "$contract" || true
      fi
    else
      echo "unknown verifier: $v" >&2
      exit 1
    fi
  done
}

# Implementations (no constructor args for OZ UUPS impls)
verify_one "$NFT_IMPL" "src/CharacterNFT.sol:CharacterNFT"
verify_one "$CHECKPOINT_IMPL" "src/CharacterCheckpoint.sol:CharacterCheckpoint"
verify_one "$FACTORY_IMPL" "src/CharacterFactory.sol:CharacterFactory"
verify_one "$RULESETS_IMPL" "src/RulesetRegistry.sol:RulesetRegistry"

AH_CTOR=$(cast abi-encode "constructor(address,address,address)" "$DEPLOYER" "$NFT_PROXY" "$FEE_RECIPIENT")
verify_one "$AH_ESCROW" "src/AhEscrow.sol:AhEscrow" "$AH_CTOR"

echo "Done. Check Sourcify/Blockscout UI for each address. Proxy verification is optional (impl is what matters)."
