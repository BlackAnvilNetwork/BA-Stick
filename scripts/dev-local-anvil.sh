#!/usr/bin/env bash
# Local-only dev stack for BA-Stick: throwaway anvil (31337) + MintFixture + game server.
# Never points at Gnosis/Chiado. Uses anvil's public default account 0 (read from anvil's
# config file, never printed). Data dir is a temp dir.
#
#   ./scripts/dev-local-anvil.sh          # then: pnpm --filter @bellgrave/stick-web dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
STATE="${BA_DEV_STATE:-/tmp/ba-dev}"
mkdir -p "$STATE"
RPC=http://127.0.0.1:8545

if ! cast chain-id --rpc-url $RPC >/dev/null 2>&1; then
  anvil --silent --config-out "$STATE/anvil.json" >"$STATE/anvil.log" 2>&1 &
  for _ in $(seq 50); do cast chain-id --rpc-url $RPC >/dev/null 2>&1 && break; sleep 0.2; done
fi
[ "$(cast chain-id --rpc-url $RPC)" = "31337" ] || { echo "refusing: $RPC is not anvil 31337" >&2; exit 1; }

cd "$ROOT/contracts/lok-log"
if [ ! -d lib/forge-std ]; then
  forge install --no-git foundry-rs/forge-std@v1.17.0 OpenZeppelin/openzeppelin-contracts@v5.4.0 \
    OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0 >/dev/null
fi
SENDER=$(python3 -c "import json;print(json.load(open('$STATE/anvil.json'))['available_accounts'][0])")
OUT=$(forge script script/MintFixture.s.sol --rpc-url $RPC --broadcast --unlocked --sender "$SENDER" 2>&1)
NFT=$(echo "$OUT" | awk '/  NFT /{print $2}')
FACTORY=$(echo "$OUT" | awk '/  FACTORY /{print $2}')
CHECKPOINT=$(cast call "$FACTORY" "state()(address)" --rpc-url $RPC)
echo "nft=$NFT factory=$FACTORY checkpoint=$CHECKPOINT"

cd "$ROOT/apps/server"
rm -rf "$STATE/data" && mkdir -p "$STATE/data"
LOK_OWNER_KEY=$(python3 -c "import json;print(json.load(open('$STATE/anvil.json'))['private_keys'][0])") \
LOK_REPLICA=1 NETWORK=anvil PORT=8787 LOK_DATA_DIR="$STATE/data" LOK_CHAIN_ID=31337 LOK_CHAIN_RPC=$RPC \
LOK_NFT="$NFT" LOK_FACTORY="$FACTORY" LOK_CHECKPOINT="$CHECKPOINT" ALLOW_DEBUG_CHEATS=1 \
  exec npx tsx src/index.ts
