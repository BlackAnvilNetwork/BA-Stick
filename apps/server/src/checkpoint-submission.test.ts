import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reduceCheckpoint } from "./checkpoint-submission";

describe("checkpoint submission", () => {
  it("moves drafted to submitted to confirmed, and a reorg cannot confirm", () => {
    const drafted = reduceCheckpoint(null, { type: "draft", bodyHash: "0xabc" });
    assert.equal(drafted?.phase, "drafted");
    const submitted = reduceCheckpoint(drafted, { type: "submit", txHash: "0xtx" });
    assert.equal(submitted?.phase, "submitted");
    assert.equal(reduceCheckpoint(null, { type: "submit", txHash: "0xtx" }), null);
    const confirmed = reduceCheckpoint(submitted, { type: "confirm", blockNumber: 10n });
    assert.equal(confirmed?.phase, "confirmed");
    const reorged = reduceCheckpoint(submitted, { type: "reorg" });
    assert.equal(reorged?.phase, "reorged");
    assert.equal(reduceCheckpoint(reorged, { type: "confirm", blockNumber: 11n })?.phase, "reorged");
    const redrafted = reduceCheckpoint(reorged, { type: "draft", bodyHash: "0xdef" });
    assert.equal(redrafted?.phase, "drafted");
  });
});
