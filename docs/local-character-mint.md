# Local character mint (anvil 31337)

Creation fee is **native ETH** (`mintFee`, default 0.001), same unit as AhEscrow /
EEZ `msg.value` — not WETH.

## Mint-first flow

1. Client pays `createCharacter` / `createCharacterFor` from the wallet session.
2. Client sends `char/create` with `tokenId` (+ `mintWallet` claim when the payer
   differs from the burner auth wallet).
3. Server verifies on-chain ownership against **accepted wallets only** (auth
   wallet, or `mintWallet` with a valid EIP-191 mint claim).

## Dev flags (shared anvil — do not redeploy ad-hoc)

| Flag | Default | Effect |
|------|---------|--------|
| `LOK_DEV_FAUCET` | **on** when `LOK_OWNER_KEY` is set; set `=0` to disable | `dev/faucet` sends 0.1 ETH to the **caller's** wallet (rate-limited, 31337 only) |
| `LOK_DEV_SERVER_MINT` | off (`=1` to enable) | Server pays `createCharacterFor` + transfers NFT (needs a factory that has that method) |
| `ALLOW_DEBUG_CHEATS` / `NODE_ENV=development` | — | Also enables the faucet |

## Old factories (preview / shared anvil)

Factories deployed before `createCharacterFor` still work via plain
`createCharacter`. The server detects this and sets `supportsCreateFor: false`
on the mint config. Prefer the faucet + client mint path; do **not** enable
`LOK_DEV_SERVER_MINT` until the batched redeploy upgrades the factory.

If the chain `nextTokenId` lags the log bind counter, `suggestedTokenId` is the
max of chain-next and log-next so ids do not collide with already-bound tokens
when `createCharacterFor` is available. On old factories, keep minting until the
chain id is past bound tokens, or wipe/redeploy in the batched window.
