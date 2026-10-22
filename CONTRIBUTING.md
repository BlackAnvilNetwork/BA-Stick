# Contributing to BA-Stick

BA-Stick is Black Anvil ([bichael](https://github.com/BlackAnvilNetwork/bichael)) with a new
Stick Engine frontend. Server, contracts, `packages/*` and game data come from bichael unchanged.

## Upstream sync

```bash
git remote add upstream https://github.com/BlackAnvilNetwork/bichael.git   # once
git fetch upstream
git checkout -b sync/upstream-$(date +%Y%m%d) main
git merge upstream/main          # resolve conflicts, keep BA-Stick's LICENSE/README/frontend dirs
pnpm install && pnpm typecheck
```

Rules:
- Server, contract, protocol and game-rule fixes land in **bichael first**, then merge here.
- BA-Stick-only code lives in `apps/stick-web`, `packages/client-core`, `engine/` and `content/`.
- `engine/stick-engine` is a git subtree of
  [stick-engine](https://github.com/BlackAnvilNetwork/stick-engine). Don't edit it here; pull updates:
  `git subtree pull --prefix engine/stick-engine https://github.com/BlackAnvilNetwork/stick-engine.git main --squash`

History note: the bichael history was imported intact. The only hex keys in it are the public
Anvil/Hardhat default test keys used in tests.

## Building the engine

```bash
export CARGO_TARGET_DIR=$PWD/engine/target   # keep build output in one ignored dir
cargo test --manifest-path engine/stick-engine/Cargo.toml -p stick_engine
```
