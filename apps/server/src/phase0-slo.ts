/**
 * Phase 0 service levels (issue #305).
 * A ledger op is one LokWorld apply. A game tick is one sim step, including
 * the coalesced journal flush.
 */
export const SLO_LEDGER_OP_P99_MS = 5;
export const SLO_GAME_TICK_MS = 50;

export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}
