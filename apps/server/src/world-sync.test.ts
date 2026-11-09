import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYNC_START,
  reduceWorldSync,
  syncBootExit,
  syncLabel,
  type SyncEvent,
  type WorldSync,
} from "./world-sync";
import { NO_WORLD_COPY } from "./world-identity";

const states: WorldSync[] = [
  SYNC_START,
  { state: "genesis" },
  { state: "identified" },
  { state: "missing-history", tokenIds: ["6"] },
  { state: "not-synced", detail: "empty" },
  { state: "behind-tail", localHead: "1", publishedHead: "9" },
  { state: "refused", reason: "wrong-contract", detail: "other world" },
];

const events: SyncEvent[] = [
  { type: "boot-invalid-config", detail: "no chain" },
  { type: "boot-identity-mismatch", detail: "other contract" },
  { type: "boot-empty", chainWorldExists: false, manifestPublished: false },
  { type: "boot-empty", chainWorldExists: true, manifestPublished: false },
  { type: "boot-empty", chainWorldExists: true, manifestPublished: true },
  { type: "boot-journal" },
  { type: "mint-pending" },
  { type: "mint-hole", tokenIds: ["6"] },
  { type: "manifest-empty", detail: "manifest" },
  { type: "tail-behind", localHead: "2", publishedHead: "8" },
  { type: "tail-caught-up" },
  { type: "forked-root", detail: "root diverged" },
];

describe("world sync reducer", () => {
  it("covers every event from every state", () => {
    for (const state of states) {
      for (const event of events) {
        const next = reduceWorldSync(state, event);
        assert.equal(typeof syncLabel(next), "string");
      }
    }
  });

  it("an empty directory with a chain world refuses, and a manifest makes it not-synced", () => {
    const refused = reduceWorldSync(SYNC_START, {
      type: "boot-empty",
      chainWorldExists: true,
      manifestPublished: false,
    });
    assert.equal(refused.state, "refused");
    if (refused.state === "refused") assert.equal(refused.reason, "empty-directory");
    assert.equal(syncBootExit(refused), NO_WORLD_COPY);

    const unsynced = reduceWorldSync(SYNC_START, {
      type: "boot-empty",
      chainWorldExists: true,
      manifestPublished: true,
    });
    assert.equal(unsynced.state, "not-synced");
    assert.equal(syncBootExit(unsynced), null);
  });

  it("a pending mint does not leave identified, and a hole does", () => {
    const identified = reduceWorldSync(SYNC_START, { type: "boot-journal" });
    assert.equal(reduceWorldSync(identified, { type: "mint-pending" }).state, "identified");
    const hole = reduceWorldSync(identified, { type: "mint-hole", tokenIds: ["6"] });
    assert.equal(hole.state, "missing-history");
    assert.equal(syncBootExit(hole), NO_WORLD_COPY);
  });

  it("refuses to turn a refused world into a journal, and caught-up only leaves behind-tail", () => {
    const refused = reduceWorldSync(SYNC_START, { type: "boot-identity-mismatch", detail: "no" });
    assert.equal(reduceWorldSync(refused, { type: "boot-journal" }).state, "refused");
    assert.equal(reduceWorldSync(refused, { type: "mint-hole", tokenIds: ["1"] }).state, "refused");
    const identified = reduceWorldSync(SYNC_START, { type: "boot-journal" });
    assert.equal(reduceWorldSync(identified, { type: "tail-caught-up" }).state, "identified");
    const behind = reduceWorldSync(identified, { type: "tail-behind", localHead: "1", publishedHead: "2" });
    assert.equal(reduceWorldSync(behind, { type: "tail-caught-up" }).state, "identified");
  });

  it("boot exits on a wrong contract and not on identified", () => {
    const mismatch = reduceWorldSync(SYNC_START, { type: "boot-identity-mismatch", detail: "chain 100" });
    assert.equal(syncBootExit(mismatch), "chain 100");
    assert.equal(syncBootExit({ state: "identified" }), null);
    assert.equal(syncBootExit({ state: "genesis" }), null);
  });
});
