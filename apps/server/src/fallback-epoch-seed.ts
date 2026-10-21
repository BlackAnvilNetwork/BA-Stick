/**
 * Step-3 fallback epoch seed.
 *
 * The leader publishes a 32-byte commitment before the Gnosis block
 * randomness for that epoch is known. The seed is
 * keccak256(gnosisRandomness || leaderCommitment), so a leader who has
 * already committed cannot grind the seed after seeing the randomness.
 * The randomness value is an argument. This does not read a chain, and
 * it does not touch the game-roll tape. Commit-reveal proofs are
 * rollout step 12.
 */
import { concatBytes, keccak256 } from "viem";

const WIDTH = 32;

function bytes32(value: Uint8Array | null | undefined, name: string): Uint8Array {
  if (value == null || !(value instanceof Uint8Array)) {
    throw new Error(`${name} is missing`);
  }
  if (value.length < WIDTH) throw new Error(`${name} is short`);
  if (value.length > WIDTH) throw new Error(`${name} is long`);
  return value;
}

/** 32-byte epoch seed. Same inputs always return the same bytes. */
export function fallbackEpochSeed(
  leaderCommitment: Uint8Array | null | undefined,
  gnosisRandomness: Uint8Array | null | undefined,
): Uint8Array {
  const commitment = bytes32(leaderCommitment, "leader commitment");
  const randomness = bytes32(gnosisRandomness, "gnosis randomness");
  return keccak256(concatBytes([randomness, commitment]), "bytes");
}
