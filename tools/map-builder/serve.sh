#!/usr/bin/env bash
# Local map-builder server: MAP_BUILDER_DEV on, own data dir, own edits file.
# Uses the local anvil (127.0.0.1:8545) only. Never point this at a live chain.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-8797}"
RPC="${RPC:-http://127.0.0.1:8545}"
FACTORY="$(jq -r .contracts.CharacterFactory "$ROOT/deployments/anvil.json")"
NFT="$(jq -r .contracts.CharacterNFT "$ROOT/deployments/anvil.json")"
CAST="${CAST:-$HOME/.foundry/bin/cast}"
CHECKPOINT="$("$CAST" call "$FACTORY" "state()(address)" --rpc-url "$RPC")"
mkdir -p "$ROOT/tmp/map-builder-data"
cd "$ROOT/apps/server"
exec env PORT="$PORT" MAP_BUILDER_DEV=1 \
  LOK_DATA_DIR="$ROOT/tmp/map-builder-data" \
  FOREST_BASIN_EDITS_PATH="${FOREST_BASIN_EDITS_PATH:-$ROOT/tmp/forest-basin-edits.json}" \
  LOK_CHAIN_ID=31337 LOK_CHAIN_RPC="$RPC" LOK_PUBLIC_RPC="$RPC" \
  LOK_NFT="$NFT" LOK_FACTORY="$FACTORY" LOK_CHECKPOINT="$CHECKPOINT" \
  ./node_modules/.bin/tsx src/index.ts
