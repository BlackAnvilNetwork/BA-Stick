# Chiado deploy

Superseded for role layout / items policy by **`docs/gnosis-launch.md`** (same `DeployChiado` entrypoint).

Quick pointer:

- Chain id **10200**, native xDAI, default mint fee **1 xDAI**
- `ADMIN` Safe, distinct `LISTING` / `ROTATOR` / `PROPOSER`, distinct `FEE_RECIPIENT`
- `ITEMS=0x0` or a real access-controlled ERC-1155 — **never** `DeployChiadoMocks` on Chiado
- After broadcast: `script/verify-deploy.sh`, then ruleset propose + **48h** timelock

```bash
cd contracts/lok-log
set -a && source .env.chiado && set +a
forge script script/DeployChiado.s.sol:DeployChiado --rpc-url "$CHIADO_RPC_URL" --sig "run()"
# --broadcast only with explicit go-ahead
```
