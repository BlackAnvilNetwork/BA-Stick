# #17 social / economy verification (local anvil)

Run: `node docs/e2e/party.mjs` against the local server (anvil 31337 only).

| Flow | Result |
|---|---|
| Character NFT mint | Verified: "Linked character NFT #N on the local checkpoint." |
| Party invite / accept | Verified (`party/invite`, `party/accept`) — `docs/screens/m4-party.png` |
| Lok import | Verified |
| AH list / buy | **Not verifiable in UI on fresh dev server.** Server `chainBoundSendGate` requires (1) the latest certified root posted to RootAnchor (`LOK_ROOT_ANCHOR`, separate `LOK_ANCHOR_POSTER_KEY`), (2) a one-day challenge delay since that post (server wall clock), (3) epoch xDAI under 10% of posted slashable bonds. Client sends `lok/list` correctly; server answers "Waiting for an anchored root." Covered server-side by CI `server-anvil`. |
| Ash Pit join (live) | **Requires a wallet** to pay 1 xDAI on-chain; headless run has none. Panel and status render — `docs/screens/m4-pvp.png`. |

No server changes. Corresponding #39 parity items left unticked.
