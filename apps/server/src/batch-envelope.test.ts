import assert from "node:assert/strict";
import test from "node:test";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { concatBytes, keccak256 } from "viem";
import {
  acceptBatch,
  commitInputs,
  HASH_BYTES,
  LEADER_KEY_BYTES,
  LEADER_SIG_BYTES,
  leaderSigningMessage,
  type BatchEnvelope,
  type BatchExpect,
} from "./batch-envelope";
import { fallbackEpochSeed } from "./fallback-epoch-seed";

const bls = bls12_381.longSignatures;
const leader = bls.keygen();
const other = bls.keygen();
const leaderKey = new Uint8Array(leader.publicKey.toBytes());
const leaderSecret = new Uint8Array(leader.secretKey);
const otherSecret = new Uint8Array(other.secretKey);

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

/** Independent copy of the spec preimage, so the signer does not call the verifier's helper. */
function specSigningMessage(batch: BatchEnvelope): Uint8Array {
  const epoch = new Uint8Array(8);
  const height = new Uint8Array(8);
  new DataView(epoch.buffer).setBigUint64(0, BigInt(batch.epoch), false);
  new DataView(height.buffer).setBigUint64(0, BigInt(batch.height), false);
  return new Uint8Array(
    keccak256(
      concatBytes([
        new TextEncoder().encode("bellgrave-batch-v1"),
        batch.inputsCommitment,
        batch.parentRoot,
        batch.nextRoot,
        batch.rulesetHash,
        batch.epochSeed,
        batch.rollCommitment,
        epoch,
        height,
        new TextEncoder().encode(batch.worldId),
        new TextEncoder().encode(batch.protocolVersion),
      ]),
      "bytes",
    ),
  );
}

function sign(batch: BatchEnvelope, secret: Uint8Array = leaderSecret): Uint8Array {
  const hashed = bls.hash(specSigningMessage(batch));
  return new Uint8Array(bls.sign(hashed, secret).toBytes());
}

function signed(over: Partial<BatchEnvelope> = {}, secret: Uint8Array = leaderSecret): BatchEnvelope {
  const batch = envelope(over);
  return { ...batch, signature: sign(batch, secret) };
}

function decide(
  batch: BatchEnvelope,
  parent: Uint8Array,
  ruleset: Uint8Array,
  root: Uint8Array,
  expected: BatchExpect,
  key: Uint8Array = leaderKey,
) {
  return acceptBatch(batch, parent, ruleset, root, expected, key);
}

test("accepts a batch when parent, ruleset, commitment, replay root, and leader signature match", () => {
  const batch = signed();
  assert.equal(batch.inputsCommitment.length, HASH_BYTES);
  assert.equal(batch.leaderCommitment.length, HASH_BYTES);
  assert.equal(batch.gnosisRandomness.length, HASH_BYTES);
  assert.equal(batch.epochSeed.length, HASH_BYTES);
  assert.equal(batch.rollCommitment.length, HASH_BYTES);
  assert.deepEqual(
    batch.rollCommitment,
    boundRoll(batch.inputsCommitment, batch.epochSeed, ROLL_BYTES),
  );
  assert.equal(leaderKey.length, LEADER_KEY_BYTES);
  assert.equal(batch.signature?.length, LEADER_SIG_BYTES);
  assert.deepEqual(leaderSigningMessage(batch), specSigningMessage(batch));
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, {
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
  const result = decide(batch, flipLast(batch.parentRoot), batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "stale_parent" });
});

test("rejects a wrong ruleset", () => {
  const batch = envelope();
  const result = decide(batch, batch.parentRoot, flipLast(batch.rulesetHash), batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "wrong_ruleset" });
});

test("rejects a commitment that is not the keccak of the inputs", () => {
  const batch = envelope({ inputsCommitment: hash(0x55) });
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "commitment_mismatch" });
});

test("rejects a replay root that is not nextRoot", () => {
  const batch = envelope();
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, flipLast(batch.nextRoot), chain(batch));
  assert.deepEqual(result, { ok: false, error: "root_mismatch" });
});

test("rejects a batch from the wrong epoch", () => {
  const batch = envelope();
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch, { epoch: 3 }));
  assert.deepEqual(result, { ok: false, error: "wrong_epoch" });
});

test("rejects a batch at the wrong height", () => {
  const batch = envelope();
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch, { height: 6 }));
  assert.deepEqual(result, { ok: false, error: "wrong_height" });
});

test("rejects a batch for the wrong world", () => {
  const batch = envelope();
  const result = decide(
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
  const result = decide(
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
  const result = decide(claimed, claimed.parentRoot, claimed.rulesetHash, claimed.nextRoot, chain(claimed));
  assert.deepEqual(result, { ok: false, error: "seed_mismatch" });
});

test("rejects a roll commitment hashed without the inputs commitment or the epoch seed", () => {
  const sample = envelope();
  const bound = boundRoll(sample.inputsCommitment, sample.epochSeed, ROLL_BYTES);
  const bytesOnly = commitInputs(ROLL_BYTES);
  assert.notDeepEqual(bound, bytesOnly);
  const batch = envelope({ rollCommitment: bytesOnly });
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "roll_commitment_mismatch" });
});

test("rejects a short leader commitment", () => {
  const batch = envelope({ leaderCommitment: new Uint8Array(31) });
  assert.throws(
    () => decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "leader commitment is short" },
  );
});

test("rejects a long leader commitment", () => {
  const batch = envelope({ leaderCommitment: new Uint8Array(33) });
  assert.throws(
    () => decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "leader commitment is long" },
  );
});

test("rejects short Gnosis randomness", () => {
  const batch = envelope({ gnosisRandomness: new Uint8Array(31) });
  assert.throws(
    () => decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "gnosis randomness is short" },
  );
});

test("rejects long Gnosis randomness", () => {
  const batch = envelope({ gnosisRandomness: new Uint8Array(33) });
  assert.throws(
    () => decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)),
    { message: "gnosis randomness is long" },
  );
});

test("rejects a leader key that is not 48 bytes", () => {
  const batch = signed();
  const parent = batch.parentRoot;
  const ruleset = batch.rulesetHash;
  const root = batch.nextRoot;
  const expected = chain(batch);
  assert.deepEqual(decide(batch, parent, ruleset, root, expected, leaderKey.slice(0, 47)), {
    ok: false,
    error: "bad_leader_key",
  });
  assert.deepEqual(decide(batch, parent, ruleset, root, expected, new Uint8Array(49)), {
    ok: false,
    error: "bad_leader_key",
  });
});

test("rejects a missing or wrong-length signature", () => {
  const absent = envelope({ signature: undefined });
  const short = envelope();
  const long = envelope({ signature: new Uint8Array(97) });
  for (const batch of [absent, short, long]) {
    assert.deepEqual(decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch)), {
      ok: false,
      error: "missing_signature",
    });
  }
});

test("rejects a signature over a different parent root", () => {
  const batch = envelope();
  const foreign = sign(envelope({ parentRoot: flipLast(batch.parentRoot) }));
  const presented = { ...batch, signature: foreign };
  const result = decide(presented, presented.parentRoot, presented.rulesetHash, presented.nextRoot, chain(presented));
  assert.deepEqual(result, { ok: false, error: "bad_signature" });
});

test("rejects a signature from a different key", () => {
  const batch = signed({}, otherSecret);
  const result = decide(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot, chain(batch));
  assert.deepEqual(result, { ok: false, error: "bad_signature" });
});
