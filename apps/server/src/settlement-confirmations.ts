/**
 * Blocks behind tip before indexing settlement events.
 * Gnosis ~5s blocks → depth 2 ≈ 10s (docs/mainnet-plan.md minimum).
 * Override with LOK_CONFIRMATIONS (integer, blocks).
 */
import { settlementChainId } from "./settlement-chain";

/** Default for anvil / unknown chains. */
export const DEFAULT_LOCAL_CONFIRMATIONS = 2n;

/**
 * Default for Gnosis mainnet (100) and Chiado (10200).
 * Matches prior hardcoded watchers; raise via LOK_CONFIRMATIONS for more reorg safety.
 */
export const DEFAULT_GNOSIS_CONFIRMATIONS = 2n;

export function settlementConfirmations(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env.LOK_CONFIRMATIONS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return BigInt(raw);
  }
  const chainId = settlementChainId(env);
  if (chainId === 100 || chainId === 10200) return DEFAULT_GNOSIS_CONFIRMATIONS;
  return DEFAULT_LOCAL_CONFIRMATIONS;
}
