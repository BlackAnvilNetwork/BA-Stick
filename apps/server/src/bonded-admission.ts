/**
 * Local replica registry. Open bonded admission.
 *
 * A replica joins the voting set by posting a bond. The posted amount is the
 * bond. This module does not invent a minimum, a default, or a ceiling.
 *
 * Validators and light clients do not post a bond and do not join. The listing
 * key stays outside the set. A phone is a light client, so it stays out.
 *
 * Registry owner, slashing admin, and ruleset proposer stay the Gnosis Safe.
 * This module does not create the vote that would replace the Safe and does
 * not transfer admin.
 *
 * The commit threshold counts replicas in this set. While fewer than four
 * are bonded it is a majority, `1 + floor(n / 2)`, the same rule as
 * `majority_threshold`. One replica needs one signature. Three need two.
 * Once four or more are bonded it is more than two thirds of that set,
 * `floor(2n / 3) + 1`. Four need three. Five need four.
 *
 * Joining does not stop the 20 Hz tick. Nothing is broadcast. Gnosis mainnet
 * and Chiado are not called. The bond is the one `notePostedSlashableBond`
 * records. The equivocation court slashes that bond down to zero, and the
 * replica leaves this set.
 *
 * Server boot admits through `recordPostedSlashableBonds`, which calls
 * `postReplicaBond` with the wei that was posted.
 */
import { notePostedSlashableBond, postedSlashableBond } from "./root-anchor";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";

export const GNOSIS_SAFE_ADMIN = "gnosis-safe" as const;

export type RegistryAdmin = {
  registryOwner: typeof GNOSIS_SAFE_ADMIN;
  slashingAdmin: typeof GNOSIS_SAFE_ADMIN;
  rulesetProposer: typeof GNOSIS_SAFE_ADMIN;
};

export type AdmissionTier = "replica" | "validator" | "light";

export type VotingReplica = {
  id: string;
  amountWei: bigint;
};

export type AdmissionResult = {
  joined: boolean;
  amountWei: bigint;
};

/**
 * A vote a caller may attach. Admission does not read it. Attaching one does
 * not create the vote that would replace the Safe.
 */
export type AdmissionBallot = {
  replaceSafe?: boolean;
  registryOwner?: string;
  slashingAdmin?: string;
  rulesetProposer?: string;
};

const SAFE_ADMIN: RegistryAdmin = {
  registryOwner: GNOSIS_SAFE_ADMIN,
  slashingAdmin: GNOSIS_SAFE_ADMIN,
  rulesetProposer: GNOSIS_SAFE_ADMIN,
};

const voting = new Map<string, bigint>();

export function resetBondedAdmissionForTests(): void {
  voting.clear();
}

/** Registry owner, slashing admin, and ruleset proposer. Always the Gnosis Safe. */
export function registryAdmin(): RegistryAdmin {
  return { ...SAFE_ADMIN };
}

/**
 * Commit threshold of `replicaCount` bonded replicas.
 * Below four, a majority: `1 + floor(n / 2)`.
 * At four or more, more than two thirds: `floor(2n / 3) + 1`.
 * Empty and non-counts have no threshold.
 */
export function bondedCommitThreshold(replicaCount: number): number | null {
  if (!Number.isSafeInteger(replicaCount) || replicaCount < 1) return null;
  if (replicaCount < 4) return 1 + Math.floor(replicaCount / 2);
  return Math.floor((2 * replicaCount) / 3) + 1;
}

/** Commit threshold of the replicas that have joined. */
export function votingSetCommitThreshold(): number | null {
  return bondedCommitThreshold(voting.size);
}

export function votingSet(): VotingReplica[] {
  const replicas: VotingReplica[] = [];
  for (const [id, amountWei] of voting) replicas.push({ id, amountWei });
  return replicas;
}

export function votingReplica(id: string): VotingReplica | null {
  const bondId = id.trim();
  const amountWei = voting.get(bondId);
  if (amountWei == null) return null;
  return { id: bondId, amountWei };
}

/**
 * Drop a replica whose posted bond was slashed. An id that never joined stays
 * out. This does not post a bond and does not invent an amount.
 */
export function removeSlashedVotingReplica(id: string): void {
  if (typeof id !== "string") return;
  const bondId = id.trim();
  if (!bondId) return;
  voting.delete(bondId);
}

function isListingKey(id: string): boolean {
  const trimmed = id.trim().toLowerCase();
  const pinned = PINNED_GNOSIS_LISTING_ADDRESS.toLowerCase();
  return trimmed === pinned || trimmed === pinned.slice(2);
}

const NOT_JOINED: AdmissionResult = { joined: false, amountWei: 0n };

/**
 * Post `amountWei` and join the voting set when the caller is a replica.
 * The posted amount is the bond. Zero, a negative posting, a validator, a
 * light client, and the listing key do not join and do not post.
 * `ballot` is ignored.
 */
export function postReplicaBond(
  id: string,
  tier: AdmissionTier,
  amountWei: bigint,
  ballot?: AdmissionBallot,
): AdmissionResult {
  void ballot;
  if (typeof id !== "string" || typeof amountWei !== "bigint") return { ...NOT_JOINED };
  const bondId = id.trim();
  if (!bondId || tier !== "replica" || isListingKey(bondId) || amountWei <= 0n) {
    if (tier === "replica" && bondId && !isListingKey(bondId) && amountWei === 0n && voting.has(bondId)) {
      voting.delete(bondId);
      notePostedSlashableBond(bondId, 0n);
    }
    return { ...NOT_JOINED };
  }
  notePostedSlashableBond(bondId, amountWei);
  const posted = postedSlashableBond(bondId);
  if (posted !== amountWei || posted <= 0n) return { ...NOT_JOINED };
  voting.set(bondId, posted);
  return { joined: true, amountWei: posted };
}
