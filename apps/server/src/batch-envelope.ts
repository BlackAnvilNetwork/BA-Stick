/**
 * Acceptance core for a Black Anvil batch envelope (rollout step 3).
 *
 * A second process calls `acceptBatch` with the parent and ruleset it already
 * holds and the root it produced by replaying `inputs`. The check passes only
 * when the parent matches, the ruleset matches, `inputsCommitment` is the
 * keccak of those input bytes, and the replay root equals `nextRoot`.
 *
 * Epoch and height are stored on the envelope and echoed on success. Linking
 * them to the previous batch is the caller's job. `signature` is optional
 * recorded bytes; this module does not verify it.
 */
import { timingSafeEqual } from "node:crypto";
import { keccak256 } from "viem";

/** Keccak digest length used for commitments, roots, and the ruleset hash. */
export const HASH_BYTES = 32;

export type BatchReject =
  | "stale_parent"
  | "wrong_ruleset"
  | "commitment_mismatch"
  | "root_mismatch";

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
  inputs: Uint8Array;
  /** Leader signature bytes, if the producer attached any. Not verified here. */
  signature?: Uint8Array;
};

export type AcceptBatchResult =
  | { ok: true; epoch: number; height: number }
  | { ok: false; error: BatchReject };

/** Keccak-256 of an opaque input byte string, using the repo's viem keccak. */
export function commitInputs(inputs: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(inputs, "bytes"));
}

function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== HASH_BYTES || b.length !== HASH_BYTES) return false;
  return timingSafeEqual(a, b);
}

/**
 * Accept `envelope` only when parent, ruleset, inputs commitment, and replay
 * root all agree. Epoch and height are not checked against a chain.
 */
export function acceptBatch(
  envelope: BatchEnvelope,
  expectedParent: Uint8Array,
  expectedRuleset: Uint8Array,
  replayNextRoot: Uint8Array,
): AcceptBatchResult {
  if (!sameHash(envelope.parentRoot, expectedParent)) {
    return { ok: false, error: "stale_parent" };
  }
  if (!sameHash(envelope.rulesetHash, expectedRuleset)) {
    return { ok: false, error: "wrong_ruleset" };
  }
  const commitment = commitInputs(envelope.inputs);
  if (!sameHash(envelope.inputsCommitment, commitment)) {
    return { ok: false, error: "commitment_mismatch" };
  }
  if (!sameHash(envelope.nextRoot, replayNextRoot)) {
    return { ok: false, error: "root_mismatch" };
  }
  return { ok: true, epoch: envelope.epoch, height: envelope.height };
}
