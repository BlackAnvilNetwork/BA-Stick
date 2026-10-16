import assert from "node:assert/strict";
import test from "node:test";
import { keccak256 } from "viem";
import { fallbackEpochSeed } from "./fallback-epoch-seed";

function filled(length: number, byte: number): Uint8Array {
  return new Uint8Array(length).fill(byte);
}

function preimage(randomness: Uint8Array, commitment: Uint8Array): Uint8Array {
  const mixed = new Uint8Array(randomness.length + commitment.length);
  mixed.set(randomness, 0);
  mixed.set(commitment, randomness.length);
  return mixed;
}

const commitment = filled(32, 0x11);
const randomness = filled(32, 0x22);

test("the same commitment and randomness yield the same 32-byte seed", () => {
  const first = fallbackEpochSeed(commitment, randomness);
  const second = fallbackEpochSeed(commitment, randomness);
  const expected = keccak256(preimage(randomness, commitment), "bytes");
  assert.equal(first.length, 32);
  assert.ok(first instanceof Uint8Array);
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  first[0] ^= 0xff;
  assert.deepEqual(second, expected);
});

test("a different leader commitment changes the seed", () => {
  const changed = new Uint8Array(commitment);
  changed[31] = 0x12;
  const seed = fallbackEpochSeed(commitment, randomness);
  const other = fallbackEpochSeed(changed, randomness);
  assert.equal(other.length, 32);
  assert.notDeepEqual(other, seed);
  assert.deepEqual(other, keccak256(preimage(randomness, changed), "bytes"));
});

test("different Gnosis randomness changes the seed", () => {
  const changed = new Uint8Array(randomness);
  changed[0] = 0x23;
  const seed = fallbackEpochSeed(commitment, randomness);
  const other = fallbackEpochSeed(commitment, changed);
  assert.equal(other.length, 32);
  assert.notDeepEqual(other, seed);
  assert.deepEqual(other, keccak256(preimage(changed, commitment), "bytes"));
});

test("a missing leader commitment is rejected", () => {
  assert.throws(() => fallbackEpochSeed(undefined, randomness), { message: "leader commitment is missing" });
  assert.throws(() => fallbackEpochSeed(null, randomness), { message: "leader commitment is missing" });
});

test("a short leader commitment is rejected", () => {
  assert.throws(() => fallbackEpochSeed(new Uint8Array(0), randomness), { message: "leader commitment is short" });
  assert.throws(() => fallbackEpochSeed(filled(31, 0x11), randomness), { message: "leader commitment is short" });
});

test("a long leader commitment is rejected", () => {
  assert.throws(() => fallbackEpochSeed(filled(33, 0x11), randomness), { message: "leader commitment is long" });
});

test("missing Gnosis randomness is rejected", () => {
  assert.throws(() => fallbackEpochSeed(commitment, undefined), { message: "gnosis randomness is missing" });
  assert.throws(() => fallbackEpochSeed(commitment, null), { message: "gnosis randomness is missing" });
});

test("short Gnosis randomness is rejected", () => {
  assert.throws(() => fallbackEpochSeed(commitment, new Uint8Array(0)), { message: "gnosis randomness is short" });
  assert.throws(() => fallbackEpochSeed(commitment, filled(31, 0x22)), { message: "gnosis randomness is short" });
});

test("long Gnosis randomness is rejected", () => {
  assert.throws(() => fallbackEpochSeed(commitment, filled(33, 0x22)), { message: "gnosis randomness is long" });
});
