# Black Anvil PvP — Ash Pit

## Product

Players place a fixed **1 xDAI** (1×10¹⁸ wei) bounty on their own head inside a
PvP arena. If they are slain there, the bounty pays the slayer on-chain. The
character log never holds settlement ETH — it only mirrors custody events.

## Ash Pit (first arena)

| Field | Value |
| --- | --- |
| Id | `ash_pit` |
| Zone | Pale Hollow (southwest pocket) |
| Level cap | **30** main / **15** support (`floor(30/2)`) |
| Abilities | Unlock levels above those caps are sealed while inside |
| Bounds | `minX:-72 maxX:-42 minZ:-18 maxZ:8` |

Config: `packages/config/src/pvp-areas.ts`.

## Ledger events (lok engine)

| Op | Meaning |
| --- | --- |
| `pvpBountyOpen` | On-chain escrow opened; book marks token as bounty-open |
| `pvpBountyCancel` | Refund / leave without dying; clears open bounty |
| `pvpKill` | Slay claim; clears **victim** bounty only |

Fixed `amountWei` = `1000000000000000000`. Linked onto victim (and slayer for
`pvpKill`) character chains. Same ruleset pin bump as any new event.

## On-chain

`contracts/lok-log/src/PvpBounty.sol` — player `place` (**1 xDAI** / 1e18 wei).
`cancel` refunds the **original payer** (`payerOf`), including while paused and
after the NFT transfers. The server also cancels on CharacterNFT `Transfer`.

`proposeClaim(victim, slayer, expectedSlayer)` snapshots `ownerOf(slayer)` and
reverts (`SlayerMoved`) if that owner is not the wallet that scored the kill.
`executeClaim` pays the snapshotted address after `claimDelay` (0 on anvil, 60s
on Gnosis), not whoever owns the slayer NFT later. Guardian `vetoClaim` drops a
proposal without paying. Pause blocks propose and execute; it does not block cancel.

OPERATOR_ROLE is the LISTING hot key. It can still propose a claim for any open
bounty — that is the kill attestation. The delay is the guardian's window to
veto or pause. Admin and guardian must be a Safe. The server logs
`pvp_bounty_claim_proposed` and `pvp_bounty_claimed` on stderr. Never put
`LOK_OWNER_KEY` or `PRIVATE_KEY` on the game host.

The log mirror requires a decoded `BountyOpened` / `BountyCancelled` /
`BountyClaimed` log. `txHash-logIndex` is stored once; a second mirror of the
same receipt is rejected. Synthetic receipts stay off unless the chain is anvil
and `LOK_PVP_BOUNTY` is unset, or `LOK_PVP_SYNTHETIC=1`.

Gear and prebuffs are not clamped in Ash Pit. Skill-tree bonuses stay on as
well (#291). Job level is still capped at 30 / support 15. Ember Vigil does not
fire inside a PvP area, so a bounty claim is not deferred. Party members cannot
strike each other. Abilities aimed at another player use the same strike gate.

## Server WS

- **`pvp/join`** (+ optional `placeTxHash`) — teleport into Ash Pit after escrow
- **`pvp/placeNeeded`** — live path: client must `PvpBounty.place` then rejoin
- **`pvp/leave`** — operator cancel + warp to hub
- `pvp/bountyPlace` / `pvp/bountyCancel` — aliases for join / leave
- `engage` a marked player (gold ring) inside the arena
- On slay: on-chain `claim` → `pvpKill` → kick + `pvp/slain` + **Join again**
- Leaving the arena with an open bounty auto-cancels (on-chain refund)

## Deploy (Gnosis — live)

- Bounty unit: **1 xDAI** (`BOUNTY_WEI = 1e18`)
- Additive script: `DeployPvpBountyGnosis.s.sol` (+ `broadcast-deploy-pvp-bounty-gnosis.sh`)
- Against official NFT `0x48aFeC…289F`; ADMIN `0x08cD…4e01`; OPERATOR = LISTING `0xbFa2…9E76`
- Previous address `0x02bDDCaF5a19fD9Be7f39fC7419F794CECE9E64e` is the pre-fix
  bytecode (single `claim`, pays current `ownerOf`). `deployments/gnosis.json`
  keeps that address with `status: needs-redeploy`. Production boot reads
  `claimDelay()` and refuses this contract. Redeploy with
  `DeployPvpBountyGnosis` (60s `claimDelay`) and replace `LOK_PVP_BOUNTY`.
- Env: `NETWORK=gnosis` fills `LOK_PVP_BOUNTY`
- Operator: **`LOK_LISTING_KEY` only** (LISTING `0xbFa2…`). Never put the admin key on the server.
- Key placement: local → `apps/server/.env.local`; production → host secrets for the Node process on PORT 8787 (see `docs/gnosis-launch.md`).
- Synthetic refused on Gnosis unless `LOK_PVP_SYNTHETIC=1` (never for production)
- Local anvil only: `DeployPvpBountyAnvil` + `deployments/anvil.json` (dev)

## Client

- Commands → **Ash Pit** panel — Join pays **1 xDAI** then warps
- Slain banner with one-click rejoin (fresh place)
- Marked players show a gold ring; click to engage
