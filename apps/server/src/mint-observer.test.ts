import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ZERO_ADDRESS,
  classifyMintGap,
  isMintTransfer,
  mintCharId,
  mintLogTopics,
  missingMintedTokenIds,
  summaryAheadOfJournal,
} from "./mint-observer";

describe("mint observer", () => {
  it("a mint is Transfer from the zero address", () => {
    assert.equal(isMintTransfer(ZERO_ADDRESS), true);
    assert.equal(isMintTransfer("0x0000000000000000000000000000000000000000"), true);
    assert.equal(isMintTransfer("0x6165040e7fe20ae5aac935898b9712818a3491cD"), false);
  });

  it("the character id is the token id, so both paths name the same row", () => {
    assert.equal(mintCharId("6"), "chain_6");
    assert.equal(mintCharId(" 6 "), "chain_6");
  });

  it("filters the mint log for one token from the zero address", () => {
    const topics = mintLogTopics("5");
    assert.equal(topics[1], "0x" + "0".repeat(64));
    assert.equal(topics[3].endsWith("5"), true);
    assert.equal(topics[3].length, 66);
  });

  it("unprocessed mints warn; a finished scan with a hole refuses", () => {
    assert.deepEqual(
      classifyMintGap({ missingTokenIds: [], scanComplete: true, unresolvedTokenIds: [] }),
      { action: "ok" },
    );
    const warn = classifyMintGap({ missingTokenIds: ["6"], scanComplete: false, unresolvedTokenIds: [] });
    assert.equal(warn.action, "warn");
    const unread = classifyMintGap({ missingTokenIds: [], scanComplete: true, unresolvedTokenIds: ["6"] });
    assert.equal(unread.action, "warn");
    assert.deepEqual(
      classifyMintGap({ missingTokenIds: ["2"], scanComplete: true, unresolvedTokenIds: [] }),
      { action: "refuse", missing: ["2"] },
    );
  });

  it("covers a fresh contract, one mint, and the live 1..5 set", () => {
    assert.deepEqual(missingMintedTokenIds(new Set(), 0n), []);
    assert.deepEqual(missingMintedTokenIds(new Set(), 1n), ["1"]);
    assert.deepEqual(missingMintedTokenIds(new Set(["1"]), 1n), []);
    assert.deepEqual(missingMintedTokenIds(new Set(["1", "2", "3", "4", "5"]), 5n), []);
    assert.deepEqual(missingMintedTokenIds(new Set(["1", "2", "3", "4", "5"]), 6n), ["6"]);
  });

  it("refuses a journal level below the checkpoint summary", () => {
    assert.equal(summaryAheadOfJournal(7, 1), true);
    assert.equal(summaryAheadOfJournal(7, 7), false);
    assert.equal(summaryAheadOfJournal(0, 1), false);
    assert.equal(summaryAheadOfJournal(1, 0), false);
  });
});
