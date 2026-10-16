import assert from "node:assert/strict";
import test from "node:test";
import { concatBytes, keccak256 } from "viem";
import {
  acceptBatch,
  commitInputs,
  HASH_BYTES,
  type BatchEnvelope,
  type BatchExpect,
} from "./batch-envelope";
import { fallbackEpochSeed } from "./fallback-epoch-seed";

const ROLL_BYTES = Uint8Array.from([9, 8, 7, 6]);

function hash(fill: number): Uint8Array {
  return new Uint8Array(HASH_BYTES).fill(fill);
}

function flipLast(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src);
  out[out.length - 1] = (out[out.length - 1]! ^ 0xff) & 0xff;
  return out;
}

/** keccak256(inputsCommitment || epochSeed || rollBytes), same viem keccak as the envelope. */
function boundRoll(
  inputsCommitment: Uint8Array,
  epochSeed: Uint8Array,
  rollBytes: Uint8Array,
): Uint8Array {
  return new Uint8Array(keccak256(concatBytes([inputsCommitment, epochSeed, rollBytes]), "bytes"));
}

function envelope(over: Partial<BatchEnvelope> = {}): BatchEnvelope {
  const inputs = over.inputs ?? Uint8Array.from([1, 2, 3, 4]);
  const leaderCommitment = over.leaderCommitment ?? hash(0x44);
  const gnosisRandomness = over.gnosisRandomness ?? hash(0x55);
  const inputsCommitment = commitInputs(inputs);
  const epochSeed =
    leaderCommitment.length === HASH_BYTES && gnosisRandomness.length === HASH_BYTES
      ? fallbackEpochSeed(leaderCommitment, gnosisRandomness)
      : hash(0x66);
  return {
    inputs,
    inputsCommitment,
    parentRoot: hash(0x11),
    nextRoot: hash(0x22),
    rulesetHash: hash(0x33),
    epoch: 2,
    height: 5,
    worldId: "bellgrave",
    protocolVersion: "1",
    leaderCommitment,
    gnosisRandomness,
    epochSeed,
    rollCommitment: boundRoll(inputsCommitment, epochSeed, ROLL_BYTES),
    signature: Uint8Array.from([0xab, 0xcd]),
    ...over,
  };
}

function chain(batch: BatchEnvelope, over: Partial<BatchExpect> = {}): BatchExpect {
  return {
    epoch: batch.epoch,
    height: batch.height,
    worldId: batch.worldId,
    protocolVersion: batch.protocolVersion,
    rollBytes: ROLL_BYTES,
    ...over,
  };
}

test("accepts a batch when parent, ruleset, commitment, and replay root match", () => {
  const batch = envelope();
  assert.equal(batch.inputsCommitment.length, HASH_BYTES);
  assert.equal(batch.leaderCommitment.length, HASH_BYTES);
  assert.equal(batch.gnosisRandomness.length, HASH_BYTES);
  assert.equal(batch.epochSeed.length, HASH_BYTES);
  assert.equal(batch.rollCommitment.length, HASH_BYTES);
  assert.deepEqual(
    batch.rollCommitment,
    boundRoll(batch.inputsCommitment, batch.epochSeed, ROLL_BYTES),
  );
  assert.ok(batch.signature && batch.signature.length > 0);
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, {
    epoch: 2,
    height: 5,
    worldId: "bellgrave",
    protocolVersion: "1",
    rollBytes: ROLL_BYTES,
  });
  assert.deepEqual(result, { ok: true, epoch: 2, height: 5 });
  assert.equal("verified" in result, false);
});

test("rejects a stale parent", () => {
  const batch = envelope();
  const result = acceptBatch(batch, flipLast(batch.parentRoot), batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "stale_parent" });
});

test("rejects a wrong ruleset", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, flipLast(batch.rulesetHash), batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "wrong_ruleset" });
});

test("rejects a commitment that is not the keccak of the inputs", () => {
  const batch = envelope({ inputsCommitment: hash(0x55) });
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "commitment_mismatch" });
});

test("rejects a replay root that is not nextRoot", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, flipLast(batch.nextRoot), chain(batch));
  assert.deepEqual(result, { ok: false, error: "root_mismatch" });
});

test("rejects a batch from the wrong epoch", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch, { epoch: 3 }));
  assert.deepEqual(result, { ok: false, error: "wrong_epoch" });
});

test("rejects a batch at the wrong height", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch, { height: 6 }));
  assert.deepEqual(result, { ok: false, error: "wrong_height" });
});

test("rejects a batch for the wrong world", () => {
  const batch = envelope();
  const result = acceptBatch(
    batch,
    batch.parentRoot,
    batch.rulesetHash,
    batch.nextRoot,
    chain(batch, { worldId: "other-world" }),
  );
  assert.deepEqual(result, { ok: false, error: "wrong_world" });
});

test("rejects a batch on the wrong protocol", () => {
  const batch = envelope();
  const result = acceptBatch(
    batch,
    batch.parentRoot,
    batch.rulesetHash,
    batch.nextRoot,
    chain(batch, { protocolVersion: "2" }),
  );
  assert.deepEqual(result, { ok: false, error: "wrong_protocol" });
});

test("rejects an epoch seed that is not the recomputed fallback seed", () => {
  const batch = envelope();
  const claimed = envelope({ epochSeed: flipLast(batch.epochSeed) });
  const result = acceptBatch(claimed, claimed.parentRoot, claimed.rulesetHash, claimed.nextRoot, chain(claimed));
  assert.deepEqual(result, { ok: false, error: "seed_mismatch" });
});

test("rejects a roll commitment hashed without the inputs commitment or the epoch seed", () => {
  const sample = envelope();
  const bound = boundRoll(sample.inputsCommitment, sample.epochSeed, ROLL_BYTES);
  const bytesOnly = commitInputs(ROLL_BYTES);
  assert.notDeepEqual(bound, bytesOnly);
  const batch = envelope({ rollCommitment: bytesOnly });
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "roll_commitment_mismatch" });
});

test("rejects a short leader commitment", () => {
  const batch = envelope({ leaderCommitment: new Uint8Array(31) });
  assert.throws(
    () => acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "leader commitment is short" },
  );
});

test("rejects a long leader commitment", () => {
  const batch = envelope({ leaderCommitment: new Uint8Array(33) });
  assert.throws(
    () => acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "leader commitment is long" },
  );
});

test("rejects short Gnosis randomness", () => {
  const batch = envelope({ gnosisRandomness: new Uint8Array(31) });
  assert.throws(
    () => acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "gnosis randomness is short" },
  );
});

test("rejects long Gnosis randomness", () => {
  const batch = envelope({ gnosisRandomness: new Uint8Array(33) });
  assert.throws(
    () => acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "gnosis randomness is long" },
  );
});
