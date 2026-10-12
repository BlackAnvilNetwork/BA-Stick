# EEZ sync buy (mission gap)

AhEscrow already accepts native `msg.value` from an EOA, Safe, or EEZ
`CrossChainProxy`. Sync buy from a foreign home-chain is wired for **local
testing** via `MockEezSyncBuy`; live EEZ zone registration remains out of band.

## Current local path (done)

1. Client `buyAsksWithWallet` → `AhEscrow.buyAsk{value}` on the game chain.
2. Server `AskFilled` watcher mirrors items with `chainFill` (txHash + logIndex).
3. Settlement ETH never credits onto the character log.
4. Seller payout is the wallet chosen at list time (`sellerPayout`) — **same tx**.

## EEZ sync buy (local mock)

| Piece | Status |
|-------|--------|
| `AhEscrow.buyAsk{value}` | Done |
| Browser EIP-1193 / burner buy | Done (`ah-buy.ts`) |
| Docs + economy notes | Done |
| Env / config (`eez-sync.ts`, `eez-home-chain.ts`) | Done — snapshot `eezSyncBuy` |
| Local zone + `MockEezSyncBuy` | Done — `LOK_EEZ_ZONE_ID` + `LOK_EEZ_MOCK_SYNC_BUY` + `LOK_EEZ_SYNC_BUY=1` |
| Client “pay from home chain” picker | Done (`listHomeChainOptions` / `buyAsksWithEezSync`) |
| Same-batch seller payout | Done inside `AhEscrow.buyAsk` (mock forwards value) |
| Live EEZ CrossChainProxy registration | Not started (needs upstream registration) |

### Local env

```bash
LOK_EEZ_SYNC_BUY=1
LOK_EEZ_ZONE_ID=local-31337
LOK_EEZ_MOCK_SYNC_BUY=0x…   # MockEezSyncBuy on the throwaway anvil
# Must be LOK_CHAIN_ID=31337 + localhost RPC. Boot verifies mock has code and
# mock.escrow() == LOK_AH_ESCROW before enabling the client picker.
```

`planEezSyncBuy` returns a `local-mock` plan when enabled. The auction HUD
home-chain picker calls `buyAsksWithEezSync` → `MockEezSyncBuy.syncBuy{value}`
(exact ask price forwarded; excess refunded to the buyer). Seller payout is
same-batch inside `AhEscrow.buyAsk`.

Upstream EEZ `periphery/Bridge.sol` is test-only and must not be treated as
production. Do not redeploy the shared anvil for this path — use a throwaway
anvil for forge / support tests.

## Fee unit note (character mint)

Character creation charges **native ETH** (`msg.value == mintFee`), not WETH.
That matches AhEscrow / EEZ `value` settlement. See `docs/local-character-mint.md`.
