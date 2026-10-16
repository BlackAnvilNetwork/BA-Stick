import assert from "node:assert/strict";
import test from "node:test";
import { acceptBatch, commitInputs, HASH_BYTES, type BatchEnvelope } from "./batch-envelope";

function hash(fill: number): Uint8Array {
  return new Uint8Array(HASH_BYTES).fill(fill);
}

function flipLast(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src);
  out[out.length - 1] = (out[out.length - 1]! ^ 0xff) & 0xff;
  return out;
}

function envelope(over: Partial<BatchEnvelope> = {}): BatchEnvelope {
  const inputs = over.inputs ?? Uint8Array.from([1, 2, 3, 4]);
  return {
    inputs,
    inputsCommitment: commitInputs(inputs),
    parentRoot: hash(0x11),
    nextRoot: hash(0x22),
    rulesetHash: hash(0x33),
    epoch: 2,
    height: 5,
    signature: Uint8Array.from([0xab, 0xcd]),
    ...over,
  };
}

test("accepts a batch when parent, ruleset, commitment, and replay root match", () => {
  const batch = envelope();
  assert.equal(batch.inputsCommitment.length, HASH_BYTES);
  assert.ok(batch.signature && batch.signature.length > 0);
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot);
  assert.deepEqual(result, { ok: true, epoch: 2, height: 5 });
  assert.equal("verified" in result, false);
});

test("rejects a stale parent", () => {
  const batch = envelope();
  const result = acceptBatch(batch, flipLast(batch.parentRoot), batch.rulesetHash, batch.nextRoot);
  assert.deepEqual(result, { ok: false, error: "stale_parent" });
});

test("rejects a wrong ruleset", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, flipLast(batch.rulesetHash), batch.nextRoot);
  assert.deepEqual(result, { ok: false, error: "wrong_ruleset" });
});

test("rejects a commitment that is not the keccak of the inputs", () => {
  const batch = envelope({ inputsCommitment: hash(0x55) });
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, batch.nextRoot);
  assert.deepEqual(result, { ok: false, error: "commitment_mismatch" });
});

test("rejects a replay root that is not nextRoot", () => {
  const batch = envelope();
  const result = acceptBatch(batch, batch.parentRoot, batch.rulesetHash, flipLast(batch.nextRoot));
  assert.deepEqual(result, { ok: false, error: "root_mismatch" });
});
