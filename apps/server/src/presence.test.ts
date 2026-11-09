import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterPresence, mintBecomesMissingHistory, summaryWitnessAhead } from "./presence";

describe("character presence", () => {
  it("the journal is the authority, and a mint the cursor has not reached stays pending", () => {
    assert.deepEqual(characterPresence({ inJournal: true, mintBlock: 10n, scannedTo: 1n }), { kind: "on-journal" });
    assert.deepEqual(characterPresence({ inJournal: false, mintBlock: 50n, scannedTo: 40n }), {
      kind: "pending-mint",
      mintBlock: 50n,
      scannedTo: 40n,
    });
    assert.equal(characterPresence({ inJournal: false, mintBlock: null, scannedTo: 40n }).kind, "absent");
  });

  it("missing history waits until the cursor passes the mint", () => {
    assert.equal(
      mintBecomesMissingHistory({ inJournal: false, scanComplete: true, mintBlock: 80n, scannedTo: 79n, tip: 100n }),
      false,
    );
    assert.equal(
      mintBecomesMissingHistory({ inJournal: false, scanComplete: true, mintBlock: 80n, scannedTo: 80n, tip: 100n }),
      true,
    );
    assert.equal(
      mintBecomesMissingHistory({ inJournal: false, scanComplete: true, mintBlock: null, scannedTo: 70n, tip: 100n }),
      false,
    );
    assert.equal(
      mintBecomesMissingHistory({ inJournal: false, scanComplete: true, mintBlock: null, scannedTo: 100n, tip: 100n }),
      true,
    );
    assert.equal(
      mintBecomesMissingHistory({ inJournal: true, scanComplete: true, mintBlock: 1n, scannedTo: 100n, tip: 100n }),
      false,
    );
  });

  it("the summary witness refuses level 7 against a level 1 journal, and a level 1 summary does not", () => {
    assert.equal(summaryWitnessAhead(7, 1), true);
    assert.equal(summaryWitnessAhead(1, 1), false);
    assert.equal(summaryWitnessAhead(0, 7), false);
  });
});
