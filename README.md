# BA-Stick — Black Anvil on Stick Engine

Black Anvil with a new pixel/stick-figure frontend (`apps/stick-web` + `engine/`). Server, contracts and game data track [bichael](https://github.com/BlackAnvilNetwork/bichael) as the `upstream` remote; see [CONTRIBUTING.md](CONTRIBUTING.md).

---


Browser game: wallet connect, a campaign world, and job combat. The Citadel hall fight (Time Mage vs Petrified Guard, keys **1–4** on the hotbar) still runs.

Formerly developed as Bellgrave / Legend of KEK. On-chain identifiers, engine ops, log schemas, and npm package names (`@bellgrave/*`) are unchanged so log replay and deployed contracts keep working.

## Stack

- `apps/stick-web` — React + Vite + Stick Engine (wasm) client (the old three.js `apps/web` was retired in #38)
- `apps/server` — Node WebSocket game loop @ 20 Hz
- `packages/combat` — job formulas and ability kits
- `packages/protocol` — Zod client messages
- `packages/config` — shared constants
- `packages/items` — item catalog
- `contracts/lok-log` — character log contracts and the Rust engine (not in the pnpm workspace)

System index: [`docs/systems.md`](docs/systems.md).

## Run

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5173
- Server: `ws://localhost:8787`

## Play loop

1. **Connect Wallet** — injected extension or Reown AppKit
2. **Create character** — pick appearance + job; claim starter kit
3. Campaign world (see [`docs/world.md`](docs/world.md)):
   - **Pale Hollow** ↔ The Shard Dwellings → **Ashlands** ↔ Obsidia → **Slagpits** ↔ The Great Filter → **Bellmarsh** ↔ Belltower Keep → **Throne Approach** ↔ Citadel of KEK
   - Areas: mobs + harvest nodes · Cities: NPCs + quests · Craft while progressing
4. Clear the campaign, then replay with enemies scaled to your level
5. The Citadel hall fight vs Petrified Guard still runs (hotbar keys **1–4**)

Using a potion removes it from the bag. That is not an on-chain burn. Settlement targets Gnosis (see [`docs/gnosis-launch.md`](docs/gnosis-launch.md)).

The bag is a character save. Gold and log item balances live in the Rust engine under `contracts/lok-log/engine`, loaded by the server as wasm. `bagImport` / `bagExport` move stacks between the bag and the log and are not checkpoint mints. `exportItem` is the chain withdrawal. KEK custody is retired. The live contracts are in `contracts/lok-log/` (not the pnpm workspace). Entry files and the ruleset pin: [`docs/systems.md`](docs/systems.md). This README does not deploy.

## Where to read next

| Topic | Doc |
| --- | --- |
| System map | [`docs/systems.md`](docs/systems.md) |
| Campaign | [`docs/world.md`](docs/world.md) |
| Character contracts | [`contracts/lok-log/README.md`](contracts/lok-log/README.md), [`contracts/lok-log/CONTRACTS.md`](contracts/lok-log/CONTRACTS.md) |
| Engine | [`contracts/lok-log/engine/README.md`](contracts/lok-log/engine/README.md) |
| Items | [`packages/items/README.md`](packages/items/README.md) |
| Gnosis / mainnet | [`docs/gnosis-launch.md`](docs/gnosis-launch.md), [`docs/mainnet-plan.md`](docs/mainnet-plan.md) |

`contracts/README.md` is an old stub. The live package is `contracts/lok-log/`.

## UI pack

Black Anvil HUD chrome lives in `apps/stick-web/public/ui/black-anvil/` (source sheet + sliced PNG/WebP).

## License (AGPL-3.0): what developers and agents must do

**Black Anvil, Copyright (C) 2026 Black Anvil Network.** Licensed under the GNU Affero General Public License, version 3 or (at your option) any later version (`AGPL-3.0-or-later`). See [LICENSE](LICENSE). `engine/stick-engine` (Stick Engine) is also AGPL-3.0-or-later. Exception: the `contracts/` crates that declare MIT stay MIT.

*This is a plain-language summary, not legal advice. The LICENSE text governs.*

- **Network use counts.** If you run a modified version of the server (or any part of it) for users over a network, you must offer those users the complete corresponding source of your version, for example with a "Source" link (AGPL §13).
- **Distributing the client counts.** Shipping the web client, its JS/wasm bundles or any binary means offering the complete corresponding source, including Rust/TS sources, build scripts and lockfiles (AGPL §6).
- **Keep the notices.** Don't remove copyright lines, license notices or warranty disclaimers.
- **Derivatives stay AGPL.** Modified versions and works based on this code must be licensed under AGPL-3.0-or-later.
- **Mark modified files** with a prominent notice saying what you changed and when (AGPL §5a).
- **No extra restrictions** beyond the license, and contributors grant the patent license in AGPL §11.
- **Third-party assets and code** (art, fonts, audio, snippets) need licenses that are compatible with AGPL-3.0 and allow commercial use (e.g. CC0, CC-BY 4.0, MIT, BSD, Apache-2.0). No NC, ND or unknown-license material.

### Checklist for AI agents (and humans)
- [ ] Keep every existing copyright and license header.
- [ ] Don't paste code whose license you can't confirm is AGPL-compatible.
- [ ] Record the source URL, author and license of every third-party asset or snippet you add.
- [ ] Add a dated "modified" notice when changing files that came from someone else.
- [ ] Keep `package.json` and `Cargo.toml` license fields consistent with the table above (AGPL everywhere except the MIT contracts).
- [ ] When deploying a modified server or publishing a client build, publish or link the matching source.
