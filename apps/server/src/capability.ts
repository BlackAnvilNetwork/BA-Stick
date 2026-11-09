/**
 * Capability is one function. Role, sync, and lease stay separate axes.
 * `forward` is not `append`: a non-leader can accept play and send it to the
 * leader, and it still cannot write the journal.
 *
 * Until a manifest epoch is published, a replica holds a stand-in lease.
 * That is computed here. It is not stored on the role.
 *
 * Deferred boolean pairs, recorded and not rewritten here:
 * - mintConfigReady × mintConfigLoadFailed in index.ts (loading, ready, failed).
 * - Client mint handling in packages/client-core/src/pending-mint.ts has no phase.
 *   Checkpoint submission has its own union in checkpoint-submission.ts.
 */
import type { WorldSync } from "./world-sync";

export type Role = "observer" | "replica";

export type CapabilityOp = "tick" | "login" | "append" | "forward";

export type Lease =
  | { kind: "absent" }
  | { kind: "held"; epoch: bigint; holder: string };

/** Local stand-in until the manifest names an epoch leader. Not an on-chain address. */
export const STAND_IN_HOLDER = "stand-in";

export type PublishedLease = {
  epoch: bigint;
  leader: string;
};

export function leaseFor(role: Role, published: PublishedLease | null, self: string): Lease {
  if (published) {
    const leader = published.leader.trim().toLowerCase();
    const mine = self.trim().toLowerCase();
    if (role === "replica" && leader !== "" && mine === leader) {
      return { kind: "held", epoch: published.epoch, holder: published.leader };
    }
    return { kind: "absent" };
  }
  if (role === "replica") return { kind: "held", epoch: 0n, holder: STAND_IN_HOLDER };
  return { kind: "absent" };
}

function synced(sync: WorldSync): boolean {
  return sync.state === "identified" || sync.state === "genesis";
}

function leader(role: Role, lease: Lease): boolean {
  return role === "replica" && lease.kind === "held";
}

export function can(op: CapabilityOp, role: Role, sync: WorldSync, lease: Lease): boolean {
  switch (op) {
    case "login":
      return synced(sync);
    case "tick":
    case "append":
      return leader(role, lease) && synced(sync);
    case "forward":
      return synced(sync) && !leader(role, lease);
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}
