# EEZ sync buy (mission gap)

AhEscrow already accepts native `msg.value` from an EOA, Safe, or EEZ
`CrossChainProxy`. Sync buy from a foreign home-chain is **not wired** in
`apps/` yet: buys still go through the browser wallet (`ah-buy.ts` /
EIP-1193 or burner) against the game-chain escrow.

## Current local path (done)

1. Client `buyAsksWithWallet` → `AhEscrow.buyAsk{value}` on the game chain.
2. Server `AskFilled` watcher mirrors items with `chainFill` (txHash + logIndex).
3. Settlement ETH never credits onto the character log.
4. Seller payout is the wallet chosen at list time (`sellerPayout`).

## EEZ sync buy

| Piece | Status |
|-------|--------|
| `AhEscrow.buyAsk{value}` | Done |
| Browser EIP-1193 / burner buy | Done (`ah-buy.ts`) |
| Docs + economy notes | Done |
| Env / config scaffolding (`eez-sync.ts`, `eez-home-chain.ts`) | **Started** — `LOK_EEZ_ZONE_ID`, `LOK_EEZ_HOME_RPC`, `LOK_EEZ_SYNC_BUY` |
| EEZ zone registration / rollup id | Not started (needs upstream registration) |
| Client “pay from home chain” picker UI | Stub only (`listHomeChainOptions` empty) |
| Server recognition of proxy-origin fills | Same AskFilled watcher; no special case yet |
| Seller home-chain payout in the same batch | Not started |

`planEezSyncBuy` returns a clear “not wired” error until registration lands.

Until then, use the local AhEscrow path. Upstream EEZ `periphery/Bridge.sol`
is test-only and must not be treated as production.

## Fee unit note (character mint)

Character creation charges **native ETH** (`msg.value == mintFee`), not WETH.
That matches AhEscrow / EEZ `value` settlement. See `docs/local-character-mint.md`.
