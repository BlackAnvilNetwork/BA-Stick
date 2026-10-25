# Idle-tick seal skip and session resume

2026-10-21. Local play against the ignition Gnosis rollout was hitching every 50 ms, and a dropped socket was opening the wallet again. This note is the record of what was changed so a later chain or replica problem can be checked against it.

No contract was deployed or edited. CharacterNFT, Factory, AhEscrow, and PvpBounty are the same. No coordinate was added to a transaction. This server still reads Gnosis for `ownerOf` and for currency labels.

Measured source for the hitch: `C:\Users\raxac\OneDrive\Desktop\apps\rust_pixel\AUDIT-2026-10-21-perf.md`.

## What still works the same

- A harvest, craft, kill, gold event, roll, or guild event still BLS-seals. The parent of that batch is the previous sealed batch.
- A batch from another replica is still fully verified in `acceptBatch` (`apps/server/src/batch-envelope.ts`).
- The character-root proof bytes match `proveCharacter`. The cache key is the engine log length (`lok.length`).
- The web client recomputes the light proof when the certificate, claimed root, proof, leaf, or replica allowlist changes.
- Login still starts with a one-time personal-sign challenge. The nonce cannot be reused.
- `sessionOwnsCharacter` still calls `ownerOf` before a character is entered or a chain action is taken.
- Guild payout gating still runs every tick. The 72 m interest radius is unchanged.
- Joining the Ash Pit still opens the wallet when a bounty has to be placed.

## Change 1 — idle ticks are not sealed

`tickSim` in `apps/server/src/index.ts` skips `sealTickBatch`, `characterRootTreeRoot`, and `submitOnSimTick` when the tick committed no journal command, no guild event, and no game roll, and `endTick` succeeded.

A walk only updates memory. Position was never written to the lok journal or to Gnosis. Those ticks used to be signed anyway, which took the whole 50 ms frame.

**Sacrifice.** An idle stretch is no longer a signed attestation of "nothing happened." A gap in sealed height means either nobody logged an event, or this process omitted one and also omitted the seal. The leader already writes the journal, so it could previously omit an event and sign an empty tick. The empty tick no longer carries its own signature.

A failed `endTick` still does not seal. That was already the case. `rollBytes` on a sealed tick are still an empty byte string. The roll tape is a separate file. A tick that rolled is sealed. The roll bytes themselves are not inside the envelope.

A tick slower than 40 ms logs `[tick]` with a phase split (`players`, `mobs`, `snap`, `idle` or `seal`). That line is a timer, not a chain event.

## Change 2 — character proof cache

`proveCharacterCached` in `apps/server/src/character-light-proof.ts` builds the character-root tree once per log length. `web-light-snapshot.ts` `snapshotFor` uses it when `logLength` is passed. A call without `logLength` still builds a fresh proof.

**If this is wrong.** A character's committed state changed and `lok.length` did not. The cached proof would then disagree with the wasm character root. A journal append is what advances `length` and clears the document cache. Walking does not.

The byte-identity check lives in `apps/server/src/web-light-snapshot.test.ts`.

## Change 3 — client stops re-verifying an unchanged proof

`memoLightVerdict` in `packages/client-core/src/state.ts` keeps the last Ed25519 verdict. The key is the light-client payload plus `allowlistGeneration()` from `packages/client-core/src/light-client.ts`.

**Sacrifice.** There is no time expiry. A verdict stands until those bytes or the allowlist change. Ed25519 signatures do not expire on their own. A new certificate is a new payload and is checked again.

## Change 4 — reconnect without another signature

After a login signature succeeds, `issueAuthResume` in `apps/server/src/wallet-auth.ts` returns a 32-byte token bound to that wallet for 12 hours. `completeWalletSession` in `apps/server/src/index.ts` sends it on `auth/ok`. The page keeps it in memory. A dropped socket sends `auth/resume` instead of `auth/hello`.

The token is rejected for any other wallet, after expiry, and after `auth/logout`. It is forgotten when the process restarts. The next entry then waits on the Connect button and does not open the wallet by itself. Pressing Connect still personal-signs.

**Sacrifice.** For those 12 hours, whoever can read the token can reattach the game socket as that wallet. It does not mint, pay, list, or place a bounty. Those paths still ask the wallet. The token is not on chain. It is a session credential for this process only.

Tests: `apps/server/src/wallet-auth.test.ts` ("a resume token reconnects the signed wallet and rejects anyone else").

## When a chain symptom is this change

| What you see | Relevant change |
| --- | --- |
| Sealed height does not advance while players only walk | Change 1. Expected. |
| A replica or light client has no batch for an idle stretch | Change 1. Absence is not a signed empty batch. |
| A log event, roll, or guild payout has no seal | Not expected. Change 1 must still seal those ticks. |
| A proof matches an older log length after a journal write | Change 2. Length should have moved. |
| Committed light view sticks until the next different proof | Change 3. Expected while the payload is unchanged. |
| Reconnect succeeds with no wallet prompt | Change 4. Expected inside 12 hours on the same process. |
| Reconnect after a server restart sits on Connect and does not pop the wallet | Change 4. Expected. One click signs in. |
| Wallet popup on Ash Pit join, mint, or auction pay | Not this change. Those actions still ask the wallet. |
| `ownerOf`, escrow, or bounty result disagrees with the contract | Not this change. No contract call was altered. |
