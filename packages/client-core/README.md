# @bellgrave/client-core

Renderer-agnostic Black Anvil client code, extracted from `apps/web` so both the
legacy R3F client and `apps/stick-web` share it:

- `net` + `state`: WebSocket protocol client (auth handshake, `ClientMessage` sends, snapshot store in zustand)
- `wallet`, `appkit`, `appkit-config`, `walletconnect`, `injected-login`, `burner-identity`: wallet login and signing
- `character-mint`, `pending-mint`, `mint-claim`: character NFT mint
- `ah-buy`, `eez-*`, `pay-wallet`, `pay-trust`, `pvp-place`: on-chain payments
- `light-client`, `mobile-light-client`, `settlement-label`: verification and labels

Import by subpath: `import { connect } from "@bellgrave/client-core/net"`.
No three.js / R3F dependencies. `appkit` uses `@reown/appkit/react`, so React is a peer.
