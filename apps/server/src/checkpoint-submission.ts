/**
 * A checkpoint submission is one phase. The first real submit uses this union.
 * Drafted, submitted, confirmed, and reorged are not booleans.
 */
export type CheckpointSubmission =
  | { phase: "drafted"; bodyHash: string }
  | { phase: "submitted"; bodyHash: string; txHash: string }
  | { phase: "confirmed"; bodyHash: string; txHash: string; blockNumber: bigint }
  | { phase: "reorged"; bodyHash: string; txHash: string };

export type CheckpointEvent =
  | { type: "draft"; bodyHash: string }
  | { type: "submit"; txHash: string }
  | { type: "confirm"; blockNumber: bigint }
  | { type: "reorg" };

export function reduceCheckpoint(
  state: CheckpointSubmission | null,
  event: CheckpointEvent,
): CheckpointSubmission | null {
  switch (event.type) {
    case "draft":
      if (state && state.phase !== "reorged") return state;
      return { phase: "drafted", bodyHash: event.bodyHash };
    case "submit":
      if (!state || state.phase !== "drafted") return state;
      return { phase: "submitted", bodyHash: state.bodyHash, txHash: event.txHash };
    case "confirm":
      if (!state || state.phase !== "submitted") return state;
      return {
        phase: "confirmed",
        bodyHash: state.bodyHash,
        txHash: state.txHash,
        blockNumber: event.blockNumber,
      };
    case "reorg":
      if (!state || (state.phase !== "submitted" && state.phase !== "confirmed")) return state;
      return { phase: "reorged", bodyHash: state.bodyHash, txHash: state.txHash };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
