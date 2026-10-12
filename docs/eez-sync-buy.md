# EEZ sync buy (mission gap)

AhEscrow already accepts native `msg.value` from an EOA, Safe, or EEZ
`CrossChainProxy`. Sync buy from a foreign home-chain is **not wired** in
`apps/` yet: buys still go through the browser wallet (`ah-buy.ts` /
EIP-1193 or burner) against the game-chain escrow.

## Current local path (done)

1. Client `buyAsksWithWallet` → `AhEscrow.buyAsk{value}` on the game chain.
2. Server `AskFilled` watcher mirrors items with `chainFill` (txHash + logIndex).
3. Settlement ETH never credits onto the character log.
4. Seller payout is the wallet chosen at list time (`sellerPayout`), not necessarily the burner auth address.

## EEZ sync buy (not wired)

When EEZ lands:

1. Client (or bridge UI) submits the home-chain payment that results in
   `AhEscrow.buyAsk{value}` on the game chain via the proxy.
2. Server `AskFilled` watcher mirrors items with `chainFill` as today.
3. Do not credit settlement ETH onto the character log.

### Sketch (apps/ stubs to add later)

| Piece | Status |
|-------|--------|
| `AhEscrow.buyAsk{value}` | Done |
| Browser EIP-1193 / burner buy | Done (`ah-buy.ts`) |
| `docs/eez-sync-buy.md` + economy docs | Done |
| EEZ zone registration / rollup id | Not started |
| Client “pay from home chain” picker | Not started |
| Server recognition of proxy-origin fills | Same watcher; no special case yet |
| Seller home-chain payout in the same batch | Not started |

Until then, use the local AhEscrow path. Upstream EEZ `periphery/Bridge.sol`
is test-only and must not be treated as production.

## Fee unit note (character mint)

Character creation charges **native ETH** (`msg.value == mintFee`), not WETH.
That matches AhEscrow / EEZ `value` settlement: one native unit end-to-end, no
wrap step at the mint edge. WETH remains a wrap/unwrap convenience on home
chains for EEZ sync buys, not the mint fee denomination.
