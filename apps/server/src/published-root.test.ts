import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journalContainsPublishedHead, publishedWorldRoot } from "./published-root";

describe("published root", () => {
  it("binds the merkle root to the ruleset", () => {
    const merkle = "0x" + "11".repeat(32);
    const rulesA = "0x" + "22".repeat(32);
    const rulesB = "0x" + "33".repeat(32);
    const a = publishedWorldRoot(merkle as `0x${string}`, rulesA as `0x${string}`);
    const b = publishedWorldRoot(merkle as `0x${string}`, rulesB as `0x${string}`);
    assert.notEqual(a, b);
    assert.equal(a, publishedWorldRoot(merkle as `0x${string}`, rulesA as `0x${string}`));
  });

  it("a shared genesis is not the published head when the chains diverge later", () => {
    const genesis = "0xgenesis";
    const published = "0xhead";
    const live = [
      { tokenId: "3", hashes: [genesis, "0xaaa", published] },
      { tokenId: "5", hashes: [genesis, published] },
    ];
    const fork = [
      { tokenId: "3", hashes: [genesis, "0xaaa", published] },
      { tokenId: "5", hashes: [genesis, "0xother"] },
    ];
    assert.equal(journalContainsPublishedHead(live, published), true);
    assert.equal(journalContainsPublishedHead(fork, published), false);
    assert.equal(journalContainsPublishedHead(fork, genesis), true);
  });
});
