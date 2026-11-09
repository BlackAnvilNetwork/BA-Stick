# Ignition process (BA-Stick)

| Field | Value |
|-------|--------|
| **Version** | `0.1.0` |
| **Status** | Draft — captures Oct 2026 local/Gnosis pain; intended to become the versioned launch + update runbook |
| **Related** | [`gnosis-launch.md`](gnosis-launch.md) (contracts + Safes), [`deploy.md`](deploy.md) (static client), [`local-character-mint.md`](local-character-mint.md) (anvil only) |

**Ignition** here means: deploy or refresh settlement on chain → record addresses in `deployments/*.json` → wire **server + client + secrets** so a developer or host can log in, mint, and play without improvising env vars. The ignition tooling often lives in a separate repo (e.g. ban-ignition / `contracts/lok-log`); **this doc is how BA-Stick consumes that output** and what must never be left implicit.

---

## 1. Goals

1. **One settlement profile per environment** — server `NETWORK` / `LOK_CHAIN_ID` and client `VITE_NETWORK` / `VITE_CHAIN_ID` always agree.
2. **Secrets in one gitignored place** — `apps/server/.env.local` (and contract-side `.env.gnosis`), never in agent shells or committed JSON.
3. **Pinned addresses from deploy JSON** — client factory/NFT pins and server `LOK_DEPLOY_JSON` must match the same file revision.
4. **Repeatable dev entry** — scripts start **both** processes with the same profile (no “server anvil + browser gnosis”).
5. **Fail loud at boot** — production settlement refuses to listen without listing key + ops token; that is correct, not a bug to bypass with hybrid env.

---

## 2. What we struggled with (Oct 2026)

These are the issues that showed up during map-builder / local Gnosis work. Treat them as **checklist items** for the next ignition or update.

### 2.1 Hybrid settlement (server vs client)

| Symptom | Cause |
|---------|--------|
| Wallet login fails or mint/auth feels “wrong” | Server on **`NETWORK=anvil` / chain 31337** while Vite on **`VITE_CHAIN_ID=100`**. Auth challenges embed server chain id; NFT/`ownerOf` and factory pins target different deployments. |
| Server “runs” but Gnosis wallet doesn’t match | **`LOK_CHAIN_RPC` pointed at Gnosis** while profile stayed **anvil** — RPC chain id ≠ `envSettlementChainId()`. |
| Intermittent success | Old terminal kept mixed env; restart **stripped** vars another session relied on. |

**Avoid:** Pick **Profile A (anvil)** or **Profile B (gnosis)** below. Never mix chain id across server and stick-web.

### 2.2 Gnosis server boot gates

| Symptom | Cause |
|---------|--------|
| `FATAL production boot: LOK_LISTING_KEY, LOK_OPS_STATUS_TOKEN` | `NETWORK=gnosis` triggers **production boot** (`apps/server/src/production-boot.ts`). `LOK_REPLICA=1` and `MAP_BUILDER_DEV=1` do **not** skip this. |
| Boot after adding a key still fails | Official deploy: key must be an **owner of Listing Safe** `0xe105…002B` (`LOK_LISTING_SAFE`). The October 13 EOA pin `0xbFa29a6E…9E76` is the abandoned stack only. Dry-run keys fail `hasRole` / pin checks. |
| No server on `:8787` | Process exits before listen; client shows WS errors while Vite still serves UI. |

**Avoid:** Before calling a laptop “Gnosis dev”, create `apps/server/.env.local` from `apps/server/.env.gnosis.example` with real **`LOK_LISTING_KEY`** and a local **`LOK_OPS_STATUS_TOKEN`** (any long random string). See [`gnosis-launch.md` § Where LOK_LISTING_KEY goes](gnosis-launch.md).

### 2.3 Secrets lifecycle

| Symptom | Cause |
|---------|--------|
| Login worked yesterday, not after agent restart | Restart scripts **`Remove-Item Env:LOK_LISTING_KEY`** or never loaded `.env.local`. |
| Missing `.env.local` in repo | File is gitignored (correct); ignition never documented **mandatory copy step** for Gnosis laptop dev. |
| Confusion between ignition `.env.gnosis` and server `.env.local` | Contract deploy keys ≠ server runtime keys; only **listing owner** belongs on the game server. |

**Avoid:** Ignition deliverable includes a **filled template path** (not contents): `apps/server/.env.local` from `.env.gnosis.example`. Scripts must **not** unset listing/ops vars. `loadLokEnv()` reads `.env.local` automatically at server start.

### 2.4 Client pins and identity mode

| Symptom | Cause |
|---------|--------|
| Pay/mint trust errors | **`VITE_FACTORY`** pinned to an old address (e.g. anvil fixture) while server uses `deployments/gnosis.json` **`CharacterFactory`**. |
| Burner / local key doesn’t work on `:5174` | **`burnerIdentityAllowed()`** is anvil-only (`packages/client-core/src/burner-identity.ts`). Gnosis requires injected wallet or WalletConnect. |
| Production build fails | **`VITE_WALLETCONNECT_PROJECT_ID`** required when `VITE_NETWORK=gnosis` (Vite build guard). |

**Avoid:** After each deploy, update **one row** in ignition output: factory, NFT, chain id, WS URL. Script `scripts/dev-win-gnosis.ps1` should read factory from `deployments/gnosis.json` (or env), not a stale constant.

### 2.5 Auth and origins

| Symptom | Cause |
|---------|--------|
| WS connects from wrong origin | Missing **`AUTH_ORIGINS=http://localhost:5174`** (stick-web default port). |
| Pages / preview refused | Origin not allowlisted on server ([`deploy.md`](deploy.md)). |

**Avoid:** Ignition profile table includes **`AUTH_ORIGINS`** for every client origin (local + production).

### 2.6 Dry-run vs official deploy JSON

| Symptom | Cause |
|---------|--------|
| Wrong checkpoint / MockItems fear | Server pointed at **`gnosis-dryrun.json`** or keys from ignition dry-run while **`deployments/gnosis.json`** is official. |
| PvpBounty warnings | **`gnosis.json`** may note contracts needing redeploy (`claimDelay`, status fields) — boot checks are strict. |

**Avoid:** Ignition tags each JSON with **`status`**, **`gitRef`**, **`chainId`**. BA-Stick commit pins **one** file per network; laptop `.env.local` sets `LOK_DEPLOY_JSON` explicitly.

### 2.7 Dev stack fragility (non-chain)

| Symptom | Cause |
|---------|--------|
| `pnpm dev` never reaches Vite | **`pnpm zones`** failed (e.g. missing import in `bake-props.ts`) — unrelated to chain but blocks all local play. |
| Map tools missing | **`MAP_BUILDER_DEV`** + allowlist; separate from settlement profile. |
| Long restarts | Zone bake on every `pnpm dev`; no documented “vite-only” path when zones unchanged. |

**Avoid:** CI runs zone bake; ignition **smoke** includes `pnpm exec tsx scripts/bake-zones.ts` or documented skip for inner loop.

### 2.8 Platform asymmetry

| Symptom | Cause |
|---------|--------|
| Windows dev unlike Linux/mac | Only **`scripts/dev-local-anvil.sh`** existed; Gnosis laptop was manual PowerShell env. |

**Avoid:** Paired scripts: `dev-local-anvil.sh` + `dev-win-gnosis.ps1` (or one cross-platform `pnpm` script reading a **profile file**).

---

## 3. Canonical profiles

Use exactly one profile per machine/session. Document the choice in the team channel / release notes when ignition version bumps.

### Profile A — Local anvil (engine + burner)

| Layer | Settings |
|-------|----------|
| Chain | **31337**, local RPC `http://127.0.0.1:8545` |
| Server | `NETWORK=anvil`, `LOK_REPLICA=1`, `LOK_DATA_DIR`, MintFixture addresses from anvil script |
| Client | `VITE_NETWORK=anvil`, `VITE_CHAIN_ID=31337`, `VITE_WS_URL=ws://localhost:8787` |
| Identity | Burner keys allowed |
| Entry | `./scripts/dev-local-anvil.sh` + `pnpm --filter @bellgrave/stick-web dev` with anvil Vite env |

**Use when:** Combat, maps, wasm, no real xDAI, no listing key.

### Profile B — Laptop against official Gnosis (wallet login)

| Layer | Settings |
|-------|----------|
| Chain | **100**, public RPC |
| Server | `NETWORK=gnosis`, `LOK_REPLICA=1`, `LOK_DEPLOY_JSON=deployments/gnosis.json`, `AUTH_ORIGINS=http://localhost:5174` |
| Server secrets | `apps/server/.env.local`: **`LOK_LISTING_KEY`**, **`LOK_OPS_STATUS_TOKEN`**, optional `MAP_BUILDER_DEV` |
| Client | `VITE_NETWORK=gnosis`, `VITE_CHAIN_ID=100`, `VITE_FACTORY` = deploy JSON factory, `VITE_WS_URL=ws://localhost:8787`, `VITE_WALLETCONNECT_PROJECT_ID` for WC |
| Identity | Wallet on Gnosis only |
| Entry | `.\scripts\dev-win-gnosis.ps1` (after `.env.local` exists) |

**Use when:** Real NFTs, mint fee, AH/PvP paths against mainnet contracts.

### Profile C — Hosted production replica

Same as Profile B with production `AUTH_ORIGINS`, `LOK_DATA_DIR` on durable disk, no `MAP_BUILDER_DEV`, listing key from host secret store, confirmations/finalized per [`gnosis-launch.md`](gnosis-launch.md).

---

## 4. Ignition phases (target process)

Version this section when ignition tooling changes. Suggested semver on **this file** + **deployments/*.json `gitRef`**.

### Phase 0 — Pre-flight

- [ ] Choose profile (A/B/C) and network (`gnosis` / `chiado` / anvil).
- [ ] Confirm no `LOK_OWNER_KEY` / `PRIVATE_KEY` on production server env.
- [ ] Fork simulate: `simulate-deploy-gnosis-fork.sh` (contracts repo).
- [ ] BA-Stick branch records intended `deployments/<network>.json` path.

### Phase 1 — Chain deploy (ignition repo)

- [ ] Safes created per runbook (Admin ≥2, Treasury, Listing threshold 1).
- [ ] Real Items or `0x0`; **never** MockItems on 100/10200.
- [ ] Broadcast only with explicit go-ahead.
- [ ] Write **`deployments/<network>.json`** into BA-Stick (addresses, `chainId`, `deployBlock`, `gitRef`, no private keys).
- [ ] Verify on Blockscout/Sourcify.

### Phase 2 — Register secrets (out of band)

- [ ] Listing owner key → operator secret store + `apps/server/.env.local` on each host that runs Profile B/C.
- [ ] Generate **`LOK_OPS_STATUS_TOKEN`** per host; store with listing key.
- [ ] Contract `.env.gnosis` remains in ignition repo only; **not** copied wholesale to server.

### Phase 3 — Wire BA-Stick

- [ ] Server: `NETWORK`, `LOK_DEPLOY_JSON`, RPC URLs, `AUTH_ORIGINS`.
- [ ] Client build/dev: `VITE_*` pins from same JSON revision.
- [ ] Update dev scripts if factory or port changes.
- [ ] Commit **addresses only**; never keys.

### Phase 4 — Smoke (must pass before “ignition done”)

| Check | Profile A | Profile B/C |
|-------|-----------|-------------|
| `GET /health` | ✓ | ✓ |
| Server log: `game server on ws://…` | ✓ | ✓ |
| Server log: `settlement profile=… chain=…` matches client | ✓ | ✓ |
| Wallet login + `auth/ok` | burner | personal_sign |
| `ownerOf` / character select | local mint | chain NFT |
| Optional mint / AH | dev faucet | small xDAI on wallet |

### Phase 5 — Update / re-ignition

When contracts change (new factory, PvpBounty redeploy):

1. Bump **`deployments/<network>.json`** (new `deployedAt`, `gitRef`).
2. Bump **`docs/ignition-process.md`** version + changelog below.
3. Re-run Phase 2 secrets only if listing role moved.
4. Re-run Phase 4 smokes on staging before pointing production `LOK_DEPLOY_JSON`.

---

## 5. Artifacts map

| Artifact | Committed? | Purpose |
|----------|------------|---------|
| `deployments/gnosis.json` | Yes | Official mainnet pins |
| `deployments/gnosis-dryrun.json` | Yes (labeled dry-run) | Historical; never auto-fill production |
| `deployments/anvil.json` | Yes / generated | Local fixture |
| `apps/server/.env.gnosis.example` | Yes | Template |
| `apps/server/.env.local` | **No** | Listing key + ops token |
| `scripts/dev-local-anvil.sh` | Yes | Profile A |
| `scripts/dev-win-gnosis.ps1` | Yes | Profile B (Windows) |
| Ignition `contracts/lok-log/.env.gnosis` | **No** | Deploy-time only |

---

## 6. Anti-patterns (never again)

1. **Hybrid chain id** — anvil server + Gnosis browser (or Gnosis RPC + anvil `NETWORK`).
2. **Stripping `LOK_LISTING_KEY`** in restart scripts.
3. **Hand-typed factory addresses** on the client — always from deploy JSON at ignition time.
4. **Assuming `LOK_REPLICA=1` relaxes Gnosis boot** — it does not.
5. **Using dry-run ignition keys** against **`deployments/gnosis.json`** — pin and role checks fail.
6. **Starting only Vite** without verifying `:8787` health for wallet play.
7. **Committing any private key** — including “temporary” ignition outputs.

---

## 7. Open improvements (backlog for ignition vNext)

- [ ] **`pnpm dev:profile gnosis|anvil`** — single cross-platform command reading `ignition.profile.json` (committed, no secrets).
- [ ] **`pnpm dev:vite-only`** — skip zones when `public/zones/` fresh (hash stamp).
- [ ] **Optional `LOK_LOCAL_GNOSIS_PLAY=1`** — documented, audited dev-only path (if ever needed): read-only chain + relaxed ops token only on loopback — *not implemented; production boot is intentional*.
- [ ] **Ignition CLI output** — prints `VITE_FACTORY=…`, `LOK_DEPLOY_JSON=…`, `AUTH_ORIGINS=…` block for copy into profile file.
- [ ] **Post-ignition CI job** — Profile A smoke on every PR; Profile B smoke nightly with secrets in CI vault.

---

## Changelog

### 0.1.0 — 2026-10-28

- Initial draft from local Gnosis login incidents, env restart regressions, missing `.env.local`, wrong `VITE_FACTORY`, zone-bake blocker, and `dev-win-gnosis.ps1` introduction.
- Defined Profiles A/B/C and ignition phases 0–5.
