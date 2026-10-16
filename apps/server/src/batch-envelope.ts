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
 * When the batch carries a proof, this check replays the pinned wasm for
 * that batch. The proof's result has to be that replay. A disagreement
 * ignores the proof and the batch is invalid. A batch with no proof does
 * not replay the wasm and does not need a proof.
 *
 * The leader signature is BLS12-381 in the Gnosis / EIP-2537 validator
 * convention: a 48-byte G1 public key and a 96-byte G2 signature, checked
 * with `@noble/curves` long signatures. The signed message is the keccak256
 * of the domain `bellgrave-batch-v1`, the envelope commitments and roots,
 * the big-endian epoch and height, then the world id and protocol version.
 *
 * A leader commitment or Gnosis randomness value that is not 32 bytes throws
 * the length error from `fallbackEpochSeed`.
 */
import { timingSafeEqual } from "node:crypto";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { concatBytes, keccak256 } from "viem";
import { fallbackEpochSeed } from "./fallback-epoch-seed";
import { judgeTickProof, storeAcceptedProof } from "./proof-replay";
import { proofVerifyingKeyAccepted } from "./ruleset-record";

/** Keccak digest length used for commitments, roots, and the ruleset hash. */
export const HASH_BYTES = 32;

/** Compressed BLS12-381 G1 public key. */
export const LEADER_KEY_BYTES = 48;

/** Compressed BLS12-381 G2 signature. */
export const LEADER_SIG_BYTES = 96;

const LEADER_DOMAIN = new TextEncoder().encode("bellgrave-batch-v1");
const bls = bls12_381.longSignatures;

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
  | "roll_commitment_mismatch"
  | "bad_leader_key"
  | "missing_signature"
  | "bad_signature"
  | "foreign_verifying_key"
  | "proof_disagrees";

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
  /**
   * SP1 verifying key this proof was made under (`0x` and 64 hex chars).
   * Absent when the batch carries no proof. Any other key is not a batch of
   * this world. When this field is present, `proofResult` is checked against
   * replay of the pinned wasm. A disagreement ignores the proof and the
   * batch is invalid. Agreement still requires this key to be the active pin.
   */
  proofVerifyingKey?: string;
  /**
   * Result the proof claims for this batch: the 32-byte character-root tree
   * from replay of the pinned wasm. Absent when the batch carries no proof.
   * A different result is ignored, and the batch is invalid.
   */
  proofResult?: Uint8Array;
  /**
   * 96-byte BLS12-381 G2 signature over {@link leaderSigningMessage}.
   * Absent until the producer attaches one.
   */
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

function u64be(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value), false);
  return out;
}

/**
 * Keccak256 of the bytes the epoch leader signs.
 * Domain, then inputsCommitment, parentRoot, nextRoot, rulesetHash,
 * epochSeed, rollCommitment, big-endian epoch, big-endian height,
 * then UTF-8 worldId and protocolVersion.
 */
export function leaderSigningMessage(envelope: BatchEnvelope): Uint8Array {
  return new Uint8Array(
    keccak256(
      concatBytes([
        LEADER_DOMAIN,
        envelope.inputsCommitment,
        envelope.parentRoot,
        envelope.nextRoot,
        envelope.rulesetHash,
        envelope.epochSeed,
        envelope.rollCommitment,
        u64be(envelope.epoch),
        u64be(envelope.height),
        new TextEncoder().encode(envelope.worldId),
        new TextEncoder().encode(envelope.protocolVersion),
      ]),
      "bytes",
    ),
  );
}

function leaderSignatureOk(envelope: BatchEnvelope, leaderPublicKey: Uint8Array): boolean {
  const message = bls.hash(leaderSigningMessage(envelope));
  try {
    return bls.verify(envelope.signature!, message, leaderPublicKey);
  } catch {
    return false;
  }
}

/**
 * True when `signer` produced this envelope's BLS signature.
 * A key that is not 48 bytes, or a signature that is not 96 bytes, is false.
 * The listing key is an ECDSA account and is not a signer here.
 */
export function leaderSignatureValid(envelope: BatchEnvelope, signer: Uint8Array): boolean {
  if (signer.length !== LEADER_KEY_BYTES) return false;
  if (!envelope.signature || envelope.signature.length !== LEADER_SIG_BYTES) return false;
  return leaderSignatureOk(envelope, signer);
}

/**
 * Accept `envelope` only when world, protocol, parent, epoch, height,
 * ruleset, inputs commitment, fallback epoch seed, roll commitment,
 * replay root, and the epoch leader's BLS signature all agree.
 * A proof is accepted only when its result is the pinned-wasm replay and
 * its verifying key is the active pin. No proof skips that replay.
 * A disagreement is not stored. A proof is stored only after the rest of
 * the batch agrees as well.
 */
export function acceptBatch(
  envelope: BatchEnvelope,
  expectedParent: Uint8Array,
  expectedRuleset: Uint8Array,
  replayNextRoot: Uint8Array,
  expected: BatchExpect,
  leaderPublicKey: Uint8Array,
): AcceptBatchResult {
  if (leaderPublicKey.length !== LEADER_KEY_BYTES) {
    return { ok: false, error: "bad_leader_key" };
  }
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
  if (envelope.proofVerifyingKey !== undefined || envelope.proofResult !== undefined) {
    const verdict = judgeTickProof({
      prover: "sp1",
      verifyingKey: envelope.proofVerifyingKey ?? "",
      result: envelope.proofResult ?? new Uint8Array(),
      log: envelope.inputs,
    });
    if (!verdict.ok) return { ok: false, error: verdict.error };
  }
  if (!proofVerifyingKeyAccepted(envelope.proofVerifyingKey)) {
    return { ok: false, error: "foreign_verifying_key" };
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
  if (!envelope.signature || envelope.signature.length !== LEADER_SIG_BYTES) {
    return { ok: false, error: "missing_signature" };
  }
  if (!leaderSignatureOk(envelope, leaderPublicKey)) {
    return { ok: false, error: "bad_signature" };
  }
  if (envelope.proofVerifyingKey !== undefined) {
    const result = envelope.proofResult;
    if (!result || !storeAcceptedProof(envelope.inputs, result)) {
      return { ok: false, error: "proof_disagrees" };
    }
  }
  return { ok: true, epoch: envelope.epoch, height: envelope.height };
}
