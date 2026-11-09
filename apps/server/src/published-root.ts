/**
 * The published world root is the engine's keccak Merkle tree over
 * `(tokenId, characterRoot)`, bound to the ruleset that replayed it.
 * `World.head()` is a flat hash of character heads. It can show a fork and
 * it cannot prove one character, so it is not the manifest root.
 *
 * There is no world-wide chain. Fork detection is ancestry: every character
 * chain must contain the published head. A shared genesis root is not enough,
 * because the same starting job diverges only on a later entry.
 */
import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";

export const PUBLISHED_ROOT_TAG: Hex = keccak256(toBytes("LOK_WORLD_ROOT_V1"));

export function publishedWorldRoot(merkleRoot: Hex, rulesetHash: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [PUBLISHED_ROOT_TAG, merkleRoot, rulesetHash],
    ),
  );
}

export function journalContainsPublishedHead(
  chains: readonly { tokenId: string; hashes: readonly string[] }[],
  publishedHead: string,
): boolean {
  if (chains.length === 0) return false;
  const want = publishedHead.toLowerCase();
  return chains.every((chain) => chain.hashes.some((hash) => hash.toLowerCase() === want));
}
