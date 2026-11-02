---
name: bellgrave-map-builder
description: >-
  Use the in-game Forest Basin map-builder (spellbook Map tab) and turn those
  edits into a real Stick Engine zone. Use with stick-engine-maps when fleshing
  Forest Basin, promoting overlay strokes into forest-basin.ts, wiring bake and
  server walk/height, or when MAP_BUILDER tools fail. Never commit .env files.
---

# Forest Basin map builder

`stick-engine-maps` is the zone-design skill (bounds, heightfield, bake, gates). This skill is the **in-game sculpting loop** on Forest Basin and how to promote that work into config.

Do not start a new zone from this skill alone. Pair it with `.cursor/skills/stick-engine-maps/SKILL.md`, a reference image, and an area sheet. Do not copy names from reference art.

## What is already live

Forest Basin is a playable zone. The builder only edits this zone.

| Piece | Path |
|-------|------|
| Zone source | `packages/config/src/forest-basin.ts` |
| Live overlay | `packages/config/src/forest-basin-overlay.ts` |
| Persist | `apps/server/src/forest-basin-builder-persist.ts` → `apps/server/data/forest-basin-edits.json` (gitignored) |
| Who may sculpt | `apps/server/src/map-builder-auth.ts` |
| Spell resolve | `apps/server/src/map-builder-abilities.ts` |
| Spell defs | `packages/combat/src/map-builder-kit.ts` |
| Client patches | `apps/stick-web/src/map-builder-client.ts` + `patchZoneCell` in ba-stick-render wasm |
| Enable comments | `apps/server/.env.example` (`MAP_BUILDER_*` only) |

Baked `.baz` / `.bap` are gitignored. After a config change: `pnpm --filter @bellgrave/stick-web zones`.

## Enable locally (never commit)

Put this in **gitignored** `apps/server/.env.local` only:

```
MAP_BUILDER_DEV=1
```

Or list builders (still only in `.env.local`):

```
MAP_BUILDER_WALLETS=0xYourWallet
MAP_BUILDER_CHAR_IDS=c_your_id
MAP_BUILDER_NAMES=Warden
```

Never write real keys, listing keys, or `.env` / `.env.gnosis` / `.env.local` into git. Example files may list the `MAP_BUILDER_*` **names**, not values.

Restart the server after changing env. Enter Forest Basin. Spellbook → **Map** tab. Aim at the ground and cast.

| Id | Stroke |
|----|--------|
| `map_raise` / `map_lower` | ±0.5 m, 4 m brush |
| `map_flat` | Set brush to the caster's footing height |
| `map_smooth` | Average neighbour heights |
| `map_biome_grass` / `_meadow` / `_mountain` | Paint biome |
| `map_walk` / `map_block` | Walkable vs blocked |
| `map_undo` | Last stroke |

Tools no-op outside `forest_basin`. Ground target is `g:<x>,<z>` in **zone-local** metres (same space as `FOREST_BASIN_BOUNDS`).

## Promote strokes into the real map

The overlay is a sculpting layer. It is not the shipped heightfield.

1. Sculpt in-game. Server walk/height already use `effectiveForestBasin*` (base + overlay).
2. Read `apps/server/data/forest-basin-edits.json` (local only).
3. Fold those cells into `forest-basin.ts` (`height()`, `walkable()`, `biome()`, trails, water, labels). Follow `stick-engine-maps` budgets and camera rules.
4. Place gates and the travel zone only from `stick-engine-maps/plan.md`. Do not add another Pale Hollow exit.
5. `pnpm --filter @bellgrave/stick-web zones` and confirm walk + spawn tests.
6. Reset the overlay (`resetForestBasinOverlay` / delete the local edits file) so the bake is the only source.
7. Do not commit `apps/server/data/`, `.env*`, wasm binaries, or tmp screenshots.

## Do not touch

- Pale Hollow config, bake, or landmarks (other session).
- Host / Gnosis deploy files unless the user asked for that separately.
- `deployments/*.json` keys or any env file.

## Done when

A builder can enter Forest Basin, sculpt, see the ground update, and a later agent can bake a proper zone from `forest-basin.ts` without needing the overlay file.
