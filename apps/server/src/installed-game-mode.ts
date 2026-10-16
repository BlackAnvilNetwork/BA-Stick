/**
 * Mode of an installed game. `docs/multi-operator.md` section 3.
 *
 * An installed game is a validator unless its owner enables the replica
 * flag. The flag is gated by a resource self-check ("can I hold a replica?")
 * and a reachability check. Resource profiles are published after the Phase 0
 * load test; this module does not invent CPU, RAM, or disk numbers. A failing
 * check keeps the process a validator.
 *
 * Replica mode does not grant a combat bonus, a second guild, or the listing
 * key. A hosted server is a replica by its own configuration. This module
 * decides the installed game only.
 */

export type InstalledGameMode = {
  mode: "validator" | "replica";
};

/** Owner opt-in. Both checks must pass or the process stays a validator. */
export type ReplicaOptIn = {
  /** Owner enabled the replica flag. */
  replicaFlag: boolean;
  /** Answer to "can I hold a replica?". No resource profile is applied here. */
  canHoldReplica: boolean;
  /** Reachability check from the same spec sentence. */
  reachable: boolean;
};

const VALIDATOR: InstalledGameMode = { mode: "validator" };

/**
 * Default is validator. Replica requires the flag, a passing resource
 * self-check, and a passing reachability check. Anything short of that
 * stays a validator. The result never carries a combat bonus, a second
 * guild, or the listing key.
 */
export function installedGameMode(optIn?: ReplicaOptIn): InstalledGameMode {
  if (optIn?.replicaFlag !== true) return { ...VALIDATOR };
  if (optIn.canHoldReplica !== true) return { ...VALIDATOR };
  if (optIn.reachable !== true) return { ...VALIDATOR };
  return { mode: "replica" };
}
