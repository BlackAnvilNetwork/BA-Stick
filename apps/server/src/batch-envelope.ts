/**
 * Acceptance core for a Black Anvil batch envelope (rollout step 3).
 *
 * A second process calls `acceptBatch` with the parent, ruleset, epoch,
 * height, world id, and protocol version it already holds, the root it
 * produced by replaying `inputs`, and the roll bytes for this batch. The
 * check passes only when those match, `inputsCommitment` is the keccak of
 * the input bytes, the claimed `epochSeed` is the fallback seed of the
 * envelope's leader commitment and Gnosis randomness, `rollCommitment` is
 * the keccak of `inputsCommitment || epochSeed || rollBytes`, and the
 * replay root equals `nextRoot`.
 *
 * A leader commitment or Gnosis randomness value that is not 32 bytes throws
 * the length error from `fallbackEpochSeed`. `signature` is optional
 * recorded bytes; this module does not verify it.
 */
import { timingSafeEqual } from "node:crypto";
import { concatBytes, keccak256 } from "viem";
import { fallbackEpochSeed } from "./fallback-epoch-seed";

/** Keccak digest length used for commitments, roots, and the ruleset hash. */
export const HASH_BYTES = 32;

export type BatchReject =
  | "stale_parent"
  | "wrong_ruleset"
  | "commitment_mismatch"
  | "root_mismatch"
  | "wrong_epoch"
  | "wrong_height"
  | "wrong_world"
  | "wrong_protocol"
  | "seed_mismatch"
  | "roll_commitment_mismatch";

/**
 * One batch a leader can hand to another process.
 * `inputs` is opaque. Its commitment is `keccak256(inputs)`.
 */
export type BatchEnvelope = {
  /** 32-byte keccak of `inputs`. */
  inputsCommitment: Uint8Array;
  parentRoot: Uint8Array;
  nextRoot: Uint8Array;
  rulesetHash: Uint8Array;
  epoch: number;
  height: number;
  /** World this batch belongs to. Compared exactly with the caller's id. */
  worldId: string;
  /** Protocol this batch was produced under. Compared exactly with the caller's version. */
  protocolVersion: string;
  inputs: Uint8Array;
  /** 32-byte leader commitment mixed into the fallback epoch seed. */
  leaderCommitment: Uint8Array;
  /** 32-byte Gnosis randomness mixed into the fallback epoch seed. */
  gnosisRandomness: Uint8Array;
  /** Claimed epoch seed. Must equal `fallbackEpochSeed(leaderCommitment, gnosisRandomness)`. */
  epochSeed: Uint8Array;
  /** 32-byte keccak of inputsCommitment || epochSeed || rollBytes. */
  rollCommitment: Uint8Array;
  /** Leader signature bytes, if the producer attached any. Not verified here. */
  signature?: Uint8Array;
};

/** Chain position and roll bytes the caller already holds. */
export type BatchExpect = {
  epoch: number;
  height: number;
  worldId: string;
  protocolVersion: string;
  rollBytes: Uint8Array;
};

export type AcceptBatchResult =
  | { ok: true; epoch: number; height: number }
  | { ok: false; error: BatchReject };

/** Keccak-256 of an opaque byte string, using the repo's viem keccak. */
export function commitInputs(inputs: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(inputs, "bytes"));
}

/**
 * Roll commitment bound to the inputs and the epoch seed.
 * Preimage is inputsCommitment || epochSeed || rollBytes.
 */
export function commitRoll(
  inputsCommitment: Uint8Array,
  epochSeed: Uint8Array,
  rollBytes: Uint8Array,
): Uint8Array {
  return new Uint8Array(keccak256(concatBytes([inputsCommitment, epochSeed, rollBytes]), "bytes"));
}

function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== HASH_BYTES || b.length !== HASH_BYTES) return false;
  return timingSafeEqual(a, b);
}

/**
 * Accept `envelope` only when world, protocol, parent, epoch, height,
 * ruleset, inputs commitment, fallback epoch seed, roll commitment, and
 * replay root all agree.
 */
export function acceptBatch(
  envelope: BatchEnvelope,
  expectedParent: Uint8Array,
  expectedRuleset: Uint8Array,
  replayNextRoot: Uint8Array,
  expected: BatchExpect,
): AcceptBatchResult {
  if (envelope.worldId !== expected.worldId) {
    return { ok: false, error: "wrong_world" };
  }
  if (envelope.protocolVersion !== expected.protocolVersion) {
    return { ok: false, error: "wrong_protocol" };
  }
  if (!sameHash(envelope.parentRoot, expectedParent)) {
    return { ok: false, error: "stale_parent" };
  }
  if (envelope.epoch !== expected.epoch) {
    return { ok: false, error: "wrong_epoch" };
  }
  if (envelope.height !== expected.height) {
    return { ok: false, error: "wrong_height" };
  }
  if (!sameHash(envelope.rulesetHash, expectedRuleset)) {
    return { ok: false, error: "wrong_ruleset" };
  }
  const commitment = commitInputs(envelope.inputs);
  if (!sameHash(envelope.inputsCommitment, commitment)) {
    return { ok: false, error: "commitment_mismatch" };
  }
  const seed = fallbackEpochSeed(envelope.leaderCommitment, envelope.gnosisRandomness);
  if (!sameHash(envelope.epochSeed, seed)) {
    return { ok: false, error: "seed_mismatch" };
  }
  if (!sameHash(envelope.rollCommitment, commitRoll(commitment, seed, expected.rollBytes))) {
    return { ok: false, error: "roll_commitment_mismatch" };
  }
  if (!sameHash(envelope.nextRoot, replayNextRoot)) {
    return { ok: false, error: "root_mismatch" };
  }
  return { ok: true, epoch: envelope.epoch, height: envelope.height };
}
