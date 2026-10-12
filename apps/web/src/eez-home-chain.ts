/**
 * Client “pay from home chain” picker for EEZ / local mock sync buys.
 */
import type { EezSyncBuyClientConfig } from "@bellgrave/protocol";

export type HomeChainOption = {
  chainId: number;
  label: string;
  rpcUrl: string;
};

/** Populate from server snapshot once LOK_EEZ_* (or local mock) is configured. */
export function listHomeChainOptions(cfg?: EezSyncBuyClientConfig | null): HomeChainOption[] {
  if (!cfg?.syncBuyEnabled || !cfg.homeRpcUrl || cfg.homeChainId == null) return [];
  return [
    {
      chainId: cfg.homeChainId,
      label: cfg.homeLabel || "Home chain " + cfg.homeChainId,
      rpcUrl: cfg.homeRpcUrl,
    },
  ];
}

export function eezSyncBuyAvailable(cfg?: EezSyncBuyClientConfig | null): boolean {
  return !!(cfg?.syncBuyEnabled && cfg.mockSyncBuy && cfg.homeChainId != null && cfg.homeRpcUrl);
}

export function selectedHomeChain(
  cfg: EezSyncBuyClientConfig | null | undefined,
  preferredChainId?: number,
): HomeChainOption | null {
  const opts = listHomeChainOptions(cfg);
  if (!opts.length) return null;
  if (preferredChainId != null) {
    const hit = opts.find((o) => o.chainId === preferredChainId);
    if (hit) return hit;
  }
  return opts[0] ?? null;
}
