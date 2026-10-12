# EEZ sync buy (mission gap)

AhEscrow already accepts native `msg.value` from an EOA, Safe, or EEZ
`CrossChainProxy`. Sync buy from a foreign home-chain is **not wired** in
`apps/` yet: buys still go through the browser wallet (`ah-buy.ts` /
EIP-1193 or burner) against the game-chain escrow.

When EEZ lands:

1. Client (or bridge UI) submits the home-chain payment that results in
   `AhEscrow.buyAsk{value}` on the game chain via the proxy.
2. Server `AskFilled` watcher mirrors items with `chainFill` as today.
3. Do not credit settlement ETH onto the character log.

Until then, use the local AhEscrow path. Upstream EEZ `periphery/Bridge.sol`
is test-only and must not be treated as production.