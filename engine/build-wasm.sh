#!/usr/bin/env bash
# Build ba-stick-render to wasm + JS bindings in engine/ba-stick-render/pkg.
# Needs: rustup target wasm32-unknown-unknown, wasm-bindgen-cli matching Cargo.lock.
set -euo pipefail
cd "$(dirname "$0")"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/target}"
cargo build --release --target wasm32-unknown-unknown -p ba_stick_render
wasm-bindgen --target web --out-dir ba-stick-render/pkg \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/ba_stick_render.wasm"
echo "wrote engine/ba-stick-render/pkg"
