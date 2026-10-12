# Chiado deploy runbook (do not broadcast without go-ahead)

Settlement testnet: **Gnosis Chiado** (`chainId` **10200**), native **xDAI**.

## Prerequisites

- Funded deployer EOA with Chiado xDAI
- Multisig / rotator / guardian / proposer / listing addresses
- External `ITEMS` (ERC-1155) and `KEK` (ERC-20) addresses on Chiado (or placeholders only if you accept non-functional export until real tokens exist)
- `BASE_URI` for CharacterNFT metadata

## Env

Copy `contracts/lok-log/.env.chiado.example` → gitignored `.env.chiado` and fill secrets.

```bash
cd contracts/lok-log
set -a && source .env.chiado && set +a
# Dry-run (no broadcast):
forge script script/DeployChiado.s.sol:DeployChiado \
  --rpc-url "$CHIADO_RPC_URL" \
  --sig "run()"
# Broadcast ONLY after explicit user go-ahead:
# forge script script/DeployChiado.s.sol:DeployChiado \
#   --rpc-url "$CHIADO_RPC_URL" \
#   --broadcast \
#   --sig "run()"
```

`MINT_FEE` defaults to `1000000000000000000` (1 xDAI). Override in wei if product picks a different fee.

## After deploy (manual)

Same as `Deploy.s.sol` footer: items minter, starting jobs, ruleset propose, rotator session keys. Then wire server:

```
LOK_CHAIN_ID=10200
LOK_CHAIN_RPC=<chiado rpc>
LOK_PUBLIC_RPC=<browser-reachable chiado rpc>
LOK_AH_ESCROW=...
LOK_CHARACTER_NFT=...
LOK_CHARACTER_FACTORY=...
LOK_LISTING_KEY=<xDAI-funded listing key>
```

UI will show **xDAI** via `settlementCurrency(10200)`.
