/**
 * Blocks behind tip before indexing settlement events.
 * Gnosis ~5s blocks → depth 30 ≈ 2.5 min (prefer `finalized` when RPC supports it).
 * Override with LOK_CONFIRMATIONS (integer, blocks).
 */
import { settlementChainId } from "./settlement-chain";

/** Default for anvil / unknown chains. */
export const DEFAULT_LOCAL_CONFIRMATIONS = 2n;

/**
 * Default for Gnosis mainnet (100) and Chiado (10200) when `finalized` is unavailable.
 * Watchers also try eth_getBlockByNumber("finalized") first via settlementSafeHead.
 */
export const DEFAULT_GNOSIS_CONFIRMATIONS = 30n;

export function settlementConfirmations(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env.LOK_CONFIRMATIONS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return BigInt(raw);
  }
  const chainId = settlementChainId(env);
  if (chainId === 100 || chainId === 10200) return DEFAULT_GNOSIS_CONFIRMATIONS;
  return DEFAULT_LOCAL_CONFIRMATIONS;
}

/** Prefer finalized tip on Gnosis / Chiado (and when LOK_USE_FINALIZED=1). */
export function preferFinalizedTip(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.LOK_USE_FINALIZED?.trim();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  const chainId = settlementChainId(env);
  return chainId === 100 || chainId === 10200;
}
